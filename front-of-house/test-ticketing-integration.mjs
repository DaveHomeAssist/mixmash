// Club ticket collection reconciles frozen terms, artist contracts and career cash.
import test from 'node:test';import assert from 'node:assert/strict';
import * as E from './engine.mjs';import * as D from './data.mjs';
const terms={version:1,plan:'platform'};
const act=(s,a)=>{const r=E.applyAction(s,a);assert.equal(r.error,null,`${a.type}: ${r.error}`);if(r.state.cashJournal)assert.equal(E.careerLedgerFor(r.state).balance,r.state.cash);return r.state;};
function build(seed=3,deal='door'){
 let s=act(E.createGame(seed,{mode:'sandbox'}),{type:'enableEquipment'});s=act(s,{type:'chooseVenue',venueId:'club'});
 const artistId=E.offersFor(s).find(id=>E.termsFor(id,0).doorOk);assert.ok(artistId);
 s=act(s,{type:'chooseDeal',deal,artistId});s=act(s,{type:'setLayout',objects:D.VENUES.club.starter});return act(s,{type:'confirmBuild'});
}
const open=s=>act(s,{type:'confirmPromotion'});
const finish=s=>act(s,{type:'respond',responseId:D.INCIDENTS[s.show.incidentId].responses[0].id});
const sign=s=>act(s,{type:'acceptSettlement'});
const set=(s,t=terms)=>act(s,{type:'setPromotion',ticketing:t});
const withoutTicketing=r=>{const copy=structuredClone(r);delete copy.ticketing;return copy;};
function refuse(s,a,pattern){const before=structuredClone(s),r=E.applyAction(s,a);assert.match(r.error,pattern);assert.deepEqual(s,before);assert.deepEqual(r.state,before);}

test('legacy absence and explicit Direct preserve every original show number',()=>{
 for(const deal of ['door','guarantee'])for(const seed of [1,3,6,18]){
  const s=build(seed,deal),legacy=finish(open(s)),direct=finish(open(set(s,{version:1,plan:'direct'})));
  assert.equal(E.upfrontFor(s),E.upfrontFor(set(s)));assert.deepEqual(withoutTicketing(E.settlementFor(direct)),E.settlementFor(legacy));
  assert.equal(E.settlementFor(direct).ticketing.fee,0);assert.equal(sign(direct).cash,sign(legacy).cash);
  for(const state of [act(act(s,{type:'back'}),{type:'back'}),act(s,{type:'back'}),s,open(s),legacy,sign(legacy)]){const restored=E.normalizeState(state);assert.equal(E.ticketingPlanFor(restored),null);assert.equal(restored.cash,state.cash);assert.deepEqual(E.settlementFor(restored),E.settlementFor(state));}
 }
});

test('platform fee is withheld once from signing and excluded from artist production deductions',()=>{
 for(const deal of ['door','guarantee'])for(const seed of [1,3,6]){
  const s=set(build(seed,deal)),before=s.cash,started=open(s),ended=finish(started),r=E.settlementFor(ended);
  assert.equal(r.ticketing.fee,Math.round(r.presale*s.promotion.price*0.04));assert.equal(r.ticketing.gross,r.ticketing.fee+r.ticketing.remitted);
  assert.equal(Object.hasOwn(r.costs,'ticketing'),false);
  assert.equal(r.artistPay,deal==='door'?Math.round(D.DOOR_SPLIT*Math.max(0,r.ticketGross-r.costs.total)):s.booking.terms.ask);
  assert.equal(r.net,r.ticketGross+r.bar-r.costs.total-r.artistPay-r.ticketing.fee);
  const expected=r.ticketGross+r.bar-(deal==='door'?r.artistPay:0)-r.ticketing.fee;
  assert.equal(E.settlementPayout(r,deal),expected);const done=sign(ended);assert.equal(done.cash,ended.cash+expected);assert.equal(done.cash,before+r.net);
  assert.equal(E.careerLedgerFor(done).totals.settlement,expected);assert.equal(done.history.at(-1).cashAfter,done.cash);
  refuse(done,{type:'acceptSettlement'},/settle/);assert.equal(E.normalizeState(done).cash,done.cash);assert.deepEqual(E.settlementFor(E.normalizeState(done)),r);
 }
});

