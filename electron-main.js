const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'HD HYUNDAI — Marine Vessel Simulator',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0f17',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load built Vue app from dist/
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
