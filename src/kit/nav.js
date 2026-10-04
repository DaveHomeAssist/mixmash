/**
 * MixKit global nav (HUB-102)
 *
 * A single lightweight bar shared by every game at mixmash.games: back to the
 * hub, a real "mute all", fullscreen, and the repo link. Drop it into a page
 * with:
 *
 *   <script src="../src/kit/nav.js" data-mixmash-nav></script>
 *
 * Load it BEFORE the game's own scripts. It wraps the AudioContext constructor
 * so "Mute All" can reach audio the game creates later, which only works if
 * this file runs first.
 *
 * Idle state: the bar collapses to ONE 44 px handle (a full-contrast button,
 * not a faded bar) and opens when the handle is pressed (mouse, touch or
 * keyboard), then closes again after a few idle seconds. Every control is at
 * least 44 x 44 px, and the bar is positioned from the device safe-area insets
 * (--safe-* from src/kit/viewport.css, falling back to env(safe-area-inset-*)).
 *
 * A game that has HUD in the default corner declares another slot so the bar
 * never covers it:
 *
 *   <script src="../src/kit/nav.js" data-nav-slot="bottom-right"></script>
 *   // or at runtime
 *   __mixmashNav.setSlot('bottom-right', { bottom: 56 }); // extra px of clearance
 *
 * Slots: top-left (default), top-right, bottom-left, bottom-right.
 * A page that reserves room for the full bar can opt out of collapsing with
 * data-nav-collapse="off" (or __mixmashNav.setCollapsible(false)).
 */
