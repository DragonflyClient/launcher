const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fswin = require('fswin');
const CryptoJS = require('crypto-js');
const { autoUpdater } = require('electron-updater');

const { rootPath, ensureDirectoryExistence, readToken } = require('./utilities/path.js');
const { validateDragonflyAccount } = require('./utilities/dragonflyAccount');
const { windowIndex } = require('./utilities/browser-window');
const { downloadEditions, downloadAnnouncements } = require('./utilities/downloader.js');

const currentAppPath = rootPath(app.getAppPath());

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

let checkedForUpdates = false;
const openWindows = [];

const createLoadingWindow = async () => {
    console.log('Starting "loading" window');
    loadingWindow = new BrowserWindow({
        width: 320,
        height: 400,
        frame: false,
        webPreferences: globalWebPreferences,
    });

    loadingWindow.loadFile(path.join(__dirname, 'sites/loading.html'));

    await downloadEditions();
    await downloadAnnouncements();

    await discordRPC.login('777509861780226069').catch(err => console.log(err));
    const accessToken = await readToken(currentAppPath);

    setTimeout(async () => {
        if (await validateDragonflyAccount(accessToken)) {
            createMainWindow();
            loadingWindow.close();
        } else {
            createLoginWindow();
            loadingWindow.close();
        }
    }, 1000);
};

const createLoginWindow = async () => {
    loginWindow = new BrowserWindow({
        width: 800,
        height: 700,
        frame: false,
        show: false,
        resizable: false,
        webPreferences: globalWebPreferences,
    });
    let windowId = loginWindow.id;

    loginWindow.loadFile(path.join(__dirname, 'sites/login.html'));

    loginWindow.on('close', () => {
        openWindows.splice(windowIndex(windowId, openWindows), 1);
    });

    loginWindow.on('closed', function () {
        loginWindow = null;
    });

    loginWindow.once('ready-to-show', () => {
        discordRPC
            .setPresence({
                details: 'Login',
            })
            .catch(err => {
                console.log(err, 'IN INDEX!!!');
            });
        loginWindow.show();
        openWindows.push(windowId);
    });
};

const createMainWindow = async () => {
    console.log('Starting "main" window');
    mainWindow = new BrowserWindow({
        width: 1500,
        height: 800,
        minWidth: 850,
        autoHideMenuBar: true,
        show: false,
        frame: false,
        webPreferences: globalWebPreferences,
    });

    let windowId = mainWindow.id;

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.show();
    });

    mainWindow.on('close', () => {
        openWindows.splice(windowIndex(windowId, openWindows.length), 1);
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    mainWindow.once('ready-to-show', async () => {
        discordRPC
            .setPresence({
                details: 'Home',
            })
            .catch(err => {
                console.log(err);
            });
        openWindows.push(windowId);
    });

    await mainWindow.loadFile(path.join(__dirname, 'sites/home.html'));
};

const outputWindows = {};

const createGameOutputWindow = async pid => {
    const gameOutputWindow = new BrowserWindow({
        width: 1400,
        height: 800,
        show: false,
        resizable: true,
        webPreferences: globalWebPreferences,
        x: 100,
        y: 100,
        autoHideMenuBar: true,
    });
    const windowId = gameOutputWindow.id;

    outputWindows[pid] = gameOutputWindow;
    gameOutputWindow.loadFile(path.join(__dirname, 'sites/game-output.html'));

    gameOutputWindow.on('close', () => {
        openWindows.splice(windowIndex(windowId, openWindows), 1);
    });

    gameOutputWindow.on('closed', function () {
        outputWindows[pid] = null;
    });

    gameOutputWindow.once('ready-to-show', () => {
        gameOutputWindow.show();
        openWindows.push(windowId);
    });
};

//

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

    fs.writeFile(accessPath, accessToken, err => {
        if (err) return console.log(err);
    });
    fswin.setAttributesSync(path.join(currentAppPath, '.secrets'), { IS_HIDDEN: true });
    event.reply('drgn-auth-reply', data.token);
    discordRPC
        .setPresence({
            details: 'Home',
        })
        .catch(err => {
            console.log(err);
        });
    loginWindow.hide();
    createMainWindow();
    loginWindow.close();
});

// read access token
ipcMain.on('drgn-auth-read', async (event, data) => {
    try {
        console.log(BrowserWindow.fromId(openWindows[0]));

        event.reply('drgn-auth-reply', 'Worked');
    } catch (error) {
        event.reply('drgn-auth-reply', `Some kinda error: ${error}`);
    }
});
// Respond app version
ipcMain.on('app_version', event => {
    event.sender.send('app_version', { version: app.getVersion() });
});

// Auto updater
autoUpdater.on('update-available', e => {
    BrowserWindow.fromId(openWindows[openWindows.length - 1]).webContents.send('update_available');
});
autoUpdater.on('update-downloaded', () => {
    BrowserWindow.fromId(openWindows[openWindows.length - 1]).webContents.send('update_downloaded');
});

autoUpdater.on('download-progress', progressObj => {
    let log_message = progressObj.percent + '%';
    BrowserWindow.fromId(openWindows[openWindows.length - 1]).webContents.send('update_progress', log_message);
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.on('check_for_updates', event => {
    if (!checkedForUpdates) {
        autoUpdater
            .checkForUpdatesAndNotify()
            .then(() => {
                event.sender.send('check_for_updates', 'Checked for updates');
            })
            .catch(err => {
                event.sender.send('check_for_updates', `Check for updates failed: ${err}`);
            });
        checkedForUpdates = true;
    } else {
        console.log('Already checked for updates.');
        event.sender.send('check_for_updates', 'Already checked for updates');
    }
});

ipcMain.on('open-game-output', (event, args) => {
    createGameOutputWindow(args.pid);
});

ipcMain.on('game-output-data', (event, args) => {
    const pid = args.pid;
    if (outputWindows[pid]) outputWindows[pid].webContents.send('game-output-data', args.message);
});

ipcMain.on('open-game', (e, args) => {
    const gameObject = args.gameObject;
    discordRPC
        .setPresence({
            details: `Playing Minecraft ${gameObject.gameVersion}`,
        })
        .catch(err => {
            console.log(err);
        });
});

ipcMain.on('game-closed', (e, args) => {
    const openGames = args.openGames;
    const closeGameOutput = args.closeGameOutput;
    const outputWindow = outputWindows[args.closedGameObject.pid];

    outputWindow && closeGameOutput && outputWindow.close();

    if (openGames.length == 0) {
        discordRPC
            .setPresence({
                details: `Home`,
            })
            .catch(err => {
                console.log(err);
            });
    } else {
        const last = openGames.pop();
        discordRPC
            .setPresence({
                details: `Playing Minecraft ${last.gameVersion}`,
            })
            .catch(err => {
                console.log(err);
            });
    }
});
