const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');

// Configure logging
log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
autoUpdater.logger = log;

// Disable auto-download - we'll prompt user
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Keep a global reference of the window object
let mainWindow = null;

//-------------------------------------------------------------------
// App event handlers
//-------------------------------------------------------------------
app.whenReady().then(() => {
  createWindow();
  
  // Check for updates after app is ready
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

//-------------------------------------------------------------------
// Create the main application window
//-------------------------------------------------------------------
function createWindow() {
  // Determine if running in development
  const isDev = process.env.NODE_ENV === 'development';
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: path.join(__dirname, 'public/icons/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false, // Don't show until ready-to-show
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#f8fafc'
  });

  // Load the app
  if (isDev) {
    // Development - connect to Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production - load from file
    const indexPath = path.join(__dirname, 'dist/index.html');
    
    // Check if index.html exists
    if (!fs.existsSync(indexPath)) {
      dialog.showErrorBox(
        'Installation Error',
        'Application files are missing. Please reinstall the application.'
      );
      app.quit();
      return;
    }
    
    mainWindow.loadFile(indexPath);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Maximize on first run (optional)
    // mainWindow.maximize();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle navigation (prevent external links)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow only same-origin navigation
    if (url.startsWith('file://') || url.startsWith('http://localhost')) {
      return { action: 'allow' };
    }
    // Open external links in default browser
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

//-------------------------------------------------------------------
// Auto-updater events
//-------------------------------------------------------------------
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for updates...');
  sendStatusToWindow('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  sendStatusToWindow('Update available');
  
  // Ask user if they want to download
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) is available.`,
    detail: 'Would you like to download it now?',
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('No updates available');
  sendStatusToWindow('No updates available');
});

autoUpdater.on('error', (err) => {
  log.error('Update error:', err);
  sendStatusToWindow(`Update error: ${err.message}`);
});

autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
  logMessage += ` - Downloaded ${progressObj.percent}%`;
  logMessage += ` (${progressObj.transferred}/${progressObj.total})`;
  log.info(logMessage);
  
  // Send progress to renderer
  if (mainWindow) {
    mainWindow.webContents.send('update-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info);
  sendStatusToWindow('Update downloaded');
  
  // Ask user to install
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded successfully.',
    detail: 'The application will restart to install the update.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then(({ response }) => {
    if (response === 0) {
      setImmediate(() => {
        autoUpdater.quitAndInstall();
      });
    }
  });
});

//-------------------------------------------------------------------
// IPC handlers for renderer process
//-------------------------------------------------------------------
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', () => {
  if (mainWindow) {
    autoUpdater.checkForUpdates();
  }
  return true;
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('is-online', () => {
  return require('electron').net.isOnline();
});

//-------------------------------------------------------------------
// Helper functions
//-------------------------------------------------------------------
function sendStatusToWindow(text) {
  log.info('Status:', text);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', text);
  }
}

//-------------------------------------------------------------------
// Handle uncaught exceptions
//-------------------------------------------------------------------
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  
  dialog.showErrorBox(
    'Application Error',
    'An unexpected error occurred. The application will continue running.\n\n' +
    `Error: ${error.message}`
  );
});