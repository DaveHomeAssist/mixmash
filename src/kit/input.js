/**
 * MixKit input (Mobile & Tablet Fix Phase 1)
 *
 * One answer to "is this a touch device, and what is the player using right
 * now?", plus a small gesture vocabulary every game can share:
 *
 *   MixKit.input.touchCapable()   true when the device has a coarse pointer or
 *                                 any touch points. NEVER gated on screen width:
 *                                 a 1366 px iPad Pro is a touch device.
 *   MixKit.input.mode()           'touch' | 'mouse' | 'keyboard': the modality
 *                                 the player used last (starts as 'touch' on a
 *                                 touch-capable device, else 'mouse').
 *   MixKit.input.gestures(el, h)  tap, long-press (the secondary action) and
 *                                 two-finger pan on one element.
 *
 * Whenever the mode changes it sets data-input-mode on <html> and dispatches
 *   window 'mixkit:input-mode'  detail { mode, previous, touchCapable }
 *
 * Load it BEFORE the game's own scripts, like nav.js:
 *   <script src="../src/kit/input.js"></script>
 */
(function attachMixKitInput(global) {
  'use strict';

  var MixKit = global.MixKit = global.MixKit || {};
  if (MixKit.input) return;

  // --- capability -----------------------------------------------------------
  function touchCapable() {
    var coarse = false;
    try {
      coarse = !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
    } catch (e) { coarse = false; }
    var points = (global.navigator && global.navigator.maxTouchPoints) || 0;
    return coarse || points > 0;
  }

  // --- modality tracking ----------------------------------------------------
  var current = touchCapable() ? 'touch' : 'mouse';

  function publish(next) {
    if (next === current) return;
    var previous = current;
    current = next;
    var root = global.document && global.document.documentElement;
    if (root && root.setAttribute) root.setAttribute('data-input-mode', next);
    if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
      global.dispatchEvent(new global.CustomEvent('mixkit:input-mode', {
        detail: { mode: next, previous: previous, touchCapable: touchCapable() },
      }));
    }
  }

  function modeForPointer(event) {
    // A pen is a precise stylus on a touch device; treat it with touch.
    return event.pointerType === 'mouse' ? 'mouse' : 'touch';
  }

  function trackModality() {
    var root = global.document && global.document.documentElement;
    if (root && root.setAttribute) root.setAttribute('data-input-mode', current);
    if (typeof global.addEventListener !== 'function') return;
    var opts = { capture: true, passive: true };
    global.addEventListener('pointerdown', function (e) { publish(modeForPointer(e)); }, opts);
    global.addEventListener('pointermove', function (e) {
      // Only a real mouse moving counts: touch emits moves while dragging.
      if (e.pointerType === 'mouse') publish('mouse');
    }, opts);
    global.addEventListener('keydown', function (e) {
      // Modifier-only presses (and a soft keyboard's own chrome) say nothing.
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      publish('keyboard');
    }, opts);
    // A device that gains or loses a coarse pointer (a keyboard dock, say) can
    // change capability mid-session; re-announce so games re-read it.
    try {
      var mq = global.matchMedia && global.matchMedia('(pointer: coarse)');
      if (mq && mq.addEventListener) {
        mq.addEventListener('change', function () {
          if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
            global.dispatchEvent(new global.CustomEvent('mixkit:input-mode', {
              detail: { mode: current, previous: current, touchCapable: touchCapable() },
            }));
          }
        });
      }
    } catch (e) { /* matchMedia unavailable */ }
  }

  // --- gestures -------------------------------------------------------------
  var DEFAULTS = {
    longPressMs: 500,   // hold this long to fire the secondary action
    tapMaxMs: 350,      // a press longer than this is not a tap
    slop: 10,           // px of travel before a press stops being a tap
    touchAction: 'none' // the element must own its touches or the browser pans/zooms
  };

  function point(event) {
    return { x: event.clientX, y: event.clientY };
  }

  /**
   * gestures(element, handlers, options) -> { destroy() }
   *
   * handlers (all optional):
   *   onTap(detail)          a short press that did not travel
   *   onSecondary(detail)    a long-press (touch/pen) or a right-click (mouse):
   *                          the "right-click equivalent"
   *   onPanStart(detail)     two fingers down
   *   onPan(detail)          two fingers moving: detail.dx / dy since the last
   *                          call, detail.totalDx / totalDy since the start
   *   onPanEnd(detail)
   *
   * detail: { x, y, pointerType, source, originalEvent } (+ pan fields)
   */
  function gestures(element, handlers, options) {
    handlers = handlers || {};
    var cfg = {};
    var key;
    for (key in DEFAULTS) cfg[key] = DEFAULTS[key];
    if (options) for (key in options) cfg[key] = options[key];

    if (cfg.touchAction !== false && element.style) element.style.touchAction = cfg.touchAction;

    var pointers = {};      // pointerId -> { x, y, type }
    var count = 0;
    var primary = null;     // the one-finger press being timed
    var longTimer = 0;
    var panning = false;
    var panLast = null;
    var panTotal = { dx: 0, dy: 0 };

    function centre() {
      var sx = 0, sy = 0, n = 0, id;
      for (id in pointers) { sx += pointers[id].x; sy += pointers[id].y; n++; }
      return n ? { x: sx / n, y: sy / n } : { x: 0, y: 0 };
    }

    function clearTimer() {
      if (longTimer) { clearTimeout(longTimer); longTimer = 0; }
    }

    function fire(name, detail) {
      var fn = handlers[name];
      if (typeof fn === 'function') fn(detail);
    }

    function down(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY, type: e.pointerType };
      count++;
      try { element.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or lost */ }

      if (count === 1) {
        primary = {
          id: e.pointerId, startX: e.clientX, startY: e.clientY, at: Date.now(),
          moved: false, fired: false, type: e.pointerType, event: e,
        };
        if (e.pointerType !== 'mouse' && handlers.onSecondary) {
          clearTimer();
          longTimer = setTimeout(function () {
            longTimer = 0;
            if (!primary || primary.moved || count !== 1) return;
            primary.fired = true;
            fire('onSecondary', {
              x: primary.startX, y: primary.startY, pointerType: primary.type,
              source: 'long-press', originalEvent: primary.event,
            });
          }, cfg.longPressMs);
        }
      } else if (count === 2 && e.pointerType !== 'mouse') {
        // A second finger turns the press into a pan.
        clearTimer();
        if (primary) primary.moved = true;
        panning = true;
        panLast = centre();
        panTotal = { dx: 0, dy: 0 };
        fire('onPanStart', { x: panLast.x, y: panLast.y, pointerType: e.pointerType, originalEvent: e });
      }
    }

    function move(e) {
      var p = pointers[e.pointerId];
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (panning) {
        var c = centre();
        var dx = c.x - panLast.x, dy = c.y - panLast.y;
        panLast = c;
        panTotal.dx += dx;
        panTotal.dy += dy;
        fire('onPan', {
          x: c.x, y: c.y, dx: dx, dy: dy, totalDx: panTotal.dx, totalDy: panTotal.dy,
          pointerType: e.pointerType, originalEvent: e,
        });
        return;
      }
      if (primary && e.pointerId === primary.id && !primary.moved) {
        var tx = e.clientX - primary.startX, ty = e.clientY - primary.startY;
        if (tx * tx + ty * ty > cfg.slop * cfg.slop) {
          primary.moved = true;
          clearTimer();
        }
      }
    }

    function up(e) {
      var p = pointers[e.pointerId];
      if (!p) return;
      var wasPrimary = primary && e.pointerId === primary.id;
      delete pointers[e.pointerId];
      count--;
      try { element.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }

      if (panning && count < 2) {
        panning = false;
        fire('onPanEnd', {
          x: panLast ? panLast.x : e.clientX, y: panLast ? panLast.y : e.clientY,
          totalDx: panTotal.dx, totalDy: panTotal.dy, pointerType: e.pointerType, originalEvent: e,
        });
      }
      if (wasPrimary) {
        clearTimer();
        var press = primary;
        primary = null;
        if (e.type === 'pointerup' && !press.moved && !press.fired && Date.now() - press.at <= cfg.tapMaxMs) {
          fire('onTap', {
            x: e.clientX, y: e.clientY, pointerType: press.type,
            source: 'tap', originalEvent: e,
          });
        }
      }
      if (count === 0) { primary = null; panning = false; }
    }

    function contextmenu(e) {
      // Touch browsers raise a context menu on long-press; the long-press is
      // already our secondary action, so keep the callout out of the way.
      if (e.pointerType === 'touch' || (primary && primary.type !== 'mouse') || count > 0) {
        e.preventDefault();
        return;
      }
      if (handlers.onSecondary) {
        e.preventDefault();
        fire('onSecondary', {
          x: e.clientX, y: e.clientY, pointerType: 'mouse',
          source: 'contextmenu', originalEvent: e,
        });
      }
    }

    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.addEventListener('contextmenu', contextmenu);

    return {
      destroy: function () {
        clearTimer();
        element.removeEventListener('pointerdown', down);
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', up);
        element.removeEventListener('pointercancel', up);
        element.removeEventListener('contextmenu', contextmenu);
        pointers = {};
        count = 0;
        primary = null;
        panning = false;
      },
    };
  }

  MixKit.input = {
    version: 1,
    touchCapable: touchCapable,
    mode: function () { return current; },
    gestures: gestures,
    defaults: DEFAULTS,
  };

  trackModality();
})(typeof window !== 'undefined' ? window : globalThis);
