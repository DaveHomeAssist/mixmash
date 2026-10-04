// Split Acre: fixed side-stage annex, actual accounting allocation and unchanged classic/3D outcomes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';
import * as E from '../front-of-house/engine.mjs';
import * as D from '../front-of-house/data.mjs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const geometryOnly = process.argv.includes('--geometry-only');
const server = await startStaticServer(), browser = await chromium.launch(launchOptions());
const url = process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
const output = process.env.FRONT_OF_HOUSE_FESTIVAL_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-festival-3d-'));
await mkdir(output, { recursive: true });
function fixture(policy = false, venue = 'festival', build = true) {
  let s = E.createGame(8, { mode: 'sandbox' });
  const step = a => { const r = E.applyAction(s, a); assert.equal(r.error, null, a.type); s = r.state; };
  step({ type: 'chooseVenue', venueId: venue });
  if (build) {
    step({ type: 'chooseDeal', deal: 'guarantee', artistId: E.offersFor(s)[0], secondId: 'hollow-census', ...(policy ? { stagePolicy: 1 } : {}) });
    if (policy) assert.equal(s.booking.stages?.version, 1, 'Versioned stage authority must be integrated; geometry-only mode is not full acceptance');
    step({ type: 'setLayout', objects: D.VENUES[venue].starter });
  }
  return s;
}
const code = s => Buffer.from(JSON.stringify({ ns: D.SAVE_NAMESPACE, v: D.SCHEMA_VERSION, savedAt: 0, state: s })).toString('base64');
const state = p => p.evaluate(() => __frontOfHouse.state());
const load = (p, s) => p.evaluate(c => __frontOfHouse.importCode(c), code(s));
const ready = p => p.waitForFunction(() => __frontOfHouse.rendererStatus().active && __frontOfHouse.board().venue === 'festival');
const fit = async p => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
const tab = async (p, name) => { const t = p.locator(`#panel [data-tab-name="${name}"]:visible`); if (await t.count()) await t.click(); };
try {
  for (const [width, height] of [[1440, 900], [375, 812], [2560, 720]]) {
    const c = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' }), p = await c.newPage();
    const errors = trackPageFailures(p, new URL(url).origin);
    await p.goto(`${url}?renderer=3d`); await p.waitForFunction(() => window.__frontOfHouse); await load(p, fixture()); await ready(p);
    const original = await state(p), info = await p.evaluate(() => __frontOfHouse.board());
    assert.deepEqual(info.grid, { w: 40, h: 24 }); assert.deepEqual(info.presentationExtent, { w: 52, h: 24 }); assert.equal(info.secondaryStage.booked, true);
    for (const yaw of [37, 135]) {
      const pick = await p.evaluate(yaw => { __frontOfHouse.boardCamera({ yaw, pitch: 48, zoom: 1 }); const p = __frontOfHouse.boardClientOf(39.5, 23.5), side = __frontOfHouse.boardClientOf(46, 10); return { main: __frontOfHouse.boardTileAt(p.x, p.y), side: __frontOfHouse.boardTileAt(side.x, side.y) }; }, yaw);
      assert.deepEqual(pick, { main: { x: 39, y: 23 }, side: null });
    }
    for (const preset of ['wide', 'foh', 'stage', 'plan', 'side']) {
      assert.equal(await p.evaluate(preset => __frontOfHouse.boardPreset(preset), preset), true); await fit(p);
      assert.deepEqual(await state(p), original); await p.screenshot({ path: join(output, `${width}-${preset}.png`) });
    }
    await p.evaluate(() => __frontOfHouse.boardPreset('plan')); await p.keyboard.press('5');
    const outside = await p.evaluate(() => __frontOfHouse.boardClientOf(46, 10)); await p.touchscreen.tap(outside.x, outside.y); assert.deepEqual(await state(p), original, 'fixed annex never becomes editable land'); await p.keyboard.press('Escape');
    await p.locator('#menu-btn').click(); await p.locator('[data-act="camera-open"]').click();
    await p.locator('[data-camera-preset="side"]').focus(); await p.keyboard.press('Enter');
    assert.equal((await p.evaluate(() => __frontOfHouse.boardCamera())).x, 46); await fit(p); await p.keyboard.press('Escape');
    for (const room of ['club', 'amphitheater', 'festival', 'lot', 'festival']) {
      await load(p, fixture(false, room, false)); await p.waitForFunction(room => __frontOfHouse.rendererStatus().active && __frontOfHouse.board().venue === room, room);
      assert.equal(await p.locator('.lot-webgl').count(), 1); assert.equal((await state(p)).venue.id, room);
    }
    await load(p, original); await ready(p);
    await p.evaluate(() => { window.festivalLoss = document.querySelector('.lot-webgl').getContext('webgl2').getExtension('WEBGL_lose_context'); festivalLoss.loseContext(); });
    await p.waitForFunction(() => !__frontOfHouse.rendererStatus().active); assert.deepEqual(await state(p), original);
    await p.evaluate(() => festivalLoss.restoreContext()); await ready(p); assert.deepEqual(await state(p), original);
    assert.deepEqual(errors, []); await c.close(); console.log(`Festival ${width}: both areas, nonbuildable annex, keyboard side view, switching and recovery pass`);
  }
  if (!geometryOnly) for (const policy of [false, true]) {
    const outcomes = [];
    for (const width of [1440, 375]) for (const three of [false, true]) {
      const c = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' }), p = await c.newPage();
      const errors = trackPageFailures(p, new URL(url).origin);
      await p.goto(url + (three ? '?renderer=3d' : '')); await p.waitForFunction(() => window.__frontOfHouse); await load(p, fixture(policy)); if (three) await ready(p);
      await tab(p, 'Actions'); await p.locator('[data-act="confirm-build"]').click(); await p.locator('#confirm-promo').click();
      const opened = await state(p); await p.reload(); await p.waitForFunction(() => window.__frontOfHouse); if (three) await ready(p); assert.deepEqual(await state(p), opened);
      await tab(p, 'Problem'); await p.locator('[data-act="respond"]:not([disabled]):visible').first().click();
      const ended = await state(p), receipt = E.settlementFor(ended); assert.ok(receipt);
      if (three) {
        await p.waitForFunction(() => __frontOfHouse.board().representedAttendance > 0);
        const board = await p.evaluate(() => __frontOfHouse.board()); assert.ok(board.representativeGuests <= 180);
        if (policy) {
          const sales = receipt.stageAccounts.sales, audience = board.secondaryStage.audience;
          assert.equal(audience.known, true); assert.equal(audience.main, sales.main.attendance); assert.equal(audience.second, sales.second.attendance);
          assert.equal(audience.displayed.main + audience.displayed.second, receipt.attendance);
          assert.equal(board.representativeGuests, board.presentation.representativeGuests + board.secondaryStage.presentation.representativeGuests);
          assert.ok(board.secondaryStage.presentation.representativeGuests > 0);
        } else { assert.equal(board.secondaryStage.audience.known, false); assert.equal(board.secondaryStage.audience.second, null); }
        await p.screenshot({ path: join(output, `${width}-${policy}-settled.png`) });
      }
      await p.evaluate(() => __frontOfHouse.act({ type: 'acceptSettlement', at: '2026-10-04T00:00:00.000Z' }));
      const signed = await state(p); assert.equal(signed.phase, 'done'); await p.reload(); await p.waitForFunction(() => window.__frontOfHouse); if (three) await ready(p); assert.deepEqual(await state(p), signed);
      outcomes.push({ receipt, state: signed }); await fit(p); assert.deepEqual(errors, []); await c.close(); console.log(`Festival ${policy ? 'versioned' : 'legacy'} ${width} ${three ? '3D' : 'classic'}: exact settlement and reload pass`);
    }
    for (const outcome of outcomes) assert.deepEqual(outcome, outcomes[0]);
  }
  console.log(`${geometryOnly ? 'Festival geometry-only verification; accounting acceptance still required' : 'Festival full scene and accounting verification passed'}. Screenshots: ${output}`);
} finally { await browser.close(); await server.close(); }
