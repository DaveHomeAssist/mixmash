// Seeded outdoor curfew through actual booking, response, clock, receipt and signing controls.
import assert from 'node:assert/strict';import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {chromium,webkit} from 'playwright';import {startStaticServer,launchOptions,trackPageFailures} from './static-server.mjs';
import * as E from '../front-of-house/engine.mjs';import * as D from '../front-of-house/data.mjs';
const server=await startStaticServer(),url=process.env.FRONT_OF_HOUSE_BASE_URL||`${server.origin}/front-of-house/`,output=await mkdtemp(join(tmpdir(),'foh-curfew-'));
const act=(s,a)=>{const r=E.applyAction(s,a);assert.equal(r.error,null);return r.state;};
const state=p=>p.evaluate(()=>__frontOfHouse.state()),view=p=>p.evaluate(()=>JSON.parse(render_game_to_text()));
const close=p=>p.locator('#win [data-win="close"]').click();
const tab=async(p,name)=>{const t=p.locator(`#panel [data-tab-name="${name}"]:visible`);if(await t.count())await t.click();};
const clock=n=>`${String(19+Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
function fixture(room,deal){let s=act(E.createGame(1,{mode:'sandbox'}),{type:'enableEquipment'});s=act(s,{type:'chooseVenue',venueId:room});for(;s.seed<10000;s.seed++){const artist=E.offersFor(s)[0];if((deal!=='door'||E.termsFor(artist,s.reputation.artists[artist]).doorOk)&&E.incidentFor(s.seed,artist,s.venue)==='curfew')return s;}throw Error('No curfew fixture');}
async function fit(p,root='#win:not([hidden])'){const bad=await p.evaluate(root=>[document.documentElement,...document.querySelectorAll(`${root},${root} .win-body,${root} button`)].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(e=>({text:e.textContent.slice(0,80),size:[e.scrollHeight,e.clientHeight,e.scrollWidth,e.clientWidth]})),root);if(bad.length)await p.screenshot({path:join(output,'overflow.png')});assert.deepEqual(bad,[]);}
async function pages(p){let part=0;for(;part<30;part++){await fit(p);const next=p.locator('#win-foot [data-step="1"]');if(!await next.count()||!await next.isEnabled())break;await next.click();}assert.ok(part<30);}
try{for(const[name,launcher]of Object.entries({chromium,webkit})){
 const browser=await launcher.launch(name==='chromium'?launchOptions():{});
 try{for(const[width,height,room,deal,response]of [[1440,900,'amphitheater','guarantee','obey'],[375,812,'amphitheater','door','appeal'],[1024,700,'festival','sponsor','obey'],[375,812,'festival','guarantee','appeal']]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:width===1440?'no-preference':'reduce',serviceWorkers:'block'}),p=await context.newPage();const errors=trackPageFailures(p,new URL(url).origin);
  await p.goto(url);await p.waitForFunction(()=>window.__frontOfHouse);const before=fixture(room,deal),code=Buffer.from(JSON.stringify({ns:D.SAVE_NAMESPACE,v:D.SCHEMA_VERSION,state:before})).toString('base64');assert.equal(await p.evaluate(c=>__frontOfHouse.importCode(c),code),true);
  await p.locator('[data-act="deal-help"]').click();await p.locator('#win [data-tab-name="Curfew"]').click();await pages(p);assert.match(await p.locator('#win-body').innerText(),/five more minutes/);await close(p);
  await p.locator(`[data-deal="${deal}"]:visible:not([disabled])`).first().click();assert.equal((await state(p)).booking.curfew.version,1);
  await tab(p,'Actions');await p.locator('[data-act="starter"]').click();await p.locator('[data-act="confirm-build"]').click();await tab(p,'Doors');await p.locator('#confirm-promo').click();
  if(width===1440)await p.locator('#skip-btn').click();await p.locator(`[data-response="${response}"]`).waitFor({state:'visible'});const paid=await state(p),expected=E.setTimeFor(paid,response);assert.ok(expected.lost>0);assert.match(await p.locator(`[data-response="${response}"]`).innerText(),new RegExp(`Ends ${clock(expected.end)}`));
  await p.locator(`[data-response="${response}"]`).click();const ended=await state(p),r=E.settlementFor(ended);assert.deepEqual(r.setTime,expected);assert.equal(paid.cash-ended.cash,response==='appeal'?400:0);
  await p.waitForFunction(end=>Math.abs(JSON.parse(render_game_to_text()).playback.progress-end/240)<.001,expected.end);assert.match(await p.locator('.settlement-context').first().innerText(),new RegExp(`${clock(expected.end)} SET ENDED`));
  await p.locator('#win [data-act="set-time"]:visible').click();await pages(p);assert.match(await p.locator('#win-body').innerText(),new RegExp(`${expected.played} minutes`));await p.screenshot({path:join(output,`${name}-${width}-${room}-${response}.png`)});
  if(width===1440){await close(p);for(const theme of ['light','dark']){if(theme==='dark'){await p.locator('#menu-btn').click();await p.locator('#theme-toggle').click();await p.locator('#menu-close').click();}await p.locator('#open-settlement').click();for(const[w,h]of [[1440,900],[375,812],[1280,600],[320,256],[3840,1080]]){await p.setViewportSize({width:w,height:h});await p.locator('#win [data-act="set-time"]:visible').click();await pages(p);await p.locator('[data-act="food-back"]').click();}await close(p);await p.setViewportSize({width,height});}await p.locator('#open-settlement').click();}
  if(await p.locator('[data-act="food-back"]').count())await p.locator('[data-act="food-back"]').click();
  await p.locator('#win [data-act="accept"]').click();const done=await state(p);assert.equal(done.cash,before.cash+r.net);assert.equal(E.careerLedgerFor(done).balance,done.cash);
  await p.reload();await p.waitForFunction(()=>window.__frontOfHouse);assert.deepEqual(E.settlementFor(await state(p)),r);await p.locator('[data-act="last-sheet"]').click();await p.locator('#win [data-act="set-time"]:visible').click();await pages(p);assert.match(await p.locator('#win-body').innerText(),new RegExp(clock(expected.end)));assert.equal(await p.locator('#win [data-act="accept"]').count(),0);
  assert.deepEqual(errors,[]);await context.close();console.log(`ok curfew ${name} ${width} ${room} ${deal}/${response}: end ${clock(expected.end)}, ${expected.played} minutes, signed journal/reload`);
 }}finally{await browser.close();}
}console.log(`Curfew player smoke passed. Screenshots: ${output}`);}finally{await server.close();}
