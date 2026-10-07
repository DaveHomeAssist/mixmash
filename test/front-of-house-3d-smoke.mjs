// Full application integration: safe gestures, renderer recovery and identical saved-show outcomes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer, launchOptions } from './static-server.mjs';
import { createGame, applyAction } from '../front-of-house/engine.mjs';
import { STARTER_LAYOUT, SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const server = await startStaticServer(), browser = await chromium.launch(launchOptions());
const output = process.env.FRONT_OF_HOUSE_3D_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-3d-game-'));
await mkdir(output, { recursive: true });
const code = s => Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state: s })).toString('base64');
let fixture = createGame(170);
for (const action of [{ type: 'chooseDeal', deal: 'door', artistId: 'sodium-arcade' }, { type: 'setLayout', objects: STARTER_LAYOUT }]) {
  const result = applyAction(fixture, action); assert.equal(result.error, null); fixture = result.state;
}
const errors = [];
async function open(three, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${server.origin}/front-of-house/?renderer=${three ? '3d' : '2d'}`);
  await page.waitForFunction(() => window.__frontOfHouse);
  await page.evaluate(save => __frontOfHouse.importCode(save), code(fixture));
  if (three) await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
  return { page, context };
}
const state = page => page.evaluate(() => __frontOfHouse.state());
try {
  const preferenceContext = await browser.newContext({ viewport: { width: 1024, height: 700 }, serviceWorkers: 'block' });
  const preferencePage = await preferenceContext.newPage();
  await preferencePage.goto(`${server.origin}/front-of-house/`);
  await preferencePage.waitForFunction(() => window.__frontOfHouse?.rendererStatus().active);
  assert.equal(await preferencePage.locator('#game-version').innerText(), 'v0.1.0');
  assert.equal(await preferencePage.evaluate(() => localStorage.getItem('front_of_house_renderer')), null, 'implicit 3D default is not mistaken for an explicit choice');
  await preferencePage.click('#renderer-btn');
  await preferencePage.waitForFunction(() => !__frontOfHouse.rendererStatus().enabled);
  assert.equal(await preferencePage.evaluate(() => localStorage.getItem('front_of_house_renderer')), '2d');
  await preferencePage.reload(); await preferencePage.waitForFunction(() => window.__frontOfHouse);
  assert.equal(await preferencePage.evaluate(() => __frontOfHouse.rendererStatus().enabled), false, 'explicit 2D survives reload');
  await preferencePage.click('#renderer-btn'); await preferencePage.waitForFunction(() => __frontOfHouse.rendererStatus().active);
  assert.equal(await preferencePage.evaluate(() => localStorage.getItem('front_of_house_renderer')), '3d');
  await preferencePage.goto(`${server.origin}/front-of-house/?renderer=2d`); await preferencePage.waitForFunction(() => window.__frontOfHouse);
  assert.equal(await preferencePage.evaluate(() => __frontOfHouse.rendererStatus().enabled), false, 'query override supports deterministic classic journeys');
  assert.equal(await preferencePage.evaluate(() => localStorage.getItem('front_of_house_renderer')), '3d', 'query override does not replace the player preference');
  await preferencePage.goto(`${server.origin}/front-of-house/`); await preferencePage.waitForFunction(() => __frontOfHouse.rendererStatus().active);
  await preferenceContext.close();
  const { page, context } = await open(true, { width: 1920, height: 1080 }), baseline = await state(page);
  assert.deepEqual(await page.evaluate(() => { const canvas = document.querySelector('.lot-webgl'); return [canvas.width, canvas.height]; }), [2880, 1620], 'full application uses the documented large-screen backing rule');
  await page.evaluate(() => __frontOfHouse.boardCamera({ yaw: 37, pitch: 48, zoom: 1 }));
  const point = await page.evaluate(() => __frontOfHouse.boardClientOf(12.5, 8.5));
  await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x + 70, point.y + 25, { steps: 6 }); await page.mouse.up();
  assert.deepEqual(await state(page), baseline, 'orbit cannot change the layout, cash or save');
  assert.notEqual(await page.evaluate(() => __frontOfHouse.boardCamera().yaw), 37);
  // One drag with a placement tool previews only; a second finger never commits it.
  await page.keyboard.press('5');
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 0 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 0 }, { x: point.x + 60, y: point.y, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - 20, y: point.y + 10, id: 0 }, { x: point.x + 90, y: point.y + 10, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.deepEqual(await state(page), baseline, 'pinch during placement cannot place or charge');
  assert.equal(await page.evaluate(() => __frontOfHouse.buildTools().undo), 0);
  await page.evaluate(() => __frontOfHouse.boardCamera({ yaw: 37, pitch: 48, zoom: 1 }));
  const empty = await page.evaluate(() => __frontOfHouse.boardClientOf(10.5, 10.5));
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: empty.x, y: empty.y, id: 0 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: empty.x + 50, y: empty.y, id: 0 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.deepEqual(await state(page), baseline, 'cancelled placement drag does not commit');
  await page.touchscreen.tap(empty.x, empty.y);
  assert.equal((await state(page)).venue.objects.length, baseline.venue.objects.length + 1, 'intentional placement tap adds exactly one object');
  assert.equal(await page.evaluate(() => __frontOfHouse.buildTools().undo), 1);
  await page.locator('#board').focus(); await page.keyboard.press('Control+z');
  assert.deepEqual(await state(page), baseline, 'one undo reverses one placement');
  await page.keyboard.press('Escape');
  await page.evaluate(() => __frontOfHouse.boardPreset('plan'));
  const stage = await page.evaluate(() => __frontOfHouse.boardClientOf(12, 1.5, 0.57));
  await page.touchscreen.tap(stage.x, stage.y);
  assert.equal(await page.locator('#win-title').innerText(), 'Stage');
  await page.keyboard.press('Escape');
  await page.click('#menu-btn'); await page.click('[data-act="camera-open"]');
  await page.click('[data-camera-preset="wide"]'); await page.click('[data-camera-orbit="left"]');
  assert.equal(await page.evaluate(() => __frontOfHouse.boardCamera().yaw), 30);
  await page.keyboard.press('Escape');
  // Context failure changes renderer, not simulation; restoration resumes the current show.
  await page.evaluate(() => { window.loss = document.querySelector('.lot-webgl').getContext('webgl2').getExtension('WEBGL_lose_context'); loss.loseContext(); });
  await page.waitForFunction(() => __frontOfHouse.rendererStatus().backend === 'lost' && !__frontOfHouse.rendererStatus().active);
  assert.deepEqual(await state(page), baseline);
  await page.evaluate(() => loss.restoreContext()); await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
  assert.deepEqual(await state(page), baseline);
  assert.ok(!(await page.locator('#board-status').innerText()).includes('unavailable'), 'recovery clears stale failure feedback');
  await page.screenshot({ path: join(output, 'desktop.png') });
  for (const [width, height] of [[375, 812], [2560, 720]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(([w, h]) => { const v = __frontOfHouse.boardCamera().viewport; return v.w === w && v.h === h; }, [width, height]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
    await page.click('#menu-btn'); await page.click('[data-act="camera-open"]');
    const fit = await page.evaluate(() => { const w = document.querySelector('#win .win'), b = document.querySelector('#win-body'), r = w.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && b.scrollHeight <= b.clientHeight; });
    assert.equal(fit, true, 'camera controls fit without panel/page scrolling');
    await page.keyboard.press('Escape'); await page.screenshot({ path: join(output, `${width}.png`) });
  }
  await context.close();
  // Same saved show and fixed settlement timestamp in both real clients, with camera changes and reload mid-show.
  const outcomes = [];
  for (const three of [false, true]) {
    const { page: p, context: c } = await open(three);
    await p.evaluate(() => { __frontOfHouse.act({ type: 'confirmBuild' }); __frontOfHouse.act({ type: 'setPromotion', price: 20, ads: { flyers: 0, social: 150, radio: 150 } }); __frontOfHouse.act({ type: 'confirmPromotion' }); });
    if (three) await p.evaluate(() => __frontOfHouse.boardCamera({ yaw: 135, pitch: 85, zoom: 3 }));
    const before = await state(p); await p.reload(); await p.waitForFunction(() => window.__frontOfHouse);
    if (three) await p.waitForFunction(() => __frontOfHouse.rendererStatus().active);
    assert.deepEqual(await state(p), before, 'reload during the show retains the full state');
    const outcome = await p.evaluate(async () => {
      const { settlementFor } = await import('/front-of-house/engine.mjs');
      if (__frontOfHouse.state().show.incidentId !== 'pa-dropout') throw new Error('Unexpected deterministic fixture incident');
      __frontOfHouse.act({ type: 'respond', responseId: 'wait' });
      const settlement = settlementFor(__frontOfHouse.state());
      __frontOfHouse.act({ type: 'acceptSettlement', at: '2026-10-04T00:00:00.000Z' });
      return { settlement, state: __frontOfHouse.state() };
    }); outcomes.push(outcome); await c.close();
  }
  assert.deepEqual(outcomes[1], outcomes[0], 'complete settlement, cash, history and normalized state must match');
  // A missing module is an expected failure, caught by the adapter with a playable classic board.
  const blocked = await browser.newContext({ serviceWorkers: 'block' }), p = await blocked.newPage();
  await p.route('**/lot-renderer.mjs', route => route.abort());
  await p.goto(`${server.origin}/front-of-house/?renderer=3d`); await p.waitForFunction(() => window.__frontOfHouse?.rendererStatus().reason.includes('could not start'));
  await p.locator('[data-deal="door"]').first().click(); assert.equal((await state(p)).phase, 'build');
  assert.equal(await p.evaluate(() => __frontOfHouse.board().renderer), 'canvas-2d');
  const beforeRetry = await state(p);
  await p.unroute('**/lot-renderer.mjs');
  await p.click('#menu-btn'); await p.click('[data-act="camera-open"]'); await p.click('[data-act="renderer-retry"]');
  await p.waitForFunction(() => __frontOfHouse.rendererStatus().active);
  assert.deepEqual(await state(p), beforeRetry, 'retry after module failure preserves the show');
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log(`3D application smoke passed: gestures, inspection, accessible controls, context and module fallback, viewport fit, reload and complete settlement parity. Screenshots: ${output}`);
} finally { await browser.close(); await server.close(); }
