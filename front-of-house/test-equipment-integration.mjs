// Owned equipment and the career journal reconcile every cash path without rewriting bookings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, normalizeState, equipmentFor, equipmentPlanFor, careerLedgerFor,
  settlementFor, settlementPayout, upfrontFor, liveEndMinute, liveServicesFor } from './engine.mjs';
import { VENUES, INCIDENTS, DOOR_SPLIT } from './data.mjs';
import { CAREER_LEDGER_ROWS, createCareerLedger, saveCareerLedger, appendCareerLedger } from './career-ledger.mjs';
const act=(s,a)=>{const r=applyAction(s,a);assert.equal(r.error,null,`${a.type}: ${r.error}`);if(r.state.cashJournal)assert.equal(careerLedgerFor(r.state).balance,r.state.cash);return r.state;};
const refuse=(s,a,match)=>{const before=structuredClone(s),r=applyAction(s,a);assert.match(r.error,match);assert.deepEqual(r.state,before);};
const capital=(s,command)=>act(s,{type:'equipment',command});
const buy=(s,id='buy_1')=>capital(s,{id,kind:'buy',family:'small-pa'});
const sell=(s,id='sell_1',assetId='pa_1')=>capital(s,{id,kind:'sell',assetId});
function build(s,{deal='door',nights=1}={}){
 s=act(s,{type:'chooseDeal',deal,nights});return act(s,{type:'setLayout',objects:VENUES[s.venue.id].starter.map(o=>o.type==='pa-m'?{...o,type:'pa-s'}:o)});
}
const open=(s,live=false)=>act(act(s,{type:'confirmBuild'}),{type:'confirmPromotion',...(live?{services:true,flow:1}:{})});
function finish(s,response){
 if(s.show.services)s=act(s,{type:'advanceLive',minute:240});
 s=act(s,{type:'respond',responseId:response||INCIDENTS[s.show.incidentId].responses[0].id});
 if(s.show.services){s=act(s,{type:'advanceLive',minute:240});s=act(s,{type:'advanceLive',minute:liveEndMinute(s)});}
 return s;
}
const sign=s=>act(s,{type:'acceptSettlement',at:'2026-10-04T00:00:00Z'});
function ready(cash=10000){
 const settled=sign(finish(open(build(createGame(3)))));
 // Controlled banked-career fixture: journal opens here and claims no earlier itemization.
 return act({...settled,cash},{type:'enableEquipment'});
}
const next=s=>act(s,{type:'nextShow'});
const assign=s=>act(s,{type:'assignEquipment',assetId:'pa_1'});

test('equipment opt-in opens at current cash and neither past layouts nor rentals grant assets',()=>{
 refuse(createGame(3),{type:'enableEquipment'},/first show/);
 let s=ready();assert.equal(careerLedgerFor(s).openingCash,10000);assert.equal(careerLedgerFor(s).entries.length,0);assert.deepEqual(equipmentFor(s).assets,[]);
 const old=createGame(3);assert.equal(normalizeState(old).equipment,undefined);assert.equal(normalizeState(old).cashJournal,undefined);
 const sandbox=act(createGame(3,{mode:'sandbox'}),{type:'enableEquipment'});assert.deepEqual(equipmentFor(sandbox).assets,[]);
 s=buy(s);assert.equal(s.cash,8800);assert.equal(careerLedgerFor(s).totals.acquisition,-1200);
 assert.deepEqual(buy(s),s,'same transaction retries without charging or adding rows');
 assert.deepEqual(normalizeState(s).equipment,s.equipment);assert.equal(normalizeState(s).cash,s.cash);
 s=sell(s);assert.equal(s.cash,9400);assert.deepEqual(sell(s),s);
 s=buy(s,'buy_2');assert.equal(equipmentFor(s).assets[0].id,'pa_2');assert.equal(s.cash,8200);
 refuse(ready(1199),{type:'equipment',command:{id:'b',kind:'buy',family:'small-pa'}},/cash/);
});

