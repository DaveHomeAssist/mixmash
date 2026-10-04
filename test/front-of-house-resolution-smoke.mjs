// Browser backing allocation and density lifecycle; emulation is not physical display acceptance.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer } from './static-server.mjs';

const server = await startStaticServer(), browser = await chromium.launch(launchOptions());
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, reducedMotion: 'reduce', serviceWorkers: 'block' });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/__resolution-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="icon" href="data:,"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%}</style></head><body><canvas></canvas></body></html>' }));
  await page.goto(`${server.origin}/__resolution-test`);
  await page.evaluate(async () => {
    const original = window.matchMedia.bind(window);
    window.densityListeners = new Set();
    window.matchMedia = query => {
      const media = original(query);
      if (query.startsWith('(resolution:')) {
        const add = media.addEventListener.bind(media), remove = media.removeEventListener.bind(media);
        media.addEventListener = (type, listener, options) => { densityListeners.add(media); return add(type, listener, options); };
        media.removeEventListener = (type, listener, options) => { densityListeners.delete(media); return remove(type, listener, options); };
      }
      return media;
    };
    const { createLotRenderer } = await import('/front-of-house/lot-renderer.mjs');
    const { STARTER_LAYOUT } = await import('/front-of-house/data.mjs');
    window.createLotRenderer = createLotRenderer;
    window.canvas = document.querySelector('canvas');
    window.input = { floor: 'lot', objects: structuredClone(STARTER_LAYOUT), crowd: 0, t: 0 };
    window.before = JSON.stringify(input);
    window.backend = createLotRenderer(canvas); backend.draw(input);
  });
  async function check(dpr, width, height) {
    const result = await page.evaluate(() => {
      const info = backend.info(), gl = canvas.getContext('webgl2');
      backend.setCamera({ yaw: 37, pitch: 48 });
      const p = backend.clientOf(12.5, 8.5), tile = backend.tileAt(p.x, p.y);
      backend.preset('plan');
      const stage = input.objects.find(o => o.type === 'stage'), roof = backend.clientOf(stage.x + 3, stage.y + 1.5, 0.57);
      return { dpr: info.dpr, backing: info.backing, drawing: [gl.drawingBufferWidth, gl.drawingBufferHeight], tile, object: backend.objectAt(roof.x, roof.y)?.type, same: before === JSON.stringify(input), listeners: densityListeners.size };
    });
    assert.equal(result.dpr, dpr);
    assert.deepEqual(result.backing, { width, height });
    assert.deepEqual(result.drawing, [width, height], 'actual WebGL buffer matches the backing');
    assert.deepEqual(result.tile, { x: 12, y: 8 }); assert.equal(result.object, 'stage'); assert.equal(result.same, true);
    return result;
  }
  assert.equal((await check(1.5, 2880, 1620)).listeners, 1);
  // Allocation and CSS-coordinate picking at the threshold and after viewport changes.
  await page.evaluate(() => backend.pause());
  for (const [width, height, dpr, backingWidth, backingHeight] of [[1500, 1000, 2, 3000, 2000], [1501, 1000, 1.5, 2251, 1500], [375, 812, 2, 750, 1624], [5120, 1440, 1.5, 7680, 2160]]) {
    await page.setViewportSize({ width, height }); await page.evaluate(() => backend.resize());
    await check(dpr, backingWidth, backingHeight);
  }
  // CDP changes the browser's real DPR and resolution media query with CSS size held fixed.
  // No call to backend.resize. Cover both a resolution event and redraw fallback:
  // Chromium CDP can update matches without delivering the media change event.
  await page.setViewportSize({ width: 375, height: 812 }); await page.evaluate(() => { backend.resize(); backend.resume(); });
  const cdp = await context.newCDPSession(page);
  for (const deviceScaleFactor of [1, 2, 3, 1]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor, mobile: false });
    await page.evaluate(dpr => { if (dpr === 2) [...densityListeners][0].dispatchEvent(new Event('change')); else backend.draw(input); }, deviceScaleFactor);
    await page.waitForFunction(dpr => backend.info().requestedDpr === dpr, deviceScaleFactor);
    const effective = Math.min(deviceScaleFactor, 2);
    assert.equal((await check(effective, 375 * effective, 812 * effective)).listeners, 1, 'one rearmed density listener');
  }
  await page.evaluate(() => { window.extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context'); extension.loseContext(); });
  await page.waitForFunction(() => backend.status().state === 'lost');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: false });
  await page.evaluate(() => [...densityListeners][0].dispatchEvent(new Event('change')));
  await page.waitForFunction(() => backend.info().requestedDpr === 2);
  await page.evaluate(() => extension.restoreContext()); await page.waitForFunction(() => backend.status().state === 'ready');
  await check(2, 750, 1624);
  await page.evaluate(() => { backend.destroy(); backend.destroy(); });
  assert.equal(await page.evaluate(() => densityListeners.size), 0);
  const disposedFrames = await page.evaluate(() => backend.info().renderedFrames);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: false });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => backend.info().renderedFrames), disposedFrames, 'disposed backend does not redraw');
  // Explicit controls remain independent of browser density, including invalid inputs.
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const pixelRatio of [1, 2, 0, -1, Infinity, NaN]) {
    await page.evaluate(pixelRatio => { backend = createLotRenderer(canvas, { pixelRatio }); backend.draw(input); }, pixelRatio);
    const dpr = pixelRatio === 2 ? 1.5 : 1;
    assert.equal((await check(dpr, 1920 * dpr, 1080 * dpr)).listeners, 0);
    await page.evaluate(() => backend.destroy());
  }
  assert.deepEqual(errors, []);
  console.log('Lot resolution: threshold, desktop/phone/ultrawide backing, picking, live DPR, context recovery, overrides and disposal passed. Browser emulation only.');
} finally { await context.close(); await browser.close(); await server.close(); }
