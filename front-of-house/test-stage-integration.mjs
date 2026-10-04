// Optional Festival stages preserve legacy saves and reconcile opening, response and signing.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './engine.mjs';
import * as D from './data.mjs';
const act = (s, a) => { const r = E.applyAction(s, a); assert.equal(r.error, null, `${a.type}: ${r.error}`); if (r.state.cashJournal) assert.equal(E.careerLedgerFor(r.state).balance, r.state.cash); return r.state; };
function book(deal = 'guarantee', policy = true, seed = 8) {
  let s = act(E.createGame(seed, { mode: 'sandbox' }), { type: 'enableEquipment' });
  s = act(s, { type: 'chooseVenue', venueId: 'festival' });
  return act(s, { type: 'chooseDeal', deal: deal === 'door' ? 'guarantee' : deal, artistId: E.offersFor(s)[0], secondId: 'hollow-census', ...(policy ? { stagePolicy: 1 } : {}) });
}
function build(deal = 'guarantee', policy = true, seed = 8) {
  let s = book(deal, policy, seed);
  if (deal === 'door') {
    // Current Festival headliners require guarantees. Exercise a valid imported
    // door contract for a different, door-eligible act, not a player booking claim.
    s = E.normalizeState({ ...s, booking: { ...s.booking, artistId: 'salt-ledger', deal: 'door', terms: { ask: 1600, drawMult: 1 } }, promotion: { ...s.promotion, price: 28 } });
  }
  s = act(s, { type: 'setLayout', objects: D.FEST_STARTER }); return act(s, { type: 'confirmBuild' });
}
const open = s => act(s, { type: 'confirmPromotion' });
const finish = s => act(s, { type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses[0].id });
const sign = s => act(s, { type: 'acceptSettlement' });
function refuse(s, a, re) { const before = structuredClone(s), r = E.applyAction(s, a); assert.match(r.error, re); assert.deepEqual(r.state, before); assert.deepEqual(s, before); }
const clamp = x => Math.max(-100, Math.min(100, x));

