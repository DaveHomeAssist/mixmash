// Gritty's Hockey Havoc: loads the shipped player code, config and fixed-step loop from
// hockey-havoc/index.html in a vm sandbox and checks the slice-1 movement contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../hockey-havoc/index.html', import.meta.url), 'utf8');
// The game's own inline script is the block that defines the player (the page has other inline scripts)
const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('class GrittyPlayer'));
assert.ok(src, 'game script block found');
const cut = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `marker pair present: ${from}`);
  return src.slice(a, b);
};

function load() {
  const code =
    cut('const GAME_CONFIG', '/**\n         * Game State Management') +
    cut('const state = {', '// Canvas Setup') +
    cut('class GrittyPlayer', '/**\n         * Interactive Entities') +
    cut('const FIXED_STEP_MS', 'let lastTime = performance.now();');
  const stubs = `var sound = { jump(){}, slapShot(){}, playerHurt(){} };
    function spawnIceSpray(){} function showToast(){} function updateHUD(){}
    function triggerScreenShake(){} function gameOver(){} function restockCrate(){ return false; }`;
  const ctx = vm.createContext({ Math, Date });
  vm.runInContext(`${stubs}\n${code}\nthis.api = { GrittyPlayer, state, GAME_CONFIG, advanceSimulation, resetAcc: () => { stepAccumulator = 0; } };`, ctx);
  return ctx.api;
}

const { GrittyPlayer, state, GAME_CONFIG, advanceSimulation, resetAcc } = load();
const floor = { x: -100, y: 520, w: 4200, h: 100 };
const keys = (o = {}) => Object.assign(state.keys, { left: false, right: false, jump: false, slide: false, shoot: false }, o);
const feet = (p) => p.y + p.currentH();

test('power slide keeps the skates on the ice and lasts while held', () => {
  const p = new GrittyPlayer(100, 458);
  keys({ right: true });
  for (let i = 0; i < 40; i++) p.update([floor]);
  keys({ right: true, slide: true });
  for (let i = 0; i < 30; i++) {
    p.update([floor]);
    assert.ok(p.isSliding, `sliding at step ${i}`);
    assert.ok(Math.abs(feet(p) - 520) < 0.6, `feet on ice at step ${i}`);
  }
  keys({ right: true });
  for (let i = 0; i < 30; i++) p.update([floor]);
  assert.equal(p.isSliding, false);
  assert.ok(Math.abs(feet(p) - 520) < 0.6);
});

test('slide passes under a low platform and stays crouched until clear', () => {
  const low = { x: 1000, y: 460, w: 120, h: 22 };
  const p = new GrittyPlayer(700, 458);
  keys({ right: true });
  for (let i = 0; i < 30; i++) p.update([floor, low]);
  keys({ right: true, slide: true });
  let released = false;
  for (let i = 0; i < 120; i++) {
    const covered = () => p.x + p.w > low.x && p.x < low.x + low.w;
    if (covered() && !released) { keys({ right: true }); released = true; }
    p.update([floor, low]);
    if (covered()) assert.ok(p.isSliding, 'crouched while covered');
  }
  assert.ok(released && p.x > low.x + low.w && !p.isSliding);
});

test('coyote time, one double jump, then the press is buffered', () => {
  const ledge = { x: -100, y: 400, w: 400, h: 22 };
  const plats = [floor, ledge];
  const p = new GrittyPlayer(100, 338);
  keys({ right: true });
  let guard = 0;
  while ((p.grounded || guard < 2) && guard < 200) { p.update(plats); guard++; }
  p.update(plats); p.update(plats);
  keys({ right: true, jump: true });
  p.queueJump(); p.update(plats);
  assert.equal(p.vy, GAME_CONFIG.jumpForce + GAME_CONFIG.gravity, 'full jump inside the coyote window');
  for (let i = 0; i < 12; i++) p.update(plats);
  p.queueJump(); p.update(plats);
  assert.equal(p.vy, GAME_CONFIG.doubleJumpForce + GAME_CONFIG.gravity, 'double jump');
  p.queueJump(); p.update(plats);
  assert.ok(p.jumpBufferTimer > 0, 'third press buffered');
});

test('buffered jump fires on landing', () => {
  const p = new GrittyPlayer(100, 458);
  keys({ jump: true });
  p.update([floor]);
  p.queueJump(); p.update([floor]);
  while (p.vy < 0) p.update([floor]);
  p.queueJump(); p.update([floor]);
  while (p.vy < 0) p.update([floor]);
  while (520 - feet(p) > 40) p.update([floor]);
  p.queueJump();
  let fired = false;
  for (let i = 0; i <= GAME_CONFIG.jumpBufferFrames && !fired; i++) {
    p.update([floor]);
    fired = p.vy === GAME_CONFIG.jumpForce;
  }
  assert.ok(fired);
});

test('early release gives a lower hop that still clears the first platform', () => {
  const apex = (hold) => {
    const p = new GrittyPlayer(100, 458);
    keys({ jump: true });
    p.update([floor]);
    p.queueJump();
    let min = 520, s = 0;
    do { if (s === hold) keys(); p.update([floor]); min = Math.min(min, feet(p)); s++; } while (p.vy < 0 && s < 200);
    return 520 - min;
  };
  const full = apex(Infinity), press67ms = apex(4), tap = apex(1);
  assert.ok(full > press67ms && press67ms > tap);
  assert.ok(press67ms > 90, `67 ms press reaches ${press67ms.toFixed(0)} px`);
});

test('fixed timestep: same distance per second at 60, 120 and 144 Hz', () => {
  const run = (hz) => {
    resetAcc();
    const p = new GrittyPlayer(200, 458);
    keys({ right: true });
    for (let i = 0; i < hz; i++) advanceSimulation(1000 / hz, () => p.update([floor]));
    return p.x - 200;
  };
  const d = [run(60), run(120), run(144)];
  assert.ok(Math.max(...d) - Math.min(...d) < 10, d.map(n => n.toFixed(0)).join('/'));
  resetAcc();
  assert.ok(advanceSimulation(5000, () => {}) <= 15, 'stall catch-up capped');
});

test('no damage while celebrating a goal', () => {
  const p = new GrittyPlayer(100, 458);
  state.health = 3; state.celebrating = true;
  p.hurt();
  assert.equal(state.health, 3);
  state.celebrating = false;
  p.hurt();
  assert.equal(state.health, 2);
});
