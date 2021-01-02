const { ipcRenderer, shell } = require('electron')
const app = require('electron').remote.app
const fs = require('fs')
const { setEdition, startGame } = require('../assets/js/launch.js')
const { rootPath } = require('../utilities/path.js')
const { startAuthorizationFlow } = require('../utilities/ms-auth.js')
const Swal = require('sweetalert2')

const { getMinecraftLauncherProfiles, minecraftLogin, validateMinecraftToken } = require('../utilities/minecraft.js')
const {
    getDragonflyToken,
    getDragonflyAccount,
    currentEditionVersion,
    writeEditionVersion,
} = require('../utilities/dragonfly.js')
require('../assets/js/devtools')

const cwd = rootPath(app.getAppPath())
const dragonflyToken = getDragonflyToken(cwd)

if (!dragonflyToken)
    ipcRenderer.send('drgn-not-logged-in') // TODO: Handle stuff if user isn't logged into dragonfly account
;(async () => {
    const dragonflyAccount = await getDragonflyAccount(dragonflyToken)

    console.log('Dragonfly Account..', dragonflyAccount)
    const dragonflyNameEl = document.querySelector('.account-name__dragonfly')
    const minecraftNameEl = document.querySelector('.account-name__minecraft')
    const minecraftSkullImg = document.querySelector('.minecraft-skull')

    const accountWrapper = document.querySelector('.account')

    const minecraftProfiles = await getMinecraftLauncherProfiles(true)
    console.log('Minecraft Profiles: ', minecraftProfiles)
    const validMinecraftAccounts = []

    // await minecraftProfiles.forEach(async profile => {
    //     console.log('Profile: ', profile);
    //     if (await validateMinecraftToken(profile.accessToken, profile.clientToken)) {
    //         console.log('VALID PROFILE!', profile);
    //         validMinecraftAccounts.push(profile);
    //     }
    // });

    for await (profile of minecraftProfiles) {
        if (await validateMinecraftToken(profile.accessToken, profile.clientToken)) {
            validMinecraftAccounts.push(profile)
        }
    }

    if (!minecraftProfiles || !validMinecraftAccounts[0].uuid) {
        dragonflyNameEl.innerHTML = dragonflyAccount.username
        minecraftSkullImg.src = 'https://mineskin.de/avatar/MHF_Exclamation'
        minecraftNameEl.innerHTML = 'Unauthenticated with minecraft!'
    } else {
        // Show username and avatar of default and valid minecraft account
        dragonflyNameEl.innerHTML = dragonflyAccount.username
        minecraftNameEl.innerHTML = validMinecraftAccounts[0].name
        minecraftSkullImg.src = 'https://mineskin.de/avatar/' + validMinecraftAccounts[0].uuid
    }

    accountWrapper.style.transform = 'translateX(0)'
})()

/* #region Handle auto-updating */
const updaterNotification = document.getElementById('updater-notification')
const updaterMessage = document.getElementById('updater__message')
const updaterRestartButton = document.getElementById('updater__restart-button')

// handle update available
ipcRenderer.on('update_available', () => {
    console.log('> An update for the Dragonfly Launcher is available')
    ipcRenderer.removeAllListeners('update_available')
    updaterMessage.innerText = 'A new update is available. Downloading now...'
    updaterNotification.classList.remove('hidden')
})

// handle update download
ipcRenderer.on('update_downloaded', () => {
    console.log('> The update for the Dragonfly Launcher has been downloaded')
    ipcRenderer.removeAllListeners('update_downloaded')
    updaterMessage.innerText = 'Update Downloaded. It will be installed on restart. Restart now?'
    updaterRestartButton.classList.remove('hidden')
    updaterNotification.classList.remove('hidden')
})

// Receive current app version
ipcRenderer.send('app_version')
ipcRenderer.on('app_version', (event, arg) => {
    ipcRenderer.removeAllListeners('app_version')
    document.title = 'Dragonfly Launcher v' + arg.version
})

// check for updates
ipcRenderer.send('check_for_updates')
ipcRenderer.on('check_for_updates', (event, arg) => {
    console.log('Checked for updates.')
})

ipcRenderer.on('update_progress', (event, arg) => {
    document.querySelector('.updater__border').style.width = arg
})

function closeNotification() {
    notification.classList.add('hidden')
}

function restartApp() {
    ipcRenderer.send('restart_app')
}

/* #endregion */

const versionDropdownToggle = document.querySelector('.minecraft-version__toggle')
const versionDropdownMenu = document.querySelector('.minecraft-version__dropdown')
console.log(versionDropdownToggle, versionDropdownMenu)

versionDropdownToggle.addEventListener('click', e => {
    versionDropdownMenu.classList.toggle('active')
    versionDropdownToggle.classList.toggle('active')
})

const externalLinks = document.querySelectorAll('a[href^="http"]')

Array.from(externalLinks).forEach(function(link) {
    link.addEventListener('click', e => {
        e.preventDefault()
        shell.openExternal(link.getAttribute('href'))
    })
})

