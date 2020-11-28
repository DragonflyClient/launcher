const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fswin = require('fswin');
var CryptoJS = require('crypto-js');
const { autoUpdater } = require('electron-updater');

const { appPath, ensureDirectoryExistence, readToken } = require('./assets/js/utilities/path.js');
const { validateDragonflyAccount } = require('./assets/js/utilities/dragonflyAccount');

const currentAppPath = appPath(app.getAppPath());

// Require discord rpc
const discordRPC = require('./assets/js/discord');

if (require('electron-squirrel-startup')) {
  app.quit();
}

let loadingWindow;

let loginWindow;
let mainWindow;

const globalWebPreferences = {
  nodeIntegration: true,
  enableRemoteModule: true,
  contextIsolation: false,
};

const createLoadingWindow = async () => {
  console.log('Starting "loading" window');
  loadingWindow = new BrowserWindow({
    width: 400,
    height: 400,
    frame: false,
    webPreferences: globalWebPreferences,
  });

  loadingWindow.loadFile(path.join(__dirname, 'sites/loading.html'));

  await discordRPC.login('777509861780226069').catch((err) => {
    console.log(err);
  });
  const accessToken = await readToken(currentAppPath);
  if (await validateDragonflyAccount(accessToken)) {
    createMainWindow();
    loadingWindow.close();
  } else {
    createLoginWindow();
    loadingWindow.close();
  }

  // loginWindow.once('ready-to-show', async () => {
  //   autoUpdater.checkForUpdatesAndNotify();
  // });
};

const createLoginWindow = async () => {
  loginWindow = new BrowserWindow({
    width: 800,
    height: 700,
    frame: false,
    show: false,
    webPreferences: globalWebPreferences,
  });

  loginWindow.loadFile(path.join(__dirname, 'sites/login.html'));

  loginWindow.once('ready-to-show', () => {
    discordRPC
      .setPresence({
        details: 'Login',
      })
      .catch((err) => {
        console.log(err, 'IN INDEX!!!');
      });
    loginWindow.show();
  });
};

const createMainWindow = async () => {
  console.log('Starting "login" window');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: globalWebPreferences,
  });

  mainWindow.loadFile(path.join(__dirname, 'sites/landing.html'));

  mainWindow.once('ready-to-show', async () => {
    autoUpdater.checkForUpdatesAndNotify();
    discordRPC
      .setPresence({
        details: 'Home',
      })
      .catch((err) => {
        console.log(err);
      });
  });
};

app.on('ready', () => {
  createLoadingWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createLoginWindow();
  }
});

// MAIN IPC's
// Write access token
ipcMain.on('drgn-auth', async (event, data) => {
  console.log('Receiving data...');
  let accessToken = CryptoJS.AES.encrypt(data.token, 'secretKey').toString();

  const accessPath = path.join(currentAppPath, '.secrets/access.txt');
  await ensureDirectoryExistence(accessPath, true, 'dir');

  fs.writeFile(accessPath, accessToken, (err) => {
    if (err) return console.log(err);
  });
  fswin.setAttributesSync(path.join(currentAppPath, '.secrets'), { IS_HIDDEN: true });
  event.reply('drgn-auth-reply', currentAppPath);
  discordRPC
    .setPresence({
      details: 'Home',
    })
    .catch((err) => {
      console.log(err);
    });
});

// read access token
ipcMain.on('drgn-auth-read', async (event, data) => {
  event.reply('drgn-auth-reply', reply);
});

autoUpdater.on('update-available', () => {
  loginWindow.webContents.send('update_available');
});
autoUpdater.on('update-downloaded', () => {
  loginWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});
