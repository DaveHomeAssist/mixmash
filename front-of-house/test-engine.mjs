import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as D from './data.mjs';
import {
  applyAction, buzz, careerProgress, cheapestShowCost, createGame, doorRushPilot, evaluateShow, evaluateVenue, forecast, migrateSave,
  nextSeed, nextShowCost, normalizeState, offersFor, termsFor,
  presaleSplit, priceFactor, rollShow, incidentAtFor, settlementFor, settlementPayout, showPreview, sightlineTiles, upfrontFor, validateLayout,
} from './engine.mjs';
import { REFERENCE_ADS, REFERENCE_LAYOUT, WORKED_EXAMPLE } from './sim/reference.mjs';
import { BINDINGS, binding, clashes, matches, reservedKeys } from './controls.mjs';

// Runs a list of actions and fails the test on the first engine error.
function run(state, actions) {
  return actions.reduce((s, action) => {
    const { state: next, error } = applyAction(s, action);
    assert.equal(error, null, `${action.type}: ${error}`);
    return next;
  }, state);
}

function builtGame(seed, deal = 'door') {
  return run(createGame(seed), [
    { type: 'chooseDeal', deal },
    ...REFERENCE_LAYOUT.map((object) => ({ type: 'place', object })),
    { type: 'confirmBuild' },
    { type: 'setPromotion', price: 20, ads: REFERENCE_ADS },
  ]);
}

function venueWith(objects) {
  return evaluateVenue({ objects });
}

test('R-WORKED-01: the RULES.md worked example matches to the dollar', () => {
  const guarantee = evaluateShow({ ...WORKED_EXAMPLE, deal: 'guarantee' });
  const door = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door' });
  assert.equal(guarantee.buzz.toFixed(4), '1.2482');
  assert.equal(guarantee.demand.toFixed(2), '124.82');
  assert.equal(guarantee.presale, 65);
  assert.equal(guarantee.walkup, 60);
  assert.equal(guarantee.attendance, 125);
  assert.equal(guarantee.satisfaction, 85);
  assert.equal(guarantee.ticketGross, 2500);
  assert.equal(guarantee.bar, 638);
  assert.equal(guarantee.costs.staff, 450);
  assert.equal(guarantee.costs.total, 2390);
  assert.equal(guarantee.upfront, 2890);
  assert.equal(door.upfront, 2390);
  assert.equal(guarantee.artistPay, 500);
  assert.equal(door.artistPay, 77);
  assert.equal(guarantee.net, 248);
  assert.equal(door.net, 671);
  assert.equal(guarantee.result, 'pass');
  assert.equal(door.result, 'pass');
  assert.equal(guarantee.repDelta, 13);
  assert.equal(guarantee.relDelta, 5);
  assert.equal(door.relDelta, -12);
});

test('R-01: capacity is the smallest of permit, floor and exits', () => {
  const ref = venueWith(REFERENCE_LAYOUT);
  assert.equal(ref.capacity, D.PERMIT_CAP);
  assert.equal(ref.capacityLimit, 'permit');
  const twoExits = venueWith(REFERENCE_LAYOUT.filter((o) => !(o.type === 'exit' && o.y === 14)));
  assert.equal(twoExits.capacity, 2 * D.EXIT_CAPACITY);
  assert.equal(twoExits.capacityLimit, 'exits');
  const noExits = venueWith(REFERENCE_LAYOUT.filter((o) => o.type !== 'exit'));
  assert.equal(noExits.capacity, 0);
  assert.equal(noExits.ready, false);
});

test('R-02: placements over the generator budget are rejected and named', () => {
  let s = run(createGame(1), [{ type: 'chooseDeal', deal: 'door' }]);
  s = run(s, [
    { type: 'place', object: { type: 'stage', x: 9, y: 0, rot: 0 } },
    { type: 'place', object: { type: 'pa-m', x: 8, y: 0, rot: 0 } },
    { type: 'place', object: { type: 'lights', x: 15, y: 0, rot: 0 } },
    ...[4, 6, 8, 10].map((y) => ({ type: 'place', object: { type: 'bar', x: 1, y, rot: 0 } })),
  ]);
  assert.equal(evaluateVenue(s.venue).watts, D.GENERATOR_WATTS);
  const { error } = applyAction(s, { type: 'place', object: { type: 'bar', x: 1, y: 12, rot: 0 } });
  assert.match(error, /Bar would draw 21500 W, over the 20000 W generator/);
});

test('R-03: blocking objects in front of the stage cost sightline tiles', () => {
  const open = venueWith(REFERENCE_LAYOUT);
  const blocked = venueWith([...REFERENCE_LAYOUT, { type: 'restroom', x: 12, y: 4, rot: 0 }]);
  assert.ok(open.clearTiles > 0);
  assert.ok(blocked.clearTiles < open.clearTiles - 1, 'a restroom in front shadows the tiles behind it');
  assert.equal(sightlineTiles({ objects: REFERENCE_LAYOUT }).clear.size, open.clearTiles);
  assert.equal(open.blockedTiles, 0, 'nothing blocks the suggested layout');
  assert.ok(blocked.blockedTiles > 0, 'the restroom casts a sightline shadow');
  assert.equal(sightlineTiles({ objects: [...REFERENCE_LAYOUT, { type: 'restroom', x: 12, y: 4, rot: 0 }] }).blocked.size, blocked.blockedTiles);
  const noStage = venueWith(REFERENCE_LAYOUT.filter((o) => o.type !== 'stage'));
  assert.equal(noStage.clearTiles, 0);
  const show = (clearTiles) => evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', venue: { ...WORKED_EXAMPLE.venue, clearTiles } });
  assert.equal(show(50).parts.sightlines, 0.6);
  assert.equal(show(500).parts.sightlines, 1);
});

test('R-04 and R-05: price factor and buzz follow their curves', () => {
  assert.equal(priceFactor(20, 20), 1);
  assert.equal(priceFactor(10, 20), 1.25);
  assert.equal(priceFactor(40, 20), 0.5);
  assert.equal(priceFactor(40, 10), D.PRICE_FLOOR);
  assert.equal(buzz({ flyers: 0, social: 0, radio: 0 }), 1);
  const max = 1 + D.AD_REACH.flyers + D.AD_REACH.social + D.AD_REACH.radio;
  assert.ok(buzz({ flyers: 1e6, social: 1e6, radio: 1e6 }) <= max);
  assert.ok(buzz({ social: 600 }) - buzz({ social: 300 }) < buzz({ social: 300 }) - buzz({}), 'each dollar adds less');
});

test('R-07: presales are capped by capacity and walk-up takes the rest', () => {
  assert.deepEqual(presaleSplit(400, 1.7, 300), { share: 0.75, presale: 300, walkup: 100 });
  const { presale, walkup } = presaleSplit(100, 1, 300);
  assert.equal(presale + walkup, 100);
});

