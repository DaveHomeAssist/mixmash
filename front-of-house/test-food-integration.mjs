// Placed vendor terms, guest projection and one-time career settlement integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_LAYOUT, INCIDENTS } from './data.mjs';
import { createGame, applyAction, normalizeState, liveServicesFor, liveAccessFor, liveEndMinute, settlementFor, settlementPayout, evaluateVenue, validateLayout } from './engine.mjs';
import { createServiceLayout, projectServiceCrowd } from './service-crowd.mjs';
const layout = [...STARTER_LAYOUT, { type: 'food', x: 3, y: 8, rot: 0 }];
const act = (state, action) => { const r = applyAction(state, action); assert.equal(r.error, null, action.type); return r.state; };
function prepared(plan = 'standard', deal = 'door', objects = layout, seed = 170) {
  return [{ type: 'chooseDeal', deal, artistId: 'sodium-arcade' }, { type: 'setLayout', objects },
    { type: 'confirmBuild' }, { type: 'setPromotion', services: true, foodPlan: plan }].reduce(act, createGame(seed));
}
const open = (s) => act(s, { type: 'confirmPromotion', services: true, flow: 1 });
function finish(s) {
  s = act(s, { type: 'advanceLive', minute: 240 });
  s = act(s, { type: 'respond', responseId: INCIDENTS[s.show.incidentId].responses.find(r => r.cost <= s.cash).id });
  s = act(s, { type: 'advanceLive', minute: 240 });
  return act(s, { type: 'advanceLive', minute: liveEndMinute(s) });
}

test('vendor requires one connected Lot stall and live flow before any charge', () => {
  for (const s of [prepared('standard', 'door', STARTER_LAYOUT), prepared('standard', 'door', [...layout,
    { type: 'restroom', x: 3, y: 7, rot: 0 }, { type: 'restroom', x: 4, y: 7, rot: 0 },
    { type: 'restroom', x: 5, y: 8, rot: 0 }, { type: 'restroom', x: 3, y: 9, rot: 0 }, { type: 'restroom', x: 4, y: 9, rot: 0 }])]) {
    const before = structuredClone(s), r = applyAction(s, { type: 'confirmPromotion', services: true, flow: 1 });
    assert.match(r.error, /connected stall/); assert.deepEqual(r.state, before);
  }
  const s = prepared();
  assert.ok(applyAction(s, { type: 'confirmPromotion', services: false }).error);
  assert.ok(applyAction(s, { type: 'confirmPromotion', services: true }).error);
  assert.equal(liveAccessFor(s).usableVendors, 1);
  assert.ok(evaluateVenue(s.venue).capacity <= evaluateVenue({ ...s.venue, objects: STARTER_LAYOUT }).capacity);
  assert.ok(validateLayout([...layout, { type: 'food', x: 6, y: 8, rot: 0 }], s.venue).problems.length);
  assert.ok(validateLayout([{ type: 'food', x: 1, y: 1, rot: 0 }], { id: 'club' }).problems.length);
});

test('food terms lock at doors; replay ignores supplied gross and malformed terms recover', () => {
  const s = act(open(prepared('premium')), { type: 'advanceLive', minute: 20 });
  assert.deepEqual(s.show.food, { version: 1, plan: 'premium' });
  assert.ok(applyAction(s, { type: 'setPromotion', foodPlan: 'standard' }).error);
  const imported = structuredClone(s); imported.show.food.gross = 999999;
  imported.show.food.accessible = true; imported.promotion.foodPlan = 'standard';
  const normalized = normalizeState(imported);
  assert.deepEqual(liveServicesFor(normalized).food, liveServicesFor(s).food);
  for (const bad of [{ version: 2, plan: 'premium' }, { version: 1, plan: 'fake' }, null]) {
    const damaged = structuredClone(s); damaged.show.food = bad;
    const recovered = normalizeState(damaged);
    assert.equal(recovered.show.food, undefined); assert.equal(recovered.show.serviceRecovered, true);
    assert.equal(recovered.cash, s.cash);
  }
});

test('only house share changes both deals; artist basis and repeated signing stay unchanged', () => {
  for (const deal of ['door', 'guarantee']) {
    const plain = finish(open(prepared(null, deal))), vendor = finish(open(prepared('standard', deal)));
    const a = settlementFor(plain), b = settlementFor(vendor);
    assert.ok(b.foodIncome > 0); assert.equal(b.artistPay, a.artistPay); assert.deepEqual(b.costs, a.costs);
    assert.equal(b.net - a.net, b.foodIncome);
    assert.equal(settlementPayout(b, deal) - settlementPayout(a, deal), b.foodIncome);
    const signed = act(vendor, { type: 'acceptSettlement', at: '2026-10-04T00:00:00Z' });
    assert.equal(signed.cash, vendor.cash + settlementPayout(b, deal));
    assert.ok(applyAction(signed, { type: 'acceptSettlement' }).error);
    assert.equal(normalizeState(signed).cash, signed.cash);
    assert.equal(normalizeState(signed).phase, 'done');
    assert.deepEqual(settlementFor(normalizeState(signed)), b);
  }
});

test('food guest events conserve all four zones through reload and normal departure', () => {
  let s = open(prepared('standard', 'door', layout, 3)), hadFood = false, hadFoodMotion = false;
  s = act(s, { type: 'assignLiveWorker', station: 'gate' });
  const visual = createServiceLayout(s.venue.objects, s.venue.grid, liveAccessFor(s));
  for (let minute = 1; minute <= 240; minute++) {
    s = act(s, { type: 'advanceLive', minute });
    if (!s.show.responseId && s.show.services.minute < minute) {
      s = act(s, { type: 'respond', responseId: INCIDENTS[s.show.incidentId].responses.find(r => r.cost <= s.cash).id });
      s = act(s, { type: 'advanceLive', minute });
    }
    const services = liveServicesFor(s, { events: true });
    const view = projectServiceCrowd(visual, services);
    assert.equal(view.totals.bar + view.totals.food + view.totals.floor, services.inside);
    assert.equal(view.totals.food, services.food.totals.waiting);
    assert.ok(view.actors.length <= 180); assert.equal(new Set(view.actors.map(a => a.id)).size, view.actors.length);
    if (view.totals.food) {
      hadFood = true; assert.ok(view.actors.some(a => a.zone === 'food'));
      const moving = projectServiceCrowd(visual, services, services.minute, 0.5);
      hadFoodMotion ||= moving.actors.some(a => a.events?.some(id => id.includes(':food:')) && view.actors.some(b => b.id === a.id && (a.x !== b.x || a.y !== b.y)));
    }
    if (minute === 20) assert.deepEqual(projectServiceCrowd(visual, liveServicesFor(normalizeState(s), { events: true })), view);
  }
  assert.ok(hadFood); assert.ok(hadFoodMotion);
  for (let minute = 241; minute <= liveEndMinute(s); minute++) {
    s = act(s, { type: 'advanceLive', minute });
    const service = liveServicesFor(s, { events: true }), view = projectServiceCrowd(visual, service);
    assert.equal(view.totals.floor, service.inside); assert.equal(view.totals.food, 0);
  }
  assert.equal(s.phase, 'settle'); assert.equal(liveServicesFor(s).inside, 0);
});
