#!/usr/bin/env node
// Paired balance comparisons for the Lot career. Not part of CI and writes no files: it
// prints a Markdown report to stdout.
//
//   node front-of-house/sim/paired.mjs
//
// Each arm plays the same seeds through the real action pipeline with a fixed scripted
// policy. Arms differ in one factor at a time (layout, deal or incident response), so a
// difference between two arms comes from that factor. Seeds follow the same chain in every
// arm (each show's seed comes from the last), so show N offers the same acts and rolls the
// same draw and incident in every arm whenever the same act is booked.
//
// The policies use only what the player sees when deciding: the offers in the order shown,
// each act's terms (ask and whether it takes the door), the costs the Build and Promote
// screens show, and each incident response's cost and handling score. They never look at
// the seed's hidden draw or at a settlement before choosing.
//
// These are scripted-policy results, not playtest results.

import * as D from '../data.mjs';
import {
  applyAction, careerProgress, createGame, nextShowCost, offersFor, settlementFor, termsFor,
} from '../engine.mjs';
import { BUDGET_LAYOUT, REFERENCE_ADS, REFERENCE_LAYOUT } from './reference.mjs';

const T = D.BALANCE_TARGETS;
const SEEDS = T.careerSeeds;
const LIMIT = T.careerShows;
const LAYOUTS = { suggested: REFERENCE_LAYOUT, budget: BUDGET_LAYOUT };

const tryActions = (s, actions) => {
  for (const a of actions) {
    const r = applyAction(s, a);
    if (r.error) return { state: null, error: r.error };
    s = r.state;
  }
  return { state: s, error: null };
};

// Books the first act on offer that the arm can afford. The arm's deal is used when the act
// allows it; an act that refuses the door (guarantee-only, or soured) is booked on a guarantee.
// An act whose upfront cost is above the cash on hand is skipped for the next offer.
function book(s, arm) {
  for (const id of offersFor(s)) {
    const terms = termsFor(id, s.reputation.artists[id]);
    const deal = arm.deal === 'door' && terms.doorOk ? 'door' : 'guarantee';
    const r = tryActions(s, [
      { type: 'chooseDeal', deal, artistId: id },
      { type: 'setLayout', objects: LAYOUTS[arm.layout] },
      { type: 'confirmBuild' },
      { type: 'setPromotion', price: D.ARTISTS[id].fairPrice, ads: REFERENCE_ADS },
      { type: 'confirmPromotion' },
    ]);
    if (r.state) return { state: r.state, id, deal, doorRefused: arm.deal === 'door' && !terms.doorOk, ask: terms.ask };
  }
  return null;
}

// Free: the no-cost response. Paid: the affordable response with the highest handling score
// shown on screen (cheapest on a tie); when nothing paid is affordable, that is the free one.
function respond(s, arm) {
  const all = D.INCIDENTS[s.show.incidentId].responses;
  const free = all.find((r) => r.cost === 0);
  if (arm.response === 'free') return { id: free.id, fellBack: false };
  const pick = all.filter((r) => r.cost <= s.cash).sort((a, b) => b.score - a.score || a.cost - b.cost)[0];
  return { id: pick.id, fellBack: pick.cost === 0 };
}

function career(seed, arm) {
  let s = createGame(seed);
  const shows = [];
  const end = (outcome) => {
    const p = careerProgress(s);
    return { seed, outcome, shows, cash: s.cash, best: p.loyalAct, venueRep: p.venueRep, met: p.met };
  };
  for (let n = 1; n <= LIMIT; n += 1) {
    const b = book(s, arm);
    // R-21 allowed this show, but no act on offer is affordable with this policy's fixed layout.
    if (!b) return end('stuck');
    s = b.state;
    const r = respond(s, arm);
    s = applyAction(s, { type: 'respond', responseId: r.id }).state;
    const sheet = settlementFor(s);
    s = applyAction(s, { type: 'acceptSettlement' }).state;
    shows.push({
      id: b.id, deal: b.deal, doorRefused: b.doorRefused, fellBack: r.fellBack, paid: !r.fellBack && arm.response === 'paid',
      net: sheet.net, satisfaction: sheet.satisfaction, attendance: sheet.attendance, relDelta: sheet.relDelta,
      payRatio: sheet.artistPay / b.ask, result: sheet.result,
    });
    if (s.unlocks.club) return end('unlocked');
    // R-21: the career stops when the next show is unaffordable on any deal its offer allows.
    if (s.cash < nextShowCost(s)) return end('bankrupt');
    s = applyAction(s, { type: 'nextShow' }).state;
  }
  return end('limit');
}

// ---------------------------------------------------------------------------
// Report helpers

