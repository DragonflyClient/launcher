const crypto = require('crypto');
require('dotenv/config');

let developerMode = computeDeveloperMode();

function computeDeveloperMode() {
    const variable = process.env.DRAGONFLY_DEVELOPER;
    if (variable) {
        try {
            return (
                crypto.createHash('sha256').update(process.env.DRAGONFLY_DEVELOPER.toString()).digest('hex') ===
                '5d5907b8c857c9c50844e506c4620a2e2bdca7d485d6d11c973772436b656055'
            );
        } catch (e) {}
    }

    return false;
}

function disableDeveloperMode() {
    developerMode = false;
    return 'disabled';
}

function isDeveloperMode() {
    return developerMode;
}

module.exports.disableDeveloperMode = disableDeveloperMode;
module.exports.isDeveloperMode = isDeveloperMode;
