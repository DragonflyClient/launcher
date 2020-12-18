const { ipcRenderer } = require('electron');
const div = document.getElementById('game-output');
let autoScrollHappened = false;

ipcRenderer.on('game-output-data', (e, args) => {
    const gameOutput = args;
    const timestamp = new Date(parseInt(gameOutput.timestamp)).toLocaleTimeString();
    const shouldScroll = div.scrollTop === div.scrollHeight - div.offsetHeight || (div.scrollTop === 0 && !autoScrollHappened);

    const fullMessage = `
            <div class="output__overview-wrapper level-${gameOutput.level.toLowerCase()} logger-${gameOutput.logger
        .toLowerCase()
        .replaceAll(' ', '_')}">
               <span class="output__icon"></span>
               <span class="output__overview-timestamp">${timestamp}</span>
               <span class="output__overview-logger">${gameOutput.logger}</span>
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

const logOptions = document.querySelectorAll('.logger-control-label');

for (let i = 0; i < logOptions.length; i++) {
    const label = logOptions[i];
    label.firstElementChild.checked = true;

    label.addEventListener('change', (e) => {
        const others = Array.from(logOptions);
        others.splice(i, 1);
        const allOthersDisabled = !others.some((element) => element.firstElementChild.checked);
        console.log(allOthersDisabled);
        if (allOthersDisabled && !e.target.checked) {
            e.target.checked = true;
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
        }

        const checked = e.target.checked;
        const levelItems = document.querySelectorAll(`.level-${e.target.name}`);
        const display = checked ? 'flex' : 'none';
        for (let n = 0; n < levelItems.length; n++) {
            levelItems[n].style.display = display;
        }
    });
}
