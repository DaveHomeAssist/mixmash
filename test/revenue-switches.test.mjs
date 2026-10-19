/** Ko-fi support link and Cloudflare Web Analytics switches: nothing renders or loads until set. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { monetization, supportEnabled, supportBlock, supportFooterLink, isKofi, analyticsEnabled, analyticsHead, analyticsScript, applyAnalyticsCsp, ANALYTICS_PAGES, CF_BEACON_SRC } from '../src/hub/monetization.mjs';
const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
// Test-only values. Real ones are never committed by tests.
const KOFI = 'https://ko-fi.com/test_page';
const TOKEN = '0123456789abcdef0123456789abcdef';
const INCLUDE = '<script src="/assets/analytics.js" defer></script>';

test('shipped config is off: no support link, no analytics anywhere', async () => {
  assert.equal(monetization.supportUrl, '');
  assert.equal(monetization.cloudflareAnalyticsToken, '');
  assert.equal(analyticsEnabled(), false);
  assert.equal(analyticsHead() + supportBlock() + supportFooterLink(), '');
  const include = await read('assets/analytics.js');
  assert.equal(include, analyticsScript());
  assert.equal(include.replace(/\/\*[^]*?\*\//g, '').trim(), '', 'disabled include is comments only');
  for (const file of ['index.html', ...ANALYTICS_PAGES]) {
    const html = await read(file);
    assert.ok(!html.includes('cloudflareinsights'), `${file} references no Cloudflare origin while off`);
    assert.ok(!html.includes('data-cf-beacon'), `${file} has no beacon while off`);
  }
});

test('every non-EMPIRES wrapper includes the shared analytics include; EMPIRES does not', async () => {
  for (const file of ANALYTICS_PAGES) assert.ok((await read(file)).includes(INCLUDE), file);
  assert.ok(!ANALYTICS_PAGES.some(page => page.startsWith('empires/')));
  assert.ok(!(await read('empires/index.html')).includes('analytics.js'), 'EMPIRES is untouched');
});

test('a token renders the official beacon on the homepage and in the wrapper include', () => {
  const on = { cloudflareAnalyticsToken: TOKEN };
  assert.equal(analyticsHead(on), `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${TOKEN}"}'></script>`);
  const appended = [];
  const document = {
    querySelector: () => null,
    createElement: () => ({ attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } }),
    head: { appendChild: node => appended.push(node) }
  };
  vm.runInNewContext(analyticsScript(on), { document });
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, CF_BEACON_SRC);
  assert.equal(appended[0].defer, true);
  assert.equal(appended[0].attrs['data-cf-beacon'], `{"token":"${TOKEN}"}`);
  // Already present (e.g. Cloudflare auto-injection): no duplicate beacon.
  appended.length = 0;
  vm.runInNewContext(analyticsScript(on), { document: { ...document, querySelector: () => ({}) } });
  assert.equal(appended.length, 0);
});

test('malformed tokens load nothing', () => {
  for (const token of ['', 'abc', TOKEN + '0', `${TOKEN.slice(0, 31)}"`, `'};alert(1);//${TOKEN}`, 'g'.repeat(32)]) {
    assert.equal(analyticsHead({ cloudflareAnalyticsToken: token }), '', token);
    assert.ok(!analyticsScript({ cloudflareAnalyticsToken: token }).includes('createElement'), token);
  }
});

test('CSP pages gain the beacon origins only while on, and lose them when turned off', async () => {
  const csp = (await read('front-of-house/index.html')).match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0];
  assert.equal(applyAnalyticsCsp(csp, {}), csp, 'off leaves the CSP byte-identical');
  const on = applyAnalyticsCsp(csp, { cloudflareAnalyticsToken: TOKEN });
  assert.match(on, /script-src 'self' https:\/\/static\.cloudflareinsights\.com;/);
  assert.match(on, /connect-src 'self' https:\/\/cloudflareinsights\.com;/);
  assert.equal(applyAnalyticsCsp(on, { cloudflareAnalyticsToken: TOKEN }), on, 'idempotent');
  assert.equal(applyAnalyticsCsp(on, {}), csp, 'turning off restores the original policy');
  const mars = (await read('mars/index.html')).match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0];
  assert.match(applyAnalyticsCsp(mars, { cloudflareAnalyticsToken: TOKEN }), /connect-src 'self' https:\/\/mixmash-marsscape-authority\.vercel\.app https:\/\/cloudflareinsights\.com;/);
  assert.equal(applyAnalyticsCsp('<p>no policy</p>', { cloudflareAnalyticsToken: TOKEN }), '<p>no policy</p>');
});

test('Ko-fi support link: accepted shape, Ko-fi label and copy', () => {
  for (const url of [KOFI, 'https://ko-fi.com/TestPage', 'https://www.ko-fi.com/test/']) assert.equal(supportEnabled({ supportUrl: url }), true, url);
  for (const url of ['https://ko-fi.com/', 'https://ko-fi.com/a/b', 'https://ko-fi.com/x?ref=1', 'https://ko-fi.com/x#y', 'http://ko-fi.com/x', 'https://ko-fi.com/bad-name!', 'https://u:p@ko-fi.com/x']) assert.equal(supportEnabled({ supportUrl: url }), false, url);
  assert.equal(isKofi(KOFI), true); assert.equal(isKofi('https://example.itch.io/'), false);
  const block = supportBlock({ supportUrl: KOFI });
  assert.match(block, /href="https:\/\/ko-fi\.com\/test_page" target="_blank" rel="noopener">Support MixMash on Ko-fi/);
  assert.match(block, /a one-off tip on Ko-fi/);
  assert.match(supportFooterLink({ supportUrl: KOFI }), />Support MixMash on Ko-fi</);
  // itch.io stays valid for the planned second channel, with the generic label.
  assert.match(supportBlock({ supportUrl: 'https://example.itch.io/' }), />Support MixMash </);
  assert.match(supportBlock({ supportUrl: KOFI, supportLabel: 'Tip jar' }), />Tip jar </);
});
