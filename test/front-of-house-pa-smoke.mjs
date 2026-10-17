// PA cards share model previews and never mutate an imported game; capture responsive gameplay.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';
import { createGame, applyAction } from '../front-of-house/engine.mjs';
import { STARTER_LAYOUT, SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';
const output=process.env.FOH_PA_OUTPUT || '/tmp/foh-pa-evidence';
await mkdir(output,{recursive:true});
const server=await startStaticServer(), browser=await chromium.launch(launchOptions());
const origin=process.env.FRONT_OF_HOUSE_BASE_URL || server.origin+'/front-of-house/';
const code=s=>Buffer.from(JSON.stringify({ns:SAVE_NAMESPACE,v:SCHEMA_VERSION,savedAt:0,state:s})).toString('base64');
const act=(s,a)=>{const r=applyAction(s,a);assert.equal(r.error,null);return r.state;};
try {
 for(const theme of ['light','dark']) for(const [width,height] of [[1440,900],[375,812],[360,800],[1024,700]]) {
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();const errors=trackPageFailures(page,new URL(origin).origin);
  await page.addInitScript(t=>localStorage.setItem('front_of_house_theme',t),theme);
  await page.goto(origin+'?renderer=3d');await page.waitForFunction(()=>window.__frontOfHouse?.rendererStatus().active);
  let fixture=createGame(3); fixture.mode='sandbox';
  fixture=act(fixture,{type:'enableEquipment'});
  fixture=act(fixture,{type:'chooseDeal',deal:'guarantee'});
  fixture=act(fixture,{type:'setLayout',objects:STARTER_LAYOUT.map(o=>o.type==='pa-m'?{...o,type:'pa-s'}:o)});
  await page.evaluate(c=>__frontOfHouse.importCode(c),code(fixture));
  const before=await page.evaluate(()=>__frontOfHouse.state());
  await page.evaluate(()=>__frontOfHouse.boardCamera({yaw:28,pitch:48,zoom:1.3}));
  await page.screenshot({path:`${output}/venue-${theme}-${width}.png`});
  await page.locator('#menu-btn').click();await page.locator('#menu [data-act="equipment-open"]').click();
  for(const tab of ['Asset','Deploy']) {
   await page.locator(`#win [data-tab-name="${tab}"]`).click();
   const img=page.locator('#win .pa-equipment-card:visible img');
   await img.evaluate(i=>i.decode());assert.equal(await img.evaluate(i=>i.naturalWidth),640);
   const overflow=await page.evaluate(()=>[document.documentElement,...document.querySelectorAll('#win .win-body, #win .pa-equipment-card')].filter(e=>e.getClientRects().length).filter(e=>e.scrollWidth>e.clientWidth+1 || e.scrollHeight>e.clientHeight+1).map(e=>e.className));
   assert.deepEqual(overflow,[]);
   await page.screenshot({path:`${output}/${tab.toLowerCase()}-${theme}-${width}.png`});
  }
  assert.deepEqual(await page.evaluate(()=>__frontOfHouse.state()),before);
  await page.reload();await page.waitForFunction(()=>window.__frontOfHouse?.rendererStatus().active);
  assert.deepEqual(await page.evaluate(()=>__frontOfHouse.state()),before);
  if(width===1440 && theme==='light') {
   const medium=act(before,{type:'setLayout',objects:STARTER_LAYOUT});
   await page.evaluate(c=>__frontOfHouse.importCode(c),code(medium));
   await page.evaluate(()=>__frontOfHouse.boardCamera({yaw:25,pitch:32,zoom:3,x:10,y:3}));
   await page.screenshot({path:`${output}/medium-rig-gameplay.png`});
   await page.locator('#menu-btn').click();await page.locator('#menu [data-act="equipment-open"]').click();
   await page.locator('#win [data-tab-name="Deploy"]').click();
   assert.match(await page.locator('#win .pa-equipment-card:visible').innerText(),/Medium PA/);
   await page.locator('#win .pa-equipment-card:visible img').evaluate(i=>i.decode());
   await page.screenshot({path:`${output}/medium-deploy.png`});
  }
  assert.deepEqual(errors,[]);await context.close();console.log(`PA cards ${theme} ${width}x${height}: fit, image, state and reload passed`);
 }
} finally {await browser.close();await server.close();}
