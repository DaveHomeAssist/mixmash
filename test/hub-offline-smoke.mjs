/** Homepage worker upgrade preserves game data and the six launch links offline. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { startStaticServer } from './static-server.mjs';
const server = await startStaticServer();
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.origin);
  const version = (await readFile(new URL('../sw.js', import.meta.url), 'utf8')).match(/const VERSION = '([^']+)'/)[1];
  await page.evaluate(async () => {
    localStorage.setItem('front_of_house_v1', 'career-preservation-sentinel');
    localStorage.setItem('mixmash_opts', 'options-preservation-sentinel');
    const old = await caches.open('mixmash-prior-hub');
    await old.put('/', new Response('prior homepage'));
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForFunction(async cache => (await caches.keys()).includes(cache) && !(await caches.keys()).includes('mixmash-prior-hub'), `mixmash-${version}`);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
  assert.equal(await page.locator('.game-card .play-link').count(), 6);
  await page.locator('#details-front-of-house').click();
  await page.waitForFunction(() => !document.getElementById('game-front-of-house').hidden);
  assert.equal(await page.locator('#game-front-of-house .primary').getAttribute('href'), '/front-of-house/');
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('front_of_house_v1'), localStorage.getItem('mixmash_opts')]), ['career-preservation-sentinel', 'options-preservation-sentinel']);
  console.log('Offline homepage, stale cache replacement and game storage preservation passed. External games and uncached game binaries are not covered.');
} finally { await browser.close(); await server.close(); }
