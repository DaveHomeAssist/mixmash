/**
 * Browser smoke rail for Front of House (/front-of-house/).
 *
 * Plays the first playable through its real interface (book, build with the
 * suggested layout, promote, show night, settle), then checks reload, keyboard
 * placement, save codes, signing during the post-incident wind-down, reduced
 * motion, a phone-width layout and small-text contrast. Game state is read through `window.render_game_to_text()` and the
 * `window.__frontOfHouse` hook, so the assertions don't depend on markup details.
 *
 *   npm run smoke:front-of-house
 *   FRONT_OF_HOUSE_SCREENSHOT_DIR=... keeps the screenshots somewhere specific.
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';
import { applyAction, createGame, settlementFor, showPreview } from '../front-of-house/engine.mjs';
import { AD_STEP, INCIDENTS, PERMIT_CAP, SAVE_NAMESPACE, SCHEMA_VERSION, START_CASH, STARTER_LAYOUT } from '../front-of-house/data.mjs';
import { readFile } from 'node:fs/promises';

const server = await startStaticServer();
const url = `${server.origin}/front-of-house/`;
const output = process.env.FRONT_OF_HOUSE_SCREENSHOT_DIR || await mkdtemp(join(tmpdir(), 'front-of-house-smoke-'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch(launchOptions());
const checks = [];
const ok = (name) => { checks.push(name); console.log(`  ok  ${name}`); };

async function open(context) {
  const page = await context.newPage();
  const failures = trackPageFailures(page, server.origin);
  await page.goto(url);
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  return { page, failures };
}
const game = async (page) => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

try {
  // 1. The full loop through the interface.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page, failures } = await open(context);
  assert.equal((await game(page)).phase, 'book');
  await page.click('[data-deal="guarantee"]');
  assert.equal((await game(page)).phase, 'build');
  assert.equal(await page.isDisabled('[data-act="confirm-build"]'), true, 'an empty lot cannot be confirmed');
  await page.click('[data-act="starter"]');
  const built = await game(page);
  assert.equal(built.venue.ready, true);
  assert.equal(built.venue.capacity, PERMIT_CAP, 'the suggested layout fills the Lot permit');
  await page.screenshot({ path: join(output, 'build.png') });
  await page.click('[data-act="confirm-build"]');
  assert.equal((await game(page)).phase, 'promote');
  await page.focus('#price');
  await page.keyboard.press('ArrowRight');
  assert.equal((await game(page)).promotion.price, 21, 'the price slider drives the engine');
  await page.focus('#ad-social');
  await page.keyboard.press('ArrowRight');
  assert.equal((await game(page)).promotion.ads.social, AD_STEP);
  await page.click('[data-act="confirm-promo"]');
  assert.equal((await game(page)).phase, 'show');
  await page.click('[data-act="skip"]');
  await page.waitForSelector('[data-act="respond"]');
  await page.screenshot({ path: join(output, 'show.png') });
  await page.click('[data-act="respond"]:not([disabled])');
  const settling = await game(page);
  assert.equal(settling.phase, 'settle');
  assert.ok(settling.settlement && Number.isInteger(settling.settlement.net));
  const sheet = await page.textContent('#panel');
  assert.ok(sheet.includes('SECTION A') && sheet.includes('SECTION B') && sheet.includes('SECTION C'), 'the settlement sheet has its three sections');
  await page.screenshot({ path: join(output, 'settle.png'), fullPage: true });
  await page.click('[data-act="accept"]');
  const done = await game(page);
  assert.equal(done.phase, 'done');
  assert.equal(done.history, 1);
  assert.equal(done.cash, START_CASH + done.settlement.net, 'cash after settlement is the starting cash plus the net');
  ok('plays Book through Settle and the cash adds up');

  await page.reload();
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  const reloaded = await game(page);
  assert.equal(reloaded.phase, 'done');
  assert.equal(reloaded.cash, done.cash);
  ok('the game survives a reload');

  // 2. Save codes: export, import elsewhere, and refuse a bad code without touching the save.
  await page.click('#save-menu summary');
  await page.click('[data-save="export"]');
  const code = await page.inputValue('#save-code');
  assert.ok(code.length > 20, 'a save code is shown');
  const other = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page: page2, failures: failures2 } = await open(other);
  await page2.click('#save-menu summary');
  await page2.fill('#save-code', Buffer.from('{"evil":true}').toString('base64'));
  await page2.click('[data-save="import"]');
  assert.match(await page2.textContent('#save-status'), /isn't a Front of House save/);
  assert.equal((await game(page2)).phase, 'book', 'a bad code changes nothing');
  await page2.fill('#save-code', code);
  await page2.click('[data-save="import"]');
  const imported = await game(page2);
  assert.equal(imported.phase, 'done');
  assert.equal(imported.cash, done.cash);
  const v1 = JSON.parse(await readFile(new URL('../front-of-house/test/fixtures/save-v1.json', import.meta.url), 'utf8'));
  await page2.fill('#save-code', Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: 1, savedAt: '2026-10-01T00:00:00.000Z', state: v1 })).toString('base64'));
  await page2.click('[data-save="import"]');
  const migrated = await game(page2);
  assert.equal(migrated.phase, 'book', 'a finished version 1 show moves on to the next show');
  assert.equal(migrated.cash, Math.round(v1.cash / 2), 'version 1 cash converts to the Lot scale');
  ok('save codes move a game, version 1 codes convert, and bad codes are refused');

  // 3. Keyboard placement on the board.
  await page2.click('[data-save="new"]');
  await page2.click('[data-save="new"]');
  assert.equal((await game(page2)).phase, 'book');
  await page2.click('[data-deal="door"]');
  await page2.focus('#board');
  await page2.keyboard.press('ArrowUp');
  for (let i = 0; i < 6; i += 1) await page2.keyboard.press('ArrowUp');
  await page2.keyboard.press('Enter');
  const placed = await page2.evaluate(() => window.__frontOfHouse.state().venue.objects);
  assert.equal(placed.length, 1);
  assert.equal(placed[0].type, 'stage');
  assert.match(await page2.textContent('#board-status'), /Tile \d+, \d+: Stage/);
  await page2.keyboard.press('Delete');
  assert.equal((await page2.evaluate(() => window.__frontOfHouse.state().venue.objects)).length, 0);
  ok('the board places and removes objects from the keyboard');

  // Signing inside the three-second wind-down after the incident still leaves
  // the board on the signed crowd. Seed 1 rains, so the crowd the board shows
  // before the incident differs from the one that is signed.
  const RAIN_SEED = 1;
  let rehearsal = createGame(RAIN_SEED);
  for (const action of [{ type: 'chooseDeal', deal: 'door' }, { type: 'setLayout', objects: STARTER_LAYOUT }, { type: 'confirmBuild' }, { type: 'confirmPromotion' }]) {
    rehearsal = applyAction(rehearsal, action).state;
  }
  const previewCrowd = showPreview(rehearsal).attendance;
  rehearsal = applyAction(rehearsal, { type: 'respond', responseId: INCIDENTS[rehearsal.show.incidentId].responses.find((r) => r.cost <= rehearsal.cash).id }).state;
  assert.notEqual(settlementFor(rehearsal).attendance, previewCrowd, 'the pinned seed changes the crowd, so this check can catch a stale board');
  await page2.fill('#save-code', Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state: createGame(RAIN_SEED) })).toString('base64'));
  await page2.click('[data-save="import"]');
  await page2.click('[data-deal="door"]');
  await page2.click('[data-act="starter"]');
  await page2.click('[data-act="confirm-build"]');
  await page2.click('[data-act="confirm-promo"]');
  await page2.click('[data-act="skip"]');
  await page2.click('[data-act="respond"]:not([disabled])');
  await page2.click('[data-act="accept"]');
  await page2.waitForTimeout(150);
  const signedEarly = await game(page2);
  assert.equal(signedEarly.phase, 'done');
  assert.equal(signedEarly.crowd, signedEarly.settlement.attendance, 'the board crowd matches the signed attendance');
  ok('signing during the wind-down settles the board on the signed crowd');

  // 4. Reduced motion goes straight to the incident.
  const calm = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const { page: page3, failures: failures3 } = await open(calm);
  await page3.click('[data-deal="door"]');
  await page3.click('[data-act="starter"]');
  await page3.click('[data-act="confirm-build"]');
  await page3.click('[data-act="confirm-promo"]');
  await page3.waitForSelector('[data-act="respond"]', { timeout: 2000 });
  ok('reduced motion skips the playback to the incident');

  // 5. Phone width and small-text contrast.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { page: page4, failures: failures4 } = await open(phone);
  const overflow = await page4.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `no horizontal scroll at 390px (overflow ${overflow}px)`);
  await page4.screenshot({ path: join(output, 'phone.png'), fullPage: true });
  ok('fits a 390px phone without horizontal scrolling');

  const lowContrast = await page.evaluate(() => {
    const rgb = (v) => (v.match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => c.slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const bad = [];
    for (const node of document.querySelectorAll('.lede, .eyebrow, .meta-label, .board-help, .tagline, .stats dt, .meters dt, .credit, figcaption')) {
      if (!node.getClientRects().length) continue;
      let p = node; let bg;
      while (p) { const c = rgb(getComputedStyle(p).backgroundColor); if (c.length === 3 || c[3] === 1) { bg = c; break; } p = p.parentElement; }
      const [hi, lo] = [lum(rgb(getComputedStyle(node).color)), lum(bg || [14, 17, 23])].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      if (ratio < 4.5) bad.push(`${node.className}: ${ratio.toFixed(2)}`);
    }
    return bad;
  });
  assert.deepEqual(lowContrast, [], 'small text meets 4.5:1');
  ok('small text meets the 4.5:1 contrast ratio');

  assert.deepEqual([...failures, ...failures2, ...failures3, ...failures4], [], 'no page errors, console errors or failed requests');
  ok('loads clean: no page errors, console errors or failed requests');

  await Promise.all([context, other, calm, phone].map((c) => c.close()));
} finally {
  await browser.close();
  await server.close();
}

console.log(`\nfront-of-house smoke: ${checks.length} checks passed. Screenshots: ${output}`);
