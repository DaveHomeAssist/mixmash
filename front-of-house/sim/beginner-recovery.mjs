// Controlled beginner recovery: unchanged engine, matched seeds, independent intervention arms.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../engine.mjs';
import * as D from '../data.mjs';
import { candidatesFor, selectPlan, chooseResponse, publicProjection, runCareer, replay, summarize, provenance, parseArgs } from './workbench.mjs';

export const ARMS = ['fixed', 'adaptive', 'venue', 'combined'];
const HERE = dirname(fileURLToPath(import.meta.url));
const clone = structuredClone;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const step = (state, input) => {
  const result = E.applyAction(state, input);
  assert.equal(result.error, null, `${state.phase}/${input.type}: ${result.error}`);
  return result.state;
};
const cheapest = candidates => [...candidates].sort((a, b) => a.feature.upfront - b.feature.upfront || a.feature.id.localeCompare(b.feature.id))[0];

// Deliberately narrower than the original grid: usual ticket price, no ads, authored minimum layout.
// No hidden draw, seed, future incident or sampled settlement enters selection.
export function minimumCandidates(state) {
  const room = state.venue.id, candidates = [];
  for (const artistId of E.offersFor(state)) {
    const artist = D.ARTISTS[artistId], terms = E.termsFor(artistId, state.reputation.artists[artistId]);
    const deals = ['guarantee', ...(terms.doorOk ? ['door'] : []), ...(room === 'festival' ? ['sponsor'] : [])];
    const sides = room === 'festival' ? E.stageOpenersFor(state).filter(id => id !== artistId) : [null];
    for (const deal of deals) for (const secondId of sides) {
      const booking = { type: 'chooseDeal', artistId, deal, nights: 1,
        ...(room !== 'lot' ? { roomPolicy: 1 } : {}),
        ...(['amphitheater', 'festival'].includes(room) ? { curfewPolicy: 1 } : {}),
        ...(room === 'amphitheater' ? { seatingPolicy: 1 } : {}),
        ...(room === 'festival' ? { secondId, stagePolicy: 1, festivalPolicy: 1, supportPolicy: 1 } : {}) };
      const booked = E.applyAction(state, booking);
      if (booked.error) continue;
      const objects = [...D.VENUES[room].cheapest, ...(room === 'festival' ? D.FESTIVAL_SUPPORT_LAYOUT : [])];
      const actions = [booking, { type: 'setLayout', objects }, { type: 'confirmBuild' },
        { type: 'setPromotion', price: artist.fairPrice, ads: { flyers: 0, social: 0, radio: 0 },
          ...(room === 'amphitheater' ? { seatPrice: Math.min(D.VENUES[room].priceMax, artist.fairPrice + 10) } : {}),
          ...(room === 'club' ? { ticketing: { version: 1, plan: 'direct' } } : {}) }];
      let prepared = booked.state;
      for (const input of actions.slice(1)) prepared = step(prepared, input);
      const venue = E.evaluateVenue(prepared.venue);
      const { upfront, estimate, forecast } = publicProjection(prepared, venue);
      assert.equal(upfront, E.upfrontFor(prepared));
      if (upfront > state.cash) continue;
      candidates.push({ actions, feature: {
        id: [artistId, deal, secondId || '-', 'minimum', artist.fairPrice, 'none', room === 'club' ? 'direct' : '-'].join('/'),
        artist: artistId, deal, side: secondId, layout: 'minimum', price: artist.fairPrice, fairPrice: artist.fairPrice,
        ads: 'none', ticketing: room === 'club' ? 'direct' : null, upfront, reserve: state.cash - upfront,
        expectedSatisfaction: estimate.satisfaction, forecastLow: forecast.low, forecastHigh: forecast.high, capacity: venue.capacity,
      } });
    }
  }
  return candidates;
}

export function planAt(state, adaptive) {
  const grid = candidatesFor(state);
  const id = selectPlan(grid.observation, grid.candidates.map(c => c.feature), 'beginner');
  if (id) return { chosen: grid.candidates.find(c => c.feature.id === id), kind: 'preferred', grid };
  if (adaptive) {
    if (grid.candidates.length) return { chosen: cheapest(grid.candidates), kind: 'grid_fallback', grid };
    const chosen = cheapest(minimumCandidates(state));
    if (chosen) return { chosen, kind: 'minimum_fallback', grid };
  }
  return { chosen: null, kind: grid.candidates.length ? 'policy_no_plan' : 'no_affordable_grid_plan', grid };
}

export function recoveryPlan(state, { adaptive = false, earlier = false } = {}) {
  const current = planAt(state, adaptive);
  if (current.chosen || !earlier) return { ...current, room: state.venue.id, from: state.venue.id, attempts: [] };
  const attempts = [];
  for (const room of D.VENUE_ORDER.slice(0, D.VENUE_ORDER.indexOf(state.venue.id)).reverse()) {
    if (room !== 'lot' && !state.unlocks[room]) continue;
    const switched = step(state, { type: 'chooseVenue', venueId: room });
    const plan = planAt(switched, adaptive);
    attempts.push({ room, outcome: plan.kind, cash: state.cash });
    if (plan.chosen) return { ...plan, room, from: state.venue.id, attempts };
  }
  return { ...current, room: state.venue.id, from: state.venue.id, attempts };
}

