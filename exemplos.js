export const exemplos = [
  {
    nome: 'Brownie tradicional', categoria: 'Doces', base: 12, unidade: 'unidades', lote: 12,
    forma: 'Forma quadrada de 20 × 20 cm', capa: '/fotos/brownie.jpg', final: '/fotos/brownie.jpg',
    descricao: 'Exemplo fictício para explorar o aplicativo. Receita demonstrativa, sem validação.',
    ingredientes: [
      ['Chocolate meio amargo',200,'g'], ['Manteiga',150,'g'], ['Açúcar',250,'g'], ['Ovos',3,'un.'], ['Farinha de trigo',100,'g']
    ],
    etapas: [
      {titulo:'Preparar', instrucoes:'Forre a forma com papel manteiga e separe os ingredientes.', equipamentos:'Forma, balança e papel manteiga', ponto:'Forma forrada e ingredientes pesados.'},
      {titulo:'Derreter chocolate e manteiga', instrucoes:'Em banho-maria, derreta o chocolate meio amargo junto com a manteiga.\nMexa com uma espátula até obter uma mistura homogênea.', foto:'/fotos/chocolate.jpg', ponto:'Mistura lisa e brilhante.'},
      {titulo:'Misturar', instrucoes:'Misture ovos e açúcar. Junte o chocolate derretido, acrescente a farinha e mexa até incorporar.', ponto:'Massa uniforme, sem farinha aparente.'},
      {titulo:'Assar', instrucoes:'Espalhe a massa na forma. Asse e deixe esfriar antes de cortar.', tempo:'25 min', temperatura:'180 °C', ponto:'Bordas firmes e centro úmido.'}
    ],
    montagem:'Corte em 12 quadrados quando estiver completamente frio.'
  },
  {
    nome:'Bolo de cenoura', categoria:'Bolos', base:1, unidade:'unidades', capa:'/fotos/cenoura.jpg',
    descricao:'Exemplo fictício para explorar o aplicativo. Receita demonstrativa, sem validação.',
    ingredientes:[['Cenoura',250,'g'],['Óleo',120,'ml'],['Ovos',3,'un.'],['Açúcar',200,'g'],['Farinha de trigo',240,'g'],['Fermento',12,'g']],
    etapas:[
      {titulo:'Bater', instrucoes:'Bata a cenoura, os ovos e o óleo até obter uma mistura homogênea.', equipamentos:'Liquidificador'},
      {titulo:'Misturar', instrucoes:'Incorpore açúcar, farinha e fermento. Transfira a massa para uma forma untada.'},
      {titulo:'Assar', instrucoes:'Asse em forno preaquecido.', temperatura:'180 °C', tempo:'35 min', ponto:'Palito sem massa crua ao testar o centro.'}
    ],
    montagem:'Finalize com cobertura de chocolate, se desejar.', final:'/fotos/cenoura.jpg'
  }
].map(ficha => ({
  ...ficha, exemplo: true,
  ingredientes: ficha.ingredientes.map(([nome, quantidade, unidade]) => ({nome, quantidade, unidade}))
}));
