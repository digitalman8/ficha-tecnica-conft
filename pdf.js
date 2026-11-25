import { readFileSync } from 'node:fs';
import { ajustar, formatar, rendimento } from './public/rendimento.js';

export function dimensoesJpeg(bytes) {
  if (bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) throw new Error('A foto não é um JPEG completo.');
  let i = 2;
  while (i + 9 < bytes.length && bytes[i] === 255) {
    const marcador = bytes[i + 1];
    if ([0xc0,0xc1,0xc2].includes(marcador)) {
      const altura = bytes.readUInt16BE(i + 5), largura = bytes.readUInt16BE(i + 7), canais = bytes[i + 9];
      if (altura > 0 && largura > 0 && [1,3].includes(canais)) return {altura,largura,canais};
      break;
    }
    const tamanho = bytes.readUInt16BE(i + 2);
    if (tamanho < 2 || marcador === 0xda) break;
    i += tamanho + 2;
  }
  throw new Error('Não foi possível ler a foto JPEG.');
}

const codificar = texto => Buffer.from(String(texto).replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[^\x20-\xff]/gu,'?'), 'latin1').toString('hex');
const largura = 595.28, altura = 841.89, margem = 71, direita = largura - 40, area = direita - margem;
const bytes = texto => Buffer.from(texto, 'ascii');
const regular = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const negrito = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const chocolate = '0.33 0.22 0.18';
const tinta = '0.13 0.12 0.11';
function medir(texto, tamanho, forte) {
  const tabela = forte ? negrito : regular;
  const codificado = Buffer.from(codificar(texto), 'hex').toString('latin1').normalize('NFD').replace(/\p{M}/gu, '');
  return [...codificado].reduce((total, letra) => total + (tabela[letra.charCodeAt(0) - 32] ?? 1000), 0) * tamanho / 1000;
}

function linhas(texto, tamanho, forte = false, limite = area) {
  return String(texto).split(/\r?\n/).flatMap(paragrafo => {
    const grupo = [];
    let linha = '';
    for (const palavra of paragrafo.trim().split(/\s+/)) {
      const candidata = linha ? linha + ' ' + palavra : palavra;
      if (medir(candidata, tamanho, forte) <= limite) {
        linha = candidata;
        continue;
      }
      if (linha) grupo.push(linha);
      linha = '';
      for (const letra of palavra) {
        if (linha && medir(linha + letra, tamanho, forte) > limite) {
          grupo.push(linha);
          linha = '';
        }
        linha += letra;
      }
    }
    return [...grupo, linha];
  });
}

