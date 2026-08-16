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

  // EM-102: once the canvas is live, surface the controls pill, and open the
  // guide itself on a player's first visit — before their first skirmish.
  var pill = document.getElementById('help-pill');
  if (pill) pill.classList.add('is-visible');
  if (window.__empiresShortcuts && !window.__empiresShortcuts.seen()) {
    window.__empiresShortcuts.open();
  }
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

// ---------------------------------------------------------------------------
// EM-105: audio focus handling. The engine creates its own AudioContext deep
// inside SDL's glue, so rather than reach into internals we wrap the
// constructor (this file runs before aoe2-clone.js) and keep a handle on every
// context that gets built. Backgrounding the tab suspends them; refocusing
// resumes only the ones we suspended, so a deliberately muted context stays
// muted.
// ---------------------------------------------------------------------------
(function trackAudioContexts() {
  var contexts = [];
  var suspendedByUs = [];

  ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
    var Original = window[name];
    if (typeof Original !== 'function') return;
    function Tracked() {
      var ctx = new (Function.prototype.bind.apply(Original, [null].concat(
        Array.prototype.slice.call(arguments)
      )))();
      contexts.push(ctx);
      return ctx;
    }
    Tracked.prototype = Original.prototype;
    Object.keys(Original).forEach(function (key) {
      try { Tracked[key] = Original[key]; } catch (e) { /* read-only statics */ }
    });
    window[name] = Tracked;
  });

  function suspendAll() {
    suspendedByUs = [];
    contexts.forEach(function (ctx) {
      if (ctx.state !== 'running') return;
      suspendedByUs.push(ctx);
      try { ctx.suspend(); } catch (e) { /* context may already be closed */ }
    });
  }

  function resumeSuspended() {
    suspendedByUs.forEach(function (ctx) {
      if (ctx.state !== 'suspended') return;
      try { ctx.resume(); } catch (e) { /* context may already be closed */ }
    });
    suspendedByUs = [];
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') suspendAll(); else resumeSuspended();
  });
  window.addEventListener('blur', suspendAll);
  window.addEventListener('focus', resumeSuspended);

  window.__empiresAudio = {
    contexts: contexts,
    states: function () { return contexts.map(function (c) { return c.state; }); },
  };
})();

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

// ---------------------------------------------------------------------------
// EM-104: capability probe. The build needs WebAssembly and a working WebGL
// context; SIMD is a performance path, not a hard requirement, so it is
// reported separately. The notice is advisory — the player can dismiss it and
// try anyway rather than being locked out on a false negative.
// ---------------------------------------------------------------------------
function hasWasm() {
  return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
}

function hasWasmSimd() {
  if (!hasWasm() || typeof WebAssembly.validate !== 'function') return false;
  // Minimal module whose body is `i32.const 0; i8x16.splat; drop` — the splat
  // opcode (0xfd 0x0f) only validates on engines with the SIMD proposal.
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0,   // magic + version
      1, 4, 1, 96, 0, 0,             // type section: () -> ()
      3, 2, 1, 0,                    // function section: one func of type 0
      10, 9, 1, 7, 0,                // code section: one body, 7 bytes, no locals
      65, 0,                         // i32.const 0
      253, 15,                       // i8x16.splat
      26,                            // drop
      11,                            // end
    ]));
  } catch (e) {
    return false;
  }
}

function detectWebgl() {
  var probe = document.createElement('canvas');
  var gl = null;
  try { gl = probe.getContext('webgl2'); } catch (e) { /* fall through to webgl1 */ }
  if (gl) return 'webgl2';
  try { gl = probe.getContext('webgl') || probe.getContext('experimental-webgl'); } catch (e) { gl = null; }
  return gl ? 'webgl' : null;
}

function checkCapabilities() {
  var report = { wasm: hasWasm(), simd: hasWasmSimd(), webgl: detectWebgl() };
  var problems = [];

  if (!report.wasm) {
    problems.push('This browser has no WebAssembly support, which EMPIRES needs to run at all.');
  }
  if (!report.webgl) {
    problems.push('No WebGL context is available, so the game cannot draw. Hardware acceleration may be disabled.');
  } else if (report.webgl === 'webgl') {
    problems.push('Only WebGL 1 is available. The game should still render, but expect lower performance.');
  }
  if (report.wasm && !report.simd) {
    problems.push('WebAssembly SIMD is unavailable, so simulation-heavy moments may run slower.');
  }

  var notice = document.getElementById('capability-notice');
  var detail = document.getElementById('capability-detail');
  var dismiss = document.getElementById('capability-dismiss');
  if (problems.length && notice && detail) {
    detail.textContent = problems.join(' ');
    notice.classList.add('is-visible');
    if (dismiss) {
      dismiss.addEventListener('click', function () { notice.classList.remove('is-visible'); });
    }
  }

  window.__empiresCapabilities = report;
  return report;
}

