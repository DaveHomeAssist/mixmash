// Versioned Festival touring requirements, shared-site receipts and save preservation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './engine.mjs';
import * as D from './data.mjs';
const act = (s, a) => { const r = E.applyAction(s, a); assert.equal(r.error, null, `${a.type}: ${r.error}`); if (r.state.cashJournal) assert.equal(E.careerLedgerFor(r.state).balance, r.state.cash); return r.state; };
const refuse = (s, a, pattern) => { const before = structuredClone(s), r = E.applyAction(s, a); assert.match(r.error, pattern); assert.deepEqual(r.state, before); };
const layout = [...D.FEST_STARTER, ...D.FESTIVAL_SUPPORT_LAYOUT];
function book(marked = true, deal = 'guarantee', seed = 8) {
  let s = act(E.createGame(seed, { mode: 'sandbox' }), { type: 'enableEquipment' });
  s = act(s, { type: 'chooseVenue', venueId: 'festival' });
  let artistId = E.offersFor(s)[0];
  if (deal === 'door') { s.reputation.artists['salt-ledger'] = 20; while (!E.offersFor(s).includes('salt-ledger')) s.seed++; artistId = 'salt-ledger'; }
  return act(s, { type: 'chooseDeal', artistId, secondId: 'hollow-census', deal, stagePolicy: 1, festivalPolicy: 1, roomPolicy: 1, curfewPolicy: 1, ...(marked ? { supportPolicy: 1 } : {}) });
}
const build = (marked = true, deal = 'guarantee', seed = 8) => act(book(marked, deal, seed), { type: 'setLayout', objects: marked ? layout : D.FEST_STARTER });
const open = s => act(act(s, { type: 'confirmBuild' }), { type: 'confirmPromotion' });
const finish = s => act(s, { type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses.at(-1).id });

