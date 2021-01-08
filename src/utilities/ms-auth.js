const { BrowserWindow } = require("electron").remote
const axios = require("axios")
const qs = require("querystring")

/**
 * The URL of the Microsoft OAuth Window that prompts the user to enter their Microsoft credentials
 * to authorize the app.
 * @type {string}
 */
const MICROSOFT_OAUTH_LOGIN_URL = "https://login.live.com/oauth20_authorize.srf" +
    "?client_id=%CLIENT_ID%" +
    "&response_type=code" +
    "&redirect_uri=%REDIRECT_URI%" +
    "&scope=service::user.auth.xboxlive.com::MBI_SSL"

/**
 * The URL to generate an OAuth Access Token from the OAuth Code received in step #1.
 * @type {string}
 */
const MICROSOFT_OAUTH_TOKEN_URL = "https://login.live.com/oauth20_token.srf?api-version=1.0"

/**
 * The URL to generate an Xbox Live Authentication Token from the OAuth Access Token received in
 * step #2.
 * @type {string}
 */
const XBOX_LIVE_AUTHENTICATION_URL = "https://user.auth.xboxlive.com/user/authenticate"

/**
 * The URL to generate an XSTS Authorization Token from the Xbox Live Authentication Token received
 * in step #3.
 * @type {string}
 */
const XSTS_AUTHORIZATION_URL = "https://xsts.auth.xboxlive.com/xsts/authorize"

/**
 * The URL to generate a Minecraft Token from the XSTS Authorization Token received in step #4.
 * @type {string}
 */
const MC_SERVICES_AUTHENTICATION_URL = "https://api.minecraftservices.com/authentication/login_with_xbox"

/**
 * The URL to load the Minecraft Profile with the Minecraft Token received in step #5.
 * @type {string}
 */
const MC_SERVICES_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile"

/**
 * The Azure Client ID that is used to get OAuth access to the Microsoft Account. This is the
 * Client ID used by the default Mojang Minecraft Launcher.
 * @type {string}
 */
const CLIENT_ID = "00000000402b5328"

/**
 * The URL to which the user is redirected after granting OAuth access to the Minecraft Launcher.
 * This URL corresponds to the {@link CLIENT_ID}, which means it is also identical to the one
 * used on the default Mojang Minecraft Launcher.
 * @type {string}
 */
const REDIRECT_URI = "https%3A%2F%2Flogin.live.com%2Foauth20_desktop.srf"

/**
 * Starts the Microsoft Authorization Flow and returns a promise that is resolved if the flow
 * finished successfully with the `accessToken` and `profile` as properties on the returned
 * object. If the flow encounters any error, the promise is rejected and the returned object
 * has an `error` and a `message` property which explain what went wrong.
 *
 * @param onAbort Function to be called if the flow is aborted (e.g. by closing the OAuth window)
 * @returns {Promise<unknown>} The promise acting as described above
 */
function startAuthorizationFlow(onAbort) {
    return new Promise(async (resolve, reject) => {
        abortAll()

        console.log("== Starting Microsoft Authorization Flow ==")
        const flow = new MicrosoftAuthorizationFlow(onAbort)
        await flow.promptMicrosoftOAuthLogin()

        if (flow.error) {
            reject({
                error: "unexpected_exception",
                message: "<b>An error occurred during the Microsoft Authorization Flow execution</b>. Please " +
                    "try again later or contact our support to get help. Error message: " + flow.error,
            })
        } else if (!flow.hasXboxAccount) {
            reject({
                error: "no_xbox_account",
                message: "This Microsoft account doesn't have an Xbox profile. When purchasing Minecraft " +
                    "with a Microsoft account, an Xbox profile should be automatically created. Please " +
                    "<b>make sure you logged in with the correct Microsoft account</b>.",
            })
        } else if (!flow.ownsMinecraft) {
            reject({
                error: "no_minecraft",
                message: "<b>It seems like you don't own Minecraft on that account</b>. If you originally " +
                    "used a Mojang account, make sure to migrate from it to Microsoft and make sure you logged " +
                    "in with the correct Microsoft account.",
            })
        } else if (flow.minecraftProfile) {
            resolve({
                accessToken: flow.minecraftToken,
                profile: flow.minecraftProfile,
            })
        } else {
            reject({
                error: "something_weird",
                message: "The Microsoft Authorization Flow was successfully executed but no Minecraft profile is " +
                    "available although you should own Minecraft (which shouldn't happen). Please try again later " +
                    "and if this keeps happening feel free to contact our support to get help.",
            })
        }
    })
}

