// Optional held runs preserve completed shows and account cancellation exactly once.
import test from 'node:test';import assert from 'node:assert/strict';
import * as E from './engine.mjs';import * as D from './data.mjs';import * as J from './career-ledger.mjs';
const act=(s,a)=>{const r=E.applyAction(s,a);assert.equal(r.error,null,`${a.type}: ${r.error}`);if(r.state.cashJournal)assert.equal(E.careerLedgerFor(r.state).balance,r.state.cash);return r.state;};
function build(deal='door',nights=3,policy=true){
 let s=act(E.createGame(3,{mode:'sandbox'}),{type:'enableEquipment'});s=act(s,{type:'chooseVenue',venueId:'amphitheater'});
 const artistId=E.offersFor(s).find(id=>E.termsFor(id,0).doorOk);assert.ok(artistId);
 s=act(s,{type:'chooseDeal',deal,artistId,nights,...(policy?{runPolicy:1}:{})});
 s=act(s,{type:'setLayout',objects:D.VENUES.amphitheater.starter});return act(s,{type:'confirmBuild'});
}
const open=s=>act(s,{type:'confirmPromotion'});
const finish=s=>act(s,{type:'respond',responseId:D.INCIDENTS[s.show.incidentId].responses[0].id});
const sign=(s,cancelRemaining=false)=>act(s,{type:'acceptSettlement',cancelRemaining});
function refuse(s,a,re){const before=structuredClone(s),r=E.applyAction(s,a);assert.match(r.error,re);assert.deepEqual(r.state,before);assert.deepEqual(s,before);}

