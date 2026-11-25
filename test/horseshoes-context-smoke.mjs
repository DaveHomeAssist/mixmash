// Bug pass 2026-11-25 (Scaler engine items): Horseshoes stops drawing while
// the tab is hidden, and recovers from a lost WebGL context (court and the
// FMP replay monitors draw again after restore, no page errors).
import { createRequire } from 'node:module';
import { startStaticServer } from './static-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const output = process.env.HORSESHOES_OUTPUT || '/tmp/horseshoes-context';
fs.mkdirSync(output, { recursive: true });

// Distinct-colour count of a PNG, decoded in the page via a 2D canvas.
async function colours(page, buffer) {
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = 120; c.height = 80;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 120, 80);
    const d = g.getImageData(0, 0, 120, 80).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    return seen.size;
  }, buffer.toString('base64'));
}

(async () => {
  let server, browser;
  try {
    server = process.env.HORSESHOES_BASE_URL ? null : await startStaticServer();
    const url = process.env.HORSESHOES_BASE_URL || `${server.origin}/horseshoes/`;
    browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    // Count WebGL draw calls and let the test fake document.hidden.
    await context.addInitScript(() => {
      window.__draws = 0;
      for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
        if (!proto) continue;
        for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
          const original = proto[name];
          if (typeof original !== 'function') continue;
          proto[name] = function (...args) { window.__draws++; return original.apply(this, args); };
        }
      }
      window.__fakeHidden = null;
      const native = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
      Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get() { return window.__fakeHidden ?? native.get.call(this); } });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__horseshoes?.getState().environment === 'fmp-lawn', null, { timeout: 60000 });
    await page.locator('#menu-resume').click();
    await page.locator('#skip-tour').click().catch(() => {});
    await page.waitForTimeout(800);
    const canvas = page.locator('#horseshoe-stage canvas');
    const beforeColours = await colours(page, await canvas.screenshot({ path: `${output}/1-before.png` }));

    // Hidden tab: the live rAF loop must not draw.
    await page.evaluate(() => { window.__fakeHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(200);
    const hiddenStart = await page.evaluate(() => window.__draws);
    await page.waitForTimeout(1200);
    const hiddenDraws = (await page.evaluate(() => window.__draws)) - hiddenStart;
    await page.evaluate(() => { window.__fakeHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(600);
    const visibleStart = await page.evaluate(() => window.__draws);
    await page.waitForTimeout(600);
    const visibleDraws = (await page.evaluate(() => window.__draws)) - visibleStart;
    console.log(JSON.stringify({ hiddenDraws, visibleDraws }));
    assert.equal(hiddenDraws, 0, 'no WebGL draws while the tab is hidden');
    assert.ok(visibleDraws > 0, 'drawing resumes when the tab is visible again');

    // Context loss -> restore.
    const lost = await page.evaluate(() => {
      const c = document.querySelector('#horseshoe-stage canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      window.__loseExt = gl.getExtension('WEBGL_lose_context');
      window.__loseExt.loseContext();
      return gl.isContextLost();
    });
    assert.equal(lost, true, 'context reported lost');
    await page.waitForTimeout(500);
    assert.equal((await page.evaluate(() => __horseshoes.getState())).contextLost, true, 'game reports contextLost');
    await canvas.screenshot({ path: `${output}/2-lost.png` });
    await page.evaluate(() => window.__loseExt.restoreContext());
    await page.waitForTimeout(1500);
    const restoredState = await page.evaluate(() => __horseshoes.getState());
    assert.equal(restoredState.contextLost, false, 'game reports context restored');
    const afterColours = await colours(page, await canvas.screenshot({ path: `${output}/3-restored.png` }));
    await page.locator('#settings-tab').click();
    await page.locator('#monitors-button').click();
    await page.waitForTimeout(600);
    const monitorColours = await colours(page, await canvas.screenshot({ path: `${output}/4-restored-monitors.png` }));
    console.log(JSON.stringify({ beforeColours, afterColours, monitorColours, errors }));
    assert.ok(afterColours >= Math.max(12, beforeColours * 0.5), `restored court draws (${afterColours} vs ${beforeColours} colours)`);
    assert.ok(monitorColours >= 12, 'replay monitors draw after restore');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('horseshoes context smoke: ok');
  } finally {
    await browser?.close();
    await server?.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
