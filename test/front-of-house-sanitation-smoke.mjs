// Actual facilities placement, locked sanitation terms, visits, reload and signed production receipt.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';
import { createGame, settlementFor, settlementPayout } from '../front-of-house/engine.mjs';
import { SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';
const server = await startStaticServer();
const url = process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
const output = process.env.FRONT_OF_HOUSE_SANITATION_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-sanitation-'));
await mkdir(output, { recursive: true });
const code = Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state: createGame(3) })).toString('base64');
const text = p => p.evaluate(() => JSON.parse(render_game_to_text()));
const state = p => p.evaluate(() => __frontOfHouse.state());
const tab = async (p, name) => { const b = p.locator(`#panel [data-tab-name="${name}"]:visible`); if (await b.count()) await b.click(); };
async function fit(page) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('#panel .plate, #panel button, #panel select, #win:not([hidden]), #win:not([hidden]) button, #win:not([hidden]) select, #win:not([hidden]) .win-body')]
    .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
    .filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1 || e.scrollWidth > e.clientWidth + 1 || (e.matches('.plate,.win-body') && e.scrollHeight > e.clientHeight + 1); })
    .map(e => ({ text: e.textContent.slice(0, 40), rect: e.getBoundingClientRect().toJSON(), size: [e.scrollWidth, e.clientWidth, e.scrollHeight, e.clientHeight] })));
  if (bad.length) await page.screenshot({ path: join(output, 'overflow.png') });
  assert.deepEqual(bad, []);
}
try {
  for (const [name, launcher] of Object.entries({ chromium, webkit })) {
    const browser = await launcher.launch(name === 'chromium' ? launchOptions() : {});
    try {
      for (const three of name === 'chromium' ? [false, true] : [false]) for (const width of [1440, 375, ...(name === 'chromium' && !three ? [1024] : [])]) {
        const context = await browser.newContext({ colorScheme: width === 1024 ? 'dark' : 'light', viewport: { width, height: width === 375 ? 812 : width === 1024 ? 700 : 900 }, hasTouch: width < 500, reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await context.newPage(), errors = trackPageFailures(page, new URL(url).origin);
        if (width === 1024) await page.addInitScript(() => localStorage.setItem('front_of_house_theme', 'dark'));
        await page.goto(url + (three ? '?renderer=3d' : ''));
        await page.waitForFunction(() => window.__frontOfHouse);
        if (width === 1024) assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
        await page.evaluate(c => __frontOfHouse.importCode(c), code);
        if (three) await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
        await page.locator('[data-deal="door"]:visible').first().click();
        await tab(page, 'Actions'); await page.locator('[data-act="starter"]').click();
        await tab(page, 'Tools'); await fit(page);
        await page.locator('input[value="food"]').check();
        const position = await page.evaluate(() => __frontOfHouse.boardClientOf(3.5, 8.5));
        if (width < 500) await page.touchscreen.tap(position.x, position.y); else await page.mouse.click(position.x, position.y);
        assert.equal((await state(page)).venue.objects.filter(o => o.type === 'food').length, 1);
        if (width >= 500) { await page.keyboard.press('t'); assert.equal(await page.locator('input[value="trailer"]').isChecked(), true); }
        else await page.locator('input[value="trailer"]').check();
        const trailerPosition = await page.evaluate(() => __frontOfHouse.boardClientOf(16.5, 9.5));
        if (width < 500) await page.touchscreen.tap(trailerPosition.x, trailerPosition.y); else await page.mouse.click(trailerPosition.x, trailerPosition.y);
        assert.equal((await state(page)).venue.objects.filter(o => o.type === 'trailer').length, 1);
        await tab(page, 'Actions'); await page.locator('[data-act="confirm-build"]').click();
        await page.locator('#live-settings').click(); await page.locator('#live-services').check();
        await page.locator('#win [data-win="close"]').first().click();
        await page.locator('#food-settings').click(); await page.selectOption('#food-plan', 'standard'); await fit(page);
        await page.locator('#win [data-tab-name="Sanitation"]').click();
        await page.locator('#sanitation-enabled').check(); await page.locator('#sanitation-cleaner').check(); await page.locator('#sanitation-utilities').check();
        assert.match(await page.locator('#sanitation-quote').innerText(), /\$380/); await fit(page);
        await page.locator('#win [data-tab-name="Sanitation"]').focus(); await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('#win [data-tab-name="Artist"]').getAttribute('aria-selected'), 'true');
        await page.locator('#sanitation-preference').check(); await fit(page);
        assert.match(await page.locator('#sanitation-artist').innerText(), /accepted/);
        await page.locator('#win [data-win="close"]').first().click();
        await page.reload(); await page.waitForFunction(() => window.__frontOfHouse);
        if (three) await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
        assert.equal((await state(page)).promotion.foodPlan, 'standard');
        await fit(page); await page.locator('#confirm-promo').click();
        assert.deepEqual((await state(page)).show.food, { version: 1, plan: 'standard' });
        assert.deepEqual((await state(page)).show.sanitation, {version:1,cleaner:true,utilities:true,preference:true,trailer:true});
        await tab(page, 'Controls'); await page.locator('[data-station="gate"]').click();
        for (let i = 0; i < 3; i++) await page.locator('[data-act="live-step"]').click();
        const before = await text(page); assert.ok(before.services.sanitation.totals.using + before.services.sanitation.totals.waiting > 0);
        assert.equal(before.serviceView.totals.sanitation, before.services.sanitation.totals.waiting + before.services.sanitation.totals.using);
        const projection = await page.evaluate(() => __frontOfHouse.board().serviceCrowd);
        await page.reload(); await page.waitForFunction(() => window.__frontOfHouse);
        if (three) await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
        assert.deepEqual((await text(page)).services, before.services);
        assert.deepEqual(await page.evaluate(() => __frontOfHouse.board().serviceCrowd), projection);
        await tab(page, 'Services'); await page.locator('[data-act="sanitation-receipt"]').click(); await fit(page);
        await page.screenshot({ path: join(output, `${name}-${three ? '3d' : 'classic'}-${width}-facilities.png`) });
        await page.locator('#win [data-win="close"]').first().click();
        await page.screenshot({ path: join(output, `${name}-${three ? '3d' : 'classic'}-${width}-queue.png`) });
        await tab(page, 'Controls'); await page.locator('[data-act="live-next"]').click();
        await page.locator('[data-act="respond"]:not([disabled]):visible').first().click();
        await tab(page, 'Controls'); await page.locator('[data-act="live-next"]').click();
        assert.equal((await text(page)).services.food.totals.waiting, 0);
        await page.locator('[data-act="live-next"]').click();
        const ended = await state(page), receipt = settlementFor(ended);
        assert.ok(receipt.foodIncome > 0); assert.equal(ended.phase, 'settle');
        assert.equal(receipt.costs.facilities,380); assert.equal(receipt.preferenceBonus,2); assert.ok(receipt.sanitation.totals.cleanings>0);
        assert.equal(receipt.sanitation.totals.served + receipt.sanitation.totals.lost,receipt.attendance);
        for (const name of await page.locator('#win [role="tab"]:visible').allTextContents()) {
          await page.locator('#win [role="tab"]').filter({ hasText: new RegExp(`^${name}$`) }).click(); await fit(page);
        }
        await page.locator('#win [data-tab-name="Ledger"]').click();
        await page.locator('#win [data-settlement-page="Costs"]').click();
        await fit(page); await page.locator('#win [data-act="sanitation-receipt"]').click(); await fit(page);
        await page.locator('[data-act="food-back"]').click();
        await page.locator('[data-act="accept"]').click();
        assert.equal((await state(page)).cash, ended.cash + settlementPayout(receipt, ended.booking.deal));
        await page.reload(); await page.waitForFunction(() => window.__frontOfHouse);
        assert.equal((await state(page)).phase, 'done');
        assert.equal((await state(page)).cash, ended.cash + settlementPayout(receipt, ended.booking.deal));
        assert.deepEqual(errors, []);
        await context.close(); console.log(`  ok facilities ${name} ${three ? '3d' : 'classic'} ${width}: placement, quote, preference, visits, reload and signed costs`);
      }
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
console.log(`Sanitation: seven complete journeys passed. Screenshots: ${output}`);
