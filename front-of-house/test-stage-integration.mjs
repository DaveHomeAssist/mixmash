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

test('Book selects an eligible prior-tier side act without charging or silently freezing a deal', () => {
  let s = act(E.createGame(8, { mode: 'sandbox' }), { type: 'chooseVenue', venueId: 'festival' });
  const offers = E.stageOpenersFor(s); assert.equal(offers[0], 'hollow-census'); assert.ok(offers.includes('salt-ledger'));
  for (const id of offers) assert.equal(E.termsFor(id, s.reputation.artists[id]).doorOk, true);
  const before = s.cash; s = act(s, { type: 'chooseSideAct', artistId: 'salt-ledger' });
  assert.equal(s.cash, before); assert.equal(s.booking.secondTerms, null); assert.equal(E.normalizeState(s).booking.secondId, 'salt-ledger');
  refuse(s, { type: 'chooseSideAct', artistId: 'paper-voltage' }, /eligible/);
  s = act(s, { type: 'chooseDeal', deal: 'guarantee', artistId: E.offersFor(s)[0], secondId: s.booking.secondId, stagePolicy: 1 });
  refuse(s, { type: 'chooseSideAct', artistId: 'hollow-census' }, /book/);
  s = act(s, { type: 'back' }); s = act(s, { type: 'chooseSideAct', artistId: 'hollow-census' }); assert.equal(s.booking.stages, undefined);
});
test('the next Festival minimum matches a bookable sponsored day including both production budgets', () => {
  const done = sign(finish(open(build()))), quote = E.nextShowCost(done), fresh = act(done, { type: 'nextShow' });
  const quotes = E.offersFor(fresh).map(artistId => {
    let s = act(fresh, { type: 'chooseDeal', deal: 'sponsor', artistId, secondId: E.stageOpenersFor(fresh)[0], stagePolicy: 1 });
    s = act(s, { type: 'setLayout', objects: D.VENUES.festival.cheapest }); return E.upfrontFor(s);
  });
  assert.equal(quote, Math.min(...quotes));
});
test('soured side acts disappear from eligible choices while changing venues remains available', () => {
  let s = act(E.createGame(8, { mode: 'sandbox' }), { type: 'chooseVenue', venueId: 'festival' });
  for (const id of E.stageOpenersFor(s)) s.reputation.artists[id] = -100;
  assert.deepEqual(E.stageOpenersFor(s), []); refuse(s, { type: 'chooseSideAct', artistId: 'hollow-census' }, /eligible/);
  s = act(s, { type: 'chooseVenue', venueId: 'club' }); assert.equal(s.venue.id, 'club');
});

