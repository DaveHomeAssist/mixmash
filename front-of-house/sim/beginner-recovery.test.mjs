// Recovery experiment integrity and genuine legal continuation regression checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine.mjs';
import * as D from '../data.mjs';
import { runCareer, replay, observe } from './workbench.mjs';
import { ARMS, runRecovery, planAt, recoveryPlan, minimumCandidates, checkPrefix, summarizeRecovery } from './beginner-recovery.mjs';

const step = (state, input) => {
  const result = E.applyAction(state, input);
  assert.equal(result.error, null, `${input.type}: ${result.error}`);
  return result.state;
};
const restore = run => run.trace.reduce(step, E.createGame(run.seed));

test('disabled interventions and preferred-plan prefixes preserve the frozen workbench', () => {
  for (const seed of [1001, 1003, 1093]) {
    const reference = runCareer(seed, 'beginner', { maxShows: 3 });
    const fixed = runRecovery(seed, 'fixed', { maxShows: 3 });
    assert.deepEqual(fixed.trace, reference.trace);
    assert.equal(fixed.finalStateHash, reference.finalStateHash);
    for (const arm of ARMS) {
      const result = runRecovery(seed, arm, { maxShows: 3 });
      checkPrefix(fixed, result);
      assert.equal(replay(result).pass, true);
      const resumed = runRecovery(seed, arm, { maxShows: 3, reload: true });
      assert.deepEqual(resumed.trace, result.trace);
      assert.deepEqual(resumed.shows, result.shows);
      assert.equal(resumed.finalStateHash, result.finalStateHash);
    }
  }
});

test('beginner 1001 can continue with a grid fallback and 1093 with the engine minimum', () => {
  for (const [seed, expected] of [[1001, 'grid_fallback'], [1093, 'minimum_fallback']]) {
    const fixed = runCareer(seed, 'beginner');
    const state = restore(fixed);
    assert.equal(planAt(state, false).chosen, null);
    const plan = planAt(state, true);
    assert.equal(plan.kind, expected);
    if (seed === 1093) assert.equal(plan.chosen.feature.upfront, 1025);
    let live = plan.chosen.actions.reduce(step, state);
    live = step(live, { type: 'confirmPromotion' });
    assert.equal(live.cash, state.cash - plan.chosen.feature.upfront);
    assert.equal(live.phase, 'show');
    assert.equal(recoveryPlan(state, { earlier: true }).attempts.length, 0, 'No lower venue than Lot');
  }
});

test('minimum candidates depend on public information and charge exact quotes in all rooms', () => {
  for (const room of D.VENUE_ORDER) {
    // Synthetic fixtures are only for integrity coverage, never measured careers.
    const state = E.createGame(1, { mode: 'sandbox' });
    state.venue.id = room; state.venue.grid = D.VENUES[room].grid;
    state.cash = 5000000; state.unlocks = Object.fromEntries(D.VENUE_ORDER.map(id => [id, true]));
    const candidates = minimumCandidates(state);
    assert.ok(candidates.length, room);
    let other;
    for (let seed = 2; seed < 10000; seed++) {
      const probe = { ...state, seed };
      if (JSON.stringify(observe(probe)) === JSON.stringify(observe(state))) { other = probe; break; }
    }
    assert.ok(other);
    assert.deepEqual(minimumCandidates(other), candidates);
    for (const c of candidates) {
      const prepared = c.actions.reduce(step, state);
      assert.equal(E.upfrontFor(prepared), c.feature.upfront);
      // Sandbox waives cash charges, so only assert its legal opening here.
      assert.equal(step(prepared, { type: 'confirmPromotion' }).phase, 'show');
    }
  }
});

test('earlier-venue positive control uses earned Shell through real actions', () => {
  const run = runCareer(1001, 'random');
  assert.equal(run.stop, 'no_affordable_grid_plan');
  const state = restore(run);
  assert.equal(state.venue.id, 'festival');
  const plan = recoveryPlan(state, { earlier: true });
  assert.equal(plan.room, 'amphitheater');
  assert.equal(state.unlocks[plan.room], true);
  let live = step(state, { type: 'chooseVenue', venueId: plan.room });
  live = plan.chosen.actions.reduce(step, live);
  live = step(live, { type: 'confirmPromotion' });
  const responses = D.INCIDENTS[live.show.incidentId].responses.filter(r => r.cost <= live.cash).sort((a, b) => a.cost - b.cost);
  live = step(live, { type: 'respond', responseId: responses[0].id });
  live = step(live, { type: 'acceptSettlement' });
  assert.equal(live.history.length, run.shows.length + 1);
  assert.ok(live.cash > state.cash, 'A signed profitable recovery, not just an affordable quote');
  assert.equal(step(live, { type: 'nextShow' }).phase, 'book');
});

test('summary retains censored recovery and zero venue opportunities without inflating completion', () => {
  const rows = ARMS.map(arm => runRecovery(1001, arm, { maxShows: 2 }));
  const summary = summarizeRecovery(rows);
  assert.equal(summary.arms.fixed.completed, 0);
  assert.equal(summary.arms.adaptive.interventions.count, 1);
  assert.equal(summary.arms.venue.interventions.venueAttempts, 0);
  for (const row of Object.values(summary.arms)) assert.equal(Object.values(row.stops).reduce((a, b) => a + b, 0), 1);
  for (const pair of summary.pairs) assert.equal(pair.horizons.length, 6);
});
