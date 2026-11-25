export const formatar = valor => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 10 }).format(valor);
export const numero = valor => /^\d+(?:[.,]\d{1,4})?$/.test(String(valor).trim()) ? Number(String(valor).replace(',', '.')) : NaN;
export const valido = valor => numero(valor) > 0 && numero(valor) <= 1000000;
export function rendimento(valor, unidade) {
  const nomes = { unidades: ['unidade', 'unidades'], 'porções': ['porção', 'porções'] };
  return formatar(valor) + ' ' + (nomes[unidade]?.[valor === 1 ? 0 : 1] ?? unidade);
}
const inteiro = valor => BigInt(Math.round(valor * 10000));
export function ajustar(ficha, desejado) {
  if (!valido(desejado) || !valido(ficha.base)) throw new Error('Informe um rendimento positivo válido, com até quatro casas decimais.');
  const alvo = inteiro(numero(desejado));
  const base = inteiro(ficha.base);
  return {
    lotes: ficha.lote ? Number((alvo + inteiro(ficha.lote) - 1n) / inteiro(ficha.lote)) : null,
    ingredientes: ficha.ingredientes.map(item => {
      const numerador = inteiro(item.quantidade) * alvo;
      const divisor = base * 10000n;
      return { ...item, ajustada: Number(numerador) / Number(divisor), fracao: item.unidade === 'un.' && numerador % divisor !== 0n };
    })
  };
}
