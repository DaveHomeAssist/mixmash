// Balance workbench: public-information policies, real engine actions and replayable cohorts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../engine.mjs';
import * as D from '../data.mjs';
import { festivalSales, festivalSettlement } from '../stage-accounts.mjs';
import { BUDGET_LAYOUT, REFERENCE_ADS } from './reference.mjs';

export const POLICIES = ['beginner', 'cautious', 'growth', 'aggressive', 'profit', 'random'];
const HERE = dirname(fileURLToPath(import.meta.url));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = value => structuredClone(value);
const percentile = (xs, q) => xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * q)] : null;
const average = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const distribution = xs => ({ n: xs.length, mean: average(xs), p10: percentile(xs, .1), median: percentile(xs, .5), p90: percentile(xs, .9), min: xs.length ? Math.min(...xs) : null, max: xs.length ? Math.max(...xs) : null });
const action = (state, input) => {
  const result = E.applyAction(state, input);
  assert.equal(result.error, null, `${state.phase}/${input.type}: ${result.error}`);
  return result.state;
};

export function layoutsFor(room) {
  if (room === 'lot') return [{ id: 'suggested', objects: D.STARTER_LAYOUT }, { id: 'budget', objects: BUDGET_LAYOUT }];
  const base = D.VENUES[room].starter.filter(o => !D.ROOM_PROFILES[room]?.houseLights || o.type !== 'lights');
  if (room !== 'festival') return [{ id: 'suggested', objects: base }];
  const touring = [...base, ...D.FESTIVAL_SUPPORT_LAYOUT];
  return [{ id: 'suggested', objects: touring }, { id: 'delays', objects: [...touring,
    { type: 'delay', x: 8, y: 16, rot: 0 }, { type: 'delay', x: 30, y: 16, rot: 0 }] }];
}

// Offers and relationships are public. Seeds, future draws and incidents never cross this boundary.
export function observe(state) {
  return { cash: state.cash, venueRep: state.reputation.venue, room: state.venue.id,
    offers: E.offersFor(state).map(id => ({ id, terms: E.termsFor(id, state.reputation.artists[id]) })),
    openers: E.stageOpenersFor(state),
    openerTerms: Object.fromEntries(E.stageOpenersFor(state).map(id => [id, E.termsFor(id, state.reputation.artists[id])])),
    mode: state.mode, equipmentEnabled: !!state.equipment, shows: state.history.length };
}

// Reuse the engine's pure economic functions with one cached geometry evaluation.
// This projection never rolls an outcome. Selected plans are charged by the actual engine.
export function publicProjection(state, venue) {
  const a = D.ARTISTS[state.booking.artistId], terms = state.booking.terms;
  const base = { venue, deal: state.booking.deal, artistId: state.booking.artistId,
    price: state.promotion.price, seatPrice: state.promotion.seatPrice, ads: state.promotion.ads,
    venueRep: state.reputation.venue, ask: terms.ask, drawMult: terms.drawMult,
    incidentId: null, responseId: null, broadcast: !!venue.broadcast, seating: E.seatingPlanFor(state), ticketing: E.ticketingPlanFor(state) };
  const at = draw => E.evaluateShow({ ...base, draw });
  const estimate = at((a.drawMin + a.drawMax) / 2);
  const stageTerms = E.stagePlanFor(state);
  if (!stageTerms) {
    // Ordinary forecast deliberately uses baseline admissions, matching the existing Promote screen.
    const forecastAt = draw => base.seating ? at(draw).attendance : (() => {
      const demand = E.demand({ draw: draw * terms.drawMult, price: base.price, fairPrice: a.fairPrice,
        ads: base.ads, venueRep: base.venueRep });
      const split = E.presaleSplit(demand, E.buzz(base.ads), venue.capacity);
      return Math.min(venue.capacity, split.presale + split.walkup);
    })();
    return { upfront: estimate.upfront, estimate, forecast: { low: forecastAt(a.drawMin), high: forecastAt(a.drawMax) }, stages: null };
  }
  const second = D.ARTISTS[state.booking.secondId];
  const audience = (mainDraw, secondDraw) => {
    const demand = E.demand({ draw: mainDraw * terms.drawMult, price: base.price, fairPrice: a.fairPrice, ads: base.ads, venueRep: base.venueRep });
    return { capacity: venue.capacity, secondCapacity: D.VENUES.festival.secondCap, demand: Math.round(demand),
      mainDraw: Math.round(mainDraw * terms.drawMult), secondDraw: Math.round(secondDraw * state.booking.secondTerms.drawMult),
      price: base.price, presaleShare: E.presaleSplit(demand, E.buzz(base.ads), venue.capacity).share, walkupMult: 1 };
  };
  const corners = [a.drawMin, a.drawMax].flatMap(main => [second.drawMin, second.drawMax].map(side => festivalSales(stageTerms, audience(main, side))));
  const middle = audience((a.drawMin + a.drawMax) / 2, (second.drawMin + second.drawMax) / 2);
  const c = estimate.costs;
  const accounts = festivalSettlement(stageTerms, { audience: middle,
    rig: { paTier: venue.paTier || null, housePa: venue.housePa, lights: !!venue.lights, ...(venue.delays ? { delays: venue.delays } : {}) },
    siteCosts: { rental: c.lot, permit: c.permit, fence: c.fence, staff: c.staff, bars: c.bars, restrooms: c.restrooms, ads: c.ads, incident: 0,
      ...(c.vipDeck ? { vipDeck: c.vipDeck } : {}), ...(c.busCompound ? { busCompound: c.busCompound } : {}) },
    mainDeal: base.deal, mainAsk: terms.ask, bar: estimate.bar, broadcast: !!venue.broadcast });
  const range = field => ({ low: Math.min(...corners.map(c => c[field])), high: Math.max(...corners.map(c => c[field])) });
  const stages = { attendance: range('attendance'), ticketGross: range('ticketGross') };
  return { upfront: accounts.upfront, estimate, forecast: stages.attendance, stages };
}