test('R-09 and R-10: a missing light rig and too few bars cost satisfaction and bar money', () => {
  const base = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door' });
  const noLights = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', venue: { ...WORKED_EXAMPLE.venue, lights: 0 } });
  assert.equal(noLights.parts.sound, D.NO_LIGHTS_MULT);
  assert.equal(noLights.costs.lights, 0);
  assert.ok(noLights.satisfaction < base.satisfaction);
  const busy = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', draw: D.ARTISTS[D.DEFAULT_ARTIST].drawMax, venue: { ...WORKED_EXAMPLE.venue, clearTiles: 120 } });
  assert.ok(busy.attendance > D.BAR_RATIO);
  const overflow = busy.attendance - D.BAR_RATIO;
  assert.equal(busy.bar, Math.round(D.BAR_NET_PER_HEAD * (busy.satisfaction / 100) * (D.BAR_RATIO + overflow * D.BAR_SHORTFALL)));
  const justUnder = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', draw: 100 });
  const justOver = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', draw: 101 });
  assert.ok(justOver.attendance > D.BAR_RATIO && justUnder.attendance <= D.BAR_RATIO);
  assert.ok(justOver.bar >= justUnder.bar, 'one bar too few reduces only the overflow, with no cliff');
});

test('R-11: incident responses change walk-up, entry flow and the incident score', () => {
  const rain = (responseId) => evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', incidentId: 'rain', responseId });
  assert.ok(rain('ride-out').attendance < rain('canopy').attendance);
  assert.equal(rain('canopy').costs.incident, D.INCIDENTS.rain.responses.find((r) => r.id === 'canopy').cost);
  const jam = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', incidentId: 'gate-jam', responseId: 'ride-out' });
  assert.equal(jam.parts.flow, 0.6);
  const calm = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', incidentId: null, responseId: null });
  assert.equal(calm.parts.incident, 1);
});

test('R-12: a show that costs more up front than the cash on hand cannot start', () => {
  let s = builtGame(7, 'guarantee');
  s = { ...s, cash: upfrontFor(s) - 1 };
  const { error } = applyAction(s, { type: 'confirmPromotion' });
  assert.match(error, /needs \$\d+ before doors/);
});

test('R-12: an incident response the player cannot afford is refused', () => {
  let seed = 1;
  while (rollShow(seed).incidentId !== 'rain') seed += 1;
  let s = run(builtGame(seed, 'guarantee'), [{ type: 'confirmPromotion' }]);
  s = { ...s, cash: 100 };
  assert.match(applyAction(s, { type: 'respond', responseId: 'canopy' }).error, /costs \$250/);
  assert.equal(applyAction(s, { type: 'respond', responseId: 'ride-out' }).error, null);
});

test('R-18: placement rules reject bad positions', () => {
  const s = run(createGame(1), [
    { type: 'chooseDeal', deal: 'door' },
    { type: 'place', object: { type: 'stage', x: 9, y: 0, rot: 0 } },
  ]);
  const err = (object) => applyAction(s, { type: 'place', object }).error;
  assert.match(err({ type: 'gate', x: 5, y: 5 }), /lot boundary/);
  assert.match(err({ type: 'restroom', x: 9, y: 1 }), /overlaps/);
  assert.match(err({ type: 'pa-s', x: 2, y: 2 }), /touch the stage/);
  assert.match(err({ type: 'bar', x: 23, y: 3, rot: 0 }), /does not fit/);
  assert.match(err({ type: 'disco-ball', x: 1, y: 1 }), /Unknown object type/);
  const withPa = run(s, [{ type: 'place', object: { type: 'pa-s', x: 8, y: 0 } }]);
  assert.match(applyAction(withPa, { type: 'place', object: { type: 'pa-m', x: 15, y: 0 } }).error, /Only one PA/);
  assert.match(applyAction(s, { type: 'confirmBuild' }).error, /Rent a PA/);
});

test('a full show runs from Book to Settle and the cash adds up', () => {
  const seed = 42;
  const start = builtGame(seed, 'guarantee');
  const roll = rollShow(seed);
  const responseId = D.INCIDENTS[roll.incidentId].responses[0].id;
  const settled = run(start, [{ type: 'confirmPromotion' }, { type: 'respond', responseId }]);
  assert.equal(settled.phase, 'settle');
  const sheet = settlementFor(settled);
  const done = run(settled, [{ type: 'acceptSettlement', at: '2026-10-01T00:00:00.000Z' }]);
  assert.equal(done.phase, 'done');
  assert.equal(done.cash, D.START_CASH + sheet.net);
  assert.equal(done.history.length, 1);
  assert.equal(done.history[0].net, sheet.net);
  assert.equal(done.history[0].result, sheet.result);
  assert.equal(done.reputation.venue, Math.max(0, sheet.repDelta));
  assert.deepEqual(settlementFor(done), sheet, 'the signed sheet replays exactly, even though reputation changed');
  const again = run(builtGame(seed, 'guarantee'), [{ type: 'confirmPromotion' }, { type: 'respond', responseId }, { type: 'acceptSettlement', at: '2026-10-01T00:00:00.000Z' }]);
  assert.deepEqual(again, done, 'the same seed and choices give the same game');
});

test('Lot doors experiment: the choice survives reload and settles exactly once', () => {
  const seed = 4;
  const start = builtGame(seed, 'guarantee');
  const ordinary = run(start, [{ type: 'confirmPromotion' }]);
  const pending = run(start, [{ type: 'confirmPromotion', pilot: true }]);
  assert.equal(Object.hasOwn(ordinary.show, 'pilotCrew'), false, 'ordinary shows do not gain a new prompt');
  assert.equal(pending.show.pilotCrew, null);
  const responseId = D.INCIDENTS[pending.show.incidentId].responses[0].id;
  assert.match(applyAction(pending, { type: 'respond', responseId }).error, /doors crew works first/);
  const restoredPending = normalizeState(JSON.parse(JSON.stringify(pending)), seed);
  assert.equal(restoredPending.show.pilotCrew, null, 'loading during the question does not answer it');
  const chosen = run(restoredPending, [{ type: 'chooseDoorCrew', choice: 'gate' }]);
  assert.equal(normalizeState(chosen, seed).show.pilotCrew, 'gate', 'the answer survives reload');
  assert.match(applyAction(chosen, { type: 'chooseDoorCrew', choice: 'bar' }).error, /no doors choice/);
  const settled = run(normalizeState(chosen, seed), [{ type: 'respond', responseId }]);
  const result = settlementFor(settled);
  const finished = run(settled, [{ type: 'acceptSettlement' }]);
  assert.equal(finished.cash, D.START_CASH + result.net);
  assert.equal(finished.history.length, 1);
  assert.equal(normalizeState(finished, seed).show.pilotCrew, 'gate', 'the signed sheet keeps the chosen conditions');
  assert.deepEqual(settlementFor(normalizeState(finished, seed)), result);
  assert.match(applyAction(finished, { type: 'acceptSettlement' }).error, /settle/);
  assert.equal(result.costs.staff, settlementFor(run(ordinary, [{ type: 'respond', responseId }])).costs.staff);
});

