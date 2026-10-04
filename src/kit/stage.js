/**
 * MixKit stage (Mobile & Tablet Fix Phase 1)
 *
 * Fits a game canvas inside the device's safe area at its base aspect ratio,
 * sizes the backing store to the device pixel ratio, and shows one shared
 * "rotate your device" prompt when a game that prefers an orientation is being
 * played in the other one.
 *
 *   var stage = MixKit.stage.attach(canvas, {
 *     width: 960, height: 540,      // the game's base size (sets the aspect)
 *     container: stageEl,           // optional; omitted = fit the visible screen
 *     dprCap: 2,                    // default 2: a 3x phone does not pay 9x pixels
 *     orientation: 'landscape',     // optional preference: 'landscape' | 'portrait'
 *     touchAction: 'none',          // default; false leaves the canvas alone
 *     onFit: function (info) {}     // optional
 *   });
 *   stage.fit();  stage.info();  stage.setBase(w, h);  stage.destroy();
 *
 * It refits on resize and orientationchange and dispatches
 *   window 'mixkit:stage-fit'  detail { cssWidth, cssHeight, dpr, scale,
 *                                       backingWidth, backingHeight, safe,
 *                                       fillRatio, rotatePrompt }
 *
 * Pure helpers (also used by the tests): MixKit.stage.fitRect, backingSize,
 * needsRotate.
 *
 * The rotate prompt appears only when BOTH hold: the device orientation is
 * the opposite of the declared preference, and the fitted canvas uses less
 * than 50% of the screen. Dismissing it ("Continue anyway") keeps it away for
 * the rest of the page's life.
 */
