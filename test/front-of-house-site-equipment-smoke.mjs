// Stage/site model cards are inert, responsive and reachable by keyboard; saves remain exact.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {startStaticServer,launchOptions,trackPageFailures} from './static-server.mjs';
import {createGame,applyAction,settlementFor} from '../front-of-house/engine.mjs';
import {STARTER_LAYOUT,SAVE_NAMESPACE,SCHEMA_VERSION} from '../front-of-house/data.mjs';
import {SITE_CARD_TYPES,equipmentCardInfo} from '../front-of-house/equipment-cards.mjs';
const output=process.env.FOH_SITE_OUTPUT || 'qa-site-equipment';await mkdir(output,{recursive:true});
const server=await startStaticServer(),origin=process.env.FRONT_OF_HOUSE_BASE_URL || server.origin+'/front-of-house/';
let state=createGame(3);state.mode='sandbox';for(const action of [{type:'chooseDeal',deal:'guarantee'},{type:'setLayout',objects:STARTER_LAYOUT}]){const r=applyAction(state,action);assert.equal(r.error,null);state=r.state;}
const code=Buffer.from(JSON.stringify({ns:SAVE_NAMESPACE,v:SCHEMA_VERSION,savedAt:0,state})).toString('base64');
async function fit(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const bad=await page.evaluate(()=>[document.documentElement,document.querySelector('#win-body'),...document.querySelectorAll('#win button,#win select')].filter(e=>e.getClientRects().length).filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1).map(e=>({text:e.textContent.slice(0,55),width:[e.scrollWidth,e.clientWidth],height:[e.scrollHeight,e.clientHeight]})));assert.deepEqual(bad,[]);}
async function pages(page){for(let i=0;i<20;i++){await fit(page);const next=page.locator('#win-foot [data-step="1"]');if(!await next.count()||!await next.isEnabled())return;await next.click();}assert.fail('Paginator did not finish');}
try {for(const [name,launcher] of Object.entries({chromium,webkit})){
 const browser=await launcher.launch(name==='chromium'?launchOptions():{});
 try{for(const theme of ['light','dark'])for(const [width,height]of name==='chromium'?[[1440,900],[375,812],[360,800],[1024,700],[844,390],[320,256],[3840,1080]]:[[1440,900],[375,812]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=trackPageFailures(page,new URL(origin).origin);
  await page.addInitScript(t=>localStorage.setItem('front_of_house_theme',t),theme);await page.goto(origin+'?renderer=3d');await page.waitForFunction(()=>window.__frontOfHouse);assert.equal(await page.evaluate(c=>__frontOfHouse.importCode(c),code),true);
  const before=await page.evaluate(()=>__frontOfHouse.state()),receipt=settlementFor(before);
  await page.locator('#menu-btn').click();await page.locator('#menu [data-act="site-equipment-open"]').click();
  for(const type of SITE_CARD_TYPES){
   const back=page.locator('#win-foot [data-step="-1"]');while(await back.count()&&await back.isEnabled())await back.click();
   await page.locator('[data-input="equipment-model"]').selectOption(type);
   assert.equal(await page.locator('[data-input="equipment-model"]').evaluate(e=>e===document.activeElement),true);
   const card=equipmentCardInfo(type),image=page.locator('#win .pa-equipment-card img');await image.evaluate(i=>i.decode());assert.equal(await image.evaluate(i=>i.naturalWidth),640);
   assert.match(await page.locator('#win-body').textContent(),new RegExp(card.label));await pages(page);
   assert.deepEqual(await page.evaluate(()=>__frontOfHouse.state()),before);assert.deepEqual(settlementFor(await page.evaluate(()=>__frontOfHouse.state())),receipt);
   if(name==='chromium'&&height>700&&['stage','bar-tent','bus-compound'].includes(type))await page.screenshot({path:`${output}/${type}-${theme}-${width}.png`});
  }
  await page.keyboard.press('Escape');assert.equal(await page.locator('#menu-btn').evaluate(e=>e===document.activeElement),true);
  if(name==='chromium'&&width===1440&&theme==='light'){
   await page.waitForFunction(()=>__frontOfHouse.rendererStatus().active);
   await page.evaluate(()=>__frontOfHouse.boardCamera({yaw:0,pitch:90,zoom:3,x:12,y:1.5}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const p=await page.evaluate(()=>__frontOfHouse.boardClientOf(12,1.5,.55));await page.mouse.click(p.x,p.y);assert.equal(await page.locator('#win-title').innerText(),'Stage');await page.locator('#win img').evaluate(i=>i.decode());await page.screenshot({path:`${output}/stage-inspection.png`});await page.keyboard.press('Escape');
  }
  await page.reload();await page.waitForFunction(()=>window.__frontOfHouse);assert.deepEqual(await page.evaluate(()=>__frontOfHouse.state()),before);assert.deepEqual(errors,[]);await context.close();console.log(`${name} ${theme} ${width}x${height}: twelve cards, paging, focus and exact save/receipt pass`);
 }}finally{await browser.close();}
}}finally{await server.close();}
