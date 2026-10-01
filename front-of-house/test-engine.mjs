import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as D from './data.mjs';
import {
  applyAction, buzz, createGame, evaluateShow, evaluateVenue, forecast, normalizeState,
  presaleSplit, priceFactor, rollShow, settlementFor, upfrontFor, validateLayout,
} from './engine.mjs';
import { REFERENCE_ADS, REFERENCE_LAYOUT, WORKED_EXAMPLE } from './sim/reference.mjs';

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
  assert.equal(guarantee.demand.toFixed(2), '249.63');
  assert.equal(guarantee.presale, 131);
  assert.equal(guarantee.walkup, 119);
  assert.equal(guarantee.attendance, 250);
  assert.equal(guarantee.satisfaction, 85);
  assert.equal(guarantee.ticketGross, 5000);
  assert.equal(guarantee.bar, 1275);
  assert.equal(guarantee.costs.staff, 900);
  assert.equal(guarantee.costs.total, 4780);
  assert.equal(guarantee.upfront, 5780);
  assert.equal(door.upfront, 4780);
  assert.equal(guarantee.artistPay, 1000);
  assert.equal(door.artistPay, 154);
  assert.equal(guarantee.net, 495);
  assert.equal(door.net, 1341);
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
  const busy = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', draw: 260, venue: { ...WORKED_EXAMPLE.venue, clearTiles: 120 } });
  assert.ok(busy.attendance > D.BAR_RATIO);
  const overflow = busy.attendance - D.BAR_RATIO;
  assert.equal(busy.bar, Math.round(D.BAR_NET_PER_HEAD * (busy.satisfaction / 100) * (D.BAR_RATIO + overflow * D.BAR_SHORTFALL)));
  const justUnder = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', draw: 199 });
  const justOver = evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', draw: 202 });
  assert.ok(justOver.attendance > D.BAR_RATIO && justUnder.attendance <= D.BAR_RATIO);
  assert.ok(justOver.bar >= justUnder.bar, 'one bar too few reduces only the overflow, with no cliff');
});

test('R-11: incident responses change walk-up, entry flow and the incident score', () => {
  const rain = (responseId) => evaluateShow({ ...WORKED_EXAMPLE, deal: 'door', incidentId: 'rain', responseId });
  assert.ok(rain('ride-out').attendance < rain('canopy').attendance);
  assert.equal(rain('canopy').costs.incident, 500);
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
  assert.match(applyAction(s, { type: 'respond', responseId: 'canopy' }).error, /costs \$500/);
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
  const again = run(builtGame(seed, 'guarantee'), [{ type: 'confirmPromotion' }, { type: 'respond', responseId }, { type: 'acceptSettlement', at: '2026-10-01T00:00:00.000Z' }]);
  assert.deepEqual(again, done, 'the same seed and choices give the same game');
});

test('forecast brackets the real attendance without revealing the draw', () => {
  const s = builtGame(9);
  const { low, high } = forecast(s);
  const roll = rollShow(9);
  const actual = evaluateShow({ venue: evaluateVenue(s.venue), deal: 'door', price: 20, ads: REFERENCE_ADS, venueRep: 0, draw: roll.draw, artistId: 'velvet-static' }).attendance;
  assert.ok(low <= actual && actual <= high);
});

test('rollShow stays in range and uses every incident', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 1000; seed += 1) {
    const r = rollShow(seed);
    assert.ok(r.draw >= 150 && r.draw <= 260);
    assert.ok(r.incidentAt >= 0.2 && r.incidentAt <= 0.8);
    seen.add(r.incidentId);
  }
  assert.deepEqual([...seen].sort(), [...D.INCIDENT_ORDER].sort());
  assert.deepEqual(rollShow(5), rollShow(5));
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
  const retry = run(done, [{ type: 'retry' }]);
  assert.equal(retry.cash, D.START_CASH);
  assert.equal(retry.history.length, 1);
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

test('the frozen version 1 save fixture loads unchanged', async () => {
  const fixture = JSON.parse(await readFile(new URL('./test/fixtures/save-v1.json', import.meta.url), 'utf8'));
  assert.deepEqual(normalizeState(fixture, 1), fixture);
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
  const a = sandbox.MixKitSave.createSaveStore(D.SAVE_NAMESPACE, { version: 1, storage: memory() });
  const b = sandbox.MixKitSave.createSaveStore(D.SAVE_NAMESPACE, { version: 1, storage: memory() });
  const state = run(builtGame(21, 'guarantee'), [{ type: 'confirmPromotion' }]);
  a.save(state);
  const imported = b.importCode(a.exportCode());
  assert.deepEqual(normalizeState(imported, 1), state);
  assert.deepEqual(normalizeState(b.importCode(Buffer.from('{"evil":true}').toString('base64')), 5), createGame(5));
});

test('validateLayout keeps the reference layout intact', () => {
  const { accepted, problems } = validateLayout(REFERENCE_LAYOUT);
  assert.equal(problems.length, 0);
  assert.equal(accepted.length, REFERENCE_LAYOUT.length);
});