const editionTitleEl = document.querySelector('.edition-title')
const editionVersionEl = document.querySelector('.edition-version')
const editionDescriptionEl = document.querySelector('.edition-description')
const editionTagsWrapper = document.querySelector('.edition-tags')
const editionDetails = readEditionDetails()

function readEditionDetails() {
    try {
        const workingDir = rootPath(app.getAppPath())
        return JSON.parse(fs.readFileSync(workingDir + '\\tmp\\editions.json'))
    } catch (error) {
        const main = document.querySelector('.main')
        main.innerHTML = `
            <div class='error-container'>
                <img src='../assets/media/error.svg' />
                <h1>Whoops...</h1>
                <p>An error occurred while trying to download necessary details!</p><br />
                <p>Please make sure you have a working internet connection and restart the Dragonfly launcher.</p>
                <p class='support-notice'>For more information and possible help, please contact our support.
            </div>
        `
        return null
    }
}

const selectedVersionEl = document.querySelector('.selected-mc-version')
const dropdownVersionEl = document.querySelector('.minecraft-version__dropdown')

const editionDetailsEl = document.getElementById('edition-details')

function innerEditionDetails(version, update = false) {
    const edition = getEditionByVersion(version)
    if (!edition) return
    const action = () => {
        editionDetailsEl.style.transition = 'none'
        editionDetailsEl.style.transform = 'translateX(-100%)'

        editionTitleEl.innerHTML = edition.title
        editionVersionEl.innerHTML = edition.version
        editionDescriptionEl.innerHTML = edition.description
        editionTagsWrapper.innerHTML = ''
        edition.tags.forEach(tag => (editionTagsWrapper.innerHTML += `<p>${tag}</p>`))

        setTimeout(() => {
            editionDetailsEl.style.transition = '0.2s ease'
            editionDetailsEl.style.transform = 'translateX(0)'
        }, 20)
    }

    if (update) {
        editionDetailsEl.style.transform = 'translateX(100%)'
        setTimeout(action, 200)
    } else action()
}

function configureDropdown(selectedVersion) {
    selectedVersionEl.innerText = 'Minecraft ' + selectedVersion

    versionDropdownMenu.classList.remove('active') // +1
    versionDropdownToggle.classList.remove('active')

    const otherEditions = editionDetails.filter(edition => edition.minecraftVersion != selectedVersion)
    dropdownVersionEl.innerHTML = ''
    otherEditions.forEach(edition => (dropdownVersionEl.innerHTML += `<p>Minecraft ${edition.minecraftVersion}</p>`))
    Array.from(dropdownVersionEl.children).forEach(child => child.addEventListener('click', switchVersion))
}

function switchVersion(event) {
    const versionName = event.target.innerText
    const version = versionName.split('Minecraft ')[1]
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

const launchButton = document.getElementById('launch-game-button')

const process = document.getElementById('progress')
launchButton.addEventListener('click', async () => {
    if (launchButton.getAttribute('disabled') == 'true') return

    process.dataset.progress = 'running'

    launchButton.setAttribute('disabled', 'true')
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
                process.dataset.progress = 'finished'
                process.innerText = 'Game successfully started! 🎉'
                process.style.cursor = 'pointer'
                launchButton.setAttribute('disabled', 'false')
                launchButton.innerHTML = `Launch`
            }
        )
    } catch (error) {
        console.log(error)
        launchButton.setAttribute('disabled', 'false')
        launchButton.innerHTML = `Launch`
        resetProgress()
    }
})

process.addEventListener('click', () => {
    if (process.dataset.progress === 'finished') {
        resetProgress()
    }
})

function resetProgress() {
    process.style.opacity = 0
    process.style.cursor = 'default'
    setTimeout(() => (process.innerText = '🐲🔥'), 300)
}

setDefaults()

/* announcements */
const announcements = readAnnouncementDetails()

function readAnnouncementDetails() {
    try {
        const workingDir = rootPath(app.getAppPath())
        return JSON.parse(fs.readFileSync(workingDir + '\\tmp\\announcements.json'))
    } catch (error) {
        const main = document.querySelector('.main')
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

const announcementContainer = document.getElementById('news')

function innerAnnouncements() {
    announcements.forEach(announcement => {
        console.log(announcement.publishedOn)
        announcementContainer.innerHTML += `
                    <div class="article">
                        ${announcement.image ? `<img class="media" src="${announcement.image}" />` : ''}
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

const accounts = document.getElementsByClassName('account-name__minecraft-dropdown-item');
for (let account of accounts) {
    account.addEventListener('click', () => {
        startAuthorizationFlow()
            .then((acc) => {
                Swal.fire({
                    title: "Success!",
                    html: "You have successfully added <b>" + acc.profile.name + "</b> with Microsoft.",
                    icon: "success",
                    confirmButtonText: "Great!"
                })
            })
            .catch((obj) => Swal.fire({
                title: 'Whooops...',
                html: obj.message,
                footer: `<span style="opacity: 50%">${obj.error.toUpperCase()}</span>`,
                icon: 'error',
                confirmButtonText: 'Okay',
            }));
    });
}
