// Workbench integrity: no hidden-outcome planning, exact engine replay and honest denominators.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine.mjs';
import * as D from '../data.mjs';
import { POLICIES, candidatesFor, observe, selectPlan, runCareer, replay, summarize, parseArgs, publicProjection } from './workbench.mjs';

test('all policies make deterministic legal careers and replay exact states', () => {
  for (const policy of POLICIES) {
    const run = runCareer(12, policy, { maxShows: 2 });
    assert.ok(run.shows.length > 0);
    assert.deepEqual(runCareer(12, policy, { maxShows: 2 }), run);
    assert.equal(replay(run).pass, true);
    const resumed = runCareer(12, policy, { maxShows: 2, reload: true });
    assert.deepEqual(resumed.shows, run.shows);
    assert.deepEqual(resumed.trace, run.trace);
    assert.equal(resumed.finalStateHash, run.finalStateHash);
    const altered = structuredClone(run); altered.finalStateHash = 'invalid';
    assert.throws(() => replay(altered), /Replay state/);
  }
});

test('public candidate features are independent of hidden outcome seeds in every venue', () => {
  for (const room of D.VENUE_ORDER) {
    // Fixtures only: normal measured careers never inject cash, rooms or relationships.
    const state = E.createGame(1, { mode: 'sandbox' });
    state.venue.id = room; state.venue.grid = D.VENUES[room].grid; state.cash = 5000000;
    state.unlocks = Object.fromEntries(D.VENUE_ORDER.map(id => [id, true]));
    const roster = E.offersFor(state);
    let other;
    for (let seed = 2; seed < 10000; seed++) {
      const probe = { ...state, seed };
      if (JSON.stringify(E.offersFor(probe)) === JSON.stringify(roster)) { other = probe; break; }
    }
    assert.ok(other, 'fixed-public-roster seed pair');
    const a = candidatesFor(state, { cache: false }), b = candidatesFor(other, { cache: false });
    assert.deepEqual(observe(state), observe(other));
    assert.deepEqual(a.candidates.map(x => x.feature), b.candidates.map(x => x.feature), room);
    assert.ok(a.candidates.length > 0, room);
    for (const policy of POLICIES) assert.equal(selectPlan(a.observation, a.candidates.map(x => x.feature), policy, 123),
      selectPlan(b.observation, b.candidates.map(x => x.feature), policy, 123));
  }
});

test('summary denominators include failures, attempted rooms and censored losses', () => {
  const runs = POLICIES.map(policy => runCareer(13, policy, { maxShows: 1 }));
  const summary = summarize(runs);
  for (const policy of POLICIES) {
    const row = summary.policies[policy];
    assert.equal(row.careers, 1); assert.equal(row.completed, 0);
    assert.equal(row.completionShows.n, 0); assert.equal(row.completionShows.median, null);
    assert.equal(row.rooms.lot.reached, 1); assert.equal(row.rooms.festival.reached, 0);
    assert.equal(row.rooms.festival.cashDelta.n, 0);
    assert.equal(Object.values(row.stops).reduce((a, b) => a + b, 0), row.careers);
  }
  assert.ok(summary.paired.every(row => row.cashDifference.n === 1));
});

test('CLI rejects malformed or unbounded cohorts', () => {
  for (const argv of [['--seeds', '0'], ['--seeds', '2.5'], ['--shows', '151'], ['--seeds', '10001'], ['--start', '-2'], ['--oops', '1'], ['--out']]) {
    assert.throws(() => parseArgs(argv));
  }
  assert.equal(parseArgs(['--seeds', '20', '--shows', '12']).seeds, 20);
});

test('cached public projections match uncached quotes across cash and rental ledger states', () => {
  for (const cash of [1000, 3000, 6000]) {
    const state = E.createGame(4); state.cash = cash;
    assert.deepEqual(candidatesFor(state), candidatesFor(state, { cache: false }));
  }
});

test('Festival cache includes public side-act terms even when the eligible roster stays fixed', () => {
  const state = E.createGame(1, { mode: 'sandbox' });
  state.venue.id = 'festival'; state.venue.grid = D.VENUES.festival.grid; state.cash = 5000000;
  state.unlocks.festival = true;
  candidatesFor(state);
  const id = E.stageOpenersFor(state)[0]; state.reputation.artists[id] = 10;
  assert.deepEqual(candidatesFor(state), candidatesFor(state, { cache: false }));
});

