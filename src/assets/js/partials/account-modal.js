const microsoftAuth = require("../utilities/ms-auth.js")
const minecraft = require("../utilities/minecraft.js")

const text = document.getElementsByClassName("text")[0]
const full = document.getElementsByClassName("full-button")[0]

const left = document.getElementsByClassName("left")[0]
const right = document.getElementsByClassName("right")[0]

const textParts = Array.from(document.getElementsByClassName("text-part"))
const imageParts = Array.from(document.getElementsByClassName("img-part"))

const footer = document.getElementById("account-modal-footer")

const LOADING_ANIMATION = `
    <div class="sk-chase account-modal-animation">
        <div class="sk-chase-dot"></div>
        <div class="sk-chase-dot"></div>
        <div class="sk-chase-dot"></div>
        <div class="sk-chase-dot"></div>
        <div class="sk-chase-dot"></div>
        <div class="sk-chase-dot"></div>
    </div>
`

full.addEventListener("click", () => {
    text.style.transform = "translate(-50%, -100px)"
    setTimeout(() => {
        full.classList.remove("collapsed")
        full.style.cursor = "default"
        full.style.transition = "none"

        left.style.marginRight = "30px"
        left.style.backgroundColor = "#7CBB00"
        right.style.backgroundColor = "#00A1F1"

        textParts.forEach(it => {
            it.style.opacity = "100%"
            it.style.transform = "scale(1)"
        })

        setTimeout(() => {
            imageParts.forEach(it => {
                it.style.opacity = "1"
                it.style.transform = "translate(0)"
            })
        }, 50)

        left.style.borderRadius = "var(--radius)"
        right.style.borderRadius = "var(--radius)"
        left.addEventListener("click", addMinecraftAccount)
        right.addEventListener("click", addMicrosoftAccount)

        setTimeout(() => {
            text.style.display = "none"
        }, 200)

    }, 100)
})

function addMicrosoftAccount() {
    if (right.getAttribute("disabled") === "true") {
        console.log("Skip")
        return
    }

    clearStatus()

    right.setAttribute("disabled", "true")
    right.innerHTML = LOADING_ANIMATION

    microsoftAuth.startAuthorizationFlow(() => {
        finishMicrosoftLogin()
    }).then(acc => {
        minecraft.addAccount({
            type: "microsoft",
            accessToken: acc.minecraftToken,
            profile: {
                uuid: acc.profile.id,
                username: acc.profile.name,
            },
        })

        finishMicrosoftLogin()
        showStatus(
            `Minecraft account <b>${acc.profile.name}</b> has been successfully added to the Account Manager.`,
            100
        )
    }).catch(error => {
        finishMicrosoftLogin()
        showStatus(error.message, 140)
    })
}

function showStatus(message, height) {
    footer.style.height = `${height}px`
    footer.style.paddingTop = "20px"
    footer.style.paddingBottom = "30px"
    footer.innerHTML = `
        <div id="status">
            ${message}
        </div>
    `

    setTimeout(() => {
        document.getElementById("status").style.opacity = "1"
    }, 200)
}

function clearStatus() {
    const statusElement = document.getElementById("status")
    if (statusElement) statusElement.style.opacity = "0"

    setTimeout(() => {
        footer.style.height = "0"
        footer.style.paddingTop = "0"
        footer.style.paddingBottom = "25px"
        footer.innerHTML = ""
    }, 200)
}

function finishMicrosoftLogin() {
    right.setAttribute("disabled", "false")
    right.innerHTML = `
        <img class="img-part" src="https://www.flaticon.com/svg/static/icons/svg/732/732221.svg" alt=""
            style="opacity: 1; transform: scale(1)">
        <a class="text-part" style="opacity: 1; transform: scale(1)">Microsoft</a>
    `
}

function addMinecraftAccount() {
}