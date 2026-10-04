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
    assert.deepEqual(cycle.warm, cycles[0].warm); assert.equal(cycle.disposed, 'disposed'); assert.deepEqual(cycle.modelResources, { geometries: 0, materials: 0 });
  }
  assert.deepEqual(errors, []);
  console.log(`Lot backend smoke passed: camera and picks, immutable scene, eight review captures, phone fit, real context loss/restore and 20 disposal cycles. Screenshots: ${output}`);
} finally { await browser.close(); await server.close(); }
