// MixKit layer unit tests (input, lifecycle, stage math). The browser behaviour
// of the same files (real touch, real safe areas, real canvases) is covered by
// test/mobile-touch-smoke.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const plain = (value) => JSON.parse(JSON.stringify(value));
const read = (name) => readFile(new URL(`../src/kit/${name}`, import.meta.url), 'utf8');

function emitter() {
  const target = new EventTarget();
  return {
    addEventListener: (...args) => target.addEventListener(...args),
    removeEventListener: (...args) => target.removeEventListener(...args),
    dispatchEvent: (event) => target.dispatchEvent(event),
  };
}

// A sandbox "window" that is also its own global, with a controllable document.
function makeWindow({ coarse = false, maxTouchPoints = 0, innerWidth = 1024, innerHeight = 768, hidden = false } = {}) {
  const doc = {
    ...emitter(),
    hidden,
    focused: true,
    hasFocus() { return this.focused; },
    documentElement: { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } },
  };
  const win = {
    ...emitter(),
    CustomEvent,
    Event,
    setTimeout,
    clearTimeout,
    document: doc,
    navigator: { maxTouchPoints },
    innerWidth,
    innerHeight,
    devicePixelRatio: 2,
    matchMedia: (query) => ({
      matches: query === '(pointer: coarse)' ? coarse : false,
      addEventListener() {},
    }),
  };
  win.window = win;
  return win;
}

async function load(name, win) {
  vm.runInNewContext(await read(name), win, { filename: `src/kit/${name}` });
  return win.MixKit;
}

// --- input ---------------------------------------------------------------------

test('input: touch capability is a coarse pointer or any touch points, never a width', async () => {
  const coarse = await load('input.js', makeWindow({ coarse: true, innerWidth: 1366 }));
  assert.equal(coarse.input.touchCapable(), true, 'coarse pointer on a 1366 px iPad');

  const points = await load('input.js', makeWindow({ maxTouchPoints: 5, innerWidth: 1366 }));
  assert.equal(points.input.touchCapable(), true, 'touch points on a wide screen');

  const desktop = await load('input.js', makeWindow({ innerWidth: 600 }));
  assert.equal(desktop.input.touchCapable(), false, 'a narrow desktop window is not a touch device');

  const source = await read('input.js');
  assert.doesNotMatch(source, /innerWidth|outerWidth|screen\.width|clientWidth/, 'no width gates in input.js');
  assert.doesNotMatch(source, /(min|max)-(device-)?width/, 'no width media queries in input.js');
});

test('input: mode follows the last modality and announces changes', async () => {
  const win = makeWindow({ coarse: true });
  const kit = await load('input.js', win);
  assert.equal(kit.input.mode(), 'touch', 'a touch-capable device starts in touch mode');

  const seen = [];
  win.addEventListener('mixkit:input-mode', (e) => seen.push(e.detail));
  win.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerType: 'mouse' }));
  assert.equal(kit.input.mode(), 'mouse');
  win.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Shift' }));
  assert.equal(kit.input.mode(), 'mouse', 'a bare modifier says nothing');
  win.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Enter' }));
  assert.equal(kit.input.mode(), 'keyboard');
  win.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerType: 'touch' }));
  assert.equal(kit.input.mode(), 'touch');
  win.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerType: 'touch' }));

  assert.deepEqual(seen.map((d) => `${d.previous}>${d.mode}`), ['touch>mouse', 'mouse>keyboard', 'keyboard>touch']);
  assert.equal(win.document.documentElement.attrs['data-input-mode'], 'touch');
});

