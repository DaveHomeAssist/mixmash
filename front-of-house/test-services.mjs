// Behavioral fixtures for the aggregate live-service prerequisite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServices, advanceServices, assignServiceWorker, serviceSummary, saveServices, loadServices } from './services.mjs';

const spec = (arrivals, extra = {}) => ({ id: 'fixture', arrivals, ...extra });
const move = (s, station) => {
  const result = assignServiceWorker(s, station);
  assert.equal(result.error, null);
  return result.state;
};
const quiet = spec([1, 2, 3, 4].map((minute) => ({ minute, walkup: 1 })));
const surge = spec([{ minute: 1, walkup: 12 }]);
const busy = spec([{ minute: 1, prepaid: 12 }], { gateRate: 12 });
const finish = (s) => advanceServices(s, s.spec.closeAt);
const transferAndReturn = (raw) => finish(move(advanceServices(move(createServices(raw), 'gate'), 3), 'bar'));

function conserved(s) {
  const r = serviceSummary(s);
  assert.equal(r.arrived, r.admitted + r.abandoned + r.gate.waiting);
  assert.equal(r.admitted, r.barServed + r.barLost + r.bar.waiting);
  assert.equal(r.barCash, r.barServed * s.spec.barNet);
  assert.ok(r.refunds <= r.prepaidCash);
  assert.equal(new Set(s.events.map((e) => e.id)).size, s.events.length);
}

test('quiet: four arrivals need no transfer and earn $100; absent bar worker loses $20', () => {
  const stay = serviceSummary(finish(createServices(quiet)));
  const gate = serviceSummary(finish(move(createServices(quiet), 'gate')));
  assert.equal(stay.admitted, 4);
  assert.equal(stay.barServed, 4);
  assert.equal(stay.cash, 100);
  assert.equal(gate.admitted, 4);
  assert.equal(gate.barLost, 4);
  assert.equal(gate.cash, 80);
});

test('surge: transfer admits 10 rather than 6 with two explicit lost bar requests', () => {
  const stay = serviceSummary(finish(createServices(surge)));
  const moved = serviceSummary(transferAndReturn(surge));
  assert.equal(stay.admitted, 6);
  assert.equal(stay.abandoned, 6);
  assert.equal(stay.cash, 150);
  assert.equal(moved.admitted, 10);
  assert.equal(moved.abandoned, 2);
  assert.equal(moved.barServed, 8);
  assert.equal(moved.barLost, 2);
  assert.equal(moved.cash, 240);
});

test('busy bar: transfer adds no admissions and loses eight sales ($40)', () => {
  const stay = serviceSummary(finish(createServices(busy)));
  const moved = serviceSummary(transferAndReturn(busy));
  assert.equal(stay.admitted, 12);
  assert.equal(stay.cash, 300);
  assert.equal(moved.admitted, 12);
  assert.equal(moved.barLost, 8);
  assert.equal(moved.cash, 260);
});

test('worker leaves immediately, contributes nowhere in transit and returns only after travel', () => {
  const original = createServices(surge);
  let s = move(original, 'gate');
  assert.equal(original.worker.station, 'bar');
  assert.equal(serviceSummary(s).bar.rate, 0);
  assert.equal(serviceSummary(s).gate.rate, 2);
  const rejected = assignServiceWorker(s, 'bar');
  assert.equal(rejected.state, s);
  assert.match(rejected.error, /transit/);
  s = advanceServices(s, 1);
  assert.equal(s.worker.station, null);
  s = advanceServices(s, 2);
  assert.equal(s.worker.station, 'gate');
  assert.equal(serviceSummary(s).gate.rate, 4);
  assert.match(assignServiceWorker(s, 'gate').error, /already/);
  s = move(s, 'bar');
  assert.equal(serviceSummary(s).gate.rate, 2);
  assert.equal(serviceSummary(s).bar.rate, 0);
  s = advanceServices(s, 4);
  assert.equal(serviceSummary(s).bar.rate, 2);
  assert.match(assignServiceWorker(finish(s), 'gate').error, /closed/);
});

test('prepaid refund and walk-up cash reconcile with the causal ledger', () => {
  const s = finish(createServices(spec([{ minute: 1, prepaid: 4, walkup: 4 }], { gateRate: 1, gatePatience: 2 })));
  const r = serviceSummary(s);
  assert.equal(r.prepaidCash, 80);
  assert.equal(r.admitted, 2);
  assert.equal(r.abandoned, 6);
  assert.equal(r.refunds, 40);
  assert.equal(r.walkupCash, 0);
  assert.equal(r.ticketCash, 40);
  assert.equal(r.cash, 50);
  const eventCash = s.events.reduce((sum, e) => sum + (e.result.cash || 0) - (e.result.refund || 0), 0);
  assert.equal(eventCash, r.cash);
  conserved(s);
});

