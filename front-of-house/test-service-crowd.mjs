// Service presentation conservation, bounded samples and obstacle-respecting worker paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServiceLayout, projectServiceCrowd } from './service-crowd.mjs';
import { STARTER_LAYOUT } from './data.mjs';
const layout = createServiceLayout(STARTER_LAYOUT);
const snapshot = (gate, bar, admitted) => ({ minute: 1, admitted, gate: { waiting: gate }, bar: { waiting: bar }, worker: { station: 'bar', destination: null } });

test('service crowd: bar demand is inside attendance; outside samples stay outside', () => {
  for (const [gate, bar, admitted] of [[0, 0, 0], [2, 8, 10], [500, 150, 180], [0, 0, 6000]]) {
    const source = snapshot(gate, bar, admitted), before = structuredClone(source), p = projectServiceCrowd(layout, source);
    assert.equal(p.totals.bar + p.totals.floor, admitted);
    assert.equal(p.totals.gate, gate);
    assert.ok(p.actors.length <= 180);
    assert.equal(new Set(p.actors.map(a => a.id)).size, p.actors.length);
    for (const a of p.actors) {
      if (a.zone === 'gate') assert.ok(a.x < 0 || a.x > 24 || a.y < 0 || a.y > 16);
      else assert.ok(a.x > 0 && a.x < 24 && a.y > 0 && a.y < 16);
    }
    assert.deepEqual(source, before);
    assert.deepEqual(projectServiceCrowd(layout, source), p);
  }
});

test('service crowd: route follows adjacent free cells and one saved worker interval', () => {
  assert.equal(layout.diagnostic, null);
  assert.deepEqual(layout.route[0], layout.bar);
  assert.deepEqual(layout.route.at(-1), layout.gate);
  for (let i = 1; i < layout.route.length; i++) assert.equal(Math.abs(layout.route[i].x - layout.route[i - 1].x) + Math.abs(layout.route[i].y - layout.route[i - 1].y), 1);
  const s = { ...snapshot(5, 5, 20), minute: 0, worker: { station: null, destination: 'gate', arrivesAt: 2 } };
  assert.deepEqual(projectServiceCrowd(layout, s, 0).worker, { ...layout.bar, id: 'worker', zone: 'worker' });
  assert.deepEqual(projectServiceCrowd(layout, s, 2).worker, { ...layout.gate, id: 'worker', zone: 'worker' });
  const halfway = projectServiceCrowd(layout, s, 1).worker;
  assert.notDeepEqual(halfway, projectServiceCrowd(layout, s, 0).worker);
  assert.deepEqual(projectServiceCrowd(layout, JSON.parse(JSON.stringify(s)), 1).worker, halfway);
});

test('service crowd: missing routes are diagnostic only and do not mutate queues', () => {
  const sealed = createServiceLayout([...STARTER_LAYOUT, ...Array.from({ length: 24 }, (_, x) => ({ type: 'restroom', x, y: 10, rot: 0 }))]);
  assert.equal(sealed.route.length, 0);
  const s = { ...snapshot(3, 4, 10), worker: { station: null, destination: 'gate', arrivesAt: 3 } };
  const p = projectServiceCrowd(sealed, s);
  assert.match(p.diagnostic, /No visual worker route/);
  assert.equal(p.totals.bar, 4); assert.equal(p.totals.gate, 3);
});
