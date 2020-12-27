const { /*luuuuutsch meine eierrrrrr*/ remote } = require('electron');

document.getElementById('close-btn').addEventListener('click', function (e) {
    console.log('CLOSE BTN CLICKED');
    var window = remote.getCurrentWindow();
    window.close();
});

document.getElementById('min-btn').addEventListener('click', function (e) {
    var window = remote.getCurrentWindow();
    window.minimize();
});
