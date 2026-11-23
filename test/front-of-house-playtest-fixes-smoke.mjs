/** Live 0.4.2 playtest fixes (0.4.4): the day-lit settled lot after the show, the phone sheet, the 2D/3D
 * switch, save files and the PA refusal. Chromium, classic and 3D. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';

const server = await startStaticServer();
const browser = await chromium.launch(launchOptions());
const scratch = await mkdtemp(join(tmpdir(), 'foh-playtest-fixes-'));
const text = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
async function open(options = {}, renderer = '2d') {
  const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, ...options });
  const page = await context.newPage();
  const failures = trackPageFailures(page, server.origin);
  await page.goto(`${server.origin}/front-of-house/?renderer=${renderer}`);
  await page.waitForFunction(() => !!window.__frontOfHouse);
  const skip = page.locator('.opening [data-intro="skip"]');
  if (await skip.count() && await skip.isVisible()) await skip.click();
  const enter = page.locator('.opening-actions:not([hidden]) [data-intro="enter"]');
  if (await enter.count() && await enter.isVisible()) await enter.click();
  return { context, page, failures };
}
async function playToSettle(page) {
  await page.locator('[data-deal="door"]:visible').first().click();
  const tabs = page.locator('#panel .tabbar [role="tab"]', { hasText: 'Actions' });
  if (await tabs.count()) await tabs.click();
  await page.click('[data-act="starter"]');
  if (await tabs.count()) await tabs.click();
  await page.click('[data-act="confirm-build"]');
  await page.click('[data-act="confirm-promo"]');
  await page.evaluate(() => { const skip = document.querySelector('[data-act="skip"]'); if (skip && !skip.hidden) skip.click(); });
  const problem = page.locator('#panel .tabbar [role="tab"]', { hasText: 'Problem' });
  if (await problem.count()) await problem.click();
  await page.locator('[data-act="respond"]:visible:not([disabled])').first().click();
  await page.waitForFunction(() => __frontOfHouse.state().phase === 'settle');
}

try {
  // 1. After the show the lot is lit for day and holds a settled, representative crowd that
  //    never exceeds the signed attendance; the settlement keeps the attendance.
  for (const renderer of ['2d', '3d']) {
    const { context, page, failures } = await open({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }, renderer);
    if (renderer === '3d') await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
    await playToSettle(page);
    const scene = await page.evaluate(() => __frontOfHouse.scene());
    const game = await text(page);
    assert.equal(scene.night, false, `${renderer}: Settle returns the lot to day lighting`);
    const attendance = game.settlement.attendance;
    assert.ok(game.crowd > 0 && game.crowd === attendance, `${renderer}: the reported crowd still matches the settlement attendance`);
    assert.ok(scene.crowd > 0 && scene.crowd <= attendance, `${renderer}: the settled crowd never exceeds the signed attendance (${scene.crowd} of ${attendance})`);
    assert.equal(scene.services, false, `${renderer}: no live service queues remain after the show`);
    assert.equal(scene.incident, null, `${renderer}: no incident marker remains after the show`);
    if (renderer === '3d') {
      const figures = await page.evaluate(() => __frontOfHouse.board().representativeGuests);
      assert.ok(figures > 0 && figures <= Math.min(180, attendance), `3d: guest figures stay representative (${figures} for ${attendance})`);
    } else {
      const dots = await page.evaluate(() => __frontOfHouse.board().crowd.length);
      assert.ok(dots > 0 && dots <= attendance, `2d: crowd dots never exceed the attendance (${dots} for ${attendance})`);
    }
    assert.deepEqual(failures, []);
    await context.close();
    console.log(`  ok ${renderer}: day-lit settled lot on Settle, crowd within attendance`);
  }

  // 2. On a phone a short sheet (Settle, Done) leaves the lot visible above it.
  {
    const { context, page, failures } = await open({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
    await playToSettle(page);
    if (await page.isVisible('#win')) await page.click('#win [data-win="close"]');
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const fit = await page.evaluate(() => {
      const panel = document.querySelector('#panel').getBoundingClientRect();
      return { share: __frontOfHouse.board().view.safe.h / innerHeight, top: panel.top, bottom: panel.bottom,
        boardBottom: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--board-bottom')),
        scrolls: document.querySelector('#panel').scrollHeight > document.querySelector('#panel').clientHeight + 1 };
    });
    assert.ok(fit.share >= 0.3, `Settle on a phone leaves the lot at least 30% of the height (${JSON.stringify(fit)})`);
    assert.ok(Math.abs(fit.bottom - 844) < 1 && !fit.scrolls, `the Settle sheet stays a bottom sheet that does not scroll (${JSON.stringify(fit)})`);
    assert.ok(fit.boardBottom < 844 * 0.7, `--board-bottom is capped (${fit.boardBottom}px)`);
    assert.deepEqual(failures, []);
    await context.close();
    console.log(`  ok phone Settle sheet leaves ${(fit.share * 100).toFixed(0)}% of the height for the lot`);
  }

  // 3. The 2D/3D switch lights the view on screen and is pressed only in 3D.
  {
    const { context, page, failures } = await open({ viewport: { width: 1280, height: 800 } }, '3d');
    await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
    const read = () => page.evaluate(() => { const b = document.querySelector('#renderer-btn'); return { on: b.querySelector('[data-on]')?.textContent, pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label') }; });
    assert.deepEqual(await read(), { on: '3D', pressed: 'true', label: '3D view' }, 'in 3D the switch lights 3D and is pressed');
    await page.click('#renderer-btn');
    await page.waitForFunction(() => !__frontOfHouse.rendererStatus().enabled);
    assert.deepEqual(await read(), { on: '2D', pressed: 'false', label: '3D view' }, 'in 2D the switch lights 2D and is not pressed');
    const strip = await page.evaluate(() => Math.max(...[...document.querySelector('.topbar').children].map(c => c.getBoundingClientRect().right)) <= innerWidth);
    assert.ok(strip, 'the strip still fits with the wider switch');
    assert.deepEqual(failures, []);
    await context.close();
    console.log('  ok 2D/3D switch shows the current view');
  }

  // 4. Save and load is the first Menu section, with a save file download and load.
  {
    const { context, page, failures } = await open({ viewport: { width: 1280, height: 800 } });
    await page.locator('[data-deal="guarantee"]').first().click();
    const current = await page.evaluate(() => __frontOfHouse.state());
    await page.click('#menu-btn');
    const first = await page.evaluate(() => [...document.querySelector('#menu').children].find(e => e.id !== 'menu-art')?.id);
    assert.equal(first, 'save-menu', 'Save and load is the first section of the Menu');
    await page.click('#save-menu summary');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-save="download"]')]);
    assert.match(download.suggestedFilename(), /^front-of-house-save-\d{4}-\d{2}-\d{2}\.txt$/);
    const file = join(scratch, download.suggestedFilename());
    await download.saveAs(file);
    const saved = JSON.parse(Buffer.from((await readFile(file, 'utf8')).trim(), 'base64').toString('utf8'));
    assert.deepEqual(saved.state, current, 'the save file holds the current career');
    assert.match(await page.innerText('#save-status'), /Downloaded front-of-house-save-/);
    const other = await open({ viewport: { width: 1280, height: 800 } });
    const fresh = await other.page.evaluate(() => __frontOfHouse.state());
    const junk = join(scratch, 'not-a-save.txt'); await writeFile(junk, 'hello');
    await other.page.click('#menu-btn'); await other.page.click('#save-menu summary');
    await other.page.setInputFiles('#save-file', junk);
    await other.page.waitForFunction(() => /isn't a Front of House save file/.test(document.querySelector('#save-status').textContent));
    assert.deepEqual(await other.page.evaluate(() => __frontOfHouse.state()), fresh, 'a bad file changes nothing');
    await other.page.setInputFiles('#save-file', file);
    await other.page.waitForFunction(() => __frontOfHouse.state().phase === 'build');
    assert.deepEqual(await other.page.evaluate(() => __frontOfHouse.state()), current, 'loading the save file restores the career');
    const raw = join(scratch, 'raw.json'); await writeFile(raw, JSON.stringify(saved));
    const third = await open({ viewport: { width: 1280, height: 800 } });
    await third.page.click('#menu-btn'); await third.page.click('#save-menu summary');
    await third.page.setInputFiles('#save-file', raw);
    await third.page.waitForFunction(() => __frontOfHouse.state().phase === 'build');
    assert.deepEqual(await third.page.evaluate(() => __frontOfHouse.state()), current, 'a raw save file loads too');
    for (const run of [{ failures }, other, third]) assert.deepEqual(run.failures, []);
    await third.context.close(); await other.context.close(); await context.close();
    console.log('  ok Save and load first in the Menu; save file download, load and rejection');
  }

  // 5. A PA away from the stage says why, before and after the tap, and keeps the tool.
  for (const renderer of ['2d', '3d']) {
    const { context, page, failures } = await open({ viewport: { width: 1280, height: 800 } }, renderer);
    if (renderer === '3d') await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
    await page.locator('[data-deal="guarantee"]').first().click();
    await page.evaluate(() => __frontOfHouse.act({ type: 'setLayout', objects: [{ type: 'stage', x: 9, y: 0, rot: 0 }] }));
    await page.locator('input[name="tool"][value="pa-s"]').evaluate(input => input.click());
    const hover = await page.evaluate(() => __frontOfHouse.boardClientOf(18.5, 11.5));
    await page.mouse.move(hover.x, hover.y);
    await page.waitForFunction(() => /must touch the stage/.test(document.querySelector('#board-status').textContent));
    const far = await page.evaluate(() => __frontOfHouse.boardClientOf(20.5, 12.5));
    await page.mouse.click(far.x, far.y);
    await page.waitForTimeout(200);
    assert.match(await page.innerText('#board-status'), /PA \(small\) must touch the stage\. Pick a tile right beside the stage\./);
    assert.match(await page.innerText('#msg'), /must touch the stage/);
    assert.equal((await page.evaluate(() => __frontOfHouse.buildTools())).tool, 'pa-s', `${renderer}: the PA tool stays chosen`);
    assert.equal(await page.locator('input[name="tool"][value="pa-s"]').isChecked(), true);
    assert.equal((await page.evaluate(() => __frontOfHouse.state())).venue.objects.length, 1, 'nothing was placed');
    const beside = await page.evaluate(() => __frontOfHouse.boardClientOf(8.5, 0.5));
    await page.mouse.click(beside.x, beside.y);
    await page.waitForFunction(() => __frontOfHouse.state().venue.objects.some(o => o.type === 'pa-s'));
    assert.deepEqual(failures, []);
    await context.close();
    console.log(`  ok ${renderer}: PA refusal is explained on hover and tap; the tool stays; a tile beside the stage places it`);
  }
  console.log('PASS: Front of House playtest fixes');
} finally {
  await browser.close();
  await server.close();
}
