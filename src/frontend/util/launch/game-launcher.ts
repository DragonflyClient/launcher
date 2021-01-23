import { ChildProcess, exec } from "child_process"
import os from "os"
import fs from "fs"
// @ts-ignore
import AdmZip from "adm-zip"
// @ts-ignore
import request from "request"
// @ts-ignore
import mkdirp from "mkdirp"
// @ts-ignore
import xml2js from "xml2js"
import Swal from "sweetalert2"
import axios from "axios"
import crypto from "crypto"
import path from "path"
import fse from "fs-extra"
import { ipcRenderer, remote } from "electron"
const { app } = remote

import LogParser from "./log-parser"
import GlobalContext from "../../../shared/global-context"
import { MinecraftAuth } from "../minecraft-auth"
import { openGames } from "./launch"
import { ensureDirectoryExistence, rootPath } from "../../../shared/path"
import GameObject from "./game-object"
import Edition from "../edition"
import VersionConfiguration from "./version-configuration"

export default class GameLauncher {
    private readonly targetVersion: string
    private readonly targetOptifineVersion: string
    private readonly targetOptifineName: string

    private javaRuntime: string
    private javaExe: string
    private minecraftDir: string
    private versionDir: string
    private optifineVersionDir: string
    private jsonFile: string
    private jarFile: string
    private uuid: string
    private name: string
    private accessToken: string
    private json: VersionConfiguration
    private classPathArgument: string
    private assetsIndex: string
    private assetsDir: string
    private logFile: string
    private gameProcess: ChildProcess
    private openGameOutput: boolean
    private gameObject: GameObject

    constructor(private readonly targetEdition: Edition, private readonly finishCallback: () => void) {
        this.targetVersion = targetEdition.minecraftVersion
        this.targetOptifineVersion = targetEdition.optifineVersion
        this.targetOptifineName = `${targetEdition.minecraftVersion}-OptiFine_${targetEdition.optifineVersion}`
    }

    async downloadJava() {
        const installationDirectory = rootPath(app.getAppPath())
        const localDirectory = installationDirectory + "\\jre"

        const githubRelease = "https://github.com/AdoptOpenJDK/openjdk11-binaries/releases/download/jdk-11.0.9.1%2B1"
        const versionX64 = "OpenJDK11U-jre_x64_windows_hotspot_11.0.9.1_1.zip"
        const versionX32 = "OpenJDK11U-jre_x86-32_windows_hotspot_11.0.9.1_1.zip"

        const arch = os.arch()
        let targetVersion

        if (arch === "x64") {
            targetVersion = versionX64
        } else if (arch === "x32") {
            targetVersion = versionX32
        } else throw "CPU architecture is not supported!"

        const url = githubRelease + "/" + targetVersion
        const localZip = localDirectory + "\\" + targetVersion

        this.javaRuntime = localDirectory + "\\jdk-11.0.9.1+1-jre"
        this.javaExe = this.javaRuntime + "\\bin\\javaw.exe"

        try {
            if (fs.existsSync(this.javaExe)) {
                return console.log("> Java is installed")
            }
        } catch (e) {}

        console.log("> Download Java from: " + url)

        mkdirp.sync(localDirectory)
        await this.downloadFile(localZip, url)

        new AdmZip(localZip).extractAllTo(localDirectory)

        console.log("> Java has been downloaded!")
    }

    prepareVersion() {
        // select Minecraft directory
        const targetVersion = this.targetVersion
        const targetOptifineName = this.targetOptifineName
        const targetOptifineVersion = this.targetOptifineVersion
        const appData = process.env.APPDATA
        const minecraftDir = appData + "\\.minecraft"

        this.minecraftDir = minecraftDir

        console.log(`== Starting version ${targetVersion} ==`)
        console.log("> Optifine version: " + targetOptifineName)
        console.log("> Minecraft home: " + minecraftDir)

        // select version directory + JAR/JSON files
        this.versionDir = minecraftDir + `\\versions\\${targetVersion}`
        this.optifineVersionDir = minecraftDir + `\\versions\\${targetOptifineName}`
        this.jsonFile = this.versionDir + `\\${targetVersion}.json`
        this.jarFile = this.optifineVersionDir + `\\${targetOptifineName}.jar`

        // check if version is downloaded
        if (
            !ensureDirectoryExistence(this.versionDir, false, "file") ||
            !ensureDirectoryExistence(this.optifineVersionDir, false, "file") ||
            !fs.existsSync(this.jsonFile) ||
            !fs.existsSync(this.jarFile)
        ) {
            console.log("! Version not installed, abandoning...")
            console.log(targetOptifineVersion)
            Swal.fire({
                title: `Cannot launch ${targetVersion}!`,
                html:
                    `Please make sure to download and run Minecraft ${targetVersion} from the Minecraft Launcher first. ` +
                    `Additionally OptiFine ${targetOptifineVersion} must be installed which can be downloaded on ` +
                    `<a href="https://www.optifine.net">optifine.net</a>.`,
                // TODO: Open link externally
                icon: "error",
                confirmButtonText: "Okay",
            })
            throw "version_not_installed"
        }

        console.log(`> Launching JAR file ${this.jarFile}`)
        console.log(`> Configuring with JSON file ${this.jsonFile}`)
    }

