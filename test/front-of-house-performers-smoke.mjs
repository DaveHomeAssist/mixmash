// Actual gameplay performer checks and screenshots, with exact state and receipt preservation.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';
import { createGame, applyAction, settlementFor, offersFor } from '../front-of-house/engine.mjs';
import { STARTER_LAYOUT, CLUB_STARTER, AMP_STARTER, FEST_STARTER, SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';
const output = process.env.FOH_PERFORMERS_OUTPUT || 'qa-performers'; await mkdir(output, { recursive: true });
const server = await startStaticServer(), origin = process.env.FRONT_OF_HOUSE_BASE_URL || server.origin + '/front-of-house/';
const browser = await chromium.launch(launchOptions());
try {
  for (const artistId of ['sodium-arcade', 'tin-relay', 'amber-turnout', 'paper-voltage']) for (const [width, height] of [[1440, 900], [375, 812]]) {
    const venueId = artistId === 'paper-voltage' ? 'festival' : artistId === 'tin-relay' ? 'club' : artistId === 'amber-turnout' ? 'amphitheater' : 'lot';
    let state;
    for (let seed = 1; seed < 100; seed++) { state = createGame(seed, { mode: 'sandbox' }); if (venueId !== 'lot') state = applyAction(state, { type: 'chooseVenue', venueId }).state; if (offersFor(state).includes(artistId)) break; }
    for (const action of [{ type: 'chooseDeal', deal: 'guarantee', artistId, ...(venueId === 'festival' ? { secondId: 'hollow-census' } : {}) }, { type: 'setLayout', objects: venueId === 'festival' ? FEST_STARTER : venueId === 'club' ? CLUB_STARTER : venueId === 'amphitheater' ? AMP_STARTER : STARTER_LAYOUT }, { type: 'confirmBuild' }, { type: 'setPromotion', price: 20, ads: { flyers: 0, social: 150, radio: 150 } }, { type: 'confirmPromotion' }]) {
      const r = applyAction(state, action); assert.equal(r.error, null); state = r.state;
    }
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage(), errors = trackPageFailures(page, new URL(origin).origin);
    await page.goto(origin + '?renderer=3d'); await page.waitForFunction(() => window.__frontOfHouse);
    const code = Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state })).toString('base64');
    assert.equal(await page.evaluate(c => __frontOfHouse.importCode(c), code), true);
    await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
    const before = await page.evaluate(() => __frontOfHouse.state());
    assert.equal((await page.evaluate(() => __frontOfHouse.board())).performers.artist, artistId);
    assert.ok((await page.evaluate(() => __frontOfHouse.board())).performers.count > 0);
    await page.evaluate(() => __frontOfHouse.boardCamera({ x: 12, y: 1.5, yaw: 0, pitch: 35, zoom: 3 }));
    await page.waitForTimeout(250);
    if (venueId === 'festival') assert.equal((await page.evaluate(() => __frontOfHouse.board())).sidePerformers.artist, 'hollow-census');
    await page.screenshot({ path: `${output}/${artistId}-${width}.png` });
    assert.deepEqual(await page.evaluate(() => __frontOfHouse.state()), before);
    await page.reload(); await page.waitForFunction(() => window.__frontOfHouse);
    assert.deepEqual(await page.evaluate(() => __frontOfHouse.state()), before);
    assert.deepEqual(settlementFor(await page.evaluate(() => __frontOfHouse.state())), settlementFor(before));
    if (artistId === 'sodium-arcade') {
      await page.goto(origin + '?renderer=2d'); await page.waitForFunction(() => window.__frontOfHouse);
      assert.deepEqual(await page.evaluate(() => __frontOfHouse.state()), before);
      await page.waitForTimeout(250); await page.screenshot({ path: `${output}/classic-${width}.png` });
    }
    assert.deepEqual(errors, []); await context.close(); console.log(`${artistId} ${width}: exact state, receipt, reload and screenshot pass`);
  }
} finally { await browser.close(); await server.close(); }
