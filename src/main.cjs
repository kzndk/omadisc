const { app, protocol, net, BrowserWindow, dialog, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createWorkspace } = require('./window.cjs');
app.setName('OmaDisc');
app.enableSandbox();
const override = app.commandLine.getSwitchValue('user-data-dir');
app.setPath('userData', override ? path.resolve(override) : path.join(app.getPath('appData'), 'omadisc'));
protocol.registerSchemesAsPrivileged([{ scheme: 'omadisc', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let window;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(async () => {
    const assets = new Map([['/index.html','index.html'],['/app.js','app.js'],['/style.css','style.css'],['/icon.svg','icon.svg']]);
    protocol.handle('omadisc', request => {
      const u = new URL(request.url), asset = assets.get(u.pathname);
      if (u.host !== 'app' || !asset || request.method !== 'GET' || u.search) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(path.join(__dirname, 'ui', asset)).href);
    });
    Menu.setApplicationMenu(null);
    window = await createWorkspace(path.join(app.getPath('userData'), 'workspace.json'));
  }).catch(error => { dialog.showErrorBox('OmaDisc could not start', `Your saved workspace has not been overwritten.\n\n${error.message}`); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('activate', () => { const win = BrowserWindow.getAllWindows()[0]; if (win) win.show(); });
}