test('unmarked Festival careers keep their earlier second stage and replay exactly', () => {
  for (const deal of ['guarantee', 'sponsor']) {
    const s = build(deal, false), ended = finish(open(s)), r = E.settlementFor(ended);
    assert.equal(E.stagePlanFor(s), null); assert.equal(E.stageForecastFor(s), null); assert.equal(r.stageAccounts, undefined);
    assert.ok(r.second); assert.equal(r.second.cash, r.second.ticketGross + r.second.bar - r.second.artistPay);
    for (const state of [s, open(s), ended, sign(ended)]) assert.deepEqual(E.settlementFor(E.normalizeState(state)), E.settlementFor(state));
  }
});
test('legal guarantee/sponsor and a controlled door contract reconcile all cash and artists once', () => {
  for (const deal of ['guarantee', 'sponsor', 'door']) for (const seed of [3, 8, 18]) {
    const start = build(deal, true, seed), opened = open(start), ended = finish(opened), r = E.settlementFor(ended), done = sign(ended), a = r.stageAccounts;
    assert.equal(opened.cash, start.cash - E.upfrontFor(start)); assert.equal(ended.cash, opened.cash - r.costs.incident);
    assert.equal(E.settlementPayout(r, deal), a.payout + a.siteCosts.incident);
    assert.equal(done.cash, start.cash + r.net); assert.equal(done.history.at(-1).artistPay, a.artistPay);
    assert.equal(r.artistPay, a.main.artistPay); assert.equal(r.ticketGross, a.main.ticketGross + a.second.ticketGross);
    assert.equal(r.attendance, a.main.attendance + a.second.attendance); assert.ok(r.attendance <= E.evaluateVenue(start.venue).capacity);
    assert.equal(r.costs.total, Object.entries(r.costs).filter(([key]) => key !== 'total').reduce((sum, [, value]) => sum + value, 0));
    assert.equal(done.reputation.artists[start.booking.artistId], clamp((start.reputation.artists[start.booking.artistId] || 0) + r.relDelta));
    assert.equal(done.reputation.artists[start.booking.secondId], clamp((start.reputation.artists[start.booking.secondId] || 0) + r.secondRelDelta));
    refuse(done, { type: 'acceptSettlement' }, /settle/);
    assert.deepEqual(E.settlementFor(E.normalizeState(done)), r);
  }
});
test('each paid incident is charged at response once and never again at signing', () => {
  for (const incident of D.VENUES.festival.incidents) for (const response of D.INCIDENTS[incident].responses) {
    const start = { ...build(), forcedIncident: incident }, opened = open(start), ended = act(opened, { type: 'respond', responseId: response.id }), r = E.settlementFor(ended), done = sign(ended);
    assert.equal(opened.show.incidentId, incident); assert.equal(opened.cash - ended.cash, response.cost);
    assert.equal(done.cash, start.cash + r.net); assert.equal(r.stageAccounts.siteCosts.incident, response.cost);
    refuse(ended, { type: 'respond', responseId: response.id }, /show/);
  }
});
test('opening includes both crews and the side rig; career cash gate includes them', () => {
  const stages = build(), legacy = build('guarantee', false);
  assert.equal(E.upfrontFor(stages) - E.upfrontFor(legacy), 925);
  const poor = E.normalizeState({ ...stages, mode: 'career', cash: E.upfrontFor(stages) - 1, cashJournal: undefined });
  refuse(poor, { type: 'confirmPromotion' }, /before doors/);
  assert.equal(open({ ...poor, cash: E.upfrontFor(stages) }).cash, 0);
});
test('doors freeze price and promotion; normalization ignores derived amounts', () => {
  const start = act(build(), { type: 'setPromotion', price: 100, ads: { [D.AD_CHANNELS[0]]: 100 } }), opened = open(start);
  const changed = structuredClone(opened); changed.promotion.price = 120; for (const c of D.AD_CHANNELS) changed.promotion.ads[c] = 400;
  changed.show.stages.net = 1e9; changed.show.stages.artistPay = 0;
  assert.deepEqual(E.settlementFor(finish(E.normalizeState(changed))), E.settlementFor(finish(opened)));
  refuse(opened, { type: 'setPromotion', price: 120 }, /promote/);
  assert.deepEqual(opened.show.stages.ads, start.promotion.ads);
});
test('public ranges ignore the seed and include every published draw corner', () => {
  const s = build(), q = E.stageForecastFor(s);
  assert.deepEqual(E.stageForecastFor({ ...s, seed: 99999 }), q);
  assert.deepEqual(E.forecast(s), { ...q.attendance, capacity: q.capacity });
  assert.ok(q.second.high <= D.VENUES.festival.secondCap); assert.ok(q.main.high <= q.capacity - D.VENUES.festival.secondCap);
  const high = E.stageForecastFor(act(s, { type: 'setPromotion', price: 120 })); assert.ok(high.attendance.low <= q.attendance.low);
});
test('two distinct acts and an eligible side door contract are required for opt-in', () => {
  let s = act(E.createGame(8, { mode: 'sandbox' }), { type: 'chooseVenue', venueId: 'festival' });
  const artistId = E.offersFor(s)[0], base = { type: 'chooseDeal', deal: 'guarantee', artistId, stagePolicy: 1 };
  for (const secondId of [undefined, artistId, 'north-kettle', 'missing']) refuse(s, { ...base, secondId }, /distinct|door deal/);
  refuse(s, { ...base, secondId: 'hollow-census', stagePolicy: 2 }, /door deal/);
  s.reputation.artists['hollow-census'] = -100; refuse(s, { ...base, secondId: 'hollow-census' }, /door deal/);
  const lot = E.createGame(8, { mode: 'sandbox' }); refuse(lot, { type: 'chooseDeal', deal: 'guarantee', secondId: 'hollow-census', stagePolicy: 1 }, /distinct|Festival/);
});
test('bad optional source recovers explicitly without changing paid cash or history', () => {
  const done = sign(finish(open(build())));
  for (const stages of [{ version: 2 }, { version: 1, price: -1, ads: {} }, { version: 1, price: 100, ads: {} }, { version: 1, price: 1000, ads: done.show.stages.ads }]) {
    const loaded = E.normalizeState({ ...done, show: { ...done.show, stages } });
    assert.equal(loaded.cash, done.cash); assert.deepEqual(loaded.history, done.history); assert.equal(loaded.show.stages, undefined); assert.match(loaded.stagesNotice, /cash and signed history/);
  }
  const badBill = E.normalizeState({ ...done, booking: { ...done.booking, secondId: done.booking.artistId } }); assert.equal(badBill.show.stages, undefined); assert.equal(badBill.cash, done.cash);
  const fresh = act(done, { type: 'nextShow' }); assert.equal(fresh.booking.stages, undefined); assert.equal(fresh.show, null);
  let s = act(act(build(), { type: 'back' }), { type: 'back' }); s = act(s, { type: 'chooseVenue', venueId: 'club' }); assert.equal(s.booking.stages, undefined);
});

test('an assigned owned main PA substitutes operation for rental without omitting site costs', () => {
  let s = act(book(), { type: 'back' });
  s = act(s, { type: 'equipment', command: { id: 'festival_buy', kind: 'buy', family: 'small-pa' } });
  s = act(s, { type: 'chooseDeal', deal: 'guarantee', artistId: E.offersFor(s)[0], secondId: 'hollow-census', stagePolicy: 1 });
  s = act(s, { type: 'setLayout', objects: [...D.FEST_STARTER, { type: 'pa-s', x: 15, y: 0, rot: 0 }] });
  const rental = act(s, { type: 'confirmBuild' });
  s = act(s, { type: 'assignEquipment', assetId: 'pa_1' });
  const missing = act(s, { type: 'setLayout', objects: D.FEST_STARTER });
  assert.doesNotThrow(() => E.upfrontFor(missing), 'a provisional invalid assignment must not crash Build');
  refuse(act(missing, { type: 'confirmBuild' }), { type: 'confirmPromotion' }, /assigned asset/);
  s = act(s, { type: 'confirmBuild' });
  assert.equal(E.upfrontFor(rental) - E.upfrontFor(s), D.PA_RENTAL.S - D.OWNED_EQUIPMENT['small-pa'].operation);
  const ended = finish(open(s)), r = E.settlementFor(ended), done = sign(ended);
  assert.equal(r.stageAccounts.production.main.pa, 0); assert.equal(r.stageAccounts.production.main.equipmentOperation, 20);
  assert.equal(r.costs.equipmentOperation, 20); assert.equal(done.cash, s.cash + r.net);
  assert.deepEqual(E.settlementFor(E.normalizeState(done)), r);
});
