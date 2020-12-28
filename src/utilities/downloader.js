const axios = require('axios');
const fs = require('fs');
const app = require('electron').app;
const { rootPath, ensureDirectoryExistence } = require('../utilities/path');

async function downloadEditions() {
    try {
        const workingDir = rootPath(app.getAppPath());
        const localFile = workingDir + '\\tmp\\editions.json';

        const url = 'https://api.playdragonfly.net/v1/launcher/editions';
        const text = JSON.stringify((await axios.get(url)).data);

        ensureDirectoryExistence(localFile, true, 'dir');

        fs.writeFileSync(localFile, text);
        console.log('> Successfully downloaded Dragonfly editions');
    } catch (e) {
        console.log('> Failed to download Dragonfly editions');
        console.error(e);
    }
}

module.exports = {
    downloadEditions,
};