const median = (xs) => {
  if (!xs.length) return null;
  const v = xs.slice().sort((a, b) => a - b);
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');
const money = (n) => (n === null ? 'n/a' : `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`);
const num = (n, digits = 1) => (n === null ? 'n/a' : n.toFixed(digits));
const out = (s = '') => process.stdout.write(`${s}\n`);
const table = (head, rows) => {
  out(`| ${head.join(' | ')} |`);
  out(`| ${head.map(() => '---').join(' | ')} |`);
  rows.forEach((r) => out(`| ${r.join(' | ')} |`));
  out();
};

const ARMS = [];
for (const layout of ['suggested', 'budget']) {
  for (const deal of ['door', 'guarantee']) {
    for (const response of ['free', 'paid']) ARMS.push({ layout, deal, response, key: `${layout}/${deal}/${response}` });
  }
}
const results = Object.fromEntries(ARMS.map((arm) => {
  const runs = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) runs.push(career(seed, arm));
  return [arm.key, runs];
}));

function summary(key) {
  const runs = results[key];
  const shows = runs.flatMap((r) => r.shows);
  const unlocked = runs.filter((r) => r.outcome === 'unlocked');
  const toUnlock = unlocked.map((r) => r.shows.length);
  return {
    unlock: pct(unlocked.length, runs.length),
    median: median(toUnlock),
    min: toUnlock.length ? Math.min(...toUnlock) : null,
    max: toUnlock.length ? Math.max(...toUnlock) : null,
    bankrupt: runs.filter((r) => r.outcome === 'bankrupt').length,
    stuck: runs.filter((r) => r.outcome === 'stuck').length,
    limit: runs.filter((r) => r.outcome === 'limit').length,
    cash: median(runs.map((r) => r.cash)),
    netPerShow: mean(shows.map((x) => x.net)),
    satisfaction: mean(shows.map((x) => x.satisfaction)),
    passRate: pct(shows.filter((x) => x.result === 'pass').length, shows.length),
    best: median(runs.map((r) => r.best)),
    venueRep: median(runs.map((r) => r.venueRep)),
    shows: shows.length,
    doorRefused: shows.filter((x) => x.doorRefused).length,
    paid: shows.filter((x) => x.paid).length,
    fellBack: shows.filter((x) => x.fellBack).length,
    unmet: ['sellouts', 'venueRep', 'cash', 'loyalAct'].map((k) => runs.filter((r) => r.outcome !== 'unlocked' && !r.met[k]).length),
  };
}

function paired(a, b) {
  const A = results[a];
  const B = results[b];
  let both = 0; let onlyA = 0; let onlyB = 0; let neither = 0;
  const diffs = [];
  let sameFirst = 0;
  const first = { net: [], satisfaction: [] };
  for (let i = 0; i < A.length; i += 1) {
    const ua = A[i].outcome === 'unlocked';
    const ub = B[i].outcome === 'unlocked';
    if (ua && ub) { both += 1; diffs.push(A[i].shows.length - B[i].shows.length); }
    else if (ua) onlyA += 1;
    else if (ub) onlyB += 1;
    else neither += 1;
    const fa = A[i].shows[0];
    const fb = B[i].shows[0];
    if (fa && fb && fa.id === fb.id) {
      sameFirst += 1;
      first.net.push(fa.net - fb.net);
      first.satisfaction.push(fa.satisfaction - fb.satisfaction);
    }
  }
  return { both, onlyA, onlyB, neither, diff: mean(diffs), sameFirst, firstNet: mean(first.net), firstSat: mean(first.satisfaction) };
}

// ---------------------------------------------------------------------------
// Report

out('# Front of House: paired Lot career comparisons');
out();
out(`Scripted-policy results, not playtest results. ${SEEDS} seeds, up to ${LIMIT} shows each, the Lot goal as in \`data.mjs\` (a sellout of ${D.PERMIT_CAP}, venue reputation ${D.LOT_GOAL.venueRep}, ${money(D.LOT_GOAL.cash)}, an act at +${D.LOT_GOAL.loyalAct}).`);
out();
out('Every arm books the first act on offer it can afford, at the act\'s fair price with the reference ads, and differs from the baseline in one factor:');
out();
out('- **Layout:** the suggested layout (`REFERENCE_LAYOUT`) or the budget layout (`BUDGET_LAYOUT`: small PA, no light tower, one restroom fewer).');
out('- **Deal:** the door deal whenever the act takes it, or always the guarantee. A guarantee-only or soured act is booked on a guarantee in both arms ("door refused" below).');
out('- **Response:** the free response, or the affordable response with the highest handling score shown on screen. When no paid response is affordable, the paid arm takes the free one ("fell back").');
out();
out('Run outcomes: **unlocked** the Club; **bankrupt**: the next show was unaffordable on every deal its offer allows (R-21); **stuck**: R-21 allowed the next show, but no act on offer was affordable with the arm\'s fixed layout; **limit**: still running after the last show without the unlock.');
out();

