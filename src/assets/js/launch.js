const { exec } = require('child_process');
const { ensureDirectoryExistence } = require('../../utilities/path.js');
const fs = require('fs');
const fse = require('fs-extra');
const Swal = require('sweetalert2');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

// the version that is selected by the user
let version = '1.8.8';

// array of running games
let openGames = [];

function setVersion(newVersion) {
    console.log("* User changed version to " + newVersion)
    version = newVersion
}

async function startGame() {
    const targetVersion = version;

    console.log(`== Starting version ${targetVersion} ==`);
    const openWithGameOutput = document.getElementById('open-game-output').checked;
    const appData = process.env.APPDATA;
    const minecraftDir = appData + '\\.minecraft';
    console.log('> Minecraft home: ' + minecraftDir);

    if (!(await ensureDirectoryExistence(minecraftDir + `\\versions\\${targetVersion}`, false, 'file'))) {
        console.log('! Version not installed, abandoning...');
        return Swal.fire({
            title: `Cannot launch ${targetVersion}!`,
            text: `Please make sure to download and run Minecraft ${targetVersion} from the Minecraft Launcher first.`,
            icon: 'error',
            confirmButtonText: 'Okay',
        });
    }
    const versionDir = minecraftDir + `\\versions\\${targetVersion}`;
    const jsonFile = versionDir + `\\${targetVersion}.json`;
    const jarFile = versionDir + `\\${targetVersion}.jar`;

    console.log(`> Launching JAR file ${jarFile}`);
    console.log(`> Configuring with JSON file ${jsonFile}`);

    const launcherAccounts = JSON.parse(fs.readFileSync(`${minecraftDir}\\launcher_accounts.json`));
    const firstAccountKey = Object.keys(launcherAccounts.accounts)[0];
    const firstAccount = launcherAccounts.accounts[firstAccountKey];

    const accessToken = firstAccount.accessToken;
    const uuid = firstAccount.minecraftProfile.id;
    const name = firstAccount.minecraftProfile.name;
    console.log(`> Setting up user ${name} (UUID: ${uuid})`);

    const json = JSON.parse(fs.readFileSync(jsonFile));
    const libraries = json.libraries.filter((e) => e.downloads.artifact);
    const classPathCmd = libraries.map((e) => `libraries/${e.downloads.artifact.path}`).join(';') + ';' + jarFile;
    console.log(`> Including ${libraries.length} libraries`);

    const natives = json.libraries.filter((e) => e.downloads.classifiers).map((e) => e.downloads.classifiers['natives-windows']);
    const nativesExtracted = `${minecraftDir}\\dragonfly\\tmp\\natives_extract`;
    const nativesTarget = `${minecraftDir}\\dragonfly\\natives-${targetVersion}`;
    if (fs.existsSync(nativesExtracted)) {
        fs.rmdirSync(nativesExtracted, { recursive: true });
    }
    fs.mkdirSync(nativesExtracted, { recursive: true });

    natives.forEach((native) => {
        if (!native) return;

        const file = `${minecraftDir}\\libraries\\${native.path.replaceAll('/', '\\')}`;
        const simpleName = native.path.split('/')[native.path.split('/').length - 1];

        if (!fs.existsSync(file)) return console.log('> Unable to find native file ' + simpleName);
        const copied = `${nativesExtracted}\\${simpleName.replaceAll('.jar', '.zip')}`;
        fs.copyFileSync(file, copied);

        new AdmZip(copied).extractAllTo(nativesExtracted);

        fs.unlinkSync(copied);
        fs.rmdirSync(`${nativesExtracted}\\META-INF\\`, { recursive: true });
    });

    let nativesUpToDate = false;
    if (fs.existsSync(nativesTarget)) {
        const extractedContent = fs.readdirSync(nativesExtracted);
        const targetContent = fs.readdirSync(nativesTarget);
        nativesUpToDate = extractedContent.every((value, index) => targetContent[index] == value);
        if (nativesUpToDate) {
            console.log('> Natives are up to date');
        }
    }

    if (!nativesUpToDate) {
        if (fs.existsSync(nativesTarget)) {
            fs.rmdirSync(nativesTarget, { recursive: true });
        }
        fse.moveSync(nativesExtracted, nativesTarget, { overwrite: true });
    }
    const assetsIndex = json.assets;
    const assetsDir = assetsIndex !== 'legacy' ? `${minecraftDir}\\assets` : `${minecraftDir}\\assets\\virtual\\legacy`;

    console.log(`> Assets index: ${assetsIndex}`);
    console.log(`> Assets directory: ${assetsDir}`);
    const logFile = json.logging.client.file.id;

    console.log('> Log configuration: ' + logFile);
    const properties = firstAccount.userProperites || firstAccount.userProperties;
    const propertiesObj = {};
    if (properties) {
        properties.forEach((prop) => {
            propertiesObj[prop.name] = [prop.value];
        });
    }

    const command = exec(
        `javaw ` +
        `-javaagent:dragonfly-agent.jar ` +
        `-Djava.library.path=dragonfly\\natives-${targetVersion} ` +
        `-Dlog4j.configurationFile=assets\\log_configs\\${logFile} ` +
        `-cp ${classPathCmd} ` +
        `net.minecraft.client.main.Main ` +
        `--version ${targetVersion} ` +
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

    const gameObject = {
        gameVersion: targetVersion,
        uuid: uuid,
        pid: command.pid,
    };
    openGames.push(gameObject);
    console.log(`> Game startup (${openGames} running)`);
    ipcRenderer.send('open-game', { openGames: openGames, gameObject: gameObject });
    if (openWithGameOutput) ipcRenderer.send('open-game-output');

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
                openWithGameOutput && ipcRenderer.send('game-output-data', message);
            });
        }
    });
    command.stderr.on('data', (data) => {
        if (data && data.toString()) {
            const xml = data.toString();

            parser.parseString(xml, function (err, result) {
                let message;
                if (result) {
                    const event = result['log4j:Event'];
                    const level = event['$'].level;
                    message = '[' + level + '] ' + event['log4j:Message'][0];
                } else {
                    message = `[STDERR] ${xml}`;
                }
                openWithGameOutput && ipcRenderer.send('game-output-data', message);
            });
        }
    });

    command.on('close', () => {
        const closedGameObject = openGames.find((game) => game.pid == command.pid);
        openGames = openGames.filter((game) => game.pid != command.pid);
        console.log(`> Game closed (${openGames} running)`);
        ipcRenderer.send('game-closed', { openGames: openGames, closedGameObject: closedGameObject });
    });
}

module.exports.setVersion = setVersion
module.exports.startGame = startGame