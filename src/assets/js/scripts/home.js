const { ipcRenderer, shell } = require("electron")
const app = require("electron").remote.app
const fs = require("fs")
const { setEdition, startGame } = require("../assets/js/launch.js")
const { rootPath } = require("../utilities/path.js")
const { startAuthorizationFlow } = require("../utilities/ms-auth.js")
const Swal = require("sweetalert2")

const minecraft = require("../utilities/minecraft.js")
const {
    getDragonflyToken,
    getDragonflyAccount,
    currentEditionVersion,
    writeEditionVersion,
} = require("../utilities/dragonfly.js")
require("../assets/js/devtools")
require("../utilities/developer")

// Receive current app version
ipcRenderer.send("app_version")
ipcRenderer.on("app_version", (event, arg) => {
    ipcRenderer.removeAllListeners("app_version")
    document.title = "Dragonfly Launcher v" + arg.version
})

const cwd = rootPath(app.getAppPath())
const dragonflyToken = getDragonflyToken(cwd)
minecraft.setAppPath(cwd)

const dragonflyNameEl = document.querySelector(".account-name__dragonfly")
const minecraftNameEl = document.querySelector(".account-name__minecraft")
// const minecraftWrapper = document.querySelector(".account-name__minecraft-wrapper")
const minecraftSkullImg = document.querySelector(".minecraft-skull")
const accountWrapper = document.querySelector(".account")

if (!dragonflyToken) {
    ipcRenderer.send("drgn-not-logged-in") // TODO: Handle stuff if user isn't logged into dragonfly account
}

async function insertAccountData() {
    const dragonflyAccount = await getDragonflyAccount(dragonflyToken)
    const minecraftAccount = minecraft.getCurrentAccount()

    await innerMinecraftAccountDetails(minecraftAccount)
    innerDragonflyAccountDetails(dragonflyAccount)

    accountWrapper.style.transform = "translateX(0)"
}

insertAccountData()

async function innerMinecraftAccountDetails(account) {
    if (!account || !(await minecraft.validateToken(account.accessToken, account.clientToken))) {
        account = null
    }

    if (!account || !account?.profile?.uuid) {
        await fetch("https://mineskin.de/avatar/MHF_Exclamation")
        minecraftSkullImg.src = "https://mineskin.de/avatar/MHF_Exclamation"
        minecraftNameEl.innerHTML = "Unauthenticated with Minecraft"
    } else {
        // Show username and avatar of default and valid minecraft account
        minecraftNameEl.innerHTML = account.profile.username
        await fetch("https://mineskin.de/avatar/" + account.profile.uuid)
        minecraftSkullImg.src = "https://mineskin.de/avatar/" + account.profile.uuid
    }
    accountWrapper.style.transform = "translateX(0)"
}

function innerDragonflyAccountDetails(account) {
    dragonflyNameEl.innerHTML = account.username
}

const versionDropdownToggle = document.querySelector(".minecraft-version__toggle")
const versionDropdownMenu = document.querySelector(".minecraft-version__dropdown")
console.log(versionDropdownToggle, versionDropdownMenu)

versionDropdownToggle.addEventListener("click", e => {
    versionDropdownMenu.classList.toggle("active")
    versionDropdownToggle.classList.toggle("active")
})

const externalLinks = document.querySelectorAll('a[href^="http"]')

Array.from(externalLinks).forEach(function (link) {
    link.addEventListener("click", e => {
        e.preventDefault()
        shell.openExternal(link.getAttribute("href"))
    })
})

const editionTitleEl = document.querySelector(".edition-title")
const editionVersionEl = document.querySelector(".edition-version")
const editionDescriptionEl = document.querySelector(".edition-description")
const editionTagsWrapper = document.querySelector(".edition-tags")
const editionDetails = readEditionDetails()

function readEditionDetails() {
    try {
        const workingDir = rootPath(app.getAppPath())
        return JSON.parse(fs.readFileSync(workingDir + "\\tmp\\editions.json"))
    } catch (error) {
        const main = document.querySelector(".main")
        main.innerHTML = `
            <div class="error-container">
                <img src="../assets/media/error.svg" />
                <h1>Whoops...</h1>
                <p>An error occurred while trying to download necessary details!</p><br />
                <p>Please make sure you have a working internet connection and restart the Dragonfly launcher.</p>
                <p class="support-notice">For more information and possible help, please contact our support.
            </div>
        `
        return null
    }
}

const selectedVersionEl = document.querySelector(".selected-mc-version")
const dropdownVersionEl = document.querySelector(".minecraft-version__dropdown")

const editionDetailsEl = document.getElementById("edition-details")

