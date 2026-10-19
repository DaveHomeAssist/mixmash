// Title theatre acceptance: real entry, skip/replay, exact saves, reduced motion and fallback.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';
const server = await startStaticServer(), browser = await chromium.launch(launchOptions());
const url = process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
const output = process.env.FOH_OPENING_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-opening-'));
await mkdir(output, { recursive: true });
const results = [];
try {
  for (const [width, height, reducedMotion] of [[1440,900,'no-preference'],[375,812,'reduce'],[2560,720,'reduce'],[667,375,'reduce'],[320,256,'reduce']]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion, serviceWorkers: 'block' });
    const page = await context.newPage(); const errors = trackPageFailures(page, new URL(url).origin);
    await page.goto(url);
    await page.waitForSelector('.opening');
    if (reducedMotion === 'no-preference') {
      await page.waitForTimeout(4300); await page.screenshot({ path: `${output}/build-${width}.png` });
      await page.getByRole('button', { name: 'Skip intro', exact: true }).click();
    }
    await page.waitForSelector('.opening-actions:not([hidden])');
    await page.screenshot({ path: `${output}/menu-${width}.png` });
    assert.equal(await page.locator('.opening [data-intro="enter"]').textContent(), 'New game');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
    const saved = await page.evaluate(() => localStorage.getItem('front_of_house_v1'));
    await page.getByRole('button', { name: 'Replay intro', exact: true }).first().click();
    if (reducedMotion === 'no-preference') await page.keyboard.press('Escape');
    await page.waitForSelector('.opening-actions:not([hidden])');
    assert.equal(await page.evaluate(() => localStorage.getItem('front_of_house_v1')), saved);
    await page.locator('.opening [data-intro="enter"]').click();
    await page.waitForSelector('.opening', { state: 'detached' });
    assert.equal(await page.locator('#menu-btn').evaluate(e => e.inert || e.closest('[inert]') !== null), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('front_of_house_v1')), saved);
    await page.reload(); await page.waitForSelector('.opening-actions:not([hidden])');
    assert.equal(await page.locator('.opening [data-intro="enter"]').textContent(), 'Continue');
    const afterReload = await page.evaluate(() => localStorage.getItem('front_of_house_v1'));
    await page.locator('.opening [data-intro="enter"]').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('front_of_house_v1')), afterReload);
    assert.deepEqual(errors, []); results.push({width,height,reducedMotion,savePreserved:true}); await context.close();
  }
  // Full duration and replay; every skip beat is exercised without altering career state.
  const context = await browser.newContext({ viewport: {width:1440,height:900}, serviceWorkers:'block' });
  const page = await context.newPage(); const errors = trackPageFailures(page, new URL(url).origin);
  await page.goto(url); await page.waitForSelector('.opening');
  await page.waitForSelector('.opening-actions:not([hidden])', {timeout:30000});
  for (const seconds of [0,1.3,3.9,6.2,8.1,9.3]) {
    await page.locator('.opening [data-intro="replay"]').click();
    await page.waitForTimeout(seconds * 1000);
    await page.locator('.opening [data-intro="skip"]').click();
    await page.waitForSelector('.opening-actions:not([hidden])');
  }
  await page.locator('.opening [data-intro="sound"]').click();
  await page.waitForFunction(() => __mixmashNav.audioContexts.some(c => c.state === 'running'));
  await page.locator('.opening [data-intro="sound"]').click();
  await page.waitForFunction(() => __mixmashNav.isMuted() && __mixmashNav.audioContexts.every(c => c.state !== 'running'));
  await page.locator('.opening [data-intro="sound"]').click();
  await page.locator('.opening [data-intro="replay"]').click();
  await page.waitForTimeout(8500); await page.screenshot({path:`${output}/show-1440.png`});
  await page.keyboard.press('Escape'); await page.locator('.opening [data-intro="theme"]').click();
  await page.screenshot({path:`${output}/menu-dark.png`});
  await page.locator('.opening [data-intro="enter"]').click();
  assert.deepEqual(errors, []); await context.close();
  results.push({fullSequence:true,skipBeats:6,soundGesture:true});
  {
    const context = await browser.newContext({reducedMotion:'reduce',serviceWorkers:'block'}), page = await context.newPage();
    await page.goto(url); await page.waitForSelector('.opening-actions:not([hidden])');
    await page.locator('.opening [data-intro="enter"]').click();
    await page.locator('[data-act="deal"]:not([disabled])').first().click();
    await page.locator('[data-act="starter"]').click();
    const saved = await page.evaluate(() => localStorage.getItem('front_of_house_v1'));
    const tools = await page.evaluate(() => __frontOfHouse.buildTools());
    await page.locator('#menu-btn').click(); await page.locator('#intro-replay').click();
    await page.waitForSelector('.opening-actions:not([hidden])');
    await page.keyboard.press('1');
    assert.deepEqual(await page.evaluate(() => __frontOfHouse.buildTools()), tools, 'title keys cannot select a Build tool');
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => localStorage.getItem('front_of_house_v1')), saved, 'title keys cannot undo a saved layout');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.opening', {state:'detached'});
    assert.equal(await page.evaluate(() => localStorage.getItem('front_of_house_v1')), saved, 'title keys cannot place equipment into a saved Build');
    results.push({savedBuildKeyboardIsolation:true}); await context.close();
  }
  {
    const context = await browser.newContext({serviceWorkers:'block'}), page = await context.newPage();
    await page.goto(url); await page.locator('.opening [data-intro="skip"]').click();
    await page.locator('.opening [data-intro="enter"]').click();
    await page.locator('[data-act="deal"]:not([disabled])').first().click();
    await page.locator('[data-act="starter"]').click(); await page.locator('[data-act="confirm-build"]').click();
    await page.locator('[data-act="confirm-promo"]').click(); await page.reload();
    await page.waitForSelector('.opening-actions:not([hidden])');
    const before = await page.evaluate(() => ({save:localStorage.getItem('front_of_house_v1'),p:JSON.parse(render_game_to_text()).playback.progress}));
    await page.waitForTimeout(700);
    assert.deepEqual(await page.evaluate(() => ({save:localStorage.getItem('front_of_house_v1'),p:JSON.parse(render_game_to_text()).playback.progress})),before,'saved Show stays paused behind the title');
    await page.locator('.opening [data-intro="enter"]').click();
    await page.waitForFunction(p => JSON.parse(render_game_to_text()).playback.progress > p + 0.01,before.p);
    assert.equal(await page.evaluate(() => localStorage.getItem('front_of_house_v1')),before.save);
    results.push({savedShowResumes:true,titleTimeExcluded:true});
    await page.locator('#skip-btn').click(); await page.locator('[data-act="respond"]:not([disabled])').first().click();
    await page.reload(); await page.waitForSelector('.opening-actions:not([hidden])');
    const unsigned = await page.evaluate(() => localStorage.getItem('front_of_house_v1'));
    await page.locator('.opening [data-intro="enter"]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'win-title', 'Continue focuses the saved settlement dialog');
    assert.equal(await page.evaluate(() => localStorage.getItem('front_of_house_v1')), unsigned);
    results.push({savedSettlementFocus:true,unsignedSavePreserved:true}); await context.close();
  }
  for (const scenario of ['no-webgl','blocked-storage','context-loss','no-gsap']) {
    const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
    if (scenario === 'blocked-storage') await context.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
      Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
    });
    if (scenario === 'no-webgl') await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) { return this.classList.contains('opening-board') && type.startsWith('webgl') ? null : original.call(this,type,...args); };
    });
    const page = await context.newPage();
    if (scenario === 'no-gsap') await page.route('**/vendor/gsap/gsap.min.js', route => route.fulfill({status:200,contentType:'text/javascript',body:''}));
    await page.goto(url);
    if (scenario === 'no-gsap') {
      await page.waitForFunction(() => window.__frontOfHouse && !document.querySelector('.opening'));
      assert.equal(await page.locator('#menu-btn').isEnabled(),true);
      results.push({scenario,entryUsable:true}); await context.close(); continue;
    }
    await page.waitForSelector('.opening-actions:not([hidden])');
    if (scenario === 'context-loss') await page.locator('.opening-board').evaluate(canvas => canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
    await page.locator('.opening [data-intro="enter"]').click();
    await page.waitForSelector('.opening', {state:'detached'});
    assert.equal(await page.locator('#menu-btn').isEnabled(),true);
    results.push({scenario,entryUsable:true}); await context.close();
  }
  console.log(JSON.stringify({host:process.env.HOSTNAME,results,output},null,2));
} finally { await browser.close(); await server.close(); }
