const { ipcRenderer } = require('electron');
const { exec } = require('child_process');
const { ensureDirectoryExistence } = require('../utilities/path.js');
const fs = require('fs');
const fse = require('fs-extra');
const Swal = require('sweetalert2');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

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

let version = '1.8.8';

function setVersion(e) {
  console.log(e);
  console.log(e.value);
  version = e.value;
}

function hashCode(s) {
  for (var i = 0, h = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

async function executeJar() {
  const openWithGameOutput = document.getElementById('open-game-output').checked;
  const appData = process.env.APPDATA;
  const minecraftDir = appData + '\\.minecraft';

  if (!(await ensureDirectoryExistence(minecraftDir + `\\versions\\${version}`, false, 'file')))
    return Swal.fire({
      title: `Cannot launch ${version}!`,
      text: `Please make sure to download and run Minecraft ${version} from the Minecraft Launcher first.`,
      icon: 'error',
      confirmButtonText: 'Okay',
    });
  const versionDir = minecraftDir + `\\versions\\${version}`;
  const jsonFile = versionDir + `\\${version}.json`;
  const jarFile = versionDir + `\\${version}.jar`;

  const launcherAccounts = JSON.parse(fs.readFileSync(`${minecraftDir}\\launcher_accounts.json`));
  const firstAccountKey = Object.keys(launcherAccounts.accounts)[0];
  const firstAccount = launcherAccounts.accounts[firstAccountKey];

  const accessToken = firstAccount.accessToken;
  const uuid = firstAccount.minecraftProfile.id;
  const name = firstAccount.minecraftProfile.name;

  const json = JSON.parse(fs.readFileSync(jsonFile));
  const libraries = json.libraries;
  const classPathCmd =
    libraries
      .filter((e) => e.downloads.artifact)
      .map((e) => `libraries/${e.downloads.artifact.path}`)
      .join(';') +
    ';' +
    jarFile;

  const natives = json.libraries.filter((e) => e.downloads.classifiers).map((e) => e.downloads.classifiers['natives-windows']);
  const nativesExtracted = `${minecraftDir}\\dragonfly\\tmp\\natives_extract`;
  const nativesTarget = `${minecraftDir}\\dragonfly\\natives-${version}`;
  if (fs.existsSync(nativesExtracted)) {
    fs.rmdirSync(nativesExtracted, { recursive: true });
  }
  fs.mkdirSync(nativesExtracted, { recursive: true });

  natives.forEach((native) => {
    if (!native) return;

    const file = `${minecraftDir}\\libraries\\${native.path.replaceAll('/', '\\')}`;
    const simpleName = native.path.split('/')[native.path.split('/').length - 1];

    if (!fs.existsSync(file)) return console.log('skipping ' + file);
    const copied = `${nativesExtracted}\\${simpleName.replaceAll('.jar', '.zip')}`;

    fs.copyFileSync(file, copied);

    new AdmZip(copied).extractAllTo(nativesExtracted);

    fs.unlinkSync(copied);
    fs.rmdirSync(`${nativesExtracted}\\META-INF\\`, { recursive: true });
  });

  if (fs.existsSync(nativesTarget)) {
    fs.rmdirSync(nativesTarget, { recursive: true });
  }

  fse.moveSync(nativesExtracted, nativesTarget, { overwrite: true });

  const assetsIndex = json.assets;
  const assetsDir = assetsIndex !== 'legacy' ? `${minecraftDir}\\assets` : `${minecraftDir}\\assets\\virtual\\legacy`;

  const properties = firstAccount.userProperites || firstAccount.userProperties;
  const propertiesObj = {};
  if (properties) {
    properties.forEach((prop) => {
      propertiesObj[prop.name] = [prop.value];
    });
  }

  console.log(`Starting version ${version}`);
  console.log(`> Assets index: ${assetsIndex}`);
  console.log(`> Assets directory: ${assetsDir}`);
  openWithGameOutput ? ipcRenderer.send('open-game-output') : null;

  const command = exec(
    `java ` +
      `-javaagent:dragonfly-agent.jar ` +
      `-Djava.library.path=dragonfly\\natives-${version} ` +
      `-Dlog4j.configurationFile=assets\\log_configs\\client-1.7.xml ` +
      `-cp ${classPathCmd} ` +
      `net.minecraft.client.main.Main ` +
      `--version ${version} ` +
      `--assetsDir ${assetsDir} ` +
      `--assetIndex ${assetsIndex} ` +
      `--accessToken ${accessToken} ` +
      `--uuid ${uuid} ` +
      `--username ${name} ` +
      `--userProperties "${JSON.stringify(propertiesObj).replaceAll('"', '\\"')}" ` +
      `--userType mojang`,
    {
      cwd: minecraftDir,
    }
  );

  const parser = new xml2js.Parser();

  command.stdout.on('data', (data) => {
    if (data && data.toString()) {
      const xml = data.toString();

      parser.parseString(xml, function (err, result) {
        let message;
        if (result) {
          const event = result['log4j:Event'];
          const level = event['$'].level;
          message = '[' + level + '] ' + event['log4j:Message'][0];
        } else {
          message = `[STDOUT] ${xml}`;
        }
        openWithGameOutput ? ipcRenderer.send('game-output-data', message) : null;
      });
    }
  });
}
