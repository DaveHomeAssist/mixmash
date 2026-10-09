// Cumulative booking and receipt numbering survives the 200-record save window.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';
import * as E from '../front-of-house/engine.mjs';
import * as D from '../front-of-house/data.mjs';

const act = (s, action) => {
  const result = E.applyAction(s, action);
  assert.equal(result.error, null);
  return result.state;
};
const server = await startStaticServer();
const browser = await chromium.launch(launchOptions());
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.clock.setFixedTime(new Date('2026-10-09T08:00:00.000Z'));
  const failures = trackPageFailures(page, server.origin);
  await page.goto(`${server.origin}/front-of-house/`);
  await page.waitForFunction(() => !!window.__frontOfHouse);
  const load = async (state) => {
    assert.equal(await page.evaluate(({ state, ns, v }) => __frontOfHouse.importCode(
      MixKitSave.encodeCode(JSON.stringify({ ns, v, savedAt: new Date().toISOString(), state }))
    ), { state, ns: D.SAVE_NAMESPACE, v: D.SCHEMA_VERSION }), true);
    assert.deepEqual(await page.evaluate(() => __frontOfHouse.state()), state);
    // Loading Settle opens its receipt automatically; close it before testing the opener.
    if (await page.locator('#win').isVisible()) await page.keyboard.press('Escape');
  };
  let s = E.createGame(2026, { mode: 'sandbox' });
  for (let number = 1; number <= 205; number += 1) {
    if (number >= 200) {
      await load(s);
      assert.match(await page.locator('#panel .eyebrow').filter({ hasText: /^Show \d+ ·/ }).textContent(), new RegExp(`Show ${number} ·`));
    }
    s = act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal: 'guarantee' });
    s = act(s, { type: 'setLayout', objects: D.STARTER_LAYOUT });
    s = act(s, { type: 'confirmBuild' });
    s = act(s, { type: 'confirmPromotion' });
    s = act(s, { type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses[0].id });
    const signed = act(s, { type: 'acceptSettlement', ...(number >= 200 ? { at: '2026-10-09T08:00:00.000Z' } : {}) });
    if (number >= 200) {
      await load(s);
      await page.click('[data-act="open-settlement"]');
      assert.match(await page.locator('.settlement-context').textContent(), new RegExp(`Show ${String(number).padStart(3, '0')} ·`));
      await page.click('[data-act="accept"]');
      assert.deepEqual(await page.evaluate(() => __frontOfHouse.state()), signed, 'UI signing preserves exact engine accounting and history');
      await page.click('[data-act="last-sheet"]');
      assert.match(await page.locator('.settlement-context').textContent(), new RegExp(`Show ${String(number).padStart(3, '0')} ·`));
      await page.reload();
      await page.waitForFunction(() => !!window.__frontOfHouse);
      assert.deepEqual(await page.evaluate(() => __frontOfHouse.state()), signed, 'stored career reloads unchanged');
      await page.click('[data-act="last-sheet"]');
      assert.match(await page.locator('.settlement-context').textContent(), new RegExp(`Show ${String(number).padStart(3, '0')} ·`));
      assert.equal(E.careerProgress(signed).shows, number);
      assert.equal(await page.evaluate(() => JSON.parse(render_game_to_text()).career.shows), number);
      assert.equal(signed.history.at(-1).showId, number);
      assert.equal(signed.history.length, 200);
    }
    s = act(signed, { type: 'nextShow' });
  }
  await load(s);
  assert.match(await page.locator('#panel .eyebrow').filter({ hasText: /^Show \d+ ·/ }).textContent(), /Show 206 ·/);
  assert.deepEqual(failures, []);
  console.log('PASS: shows 200–205 booking, unsigned/signed receipts, exact signing and saved history; next booking 206');
} finally {
  await browser.close();
  await server.close();
}