test('assignment is explicit, Build-only and cannot substitute a house or medium PA',()=>{
 let s=build(next(buy(ready())));assert.equal(equipmentPlanFor(s),null);
 refuse(s,{type:'equipment',command:{id:'s',kind:'sell',assetId:'pa_1'}},/between bookings/);
 s=assign(s);assert.equal(equipmentPlanFor(s).eligible,true);assert.equal(equipmentPlanFor(s).cost,20);
 s=act(s,{type:'assignEquipment',assetId:null});assert.equal(equipmentPlanFor(s),null);
 refuse(s,{type:'assignEquipment',assetId:'pa_99'},/owned asset/);
 const medium=act(s,{type:'setLayout',objects:s.venue.objects.map(o=>o.type==='pa-s'?{...o,type:'pa-m'}:o)});
 refuse(medium,{type:'assignEquipment',assetId:'pa_1'},/small PA/);
 let club=next(buy(ready()));club.unlocks.club=true;club=act(club,{type:'chooseVenue',venueId:'club'});club=build(club,{deal:'guarantee'});
 refuse(club,{type:'assignEquipment',assetId:'pa_1'},/small PA/);
 const assigned=assign(s),missing=act(assigned,{type:'setLayout',objects:assigned.venue.objects.filter(o=>o.type!=='pa-s')});
 assert.equal(equipmentPlanFor(missing).eligible,false);
 const promoted=act(assigned,{type:'confirmBuild'});refuse(promoted,{type:'assignEquipment',assetId:null},/build/);
});

test('both deals replace only the deployed rental and preserve receipts after sale',()=>{
 for(const deal of ['door','guarantee']){
  const base=build(next(buy(ready())),{deal}),owned=assign(base);
  assert.equal(upfrontFor(base)-upfrontFor(owned),180);
  const rentedEnd=finish(open(base)),ownedEnd=finish(open(owned)),a=settlementFor(rentedEnd),b=settlementFor(ownedEnd);
  assert.equal(a.costs.pa,200);assert.equal(b.costs.pa,0);assert.equal(b.costs.equipmentOperation,20);assert.equal(a.costs.total-b.costs.total,180);
  assert.equal(b.artistPay,deal==='door'?Math.round(DOOR_SPLIT*Math.max(0,b.ticketGross-b.costs.total)):a.artistPay);
  const signed=sign(ownedEnd);assert.equal(signed.cash,owned.cash+b.net);
  assert.equal(careerLedgerFor(signed).totals.acquisition,-1200);assert.equal(careerLedgerFor(signed).balance,signed.cash);
  const sold=sell(signed);assert.deepEqual(settlementFor(sold),b);assert.deepEqual(settlementFor(normalizeState(sold)),b);
  assert.equal(sold.cash,signed.cash+600);assert.equal(careerLedgerFor(sold).totals.disposal,600);
 }
});

test('research spending and refunds share the cash journal without entering show deductions',()=>{
 let s=act(ready(),{type:'enableResearch'});s=act(s,{type:'research',command:{kind:'start',project:'patch'}});
 assert.equal(s.cash,9880);assert.equal(careerLedgerFor(s).totals.development,-120);
 s=act(s,{type:'research',command:{kind:'pause',project:'patch'}});s=act(s,{type:'research',command:{kind:'cancel',project:'patch'}});
 assert.equal(s.cash,10000);assert.equal(careerLedgerFor(s).totals.developmentRefund,120);assert.equal(careerLedgerFor(s).entries.length,2);
 s=buy(s);const b=assign(build(next(s))),paid=open(b,true),ended=finish(paid),r=settlementFor(ended),done=sign(ended);
 assert.equal(careerLedgerFor(done).totals.showOpening,-upfrontFor(b));assert.equal(careerLedgerFor(done).totals.incident,0-r.costs.incident);
 assert.equal(careerLedgerFor(done).totals.settlement,settlementPayout(r,done.booking.deal));
 assert.deepEqual(liveServicesFor(normalizeState(done)),liveServicesFor(done));
 assert.equal(done.cash,b.cash+r.net);
});

test('paid incident responses record an expense once without changing capital or replaying it',()=>{
 let selected;
 for(let seed=1;seed<100;seed++){
  let s=act(createGame(seed,{mode:'sandbox'}),{type:'enableEquipment'});s=open(assign(build(buy(s))));
  if(s.show.incidentId==='pa-dropout'){selected=s;break;}
 }
 assert.ok(selected);const before=selected.cash,ended=finish(selected,'backup-amp');
 assert.equal(ended.cash,before-100);assert.equal(careerLedgerFor(ended).totals.incident,-100);
 refuse(ended,{type:'respond',responseId:'backup-amp'},/show/);
 assert.equal(normalizeState(ended).cash,ended.cash);assert.deepEqual(careerLedgerFor(normalizeState(ended)),careerLedgerFor(ended));
});

