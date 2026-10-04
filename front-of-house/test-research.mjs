// Development costs, eligible nights, one slot, refunds and untrusted checkpoint replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH_PROJECTS } from './data.mjs';
import { createResearch, applyResearch, saveResearch, loadResearch, researchRefundFor, RESEARCH_COMMAND_LIMIT } from './research.mjs';
const departments = (changes = {}) => ({ production: true, guestServices: true, admissions: true, venueOperations: true, ...changes });
const night = (id, flags = {}) => ({ kind: 'night', id, departments: departments(flags) });
function command(state, action, cash = 1000) {
  const r = applyResearch(state, action, { cash }); assert.equal(r.error, null, r.error); return r;
}
function unchanged(state, action, cash = 1000) {
  const copy = structuredClone(state), r = applyResearch(state, action, { cash });
  assert.ok(r.error); assert.equal(r.cashDelta, 0); assert.deepEqual(r.state, copy); assert.deepEqual(state, copy); return r;
}

test('three projects have an affordable foundation, bounded requirements and one active slot', () => {
  const s = createResearch(); assert.deepEqual(Object.keys(s.projects), ['patch', 'service', 'admission']);
  assert.equal(s.projects.patch.status, 'available'); assert.equal(s.projects.service.status, 'locked');
  unchanged(s, {kind:'start',project:'service'}); unchanged(s,{kind:'start',project:'patch'},119);
  let r = command(s,{kind:'start',project:'patch'},120); assert.equal(r.cashDelta,-120); assert.equal(r.state.active,'patch');
  unchanged(r.state,{kind:'start',project:'patch'});
  r = command(r.state,night('first')); assert.equal(r.state.projects.patch.status,'researched'); assert.equal(r.state.active,null);
  assert.equal(r.state.projects.service.status,'available'); assert.equal(r.state.projects.admission.status,'available');
  r = command(r.state,{kind:'start',project:'service'}); unchanged(r.state,{kind:'start',project:'admission'});
  assert.equal(r.state.spent,300); assert.equal(r.state.refunded,0);
});

test('experience is cumulative, progress uses eligible distinct nights, duplicate submissions are free', () => {
  let s = command(createResearch(),night('first')).state;
  s = command(s,{kind:'start',project:'service'}).state;
  s = command(s,night('no_bar',{guestServices:false})).state;
  assert.equal(s.projects.service.progress,0); assert.equal(s.experience.guestServices,1);
  s = command(s,night('bar_one')).state; assert.equal(s.projects.service.progress,1);
  const duplicate = command(s,night('first')); assert.deepEqual(duplicate.state,s); assert.equal(duplicate.cashDelta,0);
  s = command(s,night('bar_two')).state; assert.equal(s.projects.service.status,'researched');
  assert.equal(s.experience.guestServices,3); assert.equal(s.experience.production,4);
  assert.deepEqual(s.learned,['service']); unchanged(s,{kind:'start',project:'service'}); unchanged(s,{kind:'cancel',project:'service'});
});

test('pause frees the slot, resume costs nothing and partial cancellation refunds exactly once', () => {
  let s = command(createResearch(),night('initial')).state;
  s = command(s,{kind:'start',project:'service'}).state; s = command(s,night('one')).state;
  assert.equal(researchRefundFor(s,'service'),90);
  s = command(s,{kind:'pause',project:'service'}).state;
  s = command(s,{kind:'start',project:'patch'}).state; unchanged(s,{kind:'resume',project:'service'});
  s = command(s,night('patch_night')).state; assert.equal(s.projects.service.progress,1);
  let r = command(s,{kind:'resume',project:'service'}); assert.equal(r.cashDelta,0);
  r = command(r.state,{kind:'cancel',project:'service'}); assert.equal(r.cashDelta,90); assert.equal(r.state.active,null);
  assert.equal(r.state.projects.service.progress,0); assert.equal(r.state.experience.guestServices,3);
  unchanged(r.state,{kind:'cancel',project:'service'}); assert.equal(researchRefundFor(r.state,'service'),0);
  const restarted=command(r.state,{kind:'start',project:'service'}); assert.equal(restarted.cashDelta,-180); assert.equal(restarted.state.projects.service.progress,0);
});

test('start/cancel/restart cannot create cash and ledgers reconcile all paid work', () => {
  let s=command(createResearch(),night('first')).state,cash=500;
  for(let i=0;i<20;i++)for(const kind of ['start','cancel']){
    const r=command(s,{kind,project:'service'},cash);s=r.state;cash+=r.cashDelta;
    assert.ok(cash<=500);assert.equal(cash,500-s.spent+s.refunded);
  }
  assert.equal(cash,500);assert.equal(new Set(s.ledger.map(e=>e.id)).size,s.ledger.length);
  assert.equal(s.ledger.reduce((n,e)=>n+e.cashDelta,0),s.refunded-s.spent);
});

test('checkpoint replay derives progress and cash history without mutating or trusting supplied totals', () => {
  let s=command(createResearch(),night('one')).state;s=command(s,{kind:'start',project:'admission'}).state;
  s=command(s,night('two')).state;s=command(s,{kind:'pause',project:'admission'}).state;
  const saved=saveResearch(s),before=structuredClone(saved);
  const loaded=loadResearch({...saved,active:'patch',experience:{admissions:9999},spent:-9999,refunded:9999,learned:['patch'],projects:{}});
  assert.deepEqual(loaded,s);assert.deepEqual(saved,before);
  const next=command(loaded,{kind:'resume',project:'admission'});assert.equal(next.cashDelta,0);
  assert.equal(command(next.state,night('three')).state.projects.admission.status,'researched');
});

test('sandbox knows all projects for free; scenario starts without historical experience', () => {
  const sandbox=createResearch('sandbox');assert.deepEqual(sandbox.learned,Object.keys(RESEARCH_PROJECTS));assert.equal(sandbox.spent,0);assert.deepEqual(sandbox.ledger,[]);
  assert.deepEqual(loadResearch(saveResearch(sandbox)),sandbox);unchanged(sandbox,{kind:'start',project:'patch'});
  const scenario=createResearch('scenario');assert.deepEqual(scenario.learned,[]);assert.ok(Object.values(scenario.experience).every(n=>n===0));
  assert.throws(()=>createResearch('unknown'));
});

test('malformed and oversized checkpoints fail, derived prices are ignored and full logs keep deduplication', () => {
  for(const raw of [null,{}, {version:1,commands:[]}, {version:2,mode:'career',commands:[]},{version:1,mode:'unknown',commands:[]},
    {version:1,mode:'career',commands:[night('a'),night('a')]},
    {version:1,mode:'career',commands:[{kind:'night',id:'bad path',departments:departments()}]},
    {version:1,mode:'career',commands:[{kind:'night',id:'a',departments:{production:1}}]},
    {version:1,mode:'career',commands:[{kind:'start',project:'constructor'}]},
    {version:1,mode:'career',commands:[{kind:'resume',project:'patch'}]},
    {version:1,mode:'career',commands:Array.from({length:RESEARCH_COMMAND_LIMIT+1},(_,i)=>night('n'+i))}])assert.throws(()=>loadResearch(raw));
  const s=loadResearch({version:1,mode:'career',commands:[{kind:'start',project:'patch',cost:-99999,cashDelta:99999}]});assert.equal(s.spent,120);assert.equal(s.ledger[0].cashDelta,-120);
  const full=loadResearch({version:1,mode:'career',commands:Array.from({length:RESEARCH_COMMAND_LIMIT},(_,i)=>night('n'+i))});
  unchanged(full,night('overflow'));assert.deepEqual(command(full,night('n0')).state,full);
});