test('both deals cancel remaining nights after paying the completed night exactly once',()=>{
 for(const deal of ['door','guarantee'])for(const nights of [2,3]){
  const ended=finish(open(build(deal,nights))),r=E.settlementFor(ended),q=E.heldRunFor(ended),done=sign(ended,true);
  assert.equal(done.phase,'done');assert.equal(done.show.cancelled,true);assert.equal(done.show.night,1);
  assert.equal(done.cash,ended.cash+E.settlementPayout(r,deal)-q.penalty);
  assert.equal(done.history.length,1);assert.equal(done.history[0].net,r.net);assert.equal(done.history[0].cashAfter,done.cash);
  assert.deepEqual(done.history[0].runCancellation,{terms:q.terms,completed:1});
  assert.equal(E.careerLedgerFor(done).totals.cancellation,-q.penalty);
  assert.equal(E.careerLedgerFor(done).totals.showOpening,E.careerLedgerFor(ended).totals.showOpening);
  assert.equal(done.reputation.venue,Math.min(100,Math.max(0,ended.reputation.venue+r.repDelta)));
  assert.deepEqual(E.settlementFor(done),r);refuse(done,{type:'acceptSettlement',cancelRemaining:true},/settle/);
  const reload=E.normalizeState(done);assert.equal(reload.cash,done.cash);assert.deepEqual(reload.history,done.history);assert.equal(reload.show.cancelled,true);assert.deepEqual(E.heldRunFor(reload),q);assert.equal(E.careerLedgerFor(reload).balance,reload.cash);
 }
});
test('continue retains frozen terms, charges one opening and applies accumulated reputation once',()=>{
 const first=finish(open(build())),r1=E.settlementFor(first),second=sign(first);
 assert.equal(second.phase,'show');assert.equal(second.show.night,2);assert.deepEqual(second.show.run,first.show.run);
 assert.equal(second.cash,first.cash+E.settlementPayout(r1,'door')-E.upfrontFor(first));assert.deepEqual(second.reputation,first.reputation);
 const ended=finish(second),r2=E.settlementFor(ended),done=sign(ended,true);
 assert.equal(done.history.length,2);assert.equal(E.heldRunFor(done).remaining,1);
 assert.equal(done.reputation.venue,Math.min(100,Math.max(0,first.reputation.venue+r1.repDelta+r2.repDelta)));
 assert.equal(E.careerLedgerFor(done).totals.cancellation,-Math.round(first.booking.terms.ask/4));
});
test('full hold ends without a cancellation payment and next booking clears optional terms',()=>{
 let s=open(build('guarantee',2));s=sign(finish(s));const ended=finish(s);assert.equal(E.heldRunFor(ended).remaining,0);
 refuse(ended,{type:'acceptSettlement',cancelRemaining:true},/no contracted remaining/);
 const done=sign(ended);assert.equal(done.phase,'done');assert.equal(done.history.length,2);assert.equal(E.careerLedgerFor(done).totals.cancellation,0);
 assert.equal(done.show.cancelled,undefined);const next=act(done,{type:'nextShow'});assert.equal(next.booking.run,undefined);assert.equal(next.show,null);assert.equal(next.history.length,2);
});
test('unaffordable continuation is explicit and cancellation can leave honest debt',()=>{
 const ended=finish(open(build('guarantee')));ended.mode='career';const payout=E.settlementPayout(E.settlementFor(ended),'guarantee');
 ended.cash=-payout;ended.cashJournal=J.saveCareerLedger(J.createCareerLedger(ended.cash));
 refuse(ended,{type:'acceptSettlement'},/Choose cancellation/);const q=E.heldRunFor(ended),done=sign(ended,true);
 assert.equal(done.cash,-q.penalty);assert.equal(E.normalizeState(done).cash,done.cash);assert.equal(E.careerLedgerFor(done).balance,done.cash);
 refuse(done,{type:'nextShow'},/Start over/);assert.equal(act(done,{type:'retry'}).cash,D.START_CASH);
});
test('legacy held runs and old seven-category journals preserve original behavior',()=>{
 const ended=finish(open(build('door',3,false)));assert.equal(E.heldRunFor(ended),null);refuse(ended,{type:'acceptSettlement',cancelRemaining:true},/no contracted remaining/);
 const next=sign(ended);assert.equal(next.phase,'show');assert.equal(next.show.night,2);assert.equal(next.show.run,undefined);
 const raw=structuredClone(next);delete raw.cashJournal.archived.totals.cancellation;const reloaded=E.normalizeState(raw);
 assert.equal(reloaded.cash,raw.cash);assert.equal(E.careerLedgerFor(reloaded).balance,raw.cash);assert.equal(reloaded.equipmentNotice,undefined);
});
test('optional source validation preserves paid cash and ignores supplied fee claims',()=>{
 const opened=open(build()),raw=structuredClone(opened);raw.show.run.penalty=-10000;raw.show.run.feeEach=0;raw.booking.run.ask=1;
 const normalized=E.normalizeState(raw);assert.deepEqual(normalized.show.run,opened.show.run);assert.match(normalized.runNotice,/booking removed/);
 assert.equal(E.heldRunFor(normalized).penalty,E.heldRunFor(opened).penalty);
 const bad=structuredClone(opened);bad.show.run.version=99;const recovered=E.normalizeState(bad);assert.equal(recovered.cash,bad.cash);assert.equal(recovered.show.run,undefined);assert.match(recovered.runNotice,/show terms removed/);
 refuse(opened,{type:'acceptSettlement',cancelRemaining:true},/settle/);refuse(finish(opened),{type:'acceptSettlement',cancelRemaining:'yes'},/Choose whether/);
});

test('changing an unpaid booking clears its prior held-run quote',()=>{
 let s=build();s=act(s,{type:'back'});s=act(s,{type:'back'});assert.ok(s.booking.run);
 const other=act(s,{type:'chooseVenue',venueId:'club'});assert.equal(other.booking.run,undefined);
 const one=act(s,{type:'chooseDeal',deal:'guarantee',nights:1});assert.equal(one.booking.run,undefined);
 refuse(s,{type:'chooseDeal',deal:'guarantee',nights:1,runPolicy:1},/cannot use a held-run policy/);
});
