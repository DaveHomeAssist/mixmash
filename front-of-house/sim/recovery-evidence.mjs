// Verify and compact the source-bound historical and fresh beginner recovery reports.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as E from '../engine.mjs';
import * as D from '../data.mjs';
import { replay, provenance } from './workbench.mjs';
import { ARMS, checkPrefix, recoverySource, summarizeRecovery, recoveryPlan, runRecovery } from './beginner-recovery.mjs';

const file = path => new URL(path, import.meta.url);
const sha = raw => createHash('sha256').update(raw).digest('hex');
const digest = value => sha(JSON.stringify(value));
const step = (state, input) => {
  const result = E.applyAction(state, input);
  assert.equal(result.error, null);
  return result.state;
};
const restore = run => run.trace.reduce(step, E.createGame(run.seed));
const read = path => JSON.parse(readFileSync(file(path)));
const original = read('workbench-baseline.json');
const baselineRaw = readFileSync(file('output/baseline/report.json'));
const baseline = JSON.parse(baselineRaw);
assert.equal(sha(baselineRaw), original.fullReportSha256, 'Original report must be byte identical');
assert.deepEqual(baseline.source, provenance());
assert.deepEqual(baseline.cohorts, original.cohorts);
baseline.examples.forEach(replay);

const cohorts = {};
for (const [label, start] of [['historical', 1001], ['validation', 2001]]) {
  const raw = readFileSync(file(`output/recovery-${label}/recovery-report.json`));
  const report = JSON.parse(raw);
  assert.deepEqual(report.config, { seeds: 100, start, maxShows: 60 });
  assert.deepEqual(report.source, recoverySource());
  assert.equal(report.runs.length, 400);
  assert.deepEqual(report.summary, summarizeRecovery(report.runs), 'Recompute summaries from every career');
  for (let seed = start; seed < start + 100; seed++) {
    const group = report.runs.filter(r => r.seed === seed);
    assert.deepEqual(group.map(r => r.arm), ARMS);
    group.forEach(r => checkPrefix(group[0], r));
    if (label === 'historical') {
      const reference = baseline.runs.find(r => r.seed === seed && r.policy === 'beginner');
      assert.equal(group[0].finalStateHash, reference.finalStateHash);
      assert.deepEqual(group[0].shows, reference.shows);
    }
  }
  report.examples.forEach(replay);
  const summarizeSubset = rows => summarizeRecovery(rows);
  cohorts[label] = {
    config: report.config, source: report.source, rawReportSha256: sha(raw),
    careers: report.runs.length, signedShows: report.runs.reduce((n, r) => n + r.shows.length, 0),
    summary: report.summary,
    ...(label === 'historical' ? { formerHoldout: summarizeSubset(report.runs.filter(r => r.seed >= 1081)) } : {}),
    examples: report.examples.map(({ seed, arm, stop, finalStateHash, fingerprint, trace, options }) =>
      ({ seed, arm, stop, finalStateHash, fingerprint, trace, options })),
    engineRefusals: Object.fromEntries(D.VENUE_ORDER.map(room => [room, report.runs.filter(r =>
      r.arm === 'adaptive' && r.stop === 'engine_cannot_continue' && r.shows.at(-1).room === room).length])),
    festivalRefusalProbes: report.runs.filter(r => r.arm === 'adaptive' && r.stop === 'engine_cannot_continue' && r.shows.at(-1).room === 'festival').map(r => {
      const replayed = runRecovery(r.seed, r.arm);
      assert.equal(replayed.finalStateHash, r.finalStateHash);
      const state = restore(replayed);
      const next = E.applyAction(state, { type: 'nextShow' });
      const venue = E.applyAction(state, { type: 'chooseVenue', venueId: 'amphitheater' });
      assert.ok(next.error); assert.ok(venue.error); assert.ok(state.unlocks.amphitheater);
      return { seed: r.seed, phase: state.phase, cash: state.cash, nextShowQuote: E.nextShowCost(state),
        nextShowError: next.error, shellUnlocked: true, chooseShellError: venue.error, finalStateHash: r.finalStateHash };
    }),
    careersCompact: report.runs.map(r => ({ seed: r.seed, arm: r.arm, stop: r.stop, complete: r.complete,
      signedShows: r.shows.length, cash: r.cash, minimumCash: r.minimumCash, reached: r.reached, unlocked: r.unlocked,
      interventionCount: r.interventions.length, fingerprint: r.fingerprint, finalStateHash: r.finalStateHash })),
  };
}
// Separate diagnostic: do not pool a random-policy stopped state into beginner outcomes.
const random = baseline.examples.find(r => r.seed === 1001 && r.policy === 'random');
const before = restore(random), plan = recoveryPlan(before, { earlier: true });
assert.equal(plan.room, 'amphitheater');
const actions = [{ type: 'chooseVenue', venueId: plan.room }, ...plan.chosen.actions, { type: 'confirmPromotion' }];
let state = actions.reduce(step, before);
const response = D.INCIDENTS[state.show.incidentId].responses.filter(r => r.cost <= state.cash).sort((a, b) => a.cost - b.cost)[0];
actions.push({ type: 'respond', responseId: response.id }); state = step(state, actions.at(-1));
actions.push({ type: 'acceptSettlement' }); state = step(state, actions.at(-1));
const signed = { cash: state.cash, net: state.history.at(-1).net, shows: state.history.length };
assert.ok(signed.cash > before.cash);
actions.push({ type: 'nextShow' }); state = step(state, actions.at(-1));
const positive = { seed: random.seed, fromPolicy: 'random', from: before.venue.id, to: plan.room,
  before: { cash: before.cash, shows: before.history.length, phase: before.phase },
  quote: plan.chosen.feature.upfront, after: signed, cashDelta: signed.cash - before.cash,
  nextPhase: state.phase, trace: [...random.trace, ...actions], finalStateHash: digest(E.normalizeState(state)) };
