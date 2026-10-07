// Actual Club client: fixed scenery, safe placement, room switching, recovery and settlement parity.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer } from './static-server.mjs';
import { createGame, applyAction } from '../front-of-house/engine.mjs';
import { VENUES, SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const server = await startStaticServer(), browser = await chromium.launch(launchOptions());
const output = process.env.FRONT_OF_HOUSE_CLUB_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-club-3d-'));
await mkdir(output, { recursive: true });
function fixture(venue = 'club', build = true) {
  let s = createGame(170, { mode: 'sandbox' });
  const actions = [{ type: 'chooseVenue', venueId: venue }];
  if (build) actions.push({ type: 'chooseDeal', deal: 'door', artistId: VENUES[venue].defaultArtist }, { type: 'setLayout', objects: VENUES[venue].starter });
  for (const a of actions) { const r = applyAction(s, a); assert.equal(r.error, null); s = r.state; }
  return s;
}
const code = state => Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state })).toString('base64');
const state = p => p.evaluate(() => __frontOfHouse.state());
const load = (p, s) => p.evaluate(c => __frontOfHouse.importCode(c), code(s));
const errors = [], outcomes = [];
try {
  for (const width of [1440, 375]) {
    console.log(`Club viewport ${width}`);
    const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 }, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(`${server.origin}/front-of-house/?renderer=3d`); await p.waitForFunction(() => window.__frontOfHouse);
    await load(p, fixture()); await p.waitForFunction(() => __frontOfHouse.rendererStatus().active && __frontOfHouse.board().venue === 'club');
    const original = await state(p), info = await p.evaluate(() => __frontOfHouse.board());
    assert.deepEqual(info.grid, { w: 20, h: 14 }); assert.equal(info.permanent.filter(n => /^club-pillar-\d/.test(n)).length, 4);
    for (const yaw of [37, 135]) {
      const picked = await p.evaluate(yaw => { __frontOfHouse.boardCamera({ yaw, pitch: 48, zoom: 1 }); const p = __frontOfHouse.boardClientOf(19.5, 13.5); return __frontOfHouse.boardTileAt(p.x, p.y); }, yaw);
      assert.deepEqual(picked, { x: 19, y: 13 });
    }
    for (const preset of ['wide', 'foh', 'stage', 'plan']) {
      assert.equal(await p.evaluate(n => __frontOfHouse.boardPreset(n), preset), true);
      assert.deepEqual(await state(p), original);
      await p.screenshot({ path: join(output, `${width}-${preset}.png`) });
    }
    await p.keyboard.press('5');
    const pillar = await p.evaluate(() => __frontOfHouse.boardClientOf(6.5, 5.5, 3));
    await p.touchscreen.tap(pillar.x, pillar.y); assert.deepEqual(await state(p), original, 'a real placement tap on a pillar is rejected');
    await p.keyboard.press('Escape');
    const rig = await p.evaluate(() => __frontOfHouse.boardClientOf(10, 1.5, 3.02));
    await p.touchscreen.tap(rig.x, rig.y); assert.equal(await p.locator('#win-title').innerText(), '', 'opaque house suspension prevents selecting the stage behind it');
    const stage = await p.evaluate(() => __frontOfHouse.boardClientOf(10, 2.5, 0.57));
    assert.equal(await p.evaluate(pt => document.elementFromPoint(pt.x, pt.y)?.id, stage), 'board', 'noninteractive status text cannot intercept board taps');
    await p.touchscreen.tap(stage.x, stage.y); assert.equal(await p.locator('#win-title').innerText(), 'Stage'); await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
    // Switch back and forth after the module is already cached: no stale loading promise or duplicate canvas.
    for (const room of ['lot', 'club', 'festival', 'club', 'lot', 'club']) {
      await load(p, fixture(room, false));
      await p.waitForFunction(room => __frontOfHouse.rendererStatus().active && __frontOfHouse.board().venue === room, room);
      assert.ok(await p.locator('.lot-webgl').count() <= 1); assert.equal((await state(p)).venue.id, room);
    }
    await load(p, original); await p.waitForFunction(() => __frontOfHouse.board().venue === 'club');
    await p.evaluate(() => { window.clubLoss = document.querySelector('.lot-webgl').getContext('webgl2').getExtension('WEBGL_lose_context'); clubLoss.loseContext(); });
    await p.waitForFunction(() => !__frontOfHouse.rendererStatus().active); assert.deepEqual(await state(p), original);
    await p.evaluate(() => clubLoss.restoreContext()); await p.waitForFunction(() => __frontOfHouse.rendererStatus().active); assert.deepEqual(await state(p), original);
    await context.close();
  }
  for (const three of [false, true]) {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' }), p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message)); await p.goto(`${server.origin}/front-of-house/?renderer=${three ? '3d' : '2d'}`); await p.waitForFunction(() => window.__frontOfHouse);
    await load(p, fixture()); if (three) await p.waitForFunction(() => __frontOfHouse.rendererStatus().active && __frontOfHouse.board().venue === 'club');
    await p.click('[data-act="confirm-build"]'); await p.click('[data-act="confirm-promo"]');
    assert.equal((await state(p)).phase, 'show'); const before = await state(p); await p.reload(); await p.waitForFunction(() => window.__frontOfHouse);
    if (three) await p.waitForFunction(() => __frontOfHouse.rendererStatus().active); assert.deepEqual(await state(p), before);
    outcomes.push(await p.evaluate(async () => {
      const { INCIDENTS } = await import('/front-of-house/data.mjs'), { settlementFor } = await import('/front-of-house/engine.mjs');
      __frontOfHouse.act({ type: 'respond', responseId: INCIDENTS[__frontOfHouse.state().show.incidentId].responses[0].id });
      const settlement = settlementFor(__frontOfHouse.state()); __frontOfHouse.act({ type: 'acceptSettlement', at: '2026-10-04T00:00:00.000Z' }); return { settlement, state: __frontOfHouse.state() };
    }));
    assert.equal(outcomes.at(-1).state.phase, 'done'); await c.close();
  }
  assert.deepEqual(outcomes[0], outcomes[1]); assert.deepEqual(errors, []);
  console.log(`Club preview passes desktop/phone camera and pillar placement, room switching, context recovery, reload and exact classic/3D settlement parity. Screenshots: ${output}`);
} finally { await browser.close(); await server.close(); }
