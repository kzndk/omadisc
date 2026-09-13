const { dialog, shell } = require('electron');
const { navigationAllowed, externalURL } = require('./model.cjs');
const REMOTE_PREFERENCES = Object.freeze({ nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, spellcheck: true });
function secureSession(session) {
  session.setPermissionCheckHandler(() => false);
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setDevicePermissionHandler(() => false);
  session.on('will-download', (_event, item) => { item.setSaveDialogOptions({ title: 'Save Discord attachment' }); });
}
function secureRemote(contents, parent) {
  let asking = false;
  async function openExternal(value) {
    const url = externalURL(value);
    if (!url || asking || parent.isDestroyed()) return;
    asking = true;
    try {
      const { response } = await dialog.showMessageBox(parent, { type: 'question', title: 'Open external link?', message: `Open ${new URL(url).host} in your browser?`, detail: 'This link leaves Discord. Only continue if you trust the destination.', buttons: ['Cancel', 'Open browser'], defaultId: 0, cancelId: 0, noLink: true });
      if (response === 1) await shell.openExternal(url);
    } catch { /* Cancellation or unavailable browser must not crash the workspace. */ } finally { asking = false; }
  }
  contents.on('will-navigate', (event, url) => { if (!navigationAllowed(url)) { event.preventDefault(); void openExternal(url); } });
  contents.on('will-redirect', (event, url, _inPlace, main) => { if (main && !navigationAllowed(url)) { event.preventDefault(); void openExternal(url); } });
  contents.setWindowOpenHandler(({ url }) => { if (navigationAllowed(url)) void contents.loadURL(url).catch(() => {}); else void openExternal(url); return { action: 'deny' }; });
  contents.on('will-attach-webview', event => event.preventDefault());
}
module.exports = { REMOTE_PREFERENCES, secureSession, secureRemote };
