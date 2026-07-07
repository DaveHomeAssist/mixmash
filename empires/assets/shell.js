var Module = {
  canvas: document.getElementById('canvas'),
  print: function (text) { console.log(text); },
  printErr: function (text) { console.error(text); },
  setStatus: function (text) {
    var el = document.getElementById('status');
    if (el) el.textContent = text;
  },
};
window.addEventListener('error', function () {
  Module.setStatus('Something went wrong — check the browser console.');
});

// SDL_CreateWindow("AoE2 Clone", ...) sets document.title on the web backend,
// clobbering the page's own <title>; force it back after the app takes over.
setTimeout(function () { document.title = 'EMPIRES — MixMash Studio'; }, 500);

