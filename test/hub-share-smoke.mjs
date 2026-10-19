/** Hub Share: native sheet, clipboard fallback, legacy copy fallback, no-script; support/ads stay off; analytics beacon allowed. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { playableGames } from '../src/hub/catalog.mjs';
import { startStaticServer, trackPageFailures } from './static-server.mjs';
const server = await startStaticServer();
const { origin } = server;
const shots = process.env.HUB_SCREENSHOT_DIR || '';
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch();
async function open(hash, { width = 1440, height = 900, init, js = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', hasTouch: width < 701, javaScriptEnabled: js });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const failures = trackPageFailures(page, origin);
  await page.goto(`${origin}/${hash}`, { waitUntil: 'networkidle' });
  if (js) await page.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
  return { context, page, failures };
}
try {
  // Native share sheet: called with the game's public URL and catalog copy, no copy fallback.
  {
    const { context, page, failures } = await open('#game-pitch', { width: 360, height: 780, init: () => {
      window.__shared = []; Object.defineProperty(navigator, 'share', { value: async data => { window.__shared.push(data); }, configurable: true });
    } });
    await page.locator('#game-pitch .share-button').click();
    const shared = await page.evaluate(() => window.__shared);
    assert.deepEqual(shared, [{ title: 'Pitch Riot', text: 'Pitch Riot: Beat the keeper. Bring the hype.', url: 'https://mixmash.games/pitch/' }]);
    assert.equal((await page.locator('#game-pitch .share-button').textContent()).trim(), 'Share', 'no copy fallback after native share');
    assert.deepEqual(failures, []); await context.close();
  }
  // No native share: copies to the clipboard and says so.
  {
    const { context, page, failures } = await open('#game-garden', { init: () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      window.__copied = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied.push(text); } }, configurable: true });
    } });
    const button = page.locator('#game-garden .share-button');
    assert.ok(await button.isVisible());
    await button.click();
    await page.waitForFunction(() => document.querySelector('#game-garden .share-button').textContent === 'Link copied');
    assert.deepEqual(await page.evaluate(() => window.__copied), ['https://mixmash.games/garden/']);
    assert.equal(await page.locator('#announcement').textContent(), 'Link copied: https://mixmash.games/garden/');
    await page.waitForFunction(() => document.querySelector('#game-garden .share-button').textContent === 'Share', null, { timeout: 4000 });
    assert.deepEqual(failures, []); await context.close();
  }
  // Clipboard API refused: falls back to a temporary selection copy, then reports honestly.
  {
    const { context, page, failures } = await open('#studio', { init: () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new DOMException('denied', 'NotAllowedError'); } }, configurable: true });
      window.__exec = []; document.execCommand = command => { window.__exec.push([command, document.activeElement?.value]); return true; };
    } });
    await page.locator('#studio .share-button').click();
    await page.waitForFunction(() => document.querySelector('#studio .share-button').dataset.shared === 'copied');
    assert.deepEqual(await page.evaluate(() => window.__exec), [['copy', 'https://mixmash.games/']]);
    assert.equal(await page.locator('textarea').count(), 0, 'temporary field removed');
    assert.deepEqual(failures, []); await context.close();
  }
  // Without JavaScript the Share buttons never appear.
  {
    const { context, page } = await open('#game-mixmash', { width: 360, height: 780, js: false });
    assert.equal(await page.locator('.share-button:visible').count(), 0);
    await context.close();
  }
  // Support and ads stay off. The only allowed off-site request is the Cloudflare analytics beacon.
  const allowedOffsite = url => /^https:\/\/(static\.)?cloudflareinsights\.com\//.test(url);
  for (const [width, height] of [[360, 780], [1440, 900]]) {
    for (const hash of ['', '#studio', `#game-${playableGames[0].id}`]) {
      const { context, page, failures } = await open(hash, { width, height });
      const offsite = [];
      page.on('request', request => { if (!request.url().startsWith(origin)) offsite.push(request.url()); });
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('[data-support-slot],[data-ad-slot],.adsbygoogle').count(), 0, `${width} ${hash}: no support/ad slots`);
      const unexpected = [...new Set(offsite)].filter(url => !allowedOffsite(url));
      assert.deepEqual(unexpected, [], `${width} ${hash}: unexpected third-party ${JSON.stringify(offsite)}`);
      assert.ok(offsite.some(url => url.includes('static.cloudflareinsights.com/beacon.min.js')), `${width} ${hash}: analytics beacon requested`);
      if (shots) await page.screenshot({ path: join(shots, `hub-${width}${hash ? '-' + hash.slice(1) : ''}.png`) });
      assert.deepEqual(failures, []); await context.close();
    }
  }
  console.log('Hub share, analytics-on, and support/ads-off smoke passed.');
} finally { await browser.close(); await server.close(); }
