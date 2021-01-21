module.exports.windowIndex = (windowId, openWindows) => {
    for (let i = 0; i <= openWindows.length; i++) {
        if (openWindows[i] == windowId) return i;
    }
};
