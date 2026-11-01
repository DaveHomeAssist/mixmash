/** Front of House 0.4.5 polish: the phone Book sheet appears without a layout shift (CWV-01),
 * a standard controller drives the menu and the build cursor through the key table, the menu
 * lists the controller and links the privacy note, and the board grade never takes a click.
 * Chromium, classic 2D. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';
import { PAD_BINDINGS, PAD_BUTTONS } from '../front-of-house/controls.mjs';

const server = await startStaticServer();
const browser = await chromium.launch(launchOptions());
const text = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));

// A scriptable standard-mapping pad: window.__pad.press('a') holds a button, release() lets go.
function fakePad() {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: 'Smoke pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0 };
  navigator.getGamepads = () => [pad, null, null, null];
  window.__pad = {
    connect: () => window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad })),
    set: (index, on) => { buttons[index].pressed = on; buttons[index].value = on ? 1 : 0; pad.timestamp += 1; },
  };
}

async function open(options, url = '/front-of-house/?renderer=2d') {
  const context = await browser.newContext({ serviceWorkers: 'block', ...options });
  const page = await context.newPage();
  const failures = trackPageFailures(page, server.origin);
  await page.goto(`${server.origin}${url}`);
  await page.waitForFunction(() => !!window.__frontOfHouse);
  return { context, page, failures };
}

try {
  // 1. CWV-01: on a 390px phone the Book sheet renders once at its final place. The audit
  //    measured CLS 0.2677 here on 0.4.4 (the boot sheet at 44dvh grew into the Book sheet).
  for (const width of [375, 390]) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await context.addInitScript(() => {
      window.__cls = 0; window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ value: e.value, sources: (e.sources || []).map(s => s.node?.id || s.node?.nodeName || '?') }); }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const page = await context.newPage();
    const failures = trackPageFailures(page, server.origin);
    // The audit's phone profile: 4x CPU and a 1.6 Mbps / 150 ms link, so the boot note paints
    // before the modules finish (unthrottled, Book can render before the first paint).
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(`${server.origin}/front-of-house/?renderer=2d`);
    await page.waitForFunction(() => document.body.dataset.phase === 'book', null, { timeout: 60000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.waitForTimeout(1500);
    const { cls, shifts } = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }));
    assert.ok(cls <= 0.1, `${width}px phone: load-to-Book CLS ${cls.toFixed(4)} is at most 0.1 (${JSON.stringify(shifts)})`);
    assert.equal(await page.locator('#boot').isVisible(), false, 'the boot note leaves once Book renders');
    assert.ok(await page.locator('#panel .at-sheet').isVisible(), 'the Book sheet is on screen');
    assert.deepEqual(failures, [], 'no page errors');
    console.log(`${width}px phone: Book CLS ${cls.toFixed(4)}`);
    await context.close();
  }

  // 2. Controller: menu, back, focus moves, and the Build cursor go through the key table.
  {
    const { context, page } = await open({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.evaluate(fakePad);
    assert.equal((await page.evaluate(() => __frontOfHouse.gamepad())).polling, false, 'nothing polls before a controller connects');
    await page.evaluate(() => __pad.connect());
    await page.waitForFunction(() => __frontOfHouse.gamepad().connected);
    assert.equal(await page.evaluate(() => document.body.dataset.pad), 'on');
    const tap = async (name) => {
      const before = await page.evaluate(() => __frontOfHouse.gamepad().presses);
      await page.evaluate(i => __pad.set(i, true), PAD_BUTTONS[name]);
      await page.waitForFunction(n => __frontOfHouse.gamepad().presses > n, before);
      await page.evaluate(i => __pad.set(i, false), PAD_BUTTONS[name]);
      await page.waitForTimeout(60);
    };
    await tap('start');
    assert.equal(await page.locator('#menu').isHidden(), false, 'Start opens the menu');
    assert.match(await page.locator('#pad-status').textContent(), /connected/, 'the menu says a controller is connected');
    await tap('b');
    assert.ok(await page.locator('#menu').isHidden(), 'B closes the menu');
    // Book: RB moves focus through the sheet and A presses the focused button.
    await page.locator('[data-deal="door"]:visible').first().focus();
    await tap('a');
    await page.waitForFunction(() => __frontOfHouse.state().phase === 'build');
    // Build: left stick press focuses the lot, the D-pad moves the cursor, Y toggles the bulldozer.
    await tap('ls');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'board', 'left stick press focuses the board');
    const start = (await text(page)).build.cursor;
    await tap('right');
    await tap('down');
    const moved = (await text(page)).build.cursor;
    assert.deepEqual(moved, { x: start.x + 1, y: start.y + 1 }, 'the D-pad moves the build cursor like the arrow keys');
    await tap('y');
    assert.equal((await text(page)).build.tool, 'bulldoze', 'Y turns the bulldozer on');
    await tap('b');
    assert.notEqual((await text(page)).build.tool, 'bulldoze', 'B cancels the tool, as Escape does');
    await tap('rb');
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'board', 'RB moves focus off the board to the next control');
    await context.close();
  }

  // 3. The menu lists the controller and links the privacy note; the grade never takes a click.
  {
    const { context, page } = await open({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    assert.equal(await page.locator('#board-keys-pad [data-pad]').count(), PAD_BINDINGS.length, 'every controller row is in the menu');
    assert.equal(await page.locator('#privacy-link').getAttribute('href'), 'https://mixmash.games/privacy/');
    const hit = await page.evaluate(() => { const r = document.querySelector('#board').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width * 0.3, r.top + r.height * 0.6)?.id; });
    assert.equal(hit, 'board', 'the board grade layer lets clicks reach the board');
    await context.close();
  }
  console.log('Front of House polish smoke passed: phone CLS, controller, menu help and privacy link');
} finally {
  await browser.close();
  await server.close?.();
}
