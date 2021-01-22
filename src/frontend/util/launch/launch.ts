import Edition from "../edition"
import GameObject from "./game-object"
import GameLauncher from "./game-launcher"

// the edition that is selected by the user
let edition: Edition

// array of running games
export const openGames: GameObject[] = []

export function setEdition(editionIn: Edition) {
    edition = editionIn
    console.log("* User changed to edition " + edition.title + " for Minecraft " + edition.minecraftVersion)
}

export async function startGame(setStatus: (status: string) => void, finishCallback: () => void) {
    const launcher = new GameLauncher(edition, finishCallback)

    setStatus("Downloading Java")
    await launcher.downloadJava()

    setStatus("Preparing version")
    launcher.prepareVersion()

    setStatus("Setting up account")
    await launcher.setupAccount()

    setStatus("Downloading Dragonfly")
    await launcher.downloadDragonfly()

    setStatus("Parsing JSON configuration")
    launcher.parseJsonConfiguration()

    setStatus("Loading libraries")
    launcher.loadLibraries()

    setStatus("Loading native libraries")
    launcher.loadNatives()

    setStatus("Loading assets")
    launcher.loadAssets()

    setStatus("Loading log configuration")
    launcher.loadLogConfiguration()

    setStatus("Compiling mapping indices")
    await launcher.compileMappings()

    setStatus("Launching game")
    launcher.executeCommand()

    launcher.handleGameStart()
    launcher.handleGameClose()
    launcher.enableLogging()
}

