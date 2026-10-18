/** Hub "pick up where you left off": Continue tag, expiry, Pick for me exclusion, route markers, Garden mute memory. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { playableGames } from '../src/hub/catalog.mjs';
import { startStaticServer, trackPageFailures } from './static-server.mjs';
const server = await startStaticServer();
const { origin } = server;
const DAY = 24 * 60 * 60 * 1000;
const order = playableGames.map(game => game.id);
const browser = await chromium.launch();
async function landing(lastGame, { width = 1440, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', hasTouch: width < 701 });
  // Seed once, before the first load only, so later reloads see what the page left behind.
  await context.addInitScript(value => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (value === undefined) localStorage.removeItem('mm.lastGame'); else localStorage.setItem('mm.lastGame', value);
  }, typeof lastGame === 'string' || lastGame === undefined ? lastGame : JSON.stringify(lastGame));
  const page = await context.newPage();
  const failures = trackPageFailures(page, origin);
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
  return { context, page, failures };
}
const tagged = page => page.locator('.game-card:has(.continue-tag)').evaluateAll(cards => cards.map(card => card.dataset.game));
const stored = page => page.evaluate(() => localStorage.getItem('mm.lastGame'));
const cardOrder = page => page.locator('.game-card').evaluateAll(cards => cards.map(card => card.dataset.game));
try {
  // Fresh entry: tag + outline on that card only, order untouched, tag inside the card at 360px and desktop.
  for (const [width, height] of [[360, 780], [1440, 900]]) {
    const { context, page, failures } = await landing({ slug: 'garden', t: Date.now() - 13 * DAY }, { width, height });
    assert.deepEqual(await tagged(page), ['garden'], `${width}px: only the last game is tagged`);
    assert.deepEqual(await cardOrder(page), order, `${width}px: cards never reorder`);
    const card = page.locator('.game-card[data-game="garden"]');
    if (await card.isHidden()) { await page.locator('#next-page').click(); }
    const tag = card.locator('.continue-tag');
    assert.equal((await tag.textContent()).trim(), 'Continue');
    assert.ok(await tag.isVisible(), `${width}px: tag visible without hover`);
    const fit = await card.evaluate(element => {
      const c = element.getBoundingClientRect(); const t = element.querySelector('.continue-tag').getBoundingClientRect();
      const style = getComputedStyle(element.querySelector('.continue-tag'));
      return { inside: t.left >= c.left && t.right <= c.right && t.top >= c.top && t.bottom <= c.bottom, size: parseFloat(style.fontSize), ring: getComputedStyle(element).boxShadow };
    });
    assert.ok(fit.inside, `${width}px: tag fits inside its card`);
    assert.ok(fit.size >= 10, `${width}px: tag text stays readable`);
    assert.match(fit.ring, /0px 0px 0px 2px/, `${width}px: card carries the accent outline`);
    assert.equal(await card.locator('.play-link').getAttribute('aria-describedby'), 'continue-garden');
    assert.match(await stored(page), /"garden"/, 'a valid entry is kept');
    assert.deepEqual(failures, []);
    await context.close();
  }
  // Expired, malformed, unknown or future entries are deleted and ignored.
  for (const [label, value] of [
    ['expired', { slug: 'garden', t: Date.now() - 14 * DAY - 1000 }],
    ['malformed JSON', '{"slug":'],
    ['unknown game', { slug: 'zelda2mario', t: Date.now() }],
    ['missing time', { slug: 'garden' }],
    ['future time', { slug: 'garden', t: Date.now() + 2 * DAY }],
    ['not an object', '"garden"'],
  ]) {
    const { context, page, failures } = await landing(value);
    assert.deepEqual(await tagged(page), [], `${label}: no tag`);
    assert.equal(await page.locator('.game-card.is-last-played').count(), 0, `${label}: no outline`);
    assert.equal(await stored(page), null, `${label}: entry deleted`);
    assert.deepEqual(failures, []);
    await context.close();
  }
  // Pick for me never lands on the last-played game while others exist.
  {
    const { context, page } = await landing({ slug: 'pitch', t: Date.now() });
    const picks = new Set();
    for (let i = 0; i < 40; i++) {
      await page.goto(`${origin}/#games`); await page.locator('#pick-game').click();
      await page.waitForFunction(() => location.hash.startsWith('#game-'));
      picks.add(await page.evaluate(() => location.hash.slice(6)));
    }
    assert.ok(!picks.has('pitch'), `Pick for me skipped the last game: ${[...picks]}`);
    assert.ok(picks.size >= 3, `Pick for me still varies: ${[...picks]}`);
    await context.close();
  }
  // Without a last game, every game stays eligible.
  {
    const { context, page } = await landing(undefined);
    const picks = new Set();
    for (let i = 0; i < 60; i++) {
      await page.goto(`${origin}/#games`); await page.locator('#pick-game').click();
      await page.waitForFunction(() => location.hash.startsWith('#game-'));
      picks.add(await page.evaluate(() => location.hash.slice(6)));
    }
    assert.equal(picks.size, order.length, `all games pickable without a last game: ${[...picks]}`);
    await context.close();
  }
  // EMPIRES cannot carry the marker, so launching it from the hub records it.
  {
    const { context, page } = await landing(undefined);
    await page.route(`${origin}/empires/**`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
    await page.locator('.game-card[data-game="empires"] .play-link').click();
    await page.waitForURL(/\/empires\/$/);
    const entry = JSON.parse(await stored(page));
    assert.equal(entry.slug, 'empires'); assert.ok(Date.now() - entry.t < 60000);
    await context.close();
  }
  // Each marked game route records itself on load (external Garden frame and heavy runtimes stubbed out).
  for (const game of playableGames.filter(game => game.id !== 'empires')) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route(/^https:\/\/davehomeassist\.github\.io\//, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
    const page = await context.newPage();
    await page.goto(`${origin}${game.route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => localStorage.getItem('mm.lastGame') !== null, null, { timeout: 15000 });
    const entry = JSON.parse(await stored(page));
    assert.equal(entry.slug, game.id, `${game.route} records ${game.id}`);
    assert.ok(Math.abs(Date.now() - entry.t) < 60000);
    await context.close();
  }
  // Garden wrapper: Mute All persists in mm.prefs and restores with the right aria-pressed.
  {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route(/^https:\/\/davehomeassist\.github\.io\//, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
    await context.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1'); localStorage.setItem('mm.prefs', JSON.stringify({ muteAll: true, other: 'kept' }));
    });
    const page = await context.newPage();
    const failures = trackPageFailures(page, origin);
    await page.goto(`${origin}/garden/`);
    const mute = page.locator('.garden-bar .mixnav button[title*="ute"]').first();
    await page.waitForFunction(() => window.__mixmashNav && document.querySelector('.garden-bar .mixnav'));
    assert.equal(await mute.getAttribute('aria-pressed'), 'true', 'saved mute restores pressed');
    assert.equal(await page.evaluate(() => window.__mixmashNav.isMuted()), true);
    await mute.click();
    assert.equal(await mute.getAttribute('aria-pressed'), 'false', 'tap flips to unmuted');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('mm.prefs'))), { muteAll: false, other: 'kept' });
    await page.waitForFunction(() => document.activeElement === document.getElementById('game-frame'), null, { timeout: 5000 });
    await page.reload();
    await page.waitForFunction(() => window.__mixmashNav && document.querySelector('.garden-bar .mixnav'));
    assert.equal(await mute.getAttribute('aria-pressed'), 'false', 'unmuted survives reload');
    await mute.click();
    assert.equal(await mute.getAttribute('aria-pressed'), 'true');
    await page.reload();
    await page.waitForFunction(() => window.__mixmashNav && document.querySelector('.garden-bar .mixnav'));
    assert.equal(await mute.getAttribute('aria-pressed'), 'true', 'muted survives reload');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mm.prefs')).muteAll), true);
    assert.equal(await page.locator('#game-frame').getAttribute('src'), 'https://davehomeassist.github.io/garden-os/story-mode/', 'iframe unchanged');
    assert.deepEqual(failures, []);
    await context.close();
  }
  console.log('Hub resume: Continue tag, expiry cleanup, Pick for me exclusion, route markers and Garden mute memory passed.');
} finally { await browser.close(); await server.close(); }