test('minute-by-minute, batched advances and checkpoints are identical through queues and transfers', () => {
  let s = move(createServices(surge), 'gate');
  for (let minute = 0; minute <= 12; minute++) {
    if (minute === 3) s = move(s, 'bar');
    const before = structuredClone(s);
    const loaded = loadServices(JSON.parse(JSON.stringify(saveServices(s))));
    assert.deepEqual(loaded, s);
    assert.deepEqual(finish(loaded), finish(s));
    assert.deepEqual(advanceServices(s, minute), s);
    assert.deepEqual(s, before);
    conserved(s);
    if (minute < 12) s = advanceServices(s, minute + 1);
  }
  assert.deepEqual(s, transferAndReturn(surge));
});

test('closing drains pending demand exactly once and summaries never mutate cash', () => {
  const start = createServices(spec([{ minute: 1, prepaid: 10, walkup: 10 }], { closeAt: 1, gateRate: 1 }));
  const s = finish(start);
  const before = structuredClone(s);
  for (let i = 0; i < 3; i++) assert.deepEqual(serviceSummary(finish(s)), serviceSummary(s));
  assert.deepEqual(s, before);
  assert.equal(serviceSummary(s).gate.waiting, 0);
  assert.equal(serviceSummary(s).bar.waiting, 0);
  assert.equal(serviceSummary(s).abandoned, 19);
  assert.equal(start.minute, 0);
  conserved(s);
});

test('FIFO, prepaid ties, zero rates and oldest wait are explicit', () => {
  let s = createServices(spec([{ minute: 1, walkup: 2 }, { minute: 2, prepaid: 2 }], { gateRate: 0 }));
  s = advanceServices(s, 2);
  assert.equal(serviceSummary(s).gate.oldestWait, 1);
  assert.equal(serviceSummary(s).gate.estimatedMinutes, null);
  assert.equal(s.gate[0].kind, 'walkup');
  const tied = advanceServices(createServices(spec([{ minute: 1, walkup: 1 }, { minute: 1, prepaid: 1 }], { gateRate: 1 })), 1);
  assert.equal(tied.events.find((e) => e.cause === 'admission').result.kind, 'prepaid');
});

test('bounded fixtures conserve counts at every minute across rates and reassignment policies', () => {
  for (let rate = 0; rate < 6; rate++) {
    for (let policy = 0; policy < 3; policy++) {
      let s = createServices(spec(Array.from({ length: 10 }, (_, i) => ({ minute: i + 1, prepaid: i % 3, walkup: (i * 7) % 5 })), { gateRate: rate, barRate: rate % 2 }));
      for (let minute = 0; minute <= 12; minute++) {
        if (policy && (minute === 0 || (policy === 2 && minute === 4))) s = move(s, minute === 0 ? 'gate' : 'bar');
        conserved(s);
        if (minute < 12) s = advanceServices(s, minute + 1);
      }
      assert.deepEqual(loadServices(saveServices(s)), s);
    }
  }
});

test('invalid or excessive inputs and checkpoint commands fail without trusting derived balances', () => {
  for (const patch of [{ closeAt: 241 }, { gateRate: -1 }, { barRate: NaN }, { ticketPrice: 1.5 }, { travelMinutes: 0 }, { arrivals: [{ minute: 0 }] }, { arrivals: [{ minute: 1, prepaid: 6000, walkup: 1 }] }, { arrivals: Array(241).fill({ minute: 1 }) }, { id: '../bad' }]) {
    assert.throws(() => createServices({ ...quiet, ...patch }));
  }
  const s = createServices(quiet);
  const raw = saveServices(s);
  assert.throws(() => loadServices({ ...raw, version: 2 }));
  assert.throws(() => loadServices({ ...raw, minute: 13 }));
  assert.throws(() => loadServices({ ...raw, commands: [null] }));
  assert.throws(() => loadServices({ ...raw, commands: [{ minute: 0, station: 'bar' }] }));
  assert.throws(() => loadServices({ ...raw, minute: 2, commands: [{ minute: 0, station: 'gate' }, { minute: 1, station: 'bar' }] }));
  assert.deepEqual(loadServices({ ...raw, totals: { barCash: 999999 }, events: ['forged'] }), s);
  assert.throws(() => advanceServices(advanceServices(s, 2), 1));
});