function constrained(deal = 'sponsor') {
  let s = act(E.createGame(8, { mode: 'sandbox' }), { type: 'enableEquipment' });
  s = act(s, { type: 'chooseVenue', venueId: 'festival' });
  s = act(s, { type: 'chooseDeal', deal, artistId: E.offersFor(s)[0], secondId: 'hollow-census', stagePolicy: 1, festivalPolicy: 1 });
  return act(act(s, { type: 'setLayout', objects: D.FEST_STARTER }), { type: 'confirmBuild' });
}
test('Festival offers require +20 for earlier-tier headliners without inflating their draw', () => {
  const base = act(E.createGame(8, { mode: 'sandbox' }), { type: 'chooseVenue', venueId: 'festival' });
  for (let seed = 1; seed <= 60; seed++) assert.deepEqual(new Set(E.offersFor({ ...base, seed })), new Set(D.FEST_HEADLINERS));
  for (const id of [...D.ROSTER, ...D.CLUB_ROSTER, ...D.AMP_ROSTER]) {
    const seen = new Set();
    for (const rel of [19, 20, 21]) for (let seed = 1; seed <= 60; seed++) {
      const s = { ...base, seed, reputation: { ...base.reputation, artists: { [id]: rel } } }, offers = E.offersFor(s);
      assert.deepEqual(E.offersFor(s), offers);
      if (rel === 19) assert.equal(offers.includes(id), false);
      else if (offers.includes(id)) {
        seen.add(rel);
        const side = E.stageOpenersFor(s).find(side => side !== id);
        const booked = act(s, { type: 'chooseDeal', artistId: id, secondId: side, deal: 'guarantee', stagePolicy: 1, festivalPolicy: 1 });
        assert.equal(booked.booking.terms.drawMult, E.termsFor(id, rel).drawMult);
        const fallen = E.normalizeState({ ...booked, reputation: { ...booked.reputation, artists: { [id]: -100 } } });
        assert.deepEqual(fallen.booking, booked.booking, 'accepted booking survives a later relationship change');
        if (E.stageOpenersFor(s).includes(id)) refuse(s, { type: 'chooseDeal', artistId: id, secondId: id, deal: 'guarantee', stagePolicy: 1, festivalPolicy: 1 }, /distinct/);
      }
    }
    assert.deepEqual(seen, new Set([20, 21]), id);
  }
});
test('new sponsor contracts fix tickets, allow ads, freeze at doors and pay once', () => {
  let s = constrained(), fixed = D.ARTISTS[s.booking.artistId].fairPrice;
  assert.deepEqual(E.festivalPolicyFor(s), { version: 1, sponsorPrice: fixed });
  assert.equal(s.promotion.price, fixed); refuse(s, { type: 'setPromotion', price: fixed + 1 }, /sponsor contract/);
  s = act(s, { type: 'setPromotion', ads: { [D.AD_CHANNELS[0]]: 100 } });
  const restored = E.normalizeState({ ...s, promotion: { ...s.promotion, price: fixed + 1 } });
  assert.equal(restored.promotion.price, fixed); assert.equal(restored.cash, s.cash); assert.match(restored.stagesNotice, /Restored/);
  refuse({ ...s, promotion: { ...s.promotion, price: fixed + 1 } }, { type: 'confirmPromotion' }, /sponsor ticket/);
  const opened = open(s); assert.deepEqual(opened.show.festival, s.booking.festival);
  const changed = structuredClone(opened); changed.promotion.price = fixed + 1;
  assert.deepEqual(E.settlementFor(finish(E.normalizeState(changed))), E.settlementFor(finish(opened)));
  const ended = finish(opened), r = E.settlementFor(ended), done = sign(ended);
  assert.equal(r.sponsor, D.SPONSOR_PAY); assert.equal(done.cash, s.cash + r.net);
  assert.deepEqual(E.settlementFor(E.normalizeState(done)), r); refuse(done, { type: 'acceptSettlement' }, /settle/);
  assert.equal(act(done, { type: 'nextShow' }).booking.festival, undefined);
});
test('unmarked sponsors and new guarantee contracts retain adjustable prices', () => {
  for (const s of [build('sponsor'), build('sponsor', false), constrained('guarantee')]) {
    const changed = act(s, { type: 'setPromotion', price: 119 });
    assert.equal(E.normalizeState(changed).promotion.price, 119); assert.equal(open(changed).show.stages?.price ?? changed.promotion.price, 119);
  }
  let s = act(act(constrained(), { type: 'back' }), { type: 'back' });
  s = act(s, { type: 'chooseSideAct', artistId: 'salt-ledger' }); assert.equal(s.booking.festival, undefined);
  s = act(s, { type: 'chooseDeal', deal: 'guarantee', artistId: E.offersFor(s)[0], secondId: 'salt-ledger', stagePolicy: 1 });
  assert.equal(s.booking.festival, undefined);
});
test('invalid Festival policy is rejected or recovered without rewriting paid money', () => {
  const fresh = act(E.createGame(8, { mode: 'sandbox' }), { type: 'chooseVenue', venueId: 'festival' });
  refuse(fresh, { type: 'chooseDeal', deal: 'sponsor', festivalPolicy: 1 }, /needs stage/);
  refuse(fresh, { type: 'chooseDeal', deal: 'sponsor', secondId: 'hollow-census', stagePolicy: 1, festivalPolicy: 2 }, /Unknown/);
  const done = sign(finish(open(constrained())));
  for (const festival of [{ version: 2 }, { version: 1 }, { version: 1, sponsorPrice: -1 }]) {
    const loaded = E.normalizeState({ ...done, show: { ...done.show, festival } });
    assert.equal(loaded.show.festival, undefined); assert.equal(loaded.cash, done.cash); assert.deepEqual(loaded.history, done.history);
    assert.deepEqual(E.settlementFor(loaded), E.settlementFor(done)); assert.match(loaded.stagesNotice, /paid Festival condition/);
  }
});
test('trusted main offers use the same next-day affordability pool with a distinct side act', () => {
  const done = sign(finish(open(constrained())));
  for (const id of [...D.ROSTER, ...D.CLUB_ROSTER, ...D.AMP_ROSTER]) done.reputation.artists[id] = 20;
  for (let seed = 1; seed <= 60; seed++) {
    const prior = { ...done, seed }, fresh = act(prior, { type: 'nextShow' });
    const costs = E.offersFor(fresh).map(artistId => {
      let s = act(fresh, { type: 'chooseDeal', artistId, secondId: E.stageOpenersFor(fresh).find(id => id !== artistId), deal: 'sponsor', stagePolicy: 1, festivalPolicy: 1 });
      s = act(s, { type: 'setLayout', objects: D.VENUES.festival.cheapest }); return E.upfrontFor(s);
    });
    assert.equal(E.nextShowCost(prior), Math.min(...costs));
  }
});
test('no willing side act allows a free return to venue selection even without Festival cash', () => {
  const done = sign(finish(open(constrained())));
  for (const id of E.stageOpenersFor(done)) done.reputation.artists[id] = -100;
  const poor = E.normalizeState({ ...done, mode: 'career', cash: 0, cashJournal: undefined });
  assert.ok(E.nextShowCost(poor) > poor.cash); assert.deepEqual(E.stageOpenersFor(poor), []);
  const fresh = act(poor, { type: 'nextShow' }); assert.equal(fresh.phase, 'book'); assert.equal(fresh.cash, 0); assert.deepEqual(fresh.history, poor.history);
  assert.equal(act(fresh, { type: 'chooseVenue', venueId: 'lot' }).venue.id, 'lot');
});