/**
 * Aborts all currently running authorization flows.
 * @public
 */
function abortAll(controlled = false) {
    MicrosoftAuthorizationFlow.flows.forEach(flow => {
        flow.isControlledClose = controlled
        flow.window && flow.window.close()
    })
}

/**
 * This class handles all of the authorization logic that is required to login to Minecraft
 * using a Microsoft account (which is a lot, believe me).
 *
 * @class
 * @public
 */
class MicrosoftAuthorizationFlow {

    /**
     * Holds the instances of the authorization flows whose windows are currently visible.
     * @type {[MicrosoftAuthorizationFlow]}
     */
    static flows = []

    /**
     * Creates a new Microsoft Authorization Flow
     * @param onAbort The function to be called if the flow is aborted during the
     * user-input-phase (step #1)
     */
    constructor(onAbort) {
        this.onAbort = onAbort
        MicrosoftAuthorizationFlow.flows.push(this)
    }

    /**
     * Opens a new window in which the user can log in to their Microsoft account and grant
     * the Launcher access via OAuth.
     *
     * @returns {Promise<unknown>}
     * @public
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
            show: false,
        })

        this.window = microsoftLoginWindow

        return new Promise(async (resolve, reject) => {
            microsoftLoginWindow.webContents.once("did-finish-load", () => {
                microsoftLoginWindow.show()
            })

            microsoftLoginWindow.on("close", () => {
                MicrosoftAuthorizationFlow.flows.splice(MicrosoftAuthorizationFlow.flows.indexOf(this), 1)
                if (this.isControlledClose) return

                console.log("> Aborting Microsoft OAuth Flow...")
                this.onAbort()
                reject(null)
            })

            microsoftLoginWindow.webContents.on("will-redirect", async (event, data) => {
                const url = new URL(data)

                if (url.host === "login.live.com" && url.pathname === "/oauth20_desktop.srf") {
                    if (url.searchParams.has("code")) {
                        const code = url.searchParams.get("code")
                        console.log("> [#1] Microsoft Authorization Code received:", code)

                        this.isControlledClose = true
                        event.preventDefault()
                        microsoftLoginWindow.close()

                        await this.acquireAuthorizationToken(code)
                        resolve()
                    } else if (url.searchParams.has("error")) {
                        const error = url.searchParams.get("error")
                        console.log("! [#1] Error during Microsoft OAuth Login:", error) // can be "access_denied"

                        this.isControlledClose = true
                        event.preventDefault()
                        microsoftLoginWindow.close()

                        reject(error)
                    }
                }
            })

            await microsoftLoginWindow.webContents.session.clearCache()
            await microsoftLoginWindow.webContents.session.clearAuthCache()
            await microsoftLoginWindow.webContents.session.clearStorageData()

            const loginUrl = formatString(MICROSOFT_OAUTH_LOGIN_URL, {
                client_id: CLIENT_ID,
                redirect_uri: REDIRECT_URI,
            })

            await microsoftLoginWindow.loadURL(loginUrl)
        })
    }

    /**
     * Acquires a Microsoft OAuth Token from the {@link code} parameter representing
     * the Microsoft OAuth Code that was exposed to the launcher in
     * {@link promptMicrosoftOAuthLogin step #1}.
     *
     * Exposes {@link microsoftOAuthRefreshToken} on the class object.
     *
     * @param code {string}
     * @returns {Promise<void>}
     * @private
     */
    async acquireAuthorizationToken(code) {
        console.log("> [#2] Acquiring Microsoft OAuth Token...")

        const requestData = {
            redirect_uri: "https://login.live.com/oauth20_desktop.srf",
            code: code,
            client_id: CLIENT_ID,
            scope: "service::user.auth.xboxlive.com::MBI_SSL",
            grant_type: "authorization_code",
        }

        try {
            const urlEncoded = qs.stringify(requestData)

            const response = await axios.post(
                MICROSOFT_OAUTH_TOKEN_URL,
                urlEncoded,
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                },
            )

            const { access_token: accessToken, refresh_token: refreshToken } = response.data

            /**
             * Holds the refresh token for the Microsoft OAuth connection.
             * @type {string}
             */
            this.microsoftOAuthRefreshToken = refreshToken

            console.log(`> [#2] Received access token and refresh token`)
            await this.authenticateXboxLive(accessToken)
        } catch (e) {
            console.log("! [#2] Error while acquiring Microsoft OAuth Token:", e)
            this.error = e
        }
    }

    /**
     * Requests an Xbox Live Authentication Token using the previously acquired
     * {@link accessToken Microsoft OAuth Token} from
     * {@link acquireAuthorizationToken step #2}.
     *
     * @param accessToken {string}
     * @returns {Promise<void>}
     * @private
     */
    async authenticateXboxLive(accessToken) {
        console.log("> [#3] Authenticating with Xbox Live...")

        try {
            const body = {
                "Properties": {
                    "AuthMethod": "RPS",
                    "SiteName": "user.auth.xboxlive.com",
                    "RpsTicket": accessToken,
                },
                "RelyingParty": "http://auth.xboxlive.com",
                "TokenType": "JWT",
            }
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    "Accepts": "application/json",
                },
            }

            const response = await axios.post(XBOX_LIVE_AUTHENTICATION_URL, body, config)
            const responseData = response.data

            const xblToken = responseData["Token"]
            const uhs = responseData["DisplayClaims"]["xui"][0]["uhs"]

            console.log(`> [#3] Received Xbox Live Token and UHS`)
            await this.authenticateXSTS(xblToken, uhs)
        } catch (e) {
            console.log("! [#3] Error while authenticating with Xbox Live:", e)
            this.error = e
        }
    }

    /**
     * Requests an XSTS Authorization Token using the previously acquired
     * {@link xblToken Xbox Live Token} from {@link authenticateXboxLive step #3}.
     *
     * Exposes {@link hasXboxAccount} on the class object.
     *
     * @param xblToken {string}
     * @param uhs {string}
     * @returns {Promise<void>}
     * @private
     */
    async authenticateXSTS(xblToken, uhs) {
        console.log("> [#4] Authorizing with XSTS...")

        try {
            const body = {
                "Properties": {
                    "SandboxId": "RETAIL",
                    "UserTokens": [
                        xblToken,
                    ],
                },
                "RelyingParty": "rp://api.minecraftservices.com/",
                "TokenType": "JWT",
            }
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    "Accepts": "application/json",
                },
            }

            const response = await axios.post(XSTS_AUTHORIZATION_URL, body, config)
            const responseData = response.data

            if (response.status === 401) {
                console.log("> [#4] The Microsoft Account is not linked to an Xbox Account!")
                this.hasXboxAccount = false
                return
            }

            const xstsToken = responseData["Token"]

            /**
             * - True if the Microsoft Account is linked to an Xbox Account and
             * an XSTS token could be successfully generated.
             * - False if an error occurred during the generation of the XSTS
             * token which means that there is no Xbox Account on the Microsoft
             * Account.
             * - Undefined if step #4 wasn't executed.
             *
             * @type {boolean}
             */
            this.hasXboxAccount = true

            console.log("> [#4] Received XSTS Token")
            await this.authenticateMinecraftServices(xstsToken, uhs)
        } catch (e) {
            console.log("! [#4] Error while authenticating with XSTS:", e)
            this.error = e
        }
    }

    /**
     * Finally, logs into the Minecraft Services with the {@link xstsToken XSTS Token}
     * from {@link authenticateXSTS step #4} and the {@link uhl} from
     * {@link authenticateXboxLive step #3}.
     *
     * Exposes {@link minecraftToken} on the class object.
     *
     * @param xstsToken {string}
     * @param uhl {string}
     * @returns {Promise<void>}
     * @private
     */
    async authenticateMinecraftServices(xstsToken, uhl) {
        console.log("> [#5] Authenticating with Minecraft Services...")

        try {
            const body = {
                "IdentityToken": `XBL3.0 x=${uhl};${xstsToken}`,
            }
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    "Accepts": "application/json",
                },
            }

            const response = await axios.post(MC_SERVICES_AUTHENTICATION_URL, body, config)
            const responseData = response.data

            const minecraftToken = responseData["access_token"]

            /**
             * Holds the Minecraft Access Token (a JWT) to login to Minecraft using the
             * Microsoft Account. Note that this does not prove that this account owns
             * Minecraft since the token is also present if this is not the case.
             *
             * @type {string}
             * @public
             */
            this.minecraftToken = minecraftToken

            console.log("> [#5] Received Minecraft Token")
            await this.loadMinecraftProfile(minecraftToken)
        } catch (e) {
            console.log("! [#5] Error while authenticating with Minecraft Services:", e)
            this.error = e
        }
    }

    /**
     * Fetches the Minecraft Profile from the Minecraft Services to get account information
     * like UUID, skin and username while also checking if the Microsoft Account actually
     * owns Minecraft.
     *
     * Exposes {@link ownsMinecraft} and {@link minecraftProfile} on the class object.
     *
     * @param minecraftToken {string} The Minecraft Access Token from
     * {@link authenticateMinecraftServices step #5}
     * @returns {Promise<void>}
     * @private
     */
    async loadMinecraftProfile(minecraftToken) {
        console.log("> [#6] Loading Minecraft Profile...")

        const config = {
            headers: {
                "Authorization": "Bearer " + minecraftToken,
                "Accept": "application/json",
            },
        }

        await axios.get(MC_SERVICES_PROFILE_URL, config)
            .then(response => {
                const responseData = response.data
                const profile = {
                    id: responseData.id,
                    name: responseData.name,
                    skins: responseData.skins,
                }

                console.log("> [#6] Loaded Minecraft Profile")

                /**
                 * - True if Minecraft is owned by the Microsoft Account.
                 * - False if step #6 has proven that this is not the case.
                 * - Undefined if step #6 wasn't executed.
                 *
                 * @type {boolean}
                 * @public
                 */
                this.ownsMinecraft = true

                /**
                 * Contains information about the Minecraft Account that is linked to the
                 * authenticated Microsoft account.
                 *
                 * @type {{skins: [*], name: string, id: string}}
                 * @public
                 */
                this.minecraftProfile = profile
            }).catch(async error => {
                if (error.response.status === 404) {
                    console.log("> [#6] The Microsoft Account doesn't own Minecraft")

                    this.ownsMinecraft = false
                } else {
                    console.log("! [#6] Error while loading Minecraft Profile:", error)
                    this.error = error
                }
            })
    }
}

/**
 * Formats the given input string by replacing all placeholders inside of the string
 * with the corresponding values on the replacements object.
 *
 * For example: %NAME% -> replacements.name
 */
function formatString(input, replacements) {
    return input.replace(/%\w+%/g, function(all) {
        return replacements[all.replaceAll("%", "").toLowerCase()] || all
    })
}

module.exports = {
    startAuthorizationFlow,
    abortAll
}