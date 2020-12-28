const axios = require('axios');
const fs = require('fs');

async function downloadEditions() {
    try {
        const url = 'https://api.playdragonfly.net/v1/launcher/editions';
        const text = JSON.stringify((await axios.get(url)).data);

        fs.writeFileSync('tmp/editions.json', text);
        console.log('> Successfully downloaded Dragonfly editions');
    } catch (e) {
        console.log('> Failed to download Dragonfly editions');
    }
}

module.exports = {
    downloadEditions,
};