test('Lot doors experiment: queue totals reconcile and neither staffing choice dominates net', () => {
  const venue = evaluateVenue({ id: 'lot', grid: D.GRID, objects: D.STARTER_LAYOUT });
  const low = doorRushPilot(venue, 50, 25, 'bar');
  assert.equal(low.waiting, 0);
  assert.equal(low.admitted + low.lostWalkups, low.rushArrivals);
  let keepWins = 0;
  let gateWins = 0;
  for (let seed = 1; seed <= 150; seed += 1) {
    const roll = rollShow(seed);
    const inputs = {
      venue, deal: 'guarantee', price: 20, ads: REFERENCE_ADS, venueRep: 0, draw: roll.draw,
      artistId: D.DEFAULT_ARTIST, incidentId: roll.incidentId,
      responseId: D.INCIDENTS[roll.incidentId].responses[0].id,
    };
    const keep = evaluateShow({ ...inputs, pilotCrew: 'bar' });
    const gate = evaluateShow({ ...inputs, pilotCrew: 'gate' });
    for (const r of [keep, gate]) {
      assert.equal(r.doorRush.admitted + r.doorRush.lostWalkups, r.doorRush.rushArrivals);
      assert.ok(r.attendance >= r.presale, 'only walk-ups may leave, never ticket holders');
      assert.equal(r.attendance, r.doorRush.admitted);
      assert.equal(r.costs.staff, evaluateShow(inputs).costs.staff, 'reassignment does not hire a worker');
    }
    assert.ok(gate.doorRush.waiting <= keep.doorRush.waiting);
    assert.ok(gate.doorRush.barCapacity < keep.doorRush.barCapacity);
    if (gate.net > keep.net) gateWins += 1;
    if (keep.net > gate.net) keepWins += 1;
  }
  assert.ok(keepWins >= 30 && gateWins >= 30,
    `both strategies need plausible winning nights; keep=${keepWins}, gate=${gateWins}`);
});

test('forecast brackets the real attendance without revealing the draw', () => {
  const s = builtGame(9);
  const { low, high } = forecast(s);
  const roll = rollShow(9);
  const actual = evaluateShow({ venue: evaluateVenue(s.venue), deal: 'door', price: 20, ads: REFERENCE_ADS, venueRep: 0, draw: roll.draw, artistId: D.DEFAULT_ARTIST }).attendance;
  assert.ok(low <= actual && actual <= high);
});

test('rollShow stays in range and uses every incident', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 1000; seed += 1) {
    const r = rollShow(seed);
    assert.ok(r.draw >= D.ARTISTS[D.DEFAULT_ARTIST].drawMin && r.draw <= D.ARTISTS[D.DEFAULT_ARTIST].drawMax);
    const [from, to] = D.INCIDENTS[r.incidentId].window;
    assert.ok(r.incidentAt >= from && r.incidentAt <= to, `seed ${seed}: ${r.incidentId} at ${r.incidentAt}`);
    seen.add(r.incidentId);
  }
  assert.deepEqual([...seen].sort(), [...D.INCIDENT_ORDER].sort());
  assert.deepEqual(rollShow(5), rollShow(5));
});

test('R-11a: each incident happens inside its own window, and the story order holds', () => {
  for (const [id, spec] of Object.entries(D.INCIDENTS)) {
    const [from, to] = spec.window;
    assert.ok(from >= 0 && from < to && to <= 1, `${id} window is inside show night`);
    assert.equal(incidentAtFor(id, 0), from);
    assert.equal(incidentAtFor(id, 1), to);
    for (const t of [0.25, 0.5, 0.999]) {
      const at = incidentAtFor(id, t);
      assert.ok(at >= from && at <= to, `${id} at ${at}`);
    }
  }
  // Doors incidents come before the act takes the stage; the set incidents come after.
  for (const id of ['rain', 'gate-jam']) assert.ok(D.INCIDENTS[id].window[1] < D.ACT_ON_STAGE_AT, id);
  for (const id of ['pa-dropout', 'curfew']) assert.ok(D.INCIDENTS[id].window[0] > D.ACT_ON_STAGE_AT, id);
  // The timing roll is a separate draw: the show's draw and incident type are unchanged.
  for (let seed = 1; seed <= 200; seed += 1) {
    const r = rollShow(seed);
    assert.equal(r.incidentAt, incidentAtFor(r.incidentId, r.timing));
  }
  // A bad or missing roll still lands inside the window.
  assert.equal(incidentAtFor('rain', Number.NaN), incidentAtFor('rain', 0.5));
  assert.equal(incidentAtFor('rain', 7), D.INCIDENTS.rain.window[1]);
});

test('back, retry and next show move between phases', () => {
  const s = run(createGame(3), [{ type: 'chooseDeal', deal: 'door' }, { type: 'back' }]);
  assert.equal(s.phase, 'book');
  let seed = 1;
  let done;
  for (; seed < 50; seed += 1) {
    const roll = rollShow(seed);
    done = run(builtGame(seed, 'door'), [
      { type: 'confirmPromotion' },
      { type: 'respond', responseId: D.INCIDENTS[roll.incidentId].responses[0].id },
      { type: 'acceptSettlement' },
    ]);
    if (done.history[0].result === 'pass') break;
  }
  const next = run(done, [{ type: 'nextShow' }]);
  assert.equal(next.phase, 'book');
  assert.equal(next.cash, done.cash);
  assert.notEqual(next.seed, done.seed);
  assert.equal(next.venue.objects.length, REFERENCE_LAYOUT.length);
  assert.equal(next.history.length, 1);
  const retry = run(done, [{ type: 'retry' }]);
  assert.equal(retry.cash, D.START_CASH);
  assert.equal(retry.history.length, 0, 'Start over begins a new career');
  assert.equal(retry.venue.objects.length, REFERENCE_LAYOUT.length, 'the layout is kept');
});