export function runRecovery(seed, arm, { maxShows = 60, reload = false } = {}) {
  assert.ok(ARMS.includes(arm));
  if (arm === 'fixed') return { ...runCareer(seed, 'beginner', { maxShows, reload }), arm, interventions: [], venueAttempts: [] };
  const adaptive = arm === 'adaptive' || arm === 'combined', earlier = arm === 'venue' || arm === 'combined';
  let state = E.createGame(seed), minimumCash = state.cash;
  const trace = [], shows = [], reached = { lot: 0 }, unlocked = {}, interventions = [], venueAttempts = [];
  const record = input => {
    state = step(state, input); trace.push(clone(input));
    minimumCash = Math.min(minimumCash, state.cash);
    assert.ok(Number.isSafeInteger(state.cash) && state.cash >= 0);
    if (state.cashJournal) assert.equal(E.careerLedgerFor(state).balance, state.cash);
    if (reload) {
      const resumed = E.normalizeState(clone(state));
      assert.equal(resumed.cash, state.cash); assert.deepEqual(resumed.history, state.history);
      assert.deepEqual(resumed.reputation, state.reputation); assert.deepEqual(resumed.unlocks, state.unlocks);
      state = resumed;
    }
  };
  let stop = 'show_limit', brokeAt = null;
  for (let night = 0; night < maxShows; night++) {
    if (state.history.length && !state.equipment) record({ type: 'enableEquipment' });
    const highest = D.VENUE_ORDER.filter(id => id === 'lot' || state.unlocks[id]).at(-1);
    if (highest !== state.venue.id) record({ type: 'chooseVenue', venueId: highest });
    reached[highest] ??= night;
    const plan = recoveryPlan(state, { adaptive, earlier });
    venueAttempts.push(...plan.attempts.map(a => ({ ...a, show: night + 1, from: highest })));
    if (!plan.chosen) { stop = plan.kind; brokeAt = night; break; }
    const room = plan.room, chosen = plan.chosen;
    if (room !== state.venue.id) record({ type: 'chooseVenue', venueId: room });
    reached[room] ??= night;
    if (plan.kind !== 'preferred' || room !== highest) interventions.push({ show: night + 1, from: highest, room, kind: plan.kind, cash: state.cash, planId: chosen.feature.id, quote: chosen.feature.upfront });
    for (const input of chosen.actions) record(input);
    const openingCash = state.cash;
    record({ type: 'confirmPromotion' });
    assert.equal(state.cash, openingCash - chosen.feature.upfront);
    const incident = state.show.incidentId, responseId = chooseResponse(incident, state.cash, 'beginner', 1);
    const responseCash = state.cash;
    record({ type: 'respond', responseId });
    const receipt = clone(E.settlementFor(state));
    assert.equal(responseCash - state.cash, receipt.costs.incident);
    const signingCash = state.cash;
    record({ type: 'acceptSettlement' });
    assert.equal(state.cash, signingCash + E.settlementPayout(receipt, state.booking.deal));
    assert.equal(state.history.length, night + 1);
    for (const [key, value] of Object.entries(state.unlocks)) if (value) unlocked[key] ??= night + 1;
    shows.push({ show: night + 1, room, decision: chosen.feature, incident, response: responseId,
      net: receipt.net, satisfaction: receipt.satisfaction, attendance: receipt.attendance, result: receipt.result,
      cashBefore: openingCash, cashAfter: state.cash, cashDelta: state.cash - openingCash, receipt });
    if (state.unlocks.complete) { stop = 'complete'; break; }
    const next = E.applyAction(state, { type: 'nextShow' });
    if (next.error) { stop = 'engine_cannot_continue'; brokeAt = night + 1; break; }
    record({ type: 'nextShow' });
  }
  return { seed, arm, policy: 'beginner', complete: stop === 'complete', stop, brokeAt, shows, reached, unlocked,
    cash: state.cash, minimumCash, trace, interventions, venueAttempts,
    finalStateHash: digest(E.normalizeState(clone(state))), fingerprint: digest(trace), options: { maxShows } };
}

export function checkPrefix(reference, candidate) {
  const first = candidate.interventions[0]?.show ?? Infinity;
  const prefix = reference.shows.filter(s => s.show < first);
  assert.deepEqual(candidate.shows.slice(0, prefix.length), prefix, 'Identical pre-intervention outcomes');
  if (!candidate.interventions.length) assert.equal(candidate.finalStateHash, reference.finalStateHash, 'No intervention means exact baseline state');
  return prefix.length;
}

