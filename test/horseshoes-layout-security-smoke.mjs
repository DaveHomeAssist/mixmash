// Regression: required control bounds, compact court navigation and document CSP.
import { createRequire } from 'node:module';
import { startStaticServer } from './static-server.mjs';
const require = createRequire(import.meta.url);
const server = process.env.HORSESHOES_BASE_URL ? null : await startStaticServer();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.HORSESHOES_BASE_URL || `${server.origin}/horseshoes/`;
const output = process.env.HORSESHOES_OUTPUT || '/tmp/horseshoes-layout-security';
fs.mkdirSync(output, { recursive: true });
async function bounds(page, selector) {
  const issues = await page.locator(selector).evaluateAll(nodes => nodes.flatMap(el => {
    if (!el.getClientRects().length) return [];
    const r = el.getBoundingClientRect();
    const b = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (let a = el.parentElement; a; a = a.parentElement) {
      const c = getComputedStyle(a), p = a.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(c.overflowX)) { b.left = Math.max(b.left, p.left); b.right = Math.min(b.right, p.right); }
      if (/hidden|clip|auto|scroll/.test(c.overflowY)) { b.top = Math.max(b.top, p.top); b.bottom = Math.min(b.bottom, p.bottom); }
    }
    return r.left < b.left - 1 || r.top < b.top - 1 || r.right > b.right + 1 || r.bottom > b.bottom + 1 ? [{ element: el.id || el.textContent, rect: r.toJSON(), bounds: b }] : [];
  }));
  assert.deepEqual(issues, [], 'required content is clipped');
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth));
}
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const [width, height] of [[568,320],[667,375],[844,390],[320,256],[375,812],[1440,900],[3840,1080]]) {
      const compact = width < 560 && height <= 600;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, reducedMotion: 'reduce', colorScheme: 'dark' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      await page.addInitScript(() => { window.policyViolations = []; document.addEventListener('securitypolicyviolation', e => policyViolations.push({ directive: e.effectiveDirective, blocked: e.blockedURI })); });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__horseshoes);
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'fresh visit defaults light');
      await page.keyboard.press('Escape');
      await page.evaluate(() => __horseshoes.stop());
      const press = id => width < 900 ? page.locator(id).tap() : page.locator(id).click();
      for (const theme of ['light','dark']) {
        if (theme === 'dark') { await press('#settings-tab'); await press('#menu-theme-button'); await page.keyboard.press('Escape'); }
        await bounds(page, '#live-controls button,#live-controls input,.tabs button,#settings-tab,#throw-feedback');
        if (compact) {
          await press('#court-tab');
          await page.evaluate(() => advanceTime(0));
          assert.ok(await page.locator('.stage-wrap').isVisible());
          assert.ok(!(await page.locator('.deck').isVisible()));
          await bounds(page, '.stage-wrap,#camera-button');
          await page.screenshot({ path: `${output}/${width}-${height}-${theme}-court.png` });
          await page.locator('#court-tab').focus(); await page.keyboard.press('ArrowRight');
          assert.equal(await page.evaluate(() => document.activeElement.id), 'play-tab');
        } else if (height < 600) {
          assert.ok((await page.locator('.stage-wrap').boundingBox()).height >= height * 0.55, 'court retains useful landscape height');
        }
        await page.screenshot({ path: `${output}/${width}-${height}-${theme}.png` });
        await press('#throw-button'); await page.evaluate(() => advanceTime(13000));
        assert.equal((await page.evaluate(() => __horseshoes.getState())).shoe.status, 'resting');
        await bounds(page, '#live-controls button,#live-controls input,#throw-feedback');
        await press('#replay-last');
        await bounds(page, '#replay-controls button,#replay-controls input,#throw-feedback');
        await press('#replay-exit');
        await press('#score-tab'); await bounds(page, '#score-panel,.tabs button'); await press('#play-tab');
      }
      if (compact) {
        await press('#settings-tab');
        const before = await page.evaluate(() => __horseshoes.getState().match);
        await page.setViewportSize({ width: 844, height: 390 });
        assert.ok(await page.locator('#game-menu').evaluate(el => el.open), 'resize must keep the game paused');
        assert.deepEqual(await page.evaluate(() => __horseshoes.getState().match), before);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('header nav a').count(), 2);
      }
      assert.deepEqual(await page.evaluate(() => policyViolations), [], 'normal gameplay must not violate CSP');
      assert.deepEqual(errors, []);
      if (width === 1440) {
        assert.match(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'), /wasm-unsafe-eval/);
        assert.equal(await page.locator('meta[name=referrer]').getAttribute('content'), 'no-referrer');
        await page.evaluate(() => {
          const script = document.createElement('script'); script.textContent = 'window.inlineProbeExecuted = true'; document.head.append(script);
          const frame = document.createElement('iframe'); frame.src = 'https://example.invalid/blocked'; frame.hidden = true; document.body.append(frame);
        });
        await page.waitForFunction(() => policyViolations.some(v => v.directive === 'script-src-elem') && policyViolations.some(v => v.directive === 'frame-src'));
        assert.equal(await page.evaluate(() => window.inlineProbeExecuted), undefined);
      }
      results.push({ width, height, compact, themes: 2, controlsAndFeedbackFit: true, normalPolicyViolations: 0, errors });
      await context.close();
    }
    fs.writeFileSync(`${output}/report.json`, JSON.stringify({ url, results }, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); await server?.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
