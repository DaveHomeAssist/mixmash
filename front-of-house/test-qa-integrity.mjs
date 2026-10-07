// QA audit regressions (2026-10-07): one booking stays the same booking, reloads never change a
// career, Back and room switches leave no hidden settings, Start over respects unlocks and hostile
// ids cannot pass as rooms, acts or objects.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from './data.mjs';
import * as E from './engine.mjs';

const clone = (v) => JSON.parse(JSON.stringify(v));
const reload = (s) => E.normalizeState(E.migrateSave(clone(s)), 999);
const act = (s, a) => { const r = E.applyAction(s, a); assert.equal(r.error, null, `${a.type}: ${r.error}`); return r.state; };
const respond = (s) => act(s, { type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses[0].id });
// The Open doors button sends services only on the Lot.
const openDoors = (s) => E.applyAction(s, { type: 'confirmPromotion', services: false, pilot: false });

test('Back twice and rebooking keeps Loam Shell prices in range, and a reload keeps the paid seat terms', () => {
  let s = E.createGame(4242, { mode: 'sandbox' });
  s = act(s, { type: 'chooseVenue', venueId: 'amphitheater' });
  s = act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal: 'guarantee', seatingPolicy: 1 });
  s = act(s, { type: 'setLayout', objects: D.VENUES.amphitheater.starter });
  s = act(s, { type: 'confirmBuild' });
  s = act(s, { type: 'setPromotion', price: 80, seatPrice: 80 });
  s = act(act(s, { type: 'back' }), { type: 'back' });
  s = act(s, { type: 'chooseDeal', artistId: s.booking.artistId, deal: 'guarantee', seatingPolicy: 1 });
  assert.equal(s.promotion.seatPrice, D.VENUES.amphitheater.priceMax);
  s = act(act(s, { type: 'confirmBuild' }), { type: 'confirmPromotion' });
  assert.deepEqual(reload(s), s, 'the paid seat contract survives a reload');
  assert.equal(E.settlementFor(respond(reload(s))).net, E.settlementFor(respond(s)).net);
  const outOfRange = clone(s); outOfRange.phase = 'promote'; outOfRange.show = null; outOfRange.promotion.confirmed = false; outOfRange.promotion.seatPrice = 90;
  assert.match(E.applyAction(outOfRange, { type: 'confirmPromotion' }).error, /ticket prices/);
});

test('Lot-only settings stay on the Lot, so Fathom Hall doors open after a room switch', () => {
  let s = E.createGame(8); s.unlocks.club = true; s.cash = 20000;
  s = act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal: 'guarantee' });
  s = act(act(s, { type: 'setLayout', objects: D.STARTER_LAYOUT }), { type: 'confirmBuild' });
  s = act(s, { type: 'setPromotion', services: true, foodPlan: 'premium' });
  s = act(act(act(s, { type: 'back' }), { type: 'back' }), { type: 'chooseVenue', venueId: 'club' });
  assert.equal(s.promotion.foodPlan, undefined);
  assert.deepEqual(reload(s), s);
  s = act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal: 'guarantee', roomPolicy: 1 });
  s = act(act(s, { type: 'setLayout', objects: D.VENUES.club.starter.filter((o) => o.type !== 'lights') }), { type: 'confirmBuild' });
  assert.equal(openDoors(s).error, null);
});

test('Start over from a later room begins the new career on the Lot, and locked rooms cannot be booked', () => {
  let s = E.createGame(5); s.unlocks.club = true; s.cash = 20000;
  s = act(s, { type: 'chooseVenue', venueId: 'club' });
  s = act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal: 'guarantee', roomPolicy: 1 });
  const clubLayout = D.VENUES.club.starter.filter((o) => o.type !== 'lights');
  s = act(act(s, { type: 'setLayout', objects: clubLayout }), { type: 'confirmBuild' });
  s = act(respond(act(s, { type: 'confirmPromotion' })), { type: 'acceptSettlement' });
  const fresh = act(s, { type: 'retry' });
  assert.equal(fresh.venue.id, 'lot');
  assert.deepEqual(fresh.layouts.club, clubLayout, 'the Fathom Hall layout is kept for later');
  assert.deepEqual(E.offersFor(fresh), E.offersFor(E.createGame(fresh.seed)));
  const forced = clone(fresh); forced.venue = clone(s.venue);
  assert.match(E.applyAction(forced, { type: 'chooseDeal', artistId: E.offersFor(forced)[0], deal: 'door' }).error, /locked/);
});

test('a PA left behind by a removed stage is still there after a reload', () => {
  let s = E.createGame(3);
  s = act(act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal: 'door' }), { type: 'setLayout', objects: D.STARTER_LAYOUT });
  s = act(s, { type: 'remove', index: s.venue.objects.findIndex((o) => o.type === 'stage') });
  assert.deepEqual(reload(s).venue.objects, s.venue.objects);
  assert.equal(E.evaluateVenue(reload(s).venue).ready, false);
});

