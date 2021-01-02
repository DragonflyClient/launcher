const { BrowserWindow } = require("electron").remote
const axios = require('axios');
const qs = require('querystring')

const MICROSOFT_OAUTH_LOGIN_URL = "https://login.live.com/oauth20_authorize.srf" +
    "?client_id=%CLIENT_ID%" +
    "&response_type=code" +
    "&redirect_uri=%REDIRECT_URI%" +
    "&scope=service::user.auth.xboxlive.com::MBI_SSL"

const MICROSOFT_OAUTH_TOKEN_URL = "https://login.live.com/oauth20_token.srf?api-version=1.0"

const XBOX_LIVE_AUTHENTICATION_URL = "https://user.auth.xboxlive.com/user/authenticate"

const XSTS_AUTHORIZATION_URL = "https://xsts.auth.xboxlive.com/xsts/authorize"

const MC_SERVICES_AUTHENTICATION_URL = "https://api.minecraftservices.com/authentication/login_with_xbox"

const CLIENT_ID = "00000000402b5328"

const REDIRECT_URI = "https%3A%2F%2Flogin.live.com%2Foauth20_desktop.srf"

async function startAuthorizationFlow() {
    console.log("== Starting Microsoft Authorization Flow ==")
    const flow = new MicrosoftAuthorizationFlow()
    await flow.promptMicrosoftOAuthLogin()
}

class MicrosoftAuthorizationFlow {

    /**
     * Opens a new window in which the user can log in to their Microsoft account
     * and grant the Launcher
     * @returns {Promise<void>}
     */
    async promptMicrosoftOAuthLogin() {
        console.log("> [#1] Prompting for Microsoft OAuth Login...")
        const microsoftLoginWindow = new BrowserWindow({
            width: 551,
            height: 601,
            autoHideMenuBar: true,
            resizable: false,
            webPreferences: {
                nodeIntegration: false,
                enableRemoteModule: false,
                contextIsolation: true,
            },
            show: false
        })

        microsoftLoginWindow.webContents.once("did-finish-load", () => {
            microsoftLoginWindow.show()
        })

        microsoftLoginWindow.webContents.on("will-redirect", async (event, data) => {
            const url = new URL(data)

            if (url.host === "login.live.com" && url.pathname === "/oauth20_desktop.srf") {
                if (url.searchParams.has("code")) {
                    const code = url.searchParams.get("code")

                    console.log("> [#1] Microsoft Authorization Code received:", code)
                    await this.acquireAuthorizationToken(code)
                } else if (url.searchParams.has("error")) {
                    const error = url.searchParams.get("error");

                    console.log("> [#1] Error during Microsoft OAuth Login:", error) // can be "access_denied"
                } else return

                event.preventDefault()
                microsoftLoginWindow.destroy()
            }
        })

        await microsoftLoginWindow.webContents.session.clearCache()
        await microsoftLoginWindow.webContents.session.clearAuthCache()
        await microsoftLoginWindow.webContents.session.clearStorageData()

        const loginUrl = formatString(MICROSOFT_OAUTH_LOGIN_URL, {
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI
        });

        await microsoftLoginWindow.loadURL(loginUrl)
    }

    async acquireAuthorizationToken(code) {
        console.log("> [#2] Acquiring Microsoft OAuth Token...")

        const requestData = {
            redirect_uri: "https://login.live.com/oauth20_desktop.srf",
            code: code,
            client_id: CLIENT_ID,
            scope: "service::user.auth.xboxlive.com::MBI_SSL",
            grant_type: "authorization_code"
        };

        try {
            const urlEncoded = qs.stringify(requestData)

            const response = await axios.post(
                MICROSOFT_OAUTH_TOKEN_URL,
                urlEncoded,
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                }
            )

            const responseData = response.data
            const accessToken = responseData.access_token
            const refreshToken = responseData.refresh_token

            console.log(`> [#2] Received access token (${accessToken}) and refresh token (${refreshToken})`)
            await this.authenticateXboxLive(accessToken)
        } catch (e) {
            console.log("> [#2] Error while acquiring Microsoft OAuth Token:", e)
        }
    }

    async authenticateXboxLive(accessToken) {
        console.log("> [#3] Authenticating with Xbox Live...")

        try {
            const body = {
                "Properties": {
                    "AuthMethod": "RPS",
                    "SiteName": "user.auth.xboxlive.com",
                    "RpsTicket": accessToken
                },
                "RelyingParty": "http://auth.xboxlive.com",
                "TokenType": "JWT"
            }
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    "Accepts": "application/json"
                }
            }

            const response = await axios.post(XBOX_LIVE_AUTHENTICATION_URL, body, config)
            const responseData = response.data

            const xblToken = responseData["Token"]
            const uhs = responseData["DisplayClaims"]["xui"][0]["uhs"]

            console.log(`> [#3] Received Xbox Live Token (${xblToken}) and UHS (${uhs})`)
            await this.authenticateXSTS(xblToken, uhs)
        } catch (e) {
            console.log("> [#3] Error while authenticating with Xbox Live:", e)
        }
    }

    async authenticateXSTS(xblToken, uhs) {
        console.log("> [#4] Authenticating with XSTS...")

        try {
            const body = {
                "Properties": {
                    "SandboxId": "RETAIL",
                    "UserTokens": [
                        xblToken
                    ]
                },
                "RelyingParty": "rp://api.minecraftservices.com/",
                "TokenType": "JWT"
            }
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    "Accepts": "application/json"
                }
            }

            const response = await axios.post(XSTS_AUTHORIZATION_URL, body, config)
            const responseData = response.data

            if (response.status === 401) {
                console.log("> [#4] The Microsoft Account is not linked to an Xbox Account!")
                // TODO: Handle this
                return
            }

            const xstsToken = responseData["Token"]

            console.log("> [#4] Received XSTS Token:", xstsToken)
            this.authenticateMinecraftServices(xstsToken, uhs)
        } catch (e) {
            console.log("> [#4] Error while authenticating with XSTS:", e)
        }
    }

    async authenticateMinecraftServices(xstsToken, uhl) {
        console.log("> [#5] Authenticating with Minecraft Services...")

        try {
            const body = {
                "IdentityToken": `XBL3.0 x=${uhl};${xstsToken}`
            }
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    "Accepts": "application/json"
                }
            }

            const response = await axios.post(MC_SERVICES_AUTHENTICATION_URL, body, config)
            const responseData = response.data

            const minecraftToken = responseData["access_token"]

            console.log("> [#5] Received Minecraft Token:", minecraftToken)
        } catch (e) {
            console.log("> [#5] Error while authenticating with Minecraft Services:", e)
        }
    }
}

/**
 * Formats the given input string by replacing all placeholders inside of the string
 * with the corresponding values on the replacements object.
 *
 * For example: %NAME% -> replacements.name
 */
function formatString(input, replacements) {
    return input.replace(/%\w+%/g, function (all) {
        return replacements[all.replaceAll("%", "").toLowerCase()] || all;
    });
}

module.exports = {
    startAuthorizationFlow
}