test('input: tap, long-press and two-finger pan', async () => {
  const win = makeWindow({ coarse: true });
  const kit = await load('input.js', win);
  const el = { ...emitter(), style: {}, setPointerCapture() {}, releasePointerCapture() {} };
  const log = [];
  const handle = kit.input.gestures(el, {
    onTap: (d) => log.push(['tap', d.pointerType]),
    onSecondary: (d) => log.push(['secondary', d.source]),
    onPanStart: () => log.push(['panStart']),
    onPan: (d) => log.push(['pan', d.dx, d.dy]),
    onPanEnd: (d) => log.push(['panEnd', d.totalDx, d.totalDy]),
  }, { longPressMs: 30, tapMaxMs: 200 });
  assert.equal(el.style.touchAction, 'none', 'the element owns its touches');

  const fire = (type, init) => el.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerType: 'touch', button: 0, ...init }));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Tap.
  fire('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
  fire('pointerup', { pointerId: 1, clientX: 12, clientY: 11 });
  assert.deepEqual(log.splice(0), [['tap', 'touch']]);

  // Long press fires the secondary action and suppresses the tap.
  fire('pointerdown', { pointerId: 2, clientX: 50, clientY: 50 });
  await sleep(80);
  fire('pointerup', { pointerId: 2, clientX: 50, clientY: 50 });
  assert.deepEqual(log.splice(0), [['secondary', 'long-press']]);

  // A drag past the slop is neither.
  fire('pointerdown', { pointerId: 3, clientX: 0, clientY: 0 });
  fire('pointermove', { pointerId: 3, clientX: 40, clientY: 0 });
  await sleep(80);
  fire('pointerup', { pointerId: 3, clientX: 40, clientY: 0 });
  assert.deepEqual(log.splice(0), []);

  // Two fingers pan by the movement of their midpoint.
  fire('pointerdown', { pointerId: 4, clientX: 100, clientY: 100 });
  fire('pointerdown', { pointerId: 5, clientX: 200, clientY: 100 });
  fire('pointermove', { pointerId: 4, clientX: 110, clientY: 120 });
  fire('pointermove', { pointerId: 5, clientX: 210, clientY: 120 });
  fire('pointerup', { pointerId: 4, clientX: 110, clientY: 120 });
  fire('pointerup', { pointerId: 5, clientX: 210, clientY: 120 });
  const names = log.map((entry) => entry[0]);
  assert.deepEqual(names.slice(0, 1), ['panStart']);
  assert.equal(names.at(-1), 'panEnd');
  assert.ok(!names.includes('tap') && !names.includes('secondary'), 'a pan is not a tap or a long-press');
  const total = log.filter((entry) => entry[0] === 'pan').reduce((acc, entry) => [acc[0] + entry[1], acc[1] + entry[2]], [0, 0]);
  assert.deepEqual(total, [10, 20]);
  log.length = 0;

  // A right-click on a mouse is the same secondary action.
  const menu = Object.assign(new Event('contextmenu', { cancelable: true }), { clientX: 5, clientY: 6 });
  el.dispatchEvent(menu);
  assert.deepEqual(log, [['secondary', 'contextmenu']]);
  assert.equal(menu.defaultPrevented, true);

  handle.destroy();
});

// --- lifecycle -----------------------------------------------------------------

function fakeContext(state = 'running') {
  return {
    state,
    suspend() { this.state = 'suspended'; },
    resume() { this.state = 'running'; },
  };
}

async function lifecycleEnv({ muted = false, contexts = [] } = {}) {
  const win = makeWindow();
  win.__mixmashNav = { audioContexts: contexts, isMuted: () => muted };
  const kit = await load('lifecycle.js', win);
  const events = [];
  win.addEventListener('mixkit:pause', (e) => events.push(`pause:${e.detail.reason}`));
  win.addEventListener('mixkit:resume', (e) => events.push(`resume:${e.detail.reason}`));
  const hide = () => { win.document.hidden = true; win.document.dispatchEvent(new Event('visibilitychange')); };
  const show = () => { win.document.hidden = false; win.document.dispatchEvent(new Event('visibilitychange')); };
  return { win, kit, events, hide, show };
}

test('lifecycle: overlapping reasons produce one pause and one resume', async () => {
  const { win, kit, events, hide, show } = await lifecycleEnv();
  win.document.focused = false;
  win.dispatchEvent(new Event('blur'));
  hide();
  assert.equal(kit.lifecycle.isPaused(), true);
  assert.deepEqual(plain(kit.lifecycle.reasons()).sort(), ['blur', 'hidden']);
  show();
  assert.equal(kit.lifecycle.isPaused(), true, 'still blurred');
  win.document.focused = true;
  win.dispatchEvent(new Event('focus'));
  assert.equal(kit.lifecycle.isPaused(), false);
  assert.deepEqual(events, ['pause:blur', 'resume:blur']);
});

