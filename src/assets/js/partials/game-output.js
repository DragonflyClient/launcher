const { ipcRenderer } = require('electron');
const div = document.getElementById('game-output');
let autoScrollHappened = false;

ipcRenderer.on('game-output-data', (e, args) => {
    const gameOutput = args;
    const timestamp = new Date(parseInt(gameOutput.timestamp)).toLocaleTimeString();
    const shouldScroll = div.scrollTop === div.scrollHeight - div.offsetHeight || (div.scrollTop === 0 && !autoScrollHappened);

    const logger = gameOutput.logger.toLowerCase().replaceAll(' ', '_');
    const level = gameOutput.level.toLowerCase();
    const style = (disabledLevels.includes(level)) ? "display: none" : ""

    const isDragonfly = gameOutput.logger.startsWith("dragonfly-")
    const cleanLoggerName = gameOutput.logger.replace("dragonfly-", "")

    escapeMessage(gameOutput)

    const fullMessage = `
            <div class="output__overview-wrapper level-${level} logger-${logger}" style="${style}">
               <span class="output__level-tag">${level}</span>
               <span class="output__overview-timestamp">${timestamp}</span>
               <span class="output__overview-logger ${isDragonfly ? "dragonfly-logger" : ""}">${cleanLoggerName}</span>
               <span class="output__overview-thread">${gameOutput.thread}</span>
               <span class="output__overview-message">${gameOutput.message}</span>
            </div>
        `;
    div.innerHTML += fullMessage;

    if (shouldScroll) {
        if (div.scrollHeight - div.offsetHeight !== 0) autoScrollHappened = true;
        div.scrollTop = div.scrollHeight;
    }
});

const disabledLevels = ["debug"]
const logOptions = document.querySelectorAll('.logger-control-label');

for (let i = 0; i < logOptions.length; i++) {
    const label = logOptions[i];
    label.firstElementChild.checked = label.firstElementChild.name !== "debug";

    label.addEventListener('change', (e) => {
        const others = Array.from(logOptions);
        others.splice(i, 1);
        const allOthersDisabled = !others.some((element) => element.firstElementChild.checked);
        if (allOthersDisabled && !e.target.checked) {
            e.target.checked = true;
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
        }

        const checked = e.target.checked;
        const levelItems = document.querySelectorAll(`.level-${e.target.name}`);
        const display = checked ? 'flex' : 'none';

        if (checked) {
            disabledLevels.splice(disabledLevels.indexOf(e.target.name), 1)
        } else {
            disabledLevels.push(e.target.name)
        }

        for (let n = 0; n < levelItems.length; n++) {
            levelItems[n].style.display = display;
        }
    });
}

function escapeMessage(gameOutput) {
    const msg = gameOutput.message
    gameOutput.message = msg.replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}