function innerEditionDetails(version, update = false) {
    const edition = getEditionByVersion(version)
    if (!edition) return
    const action = () => {
        editionDetailsEl.style.transition = "none"
        editionDetailsEl.style.transform = "translateX(-100%)"

        editionTitleEl.innerHTML = edition.title
        editionVersionEl.innerHTML = edition.version
        editionDescriptionEl.innerHTML = edition.description
        editionTagsWrapper.innerHTML = ""
        edition.tags.forEach(tag => (editionTagsWrapper.innerHTML += `<p>${tag}</p>`))

        setTimeout(() => {
            editionDetailsEl.style.transition = "0.2s ease"
            editionDetailsEl.style.transform = "translateX(0)"
        }, 20)
    }

    if (update) {
        editionDetailsEl.style.transform = "translateX(100%)"
        setTimeout(action, 200)
    } else action()
}

function configureDropdown(selectedVersion) {
    selectedVersionEl.innerText = "Minecraft " + selectedVersion

    versionDropdownMenu.classList.remove("active") // +1
    versionDropdownToggle.classList.remove("active")

    const otherEditions = editionDetails.filter(edition => edition.minecraftVersion != selectedVersion)
    dropdownVersionEl.innerHTML = ""
    otherEditions.forEach(edition => (dropdownVersionEl.innerHTML += `<p>Minecraft ${edition.minecraftVersion}</p>`))
    Array.from(dropdownVersionEl.children).forEach(child => child.addEventListener("click", switchVersion))
}

function switchVersion(event) {
    const versionName = event.target.innerText
    const version = versionName.split("Minecraft ")[1]
    const edition = editionDetails?.find(edition => edition.minecraftVersion == version)
    if (!edition) return

    setEdition(edition)
    innerEditionDetails(version, true)
    configureDropdown(version)
    writeEditionVersion(cwd, version)
}

function setDefaults() {
    const edition = getEditionByVersion(currentEditionVersion(cwd))
    if (!edition) return
    innerEditionDetails(edition.minecraftVersion)
    configureDropdown(edition.minecraftVersion)
    setEdition(edition)
}

function getEditionByVersion(version) {
    return editionDetails?.find(edition => edition.minecraftVersion == version)
}

const launchButton = document.getElementById("launch-game-button")

const process = document.getElementById("progress")
launchButton.addEventListener("click", async () => {
    if (launchButton.getAttribute("disabled") == "true") return

    process.dataset.progress = "running"

    launchButton.setAttribute("disabled", "true")
    launchButton.innerHTML = `
        <div class="sk-chase">
            <div class="sk-chase-dot"></div>
            <div class="sk-chase-dot"></div>
            <div class="sk-chase-dot"></div>
            <div class="sk-chase-dot"></div>
            <div class="sk-chase-dot"></div>
            <div class="sk-chase-dot"></div>
        </div>
    `
    try {
        await startGame(
            message => {
                process.innerText = message
                process.style.opacity = 1
            },
            () => {
                process.dataset.progress = "finished"
                process.innerText = "Game successfully started! 🎉"
                process.style.cursor = "pointer"
                launchButton.setAttribute("disabled", "false")
                launchButton.innerHTML = `Launch`
            }
        )
    } catch (error) {
        console.log(error)
        launchButton.setAttribute("disabled", "false")
        launchButton.innerHTML = `Launch`
        resetProgress()
    }
})

process.addEventListener("click", () => {
    if (process.dataset.progress === "finished") {
        resetProgress()
    }
})

function resetProgress() {
    process.style.opacity = 0
    process.style.cursor = "default"
    setTimeout(() => (process.innerText = "🐲🔥"), 300)
}

setDefaults()

/* announcements */
const announcements = readAnnouncementDetails()

function readAnnouncementDetails() {
    try {
        const workingDir = rootPath(app.getAppPath())
        return JSON.parse(fs.readFileSync(workingDir + "\\tmp\\announcements.json"))
    } catch (error) {
        const main = document.querySelector(".main")
        main.innerHTML = `
            <div class="error-container">
                <img src="../assets/media/error.svg" />
                <h1>Whoops...</h1>
                <p>An error occurred while trying to download necessary details!</p><br />
                <p>Please make sure you have a working internet connection and restart the Dragonfly launcher.</p>
                <p class="support-notice">For more information and possible help, please contact our support.
            </div>
        `
        return null
    }
}

const announcementContainer = document.getElementById("news")

function innerAnnouncements() {
    announcements.forEach(announcement => {
        console.log(announcement.publishedOn)
        announcementContainer.innerHTML += `
                    <div class="article">
                        ${announcement.image ? `<img class="media" src="${announcement.image}" />` : ""}
                        <div class="text-wrapper">
                            <div class="line"></div>
                            <h1>${announcement.title}</h1>
                            <p class="publish-date">${new Date(
                                announcement.publishedOn * 1000
                            ).toLocaleDateString()}</p>
                            <p>${announcement.content}</p>
                        </div>
                    </div>
        `
    })
}

innerAnnouncements()
