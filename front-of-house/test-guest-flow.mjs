// Lot connectivity and finite normal departure conservation, replay and validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lotAccess, createDeparture, advanceDeparture, departureSummary, departureEvents, loadDeparture } from './guest-flow.mjs';
import { STARTER_LAYOUT, INCIDENTS } from './data.mjs';
import { createGame, evaluateVenue, applyAction, normalizeState, liveServicesFor, liveEndMinute, settlementFor, footprint } from './engine.mjs';

test('Lot access: starter portals connect without changing capacity or inputs', () => {
  const objects = structuredClone(STARTER_LAYOUT), before = structuredClone(objects);
  const venue = { ...createGame().venue, objects }, capacity = evaluateVenue(venue).capacity;
  const result = lotAccess(objects);
  assert.equal(result.usableGates, 1); assert.equal(result.usableExits, 3);
  assert.ok(result.floorTiles > 200);
  for (const p of result.portals) for (let i = 1; i < p.route.length; i++) {
    assert.equal(Math.abs(p.route[i].x - p.route[i - 1].x) + Math.abs(p.route[i].y - p.route[i - 1].y), 1);
  }
  assert.deepEqual(objects, before); assert.equal(evaluateVenue(venue).capacity, capacity);
});

test('Lot access: disconnected exits reduce throughput and equal regions use row-major order', () => {
  const objects = [{ type: 'gate', x: 0, y: 1 }, { type: 'exit', x: 0, y: 3 }, { type: 'exit', x: 6, y: 3 },
    ...Array.from({ length: 5 }, (_, y) => ({ type: 'restroom', x: 3, y }))];
  const access = lotAccess(objects, { w: 7, h: 5 });
  assert.equal(access.usableExits, 1);
  // The right region has one fewer portal footprint and therefore wins.
  assert.equal(access.usableGates, 0);
  assert.match(access.portals.find(p => p.type === 'gate').reason, /Disconnected/);
  const tied = lotAccess([...objects, { type: 'gate', x: 6, y: 1 }], { w: 7, h: 5 });
  assert.equal(tied.portals.find(p => p.x === 0).usable, true);
  assert.deepEqual(lotAccess(JSON.parse(JSON.stringify(objects)), { w: 7, h: 5 }), access);
  assert.equal(lotAccess([{ type: 'exit', x: 2, y: 2 }], { w: 5, h: 5 }).usableExits, 0);
});

test('Lot access: rotated footprints cannot route through equipment', () => {
  const objects = [{ type: 'bar', x: 2, y: 1, rot: 1 }, { type: 'exit', x: 4, y: 2 }];
  const result = lotAccess(objects, { w: 5, h: 5 });
  assert.equal(result.floorTiles, 22);
  for (const p of result.portals[0].route) assert.ok(!(p.x === 2.5 && (p.y === 1.5 || p.y === 2.5)));
  assert.throws(() => lotAccess([], { w: 0, h: 5 }));
});

test('normal departure: quiet and surge demand conserve people with finite event receipts', () => {
  for (const admitted of [0, 1, 15, 150, 6000]) for (const exits of [0, 1, 3]) {
    const start = createDeparture(admitted, exits), original = structuredClone(start);
    let state = start;
    for (let minute = 0; minute <= 60; minute++) {
      state = advanceDeparture(state, minute);
      const summary = departureSummary(state);
      assert.equal(summary.departed + summary.remaining, admitted);
      assert.equal(summary.rate, exits * 5);
      assert.equal(departureEvents(state).reduce((n, e) => n + e.result.count, 0), summary.departed);
      for (const event of departureEvents(state)) assert.ok(event.result.count <= summary.rate);
      assert.deepEqual(loadDeparture(JSON.parse(JSON.stringify(state))), state);
    }
    assert.deepEqual(state, advanceDeparture(start, 60));
    assert.deepEqual(start, original);
    const end = departureSummary(advanceDeparture(start, 6000));
    assert.equal(end.complete, !!exits || admitted === 0);
    assert.equal(end.blocked, !exits && admitted > 0);
    assert.deepEqual(Object.keys(start), ['version', 'admitted', 'exits', 'minute']);
  }
});

