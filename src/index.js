const { app, BrowserWindow, ipcMain, dialog } = require("electron")
const path = require("path")
const fs = require("fs")
const fswin = require("fswin")
const CryptoJS = require("crypto-js")
const { autoUpdater } = require("electron-updater")

const { rootPath, ensureDirectoryExistence } = require("./utilities/path.js")
const { getDragonflyAccount, getDragonflyToken } = require("./utilities/dragonfly")
const { windowIndex } = require("./utilities/browser-window")
const { downloadEditions, downloadAnnouncements } = require("./utilities/downloader.js")

const currentAppPath = rootPath(app.getAppPath())

ensureDirectoryExistence(path.join(currentAppPath, "tmp"), true, "dir")

// Require discord rpc
const discordRPC = require("./assets/js/discord")

if (require("electron-squirrel-startup")) {
    app.quit()
}

let loadingWindow

let loginWindow
let mainWindow

const globalWebPreferences = {
    nodeIntegration: true,
    enableRemoteModule: true,
    contextIsolation: false,
}

let checkedForUpdates = false
const openWindows = []

const loginWindowSettings = {
    width: 800,
    height: 700,
    frame: false,
    show: false,
    resizable: false,
    webPreferences: globalWebPreferences,
}

const mainWindowSettings = {
    width: 1350,
    height: 800,
    minWidth: 850,
    minHeight: 720,
    autoHideMenuBar: true,
    show: false,
    frame: false,
    webPreferences: globalWebPreferences,
}

function createWindow(name, settings) {
    const fileName = name == "Main" ? "home" : name
    console.log("Creating", name)
    console.log(name)
    let w = new BrowserWindow(settings)
    let windowId = w.id

    w.webContents.on("did-finish-load", () => {
        w.show()
        if (name == "Login" && w) w.close()
    })

    w.loadFile(path.join(__dirname, `sites/${fileName}.html`))

    w.on("close", () => {
        openWindows.splice(windowIndex(windowId, openWindows), 1)
    })

    w.on("closed", function () {
        w = null
    })

    w.once("ready-to-show", () => {
        discordRPC
            .setPresence({
                details: name,
            })
            .catch(err => {})
        openWindows.push(windowId)
    })
    return w
}

const createLoadingWindow = async () => {
    console.log("== Launching loading screen ==")
    loadingWindow = new BrowserWindow({
        width: 320,
        height: 400,
        frame: false,
        webPreferences: globalWebPreferences,
    })

    console.log("> Loading page...")
    await loadingWindow.loadFile(path.join(__dirname, "sites/loading.html"))

    loadingWindow.on("closed", e => {
        loadingWindow = null
    })

    console.log("> Checking for updates")
    if (!checkedForUpdates) {
        await autoUpdater
            .checkForUpdatesAndNotify()
            .then(update => {
                console.log("Checked for updates")
                if (!update) continueLoadingWindow()
            })
            .catch(async err => {
                console.log(`Check for updates failed: ${err}`)
                await continueLoadingWindow()
            })
        checkedForUpdates = true
    } else {
        console.log("Already checked for updates.")
        await continueLoadingWindow()
    }
}

async function continueLoadingWindow() {
    console.log("> Downloading Editions...")
    await downloadEditions()
    console.log("> Downloading Announcements...")
    await downloadAnnouncements()

    await discordRPC.login("777509861780226069").catch(err => console.log(err))
    const accessToken = await getDragonflyToken(currentAppPath)

    setTimeout(async () => {
        if (await getDragonflyAccount(accessToken)) {
            mainWindow = await createWindow("Main", mainWindowSettings)
            closeWindows([loadingWindow, loginWindow])
        } else {
            loginWindow = await createWindow("Login", loginWindowSettings)
            closeWindows([loadingWindow])
        }
    }, 1000)
}

function closeWindows(windowNames) {
    windowNames.forEach(w => {
        if (w) {
            w.hide()
            w.close()
        }
    })
}

const outputWindows = {}

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
    })
    const windowId = gameOutputWindow.id

    outputWindows[pid] = gameOutputWindow
    gameOutputWindow.loadFile(path.join(__dirname, "sites/game-output.html"))

    gameOutputWindow.on("close", () => {
        openWindows.splice(windowIndex(windowId, openWindows), 1)
    })

    gameOutputWindow.on("closed", function () {
        outputWindows[pid] = null
    })

    gameOutputWindow.once("ready-to-show", () => {
        gameOutputWindow.show()
        openWindows.push(windowId)
    })
}

//
app.on("ready", () => {
    createLoadingWindow()
})

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit()
    }
})
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        // createLoginWindow()
    }
})

// MAIN IPC's
// Write access token
ipcMain.on("drgn-auth", async (event, data) => {
    console.log("Receiving data...")
    let accessToken = CryptoJS.AES.encrypt(data.token, "secretKey").toString()

    const accessPath = path.join(currentAppPath, ".secrets/access.txt")
    await ensureDirectoryExistence(accessPath, true, "dir")

    fs.writeFile(accessPath, accessToken, err => {
        if (err) return console.log(err)
    })
    fswin.setAttributesSync(path.join(currentAppPath, ".secrets"), { IS_HIDDEN: true })
    discordRPC
        .setPresence({
            details: "Home",
        })
        .catch(err => {
            console.log(err)
        })
    mainWindow = await createWindow("Main", mainWindowSettings)
    event.reply("drgn-auth-reply", data.token)
})

// read access token
ipcMain.on("drgn-auth-read", async (event, data) => {
    try {
        event.reply("drgn-auth-reply", "Worked")
    } catch (error) {
        event.reply("drgn-auth-reply", `Some kinda error: ${error}`)
    }
})
// Respond app version
ipcMain.on("app_version", event => {
    event.sender.send("app_version", { version: app.getVersion() })
})

// Auto updater
autoUpdater.on("update-available", e => {
    loadingWindow.webContents.send("update_available")
})

autoUpdater.on("update-downloaded", () => {
    loadingWindow.webContents.send("update_downloaded")
    setTimeout(() => {
        autoUpdater.quitAndInstall()
    }, 600)
})

autoUpdater.on("download-progress", progressObj => {
    let log_message = progressObj.percent
    loadingWindow.webContents.send("update_progress", log_message)
})
//

ipcMain.on("open-game-output", (event, args) => {
    createGameOutputWindow(args.pid)
})

ipcMain.on("game-output-data", (event, args) => {
    const pid = args.pid
    if (outputWindows[pid]) outputWindows[pid].webContents.send("game-output-data", args.message)
})

ipcMain.on("open-game", (e, args) => {
    const gameObject = args.gameObject
    discordRPC
        .setPresence({
            details: `Playing Minecraft ${gameObject.gameVersion}`,
        })
        .catch(err => {
            console.log(err)
        })
})

ipcMain.on("game-closed", (e, args) => {
    const openGames = args.openGames
    const closeGameOutput = args.closeGameOutput
    const outputWindow = outputWindows[args.closedGameObject.pid]

    outputWindow && closeGameOutput && outputWindow.close()

    if (openGames.length == 0) {
        discordRPC
            .setPresence({
                details: `Home`,
            })
            .catch(err => {
                console.log(err)
            })
    } else {
        const last = openGames.pop()
        discordRPC
            .setPresence({
                details: `Playing Minecraft ${last.gameVersion}`,
            })
            .catch(err => {
                console.log(err)
            })
    }
})
