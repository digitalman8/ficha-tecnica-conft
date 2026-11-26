import { app, BrowserWindow, dialog } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iniciarServidor } from './server.js';

let janela;
let servidor;
let encerrando = false;

function focarJanela() {
  if (!janela || janela.isDestroyed()) return;
  if (janela.isMinimized()) janela.restore();
  janela.focus();
}

async function abrirAplicativo() {
  servidor = await iniciarServidor({dados:join(app.getPath('userData'), 'dados'), porta:0});
  janela = new BrowserWindow({
    title:'Fichas Técnicas',
    icon:fileURLToPath(new URL('./app.ico', import.meta.url)),
    width:1400,
    height:950,
    minWidth:360,
    minHeight:480,
    show:false,
    autoHideMenuBar:true,
    webPreferences:{nodeIntegration:false, contextIsolation:true, sandbox:true}
  });
  const {webContents} = janela;
  webContents.setWindowOpenHandler(() => ({action:'deny'}));
  webContents.on('will-navigate', (evento, url) => {
    if (new URL(url).origin !== servidor.url) evento.preventDefault();
  });
  webContents.session.on('will-download', (_evento, arquivo, origem) => {
    if (origem !== webContents) return;
    const nome = arquivo.getFilename();
    arquivo.setSaveDialogOptions({
      title:'Salvar arquivo',
      defaultPath:join(app.getPath('downloads'), nome)
    });
  });
  await janela.loadURL(servidor.url);
  janela.show();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focarJanela);
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', evento => {
    if (!servidor || encerrando) return;
    evento.preventDefault();
    encerrando = true;
    servidor.fechar().finally(() => app.quit());
  });
  app.whenReady().then(abrirAplicativo).catch(erro => {
    dialog.showErrorBox('Não foi possível abrir Fichas Técnicas', erro.message);
    app.quit();
  });
}
