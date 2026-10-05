// Complete career feasibility and save/accounting verification through real engine actions.
// Generates CAREER_BASELINE.md; existing Lot balance targets remain unchanged.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import * as D from '../data.mjs';
import * as E from '../engine.mjs';
import { BUDGET_LAYOUT, REFERENCE_ADS } from './reference.mjs';

const SEEDS = 30;
const SHOW_LIMIT = 100;
const OUT = new URL('../docs/CAREER_BASELINE.md', import.meta.url);
const score = result => result.net + (result.satisfaction >= D.PASS_SATISFACTION ? 0 : -1e6);
function action(state, input) {
  const result = E.applyAction(state, input);
  if (result.error) throw new Error(`${input.type}: ${result.error}`);
  return result.state;
}

function layoutsFor(room) {
  if (room === 'lot') return [D.STARTER_LAYOUT, BUDGET_LAYOUT];
  if (room === 'festival') return [[...D.VENUES.festival.starter, ...D.FESTIVAL_SUPPORT_LAYOUT,
    { type: 'delay', x: 8, y: 16, rot: 0 }, { type: 'delay', x: 30, y: 16, rot: 1 }]];
  return [D.VENUES[room].starter.filter(object => !D.ROOM_PROFILES[room]?.houseLights || object.type !== 'lights')];
}

// Uses known relationships, published draw bounds and current prices/costs only.
// The Festival score is a public gross estimate less its opening quote, not an exact net forecast.
function choosePlan(state, alternateHiddenSeed = false) {
  const room = state.venue.id;
  const candidates = [];
  for (const artistId of E.offersFor(state)) {
    const artist = D.ARTISTS[artistId];
    const terms = E.termsFor(artistId, state.reputation.artists[artistId]);
    const deals = room === 'festival' ? ['guarantee', 'sponsor'] : terms.doorOk ? ['guarantee', 'door'] : ['guarantee'];
    for (const deal of deals) for (const objects of layoutsFor(room)) {
      const booking = { type: 'chooseDeal', artistId, deal,
        ...(room !== 'lot' ? { roomPolicy: 1 } : {}),
        ...(['amphitheater', 'festival'].includes(room) ? { curfewPolicy: 1 } : {}),
        ...(room === 'amphitheater' ? { seatingPolicy: 1 } : {}),
        ...(room === 'festival' ? { secondId: E.stageOpenersFor(state).find(id => id !== artistId), stagePolicy: 1, festivalPolicy: 1, supportPolicy: 1 } : {}) };
      const chosen = E.applyAction(state, booking);
      if (chosen.error) continue;
      let plan = action(chosen.state, { type: 'setLayout', objects });
      plan = action(plan, { type: 'confirmBuild' });
      const promotion = { type: 'setPromotion', price: artist.fairPrice, seatPrice: artist.fairPrice + 10, ads: REFERENCE_ADS };
      plan = action(plan, promotion);
      // Offer rotation is visible and seeded too. Hold that public roster fixed while
      // perturbing only the future draw used inside each candidate's derived quotes.
      if (alternateHiddenSeed) plan.seed = (plan.seed ^ 0xa5a5a5a5) >>> 0;
      const upfront = E.upfrontFor(plan);
      const reserve = Math.max(...D.INCIDENTS.curfew.responses.map(response => response.cost));
      if (upfront + reserve > state.cash) continue;
      const forecast = E.stageForecastFor(plan);
      const estimate = E.evaluateShow({ venue: E.evaluateVenue(plan.venue), deal,
        price: promotion.price, seatPrice: promotion.seatPrice, ads: promotion.ads,
        venueRep: state.reputation.venue, draw: (artist.drawMin + artist.drawMax) / 2,
        ask: plan.booking.terms.ask, drawMult: plan.booking.terms.drawMult, artistId,
        incidentId: null, responseId: null,
        ...(room === 'amphitheater' ? { seating: plan.booking.seating } : {}) });
      candidates.push({ booking, objects, promotion, upfront,
        score: forecast ? (forecast.ticketGross.low + forecast.ticketGross.high) / 2 - upfront : score(estimate) });
    }
  }
  return candidates.sort((a, b) => b.score - a.score)[0] || null;
}

function snapshot(state) {
  // Normalize both comparison sides so transient default fields do not masquerade as save loss.
  return E.normalizeState(JSON.parse(JSON.stringify(state)));
}

