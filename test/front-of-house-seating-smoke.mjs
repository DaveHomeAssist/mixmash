// Independent seat/lawn prices, public forecasts and frozen receipts through real player controls.
import assert from 'node:assert/strict';import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {chromium,webkit} from 'playwright';import {startStaticServer,launchOptions,trackPageFailures} from './static-server.mjs';
import * as E from '../front-of-house/engine.mjs';import * as D from '../front-of-house/data.mjs';
const server=await startStaticServer(),url=process.env.FRONT_OF_HOUSE_BASE_URL||`${server.origin}/front-of-house/`,output=await mkdtemp(join(tmpdir(),'foh-seating-'));
const code=Buffer.from(JSON.stringify({ns:D.SAVE_NAMESPACE,v:D.SCHEMA_VERSION,state:E.createGame(3)})).toString('base64');
const state=p=>p.evaluate(()=>__frontOfHouse.state()),view=p=>p.evaluate(()=>JSON.parse(render_game_to_text()));
const tab=async(p,name)=>{const t=p.locator(`#panel [data-tab-name="${name}"]:visible`);if(await t.count())await t.click();};
async function fit(p,root='#win:not([hidden])'){const bad=await p.evaluate(root=>[document.documentElement,...document.querySelectorAll(`${root},${root} .win-body,${root} button`)].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(e=>({text:e.textContent.slice(0,90),size:[e.scrollHeight,e.clientHeight,e.scrollWidth,e.clientWidth]})),root);if(bad.length)await p.screenshot({path:join(output,'overflow.png')});assert.deepEqual(bad,[]);}
async function pages(p){for(const name of ['Seats','Lawn','Rules']){await p.locator(`#win [data-tab-name="${name}"]`).click();let part=0;for(;part<30;part++){await fit(p);const more=p.locator('#win-foot [data-step="1"]');if(!await more.count()||!await more.isEnabled())break;await more.click();}assert.ok(part<30);}}
const close=p=>p.locator('#win [data-win="close"]').click();
try{for(const[name,launcher]of Object.entries({chromium,webkit})){
 const browser=await launcher.launch(name==='chromium'?launchOptions():{});
 try{for(const[width,height,deal,nights,three=false]of [[1440,900,'guarantee',2],[375,812,'door',1],[1024,700,'guarantee',1],...(name==='chromium'?[[1440,900,'guarantee',2,true],[375,812,'door',1,true]]:[])]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width===375,reducedMotion:'reduce',serviceWorkers:'block'}),p=await context.newPage();if(width===1024)await p.addInitScript(()=>localStorage.setItem('front_of_house_theme','dark'));
  const errors=trackPageFailures(p,new URL(url).origin);await p.goto(url+(three?'?renderer=3d':''));await p.waitForFunction(()=>window.__frontOfHouse);assert.equal(await p.evaluate(c=>__frontOfHouse.importCode(c),code),true);
  for(const sel of ['#menu-btn','#menu [data-mode="sandbox"]','[data-venue="amphitheater"]',`[data-nights="${nights}"]`])await p.locator(sel).first().click();
  if(three)await p.waitForFunction(()=>__frontOfHouse.rendererStatus().active&&__frontOfHouse.board().venue==='amphitheater');
  await fit(p,'#panel');assert.match(await p.locator('#panel').innerText(),/Seats and lawn sell separately/);await p.locator(`[data-deal="${deal}"]:not([disabled]):visible`).first().click();
  await tab(p,'Actions');await p.locator('[data-act="starter"]').click();await p.locator('[data-act="confirm-build"]').click();const before=(await state(p)).cash,original=(await view(p)).seating.forecast;
  await tab(p,'Price and ads');await p.locator('#seat-price').press('End');
  const seatQuote=(await view(p)).seating.forecast;assert.ok(seatQuote.low.seats.demand<original.low.seats.demand);assert.deepEqual(seatQuote.low.lawn,original.low.lawn);await p.locator('#price').press('End');const quote=(await view(p)).seating.forecast;assert.ok((await p.locator('#promo-stats').textContent()).includes(quote.low.ticketGross.toLocaleString('en-US')));assert.ok(quote.low.lawn.demand<seatQuote.low.lawn.demand);assert.deepEqual(quote.low.seats,seatQuote.low.seats);assert.equal((await state(p)).cash,before);
  await p.locator('#seating-settings').click();await pages(p);await p.locator('#win [data-tab-name="Seats"]').click();await p.screenshot({path:join(output,`${name}-${width}-forecast.png`)});await close(p);
  await p.reload();await p.waitForFunction(()=>window.__frontOfHouse);assert.deepEqual((await view(p)).seating.forecast,quote);await tab(p,'Presales');assert.match(await p.locator('#presale-cap').textContent(),new RegExp(`${quote.low.presale} tickets`));
  await p.locator('#confirm-promo').click();assert.equal((await state(p)).show.seating.seatPrice,80);await tab(p,'Problem');await p.locator('[data-act="respond"]:not([disabled]):visible').first().click();
  const ended=await state(p),r=E.settlementFor(ended);if(await p.locator('#win [data-tab-name="Revenue"]').count())await p.locator('#win [data-tab-name="Revenue"]').click();await p.locator('#win [data-act="seating-open"]').click();await pages(p);await p.locator('#win [data-tab-name="Seats"]').click();await fit(p);assert.equal((await view(p)).seating.receipt.ticketGross,r.ticketGross);await p.screenshot({path:join(output,`${name}-${width}-receipt.png`)});
  await p.locator('#win [data-tab-name="Rules"]').click();await p.locator('[data-act="food-back"]').click();
  if(nights>1){await p.locator('#win [data-act="held-run-open"]').click();await p.locator('#win [data-tab-name="Cancel"]').click();await p.locator('[data-act="held-run-sign"][data-cancel="true"]').click();}else await p.locator('[data-act="accept"]').click();
  const done=await state(p);assert.equal(done.cash,ended.cash+E.settlementPayout(r,deal)-(nights>1?E.heldRunFor(ended).penalty:0));
  await p.reload();await p.waitForFunction(()=>window.__frontOfHouse);assert.equal((await state(p)).cash,done.cash);assert.deepEqual((await view(p)).seating.receipt,r.seating);
  if(name==='chromium'&&width===1440&&!three){for(const theme of ['light','dark']){if(theme==='dark'){await p.locator('#menu-btn').click();await p.locator('#theme-toggle').click();await p.locator('#menu-close').click();}await p.locator('#menu-btn').click();await p.locator('#seating-menu').click();for(const[w,h]of [[1440,900],[375,812],[844,390],[320,256],[3840,1080]]){await p.setViewportSize({width:w,height:h});await pages(p);}await close(p);await p.setViewportSize({width,height});}}
  await p.locator('[data-act="next"]').click();assert.equal((await state(p)).booking.seating,undefined);assert.deepEqual(errors,[]);await context.close();console.log(`  ok seating ${name} ${width} ${three?'3D':'classic'} ${deal} ${nights} nights: prices, public forecast, frozen receipt and cash`);
 }}finally{await browser.close();}
}}finally{await server.close();}
console.log(`Seating: eight complete player journeys passed. Screenshots: ${output}`);
