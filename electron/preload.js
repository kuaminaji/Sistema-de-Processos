const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopSetup', {
  getState: () => ipcRenderer.invoke('desktop-setup:get-state'),
  chooseDataDirectory: (initialPath) => ipcRenderer.invoke('desktop-setup:choose-data-directory', initialPath),
  saveConfig: (payload) => ipcRenderer.invoke('desktop-setup:save-config', payload)
});

contextBridge.exposeInMainWorld('desktopUpdater', {
  getState: () => ipcRenderer.invoke('desktop-updater:get-state'),
  checkNow: () => ipcRenderer.invoke('desktop-updater:check'),
  saveSettings: (payload) => ipcRenderer.invoke('desktop-updater:save-settings', payload),
  installNow: () => ipcRenderer.invoke('desktop-updater:install'),
  openReleasePage: () => ipcRenderer.invoke('desktop-updater:open-release-page'),
  onStateChanged: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const handler = (_event, state) => callback(state);
    ipcRenderer.on('desktop-updater:state', handler);

    return () => {
      ipcRenderer.removeListener('desktop-updater:state', handler);
    };
  }
});
