function setLoadProgress(fraction, label) {
  var bar = document.getElementById('loadbar-fill');
  var text = document.getElementById('loadbar-label');
  if (bar && fraction != null) bar.style.width = Math.round(fraction * 100) + '%';
  if (text && label) text.textContent = label;
}

function hideLoadingOverlay() {
  var overlay = document.getElementById('loading');
  if (overlay) overlay.style.display = 'none';
  showStartHint();
}

function showStartHint() {
  var hint = document.getElementById('start-hint');
  if (hint) hint.style.display = 'flex';
}

function hideStartHint() {
  var hint = document.getElementById('start-hint');
  if (hint) hint.style.display = 'none';
}

function sendSpaceKey() {
  var canvas = document.getElementById('canvas');
  if (canvas && canvas.focus) canvas.focus();
  ['keydown', 'keyup'].forEach(function (type) {
    window.dispatchEvent(new KeyboardEvent(type, {
      code: 'Space', key: ' ', keyCode: 32, which: 32, bubbles: true,
    }));
  });
}

var Module = {
  canvas: document.getElementById('canvas'),
  print: function (text) { console.log(text); },
  printErr: function (text) { console.error(text); },
  setStatus: function (text) {
    var el = document.getElementById('status');
    if (el) el.textContent = text;
    // The generated glue calls setStatus("Running...") right before handing
    // off to the app's own main loop — that's our signal the canvas is live.
    if (text === 'Running...') hideLoadingOverlay();
  },
  // Emscripten's default wasm loader doesn't expose download progress; fetch
  // the binary ourselves (with a real byte counter) and hand the bytes back.
  instantiateWasm: function (imports, successCallback) {
    fetch('./assets/aoe2-clone.wasm')
      .then(function (response) {
        var total = parseInt(response.headers.get('Content-Length') || '0', 10);
        if (!response.body || !total) {
          setLoadProgress(0.5, 'Loading EMPIRES...');
          return response.arrayBuffer();
        }
        var reader = response.body.getReader();
        var received = 0;
        var chunks = [];
        return reader.read().then(function pump(result) {
          if (result.done) {
            var bytes = new Uint8Array(received);
            var offset = 0;
            chunks.forEach(function (chunk) { bytes.set(chunk, offset); offset += chunk.length; });
            return bytes.buffer;
          }
          chunks.push(result.value);
          received += result.value.length;
          setLoadProgress(received / total, 'Loading EMPIRES... ' + Math.round((received / total) * 100) + '%');
          return reader.read().then(pump);
        });
      })
      .then(function (buffer) {
        setLoadProgress(1, 'Starting...');
        return WebAssembly.instantiate(buffer, imports);
      })
      .then(function (output) {
        successCallback(output.instance, output.module);
      })
      .catch(function (err) {
        console.error('wasm instantiation failed', err);
        Module.setStatus('Failed to load — check the browser console.');
      });
    return {}; // tells Emscripten we're handling instantiation asynchronously
  },
};

window.addEventListener('error', function () {
  Module.setStatus('Something went wrong — check the browser console.');
});

// SDL_CreateWindow("AoE2 Clone", ...) sets document.title on the web backend,
// clobbering the page's own <title>; force it back after the app takes over.
setTimeout(function () { document.title = 'EMPIRES — MixMash Studio'; }, 500);

// The lobby is keyboard-only (SPACE starts a local skirmish) with no
// clickable DOM button, which isn't discoverable on the web. Give people an
// obvious button that sends the same key, and get out of the way once
// they've engaged with the game by any means.
window.addEventListener('DOMContentLoaded', function () {
  var hint = document.getElementById('start-hint');
  if (!hint) return;
  hint.addEventListener('click', function () {
    sendSpaceKey();
    hideStartHint();
  });
  var canvas = document.getElementById('canvas');
  if (canvas) canvas.addEventListener('mousedown', hideStartHint, { once: true });
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') hideStartHint();
  }, { once: true });
});
