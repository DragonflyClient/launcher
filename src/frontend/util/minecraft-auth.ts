/* minecraft (auth) stuff will be handled here */
import fs from "fs"
import path from "path"
import axios from "axios"
import { Account, AccountList, AccountsFile } from "./accounts"

const minecraftAuthBaseUrl = "https://authserver.mojang.com"

let isAccountsLoaded: boolean = false
let storedAccounts: AccountList = {}
let currentAccountKey: string | null = null

let appPath: string
let file: string

function loadAccounts(): boolean {
    try {
        if (fs.existsSync(file)) {
            const { accounts, currentSelectedAccount } = readAccountsJson()
            storedAccounts = accounts ?? {}
            currentAccountKey = currentSelectedAccount ?? null
            return true
        }
    } catch (e) {
        console.error("! Error during loading of accounts.json:", e)
    }

    storedAccounts = {}
    currentAccountKey = null
    return false
}

function loadIfRequired() {
    if (!isAccountsLoaded) {
        isAccountsLoaded = loadAccounts()
    }
}

function generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

export function getAccounts(): AccountList | null {
    loadIfRequired()
    return storedAccounts
}

export function getCurrentAccount(): Account | null {
    loadIfRequired()
    return currentAccountKey != null ? storedAccounts[currentAccountKey] : null
}

export function getCurrentAccountIdentifier(): string | null {
    loadIfRequired()
    return currentAccountKey
}

export function addAccount(account: Account, setCurrent: boolean = true, identifierIn: string) {
    try {
        loadIfRequired()

        const existingIdentifier = Object.keys(storedAccounts)
            .find(key => storedAccounts[key].profile.uuid === account.profile.uuid)
        const identifier = identifierIn ?? generateUUID()

        if (existingIdentifier) {
            const existing = storedAccounts[existingIdentifier]
            if (existing.type === "mojang" && account.type === "mojang") {
                existing.clientToken = account.clientToken
            } else if (existing.type === "microsoft" && account.type === "microsoft") {
                existing.refreshToken = account.refreshToken
            } else {
                console.warn("Tried to update properties of an existing account with another account " +
                    "that doesn't match the original one's type!")
                console.warn("Original account:", existing)
                console.warn("Update account:", account)
                return
            }

            existing.accessToken = account.accessToken
            storedAccounts[existingIdentifier] = existing

            if (setCurrent) currentAccountKey = existingIdentifier
        } else {
            storedAccounts[identifier] = account
            if (setCurrent) currentAccountKey = identifier
        }

        const accountsJson = readAccountsJson()
        accountsJson.accounts = storedAccounts
        accountsJson.currentSelectedAccount = currentAccountKey ?? undefined

        writeAccountsJson(accountsJson)
        return existingIdentifier ? false : identifier
    } catch (e) {
        console.error("! Could not add account:", e)
    }
}

export function removeAccount(identifier: string) {
    try {
        let switched = false
        delete storedAccounts[identifier]

        const accountsJson = readAccountsJson()

        if (currentAccountKey === identifier) {
            currentAccountKey = Object.keys(storedAccounts)[0]
            console.log("Switched current account to " + currentAccountKey)
            switched = true
        }

        accountsJson.accounts = storedAccounts
        accountsJson.currentSelectedAccount = currentAccountKey ?? undefined

        writeAccountsJson(accountsJson)
        return switched
    } catch (e) {
        console.error("! Could not remove account:", e)
    }
}

export function setCurrentAccount(identifier: string) {
    try {
        currentAccountKey = identifier

        const accountsJson = readAccountsJson()
        accountsJson.currentSelectedAccount = currentAccountKey

        fs.writeFileSync(file, JSON.stringify(accountsJson))
    } catch (e) {
        console.error("! Could not change current account:", e)
    }
}

export async function mojangLogin(credentials: { username: string; password: string }, clientToken = null) {
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
                return {
                    type: "mojang",
                    accessToken: data.accessToken,
                    clientToken: data.clientToken,
                    profile: {
                        uuid: account.id,
                        username: account.name,
                    },
                }
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

export function validateToken(accessToken: string, clientToken: string) {
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

export async function refreshToken(identifier: string) {
    const account = storedAccounts[identifier]
    if (account.type !== "mojang") throw "Refreshing is currently only supported for Mojang accounts"

    const response = await axios.post(minecraftAuthBaseUrl + "/refresh", {
        accessToken: account.accessToken,
        clientToken: account.clientToken,
    })

    account.accessToken = response.data.accessToken
    addAccount(account, false, identifier)
    return true
}

export function setAppPath(inputAppPath: string) {
    appPath = inputAppPath
    file = path.join(appPath, "tmp", "accounts.json")
}

function readAccountsJson(): AccountsFile {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file).toString()) : {}
}

function writeAccountsJson(object: AccountsFile) {
    fs.writeFileSync(file, JSON.stringify(object))
}