export function gerarPdf(ficha, desejado, data = new Date()) {
  if (!ficha.nome || !ficha.ingredientes.length || !ficha.etapas.length) throw new Error('Cadastre pelo menos um ingrediente e uma etapa para exportar.');
  const { ingredientes, lotes } = ajustar(ficha, desejado);
  const objetos = [null, null, bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')];
  const gravar = objeto => objetos.push(objeto);
  const stream = (dados, atributos = '') => Buffer.concat([bytes('<< /Length ' + dados.length + ' ' + atributos + ' >>\nstream\n'), dados, bytes('\nendstream')]);
  const paginas = [];
  const cacheFotos = new Map();
  let pagina, y;
  const rendimentoEscolhido = rendimento(desejado, ficha.unidade);
  const topo = altura - 105;
  const limiteInferior = 62;
  function linha(texto, x, pos, tamanho, forte = false, cor = tinta) {
    pagina.comandos.push('BT /F' + (forte ? 2 : 1) + ' ' + tamanho + ' Tf ' + cor + ' rg ' + x + ' ' + pos + ' Td <' + codificar(texto) + '> Tj ET');
  }
  function traco(pos) {
    pagina.comandos.push('0.67 0.65 0.63 RG 0.6 w ' + margem + ' ' + pos + ' m ' + direita + ' ' + pos + ' l S');
  }
  function novaPagina() {
    pagina = {comandos:[], fotos:new Set()};
    paginas.push(pagina);
    y = altura - 50;
    if (paginas.length === 1) {
      linha('FICHAS TÉCNICAS  /  CONFEITARIA', margem, y, 10, true, chocolate);
    } else {
      const nome = linhas(ficha.nome, 15, true);
      linha(nome.length > 1 ? linhas(nome[0], 15, true, area - 18)[0] + '...' : nome[0], margem, y, 15, true, chocolate);
      y -= 19;
      linha(rendimentoEscolhido, margem, y, 12, true);
    }
    traco(y - 10);
    y = topo;
  }
  function reservar(espaco) {
    if (y - espaco < limiteInferior && y < topo) novaPagina();
  }
  const alturaTexto = (texto, tamanho, forte) => linhas(texto, tamanho, forte).length * (tamanho + 5) + 5;
  function paragrafo(texto, tamanho = 13, forte = false, cor = tinta) {
    for (const parte of linhas(texto, tamanho, forte)) {
      reservar(tamanho + 5);
      linha(parte, margem, y, tamanho, forte, cor);
      y -= tamanho + 5;
    }
    y -= 5;
  }
  function secao(titulo) {
    reservar(60);
    y -= 12;
    paragrafo(titulo, 20, true, chocolate);
  }
  function prepararImagem(origem, maxAltura) {
    if (!origem) return null;
    if (!cacheFotos.has(origem)) {
      const dados = origem.startsWith('data:') ? Buffer.from(origem.split(',')[1], 'base64') : readFileSync(new URL('./public' + origem, import.meta.url));
      const {largura,altura,canais} = dimensoesJpeg(dados);
      const id = gravar(stream(dados, '/Type /XObject /Subtype /Image /Width ' + largura + ' /Height ' + altura +
        ' /ColorSpace ' + (canais === 3 ? '/DeviceRGB' : '/DeviceGray') + ' /BitsPerComponent 8 /Filter /DCTDecode'));
      cacheFotos.set(origem, {id,largura,altura});
    }
    const foto = cacheFotos.get(origem);
    const escala = Math.min(area / foto.largura, maxAltura / foto.altura);
    return {id:foto.id, h:foto.altura * escala, w:foto.largura * escala};
  }
  function imagem(foto, x = margem) {
    if (!foto) return;
    const {h,w} = foto;
    reservar(h + 15);
    pagina.fotos.add(foto.id);
    pagina.comandos.push('q ' + w + ' 0 0 ' + h + ' ' + x + ' ' + (y - h) + ' cm /I' + foto.id + ' Do Q');
    y -= h + 15;
  }
  novaPagina();
  paragrafo(ficha.nome, 28, true, chocolate);
  paragrafo('Selecionado: ' + rendimentoEscolhido, 18, true);
  paragrafo([ficha.categoria, 'Versão ' + ficha.versao + '.0', 'Gerado em ' + data.toLocaleDateString('pt-BR', { timeZone:'America/Sao_Paulo' })].filter(Boolean).join(' | '), 10);
  if (ficha.descricao) paragrafo(ficha.descricao, 12);
  imagem(prepararImagem(ficha.capa, 92));
  paragrafo('Receita-base: ' + rendimento(ficha.base, ficha.unidade), 12);
  for (const [rotulo, valor] of [['Peso ou tamanho por unidade', ficha.peso], ['Forma', ficha.forma], ['Capacidade por lote', ficha.lote && rendimento(ficha.lote, ficha.unidade)], ['Lotes necessários', lotes]]) {
    if (valor) paragrafo(rotulo + ': ' + valor, 12);
  }
  const unidadeX = direita - 53;
  const quantidadeX = unidadeX - 18;
  const nomeLargura = quantidadeX - margem - 112;
  reservar(105);
  secao('Ingredientes');
  function cabecalhoTabela() {
    linha('Ingrediente', margem, y, 12, true);
    linha('Quantidade', quantidadeX - medir('Quantidade',12,true), y, 12, true);
    linha('Unidade', unidadeX, y, 12, true);
    traco(y - 6);
    y -= 23;
  }
  cabecalhoTabela();
  for (const item of ingredientes) {
    const nomes = linhas(item.nome, 13, false, nomeLargura);
    const espaco = nomes.length * 19 + 8;
    const anterior = pagina;
    reservar(espaco <= topo - limiteInferior - 23 ? espaco : 50);
    if (anterior !== pagina) cabecalhoTabela();
    const quantidade = formatar(item.ajustada);
    const tamanhoQuantidade = Math.min(14, 100 / medir(quantidade,1,true));
    linha(quantidade, quantidadeX - medir(quantidade,tamanhoQuantidade,true), y, tamanhoQuantidade, true);
    linha(item.unidade, unidadeX, y, 13);
    for (const nome of nomes) {
      const anterior = pagina;
      reservar(19);
      if (anterior !== pagina) cabecalhoTabela();
      linha(nome, margem, y, 13);
      y -= 19;
    }
    traco(y + 4);
    y -= 8;
  }
  if (ingredientes.some(item => item.fracao)) paragrafo('Atenção: há ingredientes em unidades fracionadas.', 10, true);
  ficha.etapas.forEach((etapa, i) => {
    const tit = (i + 1) + '. ' + etapa.titulo;
    const tempo = [etapa.tempo && 'Tempo: ' + etapa.tempo, etapa.temperatura && 'Temperatura: ' + etapa.temperatura].filter(Boolean).join('  |  ');
    const equipamento = etapa.equipamentos && 'Equipamentos: ' + etapa.equipamentos;
    const ponto = etapa.ponto ? linhas('Ponto esperado: ' + etapa.ponto, 13, true, area - 24) : [];
    const foto = prepararImagem(etapa.foto, 143);
    const espaco = alturaTexto(tit,17,true) + alturaTexto(etapa.instrucoes,13,false)
      + (tempo ? alturaTexto(tempo,13,true) : 0) + (equipamento ? alturaTexto(equipamento,12,false) : 0)
      + (ponto.length ? ponto.length * 18 + 14 : 0) + (foto ? foto.h + 15 : 0) + 12 + (i === 0 ? 42 : 0);
    reservar(espaco <= topo - limiteInferior ? espaco : (i === 0 ? 112 : 72));
    if (i === 0) secao('Modo de preparo');
    paragrafo(tit, 17, true, chocolate);
    if (tempo) paragrafo(tempo, 13, true);
    if (equipamento) paragrafo(equipamento, 12);
    paragrafo(etapa.instrucoes);
    imagem(foto);
    while (ponto.length) {
      reservar(Math.min(ponto.length * 18 + 14, topo - limiteInferior - 18));
      const grupo = ponto.splice(0, Math.floor((y - limiteInferior - 14) / 18));
      const caixa = grupo.length * 18 + 9;
      pagina.comandos.push('0.72 0.69 0.66 RG 0.8 w ' + margem + ' ' + (y - caixa + 6) + ' ' + area + ' ' + caixa + ' re S');
      grupo.forEach((parte, j) => linha(parte, margem + 12, y - 10 - j * 18, 13, true));
      y -= caixa + 5;
    }
    y -= 12;
  });
  const finais = [['Montagem e acabamento', ficha.montagem], ['Conservação', ficha.conservacao], ['Validade', ficha.validade], ['Observações', ficha.observacoes]].filter(([,valor]) => valor);
  if (finais.length || ficha.final) {
    const foto = prepararImagem(ficha.final, 82);
    const textos = finais.map(([chave, valor]) => chave + ': ' + valor);
    const linhasLaterais = foto && foto.w <= area / 2
      ? textos.map(texto => linhas(texto, 13, false, area - foto.w - 22))
      : [];
    const ladoALado = linhasLaterais.length && linhasLaterais.reduce((soma, grupo) => soma + grupo.length * 18 + 5, 0) <= foto.h;
    if (ladoALado) reservar(42 + 21 + foto.h + 15);
    secao('Informações finais');
    if (ladoALado) {
      const inicio = y;
      for (const grupo of linhasLaterais) {
        for (const parte of grupo) {
          linha(parte, margem, y, 13);
          y -= 18;
        }
        y -= 5;
      }
      y = inicio;
      linha('Padrão final', direita - foto.w, y, 11, true);
      y -= 21;
      imagem(foto, direita - foto.w);
    } else {
      for (const texto of textos) paragrafo(texto);
      if (foto) {
        reservar(alturaTexto('Padrão final',11,true) + foto.h + 15);
        paragrafo('Padrão final', 11, true);
        imagem(foto);
      }
    }
  }
  const ids = paginas.map((item, i) => {
    pagina = item;
    traco(49);
    linha('FICHA TÉCNICA  /  VERSÃO ' + ficha.versao + '.0', margem, 33, 9);
    const numeroPagina = 'Página ' + (i + 1) + ' de ' + paginas.length;
    linha(numeroPagina, direita - medir(numeroPagina,10,true), 33, 10, true);
    const conteudo = gravar(stream(bytes(item.comandos.join('\n'))));
    const imagens = [...item.fotos].map(id => '/I' + id + ' ' + id + ' 0 R').join(' ');
    return gravar(bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + largura + ' ' + altura + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ' + imagens + ' >> >> /Contents ' + conteudo + ' 0 R >>'));
  });
  objetos[0] = bytes('<< /Type /Catalog /Pages 2 0 R >>');
  objetos[1] = bytes('<< /Type /Pages /Count ' + ids.length + ' /Kids [' + ids.map(id => id + ' 0 R').join(' ') + '] >>');
  const blocos = [Buffer.from('%PDF-1.4\n%âãÏÓ\n', 'latin1')];
  const posicoes = ['0000000000 65535 f \n'];
  let posicao = blocos[0].length;
  objetos.forEach((objeto, i) => {
    posicoes.push(String(posicao).padStart(10, '0') + ' 00000 n \n');
    const bloco = Buffer.concat([bytes((i + 1) + ' 0 obj\n'), objeto, bytes('\nendobj\n')]);
    blocos.push(bloco);
    posicao += bloco.length;
  });
  blocos.push(bytes('xref\n0 ' + posicoes.length + '\n' + posicoes.join('') + 'trailer\n<< /Size ' + posicoes.length + ' /Root 1 0 R >>\nstartxref\n' + posicao + '\n%%EOF\n'));
  return Buffer.concat(blocos);
}
