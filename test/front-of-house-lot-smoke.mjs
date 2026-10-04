// Browser proof for the isolated Lot backend; this does not claim game integration or final art acceptance.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer } from './static-server.mjs';

const server = await startStaticServer();
const output = process.env.FRONT_OF_HOUSE_LOT_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-lot-backend-'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.route('**/__lot-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="icon" href="data:,"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%}</style></head><body><canvas id="sample"></canvas></body></html>' }));
  await page.goto(`${server.origin}/__lot-test`);
  await page.evaluate(async () => {
    const { createLotRenderer } = await import('/front-of-house/lot-renderer.mjs');
    const { STARTER_LAYOUT } = await import('/front-of-house/data.mjs');
    window.createLotRenderer = createLotRenderer;
    window.canvas = document.querySelector('canvas');
    window.statuses = [];
    window.backend = createLotRenderer(window.canvas, { onStatus: state => window.statuses.push(state) });
    window.input = { objects: structuredClone(STARTER_LAYOUT), floor: 'lot', grid: { w: 24, h: 16 }, crowd: 10, night: false, lightTower: true, t: 0 };
    window.before = JSON.stringify(window.input);
    window.backend.draw(window.input);
  });
  assert.equal(await page.evaluate(() => backend.status().state), 'ready');
  const cached = await page.evaluate(() => {
    const start = backend.info();
    backend.draw(input); backend.setCamera({ yaw: 37 }); backend.draw({ ...input, night: true });
    const staticScene = backend.info();
    backend.pause(); backend.draw({ ...input, objects: input.objects.filter(o => o.type !== 'bar') });
    const paused = backend.info(); backend.resume(); const changed = backend.info();
    backend.draw(input);
    return { start, staticScene, paused, changed };
  });
  assert.equal(cached.staticScene.shadowUpdates, cached.start.shadowUpdates, 'camera and lighting intensity reuse static shadows');
  assert.equal(cached.staticScene.renderedFrames, cached.start.renderedFrames + 3);
  assert.equal(cached.paused.shadowUpdates, cached.staticScene.shadowUpdates, 'paused invalidation does not render');
  assert.equal(cached.changed.shadowUpdates, cached.paused.shadowUpdates + 1, 'resume refreshes changed layout shadows');
  for (const yaw of [37, 135]) {
    const result = await page.evaluate(yaw => {
      backend.setCamera({ yaw, pitch: 48, zoom: 1 });
      const p = backend.clientOf(12.5, 8.5);
      return { tile: backend.tileAt(p.x, p.y), unchanged: before === JSON.stringify(input) };
    }, yaw);
    assert.deepEqual(result, { tile: { x: 12, y: 8 }, unchanged: true });
  }
  // Plan exposes each roof: depth picks the current logical object and ignores guests/overlays.
  const picked = await page.evaluate(() => {
    backend.preset('plan');
    return input.objects.filter(o => ['stage', 'pa-m', 'bar', 'restroom'].includes(o.type)).map(o => {
      const d = o.type === 'stage' ? [3, 1.5, 0.57] : o.type === 'bar' ? [1, 0.5, 0.87] : [0.5, 0.5, 1.65];
      const p = backend.clientOf(o.x + d[0], o.y + d[1], d[2]);
      return [o.type, backend.objectAt(p.x, p.y)?.type];
    });
  });
  for (const [expected, actual] of picked) assert.equal(actual, expected);
  const cues = await page.evaluate(() => {
    const initial = backend.info().presentation;
    backend.draw({ ...input, objects: input.objects.filter(o => o.type !== 'fence') });
    const noFence = backend.info().presentation.fencePanels;
    const incidents = {};
    for (const id of ['pa-dropout', 'gate-jam', 'curfew', 'rain']) {
      backend.draw({ ...input, incident: id }); incidents[id] = backend.info().presentation;
    }
    backend.draw({ ...input, crowd: 0 }); backend.draw({ ...input, crowd: 10 }); const small = backend.info();
    backend.draw({ ...input, crowd: 200 }); const large = backend.info();
    backend.draw(input);
    return { initial, noFence, incidents, smallCalls: small.calls, largeCalls: large.calls, represented: large.representedAttendance, drawn: large.representativeGuests };
  });
  assert.ok(cues.initial.fencePanels > 0 && cues.initial.gateOpenings > 0);
  assert.equal(cues.noFence, 0, 'no rented fence means no rendered fence');
  assert.equal(cues.incidents['pa-dropout'].incident.type, 'pa-m');
  assert.equal(cues.incidents['gate-jam'].incident.type, 'gate');
  assert.equal(cues.incidents.curfew.incident.type, 'stage');
  assert.equal(cues.incidents.rain.rain, true); assert.equal(cues.incidents.rain.incident, null);
  assert.equal(cues.drawn, 180); assert.equal(cues.represented, 200);
  assert.equal(cues.largeCalls, cues.smallCalls, 'instancing keeps draw calls independent of representative count');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => backend.info().motion);
  const moving = await page.evaluate(() => { backend.draw({ ...input, t: 1 }); const a = backend.info(); backend.draw({ ...input, t: 2 }); return [a, backend.info()]; });
  assert.notDeepEqual(moving[0].presentation.offsets, moving[1].presentation.offsets);
  assert.equal(moving[1].shadowUpdates, moving[0].shadowUpdates + 1, 'moving guests refresh shadows');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => !backend.info().motion);
  const still = await page.evaluate(() => { backend.draw({ ...input, t: 3, incident: 'pa-dropout' }); const a = backend.info().presentation; backend.draw({ ...input, t: 9, incident: 'pa-dropout' }); return [a, backend.info().presentation]; });
  assert.deepEqual(still[0], still[1], 'live reduced motion preserves all cues with a static pose');
  const reduced = await page.evaluate(() => { const n = backend.info().shadowUpdates; backend.draw({ ...input, t: 100, incident: 'rain' }); return [n, backend.info().shadowUpdates]; });
  assert.equal(reduced[0], reduced[1], 'reduced motion and non-shadow rain reuse the map');
  await page.evaluate(() => backend.draw(input));
  for (const preset of ['wide', 'foh', 'stage', 'plan']) for (const night of [false, true]) {
    await page.evaluate(({ preset, night }) => { backend.preset(preset); backend.draw({ ...input, night }); }, { preset, night });
    await page.screenshot({ path: join(output, `${preset}-${night ? 'show' : 'day'}.png`) });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  const phone = await page.evaluate(() => {
    backend.setClear({ x: 8, y: 60, w: 359, h: 420 }); backend.preset('wide'); backend.resize();
    return { fits: backend.clientOf(0, 0).clear && backend.clientOf(24, 16).clear, overflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth };
  });
  assert.deepEqual(phone, { fits: true, overflow: false });
  const beforeLoss = await page.screenshot({ path: join(output, 'phone.png') });
  // Real context loss/restoration, with the exact last snapshot retained by the backend.
  await page.evaluate(() => { window.extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context'); if (!extension) throw new Error('Context-loss test extension unavailable'); extension.loseContext(); });
  await page.waitForFunction(() => backend.status().state === 'lost');
  await page.evaluate(() => extension.restoreContext());
  await page.waitForFunction(() => backend.status().state === 'ready');
  assert.equal(await page.evaluate(() => before === JSON.stringify(input)), true);
  assert.deepEqual(await page.screenshot(), beforeLoss, 'restoration redraws the exact latest scene and camera');
  // Per-instance ownership: every new instance has the same warm resource count; disposal is idempotent.
  const cycles = await page.evaluate(() => {
    backend.destroy(); backend.destroy();
    const records = [];
    for (let i = 0; i < 20; i++) {
      const r = createLotRenderer(canvas); r.draw(input);
      const warm = r.info().resources; r.destroy(); r.destroy();
      records.push({ warm, disposed: r.status().state, modelResources: r.info().modelResources });
    }
    return records;
  });
  for (const cycle of cycles) {
    assert.deepEqual(cycle.warm, cycles[0].warm); assert.equal(cycle.disposed, 'disposed'); assert.deepEqual(cycle.modelResources, { geometries: 0, materials: 0, textures: 0 });
  }
  assert.deepEqual(errors, []);
  console.log(`Lot backend smoke passed: camera and picks, scene cues, instanced counts, live reduced motion, immutable scene, eight review captures, phone fit, real context loss/restore and 20 disposal cycles. Screenshots: ${output}`);
} finally { await browser.close(); await server.close(); }
