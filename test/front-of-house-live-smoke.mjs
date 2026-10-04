// Live service pilot browser acceptance: controls, clock, reload, receipts and responsive tabs.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { startStaticServer, trackPageFailures } from './static-server.mjs';
import { createGame, settlementFor, settlementPayout } from '../front-of-house/engine.mjs';
import { SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';

const server = await startStaticServer();
const url = process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
const output = process.env.FRONT_OF_HOUSE_LIVE_SCREENSHOT_DIR || await mkdtemp(join(tmpdir(), 'foh-live-'));
await mkdir(output, { recursive: true });
const code = Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state: createGame(170) })).toString('base64');
const text = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tab = async (page, name) => { const b = page.locator(`#panel [data-tab-name="${name}"]:visible`); if (await b.count()) await b.click(); };
async function fit(page) {
  const names = await page.locator('#panel .tabbar [role="tab"]').evaluateAll(nodes => nodes.map(n => n.dataset.tabName));
  for (const name of names.length ? names : [null]) {
    if (name) await tab(page, name);
    const result = await page.evaluate(() => {
      const d = document.documentElement;
      const bad = [...document.querySelectorAll('#panel .plate, #panel button, #panel select, #panel input')]
        .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
        .filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1 || (e.classList.contains('plate') && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)); })
        .map(e => ({tag:e.tagName, classes:e.className, text:e.textContent.slice(0,35), rect:e.getBoundingClientRect().toJSON(), size:[e.scrollWidth,e.clientWidth,e.scrollHeight,e.clientHeight]}));
      return { root: [d.scrollWidth - innerWidth, d.scrollHeight - innerHeight], bad };
    });
    if (result.bad.length) await page.screenshot({ path: join(output, 'overflow.png') });
    assert.deepEqual(result, { root: [0, 0], bad: [] }, `${name}: ${JSON.stringify(result)}`);
  }
}
try {
  for (const [browserName, launcher] of Object.entries({ chromium, webkit })) {
    const browser = await launcher.launch();
    try {
      for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
        const context = await browser.newContext({ viewport, hasTouch: viewport.width < 500, reducedMotion: browserName === 'webkit' ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
        const page = await context.newPage(), errors = trackPageFailures(page, new URL(url).origin);
        await page.goto(url);
        await page.waitForFunction(() => window.__frontOfHouse);
        assert.equal(await page.evaluate(code => window.__frontOfHouse.importCode(code), code), true);
        await page.locator('[data-deal="door"]:visible').first().click();
        await tab(page, 'Actions');
        await page.locator('[data-act="starter"]').click();
        await page.locator('[data-act="confirm-build"]').click();
        await page.locator('[data-act="live-settings"]').click();
        await page.locator('#live-services').check();
        await page.locator('#win [data-win="close"]').first().click();
        await page.reload();
        await page.waitForFunction(() => window.__frontOfHouse);
        await page.locator('[data-act="live-settings"]').click();
        assert.equal(await page.locator('#live-services').isChecked(), true);
        await page.locator('#win [data-win="close"]').first().click();
        await fit(page);
        await page.locator('[data-act="confirm-promo"]').click();
        assert.equal((await text(page)).services.minute, 0);
        await tab(page, 'Controls');
        await page.locator('[data-act="live-worker"][data-station="gate"]').click();
        assert.equal((await text(page)).services.worker.station, null);
        await page.locator('[data-act="live-step"]').click();
        await page.locator('[data-act="live-worker"][data-station="bar"]').click();
        const before = (await text(page)).services;
        await page.reload();
        await page.waitForFunction(() => window.__frontOfHouse);
        assert.deepEqual((await text(page)).services, before);
        await tab(page, 'Controls');
        await page.locator('[data-act="live-step"]').click();
        await page.selectOption('#live-speed', '12');
        await page.locator('#live-play').click();
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).services.minute >= 11);
        await page.locator('#live-play').click();
        assert.equal((await text(page)).playback.paused, true);
        await fit(page);
        await tab(page, 'Services');
        await page.screenshot({ path: join(output, `${browserName}-${viewport.width}-services.png`) });
        const unchanged = (await text(page)).services;
        await page.locator('#zoom-in').click(); await page.locator('#zoom-fit').click();
        if (viewport.width < 500) {
          await page.locator('#menu-btn').click(); await page.locator('#theme-toggle').click(); await page.locator('#menu-btn').click();
          await fit(page);
          await page.screenshot({ path: join(output, `${browserName}-${viewport.width}-dark.png`) });
        }
        assert.deepEqual((await text(page)).services, unchanged);
        await tab(page, 'Controls');
        await page.locator('[data-act="live-next"]').click();
        assert.equal(await page.locator('#live-play').isDisabled(), true);
        await page.locator('[data-act="respond"]:not([disabled]):visible').first().click();
        assert.equal((await text(page)).phase, 'show');
        await tab(page, 'Controls');
        await page.locator('[data-act="live-next"]').click();
        assert.equal((await text(page)).phase, 'settle');
        const settled = await page.evaluate(() => window.__frontOfHouse.state());
        const result = settlementFor(settled);
        assert.equal((await text(page)).services.cash, result.ticketGross + result.bar);
        assert.ok(await page.locator('#win').textContent().then(s => s.includes('refunds')));
        const windowTabs = await page.locator('#win .tabbar [role="tab"]').evaluateAll(nodes => nodes.map(n => n.dataset.tabName));
        for (const name of windowTabs.length ? windowTabs : [null]) {
          if (name) await page.locator(`#win [data-tab-name="${name}"]`).click();
          const overflow = await page.locator('#win-body').evaluate(e => [e.scrollHeight - e.clientHeight, e.scrollWidth - e.clientWidth]);
          assert.ok(overflow.every(n => n <= 1), `settlement ${name}: ${overflow}`);
        }
        await page.screenshot({ path: join(output, `${browserName}-${viewport.width}-settlement.png`) });
        await page.locator('[data-act="accept"]').click();
        const cash = (await text(page)).cash;
        assert.equal(cash, settled.cash + settlementPayout(result, settled.booking.deal));
        await page.reload(); await page.waitForFunction(() => window.__frontOfHouse);
        assert.equal((await text(page)).phase, 'done');
        assert.equal((await text(page)).cash, cash);
        assert.deepEqual(errors, []);
        await context.close();
        console.log(`  ok live ${browserName} ${viewport.width}: transfer, clock, incident, reload, cash and tabs`);
      }
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
console.log(`Live services: 4 browser/viewport journeys passed. Screenshots: ${output}`);