(function mixmashNav() {
  'use strict';

  if (window.__mixmashNav) return;

  var MUTE_KEY = 'mixmash.muteAll.v1';
  var REPO_URL = 'https://github.com/DaveHomeAssist/mixmash';
  var COLLAPSE_MS = 3200;
  var SLOTS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

  // Declared options on the script tag that loaded us.
  var script = document.currentScript;
  var declaredSlot = script && script.getAttribute('data-nav-slot');
  var declaredCollapse = script && script.getAttribute('data-nav-collapse');

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
  // Safe-area insets: --safe-* (viewport.css) first, then the raw env() value.
  function inset(side) {
    return 'var(--safe-' + side + ',env(safe-area-inset-' + side + ',0px))';
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      // z-index sits above in-canvas HUD chrome but deliberately below every
      // page's full-screen overlays (menus, boot, loading), which are >= 20.
      '.mixnav{position:fixed;z-index:16;display:flex;align-items:center;gap:6px;',
      'top:calc(' + inset('top') + ' + 12px + var(--mixnav-offset-top,0px));',
      'left:calc(' + inset('left') + ' + 12px + var(--mixnav-offset-left,0px));',
      'font-family:"Space Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.09em;',
      'text-transform:uppercase;pointer-events:auto}',
      // Slots: the handle stays in its corner and the controls open toward the
      // middle of the screen.
      '.mixnav[data-slot="top-right"]{left:auto;flex-direction:row-reverse;',
      'right:calc(' + inset('right') + ' + 12px + var(--mixnav-offset-right,0px))}',
      '.mixnav[data-slot="bottom-left"]{top:auto;',
      'bottom:calc(' + inset('bottom') + ' + 12px + var(--mixnav-offset-bottom,0px))}',
      '.mixnav[data-slot="bottom-right"]{top:auto;left:auto;flex-direction:row-reverse;',
      'right:calc(' + inset('right') + ' + 12px + var(--mixnav-offset-right,0px));',
      'bottom:calc(' + inset('bottom') + ' + 12px + var(--mixnav-offset-bottom,0px))}',
      '.mixnav-items{display:flex;align-items:center;gap:6px}',
      '.mixnav[data-slot$="right"] .mixnav-items{flex-direction:row-reverse}',
      '.mixnav[data-state="collapsed"] .mixnav-items{display:none}',
      '.mixnav[data-collapsible="false"] .mixnav-handle{display:none}',
      // Every control is a 44 x 44 px minimum target.
      '.mixnav a,.mixnav button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;',
      'gap:6px;min-width:44px;min-height:44px;padding:7px 12px;border-radius:999px;cursor:pointer;',
      'text-decoration:none;font:inherit;color:#F0F0F8;background:rgba(6,6,14,0.88);',
      'border:1px solid rgba(255,255,255,0.28);',
      '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
      '.mixnav .mixnav-handle{padding:0;font-size:18px;line-height:1}',
      '.mixnav a:hover,.mixnav button:hover{border-color:rgba(255,255,255,0.6)}',
      '.mixnav a:focus-visible,.mixnav button:focus-visible{outline:2px solid #FFE23D;outline-offset:2px}',
      '.mixnav button[aria-pressed="true"]{color:#0b0b14;background:#FFE23D;border-color:#FFE23D}',
      '.mixnav [hidden]{display:none!important}',
      '@media (max-width:640px){.mixnav .mixnav-label{display:none}',
      '.mixnav a,.mixnav button{padding:7px 10px}}',
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

    // The collapsed state: one 44 px handle that opens the rest.
    var handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'mixnav-handle';
    handle.setAttribute('aria-controls', 'mixnav-items');
    handle.innerHTML = '<span aria-hidden="true">&#9776;</span>';

    var items = document.createElement('div');
    items.className = 'mixnav-items';
    items.id = 'mixnav-items';

    var home = document.createElement('a');
    home.href = new URL('/', window.location.origin).href;
    home.title = 'Back to the MixMash hub';
    home.innerHTML = '<span aria-hidden="true">&#8592;</span>' +
      '<span class="mixnav-label">MixMash Hub</span>';

    var muteBtn = button('Mute All', '&#128266;', 'Mute all audio');
    var fsBtn = button('Fullscreen', '&#9974;', 'Toggle fullscreen');
    // iPhone Safari has no Fullscreen API on the document: a button that does
    // nothing is worse than no button.
    fsBtn.hidden = !document.documentElement.requestFullscreen;

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

    items.appendChild(home);
    items.appendChild(muteBtn);
    items.appendChild(fsBtn);
    items.appendChild(repo);
    bar.appendChild(handle);
    bar.appendChild(items);
    document.body.appendChild(bar);

    muted = readMuted();
    syncMuteBtn();
    syncFsBtn();
    if (muted) applyMute();

    // --- collapse / expand --------------------------------------------------
    var collapsible = declaredCollapse !== 'off';
    var collapseTimer = 0;

    function setState(next) {
      bar.setAttribute('data-state', next);
      var open = next === 'expanded';
      handle.setAttribute('aria-expanded', String(open));
      var label = open ? 'Close MixMash menu' : 'Open MixMash menu';
      handle.title = label;
      handle.setAttribute('aria-label', label);
      handle.firstChild.innerHTML = open ? '&#10005;' : '&#9776;';
    }

    function expand() {
      setState('expanded');
      arm();
    }

    function collapse(restoreFocus) {
      clearTimeout(collapseTimer);
      if (!collapsible) return;
      var focusInside = bar.contains(document.activeElement) && document.activeElement !== handle;
      setState('collapsed');
      if (focusInside || restoreFocus) { try { handle.focus(); } catch (e) { /* detached */ } }
    }

    function engaged() {
      var hovering = false;
      try { hovering = bar.matches(':hover'); } catch (e) { /* unsupported */ }
      return hovering || bar.contains(document.activeElement);
    }

    function arm() {
      clearTimeout(collapseTimer);
      if (!collapsible) return;
      collapseTimer = setTimeout(function () {
        // Never close under a pointer or a keyboard user.
        if (engaged()) { arm(); return; }
        collapse(false);
      }, COLLAPSE_MS);
    }

    handle.addEventListener('click', function () {
      if (bar.getAttribute('data-state') === 'expanded') collapse(false); else expand();
    });
    // Interacting with the open bar keeps it open a little longer.
    ['pointerdown', 'focusin', 'keydown'].forEach(function (type) {
      bar.addEventListener(type, function () {
        if (bar.getAttribute('data-state') === 'expanded') arm();
      });
    });
    // Escape closes the open bar and then carries on to the page. A game binds Escape
    // to pause or to close its own menu, and focus can sit in the nav after a click on
    // Mute All, so the bar must never swallow the key (a bar that cannot collapse has
    // nothing to close and ignores it entirely).
    bar.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && collapsible && bar.getAttribute('data-state') === 'expanded') {
        collapse(true);
      }
    });

    // --- slot ---------------------------------------------------------------
    var slot = 'top-left';
    function setSlot(name, offsets) {
      if (SLOTS.indexOf(name) === -1) name = 'top-left';
      slot = name;
      bar.setAttribute('data-slot', name);
      var o = offsets || {};
      ['top', 'right', 'bottom', 'left'].forEach(function (side) {
        var value = Number(o[side]) || 0;
        if (value) bar.style.setProperty('--mixnav-offset-' + side, value + 'px');
        else bar.style.removeProperty('--mixnav-offset-' + side);
      });
      return slot;
    }

    function setCollapsible(value) {
      collapsible = !!value;
      bar.setAttribute('data-collapsible', String(collapsible));
      if (!collapsible) {
        clearTimeout(collapseTimer);
        setState('expanded');
      } else {
        expand();
      }
    }

    setSlot(declaredSlot || 'top-left');
    bar.setAttribute('data-collapsible', String(collapsible));
    setState('expanded');
    if (collapsible) arm();

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
      expand: expand,
      collapse: function () { collapse(false); },
      isCollapsed: function () { return bar.getAttribute('data-state') === 'collapsed'; },
      setSlot: setSlot,
      getSlot: function () { return slot; },
      setCollapsible: setCollapsible,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build, { once: true });
  } else {
    build();
  }
})();
