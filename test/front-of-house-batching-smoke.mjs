// Verify application render coalescing and immediate picking without changing the synchronous backend contract.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer } from './static-server.mjs';

const server = await startStaticServer(); let browser;
try {
  browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, reducedMotion: 'reduce' }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__batching', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><link rel="icon" href="data:,"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{width:100%;height:100%;display:block}</style><canvas></canvas>' }));
  await page.goto(`${server.origin}/__batching`);
  const first = await page.evaluate(async () => {
    const { createLotRenderer } = await import('/front-of-house/lot-renderer.mjs');
    const { STARTER_LAYOUT } = await import('/front-of-house/data.mjs');
    window.canvas = document.querySelector('canvas'); window.createRenderer = createLotRenderer;
    window.input = { floor: 'lot', objects: structuredClone(STARTER_LAYOUT), crowd: 150, night: true, t: 0 };
    window.backend = createLotRenderer(canvas, { deferRendering: true }); window.original = JSON.stringify(input);
    for (let i = 0; i < 20; i++) { backend.setCamera({ yaw: i + 116, pitch: 48 }); backend.draw(input); }
    const before = backend.info(), p = backend.clientOf(12.5, 8.5), pick = backend.tileAt(p.x, p.y);
    await new Promise(requestAnimationFrame); return { before, after: backend.info(), pick, unchanged: original === JSON.stringify(input) };
  });
  assert.equal(first.before.renderedFrames, 0); assert.equal(first.before.pendingRender, true);
  assert.equal(first.after.renderedFrames, 1); assert.equal(first.after.pendingRender, false);
  assert.equal(first.after.camera.yaw, 135); assert.deepEqual(first.pick, { x: 12, y: 8 }); assert.equal(first.unchanged, true);
  const detail = await page.evaluate(async () => {
    backend.preset('wide'); await new Promise(requestAnimationFrame); const wide = backend.info();
    backend.preset('foh'); await new Promise(requestAnimationFrame); const close = backend.info();
    backend.preset('wide'); await new Promise(requestAnimationFrame); const back = backend.info();
    return { wide, close, back };
  });
  for (const state of Object.values(detail)) {
    assert.equal(state.representativeGuests, 150);
    assert.equal(state.presentation.guestDetail.full + state.presentation.guestDetail.distant, 150);
  }
  assert.ok(detail.wide.presentation.guestDetail.distant > 0);
  assert.ok(detail.close.presentation.guestDetail.full > detail.wide.presentation.guestDetail.full, 'camera-only close view restores detailed geometry');
  assert.deepEqual(detail.back.presentation.guestDetail, detail.wide.presentation.guestDetail);
  const paused = await page.evaluate(async () => {
    const before = backend.info().renderedFrames; backend.draw(input); backend.pause();
    for (let i = 0; i < 5; i++) backend.setCamera({ yaw: 37 });
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    const whilePaused = backend.info(); backend.resume(); await new Promise(requestAnimationFrame);
    return { before, whilePaused, after: backend.info() };
  });
  assert.equal(paused.whilePaused.renderedFrames, paused.before); assert.equal(paused.whilePaused.pendingRender, false);
  assert.equal(paused.after.renderedFrames, paused.before + 1); assert.equal(paused.after.camera.yaw, 37);
  await page.evaluate(() => { window.loss = canvas.getContext('webgl2').getExtension('WEBGL_lose_context'); backend.draw(input); loss.loseContext(); });
  await page.waitForFunction(() => backend.status().state === 'lost');
  const lost = await page.evaluate(async () => {
    const before = backend.info(); backend.draw(input); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    return { before, after: backend.info() };
  });
  assert.equal(lost.after.pendingRender, false); assert.equal(lost.after.renderedFrames, lost.before.renderedFrames);
  await page.evaluate(() => loss.restoreContext()); await page.waitForFunction(() => backend.status().state === 'ready' && !backend.info().pendingRender);
  assert.ok(await page.evaluate(n => backend.info().renderedFrames > n, lost.after.renderedFrames));
  const disposed = await page.evaluate(async () => {
    backend.draw(input); const before = backend.info().renderedFrames; backend.destroy();
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    return { before, after: backend.info(), status: backend.status() };
  });
  assert.equal(disposed.status.state, 'disposed'); assert.equal(disposed.after.pendingRender, false); assert.equal(disposed.after.renderedFrames, disposed.before);
  const sync = await page.evaluate(() => {
    const c = document.createElement('canvas'); canvas.replaceWith(c); const direct = createRenderer(c);
    const before = direct.info().renderedFrames; direct.draw(input); const after = direct.info(); direct.destroy(); return { before, after };
  });
  assert.equal(sync.after.deferredRendering, false); assert.equal(sync.after.pendingRender, false); assert.equal(sync.after.renderedFrames, sync.before + 1);
  assert.deepEqual(errors, []);
  console.log('Deferred updates render once; picking is immediate; pause, real context recovery and disposal pass; default rendering remains synchronous.');
} finally { try { await browser?.close(); } finally { await server.close(); } }
