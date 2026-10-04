// Lot connectivity and finite normal departure conservation, replay and validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lotAccess, createDeparture, advanceDeparture, departureSummary, departureEvents, loadDeparture } from './guest-flow.mjs';
import { STARTER_LAYOUT } from './data.mjs';
import { createGame, evaluateVenue } from './engine.mjs';

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
