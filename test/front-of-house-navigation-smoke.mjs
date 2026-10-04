import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';
import * as E from '../front-of-house/engine.mjs';
import * as D from '../front-of-house/data.mjs';
import { overviewTransform } from '../front-of-house/site-map-geometry.mjs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const server = await startStaticServer(), browser = await chromium.launch(launchOptions()), output = await mkdtemp(join(tmpdir(), 'foh-navigation-'));
const url = process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
let fixture = E.createGame(8, { mode: 'sandbox' });
for (const a of [{ type: 'chooseVenue', venueId: 'festival' }, { type: 'chooseDeal', deal: 'guarantee', artistId: 'paper-voltage', secondId: 'hollow-census', stagePolicy: 1 }, { type: 'setLayout', objects: D.VENUES.festival.starter }]) { const r = E.applyAction(fixture, a); assert.equal(r.error, null); fixture = r.state; }
const code = s => Buffer.from(JSON.stringify({ ns: D.SAVE_NAMESPACE, v: D.SCHEMA_VERSION, state: s })).toString('base64');
const outcomes = [];
const saved = p => p.evaluate(() => __frontOfHouse.state());
async function noOverlap(p) {
  assert.deepEqual(await p.evaluate(() => { const m = document.querySelector('#site-map').getBoundingClientRect(); return [...document.querySelectorAll('#panel .plate, #panel .at-sheet, .topbar')].filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect()).filter(r => r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top).map(r => [r.x, r.y, r.width, r.height]); }), []);
}
try {
  for (const width of [1440, 1024]) for (const three of [false, true]) {
    const c = await browser.newContext({ viewport: { width, height: width === 1024 ? 700 : 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' }), p = await c.newPage();
    const errors = trackPageFailures(p, new URL(url).origin);
    await p.goto(url + (three ? '?renderer=3d' : '')); await p.waitForFunction(() => window.__frontOfHouse); await p.evaluate(c => __frontOfHouse.importCode(c), code(fixture));
    if (three) await p.waitForFunction(() => __frontOfHouse.rendererStatus().active);
    assert.equal(await p.locator('#site-map').isVisible(), false);
    await p.evaluate(() => __frontOfHouse.boardZoom(2)); await p.waitForFunction(() => __frontOfHouse.siteMap().visible); await noOverlap(p);
    const before = await saved(p);
    for (const turn of [0, 1, 2, 3]) {
      if (three) await p.evaluate(turn => __frontOfHouse.boardCamera({ yaw: [37, 135, 37, 135][turn], pitch: [15, 48, 85, 48][turn], zoom: turn === 2 ? 3 : 2 }), turn);
      else if (turn) await p.locator('#turn-view').click();
      await p.waitForTimeout(20);
      const info = await p.evaluate(() => __frontOfHouse.siteMap()), camera = await p.evaluate(() => __frontOfHouse.boardCamera()), nav = info.navigation;
      assert.equal(nav.width, three ? 52 : 40); assert.ok(nav.footprint.length >= 3);
      const map = overviewTransform(nav.width, nav.depth, nav.rotation), target = { x: three && turn % 2 ? 46 : 17, y: 10 }, q = map.project(target.x, target.y), rect = await p.locator('#site-map canvas').boundingBox();
      await p.keyboard.press('5'); await p.mouse.click(rect.x + q.x, rect.y + q.y);
      const moved = await p.evaluate(() => __frontOfHouse.boardCamera()); assert.ok(Math.abs(moved.x - target.x) < 0.05 && Math.abs(moved.y - target.y) < 0.05); assert.equal(moved.zoom, camera.zoom);
      assert.deepEqual(await saved(p), before, 'overview never places a bar or changes a save');
      await p.keyboard.press('ArrowLeft'); assert.notEqual((await p.evaluate(() => __frontOfHouse.boardCamera())).x, moved.x); assert.deepEqual(await saved(p), before);
      await noOverlap(p);
    }
    const mapRect = await p.locator('#site-map canvas').boundingBox(), pose = await p.evaluate(() => __frontOfHouse.boardCamera());
    await p.mouse.move(mapRect.x + 1, mapRect.y + 1); await p.mouse.down(); await p.mouse.move(mapRect.x - 40, mapRect.y - 40); await p.mouse.up();
    assert.deepEqual(await p.evaluate(() => __frontOfHouse.boardCamera()), pose, 'off-map drag ignores empty margins');
    if (three) { await p.evaluate(() => { __frontOfHouse.boardPreset('plan'); __frontOfHouse.boardZoom(2); }); await p.waitForTimeout(20); const r = await p.locator('#site-map canvas').boundingBox(); await p.mouse.click(r.x + 90, r.y + 55); assert.equal((await p.evaluate(() => __frontOfHouse.boardCamera())).pitch, 90); }
    const count = await p.evaluate(() => __frontOfHouse.siteMap().draws); await p.waitForTimeout(100); assert.equal(await p.evaluate(() => __frontOfHouse.siteMap().draws), count, 'unchanged map is reused');
    await p.screenshot({ path: join(output, `${width}-${three ? '3d' : 'classic'}.png`) });
    await p.locator('#site-map canvas').focus(); await p.keyboard.press('Home'); assert.equal(await p.locator('#site-map').isVisible(), false); assert.equal(await p.locator('#board').evaluate(e => e === document.activeElement), true);
    await p.evaluate(() => __frontOfHouse.boardZoom(2)); await p.waitForFunction(() => __frontOfHouse.siteMap().visible);
    await p.setViewportSize({ width: 375, height: 812 }); await p.waitForTimeout(100); assert.equal(await p.locator('#site-map').isVisible(), false); assert.deepEqual(await saved(p), before);
    await p.setViewportSize({ width, height: width === 1024 ? 700 : 900 }); await p.waitForFunction(() => __frontOfHouse.siteMap().visible); await noOverlap(p);
    if (three) {
      await p.locator('#menu-btn').click(); await p.locator('[data-act="camera-open"]').click(); await p.locator('[data-act="renderer-toggle"]').click();
      await p.waitForFunction(() => !__frontOfHouse.rendererStatus().active); await p.evaluate(() => __frontOfHouse.boardZoom(2)); await p.waitForFunction(() => __frontOfHouse.siteMap().visible); assert.equal((await p.evaluate(() => __frontOfHouse.siteMap())).navigation.width, 40);
      await p.locator('[data-act="renderer-toggle"]').click(); await p.waitForFunction(() => __frontOfHouse.rendererStatus().active); await p.waitForFunction(() => __frontOfHouse.siteMap().navigation.width === 52); await p.locator('#win [data-win="close"]').click(); assert.deepEqual(await saved(p), before);
      await p.evaluate(() => { window.mapLoss = document.querySelector('.lot-webgl').getContext('webgl2').getExtension('WEBGL_lose_context'); mapLoss.loseContext(); }); await p.waitForFunction(() => !__frontOfHouse.rendererStatus().active); assert.deepEqual(await saved(p), before);
      await p.evaluate(() => mapLoss.restoreContext()); await p.waitForFunction(() => __frontOfHouse.rendererStatus().active); await p.evaluate(() => __frontOfHouse.boardZoom(2)); await p.waitForFunction(() => __frontOfHouse.siteMap().visible); assert.equal((await p.evaluate(() => __frontOfHouse.siteMap())).navigation.width, 52);
    }
    await p.reload(); await p.waitForFunction(() => window.__frontOfHouse); if (three) await p.waitForFunction(() => __frontOfHouse.rendererStatus().active); assert.deepEqual(await saved(p), before); assert.equal(await p.locator('#site-map').isVisible(), false);
    await p.evaluate(() => __frontOfHouse.boardZoom(2)); await p.waitForFunction(() => __frontOfHouse.siteMap().visible);
    await p.locator('[data-act="confirm-build"]').click(); await p.waitForTimeout(50); await noOverlap(p); const promoted = await saved(p);
    await p.locator('#site-map canvas').focus(); await p.keyboard.press('ArrowRight'); assert.deepEqual(await saved(p), promoted);
    await p.locator('#confirm-promo').click(); await p.waitForTimeout(50); await noOverlap(p); const show = await saved(p);
    await p.locator('#site-map canvas').focus(); await p.keyboard.press('ArrowUp'); assert.deepEqual(await saved(p), show);
    await p.locator('[data-act="respond"]:not([disabled]):visible').first().click(); const ended = await saved(p); outcomes.push({ state: ended, receipt: E.settlementFor(ended) });
    await p.locator('#win [data-win="close"]').click(); await p.waitForTimeout(50); await noOverlap(p); await p.locator('#site-map canvas').focus(); await p.keyboard.press('ArrowDown'); assert.deepEqual(await saved(p), ended);
    for (const venue of ['lot', 'club', 'amphitheater']) { let s = E.createGame(8, { mode: 'sandbox' }); s = E.applyAction(s, { type: 'chooseVenue', venueId: venue }).state; await p.evaluate(c => __frontOfHouse.importCode(c), code(s)); await p.evaluate(() => __frontOfHouse.boardZoom(2)); assert.equal(await p.locator('#site-map').isVisible(), false); }
    assert.deepEqual(errors, []); await c.close(); console.log(`Overview ${width} ${three ? '3D' : 'classic'}: geometry, pan, keyboard, placement isolation, resize, recovery and reload pass`);
  }
  for (const outcome of outcomes) assert.deepEqual(outcome, outcomes[0]);
  console.log(`Site navigation passed. Screenshots: ${output}`);
} finally { await browser.close(); await server.close(); }
