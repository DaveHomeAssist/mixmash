#!/usr/bin/env node
// Deterministic ordinary-career acceptance across all four rooms. No hidden-draw planning.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as E from '../engine.mjs';
import * as D from '../data.mjs';
import {REFERENCE_LAYOUT,BUDGET_LAYOUT,REFERENCE_ADS} from './reference.mjs';

const SEEDS=100, LIMITS={lot:12,club:20,amphitheater:12,festival:8};
const NEXT={lot:'club',club:'amphitheater',amphitheater:'festival',festival:'complete'};
const score=r=>r.net+(r.satisfaction>=D.PASS_SATISFACTION?0:-1e6);
const step=(s,a)=>{
 const r=E.applyAction(s,a);assert.equal(r.error,null,`${s.venue.id}/${s.phase}/${a.type}: ${r.error}`);
 if(r.state.cashJournal)assert.equal(E.careerLedgerFor(r.state).balance,r.state.cash);
 return r.state;
};
function layouts(room,careful){
 if(room==='lot')return careful?[REFERENCE_LAYOUT,BUDGET_LAYOUT]:[REFERENCE_LAYOUT];
 const base=D.VENUES[room].starter.filter(o=>room!=='club'||o.type!=='lights');
 return [room==='festival'&&careful?[...base,{type:'delay',x:8,y:16,rot:0},{type:'delay',x:30,y:16,rot:0}]:base];
}
function candidates(s,careful,hold){
 const room=s.venue.id,options=[];
 for(const artistId of E.offersFor(s)){
  const terms=E.termsFor(artistId,s.reputation.artists[artistId]),artist=D.ARTISTS[artistId];
  const deals=terms.doorOk?['door','guarantee']:['guarantee'];if(room==='festival')deals.push('sponsor');
  for(const deal of deals)for(const objects of layouts(room,careful)){
   const secondId=room==='festival'?E.stageOpenersFor(s).find(id=>id!==artistId):undefined;
   if(room==='festival'&&!secondId)continue;
   const action={type:'chooseDeal',artistId,deal,secondId,nights:hold,
    ...(room!=='lot'?{roomPolicy:1}:{}),...(room==='amphitheater'?{seatingPolicy:1,curfewPolicy:1,...(hold>1?{runPolicy:1}:{})}:{}),
    ...(room==='festival'?{stagePolicy:1,festivalPolicy:1,curfewPolicy:1}:{})};
   const booked=E.applyAction(s,action);if(booked.error)continue;
   let p=step(booked.state,{type:'setLayout',objects});p=step(p,{type:'confirmBuild'});
   p=step(p,{type:'setPromotion',price:artist.fairPrice,ads:REFERENCE_ADS,
    ...(room==='club'?{ticketing:{version:1,plan:careful?'platform':'direct'}}:{}),
    ...(room==='amphitheater'?{seatPrice:artist.fairPrice+10}:{})});
   const upfront=E.upfrontFor(p);if(upfront>s.cash)continue;
   // Planning uses the public middle draw and authored room rules, never rollShow/showPreview.
   const expected=E.evaluateShow({venue:E.evaluateVenue(p.venue),deal,artistId,price:artist.fairPrice,ads:REFERENCE_ADS,
    venueRep:s.reputation.venue,draw:(artist.drawMin+artist.drawMax)/2,ask:terms.ask,drawMult:terms.drawMult,incidentId:null,responseId:null});
   options.push({state:p,score:score(expected),upfront});
   if(!careful)return options;
  }
 }
 return options.sort((a,b)=>b.score-a.score);
}
function respond(s,careful){
 const options=D.INCIDENTS[s.show.incidentId].responses.filter(r=>r.cost<=s.cash).map(r=>({id:r.id,value:score(E.settlementFor(step(s,{type:'respond',responseId:r.id})))}));
 assert.ok(options.length);if(careful)options.sort((a,b)=>b.value-a.value);
 return step(s,{type:'respond',responseId:options[0].id});
}
function sign(s,careful,cancel=false){
 const paidCash=s.cash,ended=respond(s,careful),receipt=E.settlementFor(ended),run=E.heldRunFor(ended);
 assert.deepEqual(E.settlementFor(E.normalizeState(ended)),receipt,'reloaded receipt');
 const penalty=cancel&&run?.remaining?run.penalty:0;
 const nextOpening=!cancel&&run?.remaining?E.upfrontFor(ended):0;
 const done=step(ended,{type:'acceptSettlement',...(cancel?{cancelRemaining:true}:{})});
 assert.equal(done.cash,ended.cash+E.settlementPayout(receipt,ended.booking.deal)-penalty-nextOpening,'signing conservation');
 assert.equal(done.history.at(-1).cashAfter,done.cash+nextOpening,'history before the next opening');
 assert.equal(paidCash-ended.cash,receipt.costs.incident,'response charged once');
 if(receipt.stageAccounts){assert.equal(receipt.stageAccounts.net,receipt.net);assert.equal(receipt.stageAccounts.main.attendance+receipt.stageAccounts.second.attendance,receipt.attendance);}
 if(nextOpening){assert.deepEqual(done.reputation,s.reputation,'held reputation waits until the last night');assert.equal(done.phase,'show');}
 return {state:done,receipt,penalty};
}
function cancellationProbe(promo,careful){
 const paid=step(promo,{type:'confirmPromotion'}),ended=respond(paid,careful),run=E.heldRunFor(ended);assert.ok(run.remaining>0);
 const receipt=E.settlementFor(ended),done=step(ended,{type:'acceptSettlement',cancelRemaining:true});
 assert.equal(done.phase,'done');assert.equal(done.cash,ended.cash+E.settlementPayout(receipt,ended.booking.deal)-run.penalty);
 assert.equal(done.history.at(-1).runCancellation.completed,1);assert.deepEqual(E.normalizeState(done).history,done.history);
 return run.penalty;
}
export function runTierCareer(seed,careful=true){
 let s=E.createGame(seed);const report={seed,style:careful?'careful':'careless',tiers:{},cancellations:0,nights:0,continued:false};
 for(const room of ['lot','club','amphitheater','festival']){
  const activeCareful=room==='lot'||careful;
  if(room!=='lot'){s=step(s,{type:'nextShow'});const carry={cash:s.cash,reputation:s.reputation,history:s.history};s=step(s,{type:'chooseVenue',venueId:room});assert.deepEqual({cash:s.cash,reputation:s.reputation,history:s.history},carry);}
  let holds=0,nights=0,bankrupt=false;
  for(;holds<LIMITS[room];holds++){
   const hold=room==='amphitheater'?1+(holds%3):1,choice=candidates(s,activeCareful,hold)[0];
   if(!choice){bankrupt=true;break;}
   s=choice.state;if(room==='amphitheater'&&hold>1){cancellationProbe(s,activeCareful);report.cancellations++;}
   const before=s.cash;s=step(s,{type:'confirmPromotion'});assert.equal(before-s.cash,choice.upfront,'opening charged once');
   for(let night=0;night<hold;night++){
    const run=E.heldRunFor(s),remaining=run?.remaining||0;
    // If a held continuation cannot be funded, explicitly exercise its cancellation path.
    const ended=respond(s,activeCareful),receipt=E.settlementFor(ended),signing=ended.cash+E.settlementPayout(receipt,ended.booking.deal);
    const cancel=remaining>0&&E.upfrontFor(ended)>signing;
    const result=sign(s,activeCareful,cancel);s=result.state;nights++;report.nights++;if(cancel)break;
   }
   if(!s.equipment)s=step(s,{type:'enableEquipment'});
   if(s.unlocks[NEXT[room]]&&(room!=='club'||nights>=5)&&(room!=='amphitheater'||holds>=2)){holds++;break;}
   if(s.cash<E.nextShowCost(s)){bankrupt=true;holds++;break;}
   s=step(s,{type:'nextShow'});
  }
  report.tiers[room]={reached:!!s.unlocks[NEXT[room]],holds,nights,cash:s.cash,reputation:s.reputation.venue,bankrupt};
  if(!s.unlocks[NEXT[room]])return report;
  if(s.phase!=='done')throw Error('Tier progression must finish a show');
 }
 s=step(s,{type:'nextShow'});assert.equal(s.venue.id,'festival');assert.equal(s.unlocks.complete,true);
 const choice=candidates(s,careful,1)[0];assert.ok(choice,'completed career remains bookable');s=step(choice.state,{type:'confirmPromotion'});s=sign(s,careful).state;
 assert.equal(s.phase,'done');report.continued=true;return report;
}

