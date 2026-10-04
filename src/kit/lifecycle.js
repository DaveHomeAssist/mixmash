/**
 * MixKit lifecycle (Mobile & Tablet Fix Phase 1)
 *
 * One source for "the page is no longer the thing the player is looking at":
 * visibilitychange, pagehide / pageshow, freeze / resume, and window blur /
 * focus all collapse into two events a game can trust:
 *
 *   window 'mixkit:pause'   detail { reason, reasons }   first reason to arrive
 *   window 'mixkit:resume'  detail { reason }            last reason cleared
 *
 * A reason is one of 'hidden' (visibilitychange), 'pagehide', 'frozen'
 * (freeze) or 'blur' (window blur).
 *
 * A game subscribes once instead of wiring five listeners (and getting two of
 * them wrong). Pause and resume are edge-triggered: overlapping reasons (a tab
 * switch fires both blur and visibilitychange) produce ONE pause and ONE
 * resume.
 *
 * Audio: on pause, every AudioContext that nav.js tracks
 * (window.__mixmashNav.audioContexts) that is currently running is suspended.
 * On resume, only the contexts this module suspended are resumed, and never
 * while "Mute All" is on, so it cannot undo a player's choice.
 *
 *   MixKit.lifecycle.isPaused()      boolean
 *   MixKit.lifecycle.reasons()       active reasons, e.g. ['hidden', 'blur']
 *   MixKit.lifecycle.onPause(fn)     fn(detail); returns an unsubscribe function
 *   MixKit.lifecycle.onResume(fn)    fn(detail); returns an unsubscribe function
 *
 * Load it BEFORE the game's own scripts, like nav.js.
 */
(function attachMixKitLifecycle(global) {
  'use strict';

  var MixKit = global.MixKit = global.MixKit || {};
  if (MixKit.lifecycle) return;

  var doc = global.document;
  var active = {};          // reason -> true
  var suspendedByKit = [];  // AudioContexts this module suspended

  function reasonList() {
    var out = [];
    for (var key in active) if (active[key]) out.push(key);
    return out;
  }

  function emit(name, detail) {
    if (typeof global.dispatchEvent !== 'function' || typeof global.CustomEvent !== 'function') return;
    global.dispatchEvent(new global.CustomEvent(name, { detail: detail }));
  }

  function trackedContexts() {
    var nav = global.__mixmashNav;
    return (nav && nav.audioContexts) || [];
  }

  function suspendAudio() {
    var list = trackedContexts();
    for (var i = 0; i < list.length; i++) {
      var ctx = list[i];
      try {
        if (ctx.state === 'running') {
          suspendedByKit.push(ctx);
          ctx.suspend();
        }
      } catch (e) { /* context may be closed */ }
    }
  }

  function resumeAudio() {
    var nav = global.__mixmashNav;
    var muted = !!(nav && typeof nav.isMuted === 'function' && nav.isMuted());
    var list = suspendedByKit;
    suspendedByKit = [];
    if (muted) return; // the player muted while away; leave it suspended
    for (var i = 0; i < list.length; i++) {
      try {
        if (list[i].state === 'suspended') list[i].resume();
      } catch (e) { /* context may be closed */ }
    }
  }

  function add(reason) {
    var wasPaused = reasonList().length > 0;
    active[reason] = true;
    if (wasPaused) return;
    suspendAudio();
    emit('mixkit:pause', { reason: reason, reasons: reasonList() });
  }

  function clear(reason) {
    if (!active[reason]) return;
    delete active[reason];
    if (reasonList().length > 0) return;
    resumeAudio();
    emit('mixkit:resume', { reason: reason });
  }

  function syncVisibility() {
    if (doc && doc.hidden) { add('hidden'); return; }
    clear('hidden');
    // Some mobile browsers skip the focus event when an app returns to the
    // foreground; a visible, focused document must not stay "blurred".
    if (doc && typeof doc.hasFocus === 'function' && doc.hasFocus()) clear('blur');
  }

  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener('visibilitychange', syncVisibility);
    // Chrome fires freeze/resume on the document, others on window; take both.
    doc.addEventListener('freeze', function () { add('frozen'); });
    doc.addEventListener('resume', function () { clear('frozen'); });
  }
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('pagehide', function () { add('pagehide'); });
    global.addEventListener('pageshow', function () { clear('pagehide'); syncVisibility(); });
    global.addEventListener('freeze', function () { add('frozen'); });
    global.addEventListener('resume', function () { clear('frozen'); });
    global.addEventListener('blur', function (e) {
      // Only the window losing focus counts, not an element inside it.
      if (e && e.target && e.target.nodeType === 1) return;
      add('blur');
    });
    global.addEventListener('focus', function (e) {
      if (e && e.target && e.target.nodeType === 1) return;
      clear('blur');
    });
    // Safety net for the same missing focus event: a press on the page proves
    // the player is back.
    global.addEventListener('pointerdown', function () { clear('blur'); }, { capture: true, passive: true });
  }

  // A page restored hidden (opened in a background tab) starts paused.
  syncVisibility();

  function subscribe(name, fn) {
    var handler = function (e) { fn(e.detail); };
    global.addEventListener(name, handler);
    return function () { global.removeEventListener(name, handler); };
  }

  MixKit.lifecycle = {
    version: 1,
    isPaused: function () { return reasonList().length > 0; },
    reasons: reasonList,
    onPause: function (fn) { return subscribe('mixkit:pause', fn); },
    onResume: function (fn) { return subscribe('mixkit:resume', fn); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