// Enumerate legal actions through the engine, then attach public forecast features.
// Only the features below reach selectPlan; prepared private states stay in the driver.
const candidateCache = new Map();
export function candidatesFor(state, { cache = true } = {}) {
  const observation = observe(state), room = observation.room;
  const { cash, shows, ...publicKey } = observation;
  // Cache only this workbench's ordinary-rental scope. Optional systems use an uncached path.
  const cacheable = cache && !state.research && (!state.equipment || state.equipment.commands.length === 0);
  const cacheKey = digest(publicKey);
  const affordable = ({ candidates, rejected }) => ({ observation,
    candidates: candidates.filter(c => c.feature.upfront <= cash).map(c => ({ ...c, feature: { ...c.feature, reserve: cash - c.feature.upfront } })),
    rejected: { ...rejected, opening: candidates.filter(c => c.feature.upfront > cash).length } });
  if (cacheable && candidateCache.has(cacheKey)) return affordable(candidateCache.get(cacheKey));
  const candidates = [], rejected = { booking: 0, opening: 0, promotion: 0 };
  for (const offer of observation.offers) {
    const artist = D.ARTISTS[offer.id];
    const deals = ['guarantee', ...(offer.terms.doorOk ? ['door'] : []), ...(room === 'festival' ? ['sponsor'] : [])];
    const sides = room === 'festival' ? observation.openers.filter(id => id !== offer.id) : [null];
    for (const deal of deals) for (const secondId of sides) for (const layout of layoutsFor(room)) {
      const booking = { type: 'chooseDeal', artistId: offer.id, deal, nights: 1,
        ...(room !== 'lot' ? { roomPolicy: 1 } : {}),
        ...(['amphitheater', 'festival'].includes(room) ? { curfewPolicy: 1 } : {}),
        ...(room === 'amphitheater' ? { seatingPolicy: 1 } : {}),
        ...(room === 'festival' ? { secondId, stagePolicy: 1, festivalPolicy: 1, supportPolicy: 1 } : {}) };
      const result = E.applyAction(state, booking);
      if (result.error) { rejected.booking++; continue; }
      let built = action(result.state, { type: 'setLayout', objects: layout.objects });
      built = action(built, { type: 'confirmBuild' });
      const venueStats = E.evaluateVenue(built.venue);
      const max = D.VENUES[room].priceMax || D.PRICE_MAX;
      const prices = deal === 'sponsor' ? [artist.fairPrice] : [...new Set([-.2, 0, .2].map(delta => Math.max(D.PRICE_MIN, Math.min(max, Math.round(artist.fairPrice * (1 + delta))))))];
      const ads = [{ id: 'none', value: { flyers: 0, social: 0, radio: 0 } },
        { id: 'reference', value: REFERENCE_ADS }, { id: 'heavy', value: { flyers: 200, social: 500, radio: 500 } }];
      for (const price of prices) for (const ad of ads) for (const ticketing of room === 'club' ? ['direct', 'platform'] : [null]) {
        const promotion = { type: 'setPromotion', price, ads: ad.value,
          ...(room === 'amphitheater' ? { seatPrice: Math.min(max, price + 10) } : {}),
          ...(ticketing ? { ticketing: { version: 1, plan: ticketing } } : {}) };
        const promoted = E.applyAction(built, promotion);
        if (promoted.error) { rejected.promotion++; continue; }
        const prepared = promoted.state;
        const { upfront, estimate, forecast, stages } = publicProjection(prepared, venueStats);
        const stats = venueStats;
        const expectedNet = stages ? (stages.ticketGross.low + stages.ticketGross.high) / 2 - upfront : estimate.net;
        const feature = { id: [offer.id, deal, secondId || '-', layout.id, price, ad.id, ticketing || '-'].join('/'),
          artist: offer.id, deal, side: secondId, layout: layout.id, price, fairPrice: artist.fairPrice,
          ads: ad.id, ticketing, upfront, reserve: state.cash - upfront, expectedNet,
          expectedSatisfaction: estimate.satisfaction, forecastLow: forecast.low, forecastHigh: forecast.high,
          capacity: stats.capacity, usualDraw: (artist.drawMin + artist.drawMax) / 2 };
        candidates.push({ feature, actions: [booking, { type: 'setLayout', objects: layout.objects }, { type: 'confirmBuild' }, promotion] });
      }
    }
  }
  if (cacheable) {
    if (candidateCache.size >= 96) candidateCache.delete(candidateCache.keys().next().value);
    candidateCache.set(cacheKey, { candidates, rejected });
  }
  return affordable({ candidates, rejected });
}

