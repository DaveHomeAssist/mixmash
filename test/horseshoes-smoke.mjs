// Browser regression for local two-player Horseshoes and practice.
import { createRequire } from 'node:module';
import { startStaticServer } from './static-server.mjs';
const require = createRequire(import.meta.url);
const server = process.env.HORSESHOES_BASE_URL ? null : await startStaticServer();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'),
  fs = require('node:fs');
const url =
  process.env.HORSESHOES_BASE_URL || `${server.origin}/horseshoes/`;
const output = process.env.HORSESHOES_OUTPUT || '/tmp/horseshoes-phase2-smoke';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  const results = [];
  try {
    for (const [width, height, touch] of [
      [1440, 900, false],
      [375, 812, true],
      [667, 375, true],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: touch,
        isMobile: touch,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => {
        if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
      });
      assert.equal(
        (await page.goto(url, { waitUntil: 'networkidle' })).status(),
        200,
      );
      await page.waitForFunction(() => window.__horseshoes);
      const state = () => page.evaluate(() => window.__horseshoes.getState());
      const activate = (selector) =>
        touch ? page.locator(selector).tap() : page.locator(selector).click();
      const settle = () =>
        page.evaluate(() => {
          advanceTime(13000);
          return __horseshoes.getState();
        });
      const setRange = async (selector, value) => {
        await page.locator(selector).fill(String(value));
        await page.locator(selector).dispatchEvent('input');
      };
      assert.equal((await state()).renderer, 'three');
      assert.equal((await state()).mode, 'horseshoes-match');
      assert.equal(
        await page.locator('meta[name=robots]').getAttribute('content'),
        'noindex, nofollow',
      );
      for (const theme of ['light', 'dark']) {
        assert.equal(
          await page.locator('html').getAttribute('data-theme'),
          theme,
        );
        for (const tab of ['play', 'score', 'settings']) {
          await activate(`#${tab}-tab`);
          assert.ok(
            await page.evaluate(
              () =>
                document.documentElement.scrollHeight <= innerHeight &&
                document.documentElement.scrollWidth <= innerWidth,
            ),
          );
        }
        await activate('#play-tab');
        await page.screenshot({ path: `${output}/${width}-${theme}.png` });
        if (theme === 'light') await activate('#theme-button');
      }
      // Pointer/touch aiming and strength.
      for (const selector of ['#aim', '#strength']) {
        const b = await page.locator(selector).boundingBox();
        if (touch)
          await page.touchscreen.tap(b.x + b.width * 0.7, b.y + b.height / 2);
        else {
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
          await page.mouse.down();
          await page.mouse.move(b.x + b.width * 0.7, b.y + b.height / 2, {
            steps: 5,
          });
          await page.mouse.up();
        }
      }
      assert.ok((await state()).controls.aimDeg > 0);
      assert.ok((await state()).controls.strength > 50);
      await activate('[data-arc=high]');
      await activate('[data-style=flip]');
      assert.equal((await state()).controls.style, 'flip');
      await activate('#throw-button');
      await page.waitForTimeout(450);
      assert.ok((await state()).shoe.position.z > 1);
      assert.equal(await page.locator('#throw-button').isDisabled(), true);
      await settle();
      const beforeCamera = (await state()).cameraPose;
      const box = await page.locator('canvas').boundingBox();
      if (touch) {
        const cdp = await context.newCDPSession(page);
        const x = box.x + box.width * 0.5,
          y = box.y + box.height * 0.5;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + 55, y: y + 10 }],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
        const beforeZoom = (await state()).cameraPose;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [
            { x: x - 20, y },
            { x: x + 20, y },
          ],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            { x: x - 50, y },
            { x: x + 50, y },
          ],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
        assert.notDeepEqual((await state()).cameraPose, beforeZoom);
        await cdp.detach();
      } else {
        await page.mouse.move(
          box.x + box.width * 0.5,
          box.y + box.height * 0.5,
        );
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width * 0.65,
          box.y + box.height * 0.55,
          { steps: 8 },
        );
        await page.mouse.up();
        await page.mouse.wheel(0, -150);
      }
      assert.notDeepEqual((await state()).cameraPose, beforeCamera);
      await activate('#settings-tab');
      await activate('#restart-button');
      assert.deepEqual((await state()).match.scores, [0, 0]);
      // Entire game via real throws. Player 1's first shoe is close; the other three
      // use minimum strength and foul short. No score/state injection.
      await page.evaluate(() => __horseshoes.stop());
      await activate('[data-arc=normal]');
      await activate('[data-style=turn]');
      await setRange('#aim', 0);
      let throws = 0;
      while ((await state()).match.phase !== 'complete') {
        const before = await state();
        assert.ok(before.match.inning <= 25);
        for (let n = 0; n < 4; n++) {
          assert.equal((await state()).match.player, n < 2 ? 0 : 1);
          await setRange('#strength', n === 0 ? 50 : 0);
          await activate('#throw-button');
          throws++;
          const landed = await settle();
          assert.ok(Object.values(landed.shoe.position).every(Number.isFinite));
          const later = await settle();
          assert.deepEqual(
            later.shoes,
            landed.shoes,
            'all shoes stable at rest',
          );
          if (n < 3) assert.deepEqual(landed.match.scores, before.match.scores);
        }
        const after = await state();
        assert.equal(after.match.scores[0], before.match.scores[0] + 1);
        assert.equal(after.match.scores[1], 0);
        assert.equal(after.match.result.shoes.filter((s) => s.foul).length, 3);
        if (after.match.phase === 'inning') {
          await activate('#next-button');
          assert.equal((await state()).match.end, 1 - before.match.end);
          assert.equal((await state()).shoes.length, 0);
        }
      }
      assert.equal((await state()).match.winner, 0);
      assert.equal((await state()).match.scores[0], 21);
      assert.equal(throws, 84);
      assert.equal(await page.locator('#throw-button').isDisabled(), true);
      await activate('#score-tab');
      await page.screenshot({ path: `${output}/${width}-complete.png` });
      assert.equal(await page.locator('#history li').count(), 21);
      if (!touch) {
        await page.locator('#score-tab').focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'score-panel', 'Tab enters the selected score panel');
        const strengthBefore = (await state()).controls.strength;
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('End');
        await page.waitForFunction(() => document.querySelector('#score-panel').scrollTop > 0);
        assert.equal((await state()).controls.strength, strengthBefore, 'history navigation must not change throw controls');
      }
      await activate('#settings-tab');
      await activate('#restart-button');
      assert.equal((await state()).match.history.length, 0);
      await activate('#settings-tab');
      await page.selectOption('#mode', 'practice');
      assert.equal((await state()).shoe.status, 'ready');
      for (const preset of ['center', 'stake', 'near', 'loft']) {
        await activate('#settings-tab');
        await activate(`[data-preset=${preset}]`);
        await activate('#play-tab');
        await activate('#throw-button');
        const rest = await settle();
        assert.equal(rest.shoe.status, 'resting');
        assert.equal(rest.shoe.sleeping, true);
        await activate('#retry-button');
        assert.equal(await page.locator('#stake-flash').isVisible(), false);
      }
      await activate('#throw-button');
      await activate('#retry-button');
      assert.equal((await state()).shoe.status, 'ready');
      if (!touch) {
        for (const key of ['Enter', 'Space']) {
          for (const selector of [
            '#camera-button',
            '[data-arc=low]',
            '[data-style=flip]',
            '#theme-button',
          ]) {
            await page.locator(selector).focus();
            await page.keyboard.press(key);
            assert.equal((await state()).shoe.status, 'ready');
          }
          await page.locator('#throw-button').focus();
          await page.keyboard.press(key);
          assert.equal((await state()).shoe.status, 'flying');
          await page.locator('#retry-button').focus();
          await page.keyboard.press(key);
          assert.equal((await state()).shoe.status, 'ready');
          await activate('#settings-tab');
          await page.locator('#debug-button').focus();
          await page.keyboard.press(key);
          assert.equal((await state()).shoe.status, 'ready');
          await page.locator('#fullscreen-button').focus();
          await page.keyboard.press(key);
          await page.waitForFunction(() => !!document.fullscreenElement);
          await page.keyboard.press(key);
          await page.waitForFunction(() => !document.fullscreenElement);
          await activate('#play-tab');
        }
        await page.locator('#play-tab').focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(
          await page.locator('#score-tab').getAttribute('aria-selected'),
          'true',
        );
        await page.keyboard.press('ArrowRight');
        assert.equal(
          await page.locator('#settings-tab').getAttribute('aria-selected'),
          'true',
        );
        await page.keyboard.press('Home');
        await page.locator('#aim').focus();
        const before = (await state()).controls.aimDeg;
        await page.keyboard.press('ArrowRight');
        assert.ok((await state()).controls.aimDeg > before);
        await page.evaluate(() => document.activeElement.blur());
        await page.keyboard.press('Space');
        assert.equal((await state()).shoe.status, 'flying');
        await page.keyboard.press('KeyR');
        assert.equal((await state()).shoe.status, 'ready');
      }
      const links = await page
        .locator('nav a')
        .evaluateAll((nodes) => nodes.map((n) => n.href));
      assert.equal(new URL(links[0]).pathname, '/');
      assert.equal(
        links[1],
        'https://davehomeassist.github.io/curling-simulator/',
      );
      assert.deepEqual(errors, []);
      results.push({
        width,
        height,
        touch,
        throws,
        winner: 0,
        score: [21, 0],
        links,
        errors,
      });
      await context.close();
    }
    fs.writeFileSync(
      `${output}/report.json`,
      JSON.stringify({ url, results }, null, 2),
    );
    console.log('Horseshoes Phase 2 smoke passed', JSON.stringify(results));
  } finally {
    await browser.close();
    await server?.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
