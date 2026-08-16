/**
 * MixKit global nav (HUB-102)
 *
 * A single lightweight top bar shared by every game at mixmash.games: back to
 * the hub, a real "mute all", fullscreen, and the repo link. Drop it into a
 * page with:
 *
 *   <script src="../src/kit/nav.js" data-mixmash-nav></script>
 *
 * Load it BEFORE the game's own scripts. It wraps the AudioContext constructor
 * so "Mute All" can reach audio the game creates later, which only works if
 * this file runs first.
 *
 * The bar idles down to a low opacity so it never competes with gameplay, and
 * wakes on pointer/keyboard activity — the same behaviour the per-game back
 * pills already had.
 */
(function mixmashNav() {
  'use strict';

  if (window.__mixmashNav) return;

  var MUTE_KEY = 'mixmash.muteAll.v1';
  var REPO_URL = 'https://github.com/DaveHomeAssist/mixmash';

  // --- global audio control -------------------------------------------------
  // Track every AudioContext the page builds so one control can govern them
  // all, whichever game created them.
  var contexts = [];
  var muted = false;

  ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
    var Original = window[name];
    if (typeof Original !== 'function') return;
    function Tracked() {
      var ctx = new (Function.prototype.bind.apply(
        Original, [null].concat(Array.prototype.slice.call(arguments))
      ))();
      contexts.push(ctx);
      if (muted) { try { ctx.suspend(); } catch (e) { /* already closed */ } }
      return ctx;
    }
    Tracked.prototype = Original.prototype;
    Object.keys(Original).forEach(function (key) {
      try { Tracked[key] = Original[key]; } catch (e) { /* read-only statics */ }
    });
    window[name] = Tracked;
  });

  function readMuted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
  }

  function persistMuted(value) {
    try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch (e) { /* private mode */ }
  }

  function applyMute() {
    contexts.forEach(function (ctx) {
      try {
        if (muted && ctx.state === 'running') ctx.suspend();
        else if (!muted && ctx.state === 'suspended') ctx.resume();
      } catch (e) { /* context may be closed */ }
    });
    // Media elements are not routed through an AudioContext, so mute them too.
    var media = document.querySelectorAll('audio, video');
    for (var i = 0; i < media.length; i++) media[i].muted = muted;
    // Games that manage their own gain graph can listen for this instead.
    window.dispatchEvent(new CustomEvent('mixmash:mute', { detail: { muted: muted } }));
  }

  // --- markup ---------------------------------------------------------------
  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      // z-index sits above in-canvas HUD chrome but deliberately below every
      // page's full-screen overlays (menus, boot, loading), which are >= 20.
      '.mixnav{position:fixed;top:12px;left:12px;z-index:16;display:flex;align-items:center;gap:6px;',
      'font-family:"Space Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.09em;',
      'text-transform:uppercase;opacity:0.85;transition:opacity 0.6s ease;pointer-events:auto}',
      '.mixnav.is-idle{opacity:0.14}',
      '.mixnav:hover,.mixnav:focus-within{opacity:1}',
      '.mixnav a,.mixnav button{display:inline-flex;align-items:center;gap:6px;',
      'padding:7px 12px;border-radius:999px;cursor:pointer;text-decoration:none;',
      'font:inherit;color:#F0F0F8;background:rgba(6,6,14,0.74);',
      'border:1px solid rgba(255,255,255,0.14);',
      '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
      '.mixnav a:hover,.mixnav button:hover{border-color:rgba(255,255,255,0.34)}',
      '.mixnav a:focus-visible,.mixnav button:focus-visible{outline:2px solid #FFE23D;outline-offset:2px}',
      '.mixnav button[aria-pressed="true"]{color:#0b0b14;background:#FFE23D;border-color:#FFE23D}',
      '@media (max-width:640px){.mixnav .mixnav-label{display:none}',
      '.mixnav a,.mixnav button{padding:8px 10px}}',
      '@media (prefers-reduced-motion:reduce){.mixnav{transition:none}}',
    ].join('');
    document.head.appendChild(style);
  }

  function button(label, icon, title) {
    var el = document.createElement('button');
    el.type = 'button';
    el.title = title;
    el.setAttribute('aria-label', title);
    el.innerHTML = '<span aria-hidden="true">' + icon + '</span>' +
      '<span class="mixnav-label">' + label + '</span>';
    return el;
  }

  function build() {
    injectStyles();

    var bar = document.createElement('nav');
    bar.className = 'mixnav';
    bar.setAttribute('aria-label', 'MixMash');

    var home = document.createElement('a');
    home.href = new URL('/', window.location.origin).href;
    home.title = 'Back to the MixMash hub';
    home.innerHTML = '<span aria-hidden="true">&#8592;</span>' +
      '<span class="mixnav-label">MixMash Hub</span>';

    var muteBtn = button('Mute All', '&#128266;', 'Mute all audio');
    var fsBtn = button('Fullscreen', '&#9974;', 'Toggle fullscreen');

    var repo = document.createElement('a');
    repo.href = REPO_URL;
    repo.target = '_blank';
    repo.rel = 'noopener noreferrer';
    repo.title = 'Source on GitHub';
    repo.innerHTML = '<span aria-hidden="true">&#9881;</span>' +
      '<span class="mixnav-label">GitHub</span>';

    function syncMuteBtn() {
      muteBtn.setAttribute('aria-pressed', String(muted));
      muteBtn.querySelector('[aria-hidden]').innerHTML = muted ? '&#128263;' : '&#128266;';
      var title = muted ? 'Unmute all audio' : 'Mute all audio';
      muteBtn.title = title;
      muteBtn.setAttribute('aria-label', title);
      muteBtn.querySelector('.mixnav-label').textContent = muted ? 'Muted' : 'Mute All';
    }

    muteBtn.addEventListener('click', function () {
      muted = !muted;
      persistMuted(muted);
      applyMute();
      syncMuteBtn();
    });

    function syncFsBtn() {
      var on = !!document.fullscreenElement;
      fsBtn.setAttribute('aria-pressed', String(on));
      fsBtn.querySelector('.mixnav-label').textContent = on ? 'Exit Full' : 'Fullscreen';
    }

    fsBtn.addEventListener('click', function () {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () { /* denied */ });
      }
    });
    document.addEventListener('fullscreenchange', syncFsBtn);

    bar.appendChild(home);
    bar.appendChild(muteBtn);
    bar.appendChild(fsBtn);
    bar.appendChild(repo);
    document.body.appendChild(bar);

    muted = readMuted();
    syncMuteBtn();
    syncFsBtn();
    if (muted) applyMute();

    // Idle-dim so the bar stays out of the way mid-match.
    var idleTimer = 0;
    function wake() {
      bar.classList.remove('is-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { bar.classList.add('is-idle'); }, 2600);
    }
    ['mousemove', 'touchstart', 'keydown', 'pointerdown'].forEach(function (type) {
      window.addEventListener(type, wake, { passive: true });
    });
    wake();

    window.__mixmashNav = {
      element: bar,
      isMuted: function () { return muted; },
      setMuted: function (value) {
        muted = !!value;
        persistMuted(muted);
        applyMute();
        syncMuteBtn();
      },
      audioContexts: contexts,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build, { once: true });
  } else {
    build();
  }
})();