test('prototype names are not rooms, acts or objects', () => {
  const sandbox = E.createGame(1, { mode: 'sandbox' });
  for (const venueId of ['constructor', 'toString', '__proto__']) assert.ok(E.applyAction(sandbox, { type: 'chooseVenue', venueId }).error);
  const build = act(E.createGame(1), { type: 'chooseDeal', artistId: E.offersFor(E.createGame(1))[0], deal: 'guarantee' });
  for (const type of ['constructor', 'toString', 'valueOf']) assert.ok(E.applyAction(build, { type: 'place', object: { type, x: 3, y: 3, rot: 0 } }).error);
  const loaded = E.normalizeState({ ...E.createGame(5), venue: { id: 'constructor', objects: [] }, booking: { artistId: 'constructor' }, history: [{ venueId: 'toString' }] });
  assert.equal(loaded.venue.id, 'lot');
  assert.equal(loaded.booking.artistId, D.DEFAULT_ARTIST);
  assert.equal(loaded.history[0].venueId, 'lot');
});

test('the 200-show window is the same in memory and after a reload, and show numbers stay put', () => {
  let s = E.createGame(2026, { mode: 'sandbox' });
  for (let i = 0; i < 203; i += 1) {
    s = act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal: 'guarantee' });
    s = act(act(s, { type: 'setLayout', objects: D.STARTER_LAYOUT }), { type: 'confirmBuild' });
    s = act(respond(act(s, { type: 'confirmPromotion' })), { type: 'acceptSettlement' });
    if (i < 202) s = act(s, { type: 'nextShow' });
  }
  assert.equal(s.history.length, 200);
  assert.deepEqual([s.history[0].showId, s.history.at(-1).showId], [4, 203]);
  assert.deepEqual(reload(s).history, s.history);
});

// Seeded adversarial careers: after every accepted action the saved game loads back unchanged,
// cash matches the journal and opening, response and signing charges equal their quotes.
test('random careers reload unchanged after every accepted action', () => {
  const garbage = [undefined, null, NaN, -1, 0.5, 41, 1e308, '20', 'constructor', {}];
  for (let career = 1; career <= 60; career += 1) {
    const r = E.mulberry32(career * 7919 + 13), pick = (list) => list[Math.floor(r() * list.length)];
    let s = E.createGame(career, { mode: career % 3 ? 'career' : 'sandbox' });
    if (career % 2) { s.cash = 400000; s.unlocks = { club: true, amphitheater: true, festival: true, complete: false }; }
    for (let step = 0; step < 300; step += 1) {
      const spec = E.venueSpec(s.venue), bad = r() < 0.2;
      const options = {
        book: [() => ({ type: 'chooseVenue', venueId: pick(D.VENUE_ORDER) }), () => {
          const a = { type: 'chooseDeal', artistId: pick(E.offersFor(s)), deal: pick(spec.sponsor ? ['guarantee', 'door', 'sponsor'] : ['guarantee', 'door']) };
          if (spec.id !== 'lot') a.roomPolicy = 1;
          if (spec.id === 'amphitheater') { a.seatingPolicy = 1; a.nights = pick([1, 2, 3]); if (a.nights > 1) a.runPolicy = 1; }
          if (spec.id === 'festival') { a.secondId = pick(E.stageOpenersFor(s).concat('north-kettle')); a.stagePolicy = 1; }
          return a;
        }],
        build: [() => ({ type: 'setLayout', objects: pick([spec.starter, spec.cheapest]) }), () => ({ type: 'remove', index: Math.floor(r() * 4) }),
          () => ({ type: 'place', object: { type: pick(Object.keys(D.OBJECT_TYPES)), x: Math.floor(r() * spec.grid.w), y: Math.floor(r() * spec.grid.h), rot: Math.floor(r() * 4) } }),
          () => ({ type: 'confirmBuild' }), () => ({ type: 'back' })],
        promote: [() => ({ type: 'setPromotion', price: bad ? pick(garbage) : D.PRICE_MIN + Math.floor(r() * 30), ...(spec.seats ? { seatPrice: D.PRICE_MIN + Math.floor(r() * 50) } : {}), ...(spec.id === 'lot' ? { foodPlan: pick([null, 'standard']), services: r() < 0.5 } : {}) }),
          () => ({ type: 'confirmPromotion', services: false, pilot: false }), () => ({ type: 'back' })],
        show: [() => ({ type: 'respond', responseId: bad ? pick(garbage) : pick(D.INCIDENTS[s.show.incidentId].responses).id })],
        settle: [() => ({ type: 'acceptSettlement', cancelRemaining: r() < 0.2 })],
        done: [() => ({ type: pick(['nextShow', 'nextShow', 'retry']) })],
      }[s.phase];
      const action = pick(options)();
      const res = E.applyAction(s, action);
      if (res.error) { assert.equal(res.state, s); continue; }
      const n = res.state;
      assert.deepEqual(reload(n), n, `career ${career} step ${step}: ${action.type} reloads unchanged`);
      if (n.cashJournal) assert.equal(E.careerLedgerFor(n).balance, n.cash);
      if (action.type === 'confirmPromotion') assert.equal(s.cash - n.cash, E.upfrontFor(s));
      if (action.type === 'acceptSettlement') {
        const penalty = action.cancelRemaining && E.heldRunFor(s)?.remaining ? E.heldRunFor(s).penalty : 0;
        assert.equal(n.cash, s.cash + E.settlementPayout(E.settlementFor(s), s.booking.deal) - penalty - (n.phase === 'show' ? E.upfrontFor(n) : 0));
      }
      if (n.mode === 'career' && n.phase !== 'book') assert.ok(n.venue.id === 'lot' || n.unlocks[n.venue.id], 'no booking in a locked room');
      s = n;
    }
  }
});