test('lifecycle: a visible, focused page never stays blurred when the focus event is skipped', async () => {
  const { win, kit, events, hide, show } = await lifecycleEnv();
  win.dispatchEvent(new Event('blur'));
  hide();
  show(); // document.hasFocus() is true again, but no focus event arrives
  assert.equal(kit.lifecycle.isPaused(), false);
  assert.deepEqual(events, ['pause:blur', 'resume:blur']);
});

test('lifecycle: pagehide, pageshow, freeze and resume are covered', async () => {
  const { win, events } = await lifecycleEnv();
  win.dispatchEvent(new Event('pagehide'));
  win.dispatchEvent(new Event('pageshow'));
  win.dispatchEvent(new Event('freeze'));
  win.dispatchEvent(new Event('resume'));
  assert.deepEqual(events, ['pause:pagehide', 'resume:pagehide', 'pause:frozen', 'resume:frozen']);
});

test('lifecycle: hidden suspends running audio and resume restores only what it suspended', async () => {
  const running = fakeContext('running');
  const alreadySuspended = fakeContext('suspended');
  const { hide, show } = await lifecycleEnv({ contexts: [running, alreadySuspended] });
  hide();
  assert.equal(running.state, 'suspended');
  assert.equal(alreadySuspended.state, 'suspended');
  show();
  assert.equal(running.state, 'running', 'restored');
  assert.equal(alreadySuspended.state, 'suspended', 'a context it did not suspend stays as it was');
});

test('lifecycle: never resumes audio while Mute All is on', async () => {
  const ctx = fakeContext('running');
  const { hide, show } = await lifecycleEnv({ muted: true, contexts: [ctx] });
  hide();
  assert.equal(ctx.state, 'suspended');
  show();
  assert.equal(ctx.state, 'suspended');
});

test('lifecycle: a page opened hidden starts paused; unsubscribe works', async () => {
  const win = makeWindow({ hidden: true });
  const kit = await load('lifecycle.js', win);
  assert.equal(kit.lifecycle.isPaused(), true);
  let calls = 0;
  const off = kit.lifecycle.onResume(() => { calls += 1; });
  win.document.hidden = false;
  win.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls, 1);
  off();
  win.dispatchEvent(new Event('blur'));
  win.dispatchEvent(new Event('focus'));
  assert.equal(calls, 1);
});

// --- stage ---------------------------------------------------------------------

test('stage: fitRect keeps the base aspect inside the available room', async () => {
  const { stage } = await load('stage.js', makeWindow());
  assert.deepEqual(plain(stage.fitRect(800, 600, 1600, 900)), { width: 800, height: 450, scale: 0.5 });
  assert.deepEqual(plain(stage.fitRect(1600, 400, 1600, 900)), { width: 711, height: 400, scale: 400 / 900 });
  assert.deepEqual(plain(stage.fitRect(0, 100, 16, 9)), { width: 0, height: 0, scale: 0 });
});

test('stage: backing store follows devicePixelRatio up to a configurable cap', async () => {
  const { stage } = await load('stage.js', makeWindow());
  assert.deepEqual(plain(stage.backingSize(400, 225, 3)), { width: 800, height: 450, dpr: 2 }, 'default cap is 2');
  assert.deepEqual(plain(stage.backingSize(400, 225, 3, 3)), { width: 1200, height: 675, dpr: 3 });
  assert.deepEqual(plain(stage.backingSize(400, 225, 1)), { width: 400, height: 225, dpr: 1 });
  assert.deepEqual(plain(stage.backingSize(400, 225, 0.5)), { width: 400, height: 225, dpr: 1 }, 'never below 1x');
});

test('stage: rotate prompt needs the opposite orientation and under half the screen', async () => {
  const { stage } = await load('stage.js', makeWindow());
  // MIXMASH-like: landscape game on a 390x844 portrait phone fits 390x219 (about 25%).
  assert.equal(stage.needsRotate('landscape', 390, 844, 390, 219), true);
  // The same game in landscape never prompts.
  assert.equal(stage.needsRotate('landscape', 844, 390, 693, 390), false);
  // No declared preference, no prompt.
  assert.equal(stage.needsRotate(undefined, 390, 844, 390, 219), false);
  // Opposite orientation but the canvas still fills 50% or more: no prompt.
  assert.equal(stage.needsRotate('landscape', 1000, 1100, 1000, 800), false);
  // A portrait game on a landscape screen prompts when it is tiny.
  assert.equal(stage.needsRotate('portrait', 844, 390, 180, 320), true);
});
