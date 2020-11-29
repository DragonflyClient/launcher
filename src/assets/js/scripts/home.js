const { ipcRenderer } = require('electron');

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