function play(seed, reload) {
  let state = E.createGame(seed);
  assert.equal(state.cash, D.START_CASH);
  assert.equal(state.mode, 'career');
  const receipts = [];
  const choices = [];
  let minimumCash = state.cash;
  const step = input => {
    state = action(state, input);
    assert.ok(Number.isSafeInteger(state.cash) && state.cash >= 0, 'career cash stays affordable');
    assert.equal(E.careerLedgerFor(state)?.balance ?? state.cash, state.cash, 'journal matches actual cash');
    minimumCash = Math.min(minimumCash, state.cash);
    if (reload) {
      const rawCash = state.cash, rawHistory = structuredClone(state.history), rawReputation = structuredClone(state.reputation);
      const rawLedger = structuredClone(state.cashJournal), rawUnlocks = structuredClone(state.unlocks);
      state = E.normalizeState(JSON.parse(JSON.stringify(state)));
      assert.equal(state.cash, rawCash);
      assert.deepEqual(state.history, rawHistory);
      assert.deepEqual(state.reputation, rawReputation);
      assert.deepEqual(state.cashJournal, rawLedger);
      assert.deepEqual(state.unlocks, rawUnlocks);
      assert.equal(state.equipmentNotice, undefined, 'valid ledger survives without recovery');
    }
  };
  for (let night = 1; night <= SHOW_LIMIT; night += 1) {
    if (state.history.length && !state.equipment) step({ type: 'enableEquipment' });
    const highest = D.VENUE_ORDER.filter(id => id === 'lot' || state.unlocks[id]).at(-1);
    if (state.venue.id !== highest) step({ type: 'chooseVenue', venueId: highest });
    const plan = choosePlan(state);
    if (!plan) return { seed, complete: false, stop: 'No affordable policy booking', minimumCash, state, receipts, choices };
    assert.deepEqual(choosePlan(state, true), plan, 'fixed public offers: booking choice does not use the hidden draw');
    choices.push({ venue: state.venue.id, artist: plan.booking.artistId, deal: plan.booking.deal });
    step(plan.booking);
    step({ type: 'setLayout', objects: plan.objects });
    step({ type: 'confirmBuild' });
    step(plan.promotion);
    const openingCash = state.cash;
    step({ type: 'confirmPromotion' });
    assert.equal(state.cash, openingCash - plan.upfront, 'quoted opening paid once');
    const affordable = D.INCIDENTS[state.show.incidentId].responses.filter(response => response.cost <= state.cash);
    // A fixed strongest-affordable response policy; do not preview a settlement
    // or inspect the hidden draw to choose the response.
    const response = affordable.sort((a, b) => b.score - a.score || a.cost - b.cost)[0];
    const responseCash = state.cash;
    step({ type: 'respond', responseId: response.id });
    assert.equal(state.cash, responseCash - response.cost, 'response charged once');
    const receipt = E.settlementFor(state);
    receipts.push({ venue: state.venue.id, ...structuredClone(receipt) });
    const beforeSigning = state.cash;
    step({ type: 'acceptSettlement' });
    assert.equal(state.cash, beforeSigning + E.settlementPayout(receipt, plan.booking.deal), 'signing matches receipt');
    assert.equal(state.history.length, night, 'one signed history entry per show');
    const duplicate = E.applyAction(state, { type: 'acceptSettlement' });
    assert.ok(duplicate.error, 'duplicate signing refused');
    assert.equal(duplicate.state.cash, state.cash);
    if (state.unlocks.complete) return { seed, complete: true, minimumCash, state, receipts, choices };
    const next = E.applyAction(state, { type: 'nextShow' });
    if (next.error) return { seed, complete: false, stop: next.error, minimumCash, state, receipts, choices };
    step({ type: 'nextShow' });
  }
  return { seed, complete: false, stop: 'Show limit', minimumCash, state, receipts, choices };
}

const runs = [];
for (let seed = 1; seed <= SEEDS; seed += 1) {
  const direct = play(seed, false), resumed = play(seed, true);
  assert.deepEqual(resumed.choices, direct.choices, `seed ${seed}: same public booking choices after reload`);
  assert.deepEqual(resumed.receipts, direct.receipts, `seed ${seed}: complete receipt parity after reload`);
  assert.deepEqual(snapshot(resumed.state), snapshot(direct.state), `seed ${seed}: complete career state parity`);
  runs.push(direct);
}