export function selectPlan(observation, features, policy, choiceSeed = 1) {
  assert.ok(POLICIES.includes(policy), 'Unknown policy');
  if (!features.length) return null;
  if (policy === 'random') return features[Math.floor(E.mulberry32(choiceSeed)() * features.length)].id;
  let eligible = features;
  if (policy === 'beginner') {
    // Follow the suggested kit/usual price/reference ads; choose the first affordable public offer.
    eligible = features.filter(f => f.layout === 'suggested' && f.price === f.fairPrice && f.ads === 'reference' && f.ticketing !== 'platform');
    return eligible[0]?.id ?? null;
  }
  if (policy === 'cautious') {
    // Keep the largest authored incident cost when possible, otherwise take the safest affordable quote.
    const reserve = Math.max(...Object.values(D.INCIDENTS).flatMap(i => i.responses.map(r => r.cost)));
    const protectedPlans = eligible.filter(f => f.reserve >= reserve);
    if (protectedPlans.length) eligible = protectedPlans;
  }
  const score = f => policy === 'cautious' ? f.expectedNet - f.upfront * .2 + Math.min(f.reserve, 1000) * .1
    : policy === 'growth' ? f.expectedNet + f.forecastLow * 4 + (f.expectedSatisfaction >= D.PASS_SATISFACTION ? 2000 : -2000)
      : policy === 'aggressive' ? f.forecastHigh * f.price - f.upfront * .1 + f.usualDraw * 5
        : f.expectedNet;
  return [...eligible].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0].id;
}

export function chooseResponse(incidentId, cash, policy, choiceSeed) {
  const options = D.INCIDENTS[incidentId].responses.filter(r => r.cost <= cash);
  assert.ok(options.length, 'No affordable incident response');
  if (policy === 'random') return options[Math.floor(E.mulberry32(choiceSeed)() * options.length)].id;
  if (policy === 'beginner') return [...options].sort((a, b) => a.cost - b.cost)[0].id;
  return [...options].sort((a, b) => b.score - a.score || a.cost - b.cost)[0].id;
}

