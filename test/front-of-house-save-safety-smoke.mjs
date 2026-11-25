/** Save safety (0.4.6): a newer-version or damaged save is backed up and never overwritten, a
 * second tab that can't read the save stops writing, Start new backs up first, and a resize
 * keeps an open window. Chromium, classic view. Set FOH_SHOTS=<dir> to keep screenshots. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';
import { SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';

const BACKUP = `${SAVE_NAMESPACE}.backup`;
const shots = process.env.FOH_SHOTS || '';
if (shots) mkdirSync(shots, { recursive: true });
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const stored = (page) => page.evaluate((key) => localStorage.getItem(key), SAVE_NAMESPACE);
const backup = (page) => page.evaluate((key) => localStorage.getItem(key), BACKUP);
const NEWER = JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION + 1, savedAt: '2026-12-01T00:00:00.000Z', state: { schema: SCHEMA_VERSION + 1, seed: 9, phase: 'promote', cash: 99999, history: [{ showId: 1 }] } });
const CORRUPT = '{"ns":"front_of_house_v1","v":2,"state":{"schema":2,"cash":12';

const server = await startStaticServer();
const browser = await chromium.launch(launchOptions());
const url = `${server.origin}/front-of-house/?renderer=2d`;

async function open(context, seed) {
  const page = await context.newPage();
  const failures = trackPageFailures(page, server.origin);
  if (seed !== undefined) {
    await page.goto(url);
    await page.waitForFunction(() => !!window.__frontOfHouse);
    await page.evaluate(([key, text]) => { localStorage.clear(); localStorage.setItem(key, text); }, [SAVE_NAMESPACE, seed]);
    await page.reload();
  } else await page.goto(url);
  await page.waitForFunction(() => !!window.__frontOfHouse);
  return { page, failures };
}

try {
  for (const [status, text] of [['newer', NEWER], ['corrupt', CORRUPT]]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const { page, failures } = await open(context, text);
    await page.waitForSelector('#save-guard');
    assert.equal(await page.getAttribute('#save-guard', 'data-status'), status);
    const guard = await page.evaluate(() => window.__frontOfHouse.saveGuard());
    assert.equal(guard.status, status);
    assert.equal(guard.backup, BACKUP);
    if (status === 'newer') assert.match(await page.textContent('#save-guard'), /newer version.*Reload to update/);
    assert.equal(await stored(page), text, 'the unreadable save is untouched after load');
    assert.equal(await backup(page), text, 'the raw save is backed up');
    await shot(page, `save-guard-${status}`);
    // Playing on does not write over it.
    await page.locator('[data-deal="guarantee"]').first().click();
    assert.equal(await page.evaluate(() => window.__frontOfHouse.state().phase), 'build');
    assert.equal(await stored(page), text, 'actions do not autosave over the unreadable save');
    // Reloading keeps it unreadable and still untouched.
    await page.reload();
    await page.waitForSelector('#save-guard');
    assert.equal(await stored(page), text);
    // Start new is explicit, keeps the backup and resumes saving.
    await page.click('#save-guard [data-guard="new"]');
    await page.waitForFunction(() => !document.getElementById('save-guard'));
    assert.equal(await backup(page), text, 'the backup survives Start new');
    const fresh = JSON.parse(await stored(page));
    assert.equal(fresh.state.schema, SCHEMA_VERSION);
    assert.equal(fresh.state.phase, 'book');
    assert.equal(await page.evaluate(() => window.__frontOfHouse.saveGuard()), null);
    if (status === 'corrupt') await shot(page, 'save-guard-after-start-new');
    assert.deepEqual(failures, []);
    await context.close();
    console.log(`PASS: ${status} save is backed up, never overwritten, and replaced only by Start new`);
  }

  {
    // Two tabs: tab B receives a save it cannot read and must not write its own game back.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const a = await open(context);
    const b = await open(context);
    await a.page.locator('[data-deal="guarantee"]').first().click();
    await b.page.waitForFunction(() => window.__frontOfHouse.state().phase === 'build');
    const good = await stored(a.page);
    await a.page.evaluate(([key, text]) => localStorage.setItem(key, text), [SAVE_NAMESPACE, NEWER]);
    await b.page.waitForSelector('#save-guard');
    assert.equal(await b.page.getAttribute('#save-guard', 'data-status'), 'newer');
    await b.page.evaluate(() => window.__frontOfHouse.act({ type: 'back' }));
    await b.page.evaluate(() => window.__frontOfHouse.act({ type: 'chooseDeal', deal: 'door' }));
    assert.equal(await stored(b.page), NEWER, 'the second tab does not write over a save it cannot read');
    assert.equal(await backup(b.page), NEWER);
    // A readable save written elsewhere clears the notice and is adopted.
    await a.page.evaluate(([key, text]) => localStorage.setItem(key, text), [SAVE_NAMESPACE, good]);
    await b.page.waitForFunction(() => !document.getElementById('save-guard'));
    assert.equal(await b.page.evaluate(() => window.__frontOfHouse.state().phase), 'build');
    assert.equal(await stored(b.page), good);
    assert.deepEqual([...a.failures, ...b.failures], []);
    await context.close();
    console.log('PASS: a second tab that cannot read the save stops writing and recovers when a readable save arrives');
  }

  {
    // Resize keeps an open window: no rebuild within the same compact layout, and scroll,
    // focus and the window itself survive a layout change.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const { page, failures } = await open(context);
    await shot(page, 'normal-play-book');
    await page.click('[data-act="deal-help"]');
    await page.waitForSelector('.win:not([hidden])');
    await page.evaluate(() => { const b = document.getElementById('win-body'); b.firstElementChild?.setAttribute('data-marker', '1'); b.scrollTop = 40; });
    const before = await page.evaluate(() => document.getElementById('win-body').scrollTop);
    await page.setViewportSize({ width: 1180, height: 790 });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => !!document.querySelector('#win-body [data-marker="1"]')), true, 'same layout: the window is not rebuilt');
    assert.equal(await page.evaluate(() => document.getElementById('win-body').scrollTop), before);
    await page.setViewportSize({ width: 1180, height: 540 });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__frontOfHouse.state().phase), 'book');
    assert.equal(await page.evaluate(() => !document.querySelector('.win').hidden), true, 'the window stays open after a layout change');
    assert.deepEqual(failures, []);
    await context.close();
    console.log('PASS: resizing keeps the open window, its scroll and its layout');
  }
} finally {
  await browser.close();
  await server.close();
}
