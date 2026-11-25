import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirBanco } from './banco.js';
import { gerarPdf } from './pdf.js';
import { numero, valido } from './public/rendimento.js';

const publicDir = fileURLToPath(new URL('./public/', import.meta.url));
const dados = process.env.FICHAS_DADOS ? resolve(process.env.FICHAS_DADOS) : fileURLToPath(new URL('./dados/', import.meta.url));
mkdirSync(dados, {recursive:true});
const banco = abrirBanco(join(dados, 'fichas.sqlite'));
const mime = {html:'text/html; charset=utf-8', css:'text/css; charset=utf-8', js:'text/javascript; charset=utf-8', jpg:'image/jpeg', png:'image/png'};
const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const json = (res, status, dados) => res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(dados));
const limiteBackup = 256 * 1024 * 1024;
const erroTamanhoBackup = 'O backup ultrapassa o limite de 256 MB.';
async function corpo(req, limite = 32000000, erroTamanho = 'As fotos ultrapassam o tamanho máximo total.') {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) throw new Error('Formato da solicitação inválido.');
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > limite) throw new Error(erroTamanho);
    partes.push(parte);
  }
  const valor = JSON.parse(Buffer.concat(partes, total).toString());
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Dados inválidos.');
  return valor;
}
const servidor = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; object-src 'none'; frame-ancestors 'none'");
  try {
    const {pathname, searchParams} = new URL(req.url, 'http://localhost');
    const metodo = req.method;
    if (pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control','no-store');
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(res,403,{erro:'Origem não autorizada.'});
      if (pathname === '/api/backup' && metodo === 'GET') {
        const backup = banco.exportarBackup();
        const fotos = new Map();
        async function incluirFoto(item, chave) {
          const caminho = item[chave];
          if (!caminho.startsWith('/fotos/')) return;
          if (!fotos.has(caminho)) {
            const bytes = await readFile(join(publicDir, caminho.slice(1)));
            fotos.set(caminho, 'data:image/jpeg;base64,' + bytes.toString('base64'));
          }
          item[chave] = fotos.get(caminho);
        }
        for (const ficha of backup.fichas) {
          await incluirFoto(ficha,'capa');
          await incluirFoto(ficha,'final');
          for (const etapa of ficha.etapas) await incluirFoto(etapa,'foto');
        }
        const conteudo = JSON.stringify(backup);
        if (Buffer.byteLength(conteudo) > limiteBackup) return json(res,413,{erro:erroTamanhoBackup});
        res.setHeader('Content-Disposition','attachment; filename="backup-fichas-tecnicas-' + backup.geradoEm.replaceAll(':','-') + '.json"');
        return res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}).end(conteudo);
      }
      if (metodo === 'POST' && ['/api/backup/prever','/api/backup/restaurar'].includes(pathname)) {
        const backup = await corpo(req, limiteBackup, erroTamanhoBackup);
        const resultado = pathname.endsWith('/prever') ? banco.preverBackup(backup) : banco.restaurarBackup(backup);
        return json(res,200,resultado);
      }
      if (pathname === '/api/fichas') {
        if (metodo === 'GET') return json(res,200,banco.listar());
        if (metodo === 'POST') return json(res,201,banco.salvar(await corpo(req)));
      }
      const rota = pathname.match(/^\/api\/fichas\/([a-f0-9-]{36})(?:\/(pdf|duplicar|arquivo))?$/);
      if (!rota) return json(res,404,{erro:'Ficha não encontrada.'});
      const [,id,acao] = rota;
      const novosDados = metodo === 'PUT' || acao === 'arquivo' && metodo === 'POST' ? await corpo(req) : null;
      const ficha = banco.get(id);
      if (!ficha) return json(res,404,{erro:'Ficha não encontrada.'});
      if (!acao && metodo === 'GET') return json(res,200,ficha);
      if (!acao && metodo === 'DELETE') {
        banco.excluir(id);
        return res.writeHead(204).end();
      }
      if (!acao && metodo === 'PUT') {
        if (novosDados.versao !== ficha.versao) return json(res,409,{erro:'Esta ficha foi alterada em outra aba. Copie suas alterações antes de recarregar.'});
        return json(res,200,banco.salvar(novosDados,ficha));
      }
      if (acao === 'duplicar' && metodo === 'POST') return json(res,201,banco.salvar({...ficha,nome:ficha.nome + ' (cópia)'},null,ficha.exemplo));
      if (acao === 'arquivo' && metodo === 'POST' && typeof novosDados.arquivada === 'boolean') return json(res,200,banco.arquivar(id,novosDados.arquivada));
      if (acao === 'pdf' && metodo === 'GET') {
        const bruto = searchParams.get('rendimento');
        if (!valido(bruto)) throw new Error('Informe um rendimento válido para exportar.');
        const valor = numero(bruto);
        const pdf = gerarPdf(ficha,valor);
        const nome = 'ficha-tecnica-' + (slug(ficha.nome).slice(0,85) || 'produto') + '-v' + ficha.versao + '-' + valor + '-' + slug(ficha.unidade) + '.pdf';
        return res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':pdf.length,'Content-Disposition':'attachment; filename="' + nome + '"'}).end(pdf);
      }
      return json(res,405,{erro:'Operação indisponível.'});
    }
    const arquivo = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (metodo === 'GET' && /^(?:[\w-]+\.(?:html|css|js)|fotos\/[\w-]+\.(?:jpg|png))$/.test(arquivo)) {
      const conteudo = await readFile(join(publicDir,arquivo));
      return res.writeHead(200,{'Content-Type':mime[arquivo.split('.').at(-1)]}).end(conteudo);
    }
    return json(res,404,{erro:'Página não encontrada.'});
  } catch (erro) {
    if (erro.code === 'ENOENT') return json(res,404,{erro:'Arquivo não encontrado.'});
    if (erro.code?.startsWith('ERR_SQLITE')) {
      console.error(erro);
      return json(res,500,{erro:'Não foi possível acessar o banco de dados.'});
    }
    return json(res,400,{erro:erro instanceof SyntaxError ? 'Dados inválidos.' : erro.message});
  }
});
servidor.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Fichas técnicas em http://127.0.0.1:' + servidor.address().port));
