// Banked career fixture opens access; all subsequent capital and show actions use player controls.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';
import { createGame, applyAction, settlementFor, settlementPayout } from '../front-of-house/engine.mjs';
import { STARTER_LAYOUT, INCIDENTS, SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';
const server=await startStaticServer(),url=process.env.FRONT_OF_HOUSE_BASE_URL||`${server.origin}/front-of-house/`,output=await mkdtemp(join(tmpdir(),'foh-equipment-'));
const act=(s,a)=>{const r=applyAction(s,a);assert.equal(r.error,null);return r.state;};
let initial=[{type:'chooseDeal',deal:'guarantee'},{type:'setLayout',objects:STARTER_LAYOUT.map(o=>o.type==='pa-m'?{...o,type:'pa-s'}:o)},{type:'confirmBuild'},{type:'confirmPromotion'}].reduce(act,createGame(3));
initial=act(initial,{type:'respond',responseId:INCIDENTS[initial.show.incidentId].responses[0].id});initial=act(initial,{type:'acceptSettlement'});initial.cash=10000;
const code=Buffer.from(JSON.stringify({ns:SAVE_NAMESPACE,v:SCHEMA_VERSION,savedAt:0,state:initial})).toString('base64');
const state=p=>p.evaluate(()=>__frontOfHouse.state()),view=p=>p.evaluate(()=>JSON.parse(render_game_to_text()));
const tab=async(p,name)=>{const b=p.locator(`#panel [data-tab-name="${name}"]:visible`);if(await b.count())await b.click();};
const equipment=async p=>{await p.locator('#menu-btn').click();await p.locator('#menu [data-act="equipment-open"]').click();};
const close=p=>p.locator('#win [data-win="close"]').first().click();
async function fit(p){const bad=await p.evaluate(()=>[document.documentElement,...document.querySelectorAll('#win:not([hidden]) .win-body, #win:not([hidden]) button')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(e=>({text:e.textContent.slice(0,90),size:[e.scrollHeight,e.clientHeight,e.scrollWidth,e.clientWidth]})));if(bad.length)await p.screenshot({path:join(output,'overflow.png')});assert.deepEqual(bad,[]);}
try{for(const [name,launcher] of Object.entries({chromium,webkit})){
 const browser=await launcher.launch(name==='chromium'?launchOptions():{});
 try{for(const [width,height,three] of name==='chromium'?[[1440,900,false],[375,812,false],[1024,700,false],[1440,900,true],[375,812,true]]:[[1440,900,false],[375,812,false]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width===375,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
  if(width===1024)await page.addInitScript(()=>localStorage.setItem('front_of_house_theme','dark'));
  const errors=trackPageFailures(page,new URL(url).origin);
  await page.goto(url+(three?'?renderer=3d':''));await page.waitForFunction(()=>window.__frontOfHouse);await page.evaluate(c=>__frontOfHouse.importCode(c),code);
  if(three)await page.waitForFunction(()=>__frontOfHouse.rendererStatus().active);
  await equipment(page);await fit(page);await page.locator('[data-act="equipment-enable"]').click();assert.equal((await state(page)).cash,10000);
  await close(page);await equipment(page);assert.equal((await state(page)).cash,10000,'closing quote does not buy');
  await page.locator('[data-command="buy"]').dblclick();assert.equal((await state(page)).cash,8800);assert.equal((await view(page)).equipment.assets.length,1);
  for(const t of ['Asset','Deploy','Cash','History']){await page.locator(`#win [data-tab-name="${t}"]`).click();await fit(page);}
  await page.locator('#win [data-tab-name="Asset"]').click();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#win [data-tab-name="Deploy"]').getAttribute('aria-selected'),'true');
  await page.reload();await page.waitForFunction(()=>window.__frontOfHouse);assert.equal((await state(page)).cash,8800);
  await page.locator('[data-act="next"]').click();await page.locator('[data-deal="door"]:not([disabled]):visible').first().click();
  await equipment(page);await page.locator('#win [data-tab-name="Deploy"]').click();await page.locator('[data-owned="yes"]').click();assert.equal((await view(page)).equipment.deployment.cost,20);
  await page.locator('[data-owned="no"]').click();assert.equal((await view(page)).equipment.deployment,null);await page.locator('[data-owned="yes"]').click();
  await fit(page);await page.screenshot({path:join(output,`${name}-${width}-${three?'3d':'classic'}-deployment.png`)});
  await close(page);await tab(page,'Actions');await page.locator('[data-act="confirm-build"]').click();await page.locator('#live-settings').click();await page.locator('#live-services').check();await close(page);await page.locator('#confirm-promo').click();
  await equipment(page);await page.locator('#win [data-tab-name="Asset"]').click();assert.equal(await page.locator('[data-act="equipment-capital"]:enabled').count(),0);await page.locator('#win [data-tab-name="Deploy"]').click();assert.equal(await page.locator('[data-act="equipment-assign"]:enabled').count(),0);await close(page);
  await tab(page,'Controls');await page.locator('[data-act="live-next"]').click();await page.locator('[data-act="respond"]:not([disabled]):visible').first().click();await tab(page,'Controls');await page.locator('[data-act="live-next"]').click();await page.locator('[data-act="live-next"]').click();
  const ended=await state(page),receipt=settlementFor(ended);assert.equal(receipt.costs.pa,0);assert.equal(receipt.costs.equipmentOperation,20);
  await page.locator('#win [data-tab-name="Ledger"]').click();await page.locator('#win [data-settlement-page="Costs"]').click();assert.match(await page.locator('#win-body').innerText(),/Owned PA operation/);await fit(page);
  await page.locator('[data-act="accept"]').click();const settled=(await state(page)).cash;assert.equal(settled,ended.cash+settlementPayout(receipt,ended.booking.deal));
  await equipment(page);await page.locator('#win [data-tab-name="Asset"]').click();await page.locator('[data-command="sell"]').dblclick();assert.equal((await state(page)).cash,settled+600);assert.equal((await view(page)).equipment.assets.length,0);
  await page.locator('#win [data-tab-name="Cash"]').click();await fit(page);assert.equal((await view(page)).equipment.journal.balance,settled+600);
  await page.locator('#win [data-tab-name="History"]').click();await fit(page);await page.locator('[data-step="1"]').click();await fit(page);await page.locator('[data-step="-1"]').click();await fit(page);
  await page.screenshot({path:join(output,`${name}-${width}-${three?'3d':'classic'}-history.png`)});
  await close(page);await page.locator('[data-act="last-sheet"]').click();assert.equal(settlementFor(await state(page)).net,receipt.net);assert.equal((await state(page)).history.at(-1).cashAfter,settled);assert.equal(await page.locator('#win .settlement-change.cash strong').textContent(),'$'+settled.toLocaleString('en-US'));await close(page);
  await page.reload();await page.waitForFunction(()=>window.__frontOfHouse);assert.equal((await state(page)).cash,settled+600);assert.equal((await view(page)).equipment.journal.balance,settled+600);assert.deepEqual(errors,[]);
  if(name==='chromium'&&width===1440&&!three){
   for(const theme of ['light','dark']){
    if(theme==='dark'){await page.locator('#menu-btn').click();await page.locator('#theme-toggle').click();await page.locator('#menu-close').click();}
    await equipment(page);
    for(const [w,h]of [[1440,900],[375,812],[844,390],[320,256],[3840,1080]]){
     await page.setViewportSize({width:w,height:h});
     for(const section of ['Asset','Deploy','Cash','History']){
      await page.locator(`#win [data-tab-name="${section}"]`).click();
      let part=0;for(;part<30;part++){await fit(page);const more=page.locator('#win-foot [data-step="1"]');if(!await more.count()||!await more.isEnabled())break;await more.click();}assert.ok(part<30,'all short-window parts are reachable');
     }
    }
    await close(page);await page.setViewportSize({width,height});
   }
  }
  await context.close();console.log(`  ok equipment ${name} ${width} ${three?'3d':'classic'}: capital, assignment, live settlement, resale and journal`);
 }}finally{await browser.close();}
}}finally{await server.close();}
console.log(`Equipment: seven complete player journeys passed. Screenshots: ${output}`);
