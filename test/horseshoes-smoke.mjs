// Browser regression for the isolated Horseshoes practice deployment.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';

const server = process.env.HORSESHOES_BASE_URL ? null : await startStaticServer();
const url = process.env.HORSESHOES_BASE_URL || `${server.origin}/horseshoes/`;
const output = process.env.HORSESHOES_OUTPUT || '/tmp/horseshoes-smoke';
await mkdir(output, { recursive: true });
const browser = await chromium.launch(launchOptions());
const results = [];
const state = page => page.evaluate(() => window.__horseshoes.getState());
const settle = page => page.evaluate(() => { window.advanceTime(20000); return window.__horseshoes.getState(); });
try {
  for (const [width, height, touch] of [[1440, 900, false], [375, 812, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
    const page = await context.newPage();
    const failures = trackPageFailures(page, new URL(url).origin);
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => window.__horseshoes);
    assert.equal((await state(page)).renderer, 'three');
    assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, nofollow');
    const activate = selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
    const aim = await page.locator('#aim').boundingBox();
    if (touch) await page.touchscreen.tap(aim.x + aim.width * .65, aim.y + aim.height / 2);
    else { await page.mouse.move(aim.x + aim.width / 2, aim.y + aim.height / 2); await page.mouse.down(); await page.mouse.move(aim.x + aim.width * .65, aim.y + aim.height / 2, { steps: 6 }); await page.mouse.up(); }
    assert.ok((await state(page)).controls.aimDeg > 0);
    const strength = await page.locator('#strength').boundingBox();
    if (touch) await page.touchscreen.tap(strength.x + strength.width * .6, strength.y + strength.height / 2);
    else await page.mouse.click(strength.x + strength.width * .6, strength.y + strength.height / 2);
    assert.ok((await state(page)).controls.strength > 50);
    await activate('[data-arc=high]'); await activate('[data-style=flip]');
    assert.equal((await state(page)).controls.arc, 'high');
    assert.equal((await state(page)).controls.style, 'flip');
    await activate('#throw-button');
    assert.equal((await state(page)).shoe.status, 'flying');
    await page.waitForTimeout(500);
    assert.ok((await state(page)).shoe.position.z > 0, 'real animation advances the throw');
    await page.screenshot({ path: `${output}/${width}-flight.png` });
    await activate('#retry-button');
    assert.equal((await state(page)).shoe.status, 'ready', 'immediate retry during flight');
    for (const preset of await page.locator('[data-preset]').evaluateAll(nodes => nodes.map(n => n.dataset.preset))) {
      await activate(`[data-preset="${preset}"]`); await activate('#throw-button');
      const rested = await settle(page);
      assert.equal(rested.shoe.status, 'resting', `${preset} settles`);
      assert.equal(rested.shoe.sleeping, true);
      assert.equal(rested.shoe.groundContact, true);
      assert.ok(Object.values(rested.shoe.position).every(Number.isFinite));
      const later = await settle(page);
      assert.deepEqual(later.shoe.position, rested.shoe.position, 'rest is stable');
      results.push({ width, preset, shoe: rested.shoe });
      await activate('#retry-button');
    }
    await activate('#camera-button'); await activate('#debug-button');
    assert.equal((await state(page)).camera, 'close');
    assert.equal((await state(page)).diagnostics, true);
    await page.screenshot({ path: `${output}/${width}-close.png` });
    if (!touch) {
      // Native Enter/Space must operate every focused button instead of throwing.
      for (const key of ['Enter', 'Space']) {
        for (const selector of ['#camera-button', '#debug-button', '[data-arc=low]', '[data-style=turn]', '[data-preset]']) {
          const before = await state(page);
          await page.locator(selector).first().focus(); await page.keyboard.press(key);
          const after = await state(page);
          assert.equal(after.shoe.status, 'ready', `${key} on ${selector} must not throw`);
          if (selector === '#camera-button') assert.notEqual(after.camera, before.camera);
          if (selector === '#debug-button') assert.notEqual(after.diagnostics, before.diagnostics);
          if (selector === '[data-arc=low]') assert.equal(after.controls.arc, 'low');
          if (selector === '[data-style=turn]') assert.equal(after.controls.style, 'turn');
        }
        await page.locator('#throw-button').focus(); await page.keyboard.press(key);
        assert.equal((await state(page)).shoe.status, 'flying');
        await page.locator('#retry-button').focus(); await page.keyboard.press(key);
        assert.equal((await state(page)).shoe.status, 'ready');
        await page.locator('#fullscreen-button').focus(); await page.keyboard.press(key);
        await page.waitForFunction(() => !!document.fullscreenElement);
        await page.keyboard.press(key);
        await page.waitForFunction(() => !document.fullscreenElement);
      }
      await page.locator('summary').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('details').getAttribute('open'), '');
      await page.keyboard.press('Space');
      assert.equal(await page.locator('details').getAttribute('open'), null);
      await page.locator('#aim').focus(); const aimBefore = (await state(page)).controls.aimDeg;
      await page.keyboard.press('ArrowRight'); assert.ok((await state(page)).controls.aimDeg > aimBefore);
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.press('Space'); assert.equal((await state(page)).shoe.status, 'flying');
      await page.keyboard.press('KeyR'); assert.equal((await state(page)).shoe.status, 'ready');
      await page.locator('nav a').first().focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Return to Curling Simulator');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight && document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'default controls fit the viewport');
    const links = await page.locator('nav a').evaluateAll(nodes => nodes.map(n => ({ label: n.textContent, href: n.href })));
    assert.equal(links.length, 2);
    assert.equal(new URL(links[0].href).pathname, '/');
    assert.equal(links[1].href, 'https://davehomeassist.github.io/curling-simulator/');
    assert.deepEqual(failures, []);
    results.push({ width, height, touch, links, layout: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight })) });
    await context.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ url, results }, null, 2));
  console.log(`Horseshoes smoke passed: ${url}; evidence: ${output}`);
} finally { await browser.close(); await server?.close(); }
