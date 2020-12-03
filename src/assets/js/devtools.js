const path = require('path');
const app = require('electron').remote.app;

document.onkeydown = function (evt) {
  if (!evt) evt = event;
  if (evt.ctrlKey && evt.shiftKey && evt.keyCode === 73) {
    console.log(
      '\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n'
    );
    console.log('%cHOLD UP!', '-webkit-text-stroke: 3px #DDDDDD; color: #ff0000; font-size: 5rem; font-weight: 1000');
    console.log('%cWait a minute...', '-webkit-text-stroke: 1px #000000; color: #ffffff; font-size: 2rem; font-weight: 800');
    console.log(
      "%cIf someone told you to copy/paste something here you have a monstrous chance you're being scammed.\n\nUnless you know exactly what you are doing here, close this window immediately!",
      'color: #333; font-size: 1rem; font-weight: 800'
    );
    const notification = new Notification('Wait a minute...', {
      icon: path.join(app.getAppPath(), 'src/assets/media/Logo.ico'),
      body: 'Unless you know exactly what you are doing here, close this window immediately!',
    });
  }
};
