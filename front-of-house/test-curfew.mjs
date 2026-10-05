// Outdoor curfew timing, exact receipts, legacy compatibility and paid replay.
import test from 'node:test';import assert from 'node:assert/strict';
import {curfewTerms,setTiming,SET_SCHEDULE} from './curfew.mjs';
import * as E from './engine.mjs';import * as D from './data.mjs';
const act=(s,a)=>{const r=E.applyAction(s,a);assert.equal(r.error,null,`${a.type}: ${r.error}`);if(r.state.cashJournal)assert.equal(E.careerLedgerFor(r.state).balance,r.state.cash);return r.state;};
function booking({room='amphitheater',deal='guarantee',marked=true,nights=1,seed=8,incident='curfew'}={}){
 let s=act(E.createGame(seed,{mode:'sandbox'}),{type:'enableEquipment'});s=act(s,{type:'chooseVenue',venueId:room});
 if(room==='festival'&&deal==='door')s.reputation.artists['salt-ledger']=20;
 let artistId;
 for(let i=0;i<10000;i++,s.seed++){
  artistId=E.offersFor(s).find(id=>deal!=='door'||E.termsFor(id,s.reputation.artists[id]).doorOk);
  if(room==='festival'&&deal==='door')artistId=E.offersFor(s).includes('salt-ledger')?'salt-ledger':null;
  if(artistId&&Array.from({length:nights},(_,i)=>i+1).every(n=>E.incidentFor(s.seed,artistId,s.venue,null,n)===incident))break;
  artistId=null;
 }
 if(!artistId)throw Error('Fixture has no eligible seeded incident');
 s=act(s,{type:'chooseDeal',artistId,deal,nights,roomPolicy:1,...(marked?{curfewPolicy:1}:{}),...(room==='amphitheater'?{seatingPolicy:1,...(nights>1?{runPolicy:1}:{})}:{secondId:'hollow-census',stagePolicy:1,festivalPolicy:1})});
 s=act(s,{type:'setLayout',objects:room==='amphitheater'?D.AMP_STARTER:[...D.FEST_STARTER,{type:'delay',x:8,y:16,rot:0},{type:'delay',x:30,y:16,rot:0}]});
 return s;
}
const open=s=>act(act(s,{type:'confirmBuild'}),{type:'confirmPromotion'});
const finish=(s,responseId='obey')=>act(s,{type:'respond',responseId});
test('curfew source rejects unsupported terms and discards injected derived values',()=>{
 for(const room of ['amphitheater','festival'])assert.deepEqual(curfewTerms({version:1,end:0,walkupMult:9},room),{version:1});
 for(const raw of [null,[],{version:'1'},{version:2},{}])assert.throws(()=>curfewTerms(raw,'amphitheater'),TypeError);
 for(const room of ['lot','club','toString',null])assert.throws(()=>curfewTerms({version:1},room),TypeError);
 assert.ok(Object.isFrozen(SET_SCHEDULE));
});
test('hand-calculated early end, five-minute appeal, full set and minute rounding',()=>{
 const obey=setTiming({incidentId:'curfew',incidentAt:.9,responseId:'obey'});
 assert.deepEqual(obey,{start:72,plannedEnd:240,end:216,played:144,lost:24,curtailed:true,walkupMult:.9,barMult:6/7});
 const appeal=setTiming({incidentId:'curfew',incidentAt:.9,responseId:'appeal'});assert.equal(appeal.end,221);assert.equal(appeal.played,149);assert.equal(appeal.lost,19);
 assert.equal(setTiming({incidentId:'curfew',incidentAt:.999,responseId:'appeal'}).end,240);
 assert.equal(setTiming({incidentId:'curfew',incidentAt:.001,responseId:'obey'}).played,0);
 assert.equal(setTiming({incidentId:'curfew',incidentAt:.882,responseId:'obey'}).end,212);
 for(const input of [{},{incidentId:'rain',incidentAt:.1,responseId:'ride-out'},{incidentId:'curfew',incidentAt:.9}]){const r=setTiming(input);assert.equal(r.end,240);assert.equal(r.played,168);assert.equal(r.walkupMult,1);assert.equal(r.barMult,1);}
 for(const input of [{incidentAt:NaN},{incidentAt:-1},{incidentAt:2},{incidentId:'curfew',responseId:'free-song'}])assert.throws(()=>setTiming(input),TypeError);
});
test('aggregate walk-ups and bar use time with one rounding; presales, cost and guarantee stay paid',()=>{
 const s=booking(),v=E.evaluateVenue(s.venue),time=setTiming({incidentId:'curfew',incidentAt:.9,responseId:'obey'});
 const inputs={venue:v,deal:'guarantee',price:20,ads:{},venueRep:0,draw:300,artistId:'salt-ledger',ask:500,incidentId:'curfew',responseId:'obey',setTime:time};
 const r=E.evaluateShow(inputs),legacy=E.evaluateShow({...inputs,setTime:undefined});
 assert.equal(r.presale,legacy.presale);assert.equal(r.walkupAfterIncident,Math.round(r.walkup*.9));assert.equal(legacy.walkupAfterIncident,Math.round(r.walkup*.7));
 assert.equal(r.attendance,Math.min(v.capacity,r.presale+Math.round(r.walkup*.9)));
 const served=Math.min(r.attendance,v.bars*D.BAR_RATIO);
 assert.equal(r.bar,Math.round(D.BAR_NET_PER_HEAD*r.satisfaction/100*(served+(r.attendance-served)*D.BAR_SHORTFALL)*6/7));
 assert.deepEqual(r.costs,legacy.costs);assert.equal(r.artistPay,500);assert.equal(r.upfront,legacy.upfront);
});
test('every outdoor deal reconciles both responses, frozen opening and signed reload',()=>{
 for(const room of ['amphitheater','festival'])for(const deal of room==='festival'?['guarantee','door','sponsor']:['guarantee','door'])for(const response of ['obey','appeal']){
  const s=booking({room,deal,seed:3}),paid=open(s),ended=finish(paid,response),r=E.settlementFor(ended),done=act(ended,{type:'acceptSettlement'});
  assert.ok(r.setTime.lost>0);assert.equal(paid.cash-ended.cash,response==='appeal'?400:0);assert.equal(r.costs.incident,response==='appeal'?400:0);
  assert.equal(r.upfront,E.upfrontFor(s));assert.equal(done.cash,s.cash+r.net);assert.equal(E.careerLedgerFor(done).balance,done.cash);
  if(room==='festival'){assert.equal(r.stageAccounts.net,r.net);assert.equal(r.stageAccounts.main.attendance+r.stageAccounts.second.attendance,r.attendance);assert.equal(r.costs.delays,1350);}
  if(deal!=='door')assert.equal(r.artistPay,s.booking.terms.ask);
  const changed=structuredClone(ended);delete changed.booking.curfew;assert.deepEqual(E.settlementFor(changed),r,'paid marker is authoritative');
  for(const state of [s,paid,ended,done])assert.deepEqual(E.settlementFor(E.normalizeState(state)),E.settlementFor(state));
  assert.match(E.applyAction(ended,{type:'respond',responseId:response}).error,/show|Show/);assert.equal(E.applyAction(done,{type:'acceptSettlement'}).state.cash,done.cash);
 }
});
test('held nights each derive their own time and cancellation preserves the signed journal',()=>{
 let s=open(booking({nights:3})),cash=s.cash+E.upfrontFor(s),net=0;
 for(let night=1;night<=3;night++){
  assert.equal(s.show.night,night);assert.deepEqual(s.show.curfew,{version:1});s=finish(E.normalizeState(s),night===2?'appeal':'obey');const r=E.settlementFor(s);
  const roll=E.rollShow(night>1?(s.seed^night)>>>0:s.seed,s.booking.artistId),expected=Math.round(E.incidentAtFor('curfew',roll.timing)*240)+(night===2?5:0);
  assert.equal(r.setTime.end,expected);net+=r.net;s=act(s,{type:'acceptSettlement'});
 }
 assert.equal(s.cash,cash+net);assert.equal(s.history.length,3);assert.deepEqual(E.settlementFor(E.normalizeState(s)),E.settlementFor(s));
 let c=finish(open(booking({nights:3})));const fee=E.heldRunFor(c).penalty,payout=E.settlementPayout(E.settlementFor(c),c.booking.deal),before=c.cash;c=act(c,{type:'acceptSettlement',cancelRemaining:true});assert.equal(c.cash,before+payout-fee);assert.equal(c.history.length,1);
});
test('no curfew keeps existing receipt arithmetic and unmarked bookings remain unmarked',()=>{
 for(const id of ['rain','pa-dropout','gate-jam']){
  const a=booking({incident:id}),b=booking({marked:false,incident:id});
  const response=D.INCIDENTS[id].responses[0].id,r=E.settlementFor(finish(open(a),response)),old=E.settlementFor(finish(open(b),response));
  assert.equal(r.setTime.played,168);const {setTime,...rest}=r;assert.deepEqual(rest,old);
 }
 const paid=open(booking({marked:false}));assert.equal(E.setTimeFor(paid),null);assert.equal(E.normalizeState(paid).show.curfew,undefined);
});
test('malformed optional paid terms preserve cash/history and never use booking as fallback',()=>{
 const done=act(finish(open(booking())),{type:'acceptSettlement'});
 for(const raw of [null,[],{version:2},{version:'1'}]){const damaged=structuredClone(done);damaged.show.curfew=raw;const loaded=E.normalizeState(damaged);assert.equal(loaded.cash,done.cash);assert.deepEqual(loaded.history,done.history);assert.equal(E.setTimeFor(loaded),null);assert.match(loaded.curfewNotice,/paid curfew terms/);}
 const injected=structuredClone(done);injected.show.curfew.end=0;assert.deepEqual(E.settlementFor(E.normalizeState(injected)),E.settlementFor(done));
 const fresh=act(done,{type:'nextShow'});assert.equal(fresh.booking.curfew,undefined);assert.equal(act(fresh,{type:'chooseVenue',venueId:'club'}).booking.curfew,undefined);
 const lot=E.createGame(1);assert.match(E.applyAction(lot,{type:'chooseDeal',deal:'guarantee',curfewPolicy:1}).error,/curfew/);
});
