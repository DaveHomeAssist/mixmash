// Vendor replay, finite consumer budgets and separate provider/house accounting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServices, advanceServices, assignServiceWorker, saveServices } from './services.mjs';
import { FOOD_PLANS, foodTerms, concessionsFor, saveConcessions, loadConcessions } from './concessions.mjs';

const setup = (count = 40, overrides = {}) => createServices({ id: 'food_test', closeAt: 120,
  gateRate: 20, barRate: 20, workerRate: 1, travelMinutes: 2, gatePatience: 120, barPatience: 6,
  ticketPrice: 10, barNet: 6, arrivals: [{ minute: 1, prepaid: count }], ...overrides });
const replay = (s, plan = 'standard', accessible = true) => concessionsFor(saveServices(s), foodTerms(plan, accessible));
function conserved(s) {
  const t = s.totals;
  assert.equal(t.requested, t.served + t.lost + t.waiting);
  assert.equal(t.interested, t.requested + t.declinedPrice + t.declinedBudget);
  assert.equal(t.served + s.stock, FOOD_PLANS[s.terms.plan].stock);
  assert.equal(t.vendorGross, t.houseIncome + t.vendorReceipts);
  assert.equal(t.vendorProfit, t.vendorReceipts - t.inventoryCost - t.wages);
  assert.equal(t.foodSpend, t.vendorGross);
  assert.equal(new Set(s.guests.map(g => g.id)).size, t.admitted);
  assert.equal(new Set(s.events.map(e => e.id)).size, s.events.length);
  for (const g of s.guests) {
    assert.ok(g.remaining >= 0);
    assert.equal(g.budget, g.remaining + g.barSpend + g.foodSpend);
  }
}

test('concessions conserve budgets, requests, stock and separate money at every minute', () => {
  let s = setup(600, { gateRate: 8, barRate: 6 });
  for (let minute = 0; minute <= s.spec.closeAt; minute++) {
    s = advanceServices(s, minute);
    for (const plan of ['standard', 'premium']) {
      const food = replay(s, plan); conserved(food);
      assert.equal(food.totals.barSpend, s.totals.barServed * 8);
      assert.equal(food.guests.length, s.totals.admitted);
      assert.equal(food.totals.waiting, food.guests.filter(g => g.food === 'waiting').length);
    }
  }
});

test('one-way switching preserves actual guest identities and never repeats bar spending', () => {
  let s = setup(30, { barRate: 0, barPatience: 1 });
  s = assignServiceWorker(s, 'gate').state;
  s = advanceServices(s, s.spec.closeAt);
  const before = structuredClone(s), food = replay(s, 'premium');
  conserved(food); assert.deepEqual(s, before);
  assert.ok(food.events.some(e => e.cause === 'request' && e.result.switched));
  assert.equal(food.totals.barSpend, 0);
  assert.ok(food.totals.served > 0);
  const arrivedIds = s.events.filter(e => e.cause === 'arrival').flatMap(e => Array.from({ length: e.result.count }, (_, i) => `${e.id}:guest:${i}`));
  assert.deepEqual(food.guests.map(g => g.id), arrivedIds);
  assert.equal(new Set(food.events.filter(e => e.cause === 'request').map(e => e.guestId)).size, food.totals.requested);
});

test('higher price loses price-sensitive and budget-limited demand; quiet and surge choices differ', () => {
  const quiet = advanceServices(setup(24, { gateRate: 2, barRate: 2 }), 120);
  const surge = advanceServices(setup(960, { gateRate: 8, barRate: 8 }), 120);
  const standardQuiet = replay(quiet), premiumQuiet = replay(quiet, 'premium');
  const standardSurge = replay(surge), premiumSurge = replay(surge, 'premium');
  assert.ok(premiumQuiet.totals.declinedPrice > 0);
  assert.ok(premiumQuiet.totals.declinedBudget > 0);
  assert.ok(standardQuiet.totals.houseIncome > premiumQuiet.totals.houseIncome);
  assert.ok(premiumSurge.totals.houseIncome > standardSurge.totals.houseIncome);
  assert.equal(standardSurge.stock, 0);
  assert.ok(standardSurge.events.some(e => e.cause === 'stockout'));
  for (const food of [standardQuiet, premiumQuiet, standardSurge, premiumSurge]) conserved(food);
});

test('access, patience and closing resolve finite requests without phantom sales', () => {
  const closed = advanceServices(setup(100, { closeAt: 1, gatePatience: 1, gateRate: 100, barRate: 100 }), 1);
  const food = replay(closed); conserved(food);
  assert.equal(food.totals.served, 2); assert.equal(food.totals.waiting, 0);
  assert.ok(food.events.some(e => e.cause === 'closed'));
  const noAccess = replay(closed, 'standard', false); conserved(noAccess);
  assert.equal(noAccess.totals.served, 0); assert.equal(noAccess.totals.houseIncome, 0);
  assert.equal(noAccess.totals.lost, noAccess.totals.requested);
  assert.ok(noAccess.events.some(e => e.cause === 'access'));
  const patient = replay(advanceServices(setup(100, { gateRate: 100, barRate: 100 }), 10));
  assert.equal(patient.totals.served, 12);
  assert.equal(patient.totals.waiting, 0);
  assert.ok(patient.events.some(e => e.cause === 'patience' && e.minute === 7)); conserved(patient);
});

test('checkpoint replay ignores derived money and matches minute stepping with transfers', () => {
  let stepped = setup(400, { gateRate: 4, barRate: 2 });
  stepped = advanceServices(stepped, 5);
  stepped = assignServiceWorker(stepped, 'gate').state;
  const checkpoint = saveServices(stepped), before = structuredClone(checkpoint);
  const batched = replay(advanceServices(stepped, 80), 'premium');
  for (let minute = 6; minute <= 80; minute++) stepped = advanceServices(stepped, minute);
  assert.deepEqual(replay(stepped, 'premium'), batched);
  const saved = saveConcessions(batched);
  assert.deepEqual(Object.keys(saved).sort(), ['services', 'terms', 'version']);
  saved.totals = { houseIncome: 999999 }; saved.stock = 999999; saved.guests = [];
  assert.deepEqual(loadConcessions(saved), batched);
  assert.deepEqual(checkpoint, before);
  conserved(batched);
});

test('unadmitted guests have no food request or discretionary spend', () => {
  const s = advanceServices(setup(100, { gateRate: 0 }), 120), food = replay(s);
  assert.equal(s.totals.admitted, 0); assert.equal(food.guests.length, 0);
  assert.equal(food.totals.requested, 0); assert.equal(food.totals.vendorGross, 0);
  assert.equal(food.totals.vendorProfit, -320); conserved(food);
});

test('malformed locked terms and source checkpoints are rejected within the finite bound', () => {
  const services = saveServices(setup());
  for (const terms of [null, {}, { version: 2, plan: 'standard', accessible: true },
    { version: 1 }, { version: 1, plan: '__proto__', accessible: true },
    { version: 1, plan: 'premium', accessible: 'true' }]) assert.throws(() => concessionsFor(services, terms));
  assert.throws(() => loadConcessions({ version: 2 }));
  assert.throws(() => concessionsFor({ ...services, minute: Infinity }, foodTerms()));
  assert.throws(() => concessionsFor({ ...services, spec: { ...services.spec, arrivals: [{ minute: 1, walkup: 6001 }] } }, foodTerms()));
  const maximum = replay(advanceServices(setup(6000, { gateRate: 6000, barRate: 6000 }), 120));
  conserved(maximum); assert.equal(maximum.guests.length, 6000);
  assert.ok(maximum.events.length <= 18000);
});
