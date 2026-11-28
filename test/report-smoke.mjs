/**
 * Pitch Riot problem report (quality pilot): the form stays hidden with no
 * intake endpoint, opens from Pause, keeps typed keys away from the match,
 * sends one contract report and keeps the text when the send fails.
 * The intake Worker is replaced by a route, so nothing leaves the machine.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, stubCloudflareAnalytics, trackPageFailures } from './static-server.mjs';
import { validateReport } from '../src/kit/report-schema.mjs';

const ENDPOINT = 'https://intake.test/v1/reports';
const server = await startStaticServer();
const { origin } = server;
const browser = await chromium.launch(launchOptions());

async function openPitch(context) {
  const page = await context.newPage();
  const failures = trackPageFailures(page, origin);
  await page.goto(`${origin}/pitch/?debug`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pitch && window.MixKit && window.MixKit.report);
  return { page, failures };
}

try {
  // 1. No endpoint configured: nothing shows and nothing is wired.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await stubCloudflareAnalytics(context);
    const { page, failures } = await openPitch(context);
    assert.equal(await page.evaluate(() => window.MixKit.report.enabled), false, 'disabled without an endpoint');
    assert.equal(await page.locator('[data-report-open]').count(), 2, 'pause and full time carry the trigger');
    assert.equal(await page.locator('[data-report-open]:visible').count(), 0, 'triggers stay hidden');
    assert.equal(await page.locator('dialog.mixkit-report').count(), 0, 'no dialog is built');
    assert.deepEqual(failures, [], 'page loads clean');
    await context.close();
  }

  // 2. Endpoint configured (localhost test seam): open from Pause, type, send.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await stubCloudflareAnalytics(context);
  await context.addInitScript((endpoint) => { window.__MIXKIT_REPORT_ENDPOINT__ = endpoint; }, ENDPOINT);
  const received = [];
  let fail = false;
  await context.route(ENDPOINT, async (route) => {
    const request = route.request();
    const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (fail) return route.fulfill({ status: 502, headers: cors, contentType: 'application/json', body: '{"ok":false,"error":"intake_unavailable"}' });
    const body = JSON.parse(request.postData());
    received.push({ body, headers: request.headers() });
    return route.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify({ ok: true, reportId: body.reportId }) });
  });
  const { page, failures } = await openPitch(context);
  assert.equal(await page.evaluate(() => window.MixKit.report.enabled), true);

  await page.click('#kickoff-btn');
  await page.waitForFunction(() => window.__pitch.game.state === window.__pitch.STATE.PLAY);
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__pitch.game.state === window.__pitch.STATE.PAUSE);
  const trigger = page.locator('#pause [data-report-open]');
  await trigger.waitFor({ state: 'visible' });
  await trigger.click();
  const dialog = page.locator('dialog.mixkit-report');
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.name), 'summary', 'focus lands in the summary');

  // Typing WASD, P, Escape-free text and Space stays in the form; the match stays paused.
  await page.keyboard.type('Pressing P and WASD near the goal freezes the keeper');
  assert.equal(await page.evaluate(() => window.__pitch.game.state === window.__pitch.STATE.PAUSE), true, 'typing P did not resume');

  // Too short is caught before sending.
  await page.fill('#mixkit-report-summary', 'bad');
  await page.click('dialog.mixkit-report button[type=submit]');
  await page.waitForFunction(() => /at least 5/.test(document.querySelector('dialog.mixkit-report [data-status]').textContent));
  assert.equal(received.length, 0);

  // A failed send keeps the text.
  fail = true;
  await page.fill('#mixkit-report-summary', 'Keeper freezes near the goal');
  await page.check('dialog.mixkit-report input[name=impact][value=blocks]');
  await page.click('dialog.mixkit-report button[type=submit]');
  await page.waitForFunction(() => /trouble/.test(document.querySelector('dialog.mixkit-report [data-status]').textContent));
  assert.equal(await page.inputValue('#mixkit-report-summary'), 'Keeper freezes near the goal', 'text kept after a failure');

  // A good send: one contract report, thanks, the dialog closes, the match is still paused.
  fail = false;
  await page.click('dialog.mixkit-report button[type=submit]');
  await page.waitForFunction(() => /Thanks/.test(document.querySelector('dialog.mixkit-report [data-status]').textContent));
  assert.equal(received.length, 1);
  const { body } = received[0];
  const check = validateReport(body, { sources: ['player'] });
  assert.equal(check.ok, true, JSON.stringify(check.errors));
  assert.equal(body.game, 'pitch');
  assert.equal(body.impact, 'blocks');
  assert.equal(body.context.page, '/pitch/');
  assert.match(body.context.viewport, /^1280x800 @1x$/);
  assert.equal(received[0].headers.cookie, undefined, 'no cookies sent');
  await dialog.waitFor({ state: 'hidden', timeout: 4000 });
  assert.equal(await page.evaluate(() => window.__pitch.game.state === window.__pitch.STATE.PAUSE), true, 'still paused after sending');

  // Escape closes the form and does not resume the match.
  await trigger.click();
  await dialog.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.__pitch.game.state === window.__pitch.STATE.PAUSE), true, 'Escape closed the form only');

  // A new form gets a new report id.
  await trigger.click();
  await page.fill('#mixkit-report-summary', 'Second report about the crowd sound');
  await page.click('dialog.mixkit-report button[type=submit]');
  await page.waitForFunction(() => /Thanks/.test(document.querySelector('dialog.mixkit-report [data-status]').textContent));
  assert.equal(received.length, 2);
  assert.notEqual(received[1].body.reportId, received[0].body.reportId, 'each report has its own id');

  assert.deepEqual(failures, [], 'no page failures');
  await context.close();
  console.log('report smoke: ok');
} finally {
  await browser.close();
  await server.close();
}