replay(positive);
const evidence = { schema: 1, title: 'Front of House beginner recovery evidence',
  experimentCommit: '3733287706602a03d872e2166e7786785f81b0a3',
  gameBase: '412d01d5e1cfe282828bc0e418441058abee8b3b',
  runner: 'Cloud workspace, Node 24.19.0',
  validation: '2001 through 2100, unused until experiment implementation and protocol were frozen; no policy revision afterward',
  original: { rawReportSha256: sha(baselineRaw), careers: baseline.runs.length,
    signedShows: baseline.runs.reduce((n, r) => n + r.shows.length, 0), exactExampleReplays: baseline.examples.length, byteIdentical: true },
  earlierVenuePositiveControl: positive, cohorts };
const output = file('beginner-recovery-evidence.json');
// Keep repeated machine records on one line so the retained evidence remains reviewable.
function encode(value, depth = 0, key = '') {
  const pad = '  '.repeat(depth), child = `${pad}  `;
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const rows = value.map(v => ['trace', 'events', 'careersCompact'].includes(key) ? JSON.stringify(v) : encode(v, depth + 1));
    return `[\n${rows.map(v => child + v).join(',\n')}\n${pad}]`;
  }
  if (value && typeof value === 'object') {
    const rows = Object.entries(value).map(([k, v]) => `${child}${JSON.stringify(k)}: ${encode(v, depth + 1, k)}`);
    return rows.length ? `{\n${rows.join(',\n')}\n${pad}}` : '{}';
  }
  return JSON.stringify(value);
}
const serialized = encode(evidence) + '\n';
assert.deepEqual(JSON.parse(serialized), evidence);
writeFileSync(output, serialized);
console.log(JSON.stringify({ output: fileURLToPath(output), verifiedCareers: 800,
  retainedReplayExamples: Object.values(cohorts).reduce((n, c) => n + c.examples.length, 0) }));