test('normal departure: partial blocked access slows departure without adding people', () => {
  const full = departureSummary(advanceDeparture(createDeparture(150, 3), 5));
  const reduced = departureSummary(advanceDeparture(createDeparture(150, 1), 5));
  assert.equal(full.departed, 75); assert.equal(reduced.departed, 25);
  assert.equal(full.duration, 10); assert.equal(reduced.duration, 30);
  assert.equal(full.admitted, reduced.admitted);
});

test('normal departure: malformed or impossible checkpoints cannot create progress', () => {
  for (const raw of [null, {}, { version: 2 }, { version: 1, admitted: -1, exits: 1, minute: 0 },
    { version: 1, admitted: 6001, exits: 1, minute: 0 }, { version: 1, admitted: 10, exits: 0, minute: 1 },
    { version: 1, admitted: 10, exits: 1, minute: 3 }, { version: 1, admitted: 10, exits: 1.5, minute: 0 },
    { version: 1, admitted: 10, exits: 1, minute: NaN }]) assert.throws(() => loadDeparture(raw));
  assert.throws(() => advanceDeparture(advanceDeparture(createDeparture(100, 1), 3), 2));
  assert.throws(() => advanceDeparture(createDeparture(100, 1), 6001));
});


const act = (state, action) => { const result = applyAction(state, action); assert.equal(result.error, null, action.type); return result.state; };
const prepared = (objects = STARTER_LAYOUT) => [
  { type: 'chooseDeal', deal: 'door', artistId: 'sodium-arcade' },
  { type: 'setLayout', objects }, { type: 'confirmBuild' },
].reduce(act, createGame(170));
const closing = (flow = true) => {
  let s = act(prepared(), { type: 'confirmPromotion', services: true, ...(flow ? { flow: 1 } : {}) });
  s = act(s, { type: 'advanceLive', minute: 240 });
  s = act(s, { type: 'respond', responseId: INCIDENTS[s.show.incidentId].responses.find(r => r.cost <= s.cash).id });
  return act(s, { type: 'advanceLive', minute: 240 });
};

test('departure integration: closing preserves attendance and receipts; settlement waits for exits', () => {
  const s = closing(), before = liveServicesFor(s);
  assert.equal(s.phase, 'show'); assert.equal(before.serviceClosed, true); assert.equal(before.closed, false);
  assert.equal(before.inside, before.admitted); assert.equal(before.departed, 0);
  assert.ok(applyAction(s, { type: 'acceptSettlement' }).error);
  const partial = act(s, { type: 'advanceLive', minute: 242 }), midway = liveServicesFor(partial);
  assert.equal(midway.departed, 30); assert.equal(midway.inside + midway.departed, before.admitted);
  assert.equal(midway.cash, before.cash); assert.equal(partial.cash, s.cash);
  assert.deepEqual(normalizeState(partial).show, partial.show);
  let stepped = s;
  for (let minute = 241; minute <= liveEndMinute(s); minute++) stepped = act(stepped, { type: 'advanceLive', minute });
  const end = act(s, { type: 'advanceLive', minute: liveEndMinute(s) });
  assert.deepEqual(end, stepped); assert.equal(end.phase, 'settle');
  assert.equal(liveServicesFor(end).inside, 0); assert.equal(settlementFor(end).attendance, before.admitted);
  const signed = act(end, { type: 'acceptSettlement', at: '2026-10-04T00:00:00Z' });
  assert.equal(normalizeState(signed).cash, signed.cash); assert.equal(normalizeState(signed).phase, 'done');
});

