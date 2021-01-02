const RPC = require('discord-rpc')
const rpc = new RPC.Client({
    transport: 'ipc',
})
let loggedIn = false
let failedConnectionCount = 0

const pjson = require('../../../package.json')
console.log('=== Dragonfly Launcher v' + pjson.version + ' ===')

rpc.on('error', err => {
    console.error('> [Discord] An error occurred', err)
})

module.exports.isReady = function () {
    return new Promise((resolve, reject) => {
        rpc.on('ready', () => {
            resolve({ success: true })
        })
    })
}
/**
 *  Connects to discord
 * @type { Function }
 */
module.exports.login = function (clientId) {
    if (failedConnectionCount < 3) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                reject({ success: false, error: 'Connection timeout' })
            }, 2500)
            rpc.login({
                clientId: clientId,
            })
                .then(() => {
                    console.log('> [Discord] Logged in')
                    loggedIn = true
                    resolve({ success: true })
                })
                .catch(err => {
                    console.log('> [Discord] An error occurred while while logging in')
                    failedConnectionCount++
                    console.log(`> [Discord] Failed ${failedConnectionCount} times to connect to Discord`)
                    reject({ success: false, error: 'An error occurred while while logging in' })
                })
        })
    } else {
        console.log('> [Discord] No more tries to connect')
        return false
    }
}

/**
 *
 * @param  {String} Options
 *
 */
module.exports.setPresence = async options => {
    let currentLogin
    if (!loggedIn) {
        currentLogin = await this.login('777509861780226069')
    }

    if (!loggedIn && !currentLogin) return

    if (!options) {
        rpc.setActivity({
            state: 'Loading...',
            largeImageKey: 'dragonfly-1',
            largeImageText: `Dragonfly Launcher v${pjson.version}`,
        })
    } else {
        rpc.setActivity({
            state: options.state,
            details: options.details,
            largeImageKey: options.largeImgKey || 'dragonfly-1',
            largeImageText: options.largeImgText || `Dragonfly Launcher v${pjson.version}`,
            startTimestamp: new Date().getTime(),
        })
    }
    console.log('> [Discord] Set Discord presence')
}
