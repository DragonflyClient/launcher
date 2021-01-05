const microsoftAuth = require("../utilities/ms-auth.js")
const minecraftAuth = require("../utilities/minecraft.js")

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

    clearFooter()

    right.setAttribute("disabled", "true")
    right.innerHTML = LOADING_ANIMATION

    microsoftAuth.startAuthorizationFlow(() => {
        finishMicrosoftLogin()
    }).then(acc => {
        minecraftAuth.addAccount({
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
            100,
        )
    }).catch(error => {
        finishMicrosoftLogin()
        showStatus(error.message, 140)
    })
}

function addMinecraftAccount() {
    if (document.getElementById("mojang-form")) {
        clearFooter()
    } else {
        showMojangFields()
    }
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
    }, 150)
}

function finishMicrosoftLogin() {
    right.setAttribute("disabled", "false")
    right.innerHTML = `
        <img class="img-part" src="https://www.flaticon.com/svg/static/icons/svg/732/732221.svg" alt=""
            style="opacity: 1; transform: scale(1)">
        <a class="text-part" style="opacity: 1; transform: scale(1)">Microsoft</a>
    `
}

function showMojangFields() {
    footer.style.height = `230px`
    footer.style.paddingTop = "20px"
    footer.style.paddingBottom = "30px"
    footer.innerHTML = `
        <form id="mojang-form">
            <p class="mojang-form-info">Enter your Mojang account credentials</p>
            <div class="mojang-form-item">
                <input class="mojang-field" id="mojang-email" name="email" placeholder="Email Address" spellcheck="false" type="text"/>
                <div class="input-border"></div>
            </div>
            <div class="mojang-form-item">
                <input class="mojang-field" id="mojang-password" name="password" placeholder="Password" type="password"/>
                <div class="input-border"></div>
            </div>
            <button id="mojang-form-submit" type="submit">Login</button>
        </form>
    `
    setTimeout(() => {
        const formElement = document.getElementById("mojang-form")

        formElement.style.opacity = "1"
        formElement.onsubmit = submitMojangForm
    }, 150)
}

function clearFooter() {
    const statusElement = document.getElementById("status")
    const mojangFormElement = document.getElementById("mojang-form")
    if (statusElement) statusElement.style.opacity = "0"
    if (mojangFormElement) mojangFormElement.style.opacity = "0"

    setTimeout(() => {
        footer.style.height = "0"
        footer.style.paddingTop = "0"
        footer.style.paddingBottom = "25px"
        footer.innerHTML = ""
    }, 150)
}

function submitMojangForm(event) {
    const formElement = document.getElementById("mojang-form")
    const submitButton = document.getElementById("mojang-form-submit")
    const infoElement = document.getElementsByClassName("mojang-form-info")[0]
    const passwordElement = document.getElementById("mojang-password")

    event.preventDefault()
    if (submitButton.getAttribute("disabled") === "true") return

    submitButton.setAttribute("disabled", "true")
    submitButton.innerHTML = LOADING_ANIMATION

    const formData = new FormData(formElement)
    const email = formData.get("email")
    const password = formData.get("password")

    setTimeout(() => {
        minecraftAuth.mojangLogin({
            username: email,
            password,
        }).then(response => {
            if (response.error) {
                formElement.onsubmit = submitMojangForm
                infoElement.innerHTML = "⛔ Invalid credentials"
                passwordElement.value = ""

                submitButton.setAttribute("disabled", "false")
                submitButton.innerText = "Login"
            } else {
                const account = response
                minecraftAuth.addAccount(account)
                showStatus(
                    `Minecraft account <b>${account.profile.username}</b> has been successfully added to the Account Manager.`,
                    100,
                )
            }
        })
    }, 500)
}