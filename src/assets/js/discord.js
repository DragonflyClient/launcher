const RPC = require('discord-rpc');
const rpc = new RPC.Client({
    transport: 'ipc',
});
let loggedIn = false;
let failedConnectionCount = 1;

const pjson = require('../../../package.json');
console.log(pjson.version);

rpc.on('error', err => {
    console.error('DISCORD: An error occurred', err);
});

module.exports.isReady = function () {
    console.log('DISCORD: Checking if RPC is ready');
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject({ success: false, error: 'Connection timeout' });
        }, 3500);
        rpc.on('ready', () => {
            resolve({ success: true });
        });
    });
};
/**
 *  Connects to discord
 * @type { Function }
 */
module.exports.login = function (clientId) {
    console.log('DISCORD: Logging in...');
    if (failedConnectionCount <= 3) {
        return new Promise((resolve, reject) => {
            rpc.login({
                clientId: clientId,
            })
                .then(() => {
                    console.log('DISCORD: Logged in');
                    loggedIn = true;
                    resolve({ success: true });
                })
                .catch(err => {
                    console.log('DISCORD: An error occurred while while logging in');
                    failedConnectionCount += 1;
                    console.log(`DISCORD: Failed ${failedConnectionCount} times to connect to Discord`);
                    reject({ success: false, error: 'An error occurred while while logging in' });
                });
        });
    } else {
        console.log('DISCORD: No more tries to connect');
        return false;
    }
};

/**
 *
 * @param  {String} Test
 *
 */
module.exports.setPresence = async options => {
    let currentLogin;
    if (!loggedIn) {
        currentLogin = await this.login('777509861780226069');
    } else {
        console.log('DISCORD: Actually setting rpc');
    }

    if (!currentLogin) return;

    if (!options) {
        rpc.setActivity({
            state: 'Loading...',
            largeImageKey: 'dragonfly-1',
            largeImageText: `Dragonfly Launcher v${pjson.version}`,
        }).then(() => console.log('DISCORD: Set default activity'));
    } else {
        rpc.setActivity({
            state: options.state,
            details: options.details,
            largeImageKey: options.largeImgKey || 'dragonfly-1',
            largeImageText: options.largeImgText || `Dragonfly Launcher v${pjson.version}`,
            startTimestamp: new Date().getTime(),
        }).then(() => console.log('DISCORD: Set custom activity'));
    }
};
