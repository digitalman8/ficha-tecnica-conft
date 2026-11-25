import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { abrirBanco } from './banco.js';
import { exemplos } from './exemplos.js';
import { ajustar, numero, valido } from './public/rendimento.js';
import { gerarPdf } from './pdf.js';

const brownie = {...exemplos[0], versao:1};

test('exclui fichas com ingredientes e etapas e mantém o catálogo vazio após reabrir', () => {
  const pasta = mkdtempSync(join(tmpdir(),'fichas-exclusao-'));
  const arquivo = join(pasta,'fichas.sqlite');
  let banco = abrirBanco(arquivo);
  try {
    const [ativa, outra] = banco.listar();
    banco.arquivar(outra.id, true);
    banco.excluir(ativa.id);
    assert.equal(banco.get(ativa.id), null);
    assert.equal(banco.get(outra.id).arquivada, true);
    banco.excluir(outra.id);
    banco.fechar();
    banco = abrirBanco(arquivo);
    assert.deepEqual(banco.listar(), []);
  } finally {
    banco.fechar();
    rmSync(pasta,{recursive:true,force:true});
  }
});
const pdfTexto = buffer => [...buffer.toString('latin1').matchAll(/<([\da-f]+)> Tj/g)]
  .map(([,hex]) => Buffer.from(hex,'hex').toString('latin1')).join('\n');