test('new marked bookings need both fixtures; legacy layout and contract remain usable', () => {
  const s = act(book(), { type: 'setLayout', objects: D.FEST_STARTER });
  assert.deepEqual(E.evaluateVenue(s.venue).missing, ['Place the VIP deck for touring hospitality', 'Place the bus compound for the touring bill']);
  refuse(s, { type: 'confirmBuild' }, /VIP deck.*bus compound/);
  const deck = act(s, { type: 'place', object: D.FESTIVAL_SUPPORT_LAYOUT[0] });
  refuse(deck, { type: 'confirmBuild' }, /bus compound/);
  assert.equal(E.evaluateVenue(build().venue).ready, true);
  assert.equal(E.evaluateVenue(build(false).venue).ready, true);
  refuse(build(false), { type: 'place', object: D.FESTIVAL_SUPPORT_LAYOUT[0] }, /new Festival booking/);
  const lot = E.createGame(1, { mode: 'sandbox' });
  for (const supportPolicy of [null, 0, 1, 2, '1']) refuse(lot, { type: 'chooseDeal', deal: 'guarantee', supportPolicy }, /touring policy/);
  for (const venue of ['lot', 'club', 'amphitheater']) for (const object of D.FESTIVAL_SUPPORT_LAYOUT) assert.match(E.validateLayout([object], { id: venue }).problems[0].message, /only at the Festival/);
});
test('support uses ordinary grid overlap, bounds, rotations, limits and power checks', () => {
  const s = build(), v = E.evaluateVenue(s.venue), old = E.evaluateVenue(build(false).venue);
  assert.equal(old.openFloorTiles - v.openFloorTiles, 30); assert.equal(v.watts - old.watts, 8000);
  assert.ok(v.clearTiles <= old.clearTiles); assert.equal(v.vipDecks, 1); assert.equal(v.busCompounds, 1);
  for (const [type, size] of [['vip-deck', 12], ['bus-compound', 18]]) for (let rot = 0; rot < 4; rot++) {
    const object = { type, x: 25, y: 16, rot };
    assert.equal(E.footprint(object).length, size);
    assert.equal(E.validatePlacement([object], s.venue).problems.length, 0);
    refuse(s, { type: 'place', object }, /Only 1/);
    refuse(book(), { type: 'place', object: { ...object, x: 39, y: 23 } }, /does not fit/);
    refuse(s, { type: 'place', object: { ...object, x: 16, y: 0 } }, /overlaps/);
  }
  const bars = Array.from({ length: 163 }, (_, i) => ({ type: 'bar', x: (i % 20) * 2, y: 5 + Math.floor(i / 20), rot: 0 }));
  assert.match(E.validatePlacement([...bars, D.FESTIVAL_SUPPORT_LAYOUT[1]], s.venue).problems.at(-1).message, /power budget/);
  const removed = act(s, { type: 'remove', index: s.venue.objects.findIndex(o => o.type === 'vip-deck') });
  assert.equal(E.evaluateVenue(removed.venue).ready, false); assert.equal(E.evaluateVenue(removed.venue).vipDeckCost, 0);
});
test('support rentals are exactly1500 once at opening and shared between both stages', () => {
  for (const deal of ['guarantee', 'sponsor', 'door']) for (const seed of [3, 8, 18]) {
    const s = build(true, deal, seed), legacy = build(false, deal, seed);
    assert.equal(E.upfrontFor(s) - E.upfrontFor(legacy), 1500);
    assert.equal(E.nextShowCost(s) - E.nextShowCost(legacy), 1500);
    const opened = open(s), ended = finish(opened), r = E.settlementFor(ended), done = act(ended, { type: 'acceptSettlement' }), a = r.stageAccounts;
    assert.equal(r.costs.vipDeck, 600); assert.equal(r.costs.busCompound, 900);
    assert.equal(a.siteCosts.vipDeck, 600); assert.equal(a.siteCosts.busCompound, 900);
    assert.equal(a.sharedTotal, Object.values(a.siteCosts).reduce((sum, n) => sum + n, 0));
    assert.equal(a.main.allocatedSiteCost + a.second.allocatedSiteCost, a.sharedTotal);
    assert.equal(r.costs.total, Object.entries(r.costs).filter(([key]) => key !== 'total').reduce((sum, [, n]) => sum + n, 0));
    assert.equal(opened.cash, s.cash - E.upfrontFor(s)); assert.equal(ended.cash, opened.cash - r.costs.incident);
    assert.equal(done.cash, s.cash + r.net); assert.equal(r.attendance, a.main.attendance + a.second.attendance);
    assert.equal(r.ticketGross, r.attendance * a.sales.price); assert.deepEqual(E.settlementFor(E.normalizeState(done)), r);
    for (const state of [s, opened, ended, done]) assert.deepEqual(E.settlementFor(E.normalizeState(state)), E.settlementFor(state));
    refuse(done, { type: 'acceptSettlement' }, /settle/);
  }
});
test('opening affordability includes support without a second charge after reload', () => {
  const s = act(build(), { type: 'confirmBuild' }), cost = E.upfrontFor(s);
  const poor = E.normalizeState({ ...s, mode: 'career', cash: cost - 1, cashJournal: undefined });
  refuse(poor, { type: 'confirmPromotion' }, /before doors/);
  const paid = act({ ...poor, cash: cost }, { type: 'confirmPromotion' });
  assert.equal(paid.cash, 0); assert.equal(E.normalizeState(paid).cash, 0);
  refuse(paid, { type: 'chooseDeal', deal: 'sponsor', supportPolicy: 1 }, /book/);
});
test('support markers normalize from version only, preserve paid history and reset with room changes', () => {
  const done = act(finish(open(build())), { type: 'acceptSettlement' });
  const derived = E.normalizeState({ ...done, venue: { ...done.venue, support: { version: 1, cost: 0, income: 1e9 } } });
  assert.deepEqual(derived.venue.support, { version: 1 }); assert.deepEqual(E.settlementFor(derived), E.settlementFor(done));
  for (const support of [null, [], { version: 2 }, { version: '1' }]) {
    const loaded = E.normalizeState({ ...done, venue: { ...done.venue, support } });
    assert.equal(loaded.venue.support, undefined); assert.match(loaded.supportNotice, /paid cash and history/);
    assert.equal(loaded.cash, done.cash); assert.deepEqual(loaded.history, done.history); assert.equal(E.careerLedgerFor(loaded).balance, done.cash);
  }
  const fresh = act(done, { type: 'nextShow' }); assert.deepEqual(fresh.venue.support, { version: 1 });
  const lot = act(fresh, { type: 'chooseVenue', venueId: 'lot' }); assert.equal(lot.venue.support, undefined);
  const returned = E.normalizeState(act(lot, { type: 'chooseVenue', venueId: 'festival' }));
  assert.equal(returned.venue.objects.filter(o => D.OBJECT_TYPES[o.type].supportOnly).length, 2, 'cached layout survives room change and reload');
  assert.equal(returned.venue.support, undefined); assert.equal(E.normalizeState(build(false)).venue.support, undefined);
});
