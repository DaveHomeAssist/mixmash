/**
 * Publisher pages load under their meta CSP with zero violations (Chromium and WebKit), the
 * Cloudflare beacon is allowed, the Garden OS wrapper iframe loads and the fighter guide still
 * launches the game. CSP_SCREENSHOT_DIR saves 1470x956 Chromium shots.
 */
import assert from 'node:assert/strict';
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { repoRoot, startStaticServer } from './static-server.mjs';

const server = await startStaticServer();
const shots = process.env.CSP_SCREENSHOT_DIR;
if (shots) await mkdir(shots, { recursive: true });
const exists = path => access(join(repoRoot, path)).then(() => true, () => false);
const routes = [
  { name: 'hub', path: '/', ready: '.game-card' },
  // The overlay handler (moved off inline onclick) loads /play/ in the frame; /play/'s own frame
  // guard then takes the whole tab there, as it did before this change.
  { name: 'home', path: '/home.html', after: async page => { await page.click('#game-overlay'); await page.waitForURL(/\/play\/(index\.html)?$/); } },
  { name: 'brand', path: '/brand.html' },
  { name: '404', path: '/404.html' },
  { name: 'offline', path: '/offline.html' },
  { name: 'garden', path: '/garden/', act: async page => { await page.waitForSelector('#game-frame'); await page.waitForTimeout(4000); } },
  ...(await exists('privacy/index.html') ? [{ name: 'privacy', path: '/privacy/' }] : [])
];
const results = [];
try {
  // CSP_ENGINES=chromium for a box without WebKit's system libraries; CI runs both.
  const engines = (process.env.CSP_ENGINES || 'chromium,webkit').split(',');
  for (const [engine, launcher] of Object.entries({ chromium, webkit }).filter(([name]) => engines.includes(name))) {
    const browser = await launcher.launch();
    try {
      for (const route of routes) {
        const context = await browser.newContext({ viewport: { width: 1470, height: 956 }, serviceWorkers: 'block' });
        const page = await context.newPage();
        const violations = [];
        await page.addInitScript(() => {
          window.__csp = [];
          document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.effectiveDirective} blocked ${e.blockedURI || 'inline'} (${e.sourceFile || ''}:${e.lineNumber || ''})`));
        });
        page.on('console', msg => { if (/Content[- ]Security[- ]Policy|Refused to (load|execute|apply|connect|frame)/i.test(msg.text())) violations.push(`console: ${msg.text()}`); });
        let beacon = false;
        page.on('request', request => { if (request.url().startsWith('https://static.cloudflareinsights.com/')) beacon = true; });
        await page.goto(server.origin + route.path, { waitUntil: 'load' });
        if (route.ready) await page.waitForSelector(route.ready);
        if (route.act) await route.act(page);
        await page.waitForTimeout(800);
        violations.push(...await page.evaluate(() => window.__csp));
        const meta = await page.locator('meta[http-equiv="Content-Security-Policy"]').count();
        assert.equal(meta, 1, `${engine} ${route.name}: CSP meta present`);
        assert.deepEqual(violations, [], `${engine} ${route.name}: CSP violations`);
        if (route.name === 'hub' || route.name === 'garden') assert.ok(beacon, `${engine} ${route.name}: Cloudflare beacon requested`);
        if (route.name === 'garden') {
          const src = await page.locator('#game-frame').getAttribute('src');
          assert.ok(page.frames().some(f => f.url().startsWith(new URL(src).origin)), `${engine} garden: iframe navigated to ${src}`);
        }
        if (shots && engine === 'chromium') await page.screenshot({ path: join(shots, `${route.name}-1470x956.png`) });
        if (route.after) await route.after(page);
        results.push(`${engine} ${route.name}: 0 violations`);
        await context.close();
      }
    } finally { await browser.close(); }
  }
  console.log(results.join('\n'));
  console.log(`CSP smoke passed: ${results.length} page loads, zero violations.`);
} finally { await server.close(); }
