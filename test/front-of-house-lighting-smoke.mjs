// Lighting previews and inspection preserve state across themes, layouts and reload.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startStaticServer,launchOptions,trackPageFailures} from './static-server.mjs';
import {createGame,applyAction} from '../front-of-house/engine.mjs';
import {STARTER_LAYOUT,VENUES,SAVE_NAMESPACE,SCHEMA_VERSION} from '../front-of-house/data.mjs';
const output=process.env.FOH_LIGHTING_OUTPUT || 'qa-lighting';
await mkdir(output,{recursive:true});
const server=await startStaticServer(),browser=await chromium.launch(launchOptions());
const origin=process.env.FRONT_OF_HOUSE_BASE_URL || server.origin+'/front-of-house/';
const act=(s,a)=>{const r=applyAction(s,a);assert.equal(r.error,null);return r.state;};
const code=s=>Buffer.from(JSON.stringify({ns:SAVE_NAMESPACE,v:SCHEMA_VERSION,savedAt:0,state:s})).toString('base64');
try {
 for(const theme of ['light','dark']) for(const [width,height] of [[1440,900],[375,812],[360,800],[1024,700]]) {
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
  const errors=trackPageFailures(page,new URL(origin).origin);
  await page.addInitScript(t=>localStorage.setItem('front_of_house_theme',t),theme);
  await page.goto(origin+'?renderer=3d');await page.waitForFunction(()=>window.__frontOfHouse?.rendererStatus().active);
  let state=createGame(3);state.mode='sandbox';
  if(theme==='dark')state=act(state,{type:'enableEquipment'});
  const house=theme==='dark'&&width===1440;
  if(house)state=act(state,{type:'chooseVenue',venueId:'club'});
  state=act(state,{type:'chooseDeal',deal:'guarantee',...(house?{roomPolicy:1,artistId:VENUES.club.defaultArtist}:{})});state=act(state,{type:'setLayout',objects:house?VENUES.club.starter:STARTER_LAYOUT});
  assert.equal(await page.evaluate(c=>__frontOfHouse.importCode(c),code(state)),true);
  const before=await page.evaluate(()=>__frontOfHouse.state());
  await page.locator('#menu-btn').click();await page.locator('#menu [data-act="equipment-open"]').click();
  if(theme==='dark'){await page.locator('#win [data-tab-name="Deploy"]').click();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#win [data-tab-name="Lights"]').getAttribute('aria-selected'),'true');}
  else await page.locator('#win [data-tab-name="Lights"]').click();
  if(house){assert.match(await page.locator('#win-body').innerText(),/House lights \+ tower placed/);assert.match(await page.locator('#win-body').innerText(),/no extra quality bonus/);}
  const image=page.locator('#win .pa-equipment-card:visible img');await image.evaluate(i=>i.decode());
  assert.equal(await image.evaluate(i=>i.naturalWidth),640);
  assert.match(await page.locator('#win').innerText(),/8 kW/);assert.match(await page.locator('#win').innerText(),/\$175/);
  const fits=await page.evaluate(()=>[document.documentElement,document.querySelector('#win .win-body'),...document.querySelectorAll('#win .tabbar button')].every(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1));assert.ok(fits,`${theme} ${width} fits`);
  await page.screenshot({path:`${output}/lighting-${theme}-${width}.png`});
  if(house)for(const [w,h] of [[844,390],[320,256],[3840,1080]]) {
   await page.setViewportSize({width:w,height:h});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   for(let part=0;part<20;part++) {
    const fit=await page.evaluate(()=>[document.documentElement,document.querySelector('#win .win-body'),...document.querySelectorAll('#win .tabbar button')].every(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1));assert.ok(fit,`Lighting page/buttons fit ${w}x${h}`);
    assert.ok(await page.locator('#win .tabbar button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44)));
    const next=page.locator('#win-foot [data-step="1"]');if(!await next.count()||!await next.isEnabled())break;assert.ok(part<19);await next.click();
   }
  }
  assert.deepEqual(await page.evaluate(()=>__frontOfHouse.state()),before);
  await page.locator('#win [data-win="close"]').first().click();
  assert.ok(await page.locator('#menu-btn').evaluate(e=>e===document.activeElement),'Equipment close restores visible menu focus');
  if(width===1440&&theme==='light') {
   const tower=state.venue.objects.find(o=>o.type==='lights');
   await page.evaluate(o=>__frontOfHouse.boardCamera({yaw:25,pitch:38,zoom:3,x:o.x,y:o.y}),tower);
   await page.screenshot({path:`${output}/lighting-gameplay.png`});
   await page.evaluate(o=>__frontOfHouse.boardCamera({yaw:0,pitch:90,zoom:3,x:o.x,y:o.y}),tower);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const point=await page.evaluate(o=>__frontOfHouse.boardClientOf(o.x+.5,o.y+.5,2.83),tower);
   await page.mouse.click(point.x,point.y);assert.equal(await page.locator('#win-title').innerText(),'Light tower');
   for(const [w,h] of [[1440,900],[375,812],[844,390],[320,256]]) {
    await page.setViewportSize({width:w,height:h});assert.ok(await page.locator('#win .win-body').evaluate(e=>e.scrollHeight<=e.clientHeight+1&&e.scrollWidth<=e.clientWidth+1),`inspection ${w}`);
    await page.screenshot({path:`${output}/lighting-inspection-${w}.png`});
   }
  }
  await page.reload();await page.waitForFunction(()=>window.__frontOfHouse?.rendererStatus().active);
  assert.deepEqual(await page.evaluate(()=>__frontOfHouse.state()),before);assert.deepEqual(errors,[]);
  await context.close();console.log(`Lighting ${theme} ${width}: preview, facts, fit, state and reload passed`);
 }
} finally {await browser.close();await server.close();}
