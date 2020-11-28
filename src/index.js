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

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  console.log('DONE');
  // eslint-disable-line global-require
  app.quit();
}

const createLoginWindow = () => {
  console.log('Starting login window');
  // Create the browser window.
  const loginWindow = new BrowserWindow({
    width: 800,
    height: 700,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });

  // and load the index.html of the app.
  loginWindow.loadFile(path.join(__dirname, 'sites/login.html'));

  discordRPC
    .login('777509861780226069')
    .then(async () => {
      discordRPC.setPresence({
        state: 'Login',
      });
      const accessToken = await readToken(currentAppPath);
      validateDragonflyAccount(accessToken);
    })
    .catch((err) => console.log(err));

  loginWindow.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createLoginWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
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
  await ensureDirectoryExistence(accessPath);

  fs.writeFile(accessPath, accessToken, (err) => {
    if (err) return console.log(err);
    console.log('SAVED');
  });
  fswin.setAttributesSync(path.join(currentAppPath, '.secrets'), { IS_HIDDEN: true });
  event.reply('drgn-auth-reply', currentAppPath);
  discordRPC.setPresence({
    details: 'Home',
  });
});

// read access token
ipcMain.on('drgn-auth-read', async (event, data) => {
  console.log(reply, 'REP');
  event.reply('drgn-auth-reply', reply);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});
autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});
