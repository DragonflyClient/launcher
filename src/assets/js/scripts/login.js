const { ipcRenderer } = require('electron');
const app = require('electron').remote.app;
const shell = require('electron').shell;

const { appPath } = require('../assets/js/utilities/path');

const currentAppPath = appPath(app.getAppPath());
console.log('Root folder path: ', currentAppPath);

const fs = require('fs');
const path = require('path');

console.log(app.getAppPath(), 'APP PATH');

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
