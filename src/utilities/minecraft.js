/* minecraft (auth) stuff will be handled here */
const fs = require('fs');
const axios = require('axios').default;

module.exports.getMinecraftLauncherProfiles = async () => {
    const appData = process.env.APPDATA;
    const minecraftDir = appData + '\\.minecraft';
    const file = `${minecraftDir}\\launcher_accounts.json`;
    const launcherAccounts = JSON.parse(fs.readFileSync(file));

    if (!launcherAccounts.accounts) return false;

    const mojangClientToken = launcherAccounts.mojangClientToken;
    const minecraftAccounts = [];

    Object.keys(launcherAccounts.accounts).forEach(account => {
        const minecraftAccount = launcherAccounts.accounts[account];
        const accountObj = {};
        if (minecraftAccount.minecraftProfile) {
            accountObj.name = minecraftAccount.minecraftProfile.name;
            accountObj.uuid = minecraftAccount.minecraftProfile.id;
            accountObj.accessToken = minecraftAccount.accessToken;
            accountObj.clientToken = mojangClientToken;
            minecraftAccounts.push(accountObj);
        } else {
            // handle microsoft account
            accountObj.name = minecraftAccount.username;
            accountObj.uuid = null;
            accountObj.accessToken = minecraftAccount.accessToken;
            accountObj.clientToken = mojangClientToken;
            minecraftAccounts.push(accountObj);
        }
    });

    return minecraftAccounts;
};

module.exports.minecraftLogin = async (credentials, clientToken) => {
    return axios
        .post('https://authserver.mojang.com/authenticate', {
            agent: {
                name: 'Minecraft',
                version: 1,
            },
            username: credentials.username,
            password: credentials.password,
            clientToken: clientToken,
        })
        .then(res => {
            return res.data;
        })
        .catch(err => {
            return err;
        });
};
