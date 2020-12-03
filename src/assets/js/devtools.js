document.onkeydown = function (evt) {
  if (!evt) evt = event;
  if (evt.ctrlKey && evt.shiftKey && evt.keyCode === 73) {
    console.log(
      '\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n'
    );
    console.log('%cHOLD UP!', '-webkit-text-stroke: 3px #DDDDDD; color: #ff0000; font-size: 5rem; font-weight: 1000');
    console.log('%cWait a minute...', '-webkit-text-stroke: 1px #000000; color: #ffffff; font-size: 2rem; font-weight: 800');
    console.log("%cIf you don't know exactly what to do here, close this window immediately!", 'color: #333; font-size: 1rem; font-weight: 800');
  }
};
