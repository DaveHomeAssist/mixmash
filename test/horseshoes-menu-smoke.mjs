// FMP setting, menu pause/focus and color hierarchy browser acceptance.
import { createRequire } from 'node:module';
import { startStaticServer } from './static-server.mjs';
const require = createRequire(import.meta.url);
const server = process.env.HORSESHOES_BASE_URL ? null : await startStaticServer();
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.HORSESHOES_BASE_URL||`${server.origin}/horseshoes/`;
const output=process.env.HORSESHOES_OUTPUT||'/tmp/horseshoes-menu-smoke';fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});const results=[];
try{for(const [width,height,touch] of [[1440,900,false],[375,812,true],[667,375,true],[3440,1440,false]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__horseshoes?.getState().environment==='fmp-lawn');
 const state=()=>page.evaluate(()=>__horseshoes.getState());const press=id=>touch?page.locator(id).tap():page.locator(id).click();
 assert.equal((await state()).menu.open,true);
 await page.screenshot({path:`${output}/${width}-menu.png`});
 for(let i=0;i<18;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('#game-menu')));}
 await page.keyboard.press('Escape');assert.equal((await state()).menu.open,false);assert.equal((await state()).match.delivered,0);
 for(const theme of ['light','dark']){
  if(theme==='dark')await press('#theme-button');
  const layout=await page.evaluate(()=>{const ids=['#aim','#strength','#arc-buttons button[aria-pressed=true]','#style-buttons button[aria-pressed=true]','#throw-button'];return{colors:ids.map(id=>{const e=document.querySelector(id);return getComputedStyle(e)[e.tagName==='INPUT'?'accentColor':'backgroundColor'];}),fit:document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth};});
  assert.ok(layout.fit);assert.equal(new Set(layout.colors).size,4);
  await page.screenshot({path:`${output}/${width}-${theme}-court.png`});
 }
 await press('#throw-button');await press('#settings-tab');const paused=await state();await page.evaluate(()=>advanceTime(5000));
 assert.deepEqual((await state()).shoe,paused.shoe);assert.deepEqual((await state()).match,paused.match);
 await page.keyboard.press('Escape');await page.evaluate(()=>advanceTime(13000));assert.equal((await state()).match.delivered,1);
 await press('#replay-last');await press('#settings-tab');const replay=(await state()).replay;await page.evaluate(()=>advanceTime(2000));assert.deepEqual((await state()).replay,replay);
 await press('#menu-resume');await press('#replay-exit');
 await press('#settings-tab');const beforeChoice=await state();await page.locator('#mode').selectOption('solo');assert.deepEqual((await state()).match,beforeChoice.match);assert.equal((await state()).menu.open,true);await page.locator('#restart-button').click();assert.equal((await state()).mode,'horseshoes-solo');
 await page.evaluate(()=>__horseshoes.stop());await page.locator('#strength').fill('0');await page.locator('#strength').dispatchEvent('input');
 for(let i=0;i<2;i++){await press('#throw-button');await page.evaluate(()=>advanceTime(13000));}
 await press('#settings-tab');const aiPaused=await state();assert.equal(aiPaused.ai.busy,false);await page.waitForTimeout(250);await page.evaluate(()=>advanceTime(2000));assert.deepEqual((await state()).match,aiPaused.match);
 await press('#restart-button');assert.deepEqual((await state()).match.scores,[0,0]);assert.equal((await state()).match.delivered,0);assert.equal((await state()).menu.open,false);
 assert.deepEqual(errors,[]);results.push({width,height,touch,environment:'fmp-lawn',menuPause:true,focus:true,colors:true,errors});await context.close();
}fs.writeFileSync(`${output}/report.json`,JSON.stringify({url,results},null,2));console.log(JSON.stringify(results));}finally{await browser.close(); await server?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
