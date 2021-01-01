/* minecraft (auth) stuff will be handled here */
const fs = require('fs');
const axios = require('axios').default;

const minecraftAuthBaseUrl = 'https://authserver.mojang.com';

module.exports.getMinecraftLauncherProfiles = async (onlyMojang = true) => {
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
        } else if (!onlyMojang) {
            accountObj.name = minecraftAccount.username;
            accountObj.uuid = null;
            accountObj.accessToken = minecraftAccount.accessToken;
            accountObj.accessTokenExpiresAt = minecraftAccount.accessTokenExpiresAt;
            accountObj.clientToken = mojangClientToken;
            minecraftAccounts.push(accountObj);
        }
    });

    return minecraftAccounts;
};

module.exports.minecraftLogin = async (credentials, clientToken) => {
    try {
        return axios
            .post(minecraftAuthBaseUrl + '/authenticate', {
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
                console.log('> [Minecraft] Error while logging in:', error);
                return err.response.data;
            });
    } catch (error) {
        console.log('> [Minecraft] Error while logging in:', error);
        return error;
    }
};

module.exports.validateMinecraftToken = (accessToken, clientToken) => {
    try {
        return axios
            .post(minecraftAuthBaseUrl + '/validate', {
                accessToken: accessToken,
                clientToken: clientToken,
            })
            .then(res => {
                if (res.status == 204 || res.status == 200) return true;
                return false;
            })
            .catch(err => {
                err = err.response;
                if (err.status == 403 && err.data.errorMessage == 'Invalid token') return false;
                return err.data;
            });
    } catch (error) {
        console.log('> [Minecraft] Error while validating minecraft access token:', error);
    }
};
