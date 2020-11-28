const RPC = require('discord-rpc');
const rpc = new RPC.Client({
  transport: 'ipc',
});
let loggedIn = false;

const pjson = require('../../../package.json');
console.log(pjson.version);

rpc.on('error', (err) => {
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
  return new Promise((resolve, reject) => {
    rpc
      .login({
        clientId: clientId,
      })
      .then(() => {
        console.log('DISCORD: Logged in');
        loggedIn = true;
        resolve({ success: true });
      })
      .catch((err) => {
        console.log('DISCORD: An error occurred while while logging in', err);
        reject({ success: false, error: 'An error occurred while while logging in' });
      });
  });
};

/**
 *
 * @param  {String} Test
 *
 */
module.exports.setPresence = (options) => {
  console.log('DISCORD: Actually setting rpc');
  console.log(loggedIn, 'LI', options, 'O');
  if (!loggedIn) return;
  console.log(options);

  if (!options) {
    rpc
      .setActivity({
        state: 'Loading...',
        largeImageKey: 'dragonfly-1',
        largeImageText: `Dragonfly Launcher v${pjson.version}`,
      })
      .then(() => console.log('DISCORD: Set default activity'));
  } else {
    rpc
      .setActivity({
        state: options.state,
        details: options.details,
        largeImageKey: options.largeImgKey || 'dragonfly-1',
        largeImageText: options.largeImgText || `Dragonfly Launcher v${pjson.version}`,
        startTimestamp: new Date().getTime(),
      })
      .then(() => console.log('DISCORD: Set custom activity'));
  }
};
