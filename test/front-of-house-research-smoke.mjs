// Player development controls, real signed progress, cash and next-booking benefits.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';
import { createGame, applyAction, settlementFor, settlementPayout } from '../front-of-house/engine.mjs';
import { STARTER_LAYOUT, INCIDENTS, SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';
const server=await startStaticServer(), url=process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
const output=await mkdtemp(join(tmpdir(),'foh-research-'));
const act=(s,a)=>{const r=applyAction(s,a);assert.equal(r.error,null);return r.state;};
let initial=[{type:'chooseDeal',deal:'guarantee'},{type:'setLayout',objects:STARTER_LAYOUT},{type:'confirmBuild'},{type:'confirmPromotion'}].reduce(act,createGame(3));
initial=act(initial,{type:'respond',responseId:INCIDENTS[initial.show.incidentId].responses[0].id});
initial=act(initial,{type:'acceptSettlement'});
const code=Buffer.from(JSON.stringify({ns:SAVE_NAMESPACE,v:SCHEMA_VERSION,savedAt:0,state:initial})).toString('base64');
const state=p=>p.evaluate(()=>__frontOfHouse.state());
const view=p=>p.evaluate(()=>JSON.parse(render_game_to_text()));
const tab=async(p,name)=>{const b=p.locator(`#panel [data-tab-name="${name}"]:visible`);if(await b.count())await b.click();};
async function fit(p){
 const bad=await p.evaluate(()=>[document.documentElement,...document.querySelectorAll('#win:not([hidden]) .win-body, #win:not([hidden]) button, #panel .plate')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').filter(e=>{const r=e.getBoundingClientRect();return e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(e=>({text:e.textContent.slice(0,60),size:[e.scrollHeight,e.clientHeight,e.scrollWidth,e.clientWidth]})));
 if(bad.length) await p.screenshot({path:join(output,'overflow.png')}); assert.deepEqual(bad,[]);
}
try{
 for(const [name,launcher] of Object.entries({chromium,webkit})){
  const browser=await launcher.launch(name==='chromium'?launchOptions():{});
  try{for(const [width,height,three] of name==='chromium'?[[1440,900,false],[375,812,false],[1024,700,false],[1440,900,true],[375,812,true]]:[[1440,900,false],[375,812,false]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:width===375,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
   if(width===1024)await page.addInitScript(()=>localStorage.setItem('front_of_house_theme','dark'));
   const errors=trackPageFailures(page,new URL(url).origin);
   await page.goto(url+`?renderer=${three?'3d':'2d'}`);await page.waitForFunction(()=>window.__frontOfHouse);
   await page.evaluate(c=>__frontOfHouse.importCode(c),code);if(three)await page.waitForFunction(()=>__frontOfHouse.rendererStatus().active);
   await page.locator('#panel [data-act="development"]').click();await fit(page);
   await page.locator('[data-act="research-enable"]').click();await fit(page);
   const cash=(await state(page)).cash;
   await page.locator('[data-command="start"][data-project="patch"]').click();assert.equal((await state(page)).cash,cash-120);
   await page.locator('[data-command="pause"]').click();await page.locator('[data-command="resume"]').click();
   await page.locator('[data-command="cancel"]').click();assert.equal((await state(page)).cash,cash);
   await page.locator('[data-command="start"][data-project="patch"]').click();
   for(const name of ['Patch','Service','Admission','Ledger']){await page.locator(`#win [data-tab-name="${name}"]`).click();await fit(page);}
   await page.locator('#win [data-tab-name="Patch"]').click();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#win [data-tab-name="Service"]').getAttribute('aria-selected'),'true');
   await page.screenshot({path:join(output,`${name}-${width}-${three?'3d':'classic'}-development.png`)});
   await page.reload();await page.waitForFunction(()=>window.__frontOfHouse);assert.equal((await state(page)).cash,cash-120);
   assert.equal((await view(page)).development.active,'patch');
   await page.locator('[data-act="next"]').click();await page.locator('[data-deal="door"]:not([disabled]):visible').first().click();
   await tab(page,'Actions');await page.locator('[data-act="starter"]').click();await page.locator('[data-act="confirm-build"]').click();
   await page.locator('#live-settings').click();await page.locator('#live-services').check();await page.locator('#win [data-win="close"]').first().click();await page.locator('#confirm-promo').click();
   await page.locator('#menu-btn').click();await page.locator('#menu [data-act="development"]').click();
   assert.equal(await page.locator('#win [data-command]:enabled').count(),0);await fit(page);await page.locator('#win [data-win="close"]').first().click();
   await tab(page,'Controls');await page.locator('[data-act="live-next"]').click();await page.locator('[data-act="respond"]:not([disabled]):visible').first().click();
   await tab(page,'Controls');await page.locator('[data-act="live-next"]').click();await page.locator('[data-act="live-next"]').click();
   const ended=await state(page),receipt=settlementFor(ended);
   await page.locator('[data-act="accept"]').click();assert.equal((await state(page)).cash,ended.cash+settlementPayout(receipt,ended.booking.deal));
   assert.deepEqual((await view(page)).development.learned,['patch']);assert.deepEqual((await view(page)).development.booked,[]);
   await page.locator('#panel [data-act="development"]').click();await page.locator('#win [data-tab-name="Service"]').click();
   const before=(await state(page)).cash;await page.locator('[data-command="start"][data-project="service"]').click();assert.equal((await state(page)).cash,before-180);
   await page.locator('[data-command="cancel"][data-project="service"]').click();assert.equal((await state(page)).cash,before);
   await page.locator('#win [data-tab-name="Ledger"]').click();assert.match(await page.locator('#win-body').innerText(),/Recorded for this night/);await fit(page);
   await page.locator('#win [data-win="close"]').first().click();await page.locator('[data-act="next"]').click();await page.locator('[data-deal="door"]:not([disabled]):visible').first().click();
   assert.deepEqual((await view(page)).development.booked,['patch']);
   await page.reload();await page.waitForFunction(()=>window.__frontOfHouse);assert.deepEqual((await view(page)).development.booked,['patch']);assert.deepEqual(errors,[]);
   await context.close();console.log(`  ok development ${name} ${width} ${three?'3d':'classic'}: projects, cash, reload, signed progress and next booking`);
  }}finally{await browser.close();}
 }
}finally{await server.close();}
console.log(`Research: seven complete player journeys passed. Screenshots: ${output}`);