test('quiet and walk-up-loss Club pairs show an actual fee-versus-presale tradeoff',()=>{
 let quiet=false,loss=false;
 for(let seed=1;seed<=100&&(!quiet||!loss);seed++){
  const s=build(seed,'guarantee'),a=E.settlementFor(finish(open(s))),b=E.settlementFor(finish(open(set(s))));
  if(a.attendance===b.attendance&&b.ticketing.fee>0){assert.equal(a.net-b.net,b.ticketing.fee);quiet=true;}
  if(b.attendance>a.attendance&&b.net>a.net){assert.ok(b.presale>a.presale);loss=true;}
 }
 assert.ok(quiet,'direct wins without protection benefit');assert.ok(loss,'platform can outperform its fee under walk-up loss');
});

test('doors freeze source terms; promotion cannot rewrite the signed receipt',()=>{
 const opened=open(set(build())),baseline=E.settlementFor(finish(opened));assert.deepEqual(opened.show.ticketing,terms);
 refuse(opened,{type:'setPromotion',ticketing:null},/promote/);
 const tampered={...opened,promotion:{...opened.promotion,ticketing:{version:1,plan:'direct'}}};assert.deepEqual(E.settlementFor(finish(E.normalizeState(tampered))),baseline);
 const raw=structuredClone(opened);raw.show.ticketing.feePercent=0;raw.show.ticketing.fee=-999;assert.deepEqual(E.settlementFor(finish(E.normalizeState(raw))),baseline);
 const next=act(sign(finish(opened)),{type:'nextShow'});assert.equal(next.promotion.ticketing,undefined);assert.equal(E.ticketingPlanFor(next),null);
});

test('wrong-room, invalid and cleared choices preserve cash and recover optional source explicitly',()=>{
 let s=set(build());s=set(s,null);assert.equal(E.ticketingPlanFor(s),null);refuse(s,{type:'setPromotion',ticketing:{version:2,plan:'platform'}},/terms/);
 s=set(s);s=act(act(s,{type:'back'}),{type:'back'});s=act(s,{type:'chooseVenue',venueId:'lot'});assert.equal(s.promotion.ticketing,undefined);
 s=act(s,{type:'chooseDeal',deal:'door'});s=act(s,{type:'setLayout',objects:D.STARTER_LAYOUT});s=act(s,{type:'confirmBuild'});refuse(s,{type:'setPromotion',ticketing:terms},/Fathom/);
 const done=sign(finish(open(set(build()))));for(const mutate of [r=>{r.show.ticketing.version=2;},r=>{r.promotion.ticketing.plan='invalid';}]){
  const raw=structuredClone(done);mutate(raw);const restored=E.normalizeState(raw);assert.equal(restored.cash,done.cash);assert.deepEqual(restored.history,done.history);assert.match(restored.ticketingNotice,/preserved/);assert.equal(restored.phase,'done');assert.equal(E.careerLedgerFor(restored).balance,done.cash);
 }
});

test('public ticketing forecasts use draw bounds and are independent of the hidden seed',()=>{
 const s=set(build()),quote=E.ticketingForecastFor(s);assert.deepEqual(E.ticketingForecastFor({...s,seed:s.seed+100}),quote);
 assert.ok(quote.low.presale<=quote.high.presale);assert.ok(quote.low.fee<=quote.high.fee);assert.ok(quote.high.presale<=E.evaluateVenue(s.venue).capacity);
 const direct=E.ticketingForecastFor(set(s,{version:1,plan:'direct'}));assert.equal(direct.low.fee,0);assert.equal(direct.high.fee,0);assert.ok(quote.low.presale>=direct.low.presale);assert.ok(quote.high.presale>=direct.high.presale);
 assert.equal(E.ticketingForecastFor(E.createGame(1)),null);
});
