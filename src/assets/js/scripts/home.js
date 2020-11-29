const { ipcRenderer } = require('electron');

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
  console.log(arg, 'VERSION');
  document.title = 'Dragonfly Launcher v' + arg.version;
});

// check for updates
ipcRenderer.send('check_for_updates');
ipcRenderer.on('check_for_updates', (event, arg) => {
  console.log(arg);
});

ipcRenderer.on('update_progress', (event, arg) => {
  console.log(arg);
  document.querySelector('.updater__border').style.width = arg;
});

function closeNotification() {
  notification.classList.add('hidden');
}
function restartApp() {
  ipcRenderer.send('restart_app');
}

/* #endregion */