test('normalizeState rejects junk and repairs tampered saves', () => {
  assert.deepEqual(normalizeState(null, 9), createGame(9));
  assert.deepEqual(normalizeState('code', 9), createGame(9));
  assert.deepEqual(normalizeState({ schema: 99 }, 9), createGame(9));

  const done = run(builtGame(11, 'door'), [{ type: 'confirmPromotion' }]);
  const tampered = JSON.parse(JSON.stringify(done));
  tampered.cash = 'lots';
  tampered.promotion.price = 999;
  tampered.promotion.ads.social = -50;
  tampered.reputation.venue = 500;
  tampered.venue.objects.push({ type: 'gate', x: 12, y: 15 }, { type: 'helipad', x: 3, y: 3 }, { type: 'bar', x: 30, y: 3 });
  tampered.show.incidentId = 'not-real';
  const fixed = normalizeState(tampered, 1);
  assert.equal(fixed.cash, D.START_CASH);
  assert.equal(fixed.promotion.price, D.PRICE_MAX);
  assert.equal(fixed.promotion.ads.social, 0);
  assert.equal(fixed.reputation.venue, 100);
  assert.equal(fixed.venue.objects.length, REFERENCE_LAYOUT.length, 'overlapping, unknown and off-grid objects are dropped');
  assert.equal(fixed.show.incidentId, rollShow(11).incidentId, 'the incident comes from the seed');
  assert.equal(fixed.phase, 'show');

  const noDeal = JSON.parse(JSON.stringify(done));
  noDeal.booking.deal = 'handshake';
  const rolledBack = normalizeState(noDeal, 1);
  assert.equal(rolledBack.phase, 'book');
  assert.equal(rolledBack.show, null);
  assert.equal(rolledBack.promotion.confirmed, false);
});

const fixture = async (name) => JSON.parse(await readFile(new URL(`./test/fixtures/${name}`, import.meta.url), 'utf8'));

test('the frozen version 2 save fixture loads, gaining only the career defaults', async () => {
  const v2 = await fixture('save-v2.json');
  assert.equal(v2.schema, D.SCHEMA_VERSION);
  const newActs = Object.fromEntries(Object.keys(D.ARTISTS).map((id) => [id, 0]));
  assert.deepEqual(normalizeState(v2, 1), {
    ...v2,
    mode: 'career',
    scenario: null,
    forcedIncident: null,
    layouts: { lot: [], club: [], amphitheater: [], festival: [] },
    booking: { ...v2.booking, terms: null, nights: 1, secondId: null, secondTerms: null },
    promotion: { ...v2.promotion, seatPrice: null },
    show: { ...v2.show, night: 1, repHold: 0, relHold: 0 },
    reputation: { ...v2.reputation, artists: { ...newActs, ...v2.reputation.artists } },
    history: v2.history.map((h) => ({ ...h, venueId: 'lot', night: 1 })),
    unlocks: { club: false, amphitheater: false, festival: false, complete: false },
  }, 'a save from before the later tiers keeps the Lot and gains the new optional fields');
  assert.equal(migrateSave(v2), v2, 'a current save is left alone');

  // A Phase 3 save finished its show; the Lot career lets it carry on or start over.
  const loaded = normalizeState(v2, 1);
  assert.equal(loaded.phase, 'done');
  const next = run(loaded, [{ type: 'nextShow' }]);
  assert.equal(next.cash, loaded.cash, 'Next show keeps the cash');
  assert.deepEqual(next.history, loaded.history, 'and the history');
  assert.ok(offersFor(next).includes(next.booking.artistId));
  const over = run(loaded, [{ type: 'retry' }]);
  assert.equal(over.cash, D.START_CASH);
  assert.deepEqual(over.history, []);
});

test('a version 1 save migrates to the Lot scale', async () => {
  const v1 = await fixture('save-v1.json');
  const v2 = migrateSave(v1);
  assert.equal(v2.schema, 2);
  assert.equal(v2.cash, 3473, 'cash halves: 6945 / 2, rounded');
  assert.deepEqual(v2.history, [{ ...v1.history[0], attendance: 135, net: 473, artistPay: 500, venueId: 'lot', night: 1 }]);
  assert.equal(v2.phase, 'book', 'a finished show that passed moves on to the next show');
  assert.equal(v2.seed, nextSeed(v1.seed));
  assert.equal(v2.reputation.venue, v1.reputation.venue);
  assert.equal(v2.reputation.artists['sodium-arcade'], v1.reputation.artists['velvet-static'], 'the renamed artist keeps its relationship');
  assert.equal(v2.reputation.artists['velvet-static'], undefined);
  assert.deepEqual(v2.venue.objects, v1.venue.objects);
  assert.deepEqual(normalizeState(v2, 1), v2);

  const failed = migrateSave({ ...v1, history: [{ ...v1.history[0], result: 'retry' }] });
  assert.equal(failed.phase, 'book');
  assert.equal(failed.cash, 3473, 'a finished show that failed also moves on, as the career does after any night');
  assert.equal(failed.history.length, 1);
  const broke = migrateSave({ ...v1, cash: 0 });
  assert.equal(broke.phase, 'book');
  assert.equal(broke.cash, D.START_CASH, 'a finished show with no money for the next one starts over');
  assert.deepEqual(broke.history, [], 'and, like any Start over, keeps no history');

  // A show in progress converts exactly: the money already spent halves with everything else.
  const mid = run(builtGame(42, 'guarantee'), [{ type: 'confirmPromotion' }]);
  const doubled = Object.fromEntries(Object.entries(mid.promotion.ads).map(([c, v]) => [c, v * 2]));
  const asV1 = {
    ...mid, schema: 1, cash: mid.cash * 2, promotion: { ...mid.promotion, ads: doubled },
    booking: { ...mid.booking, artistId: 'velvet-static' },
    reputation: { ...mid.reputation, artists: { 'velvet-static': mid.reputation.artists[D.DEFAULT_ARTIST] } },
  };
  assert.deepEqual(normalizeState(migrateSave(asV1), 1), mid);
  assert.equal(migrateSave('junk'), 'junk');
});

test('saves round-trip through the MixKit save store and a save code', async () => {
  const source = await readFile(new URL('../src/kit/save.js', import.meta.url), 'utf8');
  const sandbox = { Math, Number, String, RegExp, Object, Array, JSON, Date, Buffer, globalThis: null };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'src/kit/save.js' });
  const memory = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  };
  const opts = () => ({ version: D.SCHEMA_VERSION, storage: memory(), migrate: (st) => migrateSave(st) });
  const a = sandbox.MixKitSave.createSaveStore(D.SAVE_NAMESPACE, opts());
  const b = sandbox.MixKitSave.createSaveStore(D.SAVE_NAMESPACE, opts());
  const state = run(builtGame(21, 'guarantee'), [{ type: 'confirmPromotion' }]);
  a.save(state);
  const imported = b.importCode(a.exportCode());
  assert.deepEqual(normalizeState(imported, 1), state);
  assert.deepEqual(normalizeState(b.importCode(Buffer.from('{"evil":true}').toString('base64')), 5), createGame(5));
  const v1 = await fixture('save-v1.json');
  const v1Code = Buffer.from(JSON.stringify({ ns: D.SAVE_NAMESPACE, v: 1, savedAt: '2026-10-01T00:00:00.000Z', state: v1 })).toString('base64');
  assert.deepEqual(normalizeState(b.importCode(v1Code), 1), migrateSave(v1), 'a version 1 code migrates through the store');
});