export function runCareer(seed, policy, { maxShows = 60, reload = false } = {}) {
  let state = E.createGame(seed), minimumCash = state.cash, totalCandidates = 0;
  const trace = [], shows = [], coverage = {}, rejected = { booking: 0, opening: 0, promotion: 0 };
  const reached = { lot: 0 }, unlocked = {};
  const record = input => {
    state = action(state, input); trace.push(clone(input));
    minimumCash = Math.min(minimumCash, state.cash);
    assert.ok(Number.isSafeInteger(state.cash) && state.cash >= 0, 'Cash remains nonnegative integer');
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
    const room = D.VENUE_ORDER.filter(id => id === 'lot' || state.unlocks[id]).at(-1);
    if (room !== state.venue.id) record({ type: 'chooseVenue', venueId: room });
    reached[room] ??= night;
    const { observation, candidates, rejected: refusals } = candidatesFor(state);
    totalCandidates += candidates.length;
    for (const key of Object.keys(rejected)) rejected[key] += refusals[key];
    const choiceSeed = parseInt(digest([seed, policy, night, 'plan']).slice(0, 8), 16);
    const id = selectPlan(observation, candidates.map(x => x.feature), policy, choiceSeed);
    if (!id) { stop = candidates.length ? 'policy_no_plan' : 'no_affordable_grid_plan'; brokeAt = night; break; }
    const chosen = candidates.find(c => c.feature.id === id);
    for (const input of chosen.actions) record(input);
    const openingCash = state.cash;
    record({ type: 'confirmPromotion' });
    assert.equal(state.cash, openingCash - chosen.feature.upfront, 'Opening charged exactly once');
    const incident = state.show.incidentId, responseId = chooseResponse(incident, state.cash, policy,
      parseInt(digest([seed, policy, night, 'response']).slice(0, 8), 16));
    const responseCash = state.cash;
    record({ type: 'respond', responseId });
    const receipt = clone(E.settlementFor(state));
    assert.equal(responseCash - state.cash, receipt.costs.incident);
    const signingCash = state.cash;
    record({ type: 'acceptSettlement' });
    assert.equal(state.cash, signingCash + E.settlementPayout(receipt, state.booking.deal), 'Exact signing payout');
    assert.equal(state.history.length, night + 1, 'One signed show');
    for (const [key, value] of Object.entries(state.unlocks)) if (value) unlocked[key] ??= night + 1;
    const row = { show: night + 1, room, decision: chosen.feature, incident, response: responseId,
      net: receipt.net, satisfaction: receipt.satisfaction, attendance: receipt.attendance, result: receipt.result,
      cashBefore: openingCash, cashAfter: state.cash, cashDelta: state.cash - openingCash, receipt };
    shows.push(row);
    for (const key of ['room', 'deal', 'layout', 'ads', 'price', 'ticketing']) {
      const value = key === 'room' ? room : chosen.feature[key];
      const label = `${key}:${value}`; coverage[label] = (coverage[label] || 0) + 1;
    }
    if (state.unlocks.complete) { stop = 'complete'; break; }
    const next = E.applyAction(state, { type: 'nextShow' });
    if (next.error) { stop = 'engine_cannot_continue'; brokeAt = night + 1; break; }
    record({ type: 'nextShow' });
  }
  const normalized = E.normalizeState(clone(state));
  return { seed, policy, complete: stop === 'complete', stop, brokeAt, shows, reached, unlocked,
    cash: state.cash, minimumCash, totalCandidates, rejected, coverage, trace,
    finalStateHash: digest(normalized), options: { maxShows }, fingerprint: digest(trace) };
}

export function replay(run) {
  let state = E.createGame(run.seed);
  for (const input of run.trace) state = action(state, input);
  assert.equal(digest(E.normalizeState(clone(state))), run.finalStateHash, 'Replay state must match');
  return { pass: true, actions: run.trace.length, fingerprint: digest(run.trace), finalStateHash: run.finalStateHash };
}