const complete = runs.filter(run => run.complete);
const lines = ['# Front of House Complete Career Baseline', '',
  '*Generated by `npm run sim:front-of-house-career`. CI rejects drift or failed invariants. Existing Lot balance targets are unchanged.*', '',
  `Engine ${E.ENGINE_VERSION} · schema ${D.SCHEMA_VERSION} · seeds 1–${SEEDS} · ${D.START_CASH} starting cash · ${SHOW_LIMIT}-show limit`, '',
  '## Policy and limits', '',
  'Normal career actions only: no injected cash, unlocks, relationships, future draws or future incidents. Enable the existing Equipment ledger after the first signed show, without purchases; its opening balance preserves that first show. Advance to each earned room, compare affordable deals at published middle draw with a $400 response reserve, use usual ticket prices and $150 each social/radio promotion. The Lot compares suggested and budget layouts; other rooms use suggested layouts, omitting redundant towers when house lights are included, with two Festival delays at (8,16)/(30,16), a VIP deck and a bus compound. The $1,500 touring rental is included in the opening quote. Club and outdoor room profiles, outdoor curfew, separate Shell seating and Festival bill/sponsor/touring policies are marked explicitly. Each booking is one night.', '',
  'After the current incident is revealed, choose its strongest affordable response by authored incident score, breaking ties by lower cost. This fixed policy does not preview settlements or use the hidden draw. The Festival booking score uses the average public gross bounds less the opening quote; it is an approximate planning policy, not a net forecast. Every booking choice is checked against an alternative future seed while holding published offers fixed. Each career repeats with JSON save normalization after every applied action; full receipts, cash, journal, choices, history, relationships and unlocks must match.', '',
  'These fixed seeds demonstrate automated feasibility and recovery. They do not approve economy balance, minimum completion rates, human comprehension or device/art acceptance. A completion can include a retry-quality night: the current Festival goal requires attendance, cash and loyalty, rather than every show passing. Alternate deals, held-night cancellation and imported legacy policies retain their focused suites.', '',
  '## Outcomes', '',
  '| Seed | Lot shows | Club shows | Shell shows | Festival shows | Total | Final cash | Lowest cash | Complete |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
for (const run of runs) lines.push(`| ${run.seed} | ${D.VENUE_ORDER.map(id => run.state.history.filter(show => (show.venueId || 'lot') === id).length).join(' | ')} | ${run.state.history.length} | ${run.state.cash} | ${run.minimumCash} | ${run.complete ? 'Yes' : 'No'} |`);
lines.push('', '## Tier evidence', '', '| Room | Signed shows | Passing shows | Maximum attendance | Satisfaction range |', '| --- | --- | --- | --- | --- |');
for (const id of D.VENUE_ORDER) {
  const shows = runs.flatMap(run => run.state.history.filter(show => (show.venueId || 'lot') === id));
  lines.push(`| ${D.VENUES[id].name} | ${shows.length} | ${shows.filter(show => show.result === 'pass').length} | ${Math.max(0, ...shows.map(show => show.attendance))} | ${shows.length ? `${Math.min(...shows.map(show => show.satisfaction))}–${Math.max(...shows.map(show => show.satisfaction))}` : 'None'} |`);
}
const verdicts = [
  ['All fixed careers complete through earned unlocks', complete.length === SEEDS, `${complete.length}/${SEEDS} completed`],
  ['Each room has a signed show in every career', runs.every(run => D.VENUE_ORDER.every(id => run.state.history.some(show => (show.venueId || 'lot') === id))), 'Normal actions and current unlock rules'],
  ['Affordable opening, response and exact one-time signing', true, 'Checked at every applied transition, including duplicate-signing refusal'],
  ['Booking policy independent of hidden draw seed', true, 'Every booking compared with an alternative future seed, holding published offers fixed'],
  ['Complete saved-career and receipt parity', true, `${SEEDS} uninterrupted/reload pairs; full receipts and journals compared`],
];
lines.push('', '## Verdicts', '', '| Check | Verdict | Evidence |', '| --- | --- | --- |');
for (const [name, pass, detail] of verdicts) lines.push(`| ${name} | ${pass ? 'PASS' : 'FAIL'} | ${detail} |`);
lines.push('');
writeFileSync(OUT, lines.join('\n'));
console.log(`Complete career: ${complete.length}/${SEEDS}; ${runs.reduce((sum, run) => sum + run.state.history.length, 0)} signed shows; ${SEEDS} exact save/reload pairs.`);
if (verdicts.some(([, pass]) => !pass)) process.exitCode = 1;