test('validateLayout keeps the reference layout intact', () => {
  const { accepted, problems } = validateLayout(REFERENCE_LAYOUT);
  assert.equal(problems.length, 0);
  assert.equal(accepted.length, REFERENCE_LAYOUT.length);
});

test('setLayout applies a whole layout or nothing', () => {
  const s = run(createGame(1), [{ type: 'chooseDeal', deal: 'door' }]);
  const laid = run(s, [{ type: 'setLayout', objects: D.STARTER_LAYOUT }]);
  assert.equal(laid.venue.objects.length, D.STARTER_LAYOUT.length);
  assert.equal(evaluateVenue(laid.venue).ready, true);
  const bad = applyAction(laid, { type: 'setLayout', objects: [...D.STARTER_LAYOUT, { type: 'gate', x: 5, y: 5 }] });
  assert.match(bad.error, /lot boundary/);
  assert.equal(bad.state, laid, 'a rejected layout leaves the state untouched');
  assert.equal(run(laid, [{ type: 'setLayout', objects: [] }]).venue.objects.length, 0);
});

test('showPreview gives the crowd before the incident without changing state', () => {
  const s = run(builtGame(13, 'door'), [{ type: 'confirmPromotion' }]);
  const preview = showPreview(s);
  assert.equal(preview.parts.incident, 1);
  assert.equal(preview.attendance, evaluateShow({ venue: evaluateVenue(s.venue), deal: 'door', price: 20, ads: REFERENCE_ADS, venueRep: 0, draw: rollShow(13).draw, artistId: D.DEFAULT_ARTIST }).attendance);
});

// ---------------------------------------------------------------------------
// The Lot career (R-19 to R-21)

// Plays one show to settlement with the given act and deal, the reference layout and ads, and
// the first incident response.
function playShow(state, artistId, deal) {
  let s = run(state, [
    { type: 'chooseDeal', deal, artistId },
    { type: 'setLayout', objects: REFERENCE_LAYOUT },
    { type: 'confirmBuild' },
    { type: 'setPromotion', price: D.ARTISTS[artistId].fairPrice, ads: REFERENCE_ADS },
    { type: 'confirmPromotion' },
  ]);
  s = run(s, [{ type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses[0].id }, { type: 'acceptSettlement' }]);
  return s;
}

test('R-19: the first show offers the default act; later shows draw from the roster', () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    const first = offersFor(createGame(seed));
    assert.equal(first.length, D.OFFERS_PER_SHOW);
    assert.equal(first[0], D.DEFAULT_ARTIST);
    const later = offersFor({ ...createGame(seed), history: [{}] });
    assert.equal(new Set(later).size, D.OFFERS_PER_SHOW);
    later.forEach((id) => assert.ok(D.ROSTER.includes(id)));
    assert.deepEqual(offersFor({ ...createGame(seed), history: [{}] }), later, 'offers come from the seed');
  }
  const seen = new Set();
  for (let seed = 1; seed <= 50; seed += 1) offersFor({ ...createGame(seed), history: [{}] }).forEach((id) => seen.add(id));
  assert.deepEqual([...seen].sort(), [...D.ROSTER].sort(), 'every act is offered on some seed');
});

test('R-19: relationship sets the ask, the draw and whether a door deal is on the table', () => {
  const base = D.ARTISTS[D.DEFAULT_ARTIST];
  assert.deepEqual(termsFor(D.DEFAULT_ARTIST, 0), { ask: base.ask, drawMult: 1, doorOk: true });
  const fond = termsFor(D.DEFAULT_ARTIST, 20);
  assert.equal(fond.ask, Math.round(base.ask * (1 - 20 * D.REL_ASK_SLOPE) / D.ASK_ROUNDING) * D.ASK_ROUNDING);
  assert.ok(fond.ask < base.ask && fond.drawMult > 1);
  const sour = termsFor(D.DEFAULT_ARTIST, D.REL_DOOR_FLOOR);
  assert.ok(sour.ask > base.ask && sour.drawMult < 1);
  assert.equal(sour.doorOk, false, 'an act at the floor only plays for a guarantee');
  assert.equal(termsFor('juniper-switchboard', 100).doorOk, false, 'a guarantee-only act never takes the door');
});

test('R-19: booking checks the offer and stores the terms the show is settled with', () => {
  let seed = 1;
  while (!offersFor({ ...createGame(seed), history: [{}] }).includes('juniper-switchboard')) seed += 1;
  const s = { ...createGame(seed), history: [{ showId: 1 }] };
  const offered = offersFor(s);
  const absent = D.ROSTER.find((id) => !offered.includes(id));
  assert.match(applyAction(s, { type: 'chooseDeal', deal: 'guarantee', artistId: absent }).error, /not on offer/);
  assert.match(applyAction(s, { type: 'chooseDeal', deal: 'door', artistId: 'juniper-switchboard' }).error, /only plays for a guarantee/);
  const fond = { ...s, reputation: { ...s.reputation, artists: { ...s.reputation.artists, 'juniper-switchboard': 20 } } };
  const booked = run(fond, [{ type: 'chooseDeal', deal: 'guarantee', artistId: 'juniper-switchboard' }]);
  const terms = termsFor('juniper-switchboard', 20);
  assert.deepEqual(booked.booking.terms, { ask: terms.ask, drawMult: terms.drawMult });
  assert.equal(booked.promotion.price, D.ARTISTS['juniper-switchboard'].fairPrice);
  const show = evaluateShow({ ...WORKED_EXAMPLE, artistId: 'juniper-switchboard', deal: 'guarantee', ask: terms.ask, drawMult: terms.drawMult });
  assert.equal(show.artistPay, terms.ask, 'the guarantee pays the quoted ask');
  assert.equal(show.relDelta, D.REL_BASE, 'paying the quoted ask in full counts as fair');
});

