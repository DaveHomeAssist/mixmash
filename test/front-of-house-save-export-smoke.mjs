/** Export must preserve the current career, including progress after storage fails. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';
import { SAVE_NAMESPACE } from '../front-of-house/data.mjs';

const server = await startStaticServer();
const browser = await chromium.launch(launchOptions());
try {
  for (const blocked of [false, true]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const failures = trackPageFailures(page, server.origin);
    await page.goto(`${server.origin}/front-of-house/?renderer=2d`);
    await page.waitForFunction(() => !!window.__frontOfHouse);
    const original = await page.evaluate(key => localStorage.getItem(key), SAVE_NAMESPACE);
    if (blocked) await page.evaluate(key => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new DOMException('Storage full', 'QuotaExceededError');
        return set.call(this, name, value);
      };
    }, SAVE_NAMESPACE);
    await page.locator('[data-deal="guarantee"]').first().click();
    const current = await page.evaluate(() => window.__frontOfHouse.state());
    assert.equal(current.phase, 'build');
    if (blocked) assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_NAMESPACE), original);
    await page.click('#menu-btn');
    await page.click('#save-menu summary');
    await page.click('[data-save="export"]');
    const code = await page.inputValue('#save-code');
    const exported = JSON.parse(Buffer.from(code, 'base64').toString('utf8'));
    assert.deepEqual(exported.state, current, `export uses current progress when storage is ${blocked ? 'full' : 'available'}`);
    const restoredContext = await browser.newContext();
    const restored = await restoredContext.newPage();
    await restored.goto(`${server.origin}/front-of-house/?renderer=2d`);
    await restored.waitForFunction(() => !!window.__frontOfHouse);
    assert.equal(await restored.evaluate(code => window.__frontOfHouse.importCode(code), code), true);
    assert.deepEqual(await restored.evaluate(() => window.__frontOfHouse.state()), current);
    assert.deepEqual(failures, []);
    await restoredContext.close();
    await context.close();
    console.log(`PASS: current save export and restore with storage ${blocked ? 'full' : 'available'}`);
  }
} finally {
  await browser.close();
  await server.close();
}
