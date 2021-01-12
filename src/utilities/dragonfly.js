const axios = require("axios").default
const baseAuthUrl = "https://api.playdragonfly.net/v1/authentication"

const fs = require("fs")
const path = require("path")

const CryptoJS = require("crypto-js")

const defaultDragonflyConfig = { editionMinecraftVersion: "1.8.9" }

module.exports.getDragonflyAccount = (token, validate = false) => {
    return axios
        .post(
            baseAuthUrl + "/token",
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        )
        .then(res => {
            if (res.data.success) {
                if (validate) return true
                return res.data
            } else {
                if (validate) return false
                return res.data
            }
        })
        .catch(err => {
            return false
        })
}

module.exports.dragonflyAccountLogin = loginBody => {
    return axios
        .post(baseAuthUrl + "/login", loginBody)
        .then(res => {
            if (res.data.success) {
                return res.data
            } else {
                console.log("> [Dragonfly] No success logging into account")
                return false
            }
        })
        .catch(err => {
            console.log("> [Dragonfly] Error while logging into account.")
            if (err.message === "Network Error")
                return {
                    success: false,
                    title: "Network Error",
                    error: "It looks like you're not connected to the internet. Establish a connection and try again.",
                }
            return err.response.data
        })
}

module.exports.getDragonflyToken = appPath => {
    try {
        const cipherText = fs.readFileSync(path.join(appPath, ".secrets", "access.txt")).toString()
        const bytes = CryptoJS.AES.decrypt(cipherText, "secretKey")
        const token = bytes.toString(CryptoJS.enc.Utf8)
        return token
    } catch (error) {
        console.log("> [Dragonfly] Error while reading dragonfly token")
    }
}

/* Configuration regarding dragonfly */
module.exports.currentEditionVersion = appPath => {
    try {
        if (!fs.existsSync(path.join(appPath, "tmp", "config.json"))) {
            fs.writeFileSync(path.join(appPath, "tmp", "config.json"), JSON.stringify(defaultDragonflyConfig))
        }
        const content = JSON.parse(fs.readFileSync(path.join(appPath, "tmp", "config.json")))
        return content.editionMinecraftVersion
    } catch (error) {
        console.log("> [Dragonfly] Error while reading edition version from config")
        return null
    }
}

module.exports.writeEditionVersion = (appPath, version) => {
    try {
        const content = JSON.parse(fs.readFileSync(path.join(appPath, "tmp", "config.json")))
        content.editionMinecraftVersion = version
        fs.writeFileSync(path.join(appPath, "tmp", "config.json"), JSON.stringify(content))
        return true
    } catch (error) {
        console.log("> [Dragonfly] Error while writing edition version to config")
        return false
    }
}