test('R-17: a door deal moves the relationship by its pay against the quoted ask, like any deal', () => {
  const door = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door' });
  const pay = door.artistPay;
  assert.equal(pay, 77, 'the worked example pays the act $77 on the door');
  const rule = (ask) => Math.min(D.REL_MAX_STEP, Math.max(D.REL_MIN_STEP, D.REL_BASE + Math.round(D.REL_SLOPE * (pay / ask - 1))));
  // The door pay does not depend on the ask, so only the ask changes the step.
  const cases = [
    [10000, -15, 'paying almost nothing'],
    [500, -12, 'the worked example: well below the ask'],
    [100, 0, 'below the ask at 77%'],
    [90, 2, 'below the ask at 86%: still a small gain'],
    [77, D.REL_BASE, 'exactly the ask: the same as a guarantee'],
    [70, 7, 'above the ask at 110%'],
    [60, D.REL_MAX_STEP, 'far above the ask: capped'],
  ];
  for (const [ask, expected, label] of cases) {
    const r = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', ask });
    assert.equal(r.artistPay, pay);
    assert.equal(r.relDelta, expected, label);
    assert.equal(r.relDelta, rule(ask), `${label}: matches R-17`);
  }
  assert.ok(evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', ask: 60 }).relDelta > evaluateShow({ ...WORKED_EXAMPLE, deal: 'guarantee', ask: 60 }).relDelta,
    'a door deal that beats the ask builds more trust than a guarantee');
  assert.equal(evaluateShow({ ...WORKED_EXAMPLE, deal: 'guarantee', ask: 60 }).relDelta, D.REL_BASE, 'a guarantee always gives the base step');
  assert.equal(D.REL_BASE - D.REL_SLOPE, -15, 'the lowest step a show can give (pay of $0) is above REL_MIN_STEP');
});

test('R-21: a career carries on after a bad night and stops only when no show is affordable', () => {
  let seed = 1;
  let done;
  for (; seed < 200; seed += 1) {
    done = playShow(createGame(seed), D.DEFAULT_ARTIST, 'guarantee');
    if (done.history[0].result === 'retry' && done.cash >= cheapestShowCost()) break;
  }
  assert.equal(done.history[0].result, 'retry', 'found a losing first night');
  const next = run(done, [{ type: 'nextShow' }]);
  assert.equal(next.phase, 'book');
  assert.equal(next.cash, done.cash, 'a bad night costs money but the career goes on');
  assert.ok(offersFor(next).includes(next.booking.artistId));
  const broke = { ...done, cash: cheapestShowCost() - 1 };
  assert.match(applyAction(broke, { type: 'nextShow' }).error, /needs at least \$\d+ before doors/);
  assert.equal(applyAction(broke, { type: 'retry' }).error, null, 'starting over is always possible');
  assert.equal(cheapestShowCost(), evaluateShow({
    venue: evaluateVenue({ objects: D.CHEAPEST_LAYOUT }), deal: 'door', price: D.PRICE_MIN, ads: {}, venueRep: 0,
    draw: 0, artistId: D.DEFAULT_ARTIST, incidentId: null, responseId: null,
  }).upfront);
  assert.equal(evaluateVenue({ objects: D.CHEAPEST_LAYOUT }).ready, true);
});

test('R-21: the next show must be affordable on a deal an act on its offer will take', () => {
  const done = playShow(createGame(2), D.DEFAULT_ARTIST, 'door');
  assert.equal(nextShowCost(done), cheapestShowCost(), 'an act that takes the door deal sets the floor');
  // A later show whose offer is Juniper Switchboard (guarantee only) and an act soured past the door rule.
  let seed = done.seed;
  while (!offersFor({ seed: nextSeed(seed), history: done.history }).includes('juniper-switchboard')) seed = nextSeed(seed);
  const other = offersFor({ seed: nextSeed(seed), history: done.history }).find((id) => id !== 'juniper-switchboard');
  const stuck = {
    ...done,
    seed,
    reputation: { ...done.reputation, artists: { ...done.reputation.artists, [other]: D.REL_DOOR_FLOOR } },
  };
  const cheapestGuarantee = Math.min(...[other, 'juniper-switchboard'].map((id) =>
    cheapestShowCost('guarantee', termsFor(id, stuck.reputation.artists[id]).ask)));
  assert.equal(nextShowCost(stuck), cheapestGuarantee);
  assert.ok(cheapestGuarantee > cheapestShowCost());
  const short = { ...stuck, cash: cheapestGuarantee - 1 };
  assert.ok(short.cash >= cheapestShowCost(), 'enough for a door deal nobody on offer will take');
  assert.equal(careerProgress(short).canAffordAShow, false);
  assert.match(applyAction(short, { type: 'nextShow' }).error, new RegExp(`needs at least \\$${cheapestGuarantee}`));
  const enough = run({ ...stuck, cash: cheapestGuarantee }, [{ type: 'nextShow' }]);
  const pick = offersFor(enough).find((id) => cheapestShowCost('guarantee', termsFor(id, enough.reputation.artists[id]).ask) === cheapestGuarantee);
  const booked = run(enough, [
    { type: 'chooseDeal', deal: 'guarantee', artistId: pick },
    { type: 'setLayout', objects: D.CHEAPEST_LAYOUT },
    { type: 'confirmBuild' },
    { type: 'setPromotion', price: D.PRICE_MIN, ads: {} },
    { type: 'confirmPromotion' },
  ]);
  assert.equal(booked.cash, 0, 'the show the check allowed can be booked');
});

test('R-21: Start over begins a new career, so earlier shows count toward nothing', () => {
  const s = createGame(5);
  const sellout = { showId: 1, seed: 1, deal: 'guarantee', attendance: D.PERMIT_CAP, satisfaction: 90, net: 500, artistPay: 500, result: 'pass', weakest: null, settledAt: null };
  const later = { ...s, cash: 10000, history: [sellout] };
  const done = playShow(later, offersFor(later)[0], 'guarantee');
  assert.equal(careerProgress(done).sellouts >= 1, true);
  const over = run(done, [{ type: 'retry' }]);
  assert.deepEqual(over.history, []);
  assert.equal(careerProgress(over).sellouts, 0, 'an old sellout does not count toward the new goal');
  assert.equal(careerProgress(over).shows, 0);
  assert.equal(offersFor(over)[0], D.DEFAULT_ARTIST, 'the new career opens with the first show offer');
  assert.equal(over.unlocks.club, false);

  const veteran = {
    ...done,
    cash: 9000,
    unlocks: { club: true },
    reputation: { venue: 80, artists: Object.fromEntries(D.ROSTER.map((id, i) => [id, 10 * (i + 1)])) },
  };
  const fresh = run(veteran, [{ type: 'retry' }]);
  assert.equal(fresh.cash, D.START_CASH);
  assert.equal(fresh.reputation.venue, 0);
  assert.deepEqual(fresh.reputation.artists, createGame(1).reputation.artists, 'every relationship resets');
  assert.equal(fresh.unlocks.club, false, 'the Club unlock belongs to the old career');
  assert.deepEqual(fresh.venue.objects, veteran.venue.objects, 'only the layout carries over');
  const carried = run(veteran, [{ type: 'nextShow' }]);
  assert.equal(carried.unlocks.club, true);
  assert.equal(carried.history.length, veteran.history.length);
});

