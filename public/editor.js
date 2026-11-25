import { valido } from './rendimento.js';

const unidades = ['unidades','porções','g','kg','ml','L'];
const medidas = ['g','kg','ml','L','un.'];
export const esc = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const campo = (chave, rotulo, valor, {longo, requerido, decimal} = {}) => `<label>${rotulo}${longo
  ? `<textarea name="${chave}" maxlength="12000"${requerido ? ' required' : ''}>${esc(valor)}</textarea>`
  : `<input name="${chave}" value="${esc(valor)}" maxlength="${decimal ? 12 : 12000}"${decimal ? ' inputmode="decimal" pattern="[0-9]+([.,][0-9]{1,4})?"' : ''}${requerido ? ' required' : ''}>`}</label>`;
const lista = (chave, rotulo, opcoes, valor) => `<label>${rotulo}<select name="${chave}">${opcoes.map(u => `<option value="${u}" ${u === valor ? 'selected' : ''}>${u === 'un.' ? 'unidade' : u}</option>`).join('')}</select></label>`;
const fotocampo = (chave, rotulo, valor) => `<div class="foto-campo" data-foto="${chave}">
  <label>${rotulo}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
  <div class="foto-preview"></div>
  <button type="button" class="secundario retirar-foto"${valor ? '' : ' hidden'}>Remover foto</button>
  <span class="foto-status" role="status"></span>
</div>`;
const final = [['montagem','Montagem e finalização'],['conservacao','Conservação'],['validade','Validade definida por você'],['observacoes','Observações']];
const detalhesEtapa = [['tempo','Tempo estimado'],['temperatura','Temperatura'],['equipamentos','Equipamentos'],['ponto','Ponto esperado']];

async function redimensionar(arquivo) {
  if (arquivo.size > 20 * 1024 * 1024) throw new Error('Selecione uma foto de até 20 MB.');
  const imagem = await createImageBitmap(arquivo);
  try {
    const escala = Math.min(1, 1400 / Math.max(imagem.width, imagem.height));
    const tela = document.createElement('canvas');
    tela.width = Math.max(1, Math.round(imagem.width * escala));
    tela.height = Math.max(1, Math.round(imagem.height * escala));
    const ctx = tela.getContext('2d', {alpha:false});
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,tela.width,tela.height);
    ctx.drawImage(imagem,0,0,tela.width,tela.height);
    return tela.toDataURL('image/jpeg',0.85);
  } finally {
    imagem.close();
  }
}

