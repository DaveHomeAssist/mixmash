// Career development: real settled nights, separate money, frozen bookings and save replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, normalizeState, researchFor, researchEffectsFor, researchNightFor,
  settlementFor, settlementPayout, liveServicesFor, liveEndMinute, evaluateVenue } from './engine.mjs';
import { VENUES, INCIDENTS, LIVE_SERVICES } from './data.mjs';
import { RESEARCH_COMMAND_LIMIT } from './research.mjs';
const act = (s, a) => { const result = applyAction(s, a); assert.equal(result.error, null, `${a.type}: ${result.error}`); return result.state; };
const develop = (s, kind, project) => act(s, {type:'research', command:{kind,project}});
function book(s, { live = false, nights = 1 } = {}) {
  s = act(s,{type:'chooseDeal',deal:'guarantee',nights});
  s = act(s,{type:'setLayout',objects:VENUES[s.venue.id].starter});
  s = act(s,{type:'confirmBuild'});
  return act(s,{type:'confirmPromotion',...(live ? {services:true,flow:1} : {})});
}
function finish(s, response) {
  if (s.show.services) s = act(s,{type:'advanceLive',minute:240});
  s = act(s,{type:'respond',responseId:response || INCIDENTS[s.show.incidentId].responses[0].id});
  if (s.show.services) {
    s = act(s,{type:'advanceLive',minute:240});
    s = act(s,{type:'advanceLive',minute:liveEndMinute(s)});
  }
  return s;
}
const sign = s => act(s,{type:'acceptSettlement',at:'2026-10-04T00:00:00Z'});
const ready = () => act(sign(finish(book(createGame(3)))),{type:'enableResearch'});
const next = s => act(s,{type:'nextShow'});
const refuse = (s,a,match) => { const before=structuredClone(s), r=applyAction(s,a); assert.match(r.error,match); assert.deepEqual(r.state,before); };

test('opt-in, phase gates, exact development money and zero replay payments', () => {
  refuse(createGame(3),{type:'enableResearch'},/first show/);
  let s=ready(), cash=s.cash;
  assert.equal(researchFor(s).settledNights.length,0,'no backfill');
  s=develop(s,'start','patch'); assert.equal(s.cash,cash-120);
  assert.equal(normalizeState(s).cash,s.cash); assert.deepEqual(researchFor(normalizeState(s)),researchFor(s));
  s=develop(s,'pause','patch'); s=develop(s,'resume','patch'); assert.equal(s.cash,cash-120);
  s=develop(s,'cancel','patch'); assert.equal(s.cash,cash);
  refuse(s,{type:'research',command:{kind:'night',id:'free'}},/project action/);
  const poor={...s,cash:119}; refuse(poor,{type:'research',command:{kind:'start',project:'patch'}},/cash/);
  s=book(next(s)); refuse(s,{type:'research',command:{kind:'start',project:'patch'}},/between bookings/);
});

test('real signed nights advance once and learning waits for the next booking', () => {
  let s=develop(ready(),'start','patch'); s=book(next(s),{live:true});
  assert.deepEqual(researchEffectsFor(s).learned,[]);
  s=finish(s); const receipt=settlementFor(s),cash=s.cash,night=researchNightFor(s);
  assert.deepEqual(night.departments,{production:true,guestServices:true,admissions:true,venueOperations:true});
  s=sign(s); assert.equal(s.cash,cash+settlementPayout(receipt,s.booking.deal));
  assert.deepEqual(researchFor(s).learned,['patch']); assert.deepEqual(researchEffectsFor(s).learned,[]);
  assert.deepEqual(settlementFor(normalizeState(s)),receipt);
  refuse(s,{type:'acceptSettlement'},/settle/);
  assert.deepEqual(researchFor(s).experience,{production:1,guestServices:1,admissions:1,venueOperations:1});
  s=act(next(s),{type:'chooseDeal',deal:'door'}); assert.deepEqual(researchEffectsFor(s).learned,['patch']);
});

