// Advisory evidence, hidden-outcome boundaries and immutable presentation reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { advisoryFor } from './advisory.mjs';
import * as E from './engine.mjs';
import * as D from './data.mjs';

const act = (s, a) => { const r = E.applyAction(s, a); assert.equal(r.error, null, `${a.type}: ${r.error}`); return r.state; };
function freeze(s) { Object.values(s).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(s); }
function phases(room = 'lot', deal = 'guarantee', nights = 1) {
  let s = act(E.createGame(8, { mode: 'sandbox' }), { type: 'chooseVenue', venueId: room });
  const states = [s];
  s = act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal, nights,
    ...(room === 'festival' ? { secondId: 'hollow-census', stagePolicy: 1, festivalPolicy: 1, supportPolicy: 1, roomPolicy: 1 } : {}),
    ...(room === 'amphitheater' ? { seatingPolicy: 1, roomPolicy: 1, ...(nights > 1 ? { runPolicy: 1 } : {}) } : {}) });
  states.push(s);
  s = act(s, { type: 'setLayout', objects: [...E.venueSpec(s.venue).starter, ...(room === 'festival' ? D.FESTIVAL_SUPPORT_LAYOUT : [])] });
  s = act(s, { type: 'confirmBuild' }); states.push(s);
  s = act(s, { type: 'confirmPromotion' }); states.push(s);
  s = act(s, { type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses.at(-1).id }); states.push(s);
  s = act(s, { type: 'acceptSettlement', at: '2026-10-09T12:00:00.000Z', ...(nights > 1 ? { cancelRemaining: true } : {}) }); states.push(s);
  return states;
}

test('all six phases/four rooms read without changing state, RNG, cash, journal or history', () => {
  for (const room of Object.keys(D.VENUES)) for (const s of phases(room)) {
    const before = JSON.stringify(s); freeze(s);
    const first = advisoryFor(s); assert.deepEqual(advisoryFor(s), first);
    assert.equal(JSON.stringify(s), before);
    assert.deepEqual(Object.keys(first.sections), ['Ticketing', 'Talent', 'Operations']);
    assert.ok(!JSON.stringify(first).includes('undefined')); assert.ok(!JSON.stringify(first).includes('NaN'));
    assert.equal(first.priority.category in first.sections, true);
  }
});
test('pre-show public forecasts and advice cannot reveal hidden draw or future incident', () => {
  for (const room of Object.keys(D.VENUES)) {
    const s = phases(room)[2], before = advisoryFor(s);
    for (const seed of [1, 2, 983, 0xffffffff]) assert.deepEqual(advisoryFor({ ...s, seed, forcedIncident: 'rain' }), before);
    const f = E.forecast(s);
    assert.equal(before.sections.Ticketing.rows[0].value, `${f.low} to ${f.high} of ${f.capacity}`);
    assert.match(before.sections.Ticketing.title, /Forecast/);
    assert.equal(before.sections.Operations.rows[2].value, new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(E.upfrontFor(s)));
  }
});
test('blocking layout and doors reasons outrank forecast advice and match actual refusals', () => {
  const build = phases()[1], advice = advisoryFor(build);
  assert.equal(advice.priority.category, 'Operations');
  assert.ok(E.applyAction(build, { type: 'confirmBuild' }).error.includes(advice.priority.detail));
  const promote = { ...phases()[2], mode: 'career', cash: 0 };
  assert.equal(advisoryFor(promote).priority.detail, E.applyAction(promote, { type: 'confirmPromotion' }).error);
  const services = { ...phases()[2], promotion: { ...promote.promotion, liveServices: true } };
  services.venue.objects = services.venue.objects.filter(o => o.type !== 'bar');
  assert.equal(advisoryFor(services).priority.detail, E.applyAction(services, { type: 'confirmPromotion', services: true, flow: 1 }).error);
});
test('Show exposes only observed incident prompts or live counts; absent evidence stays unavailable', () => {
  const show = phases()[3];
  const first = advisoryFor(show);
  assert.match(first.sections.Ticketing.detail, /Not available/);
  assert.deepEqual(first, advisoryFor({ ...show, show: { ...show.show, incidentId: 'rain' } }));
  const observed = advisoryFor(show, { incidentPrompt: 'Gate jam' });
  assert.equal(observed.priority.detail, 'Gate jam'); assert.equal(observed.priority.action.target, 'phase');
  let live = phases()[2]; live = act(live, { type: 'confirmPromotion', services: true, flow: 1 });
  const summary = E.liveServicesFor(live), a = advisoryFor(live);
  assert.equal(a.sections.Ticketing.rows[1].value, String(summary.admitted));
  assert.equal(a.sections.Operations.rows[0].value, String(summary.gate.waiting));
});
test('settled/signed advice uses exact recorded values and held/sponsor receipts without reapplying', () => {
  for (const [room, deal, nights] of [['lot', 'door', 1], ['festival', 'sponsor', 1], ['amphitheater', 'guarantee', 2]]) {
    for (const s of phases(room, deal, nights).slice(4)) {
      const before = JSON.stringify(s), r = E.settlementFor(s), a = advisoryFor(freeze(s));
      assert.equal(a.sections.Ticketing.rows[0].value, `${r.attendance} / ${E.evaluateVenue(s.venue).capacity}`);
      assert.equal(a.sections.Operations.rows[0].value, `${r.satisfaction} / 100`);
      assert.equal(a.priority.action.target, 'settlement');
      assert.equal(a.previous, s.phase === 'done'); assert.equal(JSON.stringify(s), before);
    }
  }
});
test('finished state without a result never substitutes zero or reports readiness', () => {
  const a = advisoryFor({ ...phases()[2], phase: 'done', show: null });
  for (const section of Object.values(a.sections)) {
    assert.match(section.detail, /Not available/); assert.deepEqual(section.rows, []); assert.equal(section.action, null);
  }
});
