const { exec, execSync } = require('child_process');
const { ensureDirectoryExistence, rootPath } = require('../../utilities/path.js');
const app = require('electron').remote.app;
const fs = require('fs');
const fse = require('fs-extra');
const Swal = require('sweetalert2');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');
const axios = require('axios');
const request = require('request');
const crypto = require('crypto');
const mkdirp = require('mkdirp');
const getDirectoryName = require('path').dirname;
const os = require('os');
const { developerMode } = require('../../utilities/developer.js')

// the version that is selected by the user
let version = '1.8.8';

// array of running games
let openGames = [];

function setVersion(newVersion) {
    console.log('* User changed version to ' + newVersion);
    version = newVersion;
}

async function startGame(callback) {
        const launcher = new Launcher(version);

        callback('Downloading Java');
        await launcher.downloadJava();

        callback('Preparing version');
        await launcher.prepareVersion();

        callback('Setting up account');
        await launcher.setupAccount();

        callback('Downloading Dragonfly');
        await launcher.downloadDragonfly();

        callback('Parsing JSON configuration');
        await launcher.parseJsonConfiguration();

        callback('Loading libraries');
        await launcher.loadLibraries();

        callback('Loading native libraries');
        await launcher.loadNatives();

        callback('Loading assets');
        await launcher.loadAssets();

        callback('Loading log configuration');
        await launcher.loadLogConfiguration();

        callback('Compiling mapping indices');
        await launcher.compileMappings();

        callback('Launching game');
        await launcher.executeCommand();

        launcher.handleGameStart();
        launcher.handleGameClose();
        launcher.enableLogging();
}

class Launcher {
    constructor(version) {
        this.targetVersion = version;
    }

    async downloadJava() {
        const installationDirectory = rootPath(app.getAppPath());
        const localDirectory = installationDirectory + '\\jre';

        const githubRelease = 'https://github.com/AdoptOpenJDK/openjdk11-binaries/releases/download/jdk-11.0.9.1%2B1';
        const versionX64 = 'OpenJDK11U-jre_x64_windows_hotspot_11.0.9.1_1.zip';
        const versionX32 = 'OpenJDK11U-jre_x86-32_windows_hotspot_11.0.9.1_1.zip';

        const arch = os.arch();
        let targetVersion;

        if (arch === 'x64') {
            targetVersion = versionX64;
        } else if (arch === 'x32') {
            targetVersion = versionX32;
        } else throw 'CPU architecture is not supported!';

        const url = githubRelease + '/' + targetVersion;
        const localZip = localDirectory + '\\' + targetVersion;

        this.javaRuntime = localDirectory + '\\jdk-11.0.9.1+1-jre';
        this.javaExe = this.javaRuntime + '\\bin\\javaw.exe';

        try {
            if (fs.existsSync(this.javaExe)) {
                return console.log('> Java is installed');
            }
        } catch (e) {}

        console.log('> Download Java from: ' + url);

        mkdirp.sync(localDirectory);
        await this.downloadFile(localZip, url);

        new AdmZip(localZip).extractAllTo(localDirectory);

        console.log('> Java has been downloaded!');
    }

    async prepareVersion() {
        // select Minecraft directory
        const targetVersion = this.targetVersion;
        const appData = process.env.APPDATA;
        const minecraftDir = appData + '\\.minecraft';

        this.minecraftDir = minecraftDir;

        console.log(`== Starting version ${targetVersion} ==`);
        console.log('> Minecraft home: ' + minecraftDir);

        // check if version is downloaded
        if (!ensureDirectoryExistence(minecraftDir + `\\versions\\${targetVersion}`, false, 'file')) {
            console.log('! Version not installed, abandoning...');
            Swal.fire({
                title: `Cannot launch ${targetVersion}!`,
                text: `Please make sure to download and run Minecraft ${targetVersion} from the Minecraft Launcher first.`,
                icon: 'error',
                confirmButtonText: 'Okay',
            });
            throw 'version_not_installed';
        }

        // select version directory + JAR/JSON files
        this.versionDir = minecraftDir + `\\versions\\${targetVersion}`;
        this.jsonFile = this.versionDir + `\\${targetVersion}.json`;
        this.jarFile = this.versionDir + `\\${targetVersion}.jar`;

        console.log(`> Launching JAR file ${this.jarFile}`);
        console.log(`> Configuring with JSON file ${this.jsonFile}`);
    }

    async downloadDragonfly() {
        if (developerMode) {
            return console.log("> Skipping Dragonfly download due to developer mode being enabled")
        }

        const files = (await axios.get('https://api.playdragonfly.net/v1/launcher/files')).data;
        console.log('> Downloading Dragonfly files (' + files.length + ')');

        for (let file of files) {
            console.log('  + ' + file);

            const local = this.minecraftDir + '\\dragonfly\\' + file.replaceAll('/', '\\');
            const url = 'https://cdn.icnet.dev/dragonfly/client/' + file;
            const checksumUrl = url + '.sha1';

            try {
                const content = fs.readFileSync(local);
                const localHash = crypto.createHash('sha1').update(content).digest('hex');
                const checksum = await (await axios.get(checksumUrl)).data.split(' ')[0];

                if (localHash === checksum) {
                    continue;
                }
            } catch (e) {}

            console.log('    Downloading from ' + url + '...');

            mkdirp.sync(getDirectoryName(local));
            await this.downloadFile(local, url);

            console.log('    Finished');
        }
    }