test('Patch improves only the paid backup response without replacing equipment or charging twice', () => {
  const enabled=act(createGame(1,{mode:'sandbox'}),{type:'enableResearch'});
  let improved,baseline;
  for(let seed=1;seed<100;seed++) {
    const s=book({...enabled,seed});
    if(s.show.incidentId==='pa-dropout') {improved=finish(s,'backup-amp'); baseline=finish(book(createGame(seed,{mode:'sandbox'})),'backup-amp');break;}
  }
  assert.ok(improved); const a=settlementFor(improved),b=settlementFor(baseline);
  assert.ok(Math.abs(a.parts.incident-0.95)<1e-12); assert.equal(b.parts.incident,0.8);
  assert.equal(a.costs.incident,100); assert.equal(a.costs.total,b.costs.total);
  assert.equal(a.artistPay,b.artistPay); assert.equal(a.upfront,b.upfront);
  const noPA=structuredClone(improved); noPA.venue.objects=noPA.venue.objects.filter(o=>!o.type.startsWith('pa'));
  assert.equal(researchEffectsFor(noPA).patchScore,0);
});

test('live capacity benefits use connected gates and the same exclusive worker', () => {
  const enabled=act(createGame(3,{mode:'sandbox'}),{type:'enableResearch'});
  const trained=book(enabled,{live:true}),plain=book(createGame(3,{mode:'sandbox'}),{live:true});
  assert.equal(trained.show.services.spec.gateRate,plain.show.services.spec.gateRate+evaluateVenue(trained.venue).gates);
  assert.equal(trained.show.services.spec.workerRate,LIVE_SERVICES.workerRate+1);
  assert.equal(trained.show.services.spec.gateWorkerRate,plain.show.services.spec.gateWorkerRate);
  const a=act(trained,{type:'assignLiveWorker',station:'gate'}),b=act(plain,{type:'assignLiveWorker',station:'gate'});
  const x=act(a,{type:'advanceLive',minute:20}),y=act(b,{type:'advanceLive',minute:20});
  assert.equal(liveServicesFor(x).worker.station,'gate');
  assert.ok(liveServicesFor(x).admitted>=liveServicesFor(y).admitted);
  assert.deepEqual(liveServicesFor(normalizeState(x)),liveServicesFor(x));
  assert.equal(book(enabled).show.services,undefined,'ordinary show remains ordinary');
});

test('held nights retain the booked knowledge while progress advances per actual night', () => {
  let s=develop(ready(),'start','patch'); s=next(s); s.unlocks.amphitheater=true; s.cash=100000;
  s=act(s,{type:'chooseVenue',venueId:'amphitheater'}); s=book(s,{nights:2});
  const marker=structuredClone(s.booking.research); s=sign(finish(s));
  assert.equal(s.show.night,2); assert.deepEqual(researchFor(s).learned,['patch']);
  assert.deepEqual(s.booking.research,marker); assert.deepEqual(researchEffectsFor(s).learned,[]);
  s=sign(finish(s)); assert.equal(researchFor(s).settledNights.length,2);
  assert.equal(researchFor(s).experience.production,2); assert.equal(researchFor(s).experience.guestServices,0);
});

test('invalid optional checkpoints and booking markers recover without changing cash or old careers', () => {
  const old=sign(finish(book(createGame(3)))); assert.equal(normalizeState(old).research,undefined);
  const s=ready();
  for(const research of [null,{version:2}, {...s.research,mode:'sandbox'}, {...s.research,commands:[{kind:'start',project:'unknown'}]}]) {
    const n=normalizeState({...s,research}); assert.equal(n.cash,s.cash); assert.deepEqual(researchFor(n).learned,[]); assert.match(n.researchNotice,/reset/);
  }
  const n=normalizeState({...s,booking:{...s.booking,research:{version:1,at:99999,learned:['patch']}}});
  assert.equal(n.booking.research,undefined); assert.equal(n.cash,s.cash);
  const scenario=ready(); scenario.mode='scenario'; scenario.research={version:1,mode:'scenario',commands:[]};
  assert.equal(act(scenario,{type:'retry'}).research,undefined);
});

test('bounded research history never blocks show settlement or repeats a payment', () => {
  let s=ready(); s.research.commands=Array.from({length:RESEARCH_COMMAND_LIMIT},(_,i)=>({kind:'night',id:`old_${i}`,departments:{production:false,guestServices:false,admissions:false,venueOperations:false}}));
  s=finish(book(next(s))); const cash=s.cash,receipt=settlementFor(s); s=sign(s);
  assert.equal(s.phase,'done'); assert.equal(s.cash,cash+settlementPayout(receipt,s.booking.deal));
  assert.equal(s.research.commands.length,RESEARCH_COMMAND_LIMIT); assert.match(s.researchNotice,/full/);
  assert.equal(normalizeState(s).cash,s.cash); assert.match(normalizeState(s).researchNotice,/full/);
});