// ---------------------------------------------------------------------------
// EM-103: performance telemetry overlay (F3). Frame timings come from our own
// rAF sampler, which tracks the same vsync the engine's main loop is driven by.
// This build has no networked lockstep — multiplayer is desktop-only — so the
// overlay reports the simulation as local rather than inventing a latency
// figure.
// ---------------------------------------------------------------------------
function setupTelemetry() {
  var panel = document.getElementById('telemetry');
  if (!panel) return;

  var visible = false;
  var frames = 0;
  var worst = 0;
  var lastSample = 0;
  var lastFrame = 0;
  var fps = 0;
  var avgMs = 0;

  function sample(now) {
    if (lastFrame) {
      var delta = now - lastFrame;
      frames++;
      if (delta > worst) worst = delta;
    }
    lastFrame = now;

    if (!lastSample) lastSample = now;
    if (now - lastSample >= 500) {
      var elapsed = now - lastSample;
      fps = (frames * 1000) / elapsed;
      avgMs = frames ? elapsed / frames : 0;
      if (visible) {
        panel.textContent =
          'FPS ' + fps.toFixed(0) +
          '\nframe ' + avgMs.toFixed(1) + ' ms (peak ' + worst.toFixed(1) + ')' +
          '\nsim lockstep local — no network' +
          '\nrenderer ' + (window.__empiresCapabilities ? window.__empiresCapabilities.webgl || 'none' : '?') +
          '\nsimd ' + (window.__empiresCapabilities && window.__empiresCapabilities.simd ? 'yes' : 'no');
      }
      frames = 0;
      worst = 0;
      lastSample = now;
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);

  function toggle() {
    visible = !visible;
    panel.classList.toggle('is-visible', visible);
    if (visible) panel.textContent = 'FPS —\nsampling...';
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'F3') {
      e.preventDefault();
      toggle();
    }
  });

  window.__empiresTelemetry = {
    toggle: toggle,
    isVisible: function () { return visible; },
    read: function () { return { fps: fps, avgFrameMs: avgMs }; },
  };
}

// ---------------------------------------------------------------------------
// EM-102: pre-match shortcut guide. Shown once per browser before the first
// skirmish, and reachable afterwards from the "? Controls" pill.
// ---------------------------------------------------------------------------
var SHORTCUTS_SEEN_KEY = 'empires.shortcutsSeen.v1';

function setupShortcutGuide() {
  var modal = document.getElementById('shortcuts');
  var pill = document.getElementById('help-pill');
  var closeBtn = document.getElementById('shortcuts-close');
  var startBtn = document.getElementById('shortcuts-start');
  if (!modal || !pill) return;

  function open() { modal.classList.add('is-open'); }
  function close() { modal.classList.remove('is-open'); }

  function markSeen() {
    try { localStorage.setItem(SHORTCUTS_SEEN_KEY, '1'); } catch (e) { /* private mode */ }
  }

  function seen() {
    try { return localStorage.getItem(SHORTCUTS_SEEN_KEY) === '1'; } catch (e) { return false; }
  }

  pill.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', function () { markSeen(); close(); });
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      markSeen();
      close();
      sendSpaceKey();
      hideStartHint();
    });
  }
  modal.addEventListener('click', function (e) {
    if (e.target === modal) { markSeen(); close(); }
  });
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Escape' && modal.classList.contains('is-open')) {
      markSeen();
      close();
    }
  });

  window.__empiresShortcuts = { open: open, close: close, seen: seen };
  return { open: open, seen: seen };
}

// SDL_CreateWindow("AoE2 Clone", ...) sets document.title on the web backend,
// clobbering the page's own <title>; force it back after the app takes over.
setTimeout(function () { document.title = 'EMPIRES — MixMash Studio'; }, 500);

// The lobby is keyboard-only (SPACE starts a local skirmish) with no
// clickable DOM button, which isn't discoverable on the web. Give people an
// obvious button that sends the same key, and get out of the way once
// they've engaged with the game by any means.
window.addEventListener('DOMContentLoaded', function () {
  checkCapabilities();
  setupTelemetry();
  setupShortcutGuide();

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
