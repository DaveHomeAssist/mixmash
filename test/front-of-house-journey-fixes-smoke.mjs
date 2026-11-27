/** Front of House 0.4.8: fixes from the 2026-11-25 first-time-player walkthrough. A placement
 * the engine accepted is reported as placed (not "overlaps"), the required fence never promises
 * an extra charge, leaving a refused tool clears its refusal, a suggestion ring never looks like
 * a second selected tool, labels keep their capitals and say tap on touch screens, the Deals
 * button's name contains its text, the Remove tool has one name, save files use the local date,
 * the game's name shows clear of the hub pills when the strip has room, and the night plays on
 * after the incident answer before the settlement opens. Chromium 1440x900 and WebKit 390x844 touch. */
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';

const server = await startStaticServer();
const url = `${server.origin}/front-of-house/?renderer=2d`;
const ok = (name) => console.log(`  ok  ${name}`);
async function open(browser, options) {
  const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, ...options });
  const page = await context.newPage();
  const failures = trackPageFailures(page, server.origin);
  await page.goto(url);
  await page.waitForFunction(() => !!window.__frontOfHouse);
  return { context, page, failures };
}
const text = (page, selector) => page.evaluate((s) => document.querySelector(s)?.textContent || '', selector);
const pick = (page, value) => page.evaluate((v) => document.querySelector(`input[name="tool"][value="${v}"]`).click(), value);
async function clickTile(page, x, y) {
  const c = await page.evaluate(([x, y]) => __frontOfHouse.boardClientOf(x + 0.5, y + 0.5), [x, y]);
  await page.mouse.move(c.x, c.y);
  await page.mouse.click(c.x, c.y);
}

const chrome = await chromium.launch(launchOptions());
{
  const { context, page, failures } = await open(chrome, { viewport: { width: 1440, height: 900 } });
  const brand = await page.evaluate(() => {
    const nav = window.__mixmashNav?.element?.getBoundingClientRect(), h1 = document.querySelector('.brand h1').getBoundingClientRect();
    return { navRight: nav ? nav.right : 0, left: h1.left, width: h1.width, overflow: document.querySelector('.topbar').scrollWidth - document.querySelector('.topbar').clientWidth };
  });
  assert.ok(brand.width > 40 && brand.left >= brand.navRight, `the game's name shows after the hub pills at 1440 (${JSON.stringify(brand)})`);
  assert.ok(brand.overflow <= 1, 'the strip does not overflow');
  ok('the game name sits clear of the hub pills');

  const deals = await page.evaluate(() => { const b = document.querySelector('[data-act="deal-help"]'); return { text: b.textContent.replace(/^ⓘ\s*/, ''), aria: b.getAttribute('aria-label') }; });
  assert.ok(deals.aria.startsWith(deals.text), `the Deals button name starts with its visible text (${deals.aria})`);
  await page.locator('[data-deal="door"]:visible').first().click();
  const cost = () => text(page, '.cost-readout dd');
  const before = await cost();
  assert.doesNotMatch(await text(page, '#fence-btn'), /\+\$/, 'the fence button does not promise an extra charge');
  await page.click('#fence-btn');
  assert.equal(await cost(), before, 'the fence cost was already in Show cost so far');
  assert.match(await page.getAttribute('#fence-btn', 'title'), /already in Show cost so far/);
  ok('the required fence kit says its cost is already counted');

  await pick(page, 'stage');
  await clickTile(page, 9, 1);
  assert.equal(await text(page, '#board-status'), 'Placed the stage at 9, 1.', 'a successful placement is reported as placed, not as an overlap');
  await page.mouse.move(5, 450);
  await pick(page, 'pa-s');
  assert.match(await text(page, '#tool-info'), /Placing the PA \(small\)/, 'the PA keeps its capitals');
  assert.match(await text(page, '#tool-info'), /Click a tile/, 'a mouse is told to click');
  await clickTile(page, 8, 2);
  assert.equal(await text(page, '#board-status'), 'Placed the PA (small) at 8, 2.');
  assert.equal(await text(page, '#msg'), 'Placed the PA (small) at 8, 2.');
  await page.mouse.move(5, 450);
  await clickTile(page, 1, 8);
  assert.match(await text(page, '#board-status'), /overlaps|Only one PA|must touch/, 'a real refusal still says why');
  ok('placements read as placed; refusals still explain themselves; labels keep their capitals');

  await pick(page, 'exit');
  await clickTile(page, 12, 8);
  assert.match(await text(page, '#msg'), /boundary/);
  await page.keyboard.press('Escape');
  assert.equal(await text(page, '#msg'), '', 'Escape clears the refusal along with the tool');
  const tiles = await page.evaluate(() => [...document.querySelectorAll('.tools-plate .tile, #select-btn')].map((t) => ({ name: t.querySelector('.tile-name')?.textContent, ring: t.classList.contains('ring'), selected: t.matches(':has(input:checked), [aria-pressed="true"]'), outline: getComputedStyle(t).outlineStyle, shadow: getComputedStyle(t).boxShadow })));
  assert.deepEqual(tiles.filter((t) => t.selected).map((t) => t.name), ['Select'], 'one tool is selected');
  const ring = tiles.find((t) => t.ring);
  assert.ok(!ring || (ring.outline === 'dashed' && ring.shadow === 'none'), `a suggestion ring is dashed, unlike the selected tool (${JSON.stringify(ring)})`);
  ok('leaving a tool clears its refusal and only one tool looks selected');

  await page.keyboard.press('b');
  assert.match(await text(page, '#board-status'), /^Remove tool\./);
  assert.equal(await text(page, '[data-binding="bulldoze"] dd'), 'Remove tool on or off');
  assert.equal(await page.getAttribute('#doze-btn', 'title'), 'Remove · key B');
  assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /Bulldoz/);
  ok('the Remove tool has one name');
  assert.deepEqual(failures, []);
  await context.close();
}
{
  const { context, page } = await open(chrome, { viewport: { width: 1280, height: 800 }, timezoneId: 'America/New_York' });
  await page.clock.setFixedTime(new Date('2026-11-26T04:28:00Z'));
  await page.click('#menu-btn');
  await page.click('#save-menu summary');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-save="download"]')]);
  assert.equal(download.suggestedFilename(), 'front-of-house-save-2026-11-25.txt', 'a save at 11:28 PM ET on Nov 25 is named Nov 25');
  ok('save files are named by the local date');
  await context.close();
}
await chrome.close();

const safari = await webkit.launch();
{
  const { context, page } = await open(safari, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.locator('[data-deal="door"]:visible').first().tap();
  await pick(page, 'pa-s');
  assert.match(await text(page, '#tool-info'), /Tap a tile touching the stage/, 'touch is told to tap');
  assert.match(await text(page, '#board-status'), /nothing is placed until you tap one/);
  assert.doesNotMatch(await text(page, '#tool-info') + await text(page, '#board-status'), /\bclick/i);
  ok('touch screens are told to tap');
  await context.close();
}
await safari.close();
await server.close();