export function tierReport(count=SEEDS){
 const rows=[];for(const careful of [true,false])for(let seed=1;seed<=count;seed++)rows.push(runTierCareer(seed,careful));
 const stats=Object.fromEntries(['careful','careless'].map(style=>[style,Object.fromEntries(Object.keys(LIMITS).map(room=>{
  const cohort=rows.filter(r=>r.style===style),reached=cohort.filter(r=>r.tiers[room]?.reached),attempted=cohort.filter(r=>r.tiers[room]);
  return [room,{reached:reached.length,attempted:attempted.length,total:count,failedSeeds:cohort.filter(r=>!r.tiers[room]?.reached).map(r=>r.seed)}];
 }))]));
 const checks=Object.keys(LIMITS).map(room=>({name:`Careful ${room} progression`,pass:stats.careful[room].reached/count>=.9}));
 checks.push({name:'Careless Club progression among reached Club careers is not universal',pass:stats.careless.club.attempted>0&&stats.careless.club.reached<stats.careless.club.attempted});
 checks.push({name:'Every reached Club cohort plays at least five carried shows',pass:rows.every(r=>!r.tiers.club?.reached||r.tiers.club.nights>=5)});
 checks.push({name:'Careful completed careers can settle another Festival day',pass:rows.filter(r=>r.style==='careful'&&r.tiers.festival?.reached).every(r=>r.continued)});
 return {seeds:count,limits:LIMITS,stats,checks,rows};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const count=Number(process.env.FOH_TIER_SEEDS||SEEDS);assert.ok(Number.isInteger(count)&&count>0&&count<=SEEDS);
 const result=tierReport(count),lines=['# Front of House tier career baseline','',`Generated from the real engine on ${count} fixed ordinary-career seeds per strategy. No injected cash, unlocks or relationships.`,
 '', 'Both strategies earn the Lot unlock with the same careful plan, so later-tier comparisons start from identical genuinely earned cash and reputation. The existing Lot report retains its separate careless control. Careful planning compares public middle draws and affordable deals, uses the platform at Club and two delay towers at Festival, then compares affordable responses to a visible incident. Careless planning takes the first affordable offer/deal and free response. Both use usual ticket prices, the documented layouts and $300 promotion. Each Amphitheater cohort cycles one, two and three-night holds; cancellation is checked on a separate copy, not used to improve the measured cohort.',
 '', 'This validates the current mechanics. Festival VIP/bus infrastructure, human play, final art and physical-device acceptance remain separate. The existing Lot baseline is unchanged.',
 '', '| Strategy | Room | Reached | Attempted | Failed seeds |','| --- | --- | --- | --- | --- |'];
 for(const[style,rooms]of Object.entries(result.stats))for(const[room,r]of Object.entries(rooms))lines.push(`| ${style} | ${room} | ${r.reached}/${count} | ${r.attempted} | ${r.failedSeeds.join(', ')||'None'} |`);
 lines.push('','## Verdicts','');for(const check of result.checks)lines.push(`- ${check.pass?'PASS':'FAIL'}: ${check.name}`);
 const output=process.env.FOH_TIER_OUTPUT||fileURLToPath(new URL('../docs/TIER_BASELINE.md',import.meta.url));writeFileSync(output,lines.join('\n')+'\n');
 console.log(JSON.stringify({seeds:count,stats:result.stats,checks:result.checks}));if(result.checks.some(c=>!c.pass))process.exitCode=1;
}