const dist = xs => {
  const sorted = [...xs].sort((a, b) => a - b);
  const q = p => sorted.length ? sorted[Math.floor((sorted.length - 1) * p)] : null;
  return { n: xs.length, mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, p10: q(.1), median: q(.5), p90: q(.9) };
};
export function summarizeRecovery(runs) {
  const arms = Object.fromEntries(ARMS.map(arm => {
    const cohort = runs.filter(r => r.arm === arm), shows = cohort.flatMap(r => r.shows);
    const base = summarize(cohort).policies.beginner;
    const interventions = cohort.flatMap(r => r.interventions.map(i => {
      const s = r.shows[i.show - 1], later = r.shows.slice(i.show, i.show + 3);
      return { ...i, seed: r.seed, cashAfter: s.cashAfter, cashDelta: s.cashDelta, completed: r.complete,
        nonloss: s.cashAfter >= i.cash, regainedWithin3Later: later.some(x => x.cashAfter >= i.cash),
        recoveryCensored: s.cashAfter < i.cash && later.length < 3 && !later.some(x => x.cashAfter >= i.cash) };
    }));
    return [arm, { ...base, quality: { pass: shows.filter(s => s.result === 'pass').length,
      retryCompletion: cohort.filter(r => r.complete && r.shows.at(-1).result !== 'pass').length },
      interventions: { careers: cohort.filter(r => r.interventions.length).length, count: interventions.length,
        kinds: Object.fromEntries([...new Set(interventions.map(i => i.kind))].map(k => [k, interventions.filter(i => i.kind === k).length])),
        venueAttempts: cohort.reduce((n, r) => n + r.venueAttempts.length, 0),
        venueChanges: interventions.filter(i => i.room !== i.from).length,
        completedCareers: cohort.filter(r => r.complete && r.interventions.length).length,
        nonlossShows: interventions.filter(i => i.nonloss).length,
        regainedWithin3Later: interventions.filter(i => !i.nonloss && i.regainedWithin3Later).length,
        recoveryCensored: interventions.filter(i => i.recoveryCensored).length,
        cashDelta: dist(interventions.map(i => i.cashDelta)), events: interventions } }];
  }));
  const pairs = ARMS.filter(a => a !== 'fixed').map(arm => {
    const pairs = runs.filter(r => r.arm === arm).map(r => [runs.find(b => b.arm === 'fixed' && b.seed === r.seed), r]);
    return { arm, reference: 'fixed', n: pairs.length,
      completionWins: pairs.filter(([a, b]) => !a.complete && b.complete).length,
      completionLosses: pairs.filter(([a, b]) => a.complete && !b.complete).length,
      extraShows: dist(pairs.map(([a, b]) => b.shows.length - a.shows.length)),
      terminalCashDelta: dist(pairs.map(([a, b]) => b.cash - a.cash)),
      horizons: [1, 3, 5, 10, 20, 60].map(h => {
        const cashAt = r => r.shows[Math.min(h, r.shows.length) - 1]?.cashAfter ?? E.createGame(r.seed).cash;
        return { show: h, cashDifference: dist(pairs.map(([a, b]) => cashAt(b) - cashAt(a))),
          referenceAbsorbed: pairs.filter(([a]) => a.shows.length < h).length,
          candidateAbsorbed: pairs.filter(([, b]) => b.shows.length < h).length };
      }) };
  });
  return { arms, pairs };
}

export function recoverySource() {
  const source = provenance();
  for (const path of ['sim/beginner-recovery.mjs', 'docs/BEGINNER_RECOVERY_PROTOCOL.md']) {
    source[path] = createHash('sha256').update(readFileSync(resolve(HERE, '..', path))).digest('hex');
  }
  return source;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = parseArgs(process.argv.slice(2));
  if (config.replay) {
    const report = JSON.parse(readFileSync(config.replay));
    assert.deepEqual(report.source, recoverySource(), 'Exact experiment sources required');
    console.log(JSON.stringify(report.examples.map(replay)));
  } else {
    const runs = [];
    for (let seed = config.start; seed < config.start + config.seeds; seed++) {
      const group = ARMS.map(arm => runRecovery(seed, arm, config));
      group.forEach(run => { checkPrefix(group[0], run); replay(run); });
      runs.push(...group);
      console.error(`Seed ${seed}: ${runs.length} careers, all exact replays and prefixes pass`);
    }
    const { out, ...parameters } = config;
    const examples = ARMS.flatMap(arm => {
      const rows = runs.filter(r => r.arm === arm);
      return [...new Set([rows.find(r => !r.complete), rows.find(r => r.complete),
        rows.find(r => r.interventions.some(i => i.kind === 'minimum_fallback')),
        rows.find(r => r.interventions.some(i => i.from !== i.room)),
        [...rows].sort((a, b) => a.cash - b.cash)[0]].filter(Boolean))];
    });
    const report = { schema: 1, config: parameters, source: recoverySource(),
      summary: summarizeRecovery(runs), examples,
      runs: runs.map(({ trace, shows, ...r }) => ({ ...r, shows: shows.map(({ receipt, ...s }) => s) })) };
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, 'recovery-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ careers: runs.length, shows: runs.reduce((n, r) => n + r.shows.length, 0),
      arms: Object.fromEntries(Object.entries(report.summary.arms).map(([a, r]) => [a, { completed: r.completed, stops: r.stops }])) }));
  }
}