test('held nights record separate settlement and next-night opening, retaining owned terms',()=>{
 let s=next(buy(ready(100000)));s.unlocks.amphitheater=true;s=act(s,{type:'chooseVenue',venueId:'amphitheater'});
 s=build(s,{deal:'guarantee',nights:2});s=act(s,{type:'place',object:{type:'pa-s',x:10,y:0,rot:0}});s=open(assign(s));
 const marker=structuredClone(s.show.equipment);s=finish(s);const cash=s.cash,r=settlementFor(s),upfront=upfrontFor(s),count=careerLedgerFor(s).entries.length;
 s=sign(s);assert.equal(s.show.night,2);assert.deepEqual(s.show.equipment,marker);
 assert.equal(s.cash,cash+settlementPayout(r,'guarantee')-upfront);
 const events=careerLedgerFor(s).entries.slice(count);assert.deepEqual(events.map(e=>e.category),['settlement','showOpening']);assert.equal(events[0].cashDelta,settlementPayout(r,'guarantee'));assert.equal(events[1].cashDelta,-upfront);
 assert.equal(events[1].reference,`show_${s.seed}_2`);assert.deepEqual(normalizeState(s).show.equipment,marker);
 s=sign(finish(s));assert.equal(s.phase,'done');assert.equal(careerLedgerFor(s).balance,s.cash);
});

test('sponsor opening is recorded with its actual sign and never paid again at settlement',()=>{
 let s=act(createGame(3,{mode:'sandbox'}),{type:'enableEquipment'});s=act(s,{type:'chooseVenue',venueId:'festival'});
 s=build(s,{deal:'sponsor'});const cash=s.cash,upfront=upfrontFor(s);s=open(s);assert.equal(s.cash,cash-upfront);assert.equal(careerLedgerFor(s).totals.showOpening,-upfront);
 s=finish(s);const r=settlementFor(s);s=sign(s);assert.equal(careerLedgerFor(s).totals.settlement,settlementPayout(r,'sponsor'));assert.equal(s.cash,cash+r.net);
});

test('next-show carry, bounded journal compaction and explicit resets preserve the cash contract',()=>{
 let s=buy(ready());let journal=createCareerLedger(s.cash);
 for(let i=0;i<CAREER_LEDGER_ROWS+3;i++){const r=appendCareerLedger(journal,{sequence:journal.nextSequence,category:'incident',cashDelta:0,reference:'history'});assert.equal(r.error,null);journal=r.state;}
 s.cashJournal=saveCareerLedger(journal);s=sell(s);assert.equal(careerLedgerFor(s).entries.length,CAREER_LEDGER_ROWS);assert.equal(careerLedgerFor(s).archived.through,4);
 const fresh=next(s);assert.deepEqual(fresh.equipment,s.equipment);assert.deepEqual(fresh.cashJournal,s.cashJournal);
 const reset=act(s,{type:'retry'});assert.equal(reset.equipment,undefined);assert.equal(reset.cashJournal,undefined);
});

test('optional source corruption preserves cash and exposes incomplete recovery',()=>{
 const state=open(assign(build(next(buy(ready())))));
 for(const changes of [{equipment:{version:2}}, {cashJournal:{version:2}}, {cashJournal:{...state.cashJournal,openingCash:1}}, {booking:{...state.booking,equipment:{version:1,at:99999,assetId:'pa_1'}}}]){
  const restored=normalizeState({...state,...changes});assert.equal(restored.cash,state.cash);assert.match(restored.equipmentNotice,/preserved|incomplete/);assert.equal(careerLedgerFor(restored).balance,restored.cash);
 }
 const damaged=structuredClone(state);damaged.venue.objects=damaged.venue.objects.filter(o=>o.type!=='pa-s');
 const restored=normalizeState(damaged);assert.equal(equipmentPlanFor(restored).cost,20);assert.equal(equipmentPlanFor(restored).eligible,false);assert.equal(restored.cash,state.cash);
 const ended=finish(state),badJournal={...ended,cashJournal:{version:2}},done=sign(badJournal);assert.equal(done.cash,ended.cash+settlementPayout(settlementFor(ended),ended.booking.deal));assert.match(done.equipmentNotice,/incomplete/);assert.equal(careerLedgerFor(done).balance,done.cash);
});
