// Menu illustration coverage, actual booking controls and responsive containment.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';
import * as E from '../front-of-house/engine.mjs';
import { SAVE_NAMESPACE, SCHEMA_VERSION, ARTISTS, VENUE_ORDER } from '../front-of-house/data.mjs';
import { bandArt, venueArt } from '../front-of-house/menu-art.mjs';
assert.equal(new Set(Object.keys(ARTISTS).map(id => bandArt(id))).size, Object.keys(ARTISTS).length);
for (const id of Object.keys(ARTISTS)) assert.ok(!/undefined|NaN/.test(bandArt(id)));
for (const id of VENUE_ORDER) assert.match(venueArt(id), /aria-hidden="true"/);
assert.ok(!/undefined|NaN/.test(bandArt('unknown')));
const server = await startStaticServer();
const browser = await chromium.launch(launchOptions());
const output = process.env.FRONT_OF_HOUSE_SCREENSHOT_DIR || 'artifacts/menu-art';
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage();
  const errors = trackPageFailures(page, server.origin);
  await page.goto(`${server.origin}/front-of-house/?renderer=2d`);
  await page.waitForFunction(() => window.__frontOfHouse);
  if (await page.locator('#win').isVisible()) await page.keyboard.press('Escape');
  for (const [width, height] of [[1440,900],[1024,700],[390,844],[375,812],[360,780],[2560,1080]]) {
    await page.setViewportSize({width,height});
    for (const theme of ['light','dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await page.waitForTimeout(100);
      assert.ok(await page.locator('.offer .band-art:visible').count());
      const fit = await page.evaluate(() => ({ root: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight], panels: [...document.querySelectorAll('.at-sheet')].filter(e => e.getClientRects().length).map(e => [e.scrollHeight-e.clientHeight,e.scrollWidth-e.clientWidth]) }));
      assert.deepEqual(fit.root,[0,0]);
      if(width >= 1024) assert.ok(fit.panels.every(x=>x.every(n=>n<=1)),JSON.stringify({width,height,fit}));
      await page.screenshot({path:`${output}/book-${width}-${theme}.png`});
    }
  }
  for (const room of VENUE_ORDER) {
    let state = E.applyAction(E.createGame(8, {mode:'sandbox'}), {type:'chooseVenue',venueId:room}).state;
    await page.setViewportSize({width:1024,height:700});
    await page.click('#menu-btn');
    assert.equal(await page.locator('#menu-art .venue-art').count(),1, 'Unbooked menu shows the venue');
    if (!await page.locator('#save-menu').evaluate(e=>e.open)) await page.click('#save-menu summary');
    await page.fill('#save-code', Buffer.from(JSON.stringify({ns:SAVE_NAMESPACE,v:SCHEMA_VERSION,state})).toString('base64'));
    await page.click('[data-save="import"]');
    const overflow = await page.locator('.at-sheet').evaluate(e=>e.scrollHeight-e.clientHeight);
    assert.ok(overflow<=1, `${room} booking overflow ${overflow}`);
    await page.screenshot({path:`${output}/${room}-1024.png`});
    for (const width of [390,375,360]) {
      await page.setViewportSize({width,height:812});
      const tabs = page.locator('#panel .tabbar [role="tab"]');
      for (let i=0;i<await tabs.count();i++) {
        await tabs.nth(i).click();
        const bad = await page.locator('#panel').evaluate(panel => [panel,...panel.querySelectorAll('button')].filter(e=>e.getClientRects().length).filter(e=>e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1||e.getBoundingClientRect().bottom>innerHeight+1).map(e=>({text:e.textContent.slice(0,60),height:[e.scrollHeight,e.clientHeight],bottom:e.getBoundingClientRect().bottom})));
        assert.deepEqual(bad,[], `${room} booking at ${width}px`);
        assert.ok((await tabs.nth(i).boundingBox()).height>=44);
      }
      await page.screenshot({path:`${output}/${room}-${width}.png`});
    }
  }
  await page.click('#menu-btn');
  if (!await page.locator('#save-menu').evaluate(e=>e.open)) await page.click('#save-menu summary');
  await page.fill('#save-code', Buffer.from(JSON.stringify({ns:SAVE_NAMESPACE,v:SCHEMA_VERSION,state:E.createGame(8)})).toString('base64'));
  await page.click('[data-save="import"]');
  await page.setViewportSize({width:1440,height:900});
  await page.locator('[data-act="deal"][data-deal="guarantee"]').first().click();
  assert.equal(await page.evaluate(()=>window.__frontOfHouse.state().phase),'build');
  await page.click('#menu-btn');
  assert.equal(await page.locator('#menu-art .band-art').count(),1);
  await page.screenshot({path:`${output}/menu.png`});
  await page.keyboard.press('Escape');
  await page.click('[data-act="starter"]');
  await page.click('[data-act="confirm-build"]');
  assert.equal(await page.locator('.show-art-heading .band-art').count(),1);
  await page.screenshot({path:`${output}/promote.png`});
  assert.deepEqual(errors,[]);
  console.log('Menu art: eleven unique acts, four venues, 12 responsive/theme captures, booking and menu passed');
} finally { await browser.close(); await server.close(); }
