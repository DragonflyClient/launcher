const minecraftFacts = [
    "Minecraft Facts Infographics",
    "The survival mode is one of the main modes in Minecraft.",
    "The creative mode gives players freedom.",
    "There are 107 Minecraft achievements in the game.",
    "The 'blocks' are used to create building structures.",
    "The Hostile Mobs of Minecraft are the main antagonist.",
    "The primary dimension of Minecraft is the Overworld.",
    "The landscape of Minecraft is called Biomes.",
    "The Nether is a dimension outside the world of Minecraft.",
    "The End is the final Biome to explore in Minecraft.",
    "Enderman is a three-block-tall mob that brings chaos in the game.",
    "The Ender Dragon of Minecraft attacks and destroys the blocks.",
    "Dragon Egg is an egg-shaped block that serves as a trophy and decoration.",
    "Watch out for the three-headed Wither Boss of Minecraft.",
    "Minecraft has an adventure mode.",
    "You only get one chance in the hardcore mode of Minecraft.",
    "You can just be a spectator through the spectator mode.",
    "Play with your friends through the multiplayer mode.",
    "Daniel Rosenfeld produced the music of Minecraft.",
    "Minecraft has a wide range of devices play from.",
    "Minecraft has a Chinese version.",
    "The story mode of Minecraft is developed by Telltale Games.",
    "Minecraft is with Netflix as an interactive show.",
    "Minecraft stimulates the creativity of its players.",
    "Minecraft is for everyone!",
    "Minecraft can build the social skills of kids.",
    "People who play video games that promote cooperation are more likely to be helpful.",
    "Minecraft sharpens the problem-solving skills of its players.",
    "The players can apply Minecraft's resource management in real life.",
    "Playing Minecraft improves the player's geometric skills.",
    "Minecraft has 'peaceful mode' making the game suitable for toddlers.",
    "The simplicity of Minecraft is the core ingredient of its success.",
    "176 million people have purchased Minecraft.",
    "The cost to play Minecraft is around $7 to $30.",
    "US is the #1 country that plays Minecraft.",
    "One Minecraft day is equivalent to 20 minutes.",
    "It takes around 1 GB on average to install Minecraft.",
    "Minecraft only took 6 days to create its first full version.",
    "Minecraft's creation was inspired by other games.",
    "The Creepers (iconic hostile mob) started as a coding error.",
    "The Enderman has 'Enderian Language'.",
    "The Ghast mob of Minecraft is the second-largest mob in the game.",
    "The voice of the Ghast mob came from a cat.",
    "Minecraft is a mandatory curriculum in Viktor Rydberg School.",
    "Markus Persson expressed his desire to sell the company through Twitter.",
    "Markus Persson wanted to move on with his life.",
    "Here are Markus Persson's most famous tweets.",
    "After selling Minecraft, Markus Persson bought a $70 million mansion in Beverley Hills.",
    "Minecraft's creator became a victim of a celebrity death hoax on social media.",
    "Creating a ship in Minecraft represents the player…technical ability to create large-scale projects.",
    "Bridges in Minecraft is necessary if the player's home is near the water.",
    "Creating a dam serves a double purpose. It's attractive and it bridges the gaps.",
    "Creating a garden in Minecraft is one of the most basic things you can do.",
    "Creating trees in Minecraft uplifts the environment's appearance.",
    "Creating a windmill in Minecraft is a satisfying experience.",
    "Trucks or cars are one of the most important things to build in Minecraft.",
    "Owning your dream castle is achievable in Minecraft!",
    "Building your mansion should also be at the top of your list.",
    "Who wants a mansion without a swimming pool?",
    "Minecraft's treehouse is for nature lovers.",
    "Blocks are mined in Minecraft for construction purposes.",
    "Wood is the most common raw material.",
    "Crops need water as well in Minecraft.",
    "Minecraft has a Nether Wart crop from the soul land.",
    "Smooth stones are also abundant in Minecraft.",
    "Players can explore the desert, lake, and beach biomes if they need sand.",
    "Players need to dive underwater to mine clay.",
    "Smelting is a procedure of assembling refined goods.",
    "Players should use fire protection potions or enchantments if they need to mine the lava.",
    "Players need tools for development and efficient gaming.",
    "Players use the tool flint and steel to light fires in Minecraft.",
    "Pickaxes enable the player to mine blocks at a much better phase.",
    "A hoe is a useful tool for cultivation.",
    "Aхе is the best tool to use break logs and blocks.",
    "Shovels are the best for digging around.",
    "Compass points to the player's spawn point.",
    "A fishing rod can hook treasure items.",
    "The clocks illustrate the current in-game time.",
    "Iron Ingot is the only material that can make a shear.",
    "Buckets are useful and versatile in Minecraft.",
    "A ladder is a good tool for high place exploration and to hide from hostile mobs.",
    "A Piston can't push obsidian or bedrock blocks​.",
    "Crouching can lower the chance of poisoning.",
    "Drinking milk or honey bottle can cure the poison.",
    "Here are the different purposes of campfire, furnace, and smoker.",
    "Minecraft improved the aesthetics of the cow.",
    "When fighting, critical hits come from falling.",
    "Crafting table was once called 'workbench'.",
    "The first Enderman originally had green eyes.",
    "As Minecraft grew, so did its strongholds.",
    "Zombies are safe in the cobweb in the daytime.",
    "Carpet and farm fence is a great defensive move against hostile mobs.",
    "Food is not stackable in the early days.",
    "Players should kill a zombie pigman in just one hit.",
    "The passive mob of Minecraft is harmless.",
    "Hostile mobs are aggressive and dangerous.",
    "Players can have a pet in Minecraft!",
    "Neutral mobs only attack the players when they are provoked.",
    "The Boss mobs are the most powerful in Minecraft.",
    "Utility mobs serve as a protection against the hostile mobs.",
    "Cave Game is the first name of Minecraft.",
]

const randomFact = document.getElementById("random-fact")

randomFact.innerText = minecraftFacts[Math.floor(Math.random() * minecraftFacts.length)]

/* #region Handle auto-updating */
const updaterNotification = document.getElementById("updater-notification")
const updaterMessage = document.getElementById("updater__message")
const updaterRestartButton = document.getElementById("updater__restart-button")

// handle update available
ipcRenderer.on("update_available", () => {
    console.log("> An update for the Dragonfly Launcher is available")
    ipcRenderer.removeAllListeners("update_available")
    updaterMessage.innerText = "A new update is available. Downloading now..."
    updaterNotification.classList.remove("hidden")
})

// handle update download
ipcRenderer.on("update_downloaded", () => {
    console.log("> The update for the Dragonfly Launcher has been downloaded")
    ipcRenderer.removeAllListeners("update_downloaded")
    updaterMessage.innerText = "Update Downloaded. It will be installed on restart. Restart now?"
    updaterRestartButton.classList.remove("hidden")
    updaterNotification.classList.remove("hidden")
})

// Receive current app version
ipcRenderer.send("app_version")
ipcRenderer.on("app_version", (event, arg) => {
    ipcRenderer.removeAllListeners("app_version")
    document.title = "Dragonfly Launcher v" + arg.version
})

// check for updates
ipcRenderer.send("check_for_updates")
ipcRenderer.on("check_for_updates", (event, arg) => {
    console.log("Checked for updates.")
})

ipcRenderer.on("update_progress", (event, arg) => {
    document.querySelector(".updater__border").style.width = arg
})

/* #endregion */