export function montarEditor(raiz, origem, salvar, voltar) {
  const ficha = origem ? structuredClone(origem) : {unidade:'unidades', ingredientes:[], etapas:[]};
  const fotoDados = new WeakMap();
  raiz.innerHTML = `<button type="button" class="link" id="voltar">‹ Minhas fichas</button>
  <h1>${origem ? 'Editar ficha' : 'Nova ficha técnica'}</h1>
  <form class="editor">
    <section class="painel"><h2>Identificação</h2><div class="grade-form">
      ${campo('nome','Nome do produto',ficha.nome,{requerido:true})}
      ${campo('categoria','Categoria',ficha.categoria)}
    </div>${campo('descricao','Descrição curta',ficha.descricao,{longo:true})}
    ${fotocampo('capa','Foto principal',ficha.capa)}</section>
    <section class="painel"><h2>Rendimento</h2><div class="grade-form">
      ${campo('base','Quantidade da receita-base',ficha.base,{requerido:true,decimal:true})}
      ${lista('unidade','Unidade de rendimento',unidades,ficha.unidade)}
      ${campo('peso','Peso ou tamanho por unidade',ficha.peso)}
      ${campo('forma','Dimensões da forma ou recipiente',ficha.forma)}
      ${campo('lote','Capacidade por lote na mesma unidade',ficha.lote,{decimal:true})}
    </div></section>
    <section class="painel"><h2>Ingredientes</h2><div id="ingredientes-editor"></div><button type="button" class="secundario" data-adicionar="ingredientes">+ Adicionar ingrediente</button></section>
    <section class="painel"><h2>Modo de preparo</h2><div id="etapas-editor"></div><button type="button" class="secundario" data-adicionar="etapas">+ Adicionar etapa</button></section>
    <section class="painel"><h2>Informações complementares</h2>
    ${final.map(([k,l]) => campo(k,l,ficha[k],{longo:true})).join('')}
    ${fotocampo('final','Foto do produto final',ficha.final)}</section>
    <p id="erro-editor" role="alert" class="erro" hidden></p>
    <div class="acoes"><button class="primario" type="submit">Salvar ficha</button><button class="secundario" type="button" id="cancelar">Cancelar</button></div>
  </form>`;
  const form = raiz.querySelector('form');
  const erro = raiz.querySelector('#erro-editor');
  let pendentes = 0;
  let sujo = false;
  let salvando = false;
  const sair = () => {
    if (!salvando && (!sujo || window.confirm('Descartar as alterações desta edição?'))) voltar();
  };
  raiz.querySelector('#voltar').onclick = sair;
  raiz.querySelector('#cancelar').onclick = sair;
  form.addEventListener('input', () => { sujo = true; });
  function prepararFoto(bloco, inicial) {
    const input = bloco.querySelector('input');
    const preview = bloco.querySelector('.foto-preview');
    const retirar = bloco.querySelector('button');
    const status = bloco.querySelector('.foto-status');
    function exibir(valor) {
      fotoDados.set(bloco,valor || '');
      preview.innerHTML = valor ? `<img src="${esc(valor)}" alt="Prévia da foto selecionada">` : '';
      retirar.hidden = !valor;
    }
    exibir(inicial);
    input.onchange = async () => {
      if (!input.files[0]) return;
      pendentes++;
      input.disabled = retirar.disabled = true;
      status.textContent = 'Preparando foto…';
      try {
        exibir(await redimensionar(input.files[0]));
        status.textContent = 'Foto pronta.';
      } catch {
        status.textContent = 'Não foi possível abrir a foto. Use uma imagem válida de até 20 MB.';
      } finally {
        pendentes--;
        input.disabled = retirar.disabled = false;
        input.value = '';
      }
    };
    retirar.onclick = () => { sujo = true; exibir(''); status.textContent = 'Foto removida.'; };
  }
  for (const chave of ['capa','final']) prepararFoto(form.querySelector('[data-foto="' + chave + '"]'), ficha[chave]);
  const grupos = Object.fromEntries(['ingredientes','etapas'].map(k => [k, form.querySelector('#' + k + '-editor')]));
  function atualizarOrdem(grupo) {
    [...grupo.children].forEach((item,i) => {
      item.querySelector('legend').textContent = (grupo === grupos.etapas ? 'Etapa ' : 'Ingrediente ') + (i + 1);
      item.querySelector('[data-mover="subir"]').disabled = i === 0;
      item.querySelector('[data-mover="descer"]').disabled = i === grupo.children.length - 1;
    });
  }
  function adicionar(tipo, valor = {}) {
    const grupo = grupos[tipo];
    const item = document.createElement('fieldset');
    if (valor.id) item.dataset.id = valor.id;
    item.innerHTML = `<legend></legend>
      ${tipo === 'ingredientes' ? `<div class="grade-ingredientes">
      ${campo('nome','Ingrediente',valor.nome,{requerido:true})}
      ${campo('quantidade','Quantidade',valor.quantidade,{requerido:true,decimal:true})}
      ${lista('unidade','Unidade',medidas,valor.unidade)}</div>` : `
      ${campo('titulo','Título',valor.titulo,{requerido:true})}
      ${campo('instrucoes','Instruções',valor.instrucoes,{longo:true,requerido:true})}
      <div class="grade-form">${detalhesEtapa.map(([k,l]) => campo(k,l,valor[k])).join('')}</div>
      ${fotocampo('foto','Foto da etapa',valor.foto)}`}
      <div class="acoes linha-edicao"><button type="button" class="secundario" data-mover="subir">Subir</button><button type="button" class="secundario" data-mover="descer">Descer</button><button type="button" class="link remover">Remover</button></div>`;
    if (tipo === 'etapas') prepararFoto(item.querySelector('[data-foto]'), valor.foto);
    item.querySelector('[data-mover="subir"]').onclick = () => {
      sujo = true;
      grupo.insertBefore(item,item.previousElementSibling);
      atualizarOrdem(grupo);
      (item.querySelector('[data-mover="subir"]:enabled') ?? item.querySelector('[data-mover="descer"]')).focus();
    };
    item.querySelector('[data-mover="descer"]').onclick = () => {
      sujo = true;
      grupo.insertBefore(item.nextElementSibling,item);
      atualizarOrdem(grupo);
      (item.querySelector('[data-mover="descer"]:enabled') ?? item.querySelector('[data-mover="subir"]')).focus();
    };
    item.querySelector('.remover').onclick = () => {
      sujo = true;
      item.remove();
      atualizarOrdem(grupo);
      form.querySelector('[data-adicionar="' + tipo + '"]').focus();
    };
    grupo.append(item);
    atualizarOrdem(grupo);
    return item;
  }
  for (const tipo of Object.keys(grupos)) {
    ficha[tipo].forEach(item => adicionar(tipo,item));
    form.querySelector('[data-adicionar="' + tipo + '"]').onclick = () => {
      sujo = true;
      adicionar(tipo).querySelector('input').focus();
    };
  }
  form.onsubmit = async evento => {
    evento.preventDefault();
    if (salvando) return;
    erro.hidden = true;
    const submit = form.querySelector('[type=submit]');
    try {
      if (pendentes) throw new Error('Aguarde o processamento das fotos.');
      const ler = (bloco, chaves) => Object.fromEntries(chaves.map(k => [k,bloco.querySelector('[name="' + k + '"]').value.trim()]));
      const dados = {...ler(form,['nome','categoria','descricao','base','unidade','peso','forma','lote',...final.map(([k]) => k)]),versao:ficha.versao};
      for (const k of ['capa','final']) dados[k] = fotoDados.get(form.querySelector('[data-foto="' + k + '"]'));
      dados.ingredientes = [...grupos.ingredientes.children].map(item => ({id:item.dataset.id,...ler(item,['nome','quantidade','unidade'])}));
      dados.etapas = [...grupos.etapas.children].map(item => ({id:item.dataset.id,...ler(item,['titulo','instrucoes',...detalhesEtapa.map(([k]) => k)]),foto:fotoDados.get(item.querySelector('[data-foto]'))}));
      if (!dados.nome || !valido(dados.base) || (dados.lote && !valido(dados.lote))) throw new Error('Informe o nome e revise as quantidades de rendimento e lote.');
      if (dados.ingredientes.some(item => !item.nome || !valido(item.quantidade))) throw new Error('Informe um nome e uma quantidade positiva para cada ingrediente.');
      if (dados.etapas.some(item => !item.titulo || !item.instrucoes)) throw new Error('Informe título e instruções para cada etapa.');
      salvando = submit.disabled = true;
      submit.textContent = 'Salvando…';
      await salvar(dados);
    } catch (falha) {
      erro.textContent = falha.message;
      erro.hidden = false;
      erro.tabIndex = -1;
      erro.focus();
    } finally {
      salvando = submit.disabled = false;
      submit.textContent = 'Salvar ficha';
    }
  };
  raiz.querySelector('input').focus();
  return () => !salvando && (!sujo || window.confirm('Descartar as alterações desta edição?'));
}
