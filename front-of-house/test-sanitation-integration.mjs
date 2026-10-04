// Sanitation contracts reconcile upfront costs, live visits and one-time career receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_LAYOUT, INCIDENTS, DOOR_SPLIT, REL_MAX_STEP } from './data.mjs';
import { createGame, applyAction, normalizeState, upfrontFor, liveServicesFor, liveEndMinute,
  settlementFor, settlementPayout, sanitationPlanFor, validateLayout, evaluateVenue } from './engine.mjs';
const trailer = { type: 'trailer', x: 16, y: 9, rot: 0 };
const layout = [...STARTER_LAYOUT, trailer];
const terms = (changes = {}) => ({ version: 1, cleaner: true, utilities: true, preference: false, ...changes });
const act = (s, action) => { const r = applyAction(s, action); assert.equal(r.error, null, `${action.type}: ${r.error}`); return r.state; };
function prepare(options = {}) {
  const { objects = layout, sanitation = terms(), deal = 'door', seed = 1, foodPlan = null } = options;
  return [{ type: 'chooseDeal', artistId: 'sodium-arcade', deal }, { type: 'setLayout', objects },
    { type: 'confirmBuild' }, { type: 'setPromotion', services: true, sanitation, foodPlan }].reduce(act, createGame(seed));
}
const open = s => act(s, { type: 'confirmPromotion', services: true, flow: 1 });
function finish(s) {
  s = act(s, { type: 'advanceLive', minute: 240 });
  if (!s.show.responseId) s = act(s, { type: 'respond', responseId: INCIDENTS[s.show.incidentId].responses.find(r => r.cost <= s.cash).id });
  s = act(s, { type: 'advanceLive', minute: 240 });
  return act(s, { type: 'advanceLive', minute: liveEndMinute(s) });
}
function refused(s, match, action = { type: 'confirmPromotion', services: true, flow: 1 }) {
  const before = structuredClone(s), result = applyAction(s, action);
  assert.match(result.error, match); assert.deepEqual(result.state, before);
}

test('facilities require paid live terms, access, utilities and funds before any charge', () => {
  refused(prepare({ sanitation: null }), /Enable sanitation/);
  refused(prepare(), /live Lot clock/, { type: 'confirmPromotion', services: true });
  refused(prepare({ objects: layout.filter(o => o.type !== 'restroom'), sanitation: terms({ utilities: false }) }), /usable sanitation/);
  refused(prepare({ objects: STARTER_LAYOUT }), /Utilities need/);
  const portable = prepare({ objects: STARTER_LAYOUT, sanitation: terms({ utilities: false }) });
  assert.equal(sanitationPlanFor(portable).usableStalls, 4); assert.equal(sanitationPlanFor(portable).cost, 80);
  assert.equal(sanitationPlanFor(prepare()).cost, 380);
  const poor = prepare(); poor.cash = upfrontFor(poor) - 1; refused(poor, /before doors/);
  const blocked = [...layout, ...[[16,8],[17,8],[18,8],[16,11],[17,11],[18,11],[15,9],[15,10],[19,9],[19,10]].map(([x,y]) => ({ type:'restroom', x,y,rot:0 }))];
  const b = prepare({ objects: blocked, sanitation: terms({ preference: true }) });
  assert.equal(sanitationPlanFor(b).spec.trailerAccess, false); refused(b, /optional changing area/);
  assert.ok(validateLayout([...layout, { ...trailer, x: 5 }], { id: 'lot' }).problems.length);
  assert.ok(validateLayout([trailer], { id: 'club' }).problems.length);
  assert.equal(evaluateVenue({ id: 'lot', objects: layout }).watts - evaluateVenue({ id: 'lot', objects: STARTER_LAYOUT }).watts, 1500);
});

test('locked facilities survive replay and damaged geometry cannot earn the artist preference', () => {
  const s = act(open(prepare({ sanitation: terms({ preference: true }) })), { type: 'advanceLive', minute: 30 });
  assert.ok(applyAction(s, { type: 'setPromotion', sanitation: null }).error);
  const raw = structuredClone(s); raw.promotion.sanitation = null;
  raw.show.sanitation.cost = -99999; raw.show.sanitation.served = 99999;
  const n = normalizeState(raw);
  assert.deepEqual(liveServicesFor(n).sanitation, liveServicesFor(s).sanitation);
  assert.equal(n.cash, s.cash); assert.equal(sanitationPlanFor(n).cost, 380);
  raw.venue.objects = raw.venue.objects.filter(o => o.type !== 'trailer');
  const missing = normalizeState(raw);
  assert.equal(sanitationPlanFor(missing).preference.fulfilled, false);
  assert.equal(sanitationPlanFor(missing).cost, 380, 'quoted cost remains after lost geometry');
  for (const bad of [null, { ...terms(), version: 2, trailer: true }, { ...terms(), cleaner: 1, trailer: true }, terms()]) {
    const corrupt = structuredClone(s); corrupt.show.sanitation = bad;
    const recovered = normalizeState(corrupt);
    assert.equal(recovered.show.sanitation, undefined); assert.equal(recovered.show.serviceRecovered, true);
    assert.equal(recovered.cash, s.cash);
  }
});