export function summarize(runs) {
  const rows = {};
  for (const policy of POLICIES) {
    const cohort = runs.filter(r => r.policy === policy);
    if (!cohort.length) continue;
    const shows = cohort.flatMap(r => r.shows);
    const losses = cohort.flatMap(r => r.shows.flatMap((s, i) => s.cashDelta < 0 ? [{ run: r, index: i }] : []));
    const recovered = ({ run, index }) => run.shows.slice(index + 1, index + 4).some(s => s.cashAfter >= run.shows[index].cashBefore);
    const recoverable = losses.filter(x => x.index + 3 < x.run.shows.length || recovered(x));
    rows[policy] = { careers: cohort.length, completed: cohort.filter(r => r.complete).length,
      completionRate: cohort.filter(r => r.complete).length / cohort.length,
      stops: Object.fromEntries([...new Set(cohort.map(r => r.stop))].map(stop => [stop, cohort.filter(r => r.stop === stop).length])),
      finalCash: distribution(cohort.map(r => r.cash)), minimumCash: distribution(cohort.map(r => r.minimumCash)),
      cashDeltaPerShow: distribution(shows.map(s => s.cashDelta)), netPerShow: distribution(shows.map(s => s.net)),
      satisfaction: distribution(shows.map(s => s.satisfaction)), signedShows: shows.length,
      completionShows: distribution(cohort.filter(r => r.complete).map(r => r.shows.length)),
      lossRecovery: { losses: losses.length, observable: recoverable.length,
        censored: losses.length - recoverable.length,
        recoveredWithin3: recoverable.filter(recovered).length },
      rooms: Object.fromEntries(D.VENUE_ORDER.map(room => {
        const attempted = cohort.filter(r => Object.hasOwn(r.reached, room));
        const roomShows = shows.filter(s => s.room === room);
        return [room, { reached: attempted.length, total: cohort.length, shows: roomShows.length,
          unlockShows: distribution(cohort.filter(r => r.unlocked[room] !== undefined).map(r => r.unlocked[room])),
          cashDelta: distribution(roomShows.map(s => s.cashDelta)), satisfaction: distribution(roomShows.map(s => s.satisfaction)) }];
      })) };
  }
  const pairs = [];
  for (const policy of POLICIES.filter(p => p !== 'beginner')) {
    const differences = runs.filter(r => r.policy === policy).flatMap(r => {
      const reference = runs.find(x => x.policy === 'beginner' && x.seed === r.seed);
      return reference ? [r.cash - reference.cash] : [];
    });
    pairs.push({ policy, reference: 'beginner', cashDifference: distribution(differences) });
  }
  return { policies: rows, paired: pairs };
}

export function provenance() {
  const paths = ['engine.mjs', 'data.mjs', 'sim/reference.mjs', 'sim/workbench.mjs',
    'services.mjs', 'research.mjs', 'ownership.mjs', 'career-ledger.mjs', 'stage-accounts.mjs',
    'seating.mjs', 'curfew.mjs', 'held-run.mjs', 'ticketing.mjs', 'room-profile.mjs', 'sanitation.mjs', 'concessions.mjs', 'guest-flow.mjs'];
  return Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(resolve(HERE, '..', path))).digest('hex')]));
}

export function buildReport(runs, config) {
  const development = runs.filter(r => r.seed < config.start + Math.floor(config.seeds * .8));
  const heldout = runs.filter(r => !development.includes(r));
  const examples = POLICIES.flatMap(policy => {
    const selected = runs.filter(r => r.policy === policy);
    const choices = [selected.find(r => !r.complete), [...selected].sort((a, b) => a.cash - b.cash)[0], selected.find(r => r.complete)];
    return [...new Set(choices.filter(Boolean))];
  });
  examples.forEach(replay);
  return { schema: 1, config, source: provenance(), policyVersion: 1,
    scope: 'Ordinary one-night careers, earned venues, representative layouts, three ticket prices and three ad presets; no live services, purchases, research or held runs.',
    interpretation: 'Scripted policies are hypotheses, not measured human behavior. Terminal cash compares different career lengths; use matched fixed-horizon experiments before causal tuning. Forecast scoring is approximate, especially Festival gross minus opening cost. No balance values changed.',
    cohorts: { all: summarize(runs), development: summarize(development), heldout: summarize(heldout) },
    examples, runs: runs.map(({ trace, shows, ...r }) => ({ ...r, shows: shows.map(({ receipt, ...s }) => s) })) };
}

