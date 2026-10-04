// Sanitation replay conserves visits, stall use, cleaning work and source identity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServices, advanceServices, saveServices } from './services.mjs';
import { foodTerms, concessionsFor } from './concessions.mjs';
import { sanitationFor, sanitationSpec, saveSanitation, loadSanitation, SANITATION } from './sanitation.mjs';
const specification = (changes = {}) => ({ version: 1, portables: 2, portableAccess: true,
  trailer: false, trailerAccess: true, utilities: true, cleaner: true, ...changes });
const setup = (changes = {}) => createServices({ id: 'sanitation_test', closeAt: 120, gateRate: 4, barRate: 4,
  workerRate: 1, travelMinutes: 2, gatePatience: 120, barPatience: 6, ticketPrice: 10, barNet: 6,
  arrivals: [{ minute: 1, prepaid: 400 }], ...changes });
const replay = (service, spec = specification(), food = null) => sanitationFor(saveServices(service), spec, food);
function conserved(s) {
  const t = s.totals;
  assert.equal(t.admitted, t.pending + t.waiting + t.using + t.served + t.lost);
  assert.equal(t.requested, t.waiting + t.using + t.served + t.lost);
  assert.equal(t.lost, Object.values(t.losses).reduce((a, b) => a + b, 0));
  assert.equal(new Set(s.guests.map(g => g.id)).size, t.admitted);
  assert.equal(new Set(s.events.filter(e => e.cause === 'visit-start').map(e => e.guestId)).size, s.events.filter(e => e.cause === 'visit-start').length);
  const cleaning = s.stalls.filter(stall => stall.cleaningUntil !== null);
  assert.equal(cleaning.length, s.worker ? 1 : 0);
  for (const stall of s.stalls) {
    assert.ok(stall.uses <= SANITATION.usesBeforeCleaning);
    assert.ok(!(stall.visit && stall.cleaningUntil !== null));
    if (!stall.available) assert.equal(stall.visit, null);
  }
}

test('sanitation conserves one visit per admitted guest through every clock minute', () => {
  let service = setup();
  for (let minute = 0; minute <= 120; minute++) {
    service = advanceServices(service, minute);
    const s = replay(service); conserved(s);
    assert.equal(s.totals.admitted, service.totals.admitted);
    if (minute === 120) {
      assert.equal(s.totals.pending + s.totals.waiting + s.totals.using, 0);
      assert.equal(s.worker, null);
    }
  }
});

test('cleaning uses one worker for three minutes and gates a dirty stall', () => {
  const closed = advanceServices(setup(), 120);
  const clean = replay(closed, specification({ portables: 1 }));
  const dirty = replay(closed, specification({ portables: 1, cleaner: false }));
  assert.equal(dirty.totals.served, 12); assert.equal(dirty.totals.cleanings, 0);
  assert.ok(clean.totals.served > dirty.totals.served);
  let worker = null;
  for (const event of clean.events) {
    if (event.cause === 'clean-start') { assert.equal(worker, null); worker = event; }
    if (event.cause === 'clean-complete') {
      assert.ok(worker); assert.equal(event.minute - worker.minute, 3); assert.equal(worker.stall, event.stall); worker = null;
    }
    if (event.cause === 'visit-start' && worker) assert.notEqual(event.stall, worker.stall);
  }
  assert.equal(worker, null); conserved(clean); conserved(dirty);
});

test('more stalls cannot bypass access or missing trailer utilities', () => {
  const service = advanceServices(setup(), 120);
  const missing = replay(service, specification({ portables: 30, portableAccess: false, trailer: true, utilities: false }));
  assert.equal(missing.totals.served, 0); assert.equal(missing.totals.usableStalls, 0);
  assert.ok(missing.totals.losses.access > 0); conserved(missing);
  const portable = replay(service, specification({ portables: 1, trailer: true, utilities: false }));
  const trailer = replay(service, specification({ portables: 1, trailer: true }));
  assert.equal(portable.totals.usableStalls, 1); assert.equal(trailer.totals.usableStalls, 4);
  assert.ok(trailer.totals.served > portable.totals.served);
  const inaccessible = replay(service, specification({ portables: 0, trailer: true, trailerAccess: false }));
  assert.equal(inaccessible.totals.served, 0);
});

test('food waiting cannot also queue for sanitation and completed meals delay the same guest', () => {
  const terms = foodTerms('standard');
  for (const minute of [5, 10, 15, 30, 90, 120]) {
    const service = advanceServices(setup({ gateRate: 12, barRate: 0 }), minute);
    const checkpoint = saveServices(service), food = concessionsFor(checkpoint, terms), sanitation = replay(service, specification(), terms);
    const waiting = new Set(food.queue);
    for (const guest of sanitation.guests) if (waiting.has(guest.id)) assert.equal(guest.status, 'pending');
    for (const event of food.events.filter(e => e.cause === 'sale')) {
      const guest = sanitation.guests.find(g => g.id === event.guestId);
      assert.ok(guest.due >= event.minute + 2);
    }
    conserved(sanitation);
  }
});

test('reload preserves busy stalls and cleaning; derived condition and work are not trusted', () => {
  let capturedVisit = false, capturedCleaning = false, service = setup();
  for (let minute = 1; minute <= 60; minute++) {
    service = advanceServices(service, minute);
    const state = replay(service, specification({ portables: 1 }));
    capturedVisit ||= state.totals.using > 0; capturedCleaning ||= !!state.worker;
    const saved = saveSanitation(state), before = structuredClone(saved);
    assert.deepEqual(loadSanitation(saved), state); assert.deepEqual(saved, before);
    assert.deepEqual(loadSanitation({ ...saved, totals: { served: 6000 }, stalls: [] }), state);
  }
  assert.ok(capturedVisit && capturedCleaning);
  assert.deepEqual(replay(service), replay(advanceServices(setup(), 60)));
});

test('closing stops incomplete starts and resolves delayed demand without departures or money', () => {
  const service = advanceServices(setup({ closeAt: 5, gatePatience: 5, arrivals: [{ minute: 4, prepaid: 10 }] }), 5);
  const state = replay(service); conserved(state);
  assert.equal(state.totals.using + state.totals.waiting + state.totals.pending, 0);
  assert.equal(state.totals.served, 0); assert.equal(state.totals.lost, service.totals.admitted);
  assert.ok(state.events.every(e => !['departure', 'refund', 'sale'].includes(e.cause)));
  assert.equal(state.cash, undefined); assert.equal(state.totals.cash, undefined);
});

test('malformed specifications/checkpoints reject and maximum admitted demand stays bounded', () => {
  for (const raw of [null, {}, specification({ version: 2 }), specification({ portables: 401 }),
    specification({ portables: 399, trailer: true }), specification({ cleaner: 'yes' }), specification({ portables: 1.5 })]) assert.throws(() => sanitationSpec(raw));
  assert.throws(() => loadSanitation({ version: 2 }));
  const service = advanceServices(setup({ gateRate: 6000, barRate: 6000, arrivals: [{ minute: 1, walkup: 6000 }] }), 120);
  const state = replay(service, specification({ portables: 400 })); conserved(state);
  assert.equal(state.guests.length, 6000); assert.ok(state.events.length < 24000);
});
