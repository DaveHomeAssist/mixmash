// Loam Shell preview: real room controls, pick-through guides, recovery and seated two-night parity.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';
import { createGame, applyAction, showPreview, settlementFor } from '../front-of-house/engine.mjs';
import { VENUES, SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const server = await startStaticServer(), browser = await chromium.launch(launchOptions());
const url = process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
const output = process.env.FRONT_OF_HOUSE_SHELL_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-shell-3d-'));
await mkdir(output, { recursive: true });
function fixture(venue = 'amphitheater', build = true) {
  let s = createGame(3, { mode: 'sandbox' });
  const actions = [{ type: 'chooseVenue', venueId: venue }];
  if (build) actions.push({ type: 'chooseDeal', deal: 'door', artistId: VENUES[venue].defaultArtist, nights: 2 }, { type: 'setLayout', objects: VENUES[venue].starter });
  for (const a of actions) { const r = applyAction(s, a); assert.equal(r.error, null); s = r.state; }
  return s;
}
const code = state => Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state })).toString('base64');
const state = p => p.evaluate(() => __frontOfHouse.state());
const load = (p, s) => p.evaluate(c => __frontOfHouse.importCode(c), code(s));
const ready = p => p.waitForFunction(() => __frontOfHouse.rendererStatus().active && __frontOfHouse.board().venue === 'amphitheater');
const fit = async p => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
const errors = [], results = [];
try {
  for (const [width, height] of [[1440, 900], [375, 812], [2560, 720]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' }), p = await context.newPage();
    const failures = trackPageFailures(p, new URL(url).origin);
    await p.goto(`${url}?renderer=3d`); await p.waitForFunction(() => window.__frontOfHouse); await load(p, fixture()); await ready(p);
    const original = await state(p), info = await p.evaluate(() => __frontOfHouse.board());
    assert.deepEqual(info.grid, { w: 28, h: 18 }); assert.equal(info.seatingGuides.capacity, 400); assert.equal(info.seatingGuides.ids.length, 12);
    for (const yaw of [37, 135]) {
      const picked = await p.evaluate(yaw => { __frontOfHouse.boardCamera({ yaw, pitch: 48, zoom: 1 }); const p = __frontOfHouse.boardClientOf(27.5, 17.5); return __frontOfHouse.boardTileAt(p.x, p.y); }, yaw);
      assert.deepEqual(picked, { x: 27, y: 17 });
    }
    for (const preset of ['wide', 'foh', 'stage', 'plan']) {
      assert.equal(await p.evaluate(n => __frontOfHouse.boardPreset(n), preset), true); await fit(p);
      assert.deepEqual(await state(p), original); await p.screenshot({ path: join(output, `${width}-${preset}.png`) });
    }
    // The guide is decoration: a real click places an ordinary prop on its tile.
    await p.keyboard.press('5'); const guide = await p.evaluate(() => __frontOfHouse.boardClientOf(7.5, 5.02));
    await p.touchscreen.tap(guide.x, guide.y); const edited = await state(p);
    assert.equal(edited.venue.objects.length, original.venue.objects.length + 1);
    assert.ok(edited.venue.objects.some(o => o.type === 'bar' && o.x === 7 && o.y === 5));
    await p.keyboard.press('Escape');
    for (const room of ['club', 'amphitheater', 'lot', 'amphitheater', 'festival', 'amphitheater']) {
      await load(p, fixture(room, false));
      await p.waitForFunction(room => room === 'festival' ? !__frontOfHouse.rendererStatus().active : __frontOfHouse.rendererStatus().active && __frontOfHouse.board().venue === room, room);
      assert.ok(await p.locator('.lot-webgl').count() <= 1); assert.equal((await state(p)).venue.id, room);
    }
    await load(p, original); await ready(p);
    await p.evaluate(() => { window.shellLoss = document.querySelector('.lot-webgl').getContext('webgl2').getExtension('WEBGL_lose_context'); shellLoss.loseContext(); });
    await p.waitForFunction(() => !__frontOfHouse.rendererStatus().active); assert.deepEqual(await state(p), original);
    await p.evaluate(() => shellLoss.restoreContext()); await ready(p); assert.deepEqual(await state(p), original); await fit(p);
    assert.deepEqual(failures, []); await context.close(); console.log(`Shell ${width}: cameras, guides, room switching, recovery and fit pass`);
  }
  for (const width of [1440, 375]) for (const three of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' }), p = await context.newPage();
    const failures = trackPageFailures(p, new URL(url).origin);
    await p.goto(url + (three ? '?renderer=3d' : '')); await p.waitForFunction(() => window.__frontOfHouse); await load(p, fixture()); if (three) await ready(p);
    const actions = p.locator('#panel [data-tab-name="Actions"]:visible'); if (await actions.count()) await actions.click();
    await p.click('[data-act="confirm-build"]');
    const prices = p.locator('#panel [data-tab-name="Price and ads"]:visible'); if (await prices.count()) await prices.click();
    for (const [id, value] of [['price', 20], ['seat-price', 35], ['ad-flyers', 0], ['ad-social', 150], ['ad-radio', 150]]) await p.locator(`#${id}`).evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await p.click('[data-act="confirm-promo"]'); const opened = await state(p);
    assert.equal(opened.show.incidentId, 'rain'); assert.equal(showPreview(opened).attendance, 700); assert.equal(showPreview(opened).seated, 400);
    await p.reload(); await p.waitForFunction(() => window.__frontOfHouse); if (three) await ready(p); assert.deepEqual(await state(p), opened);
    if (three) { assert.equal((await p.evaluate(() => __frontOfHouse.board())).presentation.rain, true); await p.screenshot({ path: join(output, `${width}-rain.png`) }); }
    const receipts = [];
    for (const night of [1, 2]) {
      const tab = p.locator('#panel [data-tab-name="Problem"]:visible'); if (await tab.count()) await tab.click();
      await p.locator('[data-act="respond"]:not([disabled]):visible').first().click();
      const ended = await state(p), receipt = settlementFor(ended); assert.equal(ended.show.night, night); assert.equal(receipt.seated, Math.min(400, receipt.attendance));
      assert.equal(receipt.ticketGross, receipt.seated * 35 + (receipt.attendance - receipt.seated) * 20); receipts.push(receipt);
      await p.evaluate(() => __frontOfHouse.act({ type: 'acceptSettlement', at: '2026-10-04T00:00:00.000Z' }));
      if (night === 1) { assert.equal((await state(p)).show.night, 2); const saved = await state(p); await p.reload(); await p.waitForFunction(() => window.__frontOfHouse); if (three) await ready(p); assert.deepEqual(await state(p), saved); }
    }
    const final = await state(p); assert.equal(final.phase, 'done'); assert.equal(final.history.length, 2); await fit(p);
    results.push({ receipts, state: final }); assert.deepEqual(failures, []); await context.close(); console.log(`Shell ${width} ${three ? '3D' : 'classic'}: two-night seat/lawn receipts and reload pass`);
  }
  for (const result of results) assert.deepEqual(result, results[0]); assert.deepEqual(errors, []);
  console.log(`Shell technical preview passed; screenshots: ${output}`);
} finally { await browser.close(); await server.close(); }
