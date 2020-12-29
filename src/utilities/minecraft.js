/* minecraft (auth) stuff will be handled here */
const fs = require('fs');

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
        accountObj.name = minecraftAccount.minecraftProfile.name;
        accountObj.uuid = minecraftAccount.minecraftProfile.id;
        accountObj.accessToken = minecraftAccount.accessToken;
        accountObj.clientToken = mojangClientToken;

        minecraftAccounts.push(accountObj);
    });

    return minecraftAccounts;
};
