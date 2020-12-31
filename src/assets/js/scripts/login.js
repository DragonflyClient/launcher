/* remote already declared in titlebar.js */
const { ipcRenderer } = require('electron');
const app = require('electron').remote.app;
const shell = require('electron').shell;

const Swal = require('sweetalert2');

const { rootPath } = require('../utilities/path');

const currentAppPath = rootPath(app.getAppPath());
const { dragonflyAccountLogin } = require('../utilities/dragonfly.js');

/* #region Handle update */
const updaterNotification = document.getElementById('updater-notification');
const updaterMessage = document.getElementById('updater__message');
const updaterRestartButton = document.getElementById('updater__restart-button');

// handle update available
ipcRenderer.on('update_available', () => {
    console.log('> An update for the Dragonfly Launcher is available');
    ipcRenderer.removeAllListeners('update_available');
    updaterMessage.innerText = 'A new update is available. Downloading now...';
    updaterNotification.classList.remove('hidden');
});

// handle update download
ipcRenderer.on('update_downloaded', () => {
    console.log('> The update for the Dragonfly Launcher has been downloaded');
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
ipcRenderer.on('check_for_updates', (event, arg) => {});

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

ipcRenderer.on('restart_app', (event, args) => {
    console.log(args);
});

const loginForm = document.getElementById('login-form');
const loginSubmitButton = document.getElementById('login-submit-btn');

let dragonflyToken;

// Request verification
loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    changeButtonState();

    const formData = new FormData(loginForm);
    const name = formData.get('email');
    const password = formData.get('password');

    const loginBody = {
        name,
        password,
    };

    const result = await dragonflyAccountLogin(loginBody);

    if (result.success) {
        return ipcRenderer.send('drgn-auth', result);
    } else if (!result.success) {
        changeButtonState();
        return Swal.fire({
            title: 'Error!',
            text: result.error,
            icon: 'error',
            confirmButtonText: 'Okay',
        });
    } else {
        changeButtonState();
        Swal.fire({
            title: 'Error!',
            text: 'An internal error occurred please try again later.',
            icon: 'error',
            confirmButtonText: 'Okay',
        });
    }
});

const pwToggle = document.getElementById('toggle-pw');
const pwInput = document.getElementById('password-input');

pwToggle.addEventListener('click', () => {
    if (pwInput.type === 'password') {
        pwInput.type = 'text';
        pwToggle.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        pwInput.type = 'password';
        pwToggle.innerHTML = '<i class="fas fa-eye"></i>';
    }
});

const externalLinks = document.querySelectorAll('a[href^="http"]');

Array.from(externalLinks).forEach(function (link) {
    link.addEventListener('click', e => {
        e.preventDefault();
        shell.openExternal(link.getAttribute('href'));
    });
});

function changeButtonState(button = document.querySelector('#login-submit-btn')) {
    if (button.getAttribute('disabled') || button.getAttribute('disabled' == 'true')) {
        setTimeout(() => {
            button.removeAttribute('disabled');
            button.innerText = 'Login';
        }, 150);
    } else {
        button.setAttribute('disabled', true);
        button.innerHTML = `
    <div class="spinner">
      <div class="rect1"></div>
      <div class="rect2"></div>
      <div class="rect3"></div>
      <div class="rect4"></div>
      <div class="rect5"></div>
    </div>
    `;
    }
}

// Receive Dragonfly authentication replies
ipcRenderer.on('drgn-auth-reply', (event, arg) => {
    console.log('Reply incoming...');
    dragonflyToken = arg;
    localStorage.setItem('dragonflyToken', arg);
    changeButtonState();
    console.log(arg);
});

ipcRenderer.on('discord-info', (event, arg) => {
    console.log('Discord call incoming...');
    console.log(arg);
});