test('R-21: the Done screen flag, the nextShow action and nextShowCost agree', () => {
  let checked = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const done = playShow({ ...createGame(seed), cash: 20000 }, offersFor(createGame(seed))[0], 'guarantee');
    for (const rel of [0, D.REL_DOOR_FLOOR]) {
      const s = { ...done, reputation: { ...done.reputation, artists: Object.fromEntries(D.ROSTER.map((id) => [id, rel])) } };
      const cost = nextShowCost(s);
      for (const cash of [cost - 1, cost]) {
        const at = { ...s, cash };
        const p = careerProgress(at);
        assert.equal(p.nextShowCost, cost);
        assert.equal(p.canAffordAShow, applyAction(at, { type: 'nextShow' }).error === null, `seed ${seed}, rel ${rel}, cash ${cash}`);
        checked += 1;
      }
    }
  }
  assert.equal(checked, 160);
});

test('normalizeState drops a quoted ask below $1, so settlement never divides by zero', () => {
  const settle = run(builtGame(42, 'guarantee'), [{ type: 'confirmPromotion' }]);
  const answered = run(settle, [{ type: 'respond', responseId: D.INCIDENTS[settle.show.incidentId].responses[0].id }]);
  for (const ask of [0, -50]) {
    const tampered = JSON.parse(JSON.stringify(answered));
    tampered.booking.terms = { ask, drawMult: 1 };
    const loaded = normalizeState(tampered, 1);
    assert.equal(loaded.booking.terms, null, `an ask of ${ask} is dropped`);
    assert.equal(loaded.phase, 'settle');
    const signed = run(loaded, [{ type: 'acceptSettlement' }]);
    assert.ok(Number.isFinite(signed.reputation.artists[D.DEFAULT_ARTIST]), 'the relationship stays a number');
  }
  for (const ask of [0, -50]) {
    const direct = evaluateShow({ ...WORKED_EXAMPLE, deal: 'guarantee', ask });
    assert.ok(Number.isFinite(direct.relDelta) && Number.isFinite(direct.net), `evaluateShow ignores an ask of ${ask}`);
    assert.equal(direct.artistPay, D.ARTISTS[D.DEFAULT_ARTIST].ask, 'and settles on the base ask');
  }
});

test('R-20: meeting the Lot goal at settlement unlocks the Club, and the unlock stays', () => {
  const s = createGame(5);
  const sellout = { showId: 1, seed: 1, deal: 'guarantee', attendance: D.PERMIT_CAP, satisfaction: 90, net: 500, artistPay: 500, result: 'pass', weakest: null, settledAt: null };
  const near = {
    ...s,
    cash: D.LOT_GOAL.cash + 5000,
    reputation: { venue: D.LOT_GOAL.venueRep + 20, artists: { ...s.reputation.artists, [D.DEFAULT_ARTIST]: D.LOT_GOAL.loyalAct + 10 } },
    history: [sellout],
  };
  const before = careerProgress(near);
  assert.deepEqual(before.met, { sellouts: true, venueRep: true, cash: true, loyalAct: true });
  assert.equal(before.clubUnlocked, false, 'the unlock is recorded at settlement, not by looking');
  const after = playShow(near, offersFor(near)[0], 'guarantee');
  assert.equal(careerProgress(after).goalMet, true);
  assert.equal(after.unlocks.club, true);
  const later = run(after, [{ type: 'nextShow' }]);
  assert.equal(later.unlocks.club, true, 'the next show keeps the unlock');
  assert.equal(careerProgress({ ...later, cash: 0 }).clubUnlocked, true, 'losing cash later does not take the Club away');
  assert.equal(playShow(createGame(5), D.DEFAULT_ARTIST, 'guarantee').unlocks.club, false, 'one ordinary night unlocks nothing');
  assert.equal(normalizeState(after, 1).unlocks.club, true);
  assert.equal(normalizeState({ ...after, unlocks: { club: 'yes' } }, 1).unlocks.club, false);
});

// ---------------------------------------------------------------------------
// Later tiers (CT-DEC-11). The Lot tests above stay the balance contract.

test('CT-DEC-11: the Club plays on a house rig, and a locked room stays locked', () => {
  const locked = applyAction(createGame(1), { type: 'chooseVenue', venueId: 'club' });
  assert.match(locked.error, /locked/);
  const hall = evaluateVenue({ id: 'club', objects: D.CLUB_STARTER });
  assert.equal(hall.ready, true, hall.missing.join('; '));
  assert.equal(hall.housePa, true);
  assert.equal(hall.capacity, D.VENUES.club.permit);
  assert.ok(hall.blockedTiles > 0, 'the pillars cut a sightline');
  let s = createGame(2);
  s.unlocks.club = true;
  s.cash = 40000;
  s = run(s, [
    { type: 'chooseVenue', venueId: 'club' },
    { type: 'chooseDeal', deal: 'guarantee', artistId: 'salt-ledger' },
    { type: 'setLayout', objects: D.CLUB_STARTER },
    { type: 'confirmBuild' },
    { type: 'setPromotion', price: 28 },
    { type: 'confirmPromotion' },
  ]);
  assert.equal(s.venue.id, 'club');
  s = run(s, [{ type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses[0].id }]);
  assert.equal(settlementFor(s).costs.pa, 0, 'the house rig is not a second rental');
  const done = run(s, [{ type: 'acceptSettlement' }]);
  assert.equal(done.history[0].venueId, 'club');
  assert.equal(done.venue.id, 'club');
  const back = run(done, [{ type: 'nextShow' }, { type: 'chooseVenue', venueId: 'lot' }]);
  assert.equal(back.venue.id, 'lot', 'the Lot stays bookable');
  assert.equal(back.layouts.club.length, D.CLUB_STARTER.length, 'the hall layout is kept');
});

test('CT-DEC-11: a two-night hold settles twice and moves reputation once', () => {
  let s = createGame(4);
  s.unlocks.club = true;
  s.unlocks.amphitheater = true;
  s.cash = 200000;
  s = run(s, [{ type: 'chooseVenue', venueId: 'amphitheater' }]);
  const act = offersFor(s)[0];
  s = run(s, [
    { type: 'chooseDeal', deal: 'guarantee', artistId: act, nights: 2 },
    { type: 'setLayout', objects: D.AMP_STARTER },
    { type: 'confirmBuild' },
    { type: 'setPromotion', price: 42, seatPrice: 55 },
    { type: 'confirmPromotion' },
  ]);
  assert.equal(s.booking.nights, 2);
  assert.equal(evaluateVenue(s.venue).capacity, D.VENUES.amphitheater.permit);
  assert.equal(evaluateVenue(s.venue).seats, 400);
  const rep = s.reputation.venue;
  s = run(s, [
    { type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses[0].id },
    { type: 'acceptSettlement' },
  ]);
  assert.equal(s.phase, 'show');
  assert.equal(s.show.night, 2);
  assert.equal(s.history.length, 1);
  assert.equal(s.reputation.venue, rep, 'reputation waits for the last night');
  const held = s.show.repHold;
  s = run(s, [{ type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses[0].id }]);
  const second = settlementFor(s).repDelta;
  s = run(s, [{ type: 'acceptSettlement' }]);
  assert.equal(s.phase, 'done');
  assert.equal(s.history.length, 2);
  assert.equal(s.history[1].night, 2);
  assert.equal(s.reputation.venue, Math.min(100, Math.max(0, rep + held + second)));
});

