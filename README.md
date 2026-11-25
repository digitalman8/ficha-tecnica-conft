# Fichas técnicas de confeitaria

Aplicativo local para cadastrar fichas, consultar receitas em produção e baixar PDFs A4. Interface em português do Brasil.

## Executar

Requer Node.js 24 ou posterior. O aplicativo usa apenas módulos incluídos no Node.js e APIs do navegador.

```sh
npm test
npm start
```

Abra [a aplicação](http://127.0.0.1:4173/). O banco é criado em `dados/fichas.sqlite` na primeira execução. Para fazer backup, encerre o servidor e copie esse arquivo. `FICHAS_DADOS` permite escolher outro diretório e `PORT` altera a porta local.

## Cadastrar e exportar

1. Clique em **Nova ficha**. Informe o nome e o rendimento-base.
2. Adicione ingredientes, etapas e as fotos desejadas. Use **Subir** e **Descer** para mudar a ordem. Preencha validade somente quando você tiver definido o prazo.
3. Clique em **Salvar ficha**. Use a busca ou o filtro de categoria para encontrá-la depois.
4. Abra a ficha e selecione um rendimento predefinido ou informe um valor personalizado. Confira as unidades fracionadas e os lotes, quando aplicável. Use os atalhos numerados para ir direto a qualquer etapa.
5. Clique em **Exportar PDF**. A exportação exige ao menos um ingrediente e uma etapa. O arquivo do rendimento atual é baixado pelo navegador.
6. O menu **Mais ações** oferece duplicação e arquivamento. O filtro **Arquivadas** permite reabrir e restaurar uma ficha.
7. Para apagar uma ficha ativa ou arquivada, escolha **Mais ações → Excluir ficha** e confirme a exclusão definitiva.

## Estrutura

- `server.js` serve a interface e a API local de fichas e exportação.
- `banco.js` valida e persiste os dados no SQLite por meio de transações. Ingredientes e etapas têm identidade e ordem próprias. As fotos ficam no mesmo banco.
- `public/` contém a interface, o editor e o cálculo compartilhado de rendimento.
- `pdf.js` gera páginas A4, texto selecionável e imagens proporcionais a partir dos dados.
- `exemplos.js` e `public/fotos/` trazem as fichas fictícias e as fotos recortadas do mockup.
- `app.test.js` cobre cálculo, persistência e exportação.

## Decisões do MVP

O servidor escuta somente em 127.0.0.1. O layout se adapta à largura da tela, incluindo navegadores móveis que executem o app localmente. Publicação ou acesso via rede requer configuração própria de hospedagem e autenticação. O editor aceita fotos de até 20 MB por arquivo e as converte em JPEG de até 1.400 px no maior lado. Os campos numéricos aceitam até quatro casas decimais. O PDF usa tipografia padrão com suporte a português e pode substituir caracteres fora do conjunto latino ocidental. As marcações de progresso são temporárias. Os exemplos são fictícios.
