const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Version info
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, progress) => callback(progress));
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, status) => callback(status));
  },
  
  // System info
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  isOnline: () => ipcRenderer.invoke('is-online'),
  
  // Cleanup listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});