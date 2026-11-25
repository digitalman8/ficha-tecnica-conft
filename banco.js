import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { exemplos } from './exemplos.js';
import { numero, valido } from './public/rendimento.js';
import { dimensoesJpeg } from './pdf.js';

const campos = ['nome','categoria','descricao','forma','peso','montagem','conservacao','validade','observacoes'];
const camposEtapa = ['titulo','instrucoes','tempo','temperatura','equipamentos','ponto'];
const texto = (obj, chave) => {
  const valor = obj[chave] ?? '';
  if (typeof valor !== 'string' || valor.length > 12000) throw new Error('Revise o tamanho dos campos de texto.');
  return valor.trim();
};

function foto(valor) {
  if (!valor) return '';
  if (['/fotos/brownie.jpg','/fotos/cenoura.jpg','/fotos/chocolate.jpg'].includes(valor)) return valor;
  if (typeof valor !== 'string' || valor.length > 2500000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(valor)) throw new Error('Foto inválida ou muito grande.');
  dimensoesJpeg(Buffer.from(valor.split(',')[1], 'base64'));
  return valor;
}

function validar(dados) {
  const ficha = Object.fromEntries(campos.map(chave => [chave, texto(dados, chave)]));
  if (!ficha.nome || !valido(dados.base) || !['unidades','porções','g','kg','ml','L'].includes(dados.unidade)) {
    throw new Error('Informe o nome, a quantidade e a unidade do rendimento-base.');
  }
  if (dados.lote && !valido(dados.lote)) throw new Error('Informe uma capacidade por lote válida.');
  if (!Array.isArray(dados.ingredientes) || !Array.isArray(dados.etapas) || dados.ingredientes.length > 150 || dados.etapas.length > 100) {
    throw new Error('Revise a lista de ingredientes e etapas.');
  }
  ficha.ingredientes = dados.ingredientes.map((item, i) => {
    const nome = texto(item, 'nome');
    if (!nome || !valido(item.quantidade) || !['g','kg','ml','L','un.'].includes(item.unidade)) throw new Error('Revise os dados do ingrediente ' + (i + 1) + '.');
    return { nome, quantidade: numero(item.quantidade), unidade: item.unidade };
  });
  ficha.etapas = dados.etapas.map((item, i) => {
    const etapa = Object.fromEntries(camposEtapa.map(chave => [chave, texto(item, chave)]));
    if (!etapa.titulo || !etapa.instrucoes) throw new Error('Informe o título e as instruções da etapa ' + (i + 1) + '.');
    return { ...etapa, foto: foto(item.foto) };
  });
  return { ...ficha, base: numero(dados.base), unidade: dados.unidade, lote: dados.lote ? numero(dados.lote) : null, capa: foto(dados.capa), final: foto(dados.final) };
}

export function abrirBanco(caminho) {
  const db = new DatabaseSync(caminho);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS fichas (id TEXT PRIMARY KEY, dados TEXT NOT NULL, versao INTEGER NOT NULL, exemplo INTEGER NOT NULL, arquivada INTEGER NOT NULL, criada TEXT NOT NULL, atualizada TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ingredientes (id TEXT PRIMARY KEY, ficha TEXT NOT NULL REFERENCES fichas(id), ordem INTEGER NOT NULL, dados TEXT NOT NULL, UNIQUE(ficha, ordem));
    CREATE TABLE IF NOT EXISTS etapas (id TEXT PRIMARY KEY, ficha TEXT NOT NULL REFERENCES fichas(id), ordem INTEGER NOT NULL, dados TEXT NOT NULL, UNIQUE(ficha, ordem));
  `);
  const hidratar = row => ({ ...JSON.parse(row.dados), id: row.id, versao: row.versao, exemplo: !!row.exemplo, arquivada: !!row.arquivada, criada: row.criada, atualizada: row.atualizada });
  const get = id => {
    const row = db.prepare('SELECT * FROM fichas WHERE id=?').get(id);
    if (!row) return null;
    const ficha = hidratar(row);
    for (const tabela of ['ingredientes','etapas']) {
      ficha[tabela] = db.prepare('SELECT id, ordem, dados FROM ' + tabela + ' WHERE ficha=? ORDER BY ordem').all(id)
        .map(item => ({ ...JSON.parse(item.dados), id: item.id, ficha: id, ordem: item.ordem }));
    }
    return ficha;
  };
  function transacao(operacao) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const resultado = operacao();
      db.exec('COMMIT');
      return resultado;
    } catch (erro) {
      db.exec('ROLLBACK');
      throw erro;
    }
  }
  function gravar(dados, anterior, exemplo) {
    const { ingredientes, etapas, ...ficha } = validar(dados);
    const id = anterior?.id ?? randomUUID();
    const agora = new Date().toISOString();
    db.prepare(`INSERT INTO fichas VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      dados=excluded.dados, versao=excluded.versao, atualizada=excluded.atualizada`)
      .run(id, JSON.stringify(ficha), (anterior?.versao ?? 0) + 1, Number(anterior?.exemplo ?? exemplo), Number(anterior?.arquivada ?? false), anterior?.criada ?? agora, agora);
    for (const [tabela, itens] of Object.entries({ ingredientes, etapas })) {
      db.prepare('DELETE FROM ' + tabela + ' WHERE ficha=?').run(id);
      const inserir = db.prepare('INSERT INTO ' + tabela + ' VALUES (?,?,?,?)');
      const ids = new Set((anterior?.[tabela] ?? []).map(item => item.id));
      itens.forEach((item, ordem) => {
        const candidato = dados[tabela][ordem].id;
        const idItem = ids.delete(candidato) ? candidato : randomUUID();
        inserir.run(idItem, id, ordem, JSON.stringify(item));
      });
    }
    return id;
  }
  function salvar(dados, anterior = null, exemplo = false) {
    const id = transacao(() => gravar(dados, anterior, exemplo));
    return get(id);
  }
  transacao(() => {
    if (db.prepare('PRAGMA user_version').get().user_version !== 0) return;
    if (!db.prepare('SELECT 1 FROM fichas LIMIT 1').get()) exemplos.forEach(ficha => gravar(ficha, null, true));
    db.exec('PRAGMA user_version = 1');
  });
  return {
    get, salvar,
    listar: () => db.prepare('SELECT * FROM fichas ORDER BY criada, rowid').all().map(row => {
      const {id,nome,categoria,base,unidade,capa,exemplo,arquivada} = hidratar(row);
      return {id,nome,categoria,base,unidade,capa,exemplo,arquivada};
    }),
    arquivar(id, estado) {
      db.prepare('UPDATE fichas SET arquivada=?, atualizada=? WHERE id=?').run(Number(estado), new Date().toISOString(), id);
      return get(id);
    },
    excluir(id) {
      transacao(() => {
        db.prepare('DELETE FROM ingredientes WHERE ficha=?').run(id);
        db.prepare('DELETE FROM etapas WHERE ficha=?').run(id);
        db.prepare('DELETE FROM fichas WHERE id=?').run(id);
      });
    },
    fechar: () => db.close()
  };
}