test('CT-DEC-11: a festival day has a sponsor, a broadcast line and a second stage', () => {
  let s = createGame(8);
  s.unlocks = { club: true, amphitheater: true, festival: true, complete: false };
  s.cash = 400000;
  s = run(s, [
    { type: 'chooseVenue', venueId: 'festival' },
    { type: 'chooseDeal', deal: 'sponsor', artistId: 'paper-voltage', secondId: 'north-kettle' },
    { type: 'setLayout', objects: D.FEST_STARTER },
    { type: 'confirmBuild' },
    { type: 'setPromotion', price: 80 },
    { type: 'confirmPromotion' },
  ]);
  assert.equal(evaluateVenue(s.venue).capacity, D.VENUES.festival.permit);
  s = run(s, [{ type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses[0].id }]);
  const sheet = settlementFor(s);
  assert.equal(sheet.sponsor, D.SPONSOR_PAY);
  assert.ok(sheet.broadcast > 0);
  assert.ok(sheet.second && sheet.second.attendance > 0);
  assert.ok(sheet.second.attendance <= D.VENUES.festival.secondCap);
  const before = s.cash;
  const done = run(s, [{ type: 'acceptSettlement' }]);
  assert.equal(done.cash, before + settlementPayout(sheet, 'sponsor'));
  assert.equal(done.history[0].venueId, 'festival');
});

test('sandbox removes the cash gate, and the wet lot forces rain', () => {
  const box = createGame(1, { mode: 'sandbox' });
  assert.equal(box.cash, D.SANDBOX_CASH);
  assert.equal(applyAction(box, { type: 'chooseVenue', venueId: 'festival' }).error, null);
  let broke = run(createGame(3, { mode: 'sandbox' }), [
    { type: 'chooseDeal', deal: 'guarantee' },
    { type: 'setLayout', objects: D.STARTER_LAYOUT },
    { type: 'confirmBuild' },
    { type: 'setPromotion', price: 20 },
  ]);
  broke = { ...broke, cash: 0 };
  assert.equal(applyAction(broke, { type: 'confirmPromotion' }).error, null, 'sandbox can open the doors with no cash');
  const wet = createGame(9, { mode: 'scenario', scenario: 'wet-lot' });
  assert.equal(wet.cash, D.SCENARIO_CASH);
  assert.equal(wet.forcedIncident, 'rain');
  const show = run(wet, [
    { type: 'chooseDeal', deal: 'door' },
    { type: 'confirmBuild' },
    { type: 'setPromotion', price: 15 },
    { type: 'confirmPromotion' },
  ]);
  assert.equal(show.show.incidentId, 'rain');
});

// Key bindings (controls.mjs): the table both key handlers in game.js read.

test('controls: no two key bindings can fire on the same key press', () => {
  assert.deepEqual(clashes(), []);
  const copy = { ...binding('rotate'), id: 'rotate-again' };
  assert.deepEqual(clashes([...BINDINGS, copy]), ['rotate and rotate-again share "r", "R"'], 'a duplicate row is caught');
  const shifted = { ...binding('move-cursor'), id: 'move-again', overrides: [] };
  assert.equal(clashes([binding('pan'), shifted]).length, 1, 'Shift with an arrow is caught unless one binding overrides the other');
});

test('controls: no binding takes a key the browser or the system owns', () => {
  assert.deepEqual(reservedKeys(), []);
  const bad = [
    { id: 'tab', combos: [{ keys: ['Tab'] }] },
    { id: 'help', combos: [{ keys: ['F1'] }] },
    { id: 'close-tab', combos: [{ keys: ['w'], meta: true }] },
  ];
  assert.deepEqual(reservedKeys(bad), ['tab uses Tab', 'help uses F1', 'close-tab uses w']);
});

test('controls: modifiers left out match either way, and named ones must agree', () => {
  const key = (k, mods = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });
  assert.ok(matches('rotate', key('r')) && matches('rotate', key('R', { shiftKey: true })));
  assert.ok(matches('pick-tool', key('3')) && !matches('pick-tool', key('3', { ctrlKey: true })) && !matches('pick-tool', key('9')));
  assert.ok(matches('undo', key('z', { ctrlKey: true })) && matches('undo', key('z', { metaKey: true })));
  assert.ok(!matches('undo', key('z')) && !matches('undo', key('Z', { ctrlKey: true, shiftKey: true })));
  assert.ok(matches('redo', key('Z', { ctrlKey: true, shiftKey: true })) && matches('redo', key('z', { metaKey: true, shiftKey: true })));
  assert.ok(matches('redo', key('y', { ctrlKey: true })) && !matches('redo', key('y', { metaKey: true })));
  assert.ok(matches('pan', key('ArrowLeft', { shiftKey: true })) && !matches('pan', key('ArrowLeft')));
});

test('controls: the menu lists every binding exactly as the table names it', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const listed = [...html.matchAll(/<div data-binding="([^"]+)"><dt>([^<]*)<\/dt><dd>([^<]*)<\/dd><\/div>/g)]
    .map(([, id, keys, label]) => ({ id, keys, label }));
  assert.deepEqual(listed, BINDINGS.filter((b) => b.phases === 'all').concat(BINDINGS.filter((b) => b.phases !== 'all'))
    .map((b) => ({ id: b.id, keys: b.keysLabel, label: b.label })));
});

test('undo: setLayout with an earlier copy restores the layout exactly, fence kit included', () => {
  const s = run(createGame(5), [{ type: 'chooseDeal', deal: 'door' }, { type: 'setLayout', objects: D.STARTER_LAYOUT }]);
  assert.ok(s.venue.objects.some((o) => o.type === 'fence'), 'the suggested layout has the fence kit');
  const before = s.venue.objects.map((o) => ({ ...o }));
  const changed = run(s, [{ type: 'remove', index: 0 }, { type: 'remove', index: 0 }]);
  assert.notDeepEqual(changed.venue.objects, before);
  const restored = run(changed, [{ type: 'setLayout', objects: before }]);
  assert.deepEqual(restored.venue.objects, before);
  assert.deepEqual(evaluateVenue(restored.venue), evaluateVenue(s.venue));
});
