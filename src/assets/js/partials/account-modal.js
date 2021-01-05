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
    full.style.width = "350px"
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
        finishMicrosoftLogin()
        insertAccount({
            type: "microsoft",
            accessToken: acc.minecraftToken,
            profile: {
                uuid: acc.profile.id,
                username: acc.profile.name,
            },
        })
    }).catch(error => {
        finishMicrosoftLogin()
        showStatus(error.message, 120)
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
    footer.style.height = `210px`
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

                submitButton.removeAttribute("disabled")
                submitButton.innerText = "Login"
            } else {
                insertAccount(response)
            }
        })
    }, 500)
}

function loadAccounts() {
    const targetElement = document.getElementById("account-modal__accounts")
    const current = minecraftAuth.getCurrentAccountIdentifier()
    const accounts = minecraftAuth.getAccounts()

    targetElement.innerHTML = ""

    Object.keys(accounts).forEach(identifier => {
        const account = accounts[identifier]
        const isCurrent = identifier === current

        targetElement.innerHTML += createHtmlForAccount(isCurrent, identifier, account)
    })

    Array.from(document.getElementsByClassName("account-modal__account"))
        .forEach(element => element.addEventListener("click",
            async event => await switchAccount(event, element.getAttribute("data-account-id")),
        ))

    Array.from(document.getElementsByClassName("account-modal__logout"))
        .forEach(element => element.addEventListener("click",
            async event => await deleteAccount(event, element.parentElement.getAttribute("data-account-id")),
        ))
}

function showAccountManagerModal() {
    loadAccounts()
    clearFooter()

    accountWrapper.style.transform = "translateX(-500px)"
    // ^ used from home.js

    const modalWrapper = document.getElementById("account-modal-wrapper")
    modalWrapper.style.display = "flex"

    setTimeout(() => modalWrapper.style.opacity = "1", 10)
}

function hideAccountModal() {
    insertAccountData()

    const modalWrapper = document.getElementById("account-modal-wrapper")
    modalWrapper.style.opacity = "0"

    setTimeout(() => modalWrapper.style.display = "none", 500)
}

function insertAccount(account) {
    const identifier = minecraftAuth.addAccount(account)

    if (identifier === false) {
        showStatus(
            `The Minecraft account <b>${account.profile.username}</b> is already contained
            in the Account Manager.`,
            80,
        )
    } else if (identifier) {
        showStatus(
            `Minecraft account <b>${account.profile.username}</b> has been successfully 
            added to the Account Manager.`,
            80,
        )
        document.getElementById("account-modal__accounts").innerHTML +=
            createHtmlForAccount(true, identifier, account)
        selectCurrentAccount(identifier)
    } else {
        showStatus(
            `<b>An unexpected error occurred while trying to add the account to the
            Account Manager!</b>`,
            80,
        )
    }
}

async function switchAccount(event, accountId) {
    if (event.target.classList.contains("account-modal__logout")) return

    minecraftAuth.setCurrentAccount(accountId)
    try {
        await minecraftAuth.refreshToken(accountId)
    } catch (e) {}
    selectCurrentAccount(accountId)
}

async function deleteAccount(event, accountId) {
    minecraftAuth.removeAccount(accountId)

    for (let element of document.getElementsByClassName("account-modal__account")) {
        if (element.getAttribute("data-account-id") === accountId) {
            element.remove()
        }
    }

    selectCurrentAccount(minecraftAuth.getCurrentAccountIdentifier())
    try {
        await minecraftAuth.refreshToken(accountId)
    } catch (e) {}
}

function selectCurrentAccount(identifier) {
    for (let element of document.getElementsByClassName("account-modal__account")) {
        if (element.getAttribute("data-account-id") === identifier) {
            element.classList.add("account-modal__current-account")
        } else {
            element.classList.remove("account-modal__current-account")
        }
    }
}

function createHtmlForAccount(isCurrent, identifier, account) {
    return `
            <div class="account-modal__account ${isCurrent ? "account-modal__current-account" : ""}" data-account-id="${identifier}">
                <img src="https://mineskin.de/avatar/${account.profile.username}" alt="${account.profile.username}" class="account-modal__skull">
                <div class="account-modal__info-wrapper">
                    <span class="account-modal__name">${account.profile.username}</span>
                    <span class="account-modal__uuid">${account.profile.uuid}</span>
                </div>
                <img class="account-modal__logout" src="../assets/media/svg/logout.svg" alt="logout">
            </div>
        `
}

document.getElementsByClassName("account-name__minecraft-wrapper")[0]
    .addEventListener("click", showAccountManagerModal)

document.getElementById("account-modal-wrapper")
    .addEventListener("click", event => {
        if (event.target === document.getElementById("account-modal-wrapper")) {
            hideAccountModal()
        }
    })
document.getElementById("account-modal-close")
    .addEventListener("click", hideAccountModal)

window.addEventListener("keydown", event => {
    if (event.code === "Escape" && document.getElementById("account-modal-wrapper").style.display === "flex") {
        hideAccountModal()
    }
})