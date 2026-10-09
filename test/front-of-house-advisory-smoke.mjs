// Real Advisory desk controls, immutable reads, phase/room routing and contained layouts.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';
import * as E from '../front-of-house/engine.mjs';
import * as D from '../front-of-house/data.mjs';

const server = await startStaticServer();
const base = process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
const output = process.env.FRONT_OF_HOUSE_SCREENSHOT_DIR || await mkdtemp(join(tmpdir(), 'foh-advisory-'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch(launchOptions());
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = trackPageFailures(page, new URL(base).origin);
const checks = [];
const ok = name => { checks.push(name); console.log(`ok ${name}`); };
const game = () => page.evaluate(() => window.__frontOfHouse.state());
const snapshot = () => page.evaluate(ns => ({ state: window.__frontOfHouse.state(), save: localStorage.getItem(ns) }), D.SAVE_NAMESPACE);
async function load(state) {
  await page.goto(`${base}?renderer=2d`);
  await page.waitForFunction(() => window.__frontOfHouse);
  if (await page.locator('#win').isVisible()) await page.keyboard.press('Escape');
  await page.click('#menu-btn');
  await page.click('#save-menu summary');
  await page.fill('#save-code', Buffer.from(JSON.stringify({ ns: D.SAVE_NAMESPACE, v: D.SCHEMA_VERSION, state })).toString('base64'));
  await page.click('[data-save="import"]');
  assert.equal((await game()).phase, state.phase);
}
async function openDesk() {
  if (await page.locator('#win').isVisible()) await page.keyboard.press('Escape');
  if (await page.isHidden('#menu')) await page.click('#menu-btn');
  await page.click('[data-act="advisory-open"]');
  assert.equal(await page.locator('#win').getAttribute('data-kind'), 'advisory');
}
async function fit() {
  const bad = await page.evaluate(() => {
    const root = document.documentElement, body = document.querySelector('#win-body');
    const nodes = [...body.querySelectorAll('.advisory-page:not(.tab-off) button, .tabbar button, .advisory-page:not(.tab-off) dt, .advisory-page:not(.tab-off) dd')];
    const rect = body.getBoundingClientRect();
    return { root: [root.scrollWidth - root.clientWidth, root.scrollHeight - root.clientHeight],
      overflow: [body.scrollWidth - body.clientWidth, body.scrollHeight - body.clientHeight],
      clipped: nodes.filter(n => { const r = n.getBoundingClientRect(); return r.left < rect.left - 1 || r.right > rect.right + 1 || r.top < rect.top - 1 || r.bottom > rect.bottom + 1 || n.scrollWidth > n.clientWidth + 1; }).map(n => n.textContent),
      small: nodes.filter(n => n.tagName === 'BUTTON' && n.getBoundingClientRect().height < 44).map(n => n.textContent) };
  });
  assert.deepEqual(bad.root, [0, 0]); assert.ok(bad.overflow.every(n => n <= 1), JSON.stringify(bad));
  assert.deepEqual(bad.clipped, []); assert.deepEqual(bad.small, []);
}
async function contrast() {
  const failures = await page.evaluate(() => {
    const rgb = color => color.match(/[\d.]+/g).map(Number);
    const backgroundFor = node => {
      if (!node) return [255, 255, 255];
      const color = rgb(getComputedStyle(node).backgroundColor), alpha = color[3] ?? 1;
      const behind = alpha < 1 ? backgroundFor(node.parentElement) : color;
      return color.slice(0, 3).map((n, i) => n * alpha + behind[i] * (1 - alpha));
    };
    const lum = values => values.slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((a, n, i) => a + n * [.2126, .7152, .0722][i], 0);
    return [...document.querySelectorAll('#win .advisory-page:not(.tab-off) p, #win .advisory-page:not(.tab-off) h3, #win .advisory-page:not(.tab-off) dt, #win .advisory-page:not(.tab-off) dd, #win .advisory-page:not(.tab-off) button, #win .tabbar button')].flatMap(node => {
      const fg = lum(rgb(getComputedStyle(node).color)), bg = lum(backgroundFor(node));
      const ratio = (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
      return ratio < 4.5 ? [{ text: node.textContent, ratio }] : [];
    });
  });
  assert.deepEqual(failures, []);
}
const act = (s, a) => { const r = E.applyAction(s, a); assert.equal(r.error, null, r.error); return r.state; };
function roomStates(room) {
  let s = act(E.createGame(8, { mode: 'sandbox' }), { type: 'chooseVenue', venueId: room });
  const states = [s];
  s = act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal: room === 'festival' ? 'sponsor' : 'guarantee',
    ...(room === 'festival' ? { secondId: 'hollow-census', stagePolicy: 1, festivalPolicy: 1, supportPolicy: 1, roomPolicy: 1 } : {}),
    ...(room === 'amphitheater' ? { seatingPolicy: 1, roomPolicy: 1 } : {}) }); states.push(s);
  s = act(s, { type: 'setLayout', objects: [...E.venueSpec(s.venue).starter, ...(room === 'festival' ? D.FESTIVAL_SUPPORT_LAYOUT : [])] });
  s = act(s, { type: 'confirmBuild' }); states.push(s);
  s = act(s, { type: 'confirmPromotion' }); states.push(s);
  s = act(s, { type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses.at(-1).id }); states.push(s);
  s = act(s, { type: 'acceptSettlement', at: '2026-10-09T12:00:00.000Z' }); states.push(s);
  return states;
}

try {
  // A real first booking, layout, show response and signature, using advice along the way.
  await load(E.createGame(8));
  const bookBefore = await snapshot(); await openDesk();
  await page.screenshot({ path: join(output, 'first-booking-overview.png') });
  assert.match(await page.locator('.advisory-page:not(.tab-off)').innerText(), /Current priority · Talent/i);
  await page.locator('#win [role="tab"][data-tab-name="Talent"]').click();
  await page.locator('.advisory-page:not(.tab-off) [data-act="advisory-review"]').click();
  assert.equal(await page.locator('#win').getAttribute('data-kind'), 'deals');
  await page.click('[data-act="advisory-back"]');
  assert.equal(await page.locator('#win [role="tab"][aria-selected="true"]').innerText(), 'Talent');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#menu-btn').evaluate(n => n === document.activeElement), true);
  assert.deepEqual(await snapshot(), bookBefore);
  await page.locator('[data-act="deal"]').first().click();
  await page.click('[data-act="starter"]'); await page.click('[data-act="confirm-build"]');
  const promoteBefore = await snapshot(); await openDesk();
  await page.locator('.advisory-page:not(.tab-off) [data-act="advisory-review"]').click();
  assert.equal(await page.locator('#win').isHidden(), true); assert.deepEqual(await snapshot(), promoteBefore);
  await page.click('[data-act="confirm-promo"]');
  const skip = page.locator('#skip-btn'); if (await skip.isVisible()) await skip.click();
  await page.locator('[data-act="respond"]').last().waitFor(); await page.locator('[data-act="respond"]').last().click();
  await page.waitForFunction(() => window.__frontOfHouse.state().phase === 'settle');
  const settle = await game(), result = E.settlementFor(settle); await openDesk();
  await page.locator('.advisory-page:not(.tab-off) [data-act="advisory-review"]').click();
  await page.click('#win [data-act="accept"]');
  const signed = await game(); assert.equal(signed.cash, settle.cash + E.settlementPayout(result, settle.booking.deal));
  assert.equal(signed.history.length, settle.history.length + 1);
  await openDesk(); await page.locator('.advisory-page:not(.tab-off) [data-act="advisory-review"]').click();
  assert.equal(await page.locator('#win [data-act="accept"]').count(), 0);
  await page.click('[data-act="advisory-back"]'); await page.keyboard.press('Escape');
  assert.deepEqual(await game(), signed); ok('real booking-to-signing journey and read-only reopening, without duplicate payout');

  // The show can reveal an incident while a player is reading the desk.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await load(roomStates('lot')[3]); await openDesk();
  await page.locator('#win [role="tab"][data-tab-name="Overview"]').click();
  const running = await snapshot();
  await page.evaluate(() => window.__frontOfHouse.skip());
  assert.match(await page.locator('.advisory-page:not(.tab-off)').innerText(), /Current decision/);
  assert.equal(await page.evaluate(() => document.querySelector('#win').contains(document.activeElement)), true);
  assert.deepEqual(await snapshot(), running);
  await page.keyboard.press('Escape'); await page.emulateMedia({ reducedMotion: 'reduce' });
  ok('newly observable incident refreshes advice without stealing modal focus or changing the save');

  for (const room of Object.keys(D.VENUES)) for (const state of roomStates(room)) {
    await load(state); const before = await snapshot(); await openDesk();
    for (const [width, height] of [[1440,900], [360,780]]) {
      await page.setViewportSize({ width, height });
      for (const tab of ['Overview', 'Ticketing', 'Talent', 'Operations']) {
        await page.locator(`#win [role="tab"][data-tab-name="${tab}"]`).click();
        await fit();
        const label = await page.locator(`#win [role="tab"][data-tab-name="${tab}"]`).getAttribute('aria-controls');
        assert.equal(await page.locator(`#${label}`).getAttribute('role'), 'tabpanel');
        const text = await page.locator('.advisory-page:not(.tab-off)').innerText();
        assert.doesNotMatch(text, /undefined|NaN/);
      }
    }
    await page.click('[data-act="advisory-refresh"]'); assert.deepEqual(await snapshot(), before);
    await page.keyboard.press('Escape'); ok(`${room} ${state.phase}: desktop/360px pages, unchanged engine/save and valid tab semantics`);
  }

  await load(roomStates('lot')[2]);
  for (const theme of ['light', 'dark']) {
    await page.click('#menu-btn');
    if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) await page.click('#theme-toggle');
    await page.click('#menu-close');
    for (const [width, height] of [[1440,900], [1024,700], [390,844], [375,812], [360,780]]) {
      await page.setViewportSize({ width, height }); await openDesk();
      for (const tab of ['Overview', 'Ticketing', 'Talent', 'Operations']) {
        await page.locator(`#win [role="tab"][data-tab-name="${tab}"]`).click(); await fit(); await contrast();
        await page.screenshot({ path: join(output, `${theme}-${width}-${tab}.png`) });
      }
      await page.locator('#win [role="tab"][data-tab-name="Overview"]').click();
      await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#win [role="tab"][aria-selected="true"]').innerText(), 'Ticketing');
      await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#win [role="tab"][aria-selected="true"]').innerText(), 'Overview');
      await page.keyboard.press('Escape'); ok(`${theme} ${width}x${height}: every page fits; 44px targets and arrow navigation`);
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'advisory-result.json'), JSON.stringify({ checks, errors, base }, null, 2));
  console.log(`${checks.length} Advisory checks passed. Captures: ${output}`);
} finally { await browser.close(); await server.close(); }
