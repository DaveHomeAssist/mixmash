// Separate zone sales flow into one frozen nightly settlement and reconciled career cash.
import test from 'node:test';import assert from 'node:assert/strict';
import * as E from './engine.mjs';import * as D from './data.mjs';
const act=(s,a)=>{const r=E.applyAction(s,a);assert.equal(r.error,null,`${a.type}: ${r.error}`);if(r.state.cashJournal)assert.equal(E.careerLedgerFor(r.state).balance,r.state.cash);return r.state;};
function build(deal='door',policy=true,nights=1,seed=3){
 let s=act(E.createGame(seed,{mode:'sandbox'}),{type:'enableEquipment'});s=act(s,{type:'chooseVenue',venueId:'amphitheater'});
 const artistId=E.offersFor(s).find(id=>E.termsFor(id,0).doorOk);assert.ok(artistId);
 s=act(s,{type:'chooseDeal',deal,artistId,nights,...(nights>1?{runPolicy:1}:{}),...(policy?{seatingPolicy:1}:{})});
 s=act(s,{type:'setLayout',objects:D.VENUES.amphitheater.starter});return act(s,{type:'confirmBuild'});
}
const open=s=>act(s,{type:'confirmPromotion'});
const finish=s=>act(s,{type:'respond',responseId:D.INCIDENTS[s.show.incidentId].responses[0].id});
const sign=(s,cancelRemaining=false)=>act(s,{type:'acceptSettlement',cancelRemaining});
function refuse(s,a,re){const before=structuredClone(s),r=E.applyAction(s,a);assert.match(r.error,re);assert.deepEqual(r.state,before);assert.deepEqual(s,before);}

test('legacy absence keeps original first-filled seats and no new result fields',()=>{
 for(const deal of ['door','guarantee']){
  const s=build(deal,false),ended=finish(open(s)),r=E.settlementFor(ended);assert.equal(E.seatingPlanFor(s),null);assert.equal(r.seating,undefined);
  assert.equal(r.seated,Math.min(E.evaluateVenue(s.venue).seats,r.attendance));assert.equal(r.ticketGross,r.seated*s.promotion.seatPrice+(r.attendance-r.seated)*s.promotion.price);
  for(const state of [s,open(s),ended,sign(ended)]){const loaded=E.normalizeState(state);assert.equal(loaded.cash,state.cash);assert.deepEqual(E.settlementFor(loaded),E.settlementFor(state));}
 }
});
test('both deals settle zone receipts once and retain the artist production basis',()=>{
 for(const deal of ['door','guarantee'])for(const seed of [2,3,5]){
  const start=build(deal,true,1,seed),ended=finish(open(start)),r=E.settlementFor(ended),done=sign(ended);
  assert.equal(r.attendance,r.seating.seats.attendance+r.seating.lawn.attendance);assert.equal(r.ticketGross,r.seating.seats.gross+r.seating.lawn.gross);
  assert.equal(r.seated,r.seating.seats.attendance);assert.equal(r.satisfaction,r.seating.scores.combined);
  assert.equal(r.artistPay,deal==='door'?Math.round(D.DOOR_SPLIT*Math.max(0,r.ticketGross-r.costs.total)):start.booking.terms.ask);
  assert.equal(done.cash,start.cash+r.net);assert.equal(done.cash,ended.cash+E.settlementPayout(r,deal));assert.equal(done.history.at(-1).cashAfter,done.cash);
  refuse(done,{type:'acceptSettlement'},/settle/);assert.deepEqual(E.settlementFor(E.normalizeState(done)),r);
 }
});
test('public forecasts respond independently to each price and never the hidden seed',()=>{
 const s=build(),q=E.seatingForecastFor(s),high=act(s,{type:'setPromotion',seatPrice:80}),h=E.seatingForecastFor(high);
 assert.ok(h.low.seats.demand<q.low.seats.demand);assert.deepEqual(h.low.lawn,q.low.lawn);assert.deepEqual(h.high.lawn,q.high.lawn);
 assert.deepEqual(E.seatingForecastFor({...s,seed:99999}),q);assert.deepEqual(E.forecast(s),{low:q.low.attendance,high:q.high.attendance,capacity:q.low.capacity});
 const lawnHigh=E.seatingForecastFor(act(s,{type:'setPromotion',price:80}));assert.ok(lawnHigh.low.lawn.demand<q.low.lawn.demand);assert.deepEqual(lawnHigh.low.seats,q.low.seats);
});
test('doors freeze both prices, including across continued and cancelled held nights',()=>{
 const s=act(build('guarantee',true,3),{type:'setPromotion',price:40,seatPrice:60}),opened=open(s),frozen={version:1,lawnPrice:40,seatPrice:60};assert.deepEqual(opened.show.seating,frozen);
 const tampered=structuredClone(opened);tampered.promotion.price=80;tampered.promotion.seatPrice=80;const loaded=E.normalizeState(tampered);
 assert.deepEqual(E.settlementFor(finish(loaded)),E.settlementFor(finish(opened)));refuse(opened,{type:'setPromotion',seatPrice:80},/promote/);
 const second=sign(finish(opened));assert.deepEqual(second.show.seating,frozen);const ended=finish(second),r=E.settlementFor(ended),q=E.heldRunFor(ended),done=sign(ended,true);
 assert.equal(done.cash,ended.cash+E.settlementPayout(r,'guarantee')-q.penalty);assert.equal(done.history.length,2);assert.deepEqual(E.settlementFor(E.normalizeState(done)),r);
});
test('new held-night settlement uses the same per-night draw seed as playback',()=>{
 let s=open(build('guarantee',true,3));s=sign(finish(s));assert.equal(s.show.night,2);
 const a=E.artistFor(s.booking.artistId),v=E.evaluateVenue(s.venue),draw=E.rollShow((s.seed^2)>>>0,s.booking.artistId).draw;
 const potential=E.demand({draw:draw*s.booking.terms.drawMult,price:a.fairPrice,fairPrice:a.fairPrice,ads:s.promotion.ads,venueRep:s.show.venueRep});
 assert.equal(E.showPreview(s).seating.potential,Math.round(potential));assert.deepEqual(E.showPreview(E.normalizeState(s)),E.showPreview(s));
});
test('optional source validation ignores derived totals and preserves cash on recovery',()=>{
 const opened=open(build()),raw=structuredClone(opened);raw.show.seating.ticketGross=1e9;raw.show.seating.seats=0;
 assert.deepEqual(E.settlementFor(finish(E.normalizeState(raw))),E.settlementFor(finish(opened)));
 for(const seating of [{version:2},{version:1,lawnPrice:1,seatPrice:60},{version:1,lawnPrice:40,seatPrice:100}]){const bad=E.normalizeState({...opened,show:{...opened.show,seating}});assert.equal(bad.cash,opened.cash);assert.equal(bad.show.seating,undefined);assert.match(bad.seatingNotice,/cash and signed history/);}
 let s=build();s=act(act(s,{type:'back'}),{type:'back'});assert.equal(act(s,{type:'chooseVenue',venueId:'club'}).booking.seating,undefined);
 const next=act(sign(finish(open(build()))),{type:'nextShow'});assert.equal(next.booking.seating,undefined);assert.equal(next.show,null);
});
