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

import { createServices, advanceServices, serviceSummary, saveServices, loadServices } from './services.mjs';
import { guestTimeline, guestRoute, alongGuestRoute } from './service-guests.mjs';
const spec = { id: 'motion', closeAt: 8, gateRate: 3, barRate: 0, workerRate: 1, travelMinutes: 2, gatePatience: 2, barPatience: 2, ticketPrice: 10, barNet: 4, arrivals: [{ minute: 1, prepaid: 3, walkup: 7 }] };
const visual = run => ({ ...serviceSummary(run), events: run.events });

test('guest transitions: causal identities cover admission, sale, bar abandonment and outside departure', () => {
  const run = advanceServices(createServices(spec), 3), timeline = guestTimeline(run.events);
  assert.equal(timeline.length, 10);
  assert.equal(new Set(timeline.map(g => g.id)).size, 10);
  const last = zone => timeline.filter(g => g.history.at(-1).zone === zone).length;
  assert.equal(last('gate'), serviceSummary(run).gate.waiting);
  assert.equal(last('bar'), serviceSummary(run).bar.waiting);
  assert.equal(last('floor') + last('bar'), run.totals.admitted);
  assert.equal(last('leaving'), run.totals.abandoned);
  assert.ok(timeline.some(g => g.history.some(h => h.zone === 'floor' && h.cause === 'patience')), 'bar abandonment stays inside');
  const summary = visual(run), before = structuredClone(summary);
  const start = projectServiceCrowd(layout, summary, 3, 0), middle = projectServiceCrowd(layout, summary, 3, 0.5), end = projectServiceCrowd(layout, summary, 3, 1);
  assert.equal(middle.transitions.recordedDepartures, run.totals.abandoned);
  assert.ok(middle.transitions.departingSamples > 0);
  assert.equal(end.transitions.departingSamples, 0, 'paused/reduced motion shows committed outcomes');
  assert.deepEqual(start.totals, end.totals);
  assert.equal(end.totals.bar + end.totals.floor, run.totals.admitted);
  assert.ok(middle.actors.some(a => { const p = start.actors.find(p => p.id === a.id); return p && (p.x !== a.x || p.y !== a.y); }));
  assert.equal(new Set(middle.actors.map(a => a.id)).size, middle.actors.length);
  assert.deepEqual(summary, before);
});

test('guest transitions: same-minute admission and sale traverse recorded anchors without new state', () => {
  const run = advanceServices(createServices({ ...spec, barRate: 10 }), 1), summary = visual(run);
  const guest = guestTimeline(run.events).find(g => g.history.at(-1).zone === 'floor');
  assert.deepEqual(guest.history.map(h => h.zone), ['gate', 'bar', 'floor']);
  const start = projectServiceCrowd(layout, summary, 1, 0), end = projectServiceCrowd(layout, summary, 1, 1);
  const a = start.actors.find(a => a.id === guest.id), b = end.actors.find(a => a.id === guest.id);
  assert.ok(a.y > 16 && b.y < 16);
  assert.equal(a.events.length, 3);
  assert.equal(a.routeUnavailable, false);
  assert.deepEqual(projectServiceCrowd(layout, visual(loadServices(saveServices(run)))), end, 'reload has the committed final positions');
});

test('guest transitions: batched clocks agree and large queues stay within their drawing budget', () => {
  let slow = createServices(spec); for (let minute = 1; minute <= 8; minute++) slow = advanceServices(slow, minute);
  const fast = advanceServices(createServices(spec), 8);
  assert.deepEqual(projectServiceCrowd(layout, visual(slow)), projectServiceCrowd(layout, visual(fast)));
  const large = advanceServices(createServices({ ...spec, arrivals: [{ minute: 1, prepaid: 0, walkup: 6000 }] }), 3);
  const frame = projectServiceCrowd(layout, visual(large), 3, 0.5);
  assert.ok(frame.actors.length <= 180);
  assert.ok(frame.transitions.departingSamples <= 12);
  assert.equal(frame.transitions.recordedDepartures, large.totals.abandoned);
  assert.equal(new Set(frame.actors.map(a => a.id)).size, frame.actors.length);
});


test('guest routes: interior steps avoid occupied cells and missing access remains cosmetic', () => {
  const route = guestRoute(layout, layout.bar, layout.gate);
  const free = new Set(layout.free.map(p => `${p.x},${p.y}`));
  for (let i = 0; i < route.length; i++) {
    assert.ok(free.has(`${route[i].x},${route[i].y}`));
    if (i) assert.equal(Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y), 1);
  }
  assert.deepEqual(alongGuestRoute([layout.bar], 0.5), { ...layout.bar, heading: Math.PI, moving: false });
  const inaccessible = { ...layout, free: [] }, run = visual(advanceServices(createServices(spec), 3));
  const before = structuredClone(run), frame = projectServiceCrowd(inaccessible, run, 3, 0.5);
  assert.ok(frame.transitions.unavailable > 0);
  assert.deepEqual(run, before);
  assert.equal(frame.totals.bar + frame.totals.floor, run.admitted);
});
