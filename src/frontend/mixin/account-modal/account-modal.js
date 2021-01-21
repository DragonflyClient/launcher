const microsoftAuth = require("../../util/microsoft-auth")
const minecraftAuth = require("../../util/minecraft-auth")

const button = document.getElementById("account-modal__button")
const full = document.getElementsByClassName("full-button")[0]

const left = document.getElementsByClassName("left")[0]
const right = document.getElementsByClassName("right")[0]

const footer = document.getElementById("account-modal-footer")
const { insertAccountData } = require("../../sites/home/home")

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

let isDirty = false

full.addEventListener("click", () => {
    button.classList.add("expanded-1")
    setTimeout(() => {
        full.classList.remove("collapsed")
        button.classList.add("expanded-2")

        left.addEventListener("click", addMinecraftAccount)
        right.addEventListener("click", addMicrosoftAccount)

        setTimeout(() => {
            button.classList.add("expanded-3")
        }, 200)
    }, 100)
})

function resetButton() {
    button.classList.remove("expanded-3", "expanded-2", "expanded-1")
    full.classList.add("collapsed")

    left.removeEventListener("click", addMinecraftAccount)
    left.innerHTML = `
        <img class="img-part" src="../../assets/media/png/minecraft-logo.png" alt="">
        <a class="text-part">Mojang</a>
    `

    right.removeEventListener("click", addMicrosoftAccount)
    right.setAttribute("disabled", "false")
    right.innerHTML = `
        <img class="img-part" src="../../assets/media/svg/microsoft-logo.svg" alt="">
        <a class="text-part">Microsoft</a>
    `
}

function addMicrosoftAccount() {
    if (right.getAttribute("disabled") === "true") {
        return
    }

    clearFooter()

    right.setAttribute("disabled", "true")
    right.innerHTML = LOADING_ANIMATION

    microsoftAuth
        .startAuthorizationFlow(() => {
            finishMicrosoftLogin()
        })
        .then(acc => {
            finishMicrosoftLogin()
            insertAccount({
                type: "microsoft",
                accessToken: acc.minecraftToken,
                profile: {
                    uuid: acc.profile.id,
                    username: acc.profile.name,
                },
            })
        })
        .catch(error => {
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
        minecraftAuth
            .mojangLogin({
                username: email,
                password,
            })
            .then(response => {
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

    if (Object.keys(accounts).length === 0) {
        toggleAccountManagerStatus(true)
        return
    }

    targetElement.innerHTML = ""

    Object.keys(accounts).forEach(identifier => {
        const account = accounts[identifier]
        const isCurrent = identifier === current

        targetElement.innerHTML += createHtmlForAccount(isCurrent, identifier, account)
    })

    Array.from(document.getElementsByClassName("account-modal__account")).forEach(element =>
        element.addEventListener(
            "click",
            async event => await switchAccount(event, element.getAttribute("data-account-id"))
        )
    )

    Array.from(document.getElementsByClassName("account-modal__logout")).forEach(element =>
        element.addEventListener(
            "click",
            async event => await deleteAccount(event, element.parentElement.getAttribute("data-account-id"))
        )
    )
}

const accountWrapper = document.querySelector(".account")
function showAccountManagerModal() {
    loadAccounts()

    accountWrapper.style.transform = "translateX(-100%)"
    accountWrapper.style.pointerEvents = "none"
    // ^ used from home.js

    const modalWrapper = document.getElementById("account-modal-wrapper")
    modalWrapper.style.display = "flex"

    setTimeout(() => (modalWrapper.style.opacity = "1"), 10)
}

function hideAccountModal() {
    if (isDirty) {
        // noinspection JSIgnoredPromiseFromCall
        insertAccountData()
        isDirty = false
    } else {
        accountWrapper.style.transform = "translateX(0)"
    }

    microsoftAuth.abortAll(true)
    accountWrapper.style.pointerEvents = "all"

    const modalWrapper = document.getElementById("account-modal-wrapper")
    modalWrapper.style.opacity = "0"

    setTimeout(() => {
        modalWrapper.style.display = "none"
        clearFooter()
        resetButton()
    }, 500)
}

function insertAccount(account) {
    const identifier = minecraftAuth.addAccount(account)

    if (identifier === false) {
        showStatus(
            `The Minecraft account <b>${account.profile.username}</b> is already contained
            in the Account Manager.`,
            80
        )
    } else if (identifier) {
        showStatus(
            `Minecraft account <b>${account.profile.username}</b> has been successfully 
            added to the Account Manager.`,
            80
        )
        console.log(document.getElementById("account-modal__accounts").childElementCount, "CHILD ELEMENT COUNT!")
        if (document.getElementById("account-modal__accounts").childElementCount) toggleAccountManagerStatus(false)
        document.getElementById("account-modal__accounts").innerHTML += createHtmlForAccount(true, identifier, account)
        selectCurrentAccount(identifier)
        isDirty = true
    } else {
        showStatus(
            `<b>An unexpected error occurred while trying to add the account to the
            Account Manager!</b>`,
            80
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
    isDirty = true
}

async function deleteAccount(event, accountId) {
    const switched = minecraftAuth.removeAccount(accountId)
    for (let element of document.getElementsByClassName("account-modal__account")) {
        if (element.getAttribute("data-account-id") === accountId) {
            element.remove()
        }
    }
    if (document.getElementsByClassName("account-modal__account").length === 0) {
        toggleAccountManagerStatus(true)
    }
    selectCurrentAccount(minecraftAuth.getCurrentAccountIdentifier())
    try {
        await minecraftAuth.refreshToken(accountId)
    } catch (e) {}

    if (switched) {
        isDirty = true
    }
}

function toggleAccountManagerStatus(empty = true) {
    if (empty) {
        document.getElementById("account-modal__accounts-header").textContent = "No accounts available."
        document.getElementById("account-modal__accounts").innerHTML = `
            <img class="accounts-empty-img" src="../../assets/media/svg/empty.svg"  alt="Nothing here"/>
        `
    } else {
        document.getElementById("account-modal__accounts").innerHTML = ""
        document.getElementById("account-modal__accounts-header").innerHTML = "Saved Minecraft Accounts"
    }
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
            <div class="account-modal__account ${
                isCurrent ? "account-modal__current-account" : ""
            }" data-account-id="${identifier}">
                <img src="https://mineskin.de/avatar/${account.profile.username}" alt="${
        account.profile.username
    }" class="account-modal__skull">
                <div class="account-modal__info-wrapper">
                    <span class="account-modal__name">${account.profile.username}</span>
                    <span class="account-modal__uuid">${account.profile.uuid}</span>
                </div>
                <img class="account-modal__logout" src="../../assets/media/svg/logout.svg" alt="logout">
            </div>
        `
}

document.getElementsByClassName("account-name__minecraft-wrapper")[0].addEventListener("click", showAccountManagerModal)

document.getElementById("account-modal-close").addEventListener("click", hideAccountModal)

window.addEventListener("keydown", event => {
    if (event.code === "Escape" && document.getElementById("account-modal-wrapper").style.display === "flex") {
        hideAccountModal()
    }
})