test('fast public projections match authoritative opening quotes and forecasts in every room', () => {
  for (const room of D.VENUE_ORDER) {
    const state = E.createGame(2, { mode: 'sandbox' });
    state.venue.id = room; state.venue.grid = D.VENUES[room].grid; state.cash = 5000000;
    state.unlocks = Object.fromEntries(D.VENUE_ORDER.map(id => [id, true]));
    const candidates = candidatesFor(state, { cache: false }).candidates;
    // Cover each deal/layout/ad/ticketing setting plus both price endpoints.
    const samples = new Map();
    for (const c of candidates) {
      const f = c.feature;
      for (const k of ['deal', 'layout', 'ads', 'ticketing', 'price']) samples.set(`${k}/${f[k]}`, c);
    }
    for (const c of samples.values()) {
      let prepared = state;
      for (const input of c.actions) { const r = E.applyAction(prepared, input); assert.equal(r.error, null); prepared = r.state; }
      const projection = publicProjection(prepared, E.evaluateVenue(prepared.venue));
      assert.equal(projection.upfront, E.upfrontFor(prepared), `${room}/${c.feature.id}`);
      const forecast = E.forecast(prepared);
      assert.equal(projection.forecast.low, forecast.low); assert.equal(projection.forecast.high, forecast.high);
      assert.ok(Number.isFinite(c.feature.expectedNet));
    }
  }
});

test('loss recovery treats short unresolved follow-up as censored', () => {
  const base = runCareer(13, 'beginner', { maxShows: 1 });
  const rows = [
    { ...base.shows[0], cashBefore: 3000, cashAfter: 2000, cashDelta: -1000 },
    { ...base.shows[0], cashBefore: 2000, cashAfter: 2500, cashDelta: 500 },
  ];
  const result = summarize([{ ...base, shows: rows }]).policies.beginner.lossRecovery;
  assert.deepEqual(result, { losses: 1, observable: 0, censored: 1, recoveredWithin3: 0 });
  rows[1].cashAfter = 3100;
  const recovered = summarize([{ ...base, shows: rows }]).policies.beginner.lossRecovery;
  assert.equal(recovered.observable, 1); assert.equal(recovered.recoveredWithin3, 1);
});


test('adaptive beginner preserves preferred plans and falls back to cheapest affordable opening', () => {
  const state = E.createGame(12);
  const { observation, candidates } = candidatesFor(state);
  const features = candidates.map(c => c.feature);
  const original = selectPlan(observation, features, 'beginner');
  assert.ok(original);
  assert.equal(selectPlan(observation, features, 'beginner-adaptive'), original);
  const alternatives = features.filter(f => f.id !== original && f.ads === 'none');
  assert.equal(selectPlan(observation, alternatives, 'beginner'), null);
  const picked = selectPlan(observation, alternatives, 'beginner-adaptive');
  assert.equal(alternatives.find(f => f.id === picked).upfront, Math.min(...alternatives.map(f => f.upfront)));
  assert.equal(selectPlan(observation, [], 'beginner-adaptive'), null);
});

test('recovery controls share initial choices and never fabricate an earned room', () => {
  for (const base of ['beginner', 'beginner-adaptive', 'random']) {
    const baseline = runCareer(12, base, { maxShows: 2 });
    const recovery = runCareer(12, `${base}-recovery`, { maxShows: 2, reload: true });
    assert.deepEqual(recovery.shows, baseline.shows);
    assert.deepEqual(recovery.trace, baseline.trace);
    assert.equal(replay(recovery).pass, true);
    assert.equal(recovery.recoveries.length, 0);
  }
});

test('earned smaller venue recovery completes and survives reload without bypassing the engine', () => {
  // Previously inspected diagnostic seed, separate from the fresh measured cohort.
  const run = runCareer(1001, 'random-recovery');
  assert.ok(run.recoveries.length > 0);
  assert.ok(run.recoveries.every(e => e.highest === 'festival' && e.room === 'amphitheater'));
  assert.equal(run.stop, 'complete');
  const resumed = runCareer(1001, 'random-recovery', { reload: true });
  assert.deepEqual(resumed.trace, run.trace);
  assert.equal(resumed.finalStateHash, run.finalStateHash);
  assert.equal(replay(run).pass, true);
});
