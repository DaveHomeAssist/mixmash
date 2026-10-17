// Pavilion broadcast and skippable camera pass acceptance.
import { createRequire } from "node:module";
import { startStaticServer } from "./static-server.mjs";
const require=createRequire(import.meta.url);
const server=process.env.HORSESHOES_BASE_URL?null:await startStaticServer();
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.HORSESHOES_BASE_URL||`${server.origin}/horseshoes/`;
const output=process.env.HORSESHOES_OUTPUT||'/tmp/horseshoes-broadcast';fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});const results=[];
try{for(const [width,height,touch] of [[1440,900,false],[375,812,true],[667,375,true],[3440,1440,false]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});context.setDefaultTimeout(30000);const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__horseshoes?.getState().environment==='fmp-lawn');
 await page.evaluate(()=>__horseshoes.stop());const state=()=>page.evaluate(()=>__horseshoes.getState());
 await page.locator('#mode').selectOption('match');await page.locator('#menu-resume').click();
 assert.equal((await state()).tour.active,true);assert.equal((await state()).broadcast.screens,4);
 await page.evaluate(()=>advanceTime(1000));await page.screenshot({path:`${output}/${width}-intro.png`});
 assert.equal((await state()).match.delivered,0);
 await page.locator('#skip-tour').click();assert.equal((await state()).tour.active,false);
 await page.locator('#throw-button').click();
 for(let i=0;i<140 && (await state()).shoe.status==='flying';i++)await page.evaluate(()=>advanceTime(100));
 const settled=await state();assert.equal(settled.match.delivered,1);assert.equal(settled.broadcast.available,true);assert.equal(settled.replay.active,false);
 const pose=settled.cameraPose;await page.evaluate(()=>advanceTime(150));const a=await state();
 await page.screenshot({path:`${output}/${width}-broadcast.png`});
 assert.ok(a.broadcast.time>settled.broadcast.time);assert.deepEqual(a.cameraPose,pose);
 await page.locator('#throw-button').click();assert.equal((await state()).match.delivered,2);assert.equal((await state()).shoe.status,'flying');
 await page.locator('#settings-tab').click();const paused=await state();await page.evaluate(()=>advanceTime(1000));assert.deepEqual((await state()).broadcast,paused.broadcast);
 await page.locator('#menu-resume').click();await page.evaluate(()=>advanceTime(14000));
 await page.locator('#replay-last').click();await page.evaluate(()=>advanceTime(200));assert.equal((await state()).replay.active,true);await page.locator('#replay-exit').click();
 if(width===1440){
  for(let i=0;i<2;i++){await page.locator('#throw-button').click();await page.evaluate(()=>advanceTime(14000));}
  const oldEnd=(await state()).broadcast.end;await page.locator('#next-button').click();assert.notEqual((await state()).match.end,oldEnd);assert.equal((await state()).broadcast.end,oldEnd);
  await page.locator('#throw-button').click();await page.evaluate(()=>advanceTime(14000));assert.equal((await state()).broadcast.end,(await state()).match.end);
 }

 await page.locator('#settings-tab').click();await page.locator('#tour-button').click();await page.evaluate(()=>advanceTime(6200));assert.equal((await state()).tour.active,false);assert.equal((await state()).camera,'pitching');
 await page.locator('#settings-tab').click();await page.locator('#monitors-button').click();await page.screenshot({path:`${output}/${width}-screen-close.png`});await page.locator("#camera-button").click();assert.equal((await state()).camera,"pitching");
 await page.locator('#settings-tab').click();await page.locator('#tour-button').click();
 await page.locator('#horseshoe-stage canvas').click({position:{x:60,y:60}});assert.equal((await state()).tour.active,false);
 await page.locator('#settings-tab').click();await page.locator('#tour-button').click();await page.keyboard.press('Escape');assert.equal((await state()).tour.active,false);
 await page.locator('#settings-tab').click();await page.locator('#restart-button').click();assert.equal((await state()).broadcast.available,false);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);results.push({width,height,touch,screens:4,concurrentThrow:true,tour:true,errors});await context.close();
}
const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>window.__horseshoes);await page.locator('#menu-resume').click();assert.equal((await page.evaluate(()=>__horseshoes.getState())).tour.active,false);await context.close();
const delayed=await browser.newContext();delayed.setDefaultTimeout(30000);const slow=await delayed.newPage();let release;
await slow.route('**/fmp-venue*.json',async route=>{await new Promise(resolve=>{release=resolve;});await route.continue();});
await slow.goto(url,{waitUntil:'domcontentloaded'});await slow.waitForFunction(()=>window.__horseshoes);
await slow.locator('#monitors-button').click();const before=await slow.evaluate(()=>__horseshoes.getState());assert.equal(before.broadcast.screens,0);assert.equal(before.camera,'monitors');release();
await slow.waitForFunction(()=>__horseshoes.getState().broadcast.screens===4);const after=await slow.evaluate(()=>__horseshoes.getState());assert.notDeepEqual(after.cameraPose,before.cameraPose);await delayed.close();
fs.writeFileSync(`${output}/report.json`,JSON.stringify({url,results,reducedMotion:true},null,2));console.log(JSON.stringify(results));}finally{await browser.close();await server?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