    downloadFile(local, url) {
        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(local);
            request(url).pipe(writer);
            writer.on('finish', () => resolve());
            writer.on('error', (err) => reject(err));
        });
    }

    async setupAccount() {
        // take first account from launcher_accounts.json
        const file = `${this.minecraftDir}\\launcher_accounts.json`;
        const launcherAccounts = JSON.parse(fs.readFileSync(file));
        const firstAccountKey = Object.keys(launcherAccounts.accounts)[0];
        const firstAccount = launcherAccounts.accounts[firstAccountKey];

        try {
            console.log('=== Pre refresh ===');
            console.log('Access token: ', firstAccount.accessToken);
            console.log('Client token: ', launcherAccounts.mojangClientToken);
            console.log('====================================');
            const response = await axios.post('https://authserver.mojang.com/refresh', {
                accessToken: firstAccount.accessToken,
                clientToken: launcherAccounts.mojangClientToken,
            });
            const { accessToken } = response.data;
            console.log('Mojang refresh request response: ', response.data);

            this.accessToken = accessToken;

            firstAccount.accessToken = accessToken;
            launcherAccounts.accounts[firstAccountKey] = firstAccount;

            fs.writeFileSync(file, JSON.stringify(launcherAccounts));
        } catch (error) {
            this.accessToken = firstAccount.accessToken;
        }

        this.uuid = firstAccount.minecraftProfile.id;
        this.name = firstAccount.minecraftProfile.name;
        this.mojangClientToken = launcherAccounts.mojangClientToken;

        // parse user properties
        const properties = firstAccount.userProperites || firstAccount.userProperties;
        this.propertiesObj = {};
        if (properties) {
            properties.forEach((prop) => {
                this.propertiesObj[prop.name] = [prop.value];
            });
        }

        console.log(`> Setting up user ${this.name} (UUID: ${this.uuid})`);
    }

    async parseJsonConfiguration() {
        this.json = JSON.parse(fs.readFileSync(this.jsonFile));
    }

    async loadLibraries() {
        const libraries = this.json.libraries.filter((e) => e.downloads && e.downloads.artifact).map((e) => `libraries/${e.downloads.artifact.path}`);
        libraries.push(this.jarFile);
        libraries.push('dragonfly\\injection\\dragonfly-core.jar');
        libraries.push(`dragonfly\\injection\\injection-hook-${this.targetVersion}.jar`);
        this.classPathArgument = libraries.join(';');
        console.log(`> Including ${libraries.length} libraries`);
    }

    async loadNatives() {
        // parse natives from JSON
        const nativesFromJson = this.json.libraries.filter((e) => e.downloads.classifiers).map((e) => e.downloads.classifiers['natives-windows']);
        const extractionDir = `${this.minecraftDir}\\dragonfly\\tmp\\natives_extract`;
        const targetDir = `${this.minecraftDir}\\dragonfly\\natives-${this.targetVersion}`;

        this.recreateDirectory(extractionDir);

        // extract natives
        nativesFromJson.forEach((native) => {
            if (!native) return;

            const file = `${this.minecraftDir}\\libraries\\${native.path.replaceAll('/', '\\')}`;
            const simpleName = native.path.split('/')[native.path.split('/').length - 1];

            if (!fs.existsSync(file)) return console.log('> Unable to find native file ' + simpleName);
            const copied = `${extractionDir}\\${simpleName.replaceAll('.jar', '.zip')}`;
            fs.copyFileSync(file, copied);

            new AdmZip(copied).extractAllTo(extractionDir);

            fs.unlinkSync(copied);
            fs.rmdirSync(`${extractionDir}\\META-INF\\`, { recursive: true });
        });

        // compare extracted natives
        if (fs.existsSync(targetDir)) {
            const extractedContent = fs.readdirSync(extractionDir);
            const targetContent = fs.readdirSync(targetDir);
            const upToDate = extractedContent.every((value, index) => targetContent[index] === value);
            if (upToDate) {
                console.log('> Natives are up to date');
                this.deleteDirectory(extractionDir);
                return;
            }
        }

        // move to target directory if not up to date
        this.deleteDirectory(targetDir);
        fse.moveSync(extractionDir, targetDir, { overwrite: true });
        this.deleteDirectory(extractionDir);
    }

    recreateDirectory(dir) {
        this.deleteDirectory(dir);
        fs.mkdirSync(dir, { recursive: true });
    }

    deleteDirectory(dir) {
        if (fs.existsSync(dir)) {
            fs.rmdirSync(dir, { recursive: true });
        }
    }

    async loadAssets() {
        this.assetsIndex = this.json.assets;
        this.assetsDir = this.assetsIndex !== 'legacy' ? `${this.minecraftDir}\\assets` : `${this.minecraftDir}\\assets\\virtual\\legacy`;
        console.log(`> Assets index: ${this.assetsIndex}`);
        console.log(`> Assets directory: ${this.assetsDir}`);
    }

    async loadLogConfiguration() {
        this.logFile = this.json.logging.client.file.id;
        console.log('> Log configuration: ' + this.logFile);
    }

    async compileMappings() {
        console.log('> Compiling mappings');
        console.log(
            execSync(
                `"${this.javaExe}" -jar dragonfly\\bin\\mapping-index-compiler.jar ` +
                    `--version ${this.targetVersion} ` +
                    `--temp-dir "dragonfly\\tmp\\mappings-index-compiler-${this.targetVersion}" ` +
                    `--destination-dir "dragonfly\\mappings\\${this.targetVersion}"`,
                {
                    cwd: this.minecraftDir,
                }
            ).toString()
        );
    }

    async executeCommand() {
        const mainClass = 'net.minecraft.client.main.Main';
        const agentArgs = [
            `-v ${this.targetVersion}`,
            `-i net.dragonfly.core.SharedInjectionHook`,
            `-i net.dragonfly.vortex.DragonflyVortex`,
        ];
        const jvmArgs = [
            `-javaagent:dragonfly/injection/agent-shared.jar="${agentArgs.join(' ')}"`,
            `-Djava.library.path=dragonfly\\natives-${this.targetVersion}`,
            `-Dlog4j.configurationFile=dragonfly\\log-configs\\${this.logFile}`,
            `-cp ${this.classPathArgument}`,
        ];
        const programArgs = {
            version: this.targetVersion,
            assetsDir: this.assetsDir,
            assetIndex: this.assetsIndex,
            accessToken: this.accessToken,
            uuid: this.uuid,
            username: this.name,
            userProperties: `"${JSON.stringify(this.propertiesObj).replaceAll('"', '"')}"`,
            userType: 'mojang',
        };

        const command = this.buildCommand(jvmArgs, programArgs, mainClass);

        this.gameProcess = exec(command, { cwd: this.minecraftDir });
    }

    buildCommand(jvmArgs, programArgs, mainClass) {
        let command = '"' + this.javaExe + '"';
        command += ' ';
        command += jvmArgs.join(' ');
        command += ' ';
        command += mainClass;
        command += ' ';
        command += Object.keys(programArgs)
            .map((key) => `--${key} ${programArgs[key]}`)
            .join(' ');
        return command;
    }

    handleGameStart() {
        this.openWithGameOutput = document.getElementById('open-game-output').checked;

        this.gameObject = {
            gameVersion: this.targetVersion,
            playerUUID: this.uuid,
            pid: this.gameProcess.pid,
        };

        openGames.push(this.gameObject);
        console.log('> Open games: ', openGames);
        console.log('> Game object: ', this.gameObject);
        ipcRenderer.send('open-game', { openGames: openGames, gameObject: this.gameObject });
        if (this.openWithGameOutput) ipcRenderer.send('open-game-output', this.gameObject);

        console.log(`> Game startup (${openGames.length} running)`);
    }

    enableLogging() {
        const openWithGameOutput = this.openWithGameOutput;
        const parser = new xml2js.Parser();
        const gameObject = this.gameObject;
        const parseMessage = (data, defaultLevel, defaultLogger) => {
            if (!data || !data.toString()) return;
            const xml = data.toString();

            parser.parseString(xml, function (err, result) {
                let message;
                if (result) {
                    const event = result['log4j:Event'];
                    const info = event['$'];

                    message = {
                        level: info.level,
                        logger: info.logger,
                        thread: info.thread,
                        timestamp: info.timestamp,
                        message: event['log4j:Message'][0],
                    };
                } else {
                    message = {
                        level: defaultLevel,
                        logger: defaultLogger,
                        thread: '',
                        timestamp: new Date().getTime(),
                        message: xml,
                    };
                }
                console.log(message.message)
                openWithGameOutput && ipcRenderer.send('game-output-data', { message, pid: gameObject.pid });
            });
        };

        this.gameProcess.stdout.on('data', (data) => parseMessage(data, 'DEBUG', 'STDOUT'));
        this.gameProcess.stderr.on('data', (data) => parseMessage(data, 'ERROR', 'STDERR'));
    }

    handleGameClose() {
        this.closeGameOutput = document.getElementById('close-game-output').checked;
        const closeGameOutput = this.closeGameOutput;
        const command = this.gameProcess;
        command.on('close', () => {
            const closedGameObject = openGames.find((game) => game.pid === command.pid);
            openGames = openGames.filter((game) => game.pid !== command.pid);
            ipcRenderer.send('game-closed', { openGames: openGames, closedGameObject: closedGameObject, closeGameOutput: closeGameOutput });

            console.log(`> Game closed (${openGames.length} running)`);
        });
    }
}

module.exports.setVersion = setVersion;
module.exports.startGame = startGame;
