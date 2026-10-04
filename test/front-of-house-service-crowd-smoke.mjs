// Real-client service zone parity and saved worker travel in both Lot renderers.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';
import { createGame, applyAction, liveServicesFor } from '../front-of-house/engine.mjs';
import { createServiceLayout, projectServiceCrowd } from '../front-of-house/service-crowd.mjs';
import { STARTER_LAYOUT, SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';
const server = await startStaticServer(), browser = await chromium.launch(launchOptions());
const url = process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
const output = process.env.FRONT_OF_HOUSE_CROWD_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-service-crowd-'));
await mkdir(output, { recursive: true });
let state = createGame(3);
for (const action of [{ type: 'chooseDeal', deal: 'door', artistId: 'sodium-arcade' }, { type: 'setLayout', objects: STARTER_LAYOUT }, { type: 'confirmBuild' }, { type: 'confirmPromotion', services: true }, { type: 'assignLiveWorker', station: 'gate' }, { type: 'advanceLive', minute: 5 }, { type: 'assignLiveWorker', station: 'bar' }, { type: 'advanceLive', minute: 6 }]) {
  const result = applyAction(state, action); assert.equal(result.error, null); state = result.state;
}
const code = Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state })).toString('base64');
const expected = projectServiceCrowd(createServiceLayout(state.venue.objects, state.venue.grid), liveServicesFor(state));
assert.ok(expected.totals.gate > 0 && expected.totals.bar > 0);
try {
  for (const three of [false, true]) for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage(), errors = trackPageFailures(page, new URL(url).origin);
    await page.goto(url + (three ? '?renderer=3d' : ''));
    await page.waitForFunction(() => window.__frontOfHouse);
    await page.evaluate(code => __frontOfHouse.importCode(code), code);
    if (three) await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
    const projection = () => page.evaluate(() => __frontOfHouse.board().serviceCrowd);
    assert.deepEqual(await projection(), expected);
    const textView = await page.evaluate(() => JSON.parse(render_game_to_text()).serviceView);
    assert.deepEqual(textView.totals, expected.totals);
    assert.deepEqual(textView.worker, expected.worker);
    const before = await page.evaluate(() => __frontOfHouse.state());
    if (three) await page.evaluate(() => __frontOfHouse.boardCamera({ yaw: 37, pitch: 48, zoom: 1 }));
    await page.screenshot({ path: join(output, `${three ? '3d' : 'classic'}-${width}-queues.png`) });
    assert.deepEqual(await page.evaluate(() => __frontOfHouse.state()), before);
    await page.reload(); await page.waitForFunction(() => window.__frontOfHouse);
    if (three) await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
    assert.deepEqual(await projection(), expected, 'paused reload reconstructs identical worker and zone positions');
    await page.evaluate(() => __frontOfHouse.act({ type: 'advanceLive', minute: 7 }));
    const after = await page.evaluate(() => __frontOfHouse.state());
    assert.equal(liveServicesFor(after).worker.station, 'bar');
    const arrived = await projection();
    assert.deepEqual(arrived.worker, projectServiceCrowd(createServiceLayout(after.venue.objects, after.venue.grid), liveServicesFor(after)).worker);
    assert.equal(arrived.totals.bar + arrived.totals.floor, liveServicesFor(after).admitted);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`  ok service crowd ${three ? '3d' : 'classic'} ${width}: queue totals, transfer, camera and reload`);
  }
  console.log(`Service crowd: four renderer/viewport journeys passed. Screenshots: ${output}`);
} finally { await browser.close(); await server.close(); }