export function markdown(report) {
  const out = ['# Front of House balance workbench', '', `Reproducible cohort: ${report.config.seeds} seeds per policy, ${report.config.maxShows} shows maximum, six strategies.`, '',
    report.scope, '', report.interpretation, '', '## Strategy outcomes', '',
    '| Policy | Careers | Completed | Median final cash | Cash p10 | Median completed shows | Signed shows |',
    '| --- | --- | --- | --- | --- | --- | --- |'];
  for (const [name, row] of Object.entries(report.cohorts.all.policies)) out.push(`| ${name} | ${row.careers} | ${row.completed} | ${row.finalCash.median} | ${row.finalCash.p10} | ${row.completionShows.median ?? 'None'} | ${row.signedShows} |`);
  out.push('', '## Held-out outcomes', '', '| Policy | Careers | Completed | Stops |', '| --- | --- | --- | --- |');
  for (const [name, row] of Object.entries(report.cohorts.heldout.policies)) out.push(`| ${name} | ${row.careers} | ${row.completed} | ${JSON.stringify(row.stops)} |`);
  out.push('', '## Per venue', '', '| Policy | Venue | Reached / total | Shows | Median cash change per show | Median satisfaction |', '| --- | --- | --- | --- | --- | --- |');
  for (const [name, row] of Object.entries(report.cohorts.all.policies)) for (const [room, r] of Object.entries(row.rooms)) out.push(`| ${name} | ${D.VENUES[room].name} | ${r.reached}/${r.total} | ${r.shows} | ${r.cashDelta.median ?? 'None'} | ${r.satisfaction.median ?? 'None'} |`);
  out.push('', '## Loss recovery', '', 'A loss is negative actual cash movement across a signed show. Recovery means regaining the cash held before that loss within the next three signed shows. Losses with fewer than three later shows and no observed recovery are censored, not silently removed.', '',
    '| Policy | Losses | Recovery observed or full horizon | Horizon censored | Recovered within three |', '| --- | --- | --- | --- | --- |');
  for (const [name, r] of Object.entries(report.cohorts.all.policies)) out.push(`| ${name} | ${r.lossRecovery.losses} | ${r.lossRecovery.observable} | ${r.lossRecovery.censored} | ${r.lossRecovery.recoveredWithin3} |`);
  out.push('', '## Replay examples', '', 'Examples include the first failure, lowest final cash and first completion for each policy, deduplicated. JSON retains every accepted engine action, full receipts, source hashes and final normalized-state digest. Replay validates the exact final state.', '');
  for (const e of report.examples) out.push(`- ${e.policy}, seed ${e.seed}: ${e.stop}, ${e.shows.length} shows, cash ${e.cash}, ${e.trace.length} actions.`);
  return out.join('\n') + '\n';
}

export function parseArgs(argv) {
  const options = { seeds: 100, start: 1, maxShows: 60, out: resolve(HERE, 'output') };
  const keys = { '--seeds': 'seeds', '--start': 'start', '--shows': 'maxShows', '--out': 'out', '--replay': 'replay' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = keys[argv[i]], value = argv[i + 1];
    if (!key || value === undefined || value.startsWith('--')) throw Error(`Invalid argument: ${argv[i]}`);
    options[key] = ['out', 'replay'].includes(key) ? resolve(value) : Number(value);
  }
  for (const key of ['seeds', 'start', 'maxShows']) if (!Number.isSafeInteger(options[key]) || options[key] < 1) throw Error(`Invalid ${key}`);
  if (options.seeds < 5 || options.seeds > 10000 || options.start + options.seeds > 0xffffffff || options.maxShows > 150) throw Error('Use 5 to 10000 seeds and 1 to 150 shows within uint32 seeds');
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = parseArgs(process.argv.slice(2));
  if (config.replay) {
    const report = JSON.parse(readFileSync(config.replay));
    assert.deepEqual(report.source, provenance(), 'Replay requires exact simulator and engine sources');
    console.log(JSON.stringify(report.examples.map(replay)));
  } else {
    const runs = [];
    for (let seed = config.start; seed < config.start + config.seeds; seed++) {
      for (const policy of POLICIES) runs.push(runCareer(seed, policy, config));
      console.error(`Seed ${seed}: ${runs.length} careers`);
    }
    // Output location is operational, never part of the reproducible report.
    const { out, ...parameters } = config;
    const report = buildReport(runs, parameters);
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    writeFileSync(resolve(out, 'REPORT.md'), markdown(report));
    console.log(JSON.stringify({ output: out, careers: runs.length, shows: runs.reduce((n, r) => n + r.shows.length, 0), policies: report.cohorts.all.policies }));
  }
}
