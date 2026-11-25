// Empires shell regressions from the 2026-11-25 bug pass (Scaler engine items):
//  1. Keys pressed while the "Command Basics" guide is open never reach the
//     engine (Space used to start the skirmish underneath the dialog).
//  2. A WebGL 1-only browser is told the game cannot run (the build links
//     -sUSE_WEBGL2=1), not offered "Continue anyway".
//  3. A tab that is hidden while the wasm/data loads starts with the engine
//     loop paused.
// Usage: node test/empires-shell-smoke.mjs   (EMPIRES_BASE_URL to test a deploy)
import { createRequire } from 'node:module';
import { startStaticServer } from './static-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const output = process.env.EMPIRES_OUTPUT || '/tmp/empires-shell-smoke';
fs.mkdirSync(output, { recursive: true });

(async () => {
  let server, browser;
  try {
    server = process.env.EMPIRES_BASE_URL ? null : await startStaticServer();
    const url = process.env.EMPIRES_BASE_URL || `${server.origin}/empires/`;
    browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

    // 1. Shortcut guide swallows keys.
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await context.addInitScript(() => {
        // Bubble-phase window listener, registered before shell.js and the
        // SDL glue: anything that reaches it would also reach the engine.
        window.__spaceReached = 0;
        window.addEventListener('keydown', (e) => { if (e.code === 'Space') window.__spaceReached++; });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__empiresShortcuts);
      await page.evaluate(() => window.__empiresShortcuts.open());
      await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => window.__spaceReached), 0, 'Space must not reach the engine while the guide is open');
      assert.equal(await page.locator('#shortcuts').evaluate((el) => el.classList.contains('is-open')), true, 'guide stays open');
      await page.screenshot({ path: `${output}/1-guide-open-after-space.png` });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#shortcuts').evaluate((el) => el.classList.contains('is-open')), false, 'Escape closes the guide');
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => window.__spaceReached), 1, 'Space reaches the page again once the guide is closed');
      assert.deepEqual(errors, []);
      await context.close();
    }

    // 2. WebGL 1-only browser.
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await context.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          if (type === 'webgl2') return null;
          return original.call(this, type, ...rest);
        };
      });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#capability-notice.is-visible');
      const notice = await page.evaluate(() => ({
        title: document.querySelector('#capability-notice b').textContent,
        detail: document.getElementById('capability-detail').textContent,
        button: document.getElementById('capability-dismiss').textContent,
      }));
      await page.locator('#capability-notice').screenshot({ path: `${output}/2-webgl1-notice.png` });
      assert.match(notice.detail, /needs WebGL 2/);
      assert.doesNotMatch(notice.detail, /should still render/);
      assert.equal(notice.title, 'Not supported in this browser');
      assert.equal(notice.button, 'Dismiss');
      await context.close();
    }

    // 3. Hidden during load -> loop paused once the engine starts.
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await context.addInitScript(() => {
        Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => 'hidden' });
      });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.Module && typeof window.Module.pauseMainLoop === 'function' && window.__empiresVisibility, null, { timeout: 90000 });
      await page.waitForFunction(() => window.__empiresVisibility.paused(), null, { timeout: 30000 });
      assert.equal(await page.evaluate(() => window.__empiresVisibility.paused()), true, 'engine loop paused when the tab was hidden during load');
      await context.close();
    }
    console.log('empires shell smoke: ok');
  } finally {
    try { await browser?.close(); } finally { await server?.close(); }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
