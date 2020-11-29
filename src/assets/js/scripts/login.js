const { ipcRenderer } = require('electron');
const app = require('electron').remote.app;
const shell = require('electron').shell;

const { appPath } = require('../utilities/path');

const currentAppPath = appPath(app.getAppPath());
console.log('Root folder path: ', currentAppPath);

console.log(app.getAppPath(), 'APP PATH');

// Handle update
const notification = document.getElementById('notification');
const message = document.getElementById('message');
const restartButton = document.getElementById('restart-button');

ipcRenderer.on('update_available', () => {
  console.log('UPDATE AVAILABLE');
  ipcRenderer.removeAllListeners('update_available');
  message.innerText = 'A new update is available. Downloading now...';
  notification.classList.remove('hidden');
});

ipcRenderer.on('update_downloaded', () => {
  console.log('UPDATE DOWNLOADED');
  ipcRenderer.removeAllListeners('update_downloaded');
  message.innerText = 'Update Downloaded. It will be installed on restart. Restart now?';
  restartButton.classList.remove('hidden');
  notification.classList.remove('hidden');
});

ipcRenderer.send('app_version');
ipcRenderer.on('app_version', (event, arg) => {
  ipcRenderer.removeAllListeners('app_version');
  console.log(arg, 'VERSION');
  document.title = 'Dragonfly Launcher v' + arg.version;
});

// check for updates
ipcRenderer.send('check_for_updates');
ipcRenderer.on('check_for_updates', (event, arg) => {
  console.log(arg);
});

function closeNotification() {
  notification.classList.add('hidden');
}
function restartApp() {
  ipcRenderer.send('restart_app');
}

const loginForm = document.getElementById('login-form');

// Request verification
loginForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  const formData = new FormData(loginForm);
  const name = formData.get('email');
  const password = formData.get('password');

  const loginBody = {
    name,
    password,
  };

  console.log(loginBody);
  fetch(`https://api.playdragonfly.net/v1/authentication/login`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(loginBody),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log(data, data.token);
      if (data.success) {
        ipcRenderer.send('drgn-auth', data);
      }
    })
    .catch((err) => console.log(err));
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
  console.log('LISTENING');
  link.addEventListener('click', (e) => {
    console.log('CLICKED');
    e.preventDefault();
    shell.openExternal(link.getAttribute('href'));
  });
});

function readToken() {
  ipcRenderer.send('drgn-auth-read');
}

// Receive Dragonfly authentication replies
ipcRenderer.on('drgn-auth-reply', (event, arg) => {
  console.log('Reply incoming...');
  console.log(arg);
  console.log(`Type: ${arg.type}\n Value: ${arg.value}`);
});

ipcRenderer.on('discord-info', (event, arg) => {
  console.log('Discord call incoming...');
  console.log(arg);
});
