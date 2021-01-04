/* minecraft (auth) stuff will be handled here */
const fs = require("fs")
const path = require("path")
const axios = require("axios").default

const minecraftAuthBaseUrl = "https://authserver.mojang.com"

let storedAccounts = null
let currentAccountKey = null

let appPath

function loadAccounts() {
    const file = path.join(appPath, "tmp", "accounts.json")

    try {
        if (fs.existsSync(file)) {
            const { accounts, currentSelectedAccount } = JSON.parse(fs.readFileSync(file))
            storedAccounts = accounts ?? {}
            currentAccountKey = currentSelectedAccount ?? null
            return
        }
    } catch (e) {
        console.error("! Error during loading of accounts.json:", e)
    }

    storedAccounts = {}
    currentAccountKey = null
}

function loadIfRequired() {
    if (!storedAccounts) {
        loadAccounts()
    }
}

function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

function getAccounts() {
    loadIfRequired()
    return storedAccounts
}

function getCurrentAccount() {
    loadIfRequired()
    return currentAccountKey ? storedAccounts[currentAccountKey] : null
}

function addAccount(account) {
    try {
        loadIfRequired()
        const identifier = generateUUID()
        storedAccounts[identifier] = account
        currentAccountKey = identifier

        const file = path.join(appPath, "tmp", "accounts.json")
        const accountsJson = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {}
        accountsJson.accounts = storedAccounts
        accountsJson.currentSelectedAccount = currentAccountKey

        // TODO: Check if account is already saved before writing
        fs.writeFileSync(file, JSON.stringify(accountsJson))
        return identifier
    } catch(e) {
        console.error("! Could not add account:", e)
    }
}

function removeAccount(identifier) {
    try {
        delete storedAccounts[identifier]

        const file = path.join(appPath, "tmp", "accounts.json")
        const accountsJson = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {}
        accountsJson.accounts = storedAccounts

        if (currentAccountKey === identifier) {
            currentAccountKey = storedAccounts[Object.keys(storedAccounts)[0]]
        }

        fs.writeFileSync(file, JSON.stringify(accountsJson))
        return identifier
    } catch(e) {
        console.error("! Could not remove account:", e)
    }
}

function setCurrentAccount(identifier) {
    try {
        currentAccountKey = identifier

        const file = path.join(appPath, "tmp", "accounts.json")
        const accountsJson = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {}
        accountsJson.currentSelectedAccount = currentAccountKey

        fs.writeFileSync(file, JSON.stringify(accountsJson))
    } catch(e) {
        console.error("! Could not change current account:", e)
    }
}

async function mojangLogin(credentials, clientToken = null) {
    try {
        return axios
            .post(minecraftAuthBaseUrl + "/authenticate", {
                agent: {
                    name: "Minecraft",
                    version: 1,
                },
                username: credentials.username,
                password: credentials.password,
                clientToken: clientToken,
            })
            .then(res => {
                const data = res.data
                let account
                if (!data.selectedProfile.id && !data.availableProfiles[0]) {
                    return console.log("> [Minecraft] Sus.. No minecraft profile found")
                } else if (!data.selectedProfile.id) {
                    account = data.availableProfiles[0]
                } else {
                    account = data.selectedProfile
                }
                const accountData = {
                    type: "mojang",
                    accessToken: data.accessToken,
                    clientToken: data.clientToken,
                    profile: {
                        uuid: account.id,
                        username: account.name,
                    },
                }
                addAccount(accountData)
                return accountData
            })
            .catch(err => {
                console.log("> [Minecraft] Error while logging in:", err)
                return err.response.data
            })
    } catch (error) {
        console.log("> [Minecraft] Error while logging in:", error)
        return error
    }
}

function validateToken(accessToken, clientToken) {
    try {
        return axios
            .post(minecraftAuthBaseUrl + "/validate", {
                accessToken: accessToken,
                clientToken: clientToken,
            })
            .then(res => {
                return res.status === 204 || res.status === 200
            })
            .catch(({ response: res }) => {
                if (res.status === 403 && res.data.errorMessage === "Invalid token") return false
                return res.data
            })
    } catch (error) {
        console.log("> [Minecraft] Error while validating minecraft access token:", error)
    }
}

function setAppPath(inputAppPath) {
    appPath = inputAppPath
}

module.exports = {
    setAppPath,
    addAccount,
    getAccounts,
    removeAccount,
    getCurrentAccount,
    setCurrentAccount,
    mojangLogin,
    validateToken,
}
