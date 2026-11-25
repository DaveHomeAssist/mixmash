/** Ko-fi support link and Cloudflare Web Analytics switches: nothing renders or loads until set. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { monetization, supportEnabled, supportBlock, supportFooterLink, isKofi, kofiTiersUrl, KOFI_SUPPORT_TIERS, analyticsEnabled, analyticsHead, analyticsScript, applyAnalyticsCsp, ANALYTICS_PAGES, CF_BEACON_SRC } from '../src/hub/monetization.mjs';
const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
// Test-only values. Real ones are never committed by tests.
const KOFI = 'https://ko-fi.com/test_page';
const TOKEN = '0123456789abcdef0123456789abcdef';
const INCLUDE = '<script src="/assets/analytics.js" defer></script>';

test('shipped config: Ko-fi support on, Cloudflare Web Analytics on', async () => {
  const TOKEN_LIVE = '3aeddc4297384179a3dcb309314cb365';
  assert.equal(monetization.supportUrl, 'https://ko-fi.com/avbydave');
  assert.equal(supportEnabled(), true);
  assert.equal(monetization.cloudflareAnalyticsToken, TOKEN_LIVE);
  assert.equal(analyticsEnabled(), true);
  const homeSupport = await read('index.html');
  assert.ok(homeSupport.includes(supportBlock()), 'homepage carries the Ko-fi block');
  assert.ok(homeSupport.includes(supportFooterLink()), 'homepage footer carries the Ko-fi link');
  assert.equal((homeSupport.match(/href="https:\/\/ko-fi\.com\/avbydave" target="_blank" rel="noopener"/g) || []).length, 2, 'exactly two one-off Ko-fi page links: block and footer');
  assert.equal((homeSupport.match(/href="https:\/\/ko-fi\.com\/avbydave\/tiers" target="_blank" rel="noopener"/g) || []).length, 1, 'one membership /tiers link in the supporter section');
  assert.ok(homeSupport.includes('Stagehand'), 'Stagehand tier is on the homepage');
  assert.ok(homeSupport.includes('Headliner'), 'Headliner tier is on the homepage');
  assert.ok(!/<script[^>]+ko-fi/i.test(homeSupport), 'no Ko-fi widget script');
  assert.equal(analyticsHead(), `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${TOKEN_LIVE}"}'></script>`);
  const include = await read('assets/analytics.js');
  assert.equal(include, analyticsScript());
  assert.ok(include.includes('createElement'), 'enabled include injects the beacon');
  assert.ok(include.includes(TOKEN_LIVE), 'include carries the live token');
  const home = await read('index.html');
  assert.ok(home.includes(`data-cf-beacon='{"token":"${TOKEN_LIVE}"}'`), 'homepage has the beacon');
  assert.ok(home.includes('static.cloudflareinsights.com/beacon.min.js'), 'homepage loads the beacon script');
  for (const file of ANALYTICS_PAGES) {
    const html = await read(file);
    assert.ok(html.includes(INCLUDE), `${file} keeps the shared include`);
  }
  for (const file of ['mars/index.html', 'front-of-house/index.html']) {
    const html = await read(file);
    assert.ok(html.includes('https://static.cloudflareinsights.com'), `${file} CSP allows the beacon script`);
    assert.ok(html.includes('https://cloudflareinsights.com'), `${file} CSP allows the beacon connect`);
  }
});

test('every non-EMPIRES wrapper includes the shared analytics include; EMPIRES does not', async () => {
  for (const file of ANALYTICS_PAGES) assert.ok((await read(file)).includes(INCLUDE), file);
  assert.ok(!ANALYTICS_PAGES.some(page => page.startsWith('empires/')));
  assert.ok(!(await read('empires/index.html')).includes('analytics.js'), 'EMPIRES is untouched');
});

test('a token renders the official beacon on the homepage and in the wrapper include', () => {
  const on = { cloudflareAnalyticsToken: TOKEN };
  assert.equal(analyticsHead(on), `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${TOKEN}"}'></script>`);
  const appended = [];
  const document = {
    querySelector: () => null,
    createElement: () => ({ attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } }),
    head: { appendChild: node => appended.push(node) }
  };
  vm.runInNewContext(analyticsScript(on), { document });
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, CF_BEACON_SRC);
  assert.equal(appended[0].type, 'module');
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
  const shipped = (await read('front-of-house/index.html')).match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0];
  assert.match(shipped, /script-src 'self' https:\/\/static\.cloudflareinsights\.com;/);
  assert.match(shipped, /connect-src 'self' https:\/\/cloudflareinsights\.com;/);
  const off = applyAnalyticsCsp(shipped, {});
  assert.ok(!off.includes('cloudflareinsights'), 'turning off strips the origins');
  assert.equal(applyAnalyticsCsp(off, {}), off, 'off leaves an already-off CSP byte-identical');
  const on = applyAnalyticsCsp(off, { cloudflareAnalyticsToken: TOKEN });
  assert.match(on, /script-src 'self' https:\/\/static\.cloudflareinsights\.com;/);
  assert.match(on, /connect-src 'self' https:\/\/cloudflareinsights\.com;/);
  assert.equal(applyAnalyticsCsp(on, { cloudflareAnalyticsToken: TOKEN }), on, 'idempotent');
  assert.equal(applyAnalyticsCsp(on, {}), off, 'turning off restores the off policy');
  assert.equal(applyAnalyticsCsp(shipped, { cloudflareAnalyticsToken: TOKEN }), shipped, 'shipped on CSP is already final');
  const mars = (await read('mars/index.html')).match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0];
  assert.match(mars, /connect-src 'self' https:\/\/mixmash-marsscape-authority\.vercel\.app https:\/\/cloudflareinsights\.com;/);
  assert.equal(applyAnalyticsCsp('<p>no policy</p>', { cloudflareAnalyticsToken: TOKEN }), '<p>no policy</p>');
});

test('Ko-fi support link: accepted shape, Ko-fi label and copy', () => {
  for (const url of [KOFI, 'https://ko-fi.com/TestPage', 'https://www.ko-fi.com/test/']) assert.equal(supportEnabled({ supportUrl: url }), true, url);
  for (const url of ['https://ko-fi.com/', 'https://ko-fi.com/a/b', 'https://ko-fi.com/x?ref=1', 'https://ko-fi.com/x#y', 'http://ko-fi.com/x', 'https://ko-fi.com/bad-name!', 'https://u:p@ko-fi.com/x']) assert.equal(supportEnabled({ supportUrl: url }), false, url);
  assert.equal(isKofi(KOFI), true); assert.equal(isKofi('https://example.itch.io/'), false);
  const block = supportBlock({ supportUrl: KOFI });
  assert.match(block, /href="https:\/\/ko-fi\.com\/test_page" target="_blank" rel="noopener">Support MixMash on Ko-fi/);
  assert.match(block, /<h3>Keep the games free<\/h3>/);
  assert.match(block, /a tip on Ko-fi helps keep the site free and ad-light, and funds new games, stages and fighters\./);
  assert.match(block, /<p class="support-note">One-off tips\. No Ko-fi account needed\.<\/p><\/div>$/);
  assert.match(block, /href="https:\/\/ko-fi\.com\/test_page\/tiers" target="_blank" rel="noopener">Become a monthly supporter/);
  assert.match(block, /<h4 id="supporter-tiers-heading">Monthly supporters<\/h4>/);
  assert.match(block, /Stagehand/);
  assert.match(block, /\$3\/mo/);
  assert.match(block, /Headliner/);
  assert.match(block, /\$7\/mo/);
  assert.ok(!block.includes('Open Mic'), 'alternate $3 name stays off the hub');
  assert.ok(!block.includes('Festival Pass'), 'alternate $7 name stays off the hub');
  assert.ok(!/discord/i.test(block), 'no Discord perk while no MixMash Discord exists');
  assert.equal(kofiTiersUrl({ supportUrl: KOFI }), 'https://ko-fi.com/test_page/tiers');
  assert.equal(kofiTiersUrl({ supportUrl: 'https://www.ko-fi.com/TestPage/' }), 'https://ko-fi.com/TestPage/tiers');
  assert.equal(kofiTiersUrl({ supportUrl: 'https://example.itch.io/' }), '');
  assert.equal(kofiTiersUrl({ supportUrl: 'https://ko-fi.com/x?ref=1' }), '');
  assert.equal(KOFI_SUPPORT_TIERS.length, 2);
  assert.ok(!supportBlock({ supportUrl: 'https://example.itch.io/' }).includes('support-note'), 'Ko-fi-only note stays off other hosts');
  assert.ok(!supportBlock({ supportUrl: 'https://example.itch.io/' }).includes('supporter-tiers'), 'membership tiers stay Ko-fi-only');
  assert.match(supportFooterLink({ supportUrl: KOFI }), />Support MixMash on Ko-fi</);
  // itch.io stays valid for the planned second channel, with the generic label.
  assert.match(supportBlock({ supportUrl: 'https://example.itch.io/' }), />Support MixMash </);
  assert.match(supportBlock({ supportUrl: KOFI, supportLabel: 'Tip jar' }), />Tip jar </);
});