    async downloadDragonfly() {
        if (((global as unknown) as GlobalContext).developerMode) {
            return console.log("> Skipping Dragonfly download due to developer mode being enabled")
        }

        try {
            const files = (await axios.get("https://api.playdragonfly.net/v1/client/files")).data
            console.log("> Downloading Dragonfly files (" + files.length + ")")

            for (let file of files) {
                console.log("  + " + file)

                const local = this.minecraftDir + "\\dragonfly\\" + file.replaceAll("/", "\\")
                const url = "https://cdn.icnet.dev/dragonfly/client/" + file
                const checksumUrl = url + ".sha1"

                try {
                    const content = fs.readFileSync(local)
                    const localHash = crypto.createHash("sha1").update(content).digest("hex")
                    const checksum = await (await axios.get(checksumUrl)).data.split(" ")[0]

                    if (localHash === checksum) {
                        continue
                    }
                } catch (e) {}

                console.log("    Downloading from " + url + "...")

                mkdirp.sync(path.dirname(local))
                await this.downloadFile(local, url)

                console.log("    Finished")
            }
        } catch (e) {
            console.log("> Couldn't download Dragonfly files")
        }
    }

    downloadFile(local: string, url: string) {
        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(local)
            request(url).pipe(writer)
            writer.on("finish", () => resolve(undefined))
            writer.on("error", err => reject(err))
        })
    }

    async setupAccount() {
        function throwError(): never {
            Swal.fire({
                title: `Unauthenticated`,
                text: `Please make sure to login with a Minecraft or Mojang account before starting the game.`,
                icon: "error",
                confirmButtonText: "Okay",
            })
            throw "unauthenticated"
        }

        let account = MinecraftAuth.getCurrentAccount()
        if (account == null) throwError()

        const accountIdentifier = MinecraftAuth.getCurrentAccountIdentifier()!!

        try {
            await MinecraftAuth.refreshToken(accountIdentifier)
            account = MinecraftAuth.getCurrentAccount()!!
            console.log(`> Refreshed account token of ${account.profile.username}`)
        } catch (error) {
            console.log(`! Could not refresh account token`)
        }

        this.uuid = account.profile.uuid
        this.name = account.profile.username
        this.accessToken = account.accessToken

        console.log(`> Setting up user ${this.name} (UUID: ${this.uuid})`)
    }

    parseJsonConfiguration() {
        this.json = JSON.parse(fs.readFileSync(this.jsonFile).toString())
    }

    loadLibraries() {
        const libraries = this.json.libraries.filter(e => e.name)
        libraries.push({ name: `optifine:OptiFine:${this.targetVersion}_${this.targetOptifineVersion}` })
        libraries.push({ name: "optifine:launchwrapper-of:2.2" })
        // TODO: OptiFine Launch Wrapper 2.2 is not shipped with OF1.8.9_HD_U_L5

        const libraryPaths = libraries.map(e => {
            const [group, artifact, version] = e.name.split(":")
            const groupPath = group.replaceAll(".", "\\")
            return `libraries\\${groupPath}\\${artifact}\\${version}\\${artifact}-${version}.jar`
        })
        libraryPaths.push("dragonfly\\injection\\dragonfly-core.jar")
        libraryPaths.push(`dragonfly\\injection\\injection-hook-${this.targetVersion}.jar`)
        libraryPaths.push(this.jarFile)

        this.classPathArgument = libraryPaths.join(";")
        console.log(`> Including ${libraryPaths.length} libraries`)
    }

    loadNatives() {
        // parse natives from JSON
        const nativesFromJson = this.json.libraries
            .filter(e => e.downloads?.classifiers?.["natives-windows"])
            .map(e => e.downloads!!.classifiers!!["natives-windows"])
        const extractionDir = `${this.minecraftDir}\\dragonfly\\tmp\\natives_extract`
        const targetDir = `${this.minecraftDir}\\dragonfly\\natives-${this.targetVersion}`

        this.recreateDirectory(extractionDir)

        // extract natives
        nativesFromJson.forEach(native => {
            if (!native) return

            const file = `${this.minecraftDir}\\libraries\\${native.path.replaceAll("/", "\\")}`
            const simpleName = native.path.split("/")[native.path.split("/").length - 1]

            if (!fs.existsSync(file)) return console.log("> Unable to find native file " + simpleName)
            const copied = `${extractionDir}\\${simpleName.replaceAll(".jar", ".zip")}`
            fs.copyFileSync(file, copied)

            new AdmZip(copied).extractAllTo(extractionDir)

            fs.unlinkSync(copied)
            fs.rmdirSync(`${extractionDir}\\META-INF\\`, { recursive: true })
        })

        // compare extracted natives
        if (fs.existsSync(targetDir)) {
            const extractedContent = fs.readdirSync(extractionDir)
            const targetContent = fs.readdirSync(targetDir)
            const upToDate = extractedContent.every((value, index) => targetContent[index] === value)
            if (upToDate) {
                console.log("> Natives are up to date")
                this.deleteDirectory(extractionDir)
                return
            }
        }

        // move to target directory if not up to date
        this.deleteDirectory(targetDir)
        fse.moveSync(extractionDir, targetDir, { overwrite: true })
        this.deleteDirectory(extractionDir)
    }

    recreateDirectory(dir: string) {
        this.deleteDirectory(dir)
        fs.mkdirSync(dir, { recursive: true })
    }

    deleteDirectory(dir: string) {
        if (fs.existsSync(dir)) {
            fs.rmdirSync(dir, { recursive: true })
        }
    }

    loadAssets() {
        this.assetsIndex = this.json.assets
        this.assetsDir =
            this.assetsIndex !== "legacy"
                ? `${this.minecraftDir}\\assets`
                : `${this.minecraftDir}\\assets\\virtual\\legacy`
        console.log(`> Assets index: ${this.assetsIndex}`)
        console.log(`> Assets directory: ${this.assetsDir}`)
    }

    loadLogConfiguration() {
        this.logFile = this.json.logging.client.file.id
        console.log("> Log configuration: " + this.logFile)
    }

    compileMappings() {
        console.log("> Compiling mappings")
        return new Promise(resolve => {
            const process = exec(
                `"${this.javaExe}" -jar dragonfly\\bin\\mapping-index-compiler.jar ` +
                    `--version ${this.targetVersion} ` +
                    `--temp-dir "dragonfly\\tmp\\mappings-index-compiler-${this.targetVersion}" ` +
                    `--destination-dir "dragonfly\\mappings\\${this.targetVersion}"`,
                {
                    cwd: this.minecraftDir,
                }
            )

            process.stdout!!.on("data", data => console.log(data))
            process.stderr!!.on("data", data => console.error(data))
            process.on("close", () => resolve(undefined))
        })
    }

    executeCommand() {
        const mainClass = "net.minecraft.launchwrapper.Launch"
        const agentArgs = [
            `-v ${this.targetVersion}`,
            `-i net.dragonfly.core.DragonflyCore`,
            `-i ${this.targetEdition.injectionHook}`,
        ]
        const jvmArgs = [
            `-javaagent:dragonfly/injection/agent-shared.jar="${agentArgs.join(" ")}"`,
            `-Djava.library.path=dragonfly\\natives-${this.targetVersion}`,
            `-Dlog4j.configurationFile=dragonfly\\log-configs\\${this.logFile}`,
            `-cp ${this.classPathArgument}`,
        ]
        const programArgs = {
            version: this.targetVersion,
            assetsDir: this.assetsDir,
            assetIndex: this.assetsIndex,
            accessToken: this.accessToken,
            uuid: this.uuid,
            username: this.name,
            userType: "mojang",
            tweakClass: "optifine.OptiFineTweaker",
            gameDir: this.minecraftDir,
        }

        const command = this.buildCommand(jvmArgs, programArgs, mainClass)

        this.gameProcess = exec(command, { cwd: this.minecraftDir })
    }

    buildCommand(jvmArgs: string[], programArgs: { [key: string]: string }, mainClass: string) {
        let command = `"${this.javaExe}"`
        command += " "
        command += jvmArgs.join(" ")
        command += " "
        command += mainClass
        command += " "
        command += Object.keys(programArgs)
            .map(key => `--${key} ${programArgs[key]}`)
            .join(" ")
        return command
    }

    handleGameStart() {
        this.openGameOutput = (document.getElementById("open-game-output") as HTMLInputElement)?.checked ?? true

        this.gameObject = {
            gameVersion: this.targetVersion,
            playerUUID: this.uuid,
            pid: this.gameProcess.pid,
        }

        openGames.push(this.gameObject)
        console.log("> Open games: ", openGames)
        console.log("> Game object: ", this.gameObject)
        ipcRenderer.send("open-game", { openGames: openGames, gameObject: this.gameObject })
        if (this.openGameOutput) ipcRenderer.send("open-game-output", this.gameObject)

        console.log(`> Game startup (${openGames.length} running)`)
        setTimeout(this.finishCallback, 4000)
    }

    async enableLogging() {
        if (!this.openGameOutput) return

        const xmlParser = new xml2js.Parser()
        const logParser = new LogParser(xmlParser, this.gameObject)

        // noinspection ES6MissingAwait
        logParser.readStdout(this.gameProcess.stdout!!)
        // noinspection ES6MissingAwait
        logParser.readStderr(this.gameProcess.stderr!!)
    }

    handleGameClose() {
        const closeGameOutput = (document.getElementById("close-game-output") as HTMLInputElement)?.checked ?? false
        const command = this.gameProcess

        command.on("close", () => {
            const closedGameObject = openGames.find(game => game.pid === command.pid)!!
            openGames.splice(openGames.indexOf(closedGameObject), 1)
            ipcRenderer.send("game-closed", {
                openGames: openGames,
                closedGameObject: closedGameObject,
                closeGameOutput: closeGameOutput,
            })

            console.log(`> Game closed (${openGames.length} running)`)
        })
    }
}