test('departure integration: old live saves keep closing semantics and malformed progress recovers', () => {
  const legacy = closing(false); assert.equal(legacy.phase, 'settle'); assert.equal(legacy.show.flow, undefined);
  assert.equal(normalizeState(legacy).phase, 'settle');
  const partial = act(closing(), { type: 'advanceLive', minute: 242 });
  const unknownVersion = structuredClone(partial); unknownVersion.show.flow = { version: 99, minute: 2 };
  assert.equal(normalizeState(unknownVersion).show.flow.minute, 0);
  assert.equal(normalizeState(unknownVersion).show.serviceRecovered, true);
  for (const value of [-1, 1000, 1.5, null]) {
    const corrupt = structuredClone(partial); corrupt.show.flow.minute = value;
    const recovered = normalizeState(corrupt);
    assert.equal(recovered.show.flow.minute, 0); assert.equal(recovered.phase, 'show');
    assert.equal(recovered.show.serviceRecovered, true); assert.equal(recovered.cash, partial.cash);
    assert.equal(liveServicesFor(recovered).cash, liveServicesFor(partial).cash);
  }
});

function seal(type) {
  const objects = structuredClone(STARTER_LAYOUT), portal = objects.find(o => o.type === type);
  const occupied = new Set(objects.flatMap(footprint).map(([x, y]) => `${x},${y}`));
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const x = portal.x + dx, y = portal.y + dy;
    if (x >= 0 && y >= 0 && x < 24 && y < 16 && !occupied.has(`${x},${y}`)) objects.push({ type: 'restroom', x, y, rot: 0 });
  }
  return objects;
}

test('departure integration: disconnected admission refuses before payment; blocked exits reduce flow only', () => {
  const s = prepared(seal('gate')), before = structuredClone(s);
  const rejected = applyAction(s, { type: 'confirmPromotion', services: true, flow: 1 });
  assert.match(rejected.error, /Connect admission/); assert.deepEqual(rejected.state, before);
  const partial = act(prepared(seal('exit')), { type: 'confirmPromotion', services: true, flow: 1 });
  assert.equal(liveServicesFor(partial).departure.exits, 2);
  assert.equal(evaluateVenue(partial.venue).capacity, evaluateVenue(prepared().venue).capacity);
  const oneGate = act(prepared([...seal('gate'), { type: 'gate', x: 0, y: 8, rot: 0 }]), { type: 'confirmPromotion', services: true, flow: 1 });
  assert.equal(evaluateVenue(oneGate.venue).gates, 2);
  assert.equal(liveServicesFor(oneGate).gate.rate, 5, 'only the connected gate serves arrivals');
});


import { createServiceLayout, projectServiceCrowd } from './service-crowd.mjs';
test('normal departure presentation: recorded guests traverse usable exits and disappear without changing cash', () => {
  const start = closing(), sourceCash = liveServicesFor(start).cash;
  for (let minute = 241; minute <= liveEndMinute(start); minute++) {
    const s = act(start, { type: 'advanceLive', minute }), summary = liveServicesFor(s, { events: true });
    const layout = createServiceLayout(s.venue.objects, s.venue.grid, summary.departure.access);
    const before = projectServiceCrowd(layout, summary, minute, 0), middle = projectServiceCrowd(layout, summary, minute, 0.5), end = projectServiceCrowd(layout, summary, minute, 1);
    assert.equal(end.totals.bar + end.totals.floor + summary.departed, summary.admitted);
    assert.equal(middle.transitions.unavailable, 0);
    assert.ok(middle.actors.some(a => a.zone === 'departing'));
    assert.ok(middle.actors.some(a => { const b = before.actors.find(b => b.id === a.id); return a.zone === 'departing' && b && (a.x !== b.x || a.y !== b.y); }));
    assert.ok(!end.actors.some(a => a.zone === 'departing'));
    assert.equal(liveServicesFor(s).cash, sourceCash);
    assert.equal(new Set(middle.actors.map(a => a.id)).size, middle.actors.length);
    assert.deepEqual(liveServicesFor(normalizeState(s), { events: true }), summary);
  }
});