test('dobra e restaura os ingredientes sem alterar a receita-base', () => {
  const original = structuredClone(brownie);
  const duplicado = ajustar(brownie,24);
  assert.deepEqual(duplicado.ingredientes.map(x => x.ajustada),[400,300,500,6,200]);
  assert.equal(duplicado.lotes,2);
  assert.deepEqual(ajustar(brownie,12).ingredientes.map(x => x.ajustada),[200,150,250,3,100]);
  assert.deepEqual(brownie,original);
});
test('identifica fração real, arredonda lotes para cima e aceita vírgula', () => {
  const escala = ajustar(brownie,'12,5');
  assert.equal(escala.lotes,2);
  assert.equal(escala.ingredientes[3].ajustada,3.125);
  assert.equal(escala.ingredientes[3].fracao,true);
  assert.equal(ajustar(brownie,'4').ingredientes[3].fracao,false);
  assert.equal(numero('2,5001'),2.5001);
  for (const entrada of ['',0,-1,'1e3','1,23456',Infinity,'abc']) {
    assert.equal(valido(entrada),false);
    assert.throws(() => ajustar(brownie,entrada),/rendimento/);
  }
});
test('preserva precisão decimal e diferencia medidas de unidades', () => {
  const ficha = {base:0.3,lote:null,ingredientes:[{quantidade:0.1,unidade:'g'},{quantidade:0.5,unidade:'un.'}]};
  const {ingredientes,lotes} = ajustar(ficha,'0,6');
  assert.equal(lotes,null);
  assert.deepEqual(ingredientes.map(x => [x.ajustada,x.fracao]),[[0.2,false],[1,false]]);
});
test('SQLite mantém fotos, ordem, versões, duplicação e arquivamento após reabrir', () => {
  const pasta = mkdtempSync(join(tmpdir(),'fichas-teste-'));
  const arquivo = join(pasta,'fichas.sqlite');
  const foto = 'data:image/jpeg;base64,' + readFileSync(new URL('./public/fotos/chocolate.jpg',import.meta.url)).toString('base64');
  let banco = abrirBanco(arquivo);
  try {
    const ficha = banco.salvar({...brownie,nome:'Minha ficha',capa:foto,etapas:[{...brownie.etapas[0],foto},...brownie.etapas.slice(1)]});
    assert.equal(banco.listar().length,3);
    assert.throws(() => banco.salvar({...ficha,base:0},ficha),/rendimento/);
    assert.equal(banco.get(ficha.id).versao,1);
    const editada = banco.salvar({...ficha,ingredientes:[...ficha.ingredientes].reverse(),etapas:[...ficha.etapas].reverse(),validade:'Texto cadastrado'},ficha);
    assert.equal(editada.versao,2);
    assert.equal(editada.ingredientes[0].id,ficha.ingredientes.at(-1).id);
    const copia = banco.salvar({...editada,nome:'Cópia'});
    assert.notEqual(copia.etapas[0].id,editada.etapas[0].id);
    banco.arquivar(ficha.id,true);
    banco.fechar();
    banco = abrirBanco(arquivo);
    const recuperada = banco.get(ficha.id);
    assert.equal(recuperada.capa,foto);
    assert.equal(recuperada.etapas.at(-1).foto,foto);
    assert.equal(recuperada.validade,'Texto cadastrado');
    assert.equal(recuperada.arquivada,true);
    assert.equal(banco.arquivar(ficha.id,false).arquivada,false);
  } finally {
    banco.fechar();
    rmSync(pasta,{recursive:true,force:true});
  }
});
test('PDF A4 inclui as quantidades ajustadas, instruções, fotos e texto selecionável', () => {
  const documento = gerarPdf(brownie,24,new Date('2026-11-24T15:00:00Z'));
  const raw = documento.toString('latin1');
  const texto = pdfTexto(documento);
  assert.ok(raw.startsWith('%PDF-1.4'));
  assert.match(raw,/\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(raw,/\/BaseFont \/Helvetica-Bold/);
  assert.equal(raw.match(/\/Type \/Pages \/Count (\d+)/)?.[1], '2');
  assert.match(raw,/\/Subtype \/Image/);
  assert.equal((raw.match(/\/Subtype \/Image/g) ?? []).length,2);
  assert.equal((raw.match(/\/I\d+ Do Q/g) ?? []).length,3);
  assert.match(texto,/Versão 1\.0 \| Gerado em 24\/11\/2026/);
  assert.match(texto,/Selecionado: 24 unidades/);
  assert.match(texto,/Página 1 de 2\nBrownie tradicional\n24 unidades/);
  assert.match(texto,/Receita-base: 12 unidades/);
  assert.match(texto,/Chocolate meio amargo/);
  assert.match(texto,/^400$/m);
  assert.match(texto,/^6$/m);
  assert.match(texto,/Ponto esperado: Mistura lisa e brilhante/);
  assert.match(texto,/4\. Assar/);
  assert.doesNotMatch(texto,/Validade:/);
  assert.equal(brownie.ingredientes[0].quantidade,200);
});
test('PDF multipágina tem paginação, imagem de etapa e referências válidas', () => {
  const etapas = Array.from({length:12},(_,i) => ({
    titulo:'Preparação ' + (i + 1), instrucoes:('Misture delicadamente e confira a consistência. ').repeat(20),
    foto:brownie.etapas[1].foto, ponto:'Conferência ' + (i+1)
  }));
  const PDF = gerarPdf({...brownie,etapas},24);
  const raw = PDF.toString('latin1');
  const total = Number(raw.match(/\/Type \/Pages \/Count (\d+)/)[1]);
  assert.ok(total >= 4);
  const texto = pdfTexto(PDF);
  assert.match(texto,new RegExp('Página ' + total + ' de ' + total));
  assert.match(texto,/Conferência 12/);
  assert.equal((raw.match(/\/I\d+ Do Q/g) ?? []).length,14);
  const inicio = Number(raw.match(/startxref\n(\d+)/)[1]);
  assert.equal(raw.slice(inicio,inicio + 4),'xref');
  for (const [i,linha] of raw.slice(inicio).split('\n').slice(3).filter(x => /^\d{10} 00000 n/.test(x)).entries()) {
    const posicao = Number(linha.slice(0,10));
    assert.ok(raw.slice(posicao).startsWith((i + 1) + ' 0 obj'));
  }
  assert.throws(() => gerarPdf({...brownie,etapas:[]},24),/etapa/);
});
