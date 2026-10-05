/** Homepage product journeys, bounded layout, fallback, theme and catalog integrity. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { playableGames, studio } from '../src/hub/catalog.mjs';
import { startStaticServer, trackPageFailures } from './static-server.mjs';
const server = process.env.LANDING_BASE_URL ? null : await startStaticServer();
const origin = process.env.LANDING_BASE_URL || server.origin;
const output = process.env.LANDING_SCREENSHOT_DIR || await mkdtemp(join(tmpdir(), 'mixmash-landing-'));
await mkdir(output, { recursive: true });
const results = [];
const dimensions = [[1440,900], [375,812], [844,390], [320,256], [3840,1080], [768,900], [320,812], [1366,768], [1280,720], [1470,830]];
const noPaging = new Set(['1440x900', '375x812', '1366x768', '1280x720', '1470x830']);
async function fit(page, label) {
  const state = await page.evaluate(() => {
    const d = document.documentElement;
    const controls = [...document.querySelectorAll('a,button')].filter(e => e.getClientRects().length && !e.closest('[hidden]') && !e.classList.contains('skip-link'));
    const clipped = controls.filter(e => {
      if (e.closest('[data-web2-scroll]')?.scrollHeight > e.closest('[data-web2-scroll]')?.clientHeight) return false;
      const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1;
    }).map(e => e.textContent.trim());
    return { root: [d.scrollWidth - d.clientWidth, d.scrollHeight - d.clientHeight], clipped };
  });
  assert.deepEqual(state, { root: [0,0], clipped: [] }, `${label}: ${JSON.stringify(state)}`);
}
try {
 for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
  const browser = await launcher.launch();
  try {
   for (const [width,height] of dimensions) {
    const context = await browser.newContext({ viewport: { width,height }, hasTouch: width < 701, serviceWorkers: 'block', colorScheme: 'dark' });
    const page = await context.newPage(); page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(15000);
    const failures = trackPageFailures(page, new URL(origin).origin);
    const responses = [];
    page.on('response', response => responses.push(response));
    await page.goto(origin, { waitUntil: 'networkidle' });
    // The approved budget covers first load; later detail artwork is measured separately.
    let initialBytes = null, journeyBytes = null;
    if (width === 1440) {
      const initial = [...new Map(responses.filter(r => r.ok()).map(r => [r.url(), r])).values()];
      initialBytes = 0; for (const response of initial) initialBytes += (await response.body()).length;
      assert.ok(initialBytes <= 500000, `initial homepage transfer budget: ${initialBytes}`);
    }
    assert.equal(await page.title(), studio.title);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'fresh visit defaults light despite system dark');
    assert.equal(await page.locator('.game-card').count(), playableGames.length);
    if (width === 1440 && height === 900) {
      const requested = responses.map(r => r.url());
      assert.ok(!requested.some(url => /\.wasm|\/play\/.*\.js|\/mars\/.*\.js|\/front-of-house\/.*\.js/.test(url)), 'homepage requests no game runtime');
      const unique = [...new Map(responses.filter(r => r.ok()).map(r => [r.url(), r])).values()];
      let bytes = 0; for (const response of unique) bytes += (await response.body()).length;
      console.log(`${engine} ${width}×${height} initial homepage transfer: ${bytes} bytes`);
      assert.ok(bytes <= 500000, `homepage transfer budget: ${bytes}`);
    }
    if (noPaging.has(`${width}x${height}`)) {
      assert.ok(await page.locator('#pager').isHidden(), `no paging at ${width}x${height}`);
      const playLinks = await page.locator('.game-card:visible .play-link').evaluateAll(links => links.filter(link => { const r = link.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }).length);
      assert.equal(playLinks, 6, `six Play links visible without paging at ${width}x${height}`);
    }
    const visited = new Set();
    do {
      for (const card of await page.locator('.game-card:visible').all()) {
        visited.add(await card.getAttribute('data-game'));
        assert.ok(await card.locator('.play-link').getAttribute('aria-label'));
        const box = await card.locator('.play-link').boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, '44px launch targets');
        const image = card.locator('img');
        if (await image.isVisible()) await image.evaluate(img => img.decode());
      }
      await fit(page, `${engine} ${width} library`);
      if (await page.locator('#pager').isHidden() || await page.locator('#next-page').isDisabled()) break;
      await page.locator('#next-page').click();
    } while (visited.size <= 6);
    assert.equal(visited.size, 6, 'pagination exposes every game');
    while (await page.locator('#previous-page').isVisible() && await page.locator('#previous-page').isEnabled()) await page.locator('#previous-page').click();
    await page.screenshot({ path: join(output, `${engine}-${width}-light.png`) });
    await page.locator('#theme-toggle').click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'choice persists');
    await fit(page, `${engine} ${width} dark`);
    await page.screenshot({ path: join(output, `${engine}-${width}-dark.png`) });
    for (const game of playableGames) {
      await page.goto(new URL(`#game-${game.id}`, origin).href);
      await page.waitForFunction(id => !document.getElementById(`game-${id}`).hidden, game.id);
      const view = page.locator(`#game-${game.id}`);
      assert.ok(await view.locator('.back-link').isVisible(), 'detail controls are rendered');
      assert.equal(await view.locator('.primary').getAttribute('href'), game.route);
      assert.ok((await view.innerText()).includes(game.saving));
      const artwork = view.locator('.detail-art img');
      if (await artwork.isVisible()) await artwork.evaluate(img => img.decode());
      await fit(page, `${engine} ${width} ${game.id} details`);
      await view.locator('.back-link').click();
      await page.waitForFunction(() => !document.getElementById('games').hidden);
      assert.equal(await page.locator(':focus').getAttribute('id'), `details-${game.id}`, 'Back restores originating title');
    }
    await page.locator('#pick-game').click();
    const firstPick = new URL(page.url()).hash;
    assert.ok(playableGames.some(g => firstPick === `#game-${g.id}`));
    await page.locator('.detail-view:visible .back-link').click();
    await page.locator('#pick-game').click();
    assert.notEqual(new URL(page.url()).hash, firstPick, 'Pick for me avoids immediate repeat');
    await page.goBack();
    await page.waitForFunction(() => !document.getElementById('games').hidden);
    await page.locator('#nav-studio').click(); await page.waitForFunction(() => !document.getElementById('studio').hidden); await fit(page, `${engine} ${width} studio`);
    await page.locator('#nav-studio').focus(); await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => !document.getElementById('games').hidden);
    assert.equal(await page.locator(':focus').getAttribute('id'), 'nav-games', 'arrow key keeps focus on tabs');
    if (width === 1440) {
      const requested = responses.map(r => r.url());
      assert.ok(!requested.some(url => /\.wasm|\/play\/.*\.js|\/mars\/.*\.js|\/front-of-house\/.*\.js/.test(url)), 'homepage requests no game runtime');
      const unique = [...new Map(responses.filter(r => r.ok()).map(r => [r.url(), r])).values()];
      let bytes = 0; for (const response of unique) bytes += (await response.body()).length;
      journeyBytes = bytes;
      await page.evaluate(() => { localStorage.setItem('front_of_house_v1', 'unchanged-game-sentinel'); localStorage.setItem('mixmash_opts', 'unchanged-options'); });
      await page.locator('#theme-toggle').click(); await page.locator('#pick-game').click(); await page.reload();
      assert.deepEqual(await page.evaluate(() => [localStorage.getItem('front_of_house_v1'), localStorage.getItem('mixmash_opts')]), ['unchanged-game-sentinel','unchanged-options']);
    }
    assert.deepEqual(failures, []);
    results.push({ engine,width,height,initialBytes,journeyBytes,passed:true }); console.log(`${engine} ${width}×${height} passed`); await context.close();
   }
   // A direct detail link must return to its card even before catalog capacity was measured.
   {
    const context = await browser.newContext({ viewport: { width:375, height:500 }, serviceWorkers:'block' });
    const page = await context.newPage();
    await page.goto(new URL('#game-mars', origin).href);
    await page.waitForFunction(() => !document.getElementById('game-mars').hidden);
    const panel = page.locator('#game-mars .detail-copy');
    await panel.hover(); await page.mouse.wheel(0,600);
    // Wait for the wheel's final pixel before sampling the position to restore.
    await page.waitForFunction(() => { const e = document.querySelector('#game-mars .detail-copy'); return e.scrollTop > 0 && e.scrollTop >= e.scrollHeight - e.clientHeight; });
    const scroll = await panel.evaluate(e => e.scrollTop);
    await page.locator('#game-mars .back-link').click();
    await page.waitForFunction(() => !document.getElementById('games').hidden);
    assert.ok(await page.locator('#details-mars').isVisible(), 'direct-link return exposes originating card');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'details-mars');
    await page.locator('#details-mars').click();
    await page.waitForFunction(() => !document.getElementById('game-mars').hidden);
    assert.equal(await panel.evaluate(e => e.scrollTop), scroll, 'detail scroll restored after navigation');
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('game-mars').hidden);
    assert.equal(await panel.evaluate(e => e.scrollTop), scroll, 'detail scroll restored after reload');
    await fit(page, `${engine} direct detail`); await context.close();
   }
   // No JavaScript retains complete links and native detail navigation.
   for (const disabled of ['scripts','storage']) {
    const context = await browser.newContext({ viewport: {width:375,height:812}, javaScriptEnabled: disabled !== 'scripts', serviceWorkers:'block' });
    if (disabled === 'storage') await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); });
    const page = await context.newPage(); await page.goto(origin);
    assert.equal(await page.locator('.game-card .play-link').count(),6);
    if (disabled === 'scripts') { await page.locator('#details-mixmash').click(); assert.ok(await page.locator('#game-mixmash').isVisible()); }
    else { await page.locator('#theme-toggle').click(); assert.equal(await page.locator('html').getAttribute('data-theme'),'dark'); }
    await fit(page, `${engine} ${disabled} fallback`); await context.close();
   }
  } finally { await browser.close(); }
 }
 console.log(`Landing passed ${results.length} browser/viewport views plus fallback, theme, detail, history, selection and budget checks. Evidence: ${output}`);
} finally {
 await writeFile(join(output,'report.json'), JSON.stringify(results,null,2));
 await server?.close();
}
