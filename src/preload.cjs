const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('omadisc', {
  getState: () => ipcRenderer.invoke('workspace:get'),
  dispatch: action => ipcRenderer.invoke('workspace:action', action),
  onState: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('workspace:state', listener); return () => ipcRenderer.removeListener('workspace:state', listener); },
  onCommand: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('workspace:command', listener); return () => ipcRenderer.removeListener('workspace:command', listener); }
});