test('both artist deals reconcile production costs, exact visit satisfaction and one signing', () => {
  for (const deal of ['door', 'guarantee']) {
    const prepared = prepare({ deal }), paid = open(prepared), finished = finish(paid), r = settlementFor(finished);
    assert.equal(prepared.cash - paid.cash, upfrontFor(prepared)); assert.equal(r.costs.facilities, 380);
    assert.equal(r.costs.total, Object.entries(r.costs).filter(([k]) => k !== 'total').reduce((sum, [,v]) => sum + v, 0));
    assert.equal(r.artistPay, deal === 'door' ? Math.round(DOOR_SPLIT * Math.max(0, r.ticketGross - r.costs.total)) : prepared.booking.terms.ask);
    const t = r.sanitation.totals; assert.equal(t.requested, r.attendance); assert.equal(t.served + t.lost, t.requested);
    assert.equal(t.waiting + t.using + t.pending, 0);
    assert.equal(r.parts.amenities, (r.services.barServed / r.attendance + t.served / t.requested) / 2);
    const signed = act(finished, { type: 'acceptSettlement', at: '2026-10-04T00:00:00Z' });
    assert.equal(signed.cash, prepared.cash + r.net);
    assert.equal(signed.cash, finished.cash + settlementPayout(r, deal));
    assert.ok(applyAction(signed, { type: 'acceptSettlement' }).error);
    assert.equal(normalizeState(signed).phase, 'done'); assert.deepEqual(settlementFor(normalizeState(signed)), r);
  }
});

test('accepted quiet changing area changes relationship only and decline has no penalty', () => {
  const a = finish(open(prepare())), b = finish(open(prepare({ sanitation: terms({ preference: true }) })));
  const x = settlementFor(a), y = settlementFor(b);
  assert.equal(x.preferenceBonus, 0); assert.equal(y.preferenceBonus, 2);
  assert.equal(y.relDelta, Math.min(REL_MAX_STEP, x.relDelta + 2));
  for (const key of ['net', 'artistPay', 'upfront', 'satisfaction', 'attendance']) assert.equal(x[key], y[key], key);
  refused(prepare({ sanitation: terms({ cleaner: false, preference: true }) }), /optional changing area/);
  refused(prepare({ sanitation: terms({ utilities: false, preference: true }) }), /optional changing area/);
});

test('cleaning progress, food ordering and optional legacy omission remain deterministic', () => {
  const objects = [...STARTER_LAYOUT.filter(o => o.type !== 'restroom'), { type: 'restroom', x:20,y:12,rot:0 }, { type:'food',x:3,y:8,rot:0 }];
  let s = open(prepare({ objects, foodPlan: 'standard', sanitation: terms({ utilities: false }), seed: 3 })), hadCleaning = false;
  for (let minute = 1; minute < 150; minute++) {
    s = act(s, { type:'advanceLive',minute });
    if (!s.show.responseId && s.show.services.minute < minute) {
      s = act(s, {type:'respond',responseId:INCIDENTS[s.show.incidentId].responses.find(r => r.cost <= s.cash).id});
      s = act(s, {type:'advanceLive',minute});
    }
    const live = liveServicesFor(s, {events:true}), t=live.sanitation.totals;
    assert.equal(t.pending+t.waiting+t.using+t.served+t.lost, live.admitted);
    assert.ok(live.food.totals.waiting + t.waiting + t.using <= live.admitted);
    if (live.sanitation.worker && !hadCleaning) {
      hadCleaning = true; assert.deepEqual(liveServicesFor(normalizeState(s), {events:true}), live);
    }
  }
  assert.ok(hadCleaning);
  const legacy = finish(open(prepare({objects:STARTER_LAYOUT, sanitation:null}))), r=settlementFor(legacy);
  assert.equal(r.costs.facilities, undefined); assert.equal(r.sanitation,undefined);
  assert.deepEqual(settlementFor(normalizeState(legacy)), r);
});