(function attachMixKitStage(global) {
  'use strict';

  var MixKit = global.MixKit = global.MixKit || {};
  if (MixKit.stage) return;

  var doc = global.document;
  var ROTATE_FILL_THRESHOLD = 0.5;

  // --- pure math ------------------------------------------------------------
  function fitRect(availW, availH, baseW, baseH) {
    if (!(availW > 0) || !(availH > 0) || !(baseW > 0) || !(baseH > 0)) {
      return { width: 0, height: 0, scale: 0 };
    }
    var scale = Math.min(availW / baseW, availH / baseH);
    return { width: Math.floor(baseW * scale), height: Math.floor(baseH * scale), scale: scale };
  }

  function backingSize(cssWidth, cssHeight, dpr, cap) {
    var ratio = Math.max(1, Math.min(dpr || 1, cap > 0 ? cap : 2));
    return {
      width: Math.max(1, Math.round(cssWidth * ratio)),
      height: Math.max(1, Math.round(cssHeight * ratio)),
      dpr: ratio,
    };
  }

  // orientation: the game's preference; fitted area is compared with the screen.
  function needsRotate(orientation, screenW, screenH, cssW, cssH) {
    if (orientation !== 'landscape' && orientation !== 'portrait') return false;
    var isPortrait = screenH > screenW;
    var mismatch = orientation === 'landscape' ? isPortrait : !isPortrait;
    if (!mismatch) return false;
    var fill = (cssW * cssH) / (screenW * screenH || 1);
    return fill < ROTATE_FILL_THRESHOLD;
  }

  // --- safe-area probe ------------------------------------------------------
  // env(safe-area-inset-*) cannot be read from script directly, so a hidden
  // element carries it as padding. It honours --safe-* when viewport.css (or a
  // test) defines them and falls back to env() otherwise.
  var probe = null;

  function readSafe() {
    var zero = { top: 0, right: 0, bottom: 0, left: 0 };
    if (!doc || !doc.documentElement || !global.getComputedStyle) return zero;
    if (!probe || !probe.isConnected) {
      probe = doc.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;' +
        'pointer-events:none;box-sizing:content-box;' +
        'padding-top:var(--safe-top,env(safe-area-inset-top,0px));' +
        'padding-right:var(--safe-right,env(safe-area-inset-right,0px));' +
        'padding-bottom:var(--safe-bottom,env(safe-area-inset-bottom,0px));' +
        'padding-left:var(--safe-left,env(safe-area-inset-left,0px))';
      doc.documentElement.appendChild(probe);
    }
    var cs = global.getComputedStyle(probe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
  }

  // --- the shared rotate prompt --------------------------------------------
  var rotateEl = null;
  var rotateDismissed = false;

  function ensureRotatePrompt() {
    if (rotateEl && rotateEl.isConnected) return rotateEl;
    var style = doc.createElement('style');
    style.setAttribute('data-mixkit-stage', '');
    style.textContent = [
      '.mixkit-rotate{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;',
      'padding:16px;box-sizing:border-box;background:rgba(6,6,14,0.92);color:#F0F0F8;text-align:center;',
      'font-family:"Space Mono",ui-monospace,SFMono-Regular,Menlo,monospace;overscroll-behavior:contain}',
      '.mixkit-rotate[hidden]{display:none}',
      '.mixkit-rotate-card{max-width:320px;display:flex;flex-direction:column;align-items:center;gap:14px}',
      '.mixkit-rotate-icon{font-size:44px;line-height:1}',
      '.mixkit-rotate-title{font-size:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase}',
      '.mixkit-rotate-copy{font-size:13px;line-height:1.5;color:#C9C9D8}',
      '.mixkit-rotate button{min-width:44px;min-height:44px;padding:10px 18px;border-radius:999px;cursor:pointer;',
      'font:inherit;font-size:12px;letter-spacing:0.09em;text-transform:uppercase;color:#F0F0F8;',
      'background:transparent;border:1px solid rgba(255,255,255,0.5)}',
      '.mixkit-rotate button:focus-visible{outline:2px solid #FFE23D;outline-offset:2px}',
    ].join('');
    doc.head.appendChild(style);

    rotateEl = doc.createElement('div');
    rotateEl.className = 'mixkit-rotate';
    rotateEl.setAttribute('role', 'dialog');
    rotateEl.setAttribute('aria-modal', 'true');
    rotateEl.setAttribute('aria-labelledby', 'mixkit-rotate-title');
    rotateEl.hidden = true;
    rotateEl.innerHTML =
      '<div class="mixkit-rotate-card">' +
      '<div class="mixkit-rotate-icon" aria-hidden="true">&#8635;</div>' +
      '<div class="mixkit-rotate-title" id="mixkit-rotate-title">Rotate your device</div>' +
      '<div class="mixkit-rotate-copy">This game plays best in <span data-mixkit-rotate-want>landscape</span>.</div>' +
      '<button type="button" data-mixkit-rotate-dismiss>Continue anyway</button>' +
      '</div>';
    rotateEl.querySelector('[data-mixkit-rotate-dismiss]').addEventListener('click', function () {
      rotateDismissed = true;
      rotateEl.hidden = true;
    });
    doc.body.appendChild(rotateEl);
    return rotateEl;
  }

  function setRotatePrompt(show, orientation) {
    if (!show) {
      if (rotateEl) rotateEl.hidden = true;
      return false;
    }
    if (rotateDismissed) return false;
    var el = ensureRotatePrompt();
    el.querySelector('[data-mixkit-rotate-want]').textContent = orientation;
    el.hidden = false;
    return true;
  }

  // --- attach ---------------------------------------------------------------
  function attach(canvas, options) {
    var opts = options || {};
    var base = { width: opts.width || canvas.width || 960, height: opts.height || canvas.height || 540 };
    var cap = opts.dprCap > 0 ? opts.dprCap : 2;
    var container = opts.container || null;
    var last = null;

    if (opts.touchAction !== false && canvas.style) canvas.style.touchAction = opts.touchAction || 'none';

    function available(safe) {
      if (container) {
        var cs = global.getComputedStyle(container);
        return {
          width: container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0),
          height: container.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0),
        };
      }
      return {
        width: global.innerWidth - safe.left - safe.right,
        height: global.innerHeight - safe.top - safe.bottom,
      };
    }

    function fit() {
      var safe = readSafe();
      var room = available(safe);
      var rect = fitRect(room.width, room.height, base.width, base.height);
      var back = backingSize(rect.width, rect.height, global.devicePixelRatio, cap);

      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      canvas.style.display = 'block';
      if (!container) {
        // Free-standing: centre inside the safe area.
        canvas.style.position = 'fixed';
        canvas.style.left = (safe.left + Math.max(0, (room.width - rect.width) / 2)) + 'px';
        canvas.style.top = (safe.top + Math.max(0, (room.height - rect.height) / 2)) + 'px';
      }
      // Assigning width/height clears a canvas, so only touch them on change.
      if (canvas.width !== back.width) canvas.width = back.width;
      if (canvas.height !== back.height) canvas.height = back.height;

      var screenW = global.innerWidth, screenH = global.innerHeight;
      var fill = (rect.width * rect.height) / (screenW * screenH || 1);
      var rotate = needsRotate(opts.orientation, screenW, screenH, rect.width, rect.height);
      var shown = opts.orientation && opts.rotatePrompt !== false
        ? setRotatePrompt(rotate, opts.orientation)
        : false;

      last = {
        cssWidth: rect.width, cssHeight: rect.height, scale: rect.scale,
        dpr: back.dpr, backingWidth: back.width, backingHeight: back.height,
        safe: safe, fillRatio: fill, rotatePrompt: shown,
      };
      if (typeof opts.onFit === 'function') opts.onFit(last);
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.dispatchEvent(new global.CustomEvent('mixkit:stage-fit', { detail: last }));
      }
      return last;
    }

    var raf = 0;
    function schedule() {
      if (raf) return;
      var run = function () { raf = 0; fit(); };
      raf = typeof global.requestAnimationFrame === 'function'
        ? global.requestAnimationFrame(run)
        : setTimeout(run, 16);
    }

    global.addEventListener('resize', schedule);
    global.addEventListener('orientationchange', schedule);
    if (global.visualViewport && global.visualViewport.addEventListener) {
      global.visualViewport.addEventListener('resize', schedule);
    }
    fit();

    return {
      fit: fit,
      info: function () { return last; },
      setBase: function (w, h) { base = { width: w, height: h }; fit(); },
      setDprCap: function (n) { if (n > 0) { cap = n; fit(); } },
      destroy: function () {
        global.removeEventListener('resize', schedule);
        global.removeEventListener('orientationchange', schedule);
        if (global.visualViewport && global.visualViewport.removeEventListener) {
          global.visualViewport.removeEventListener('resize', schedule);
        }
        setRotatePrompt(false);
      },
    };
  }

  MixKit.stage = {
    version: 1,
    attach: attach,
    fitRect: fitRect,
    backingSize: backingSize,
    needsRotate: needsRotate,
    readSafe: readSafe,
  };
})(typeof window !== 'undefined' ? window : globalThis);
