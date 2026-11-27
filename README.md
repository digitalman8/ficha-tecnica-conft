# Fichas técnicas de confeitaria

Aplicativo local para cadastrar fichas, consultar receitas em produção e baixar PDFs A4. Interface em português do Brasil.

## Executar

### Instalação no Windows

Execute `Fichas-Tecnicas-Setup-1.0.0.exe` no Windows x64. Depois, abra **Fichas Técnicas** pelo atalho da área de trabalho ou do menu Iniciar. O instalador já inclui o necessário para rodar o programa offline.

O banco com fichas e fotos fica na pasta de dados do usuário do Windows, normalmente `%APPDATA%\Fichas Técnicas\dados\fichas.sqlite`. As atualizações são instaladas por cima usando o novo instalador. Para trazer as fichas da versão web, baixe um backup JSON naquela versão e restaure pelo catálogo no aplicativo instalado.

### Desenvolvimento

Requer Node.js 24 ou posterior. O aplicativo usa apenas módulos incluídos no Node.js e APIs do navegador.

```sh
npm test
npm start
```

Abra [a aplicação](http://127.0.0.1:4173/). O banco é criado em `dados/fichas.sqlite` na primeira execução. Para fazer backup, encerre o servidor e copie esse arquivo. `FICHAS_DADOS` permite escolher outro diretório e `PORT` altera a porta local.

Para gerar o instalador no Windows x64, execute `npm ci` e `npm run empacotar:windows`. O build empacota o Electron com electron-builder e compila o instalador com o compilador do .NET Framework do Windows. O instalador sai em `dist/` e é gerado sem assinatura digital. Feche o aplicativo antes de instalar uma atualização. https://drive.google.com/file/d/1BS1bDW8R0eRAIidyEuXm5O8hESiBbWi5/view?usp=drive_link

## Cadastrar e exportar

1. Clique em **Nova ficha**. Informe o nome e o rendimento-base.
2. Adicione ingredientes, etapas e as fotos desejadas. Use **Subir** e **Descer** para mudar a ordem. Preencha validade somente quando você tiver definido o prazo.
3. Clique em **Salvar ficha**. Use a busca ou o filtro de categoria para encontrá-la depois.
4. Abra a ficha e selecione um rendimento predefinido ou informe um valor personalizado. Confira as unidades fracionadas e os lotes, quando aplicável. Use os atalhos numerados para ir direto a qualquer etapa.
5. Clique em **Exportar PDF**. A exportação exige ao menos um ingrediente e uma etapa. O arquivo do rendimento atual é baixado pelo navegador.
6. O menu **Mais ações** oferece duplicação e arquivamento. O filtro **Arquivadas** permite reabrir e restaurar uma ficha.
7. Para apagar uma ficha ativa ou arquivada, escolha **Mais ações → Excluir ficha** e confirme a exclusão definitiva.

Durante o preparo, marque os ingredientes que já separou. A lista é reiniciada ao abrir outra ficha ou mudar o rendimento. A opção **Manter a tela ligada**, junto às etapas, funciona enquanto a ficha estiver visível em um navegador compatível.

## Backup pelo catálogo

Abra **Backup das fichas → Baixar backup** para guardar um arquivo JSON com fichas ativas e arquivadas, ingredientes, etapas e fotos. O arquivo contém os dados das fichas e deve ser guardado em um local de sua confiança.

Use **Restaurar backup** para selecionar o JSON e verificar a prévia. A restauração substitui todo o catálogo. A opção **Baixar backup atual**, na confirmação, permite guardar uma cópia antes de continuar. O limite de cada backup é de 256 MB. Arquivos SQLite continuam sendo cópias manuais e devem ser recuperados com o servidor desligado.

## Estrutura

- `server.js` serve a interface e a API local de fichas e exportação.
- `banco.js` valida e persiste os dados no SQLite por meio de transações. Ingredientes e etapas têm identidade e ordem próprias. As fotos ficam no mesmo banco.
- `public/` contém a interface, o editor e o cálculo compartilhado de rendimento.
- `pdf.js` gera páginas A4, texto selecionável e imagens proporcionais a partir dos dados.
- `exemplos.js` e `public/fotos/` trazem as fichas fictícias e as fotos recortadas do mockup.
- `app.test.js` cobre cálculo, persistência e exportação.

## Decisões do MVP

O servidor escuta somente em 127.0.0.1. O layout se adapta à largura da tela, incluindo navegadores móveis que executem o app localmente. Publicação ou acesso via rede requer configuração própria de hospedagem e autenticação. O editor aceita fotos de até 20 MB por arquivo e as converte em JPEG de até 1.400 px no maior lado. Os campos numéricos aceitam até quatro casas decimais. O PDF usa tipografia padrão com suporte a português e pode substituir caracteres fora do conjunto latino ocidental. As marcações de progresso são temporárias. Os exemplos são fictícios.
