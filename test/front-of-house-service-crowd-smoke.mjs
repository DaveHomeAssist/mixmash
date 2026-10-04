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
const expected = projectServiceCrowd(createServiceLayout(state.venue.objects, state.venue.grid), liveServicesFor(state, { events: true }));
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
    assert.deepEqual(arrived.worker, projectServiceCrowd(createServiceLayout(after.venue.objects, after.venue.grid), liveServicesFor(after, { events: true })).worker);
    assert.equal(arrived.totals.bar + arrived.totals.floor, liveServicesFor(after).admitted);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`  ok service crowd ${three ? '3d' : 'classic'} ${width}: queue totals, transfer, camera and reload`);
  }
  // Drive the production adapter with a fixed authoritative event history. Explicit
  // frames make movement proof independent of host frame rate and timer scheduling.
  for (const normal of [false, true]) for (const three of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 750 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = trackPageFailures(page, server.origin);
    await page.route('**/__service-motion', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><link rel="icon" href="data:,"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:absolute;inset:0;width:100%;height:100%}.board-3d-input{visibility:hidden}</style><canvas id="board"></canvas>' }));
    await page.goto(`${server.origin}/__service-motion`);
    await page.evaluate(async ({ three, normal }) => {
      const { createBoardAdapter } = await import('/front-of-house/board-adapter.mjs');
      const { STARTER_LAYOUT } = await import('/front-of-house/data.mjs');
      const { createServices, advanceServices, serviceSummary } = await import('/front-of-house/services.mjs');
      const run = advanceServices(createServices({ id: 'motion', closeAt: 8, gateRate: 3, barRate: 0, workerRate: 1, travelMinutes: 2, gatePatience: 2, barPatience: 2, ticketPrice: 10, barNet: 4, arrivals: [{ minute: 1, prepaid: 3, walkup: 7 }] }), 3);
      let summary = { ...serviceSummary(run), events: run.events };
      if (normal) {
        const E = await import('/front-of-house/engine.mjs'); const D = await import('/front-of-house/data.mjs');
        let state = E.createGame(170);
        const act = action => { const result = E.applyAction(state, action); if (result.error) throw new Error(result.error); state = result.state; };
        for (const action of [{ type: 'chooseDeal', deal: 'door', artistId: 'sodium-arcade' }, { type: 'setLayout', objects: STARTER_LAYOUT }, { type: 'confirmBuild' }, { type: 'confirmPromotion', services: true, flow: 1 }, { type: 'advanceLive', minute: 240 }]) act(action);
        act({ type: 'respond', responseId: D.INCIDENTS[state.show.incidentId].responses.find(r => r.cost <= state.cash).id });
        act({ type: 'advanceLive', minute: 240 }); act({ type: 'advanceLive', minute: 241 });
        summary = E.liveServicesFor(state, { events: true });
      }
      window.scene = { objects: STARTER_LAYOUT, grid: { w: 24, h: 16 }, floor: 'lot', crowd: summary.inside ?? summary.admitted, services: summary, serviceMinute: summary.minute, clearSet: new Set(), blockedSet: new Set(), night: false, t: 0, serviceProgress: 0 };
      window.source = JSON.stringify(scene.services);
      window.board = createBoardAdapter(document.querySelector('canvas'), { enabled: three });
      board.resize(); board.draw(scene);
    }, { three, normal });
    await page.waitForFunction(three => three ? board.status().active : board.info().spritesReady, three);
    const frames = [], pictures = [];
    for (const progress of [0, 0.5, 1]) {
      frames.push(await page.evaluate(progress => { board.draw({ ...scene, serviceProgress: progress, t: progress * 2 }); return board.info().serviceCrowd; }, progress));
      pictures.push(await page.screenshot({ path: join(output, `${three ? '3d' : 'classic'}-${normal ? 'departure' : 'service'}-motion-${progress}.png`) }));
    }
    assert.ok(frames[1].actors.some(a => { const before = frames[0].actors.find(b => b.id === a.id); return before && (a.x !== before.x || a.y !== before.y); }));
    assert.equal(pictures[0].equals(pictures[1]), false, 'actual rendered frame moves');
    assert.ok(frames[1].transitions.departingSamples > 0);
    assert.equal(frames[2].transitions.departingSamples, 0);
    assert.deepEqual(frames[0].totals, frames[2].totals);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => board.draw({ ...scene, serviceProgress: 1, t: 0 }));
    const paused = await page.screenshot();
    await page.evaluate(() => board.draw({ ...scene, serviceProgress: 1, t: 0 }));
    assert.equal((await page.screenshot()).equals(paused), true, 'paused reduced motion holds the committed frame');
    assert.equal(await page.evaluate(() => source === JSON.stringify(scene.services)), true);
    assert.deepEqual(errors, []);
    await page.evaluate(() => board.destroy()); await context.close();
    console.log(`  ok ${normal ? 'normal departure' : 'guest movement'} ${three ? '3d' : 'classic'}: visible travel, recorded departures, frozen outcome and immutable service events`);
  }
  console.log(`Service crowd: four client journeys and four controlled motion journeys passed. Screenshots: ${output}`);
} finally { await browser.close(); await server.close(); }
