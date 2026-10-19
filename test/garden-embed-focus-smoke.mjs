/** Garden wrapper: Fullscreen and Mute hand keyboard focus back to the game iframe, and Space/Enter never toggle the strip buttons. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer, trackPageFailures } from './static-server.mjs';
const server = await startStaticServer();
const { origin } = server;
const browser = await chromium.launch();
// Stand-in for the cross-origin Garden OS build: reports every key it receives to the wrapper.
const STUB = `<!doctype html><html><body style="margin:0;background:#264">stub<script>
for (const type of ['keydown']) addEventListener(type, (e) => parent.postMessage({ gardenKey: e.key }, '*'));
</script></body></html>`;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await context.route('https://davehomeassist.github.io/garden-os/story-mode/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: STUB }));
  const page = await context.newPage();
  const failures = trackPageFailures(page, origin);
  await page.addInitScript(() => {
    window.__gameKeys = [];
    window.__buttonKeys = [];
    addEventListener('message', (e) => { if (e.data && e.data.gardenKey) window.__gameKeys.push(e.data.gardenKey); });
    addEventListener('keydown', (e) => { if (e.target && e.target.closest && e.target.closest('.mixnav')) window.__buttonKeys.push(e.key); }, true);
  });
  await page.goto(`${origin}/garden/`, { waitUntil: 'networkidle' });
  const fsBtn = page.locator('.mixnav button[title*="ullscreen"]');
  await fsBtn.waitFor();
  const activeIsGame = () => page.evaluate(() => document.activeElement && document.activeElement.id === 'game-frame');
  const keysAfter = async (key) => {
    const before = await page.evaluate(() => window.__gameKeys.length);
    await page.keyboard.press(key);
    await page.waitForFunction(n => window.__gameKeys.length > n, before, { timeout: 3000 });
    return page.evaluate(() => window.__gameKeys.at(-1));
  };

  // Enter fullscreen: the stage fills the screen and the game, not "Exit Full", holds focus.
  await fsBtn.click();
  await page.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.id === 'garden-stage');
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'game-frame');
  await page.waitForFunction(() => /Exit Full/.test(document.querySelector('.mixnav button[title*="ullscreen"]').textContent));
  assert.equal(await keysAfter('2'), '2', 'hotkey reaches the game in fullscreen');
  assert.equal(await keysAfter(' '), ' ', 'Space reaches the game in fullscreen');
  assert.equal(await keysAfter('Enter'), 'Enter', 'Enter reaches the game in fullscreen');
  assert.ok(await page.evaluate(() => !!document.fullscreenElement), 'Space/Enter did not toggle fullscreen off');
  assert.deepEqual(await page.evaluate(() => window.__buttonKeys), [], 'no key landed on a strip button');

  // Exit fullscreen via the button: focus returns to the game.
  await fsBtn.click();
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'game-frame');
  assert.equal(await keysAfter('2'), '2', 'hotkey reaches the game after exit');

  // Mute keeps the existing blur-and-refocus behaviour.
  await page.locator('.mixnav button[title*="ute"]').first().click();
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'game-frame');
  assert.equal(await keysAfter(' '), ' ', 'Space reaches the game after Mute');
  assert.ok(await activeIsGame());
  assert.deepEqual(await page.evaluate(() => window.__buttonKeys), [], 'no key landed on a strip button');
  assert.deepEqual(failures, [], 'no page failures');
  await context.close();
  console.log('garden embed focus smoke: ok');
} finally {
  await browser.close();
  await server.close();
}
