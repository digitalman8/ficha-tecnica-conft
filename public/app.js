import { ajustar, formatar, rendimento, numero, valido } from './rendimento.js';
import { esc, montarEditor } from './editor.js';

const $ = seletor => document.querySelector(seletor);
const raiz = $('#conteudo');
const app = $('#app');
const busca = $('#busca'), categoria = $('#categoria'), estado = $('#estado');
let catalogo = [], ficha = null, desejado, etapa = 0, selecao = 0, descartar, timer;
let concluidas = new Set();
const chaveBusca = valor => valor.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
const unidadeCurta = unidade => ({unidades:'un.', 'porções':'porç.'})[unidade] ?? unidade;
const img = (src, alt, classe = '') => src ? `<img class="${classe}" src="${esc(src)}" alt="${esc(alt)}">` : '';
const rota = id => '/api/fichas' + (id ? '/' + id : '');
const botao = (id, rotulo, classe = 'secundario') => `<button id="${id}" type="button" class="${classe}">${rotulo}</button>`;
const camposFinais = [['montagem','Montagem e finalização'],['conservacao','Conservação'],['validade','Validade'],['observacoes','Observações']];

function avisar(msg) {
  const elemento = $('#notificacao');
  elemento.textContent = msg;
  elemento.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { elemento.hidden = true; },6500);
}
async function api(url, metodo = 'GET', dados) {
  let resposta;
  try {
    resposta = await fetch(url,{method:metodo,...(dados ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)} : {})});
  } catch {
    throw new Error('Não foi possível conectar ao aplicativo. Verifique se o servidor está em execução.');
  }
  if (!resposta.ok) throw new Error((await resposta.json().catch(() => ({}))).erro || 'Não foi possível concluir a operação.');
  return resposta;
}
function mostrarCatalogo() {
  const filtro = categoria.value;
  const categorias = [...new Set(catalogo.map(item => item.categoria).filter(Boolean))].sort((a,b) => a.localeCompare(b,'pt-BR'));
  categoria.innerHTML = '<option value="">Todas as categorias</option>' + categorias.map(nome => `<option>${esc(nome)}</option>`).join('');
  categoria.value = categorias.includes(filtro) ? filtro : '';
  const filtrado = catalogo.filter(item => item.arquivada === (estado.value === 'arquivo') &&
    (!categoria.value || item.categoria === categoria.value) && chaveBusca(item.nome).includes(chaveBusca(busca.value.trim())));
  $('#catalogo').innerHTML = filtrado.length ? filtrado.map(item => `<article class="cartao ${ficha?.id === item.id ? 'selecionado' : ''}">
    <div class="capa-catalogo">${img(item.capa,item.nome)}
    ${item.categoria ? `<span class="selo">${esc(item.categoria)}</span>` : ''}</div>
    <div class="cartao-rodape"><div><h2>${esc(item.nome)}</h2>
      <p>${rendimento(item.base,item.unidade)} por receita</p>
      ${item.exemplo ? '<span class="exemplo">Exemplo demonstrativo</span>' : ''}</div>
      <button class="primario abrir" type="button" data-id="${esc(item.id)}" aria-label="Abrir ficha de ${esc(item.nome)}">Abrir ficha</button>
    </div></article>`).join('') : `<div class="vazio"><h2>${estado.value === 'arquivo' ? 'Nenhuma ficha arquivada' : 'Nenhuma ficha encontrada'}</h2>
    ${estado.value === 'ativas' ? '<button class="primario" id="nova-vazio" type="button">Criar ficha técnica</button>' : ''}</div>`;
  $('#nova-vazio')?.addEventListener('click',() => editar());
}
async function recarregar() {
  catalogo = await (await api(rota())).json();
  mostrarCatalogo();
}
function voltar() {
  selecao++;
  descartar = null;
  app.classList.remove('detalhe');
  if (ficha) visualizar();
  else raiz.innerHTML = '<div class="vazio"><h2>Selecione uma ficha técnica</h2></div>';
  $('#titulo-catalogo').tabIndex = -1;
  $('#titulo-catalogo').focus();
}
function abrirTela(focar = true) {
  app.classList.add('detalhe');
  if (focar) {
    raiz.focus({preventScroll:true});
    if (matchMedia('(max-width: 1000px)').matches) window.scrollTo(0,0);
  }
}
async function abrir(id, inicial = false) {
  const pedido = ++selecao;
  if (!inicial) {
    abrirTela();
    raiz.innerHTML = '<p role="status">Carregando ficha…</p>';
  }
  try {
    const resultado = await (await api(rota(id))).json();
    if (pedido !== selecao) return;
    ficha = resultado;
    desejado = ficha.base;
    etapa = 0;
    concluidas = new Set();
    // A abertura inicial do exemplo reproduz o estado do mockup no desktop.
    if (inicial && ficha.exemplo && ficha.nome === 'Brownie tradicional') {
      desejado = ficha.base * 2;
      etapa = 1;
    }
    visualizar();
    mostrarCatalogo();
  } catch (erro) {
    if (pedido !== selecao) return;
    raiz.innerHTML = `<p class="erro" role="alert">${esc(erro.message)}</p>${botao('retorno','Minhas fichas','link')}`;
    $('#retorno').onclick = voltar;
  }
}
function editar(origem = null) {
  if (descartar && !descartar()) return;
  selecao++;
  abrirTela();
  descartar = montarEditor(raiz, origem, async dados => {
    const nova = await (await api(rota(origem?.id),origem ? 'PUT' : 'POST',dados)).json();
    descartar = null;
    ficha = nova;
    desejado = nova.base;
    etapa = 0;
    concluidas = new Set();
    estado.value = nova.arquivada ? 'arquivo' : 'ativas';
    busca.value = categoria.value = '';
    visualizar();
    abrirTela();
    await recarregar().catch(erro => avisar(erro.message));
    avisar('Ficha salva.');
  }, voltar);
}
function visualizar() {
  const temFinais = camposFinais.some(([k]) => ficha[k]) || ficha.final;
  const opcoes = [1,2,3].map(x => Math.round(ficha.base * x * 10000) / 10000).filter(valido);
  raiz.innerHTML = `<div class="topo"><div class="migalhas">${botao('retorno','Minhas fichas','link')} <span aria-hidden="true">/</span> <strong>${esc(ficha.nome)}</strong></div>
    <div class="acoes topo-acoes">${botao('editar','Editar')}${botao('pdf','Exportar PDF','primario')}
    <details class="menu"><summary>Mais ações</summary><div>${botao('duplicar','Duplicar ficha','link')}${botao('arquivar',ficha.arquivada ? 'Restaurar ficha' : 'Arquivar ficha','link')}${botao('excluir','Excluir ficha','link perigo')}</div></details></div></div>
    <div class="hero ${ficha.capa ? '' : 'sem-foto'}">
      ${img(ficha.capa,ficha.nome,'hero-foto')}
      <div class="hero-texto"><h1>${esc(ficha.nome)}</h1>
      <p class="subtitulo">Ficha técnica · Versão ${ficha.versao}.0${ficha.arquivada ? ' · Arquivada' : ''}</p>
      ${ficha.exemplo ? '<p class="exemplo">Exemplo demonstrativo · receita sem validação</p>' : ''}
      ${ficha.descricao && !ficha.exemplo ? `<p class="descricao">${esc(ficha.descricao)}</p>` : ''}
      <h2 class="rotulo-rendimento">Rendimento</h2>
      <div class="opcoes" aria-label="Rendimentos predefinidos">${opcoes.map(valor => `<button type="button" class="preset" data-valor="${valor}">${formatar(valor)} ${unidadeCurta(ficha.unidade)}</button>`).join('')}
        <label class="personalizado"><span class="sr">Rendimento personalizado em ${ficha.unidade}</span><input id="personalizado" inputmode="decimal" maxlength="12" placeholder="Outro valor" aria-describedby="erro-rendimento"><span aria-hidden="true">${unidadeCurta(ficha.unidade)}</span></label>
      </div>
      <p id="erro-rendimento" class="erro inline" role="alert" hidden></p>
      </div>
    </div>
    ${ficha.etapas.length ? '<nav id="etapas" class="etapas" aria-label="Etapas do preparo"></nav>' : ''}
    <div class="producao"><section class="painel ingredientes" id="ingredientes" aria-labelledby="titulo-ingredientes"></section>
    <section class="painel passo" id="passo" aria-label="Modo de preparo"></section></div>
    ${temFinais ? `<section class="painel finais"><h2>Informações complementares</h2>
      ${camposFinais.filter(([k]) => ficha[k]).map(([k,l]) => `<div><h3>${l}</h3><p class="multilinha">${esc(ficha[k])}</p></div>`).join('')}
      ${img(ficha.final,'Padrão final de ' + ficha.nome,'foto-final')}</section>` : ''}`;
  $('#retorno').onclick = voltar;
  $('#editar').onclick = () => editar(ficha);
  $('#pdf').onclick = exportar;
  $('#duplicar').onclick = () => operacao('duplicar');
  $('#excluir').onclick = excluirFicha;
  $('#arquivar').onclick = () => {
    if (ficha.arquivada || confirm('Arquivar esta ficha? Você poderá restaurá-la pelo catálogo.')) operacao('arquivo',{arquivada:!ficha.arquivada});
  };
  const personalizado = $('#personalizado');
  function validarPersonalizado() {
    const erro = $('#erro-rendimento');
    const ok = valido(personalizado.value);
    erro.hidden = ok;
    erro.textContent = ok ? '' : 'Informe um valor de 0,0001 a 1.000.000, com até quatro casas decimais.';
    personalizado.setAttribute('aria-invalid', String(!ok));
    if (ok) { desejado = numero(personalizado.value); mostrarAjuste(); }
  }
  personalizado.addEventListener('input', validarPersonalizado);
  raiz.querySelector('.opcoes').addEventListener('click', e => {
    if (!e.target.matches('.preset')) return;
    desejado = Number(e.target.dataset.valor);
    personalizado.value = '';
    personalizado.removeAttribute('aria-invalid');
    $('#erro-rendimento').hidden = true;
    mostrarAjuste();
  });
  mostrarAjuste();
  mostrarPasso();
}
function mostrarAjuste() {
  const {ingredientes,lotes} = ajustar(ficha,desejado);
  raiz.querySelectorAll('.preset').forEach(btn => btn.setAttribute('aria-pressed',String(Number(btn.dataset.valor) === desejado)));
  const info = [
    desejado !== ficha.base ? formatar(desejado / ficha.base) + ' × receita-base' : '',
    lotes ? lotes + (lotes === 1 ? ' lote' : ' lotes') : ''
  ].filter(Boolean);
  $('#ingredientes').innerHTML = `<h2 id="titulo-ingredientes">Ingredientes para<br>${rendimento(desejado,ficha.unidade)}</h2>
    ${info.length ? `<p class="subtitulo">${info.join(' · ')}</p>` : ''}
    ${ficha.peso || ficha.forma ? `<p class="detalhes-forma">${[ficha.peso,ficha.forma].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
    ${ingredientes.length ? `<ul class="ingredientes-lista">${ingredientes.map(item => `<li><span><span class="check" aria-hidden="true">✓</span>${esc(item.nome)}${item.fracao ? '<span class="sr"> (unidade fracionada)</span>' : ''}</span><strong>${formatar(item.ajustada)} ${item.unidade}${item.fracao ? ' *' : ''}</strong></li>`).join('')}</ul>` : '<p>Nenhum ingrediente cadastrado.</p>'}
    ${ingredientes.some(item => item.fracao) ? '<p class="aviso" role="status">* Ingredientes em unidades fracionadas. Confira as quantidades antes de preparar.</p>' : ''}`;
}
function mostrarPasso(foco) {
  const atual = ficha.etapas[etapa];
  if (!atual) {
    $('#passo').innerHTML = '<h2>Modo de preparo</h2><p>Nenhuma etapa cadastrada.</p>';
    return;
  }
  const ir = (i, seletor) => { etapa = i; mostrarPasso(seletor); };
  const nav = $('#etapas');
  nav.innerHTML = ficha.etapas.map((item,i) => `<button class="etapa-atalho" type="button" data-etapa="${i}" ${i === etapa ? 'aria-current="step"' : ''}>
    <span class="${concluidas.has(i) ? 'etapa-num pronta' : 'etapa-num'}" aria-hidden="true">${concluidas.has(i) ? '✓' : i + 1}</span>
    <span>${esc(ficha.exemplo && ficha.nome === 'Brownie tradicional' && i === 1 ? 'Derreter' : item.titulo)}</span>${concluidas.has(i) ? '<span class="sr"> concluída</span>' : ''}</button>`).join('');
  nav.querySelectorAll('button').forEach(btn => btn.onclick = () => ir(Number(btn.dataset.etapa),'[aria-current="step"]'));
  const metadados = [['Tempo',atual.tempo],['Temperatura',atual.temperatura],['Equipamentos',atual.equipamentos]].filter(([,valor]) => valor);
  $('#passo').innerHTML = `<div class="passo-topo"><span class="selo">Etapa ${etapa + 1} de ${ficha.etapas.length}</span>
    <span class="progresso" role="status">${concluidas.size} de ${ficha.etapas.length} concluídas</span></div>
    ${img(atual.foto,'Foto da etapa ' + atual.titulo,'passo-foto')}
    <h2 id="titulo-passo" tabindex="-1">${esc(atual.titulo)}</h2>
    <ol class="instrucoes">${atual.instrucoes.split(/\r?\n/).filter(x => x.trim()).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${metadados.length ? `<dl class="meta-etapa">${metadados.map(([k,v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${atual.ponto ? `<p class="ponto"><span aria-hidden="true">✓</span><span><strong>Ponto esperado</strong> · ${esc(atual.ponto)}</span></p>` : ''}
    <label class="concluir"><input type="checkbox" id="concluir" ${concluidas.has(etapa) ? 'checked' : ''}> Etapa concluída</label>
    <div class="passo-rodape"><button class="secundario" type="button" id="anterior" ${etapa === 0 ? 'disabled' : ''}>Anterior</button>
    <button class="primario" type="button" id="proxima" ${etapa === ficha.etapas.length - 1 ? 'disabled' : ''}>Próxima etapa</button></div>`;
  $('#concluir').onchange = e => { e.target.checked ? concluidas.add(etapa) : concluidas.delete(etapa); mostrarPasso('#concluir'); };
  $('#anterior').onclick = () => ir(etapa - 1,'#titulo-passo');
  $('#proxima').onclick = () => ir(etapa + 1,'#titulo-passo');
  if (foco) $(foco)?.focus({preventScroll:true});
}
async function exportar() {
  const btn = $('#pdf');
  if ($('#personalizado').getAttribute('aria-invalid') === 'true') {
    $('#personalizado').focus();
    return avisar('Corrija o rendimento personalizado antes de exportar.');
  }
  btn.disabled = true;
  btn.textContent = 'Gerando PDF…';
  try {
    const resposta = await api(rota(ficha.id) + '/pdf?rendimento=' + encodeURIComponent(desejado));
    const url = URL.createObjectURL(await resposta.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = resposta.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'ficha-tecnica.pdf';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url),30000);
    avisar('PDF gerado. O download foi iniciado.');
  } catch (erro) {
    avisar('Falha ao exportar PDF. ' + erro.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Exportar PDF';
  }
}
async function excluirFicha() {
  const alvo = ficha;
  if (!confirm('Excluir definitivamente a ficha “' + alvo.nome + '”? Esta ação não pode ser desfeita.')) return;
  const btn = $('#excluir');
  const pedido = selecao;
  btn.disabled = true;
  try {
    await api(rota(alvo.id),'DELETE');
    catalogo = catalogo.filter(item => item.id !== alvo.id);
    if (pedido === selecao) {
      ficha = null;
      voltar();
    }
    mostrarCatalogo();
    avisar('Ficha excluída.');
  } catch (erro) {
    avisar('Não foi possível excluir a ficha. ' + erro.message);
  } finally {
    btn.disabled = false;
  }
}
async function operacao(acao,dados) {
  const btn = $(acao === 'duplicar' ? '#duplicar' : '#arquivar');
  const atual = ficha;
  btn.disabled = true;
  try {
    const nova = await (await api(rota(atual.id) + '/' + acao,'POST',dados)).json();
    if (ficha === atual && !descartar) {
      estado.value = nova.arquivada ? 'arquivo' : 'ativas';
      await abrir(nova.id);
    }
    await recarregar();
    avisar(acao === 'duplicar' ? 'Ficha duplicada.' : nova.arquivada ? 'Ficha arquivada.' : 'Ficha restaurada.');
  } catch (erro) { avisar(erro.message); }
  finally { btn.disabled = false; }
}

busca.oninput = categoria.onchange = estado.onchange = mostrarCatalogo;
$('#nova').onclick = () => editar();
$('#catalogo').onclick = e => {
  const alvo = e.target.closest('.abrir');
  if (!alvo || (descartar && !descartar())) return;
  descartar = null;
  abrir(alvo.dataset.id);
};
try {
  await recarregar();
  const primeira = catalogo.find(item => !item.arquivada);
  if (primeira && !selecao) await abrir(primeira.id,true);
  else if (!selecao) voltar();
} catch (erro) {
  $('#catalogo').innerHTML = `<p class="erro" role="alert">${esc(erro.message)}</p><button class="secundario" id="tentar" type="button">Tentar novamente</button>`;
  $('#tentar').onclick = () => location.reload();
}
