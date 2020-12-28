const { ipcRenderer, shell } = require('electron');
const app = require('electron').remote.app;
const { setEdition, startGame } = require('../assets/js/launch');
const { ensureDirectoryExistence, rootPath } = require('../utilities/path');

const fs = require('fs');

require('../assets/js/devtools');

/* #region Handle auto-updating */
const updaterNotification = document.getElementById('updater-notification');
const updaterMessage = document.getElementById('updater__message');
const updaterRestartButton = document.getElementById('updater__restart-button');

// handle update available
ipcRenderer.on('update_available', () => {
    console.log('UPDATE AVAILABLE');
    ipcRenderer.removeAllListeners('update_available');
    updaterMessage.innerText = 'A new update is available. Downloading now...';
    updaterNotification.classList.remove('hidden');
});

// handle update download
ipcRenderer.on('update_downloaded', () => {
    console.log('UPDATE DOWNLOADED');
    ipcRenderer.removeAllListeners('update_downloaded');
    updaterMessage.innerText = 'Update Downloaded. It will be installed on restart. Restart now?';
    updaterRestartButton.classList.remove('hidden');
    updaterNotification.classList.remove('hidden');
});

// Receive current app version
ipcRenderer.send('app_version');
ipcRenderer.on('app_version', (event, arg) => {
    ipcRenderer.removeAllListeners('app_version');
    document.title = 'Dragonfly Launcher v' + arg.version;
});

// check for updates
ipcRenderer.send('check_for_updates');
ipcRenderer.on('check_for_updates', (event, arg) => {
    console.log('Checked for updates.');
});

ipcRenderer.on('update_progress', (event, arg) => {
    document.querySelector('.updater__border').style.width = arg;
});

function closeNotification() {
    notification.classList.add('hidden');
}
function restartApp() {
    ipcRenderer.send('restart_app');
}
/* #endregion */

const versionDropdownToggle = document.querySelector('.minecraft-version__toggle');
const versionDropdownMenu = document.querySelector('.minecraft-version__dropdown');
console.log(versionDropdownToggle, versionDropdownMenu);

versionDropdownToggle.addEventListener('click', e => {
    console.log('CLICKED', e.target);
    versionDropdownMenu.classList.toggle('active');
    versionDropdownToggle.classList.toggle('active');
});

const externalLinks = document.querySelectorAll('a[href^="http"]');

Array.from(externalLinks).forEach(function (link) {
    link.addEventListener('click', e => {
        e.preventDefault();
        shell.openExternal(link.getAttribute('href'));
    });
});

const editionTitleEl = document.querySelector('.edition-title');
const editionVersionEl = document.querySelector('.edition-version');
const editionDescriptionEl = document.querySelector('.edition-description');
const editionTagsWrapper = document.querySelector('.edition-tags');
const editionDetails = readEditionDetails();

function readEditionDetails() {
    try {
        const workingDir = rootPath(app.getAppPath());
        return JSON.parse(fs.readFileSync(workingDir + '\\tmp\\editions.json'));
    } catch (error) {
        const main = document.querySelector('.main');
        main.innerHTML = `
            <div class="error-container">
                <img src="../assets/media/error.svg" />
                <h1>Whoops...</h1>
                <p>An error occurred while trying to download necessary details!</p><br />
                <p>Please make sure you have a working internet connection and restart the Dragonfly launcher.</p>
                <p class="support-notice">For more information and possible help, please contact our support.
            </div>
        `;
        return null;
    }
}

const selectedVersionEl = document.querySelector('.selected-mc-version');
const dropdownVersionEl = document.querySelector('.minecraft-version__dropdown');

const editionDetailsEl = document.getElementById('edition-details');

function innerEditionDetails(version, update = false) {
    const edition = getEditionByVersion(version);
    if (!edition) return;
    const action = () => {
        console.log(edition);
        editionTitleEl.innerHTML = edition.title;
        editionVersionEl.innerHTML = edition.version;
        editionDescriptionEl.innerHTML = edition.description;
        editionTagsWrapper.innerHTML = '';
        edition.tags.forEach(tag => (editionTagsWrapper.innerHTML += `<p>${tag}</p>`));
        editionDetailsEl.style.opacity = 1;
    };

    if (update) {
        editionDetailsEl.style.opacity = 0;
        setTimeout(action, 200);
    } else action();
}

function configureDropdown(selectedVersion) {
    selectedVersionEl.innerText = 'Minecraft ' + selectedVersion;

    versionDropdownMenu.classList.remove('active'); // +1
    versionDropdownToggle.classList.remove('active');

    const otherEditions = editionDetails.filter(edition => edition.minecraftVersion != selectedVersion);
    dropdownVersionEl.innerHTML = '';
    otherEditions.forEach(edition => (dropdownVersionEl.innerHTML += `<p>Minecraft ${edition.minecraftVersion}</p>`));
    Array.from(dropdownVersionEl.children).forEach(child => child.addEventListener('click', switchVersion));
}

function switchVersion(event) {
    const versionName = event.target.innerText;
    const version = versionName.split('Minecraft ')[1];
    const edition = editionDetails?.find(edition => edition.minecraftVersion == version);
    if (!edition) return;

    setEdition(edition);
    innerEditionDetails(version, true);
    configureDropdown(version);
}

function setDefaults() {
    const edition = getEditionByVersion('1.8.8');
    if (!edition) return;
    innerEditionDetails(edition.minecraftVersion);
    configureDropdown(edition.minecraftVersion);
    setEdition(edition);
}

function getEditionByVersion(version) {
    return editionDetails?.find(edition => edition.minecraftVersion == version);
}

const launchButton = document.getElementById('launch-game-button');

const process = document.getElementById('progress');
launchButton.addEventListener('click', async () => {
    if (launchButton.getAttribute('disabled') == true) return;

    process.dataset.progress = 'running';

    launchButton.setAttribute('disabled', 'true');
    launchButton.innerHTML = `
        <div class="sk-chase">
            <div class="sk-chase-dot"></div>
            <div class="sk-chase-dot"></div>
            <div class="sk-chase-dot"></div>
            <div class="sk-chase-dot"></div>
            <div class="sk-chase-dot"></div>
            <div class="sk-chase-dot"></div>
        </div>
    `;
    try {
        await startGame(
            message => {
                console.log('progress: ' + message);
                process.innerText = message;
                process.style.opacity = 1;
            },
            () => {
                process.dataset.progress = 'finished';
                process.innerText = 'Game successfully started! 🎉';
                process.style.cursor = 'pointer';
                launchButton.setAttribute('disabled', 'false');
                launchButton.innerHTML = `Launch`;
            }
        );
    } catch (error) {
        console.log(error);
    }
});

process.addEventListener('click', () => {
    if (process.dataset.progress === 'finished') {
        process.style.opacity = 0;
        process.style.cursor = 'default';
        setTimeout(() => (process.innerText = '🐲🔥'), 300);
    }
});

setDefaults();