out('## Every arm');
out();
table(['Arm (layout/deal/response)', 'Unlock rate', 'Shows to unlock (median, min, max)', 'Bankrupt', 'Stuck', 'Limit', 'Median end cash', 'Net per show', 'Satisfaction per show', 'Shows passed', 'Best act relationship (median)', 'Venue reputation (median)'],
  ARMS.map(({ key }) => {
    const s = summary(key);
    return [key, s.unlock, s.median === null ? 'n/a' : `${s.median}, ${s.min}, ${s.max}`, s.bankrupt, s.stuck, s.limit, money(s.cash),
      money(s.netPerShow), num(s.satisfaction), s.passRate, num(s.best, 0), num(s.venueRep, 0)];
  }));
table(['Arm', 'Shows played', 'Door refused', 'Paid responses', 'Paid arm fell back to free', 'Unlock missed on: sellout', 'venue reputation', 'cash', 'loyal act'],
  ARMS.map(({ key }) => {
    const s = summary(key);
    return [key, s.shows, s.doorRefused, s.paid, s.fellBack, ...s.unmet];
  }));

const BASE = 'suggested/door/free';
out(`## One factor at a time, from the baseline \`${BASE}\``);
out();
out('"Both", "only changed", "only baseline" and "neither" count seeds by which arm unlocked the Club. "Shows saved" is the mean of baseline shows minus changed-arm shows, over seeds where both unlocked. The first-show columns compare show 1 on seeds where both arms booked the same act (same draw and incident).');
out();
const COMPARE = [
  ['Budget layout', 'budget/door/free'],
  ['Always guarantee', 'suggested/guarantee/free'],
  ['Paid response', 'suggested/door/paid'],
];
table(['Change', 'Arm', 'Unlock rate (baseline ' + summary(BASE).unlock + ')', 'Both', 'Only changed', 'Only baseline', 'Neither', 'Shows saved', 'Same first act', 'First-show net Δ', 'First-show satisfaction Δ'],
  COMPARE.map(([label, key]) => {
    const p = paired(key, BASE);
    return [label, key, summary(key).unlock, p.both, p.onlyA, p.onlyB, p.neither, p.diff === null ? 'n/a' : num(-p.diff),
      p.sameFirst, money(p.firstNet), num(p.firstSat)];
  }));

out('## Each factor across every setting of the other two');
out();
out('The same comparison repeated with the other two factors at each of their settings, to see whether an effect holds or depends on the rest of the policy.');
out();
const factorRows = [];
for (const [factor, from, to] of [['layout', 'suggested', 'budget'], ['deal', 'door', 'guarantee'], ['response', 'free', 'paid']]) {
  for (const arm of ARMS.filter((a) => a[factor] === from)) {
    const other = ARMS.find((a) => ['layout', 'deal', 'response'].every((k) => (k === factor ? a[k] === to : a[k] === arm[k])));
    const p = paired(other.key, arm.key);
    factorRows.push([`${factor}: ${from} → ${to}`, `${arm.key} → ${other.key}`, `${summary(arm.key).unlock} → ${summary(other.key).unlock}`,
      p.onlyA, p.onlyB, p.diff === null ? 'n/a' : num(-p.diff), money(p.firstNet), num(p.firstSat)]);
  }
}
table(['Factor', 'Arms', 'Unlock rate', 'Only changed unlocks', 'Only original unlocks', 'Shows saved', 'First-show net Δ', 'First-show satisfaction Δ'], factorRows);

out('## Relationship change by deal (R-17)');
out();
out(`A guarantee pays the quoted ask, so it always moves the relationship by \`REL_BASE\` (+${D.REL_BASE}). A door deal pays ${D.DOOR_SPLIT * 100}% of what is left after costs, which can be below, at or above the ask: the change is \`clamp(${D.REL_BASE} + round(${D.REL_SLOPE} × (pay / ask − 1)), ${D.REL_MIN_STEP}, ${D.REL_MAX_STEP})\`.`);
out();
const doorShows = ARMS.flatMap(({ key }) => results[key].flatMap((r) => r.shows.filter((x) => x.deal === 'door')));
const byLayout = (layout) => ARMS.filter((a) => a.layout === layout)
  .flatMap(({ key }) => results[key].flatMap((r) => r.shows.filter((x) => x.deal === 'door')));
table(['Door shows', 'Count', 'Mean change', 'Below 0', '0 to +4', '+5 (same as a guarantee)', 'Above +5', 'Pay at or above the ask'],
  [['all arms', doorShows], ['suggested layout', byLayout('suggested')], ['budget layout', byLayout('budget')]].map(([label, xs]) => [
    label, xs.length, num(mean(xs.map((x) => x.relDelta))),
    pct(xs.filter((x) => x.relDelta < 0).length, xs.length),
    pct(xs.filter((x) => x.relDelta >= 0 && x.relDelta < D.REL_BASE).length, xs.length),
    pct(xs.filter((x) => x.relDelta === D.REL_BASE).length, xs.length),
    pct(xs.filter((x) => x.relDelta > D.REL_BASE).length, xs.length),
    pct(xs.filter((x) => x.payRatio >= 1).length, xs.length),
  ]));
