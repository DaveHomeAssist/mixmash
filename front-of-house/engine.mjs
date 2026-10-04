// Front of House rules engine.
//
// Pure and deterministic: no DOM access, no Math.random, no clock. Every function
// takes state (or plain inputs) and returns new state or derived numbers, so the
// browser client, the tests and the balance simulator all run the same rules.
// Rule IDs (R-NN) refer to front-of-house/docs/RULES.md; every number comes from data.mjs.

import * as D from './data.mjs';
import * as Services from './services.mjs';
import * as Research from './research.mjs';
import * as Ownership from './ownership.mjs';
import * as Journal from './career-ledger.mjs';
import { festivalTerms, festivalSales, festivalSettlement } from './stage-accounts.mjs';
import { seatingTerms, seatingContract, seatingSales, seatingSatisfaction } from './seating.mjs';
import { heldRunTerms, heldRunQuote } from './held-run.mjs';
import { ticketingTerms, ticketingSplit, ticketingReceipt } from './ticketing.mjs';
import { sanitationFor, SANITATION } from './sanitation.mjs';
import { FOOD_PLANS, foodTerms, concessionsFor } from './concessions.mjs';
import { lotAccess, createDeparture, advanceDeparture, departureSummary, departureEvents } from './guest-flow.mjs';

export const ENGINE_VERSION = 1;
export const PHASES = ['book', 'build', 'promote', 'show', 'settle', 'done'];
export const DEALS = ['guarantee', 'door'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => typeof v === 'number' && Number.isInteger(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const key = (x, y) => `${x},${y}`;

// ---------------------------------------------------------------------------
// Seeded randomness (RULES.md, General conventions)

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nextSeed(seed) {
  return (seed + 0x9e3779b9) >>> 0;
}

export function artistFor(artistId) {
  return D.ARTISTS[artistId] || D.ARTISTS[D.DEFAULT_ARTIST];
}

// Draw order is fixed: artist draw, incident type, incident timing.
// `timing` is the raw 0 to 1 roll; `incidentAt` places it inside the incident's window (R-11a).
export function rollShow(seed, artistId = D.DEFAULT_ARTIST) {
  const artist = artistFor(artistId);
  const rng = mulberry32(seed);
  const draw = artist.drawMin + Math.floor(rng() * (artist.drawMax - artist.drawMin + 1));
  const incidentId = D.INCIDENT_ORDER[Math.floor(rng() * D.INCIDENT_ORDER.length)];
  const timing = rng();
  return { draw, incidentId, incidentAt: incidentAtFor(incidentId, timing), timing };
}

// When an incident happens, as a share of show night (doors to curfew). The same timing roll
// lands inside each incident's own window, so a room that picks a different incident than
// rollShow (incidentFor) still gets a time that fits the incident it shows.
export function incidentAtFor(incidentId, timing) {
  const spec = D.INCIDENTS[incidentId];
  const [from, to] = spec && Array.isArray(spec.window) ? spec.window : [0.2, 0.8];
  const t = Number.isFinite(timing) ? clamp(timing, 0, 1) : 0.5;
  return Math.round((from + t * (to - from)) * 1000) / 1000;
}

// The incident is a pure function of the seed, the room and the night, so a save
// never stores a choice the loader could disagree with.
export function incidentFor(seed, artistId, venue, forced = null, night = 1) {
  if (forced && D.INCIDENTS[forced]) return forced;
  const spec = venueSpec(venue);
  const useSeed = (night > 1 ? (seed ^ night) : seed) >>> 0;
  if (!spec.incidents) return rollShow(useSeed, artistId).incidentId;
  const rng = mulberry32(useSeed);
  rng();
  return spec.incidents[Math.floor(rng() * spec.incidents.length)];
}

// ---------------------------------------------------------------------------
// State

export function createGame(seed = 1, opts = {}) {
  const artist = artistFor(D.DEFAULT_ARTIST);
  const mode = opts.mode === 'sandbox' || opts.mode === 'scenario' ? opts.mode : 'career';
  const scenario = mode === 'scenario' ? (opts.scenario || 'wet-lot') : null;
  const unlocked = mode === 'sandbox';
  const game = {
    schema: D.SCHEMA_VERSION,
    seed: seed >>> 0,
    phase: 'book',
    mode,
    scenario,
    forcedIncident: scenario === 'wet-lot' ? 'rain' : null,
    cash: mode === 'sandbox' ? D.SANDBOX_CASH : (scenario ? D.SCENARIO_CASH : D.START_CASH),
    venue: { id: 'lot', grid: { w: D.GRID.w, h: D.GRID.h }, objects: scenario ? D.STARTER_LAYOUT.map((o) => ({ ...o })) : [] },
    layouts: { lot: [], club: [], amphitheater: [], festival: [] },
    booking: { artistId: D.DEFAULT_ARTIST, deal: null, terms: null, nights: 1, secondId: null, secondTerms: null },
    promotion: { price: artist.fairPrice, ads: zeroAds(), confirmed: false, seatPrice: null },
    show: null,
    reputation: { venue: 0, artists: Object.fromEntries(Object.keys(D.ARTISTS).map((id) => [id, 0])) },
    history: [],
    unlocks: { club: unlocked, amphitheater: unlocked, festival: unlocked, complete: false },
  };
  if (scenario) game.layouts.lot = game.venue.objects.map((o) => ({ ...o }));
  return game;
}

export function venueSpec(venue) {
  const id = isObj(venue) && D.VENUES[venue.id] ? venue.id : 'lot';
  return D.VENUES[id];
}

function venueUnlocked(state, id) {
  if (id === 'lot') return true;
  if (state.mode === 'sandbox') return true;
  if (id === 'club') return !!(state.unlocks && state.unlocks.club);
  if (id === 'amphitheater') return !!(state.unlocks && state.unlocks.amphitheater);
  if (id === 'festival') return !!(state.unlocks && state.unlocks.festival);
  return false;
}

// ---------------------------------------------------------------------------
// The Lot career (R-19 to R-21)

// R-19: the acts on offer for this show. The first show always offers the default act, so the
// first night is the one the balance baseline describes; later shows draw from the roster.
export function offersFor(state) {
  const spec = venueSpec(state.venue);
  return offersForSeed(state.seed, !state.history.length && spec.id === 'lot', spec.roster, spec.defaultArtist);
}

export function stageOpenersFor(state) {
  if (state.venue.id !== 'festival') return [];
  return Object.keys(D.ARTISTS).filter(id => !D.FEST_ROSTER.includes(id) && termsFor(id, state.reputation.artists[id]).doorOk)
    .sort((a, b) => D.ARTISTS[b].drawMax - D.ARTISTS[a].drawMax || a.localeCompare(b));
}

function offersForSeed(seed, firstShow, roster = D.ROSTER, defaultArtist = D.DEFAULT_ARTIST) {
  const rng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const pool = roster.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  if (firstShow) return [defaultArtist, ...pool.filter((id) => id !== defaultArtist)].slice(0, D.OFFERS_PER_SHOW);
  return pool.slice(0, D.OFFERS_PER_SHOW);
}

// R-19: what an act asks for, given how it feels about the promoter.
export function termsFor(artistId, relationship) {
  const artist = artistFor(artistId);
  const rel = clamp(isInt(relationship) ? relationship : 0, -100, 100);
  const ask = Math.round(artist.ask * (1 - rel * D.REL_ASK_SLOPE) / D.ASK_ROUNDING) * D.ASK_ROUNDING;
  return { ask, drawMult: 1 + rel * D.REL_DRAW_SLOPE, doorOk: !artist.guaranteeOnly && rel > D.REL_DOOR_FLOOR };
}

// R-21: the least a show can cost before doors: the cheapest valid venue with no ads, on a
// door deal, or on a guarantee of `ask`.
export function cheapestShowCost(deal = 'door', ask = undefined) {
  return evaluateShow({
    venue: evaluateVenue({ objects: D.CHEAPEST_LAYOUT }), deal, ask, price: D.PRICE_MIN,
    ads: zeroAds(), venueRep: 0, draw: 0, artistId: D.DEFAULT_ARTIST, incidentId: null, responseId: null,
  }).upfront;
}

// R-21: the least the next show can cost: the cheapest deal each act on the next show's offer
// will take, at the terms its relationship sets. Two acts that both want a guarantee cost more
// than the door-deal floor.
export function nextShowCost(state) {
  const spec = venueSpec(state.venue);
  return Math.min(...offersForSeed(nextSeed(state.seed), false, spec.roster, spec.defaultArtist).map((id) => {
    const terms = termsFor(id, state.reputation.artists[id]);
    const ordinary = showCost(spec, terms.doorOk ? 'door' : 'guarantee', terms.doorOk ? undefined : terms.ask);
    return Math.min(ordinary, spec.sponsor ? showCost(spec, 'sponsor', terms.ask) : ordinary)
      + (spec.id === 'festival' ? 4 * D.STAFF_RATE + D.PA_RENTAL.M + D.LIGHTS_RENTAL : 0);
  }));
}

function showCost(spec, deal, ask) {
  return evaluateShow({
    venue: evaluateVenue({ id: spec.id, objects: spec.cheapest }), deal, ask, price: D.PRICE_MIN,
    ads: zeroAds(), venueRep: 0, draw: 0, artistId: spec.defaultArtist, incidentId: null, responseId: null,
  }).upfront;
}

// R-20: progress toward the Lot goal that unlocks the Club.
export function careerProgress(state) {
  const lotShows = state.history.filter((h) => !h.venueId || h.venueId === 'lot');
  const sellouts = lotShows.filter((h) => h.attendance >= D.PERMIT_CAP).length;
  const loyalAct = Math.max(...D.ROSTER.map((id) => state.reputation.artists[id] || 0));
  const met = {
    sellouts: sellouts >= D.LOT_GOAL.sellouts,
    venueRep: state.reputation.venue >= D.LOT_GOAL.venueRep,
    cash: state.cash >= D.LOT_GOAL.cash,
    loyalAct: loyalAct >= D.LOT_GOAL.loyalAct,
  };
  const tierMet = tierGoals(state);
  return {
    shows: state.history.length,
    sellouts,
    venueRep: state.reputation.venue,
    cash: state.cash,
    loyalAct,
    goal: D.LOT_GOAL,
    met,
    goalMet: met.sellouts && met.venueRep && met.cash && met.loyalAct,
    clubUnlocked: !!(state.unlocks && state.unlocks.club),
    amphitheaterUnlocked: !!(state.unlocks && state.unlocks.amphitheater),
    festivalUnlocked: !!(state.unlocks && state.unlocks.festival),
    complete: !!(state.unlocks && state.unlocks.complete),
    tier: tierMet,
    nextShowCost: state.mode === 'sandbox' ? 0 : nextShowCost(state),
    canAffordAShow: state.mode === 'sandbox' || state.cash >= nextShowCost(state),
  };
}

function countTier(state, id, permit) {
  return state.history.filter((h) => h.venueId === id && h.attendance >= permit).length;
}

function bestRel(state, roster) {
  return Math.max(...roster.map((id) => state.reputation.artists[id] || 0));
}

function tierGoals(state) {
  const club = D.VENUES.club;
  const amp = D.VENUES.amphitheater;
  const fest = D.VENUES.festival;
  const festAttendance = state.history.filter((h) => h.venueId === 'festival').reduce((s, h) => Math.max(s, h.attendance), 0);
  return {
    club: {
      goal: D.CLUB_GOAL,
      sellouts: countTier(state, 'club', club.permit),
      loyalAct: bestRel(state, D.CLUB_ROSTER),
      met: countTier(state, 'club', club.permit) >= D.CLUB_GOAL.sellouts
        && state.reputation.venue >= D.CLUB_GOAL.venueRep
        && state.cash >= D.CLUB_GOAL.cash
        && bestRel(state, D.CLUB_ROSTER) >= D.CLUB_GOAL.loyalAct,
    },
    amphitheater: {
      goal: D.AMP_GOAL,
      sellouts: countTier(state, 'amphitheater', amp.permit),
      loyalAct: bestRel(state, D.AMP_ROSTER),
      met: countTier(state, 'amphitheater', amp.permit) >= D.AMP_GOAL.sellouts
        && state.reputation.venue >= D.AMP_GOAL.venueRep
        && state.cash >= D.AMP_GOAL.cash
        && bestRel(state, D.AMP_ROSTER) >= D.AMP_GOAL.loyalAct,
    },
    festival: {
      goal: D.FEST_GOAL,
      attendance: festAttendance,
      loyalAct: bestRel(state, D.FEST_ROSTER),
      met: festAttendance >= D.FEST_GOAL.attendance
        && state.cash >= D.FEST_GOAL.cash
        && bestRel(state, D.FEST_ROSTER) >= D.FEST_GOAL.loyalAct,
    },
  };
}

function zeroAds() {
  return Object.fromEntries(D.AD_CHANNELS.map((c) => [c, 0]));
}

// ---------------------------------------------------------------------------
// Venue layout (R-01 to R-03, R-18)

function dims(obj) {
  const t = D.OBJECT_TYPES[obj.type];
  return obj.rot % 2 ? { w: t.h, h: t.w } : { w: t.w, h: t.h };
}

export function footprint(obj) {
  const t = D.OBJECT_TYPES[obj.type];
  if (!t || t.kit) return [];
  const { w, h } = dims(obj);
  const tiles = [];
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) tiles.push([obj.x + dx, obj.y + dy]);
  return tiles;
}

function onEdge(x, y, grid) {
  return x === 0 || y === 0 || x === grid.w - 1 || y === grid.h - 1;
}

export function validateLayout(objects, venue) {
  const spec = venueSpec(venue);
  const grid = spec.grid;
  const accepted = [];
  const problems = [];
  const occupied = new Set();
  const groupCounts = {};
  let watts = 0;

  const place = spec.id === 'lot' ? 'lot' : 'room';
  const powerName = spec.id === 'lot' ? 'generator' : 'power budget';
  objects.forEach((raw, index) => {
    const reject = (message) => problems.push({ index, type: raw && raw.type, message });
    if (!isObj(raw)) return reject('Not an object');
    const t = D.OBJECT_TYPES[raw.type];
    if (!t) return reject(`Unknown object type "${raw.type}"`);
    if (t.lotOnly && spec.id !== 'lot') return reject(`${t.label} is available only on the Lot`);
    const obj = { type: raw.type, x: t.kit ? 0 : raw.x, y: t.kit ? 0 : raw.y, rot: t.kit ? 0 : raw.rot };
    if (!t.kit) {
      if (!isInt(obj.x) || !isInt(obj.y) || !isInt(obj.rot) || obj.rot < 0 || obj.rot > 3) {
        return reject(`${t.label} needs whole-number x, y and a rotation from 0 to 3`);
      }
      const tiles = footprint(obj);
      if (tiles.some(([x, y]) => x < 0 || y < 0 || x >= grid.w || y >= grid.h)) {
        return reject(`${t.label} does not fit inside the ${place}`);
      }
      if (tiles.some(([x, y]) => occupied.has(key(x, y)))) return reject(`${t.label} overlaps another object`);
      if (t.edge && !tiles.every(([x, y]) => onEdge(x, y, grid))) return reject(`${t.label} must sit on the ${place} boundary`);
    }
    if (t.group && t.max !== undefined && (groupCounts[t.group] || 0) >= t.max) {
      return reject(t.group === 'pa' ? 'Only one PA can be rented' : `Only ${t.max} ${t.label} allowed`);
    }
    if (watts + t.watts > spec.watts) {
      return reject(`${t.label} would draw ${watts + t.watts} W, over the ${spec.watts} W ${powerName}`);
    }
    footprint(obj).forEach(([x, y]) => occupied.add(key(x, y)));
    if (t.group) groupCounts[t.group] = (groupCounts[t.group] || 0) + 1;
    watts += t.watts;
    accepted.push({ obj, index });
  });

  const stage = accepted.find((a) => a.obj.type === 'stage');
  const stageTiles = new Set(stage ? footprint(stage.obj).map(([x, y]) => key(x, y)) : []);
  const final = [];
  for (const a of accepted) {
    const t = D.OBJECT_TYPES[a.obj.type];
    if (t.nextToStage) {
      const touches = footprint(a.obj).some(([x, y]) =>
        [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => stageTiles.has(key(x + dx, y + dy))));
      if (!touches) {
        problems.push({ index: a.index, type: a.obj.type, message: `${t.label} must touch the stage` });
        continue;
      }
    }
    final.push(a.obj);
  }
  problems.sort((p, q) => p.index - q.index);
  return { accepted: final, problems };
}

// New editing commands enforce fixed pillars; loading and historical evaluation keep their existing semantics.
export function validatePlacement(objects, venue) {
  const result = validateLayout(objects, venue), pillars = new Set(venueSpec(venue).pillars.map(([x, y]) => key(x, y)));
  objects.forEach((object, index) => {
    if (result.problems.some(p => p.index === index) || D.OBJECT_TYPES[object.type].kit) return;
    if (footprint(object).some(([x, y]) => pillars.has(key(x, y)))) result.problems.push({ index, type: object.type, message: `${D.OBJECT_TYPES[object.type].label} overlaps a fixed pillar` });
  });
  result.problems.sort((a, b) => a.index - b.index);
  return result;
}

function stageGeometry(stage) {
  const { w, h } = dims(stage);
  const facing = [[0, 1], [-1, 0], [0, -1], [1, 0]][stage.rot];
  const front = [
    [stage.x + w / 2, stage.y + h],
    [stage.x, stage.y + h / 2],
    [stage.x + w / 2, stage.y],
    [stage.x + w, stage.y + h / 2],
  ][stage.rot];
  return { facing, front };
}

// R-03: open tiles inside the sight cone with a clear line to the middle of the stage front
// (clear), and the cone tiles whose line is cut by a blocking object (blocked).
function sightTileSets(objects, occupied, spec) {
  const clear = new Set();
  const blocked = new Set();
  const stage = objects.find((o) => o.type === 'stage');
  if (!stage) return { clear, blocked };
  const blocking = new Set();
  for (const o of objects) {
    if (D.OBJECT_TYPES[o.type].blocksSight) footprint(o).forEach(([x, y]) => blocking.add(key(x, y)));
  }
  for (const [x, y] of spec.pillars) blocking.add(key(x, y));
  const { facing, front } = stageGeometry(stage);
  const cosHalf = Math.cos(((D.SIGHT_CONE_DEGREES / 2) * Math.PI) / 180);
  for (let y = 0; y < spec.grid.h; y += 1) {
    for (let x = 0; x < spec.grid.w; x += 1) {
      if (occupied.has(key(x, y))) continue;
      const dx = x + 0.5 - front[0];
      const dy = y + 0.5 - front[1];
      const dist = Math.hypot(dx, dy);
      if (dist === 0 || dist > D.SIGHT_RANGE) continue;
      if (dx * facing[0] + dy * facing[1] < dist * cosHalf - 1e-9) continue;
      const steps = Math.ceil(dist / 0.25);
      let cut = false;
      for (let i = 1; i < steps && !cut; i += 1) {
        const px = front[0] + (dx * i) / steps;
        const py = front[1] + (dy * i) / steps;
        if (blocking.has(key(Math.floor(px), Math.floor(py)))) cut = true;
      }
      (cut ? blocked : clear).add(key(x, y));
    }
  }
  return { clear, blocked };
}

export function sightlineTiles(venue) {
  const objects = isObj(venue) && Array.isArray(venue.objects) ? venue.objects : [];
  const spec = venueSpec(venue);
  const { accepted } = validateLayout(objects, venue);
  const occupied = new Set();
  accepted.forEach((o) => footprint(o).forEach(([x, y]) => occupied.add(key(x, y))));
  for (const [x, y] of spec.pillars) occupied.add(key(x, y));
  return sightTileSets(accepted, occupied, spec);
}

export function evaluateVenue(venue) {
  const spec = venueSpec(venue);
  const objects = isObj(venue) && Array.isArray(venue.objects) ? venue.objects : [];
  const { accepted, problems } = validateLayout(objects, venue);
  const occupied = new Set();
  accepted.forEach((o) => footprint(o).forEach(([x, y]) => occupied.add(key(x, y))));
  for (const [x, y] of spec.pillars) occupied.add(key(x, y));
  const count = (type) => accepted.filter((o) => o.type === type).length;
  const placedPa = accepted.find((o) => D.OBJECT_TYPES[o.type].paTier);
  const stats = {
    stage: count('stage'),
    paTier: placedPa ? D.OBJECT_TYPES[placedPa.type].paTier : spec.housePa,
    lights: count('lights'),
    bars: count('bar'),
    restrooms: count('restroom'),
    gates: count('gate'),
    exits: count('exit'),
    fence: count('fence'),
    watts: accepted.reduce((sum, o) => sum + D.OBJECT_TYPES[o.type].watts, 0),
    openFloorTiles: spec.grid.w * spec.grid.h - occupied.size,
    rental: spec.rental,
    permitFee: spec.permitFee,
    housePa: !!(spec.housePa && !placedPa),
    seats: spec.seats,
    permit: spec.permit,
    venueId: spec.id,
    broadcast: spec.broadcast,
    density: spec.density || D.FLOOR_DENSITY,
  };
  const sight = sightTileSets(accepted, occupied, spec);
  stats.clearTiles = sight.clear.size;
  stats.blockedTiles = sight.blocked.size;
  const perExit = spec.exitCapacity || D.EXIT_CAPACITY;
  const density = stats.density;
  const exitCap = perExit * stats.exits;
  stats.capacity = Math.min(spec.permit, Math.floor(density * stats.openFloorTiles), exitCap);
  stats.capacityLimit = stats.capacity === spec.permit ? 'permit'
    : stats.capacity === exitCap ? 'exits' : 'floor';
  stats.staff = staffFor(stats);
  const missing = [];
  if (!stats.stage) missing.push('Place the stage');
  if (!stats.paTier) missing.push('Rent a PA and place it touching the stage');
  if (!stats.fence) missing.push('Add the fence kit');
  if (!stats.gates) missing.push('Place at least one entry gate on the boundary');
  if (!stats.exits) missing.push('Place at least one exit on the boundary');
  stats.missing = missing;
  stats.problems = problems;
  stats.ready = missing.length === 0 && problems.length === 0 && stats.capacity > 0;
  return stats;
}

// R-13 required staff
export function staffFor(stats) {
  return Math.ceil(stats.capacity / D.SECURITY_PER)
    + stats.gates * D.DOOR_STAFF_PER_GATE
    + stats.bars * D.BAR_STAFF_PER_BAR;
}

// ---------------------------------------------------------------------------
// Demand (R-04 to R-08)

export function priceFactor(price, fairPrice) {
  return clamp(D.PRICE_BASE - (D.PRICE_SLOPE * price) / fairPrice, D.PRICE_FLOOR, D.PRICE_CEIL);
}

export function buzz(ads) {
  return 1 + D.AD_CHANNELS.reduce(
    (sum, c) => sum + D.AD_REACH[c] * (1 - Math.exp(-((ads && ads[c]) || 0) / D.AD_SATURATION)), 0);
}

export function demand({ draw, price, fairPrice, ads, venueRep }) {
  return draw * priceFactor(price, fairPrice) * buzz(ads) * (1 + venueRep / D.REP_DIVISOR);
}

export function presaleSplit(demandValue, buzzValue, capacity) {
  const share = Math.min(D.PRESALE_MAX, D.PRESALE_BASE + D.PRESALE_PER_BUZZ * (buzzValue - 1));
  const presale = Math.min(capacity, Math.round(demandValue * share));
  return { share, presale, walkup: Math.round(demandValue) - presale };
}

// ---------------------------------------------------------------------------
// One show, from inputs to settlement (R-04 to R-17)

export function findResponse(incidentId, responseId) {
  const incident = D.INCIDENTS[incidentId];
  return incident ? incident.responses.find((r) => r.id === responseId) || null : null;
}

// Opt-in Lot experiment: one existing bar worker covers an extra gate during the rush.
// The aggregate queue is a short rush snapshot, not individual crowd pathfinding.
export function doorRushPilot(venue, attendance, presale, choice) {
  if (choice !== 'bar' && choice !== 'gate') return null;
  const rushCapacity = venue.gates * (choice === 'gate' ? D.LOT_PILOT_GATE_MULT : 1) * D.GATE_RATE * D.LOT_PILOT_RUSH_MINUTES;
  const waiting = Math.max(0, attendance - rushCapacity);
  const lostWalkups = Math.min(Math.max(0, attendance - presale), Math.floor(waiting * D.LOT_PILOT_WALKUP_LOSS));
  return {
    choice, rushArrivals: attendance, rushAdmitted: Math.min(attendance, rushCapacity), waiting,
    lostWalkups, admitted: attendance - lostWalkups,
    barCapacity: Math.max(0, venue.bars * D.BAR_RATIO - (choice === 'gate' ? Math.ceil(D.BAR_RATIO * D.LOT_PILOT_BAR_CAPACITY_LOSS) : 0)),
  };
}

// inputs: { venue (evaluateVenue stats), deal, price, ads, venueRep, draw, artistId,
//           incidentId, responseId }. A missing incidentId means nothing went wrong.
export function evaluateShow(inputs) {
  const artist = artistFor(inputs.artistId);
  const v = inputs.venue;
  const baseResponse = inputs.incidentId ? findResponse(inputs.incidentId, inputs.responseId) : null;
  const response = baseResponse && inputs.incidentId === 'pa-dropout' && inputs.responseId === 'backup-amp' && inputs.research?.patchScore
    ? { ...baseResponse, score: Math.min(1, baseResponse.score + inputs.research.patchScore) } : baseResponse;
  const pf = priceFactor(inputs.price, artist.fairPrice);
  const bz = buzz(inputs.ads);
  const ask = isInt(inputs.ask) && inputs.ask > 0 ? inputs.ask : artist.ask;
  const drawMult = typeof inputs.drawMult === 'number' && Number.isFinite(inputs.drawMult) ? inputs.drawMult : 1;
  let dem = demand({ draw: inputs.draw * drawMult, price: inputs.price, fairPrice: artist.fairPrice, ads: inputs.ads, venueRep: inputs.venueRep });
  const baseline = presaleSplit(dem, bz, v.capacity);
  let { share, presale, walkup } = inputs.ticketing
    ? ticketingSplit(inputs.ticketing, { demand: dem, baseShare: baseline.share, capacity: v.capacity }) : baseline;
  const zoneSales = inputs.seating ? seatingSales(inputs.seating, {
    potential: demand({ draw: inputs.draw * drawMult, price: artist.fairPrice, fairPrice: artist.fairPrice, ads: inputs.ads, venueRep: inputs.venueRep }),
    capacity: v.capacity, seats: v.seats, lawnPrice: inputs.price, seatPrice: inputs.seatPrice,
    fairPrice: artist.fairPrice, presaleShare: baseline.share, walkupMult: response?.walkupMult ?? 1,
  }) : null;
  if (zoneSales) { dem = zoneSales.demand; presale = zoneSales.presale; walkup = zoneSales.walkupDemand; }
  if (inputs.stageSales) { dem = inputs.stageSales.demand; presale = inputs.stageSales.presale; walkup = dem - presale; }
  const walkupAfterIncident = inputs.stageSales ? inputs.stageSales.walkup : zoneSales ? zoneSales.walkup : Math.round(walkup * (response && response.walkupMult !== undefined ? response.walkupMult : 1));
  const plannedAttendance = Math.max(0, Math.min(v.capacity, presale + walkupAfterIncident));
  const doorRush = doorRushPilot(v, plannedAttendance, presale, inputs.pilotCrew);
  const live = inputs.services || null;
  const attendance = live ? live.admitted : doorRush ? doorRush.admitted : plannedAttendance;
  const seatPrice = isInt(inputs.seatPrice) ? inputs.seatPrice : inputs.price;
  const seated = zoneSales ? zoneSales.seats.attendance : v.seats ? Math.min(v.seats, attendance) : 0;
  const ticketGross = live ? live.ticketCash : inputs.stageSales ? inputs.stageSales.ticketGross : zoneSales ? zoneSales.ticketGross : seated * seatPrice + (attendance - seated) * inputs.price;
  const per = (supply) => (attendance > 0 ? Math.min(1, supply / attendance) : 1);
  const sanitation = live?.sanitation;
  const restroomScore = sanitation ? (sanitation.totals.requested ? sanitation.totals.served / sanitation.totals.requested : 1) : per(v.restrooms * D.RESTROOM_RATIO);
  const parts = {
    sound: v.paTier ? per(D.PA_COVERAGE[v.paTier]) * (v.lights ? 1 : D.NO_LIGHTS_MULT) : 0,
    sightlines: per(v.clearTiles * (v.density || D.FLOOR_DENSITY)),
    amenities: (per(live ? live.barServed : doorRush ? doorRush.barCapacity : v.bars * D.BAR_RATIO) + restroomScore) / 2,
    flow: (live ? (live.arrived ? live.admitted / live.arrived : 1) : doorRush ? (doorRush.rushArrivals ? doorRush.rushAdmitted / doorRush.rushArrivals : 1)
      : per(v.gates * D.GATE_RATE * D.DOORS_MINUTES)) * (!live && response && response.flowMult !== undefined ? response.flowMult : 1),
    incident: inputs.incidentId ? (response ? response.score : 0) : 1,
  };
  const weights = { sound: D.W_SOUND, sightlines: D.W_SIGHT, amenities: D.W_AMENITY, flow: D.W_FLOW, incident: D.W_INCIDENT };
  const sharedSatisfaction = Math.round(Object.keys(weights).reduce((s, k) => s + weights[k] * parts[k], 0));
  const zoneScores = zoneSales ? seatingSatisfaction(zoneSales, sharedSatisfaction) : null;
  const satisfaction = zoneScores ? zoneScores.combined : sharedSatisfaction;
  const weakest = Object.keys(weights).reduce((worst, k) =>
    (weights[k] * (1 - parts[k]) > weights[worst] * (1 - parts[worst]) ? k : worst), 'sound');

  // R-10, R-13, R-14, R-15
  const served = Math.min(attendance, doorRush ? doorRush.barCapacity : v.bars * D.BAR_RATIO);
  const bar = live ? live.barCash : Math.round(D.BAR_NET_PER_HEAD * (satisfaction / 100)
    * (served + (attendance - served) * D.BAR_SHORTFALL));
  const adSpend = D.AD_CHANNELS.reduce((s, c) => s + ((inputs.ads && inputs.ads[c]) || 0), 0);
  const costs = {
    lot: typeof v.rental === 'number' ? v.rental : D.LOT_RENTAL,
    permit: typeof v.permitFee === 'number' ? v.permitFee : D.PERMIT,
    pa: inputs.equipment || v.housePa ? 0 : (v.paTier ? D.PA_RENTAL[v.paTier] : 0),
    lights: v.lights ? D.LIGHTS_RENTAL : 0,
    bars: v.bars * D.BAR_SETUP,
    restrooms: v.restrooms * D.RESTROOM_UNIT,
    fence: D.FENCE_KIT,
    staff: staffFor(v) * D.STAFF_RATE,
    ads: adSpend,
    incident: response ? response.cost : 0,
  };
  if (inputs.facilities) costs.facilities = inputs.facilities.cost;
  if (inputs.equipment) costs.equipmentOperation = inputs.equipment.cost;
  costs.total = Object.values(costs).reduce((a, b) => a + b, 0);
  const guarantee = ask;
  const paidUpFront = inputs.deal === 'guarantee' || inputs.deal === 'sponsor';
  const artistPay = paidUpFront ? guarantee : Math.round(D.DOOR_SPLIT * Math.max(0, ticketGross - costs.total));
  const sponsor = inputs.deal === 'sponsor' ? D.SPONSOR_PAY : 0;
  const broadcast = inputs.broadcast ? attendance * D.BROADCAST_PER_HEAD : 0;
  const food = live?.food || null, foodIncome = food?.totals.houseIncome || 0;
  const ticketing = inputs.ticketing ? ticketingReceipt(inputs.ticketing, { presale, price: inputs.price }) : null;
  const net = ticketGross + bar + foodIncome + sponsor + broadcast - costs.total - artistPay - (ticketing?.fee || 0);
  const result = net >= 0 && satisfaction >= D.PASS_SATISFACTION ? 'pass' : 'retry';

  const upfront = costs.total - costs.incident + (paidUpFront ? guarantee : 0) - sponsor;

  // R-16, R-17
  const repDelta = Math.round(D.REP_SAT_SLOPE * (satisfaction - D.PASS_SATISFACTION));
  const preferenceBonus = live?.sanitation?.preference.fulfilled ? D.SANITATION_COSTS.preferenceRelationship : 0;
  const relDelta = clamp(D.REL_BASE + Math.round(D.REL_SLOPE * (artistPay / ask - 1)) + preferenceBonus, D.REL_MIN_STEP, D.REL_MAX_STEP);

  return {
    priceFactor: pf, buzz: bz, demand: dem, presaleShare: share, presale, walkup, walkupAfterIncident, attendance,
    parts, satisfaction, weakest, ticketGross, bar, costs, upfront, artistPay, net, result, repDelta, relDelta,
    ...(ticketing ? { ticketing } : {}),
    ...(zoneSales ? { seating: { ...zoneSales, scores: zoneScores, sharedSatisfaction } } : {}),
    ...(inputs.equipment ? { equipment: inputs.equipment } : {}),
    sponsor, broadcast, seated, seatPrice, doorRush, services: live, ...(food ? { food, foodIncome } : {}),
    ...(inputs.facilities ? { facilities: inputs.facilities, sanitation: live?.sanitation || null, preferenceBonus } : {}),
  };
}

function showInputs(state, venueStats, withIncident) {
  const night = state.show?.night || 1;
  const drawSeed = state.show?.run && night > 1 ? (state.seed ^ night) >>> 0 : state.seed;
  const roll = rollShow(drawSeed, state.booking.artistId), equipment = equipmentPlanFor(state), ticketing = ticketingPlanFor(state), seating = seatingPlanFor(state);
  return {
    venue: venueStats,
    ...(equipment ? { equipment } : {}),
    ...(ticketing ? { ticketing } : {}),
    ...(seating ? { seating } : {}),
    ...(state.booking.research ? { research: researchEffectsFor(state) } : {}),
    deal: state.booking.deal,
    price: state.show?.stages?.price ?? seating?.lawnPrice ?? state.promotion.price,
    ads: state.show?.stages?.ads ?? state.promotion.ads,
    // The show was sold with the reputation the venue had when the doors opened;
    // settlement changes the reputation, so a replayed sheet must not use the new one.
    venueRep: state.show && isInt(state.show.venueRep) ? state.show.venueRep : state.reputation.venue,
    draw: roll.draw,
    ask: state.booking.terms ? state.booking.terms.ask : undefined,
    drawMult: state.booking.terms ? state.booking.terms.drawMult : undefined,
    artistId: state.booking.artistId,
    seatPrice: seating?.seatPrice ?? state.promotion.seatPrice,
    broadcast: !!(venueStats && venueStats.broadcast),
    incidentId: withIncident && state.show ? state.show.incidentId : null,
    responseId: withIncident && state.show ? state.show.responseId : null,
    pilotCrew: state.show && state.venue.id === 'lot' ? state.show.pilotCrew : undefined,
    services: withIncident ? liveServicesFor(state) : null,
    facilities: sanitationPlanFor(state),
  };
}

// R-12: money due before the show, for the current choices.
export function upfrontFor(state) {
  return stageShowFor(state, false).upfront;
}

// The Promote screen's attendance range. The draw itself stays hidden.
export function forecast(state) {
  const stages = stageForecastFor(state);
  if (stages) return { ...stages.attendance, capacity: stages.capacity };
  const seating = seatingForecastFor(state);
  if (seating) return { low: seating.low.attendance, high: seating.high.attendance, capacity: seating.low.capacity };
  const artist = artistFor(state.booking.artistId);
  const v = evaluateVenue(state.venue);
  const at = (draw) => {
    const mult = state.booking.terms ? state.booking.terms.drawMult : 1;
    const dem = demand({ draw: draw * mult, price: state.promotion.price, fairPrice: artist.fairPrice, ads: state.promotion.ads, venueRep: state.reputation.venue });
    const { presale, walkup } = presaleSplit(dem, buzz(state.promotion.ads), v.capacity);
    return Math.min(v.capacity, presale + walkup);
  };
  return { low: at(artist.drawMin), high: at(artist.drawMax), capacity: v.capacity };
}

// Show night before the incident is answered: the crowd as it would be with nothing
// going wrong. Only for show-night playback; the Promote screen uses forecast().
export function showPreview(state) {
  return stageShowFor(state, false);
}

// The settlement sheet for a show whose incident has been answered.
export function settlementFor(state) {
  if (!state.show || !state.show.responseId || (state.show.services && !liveServicesFor(state).closed)) return null;
  const main = stageShowFor(state, true);
  if (main.stageAccounts) return main;
  const second = secondStage(state);
  if (!second) return main;
  return {
    ...main,
    second,
    net: main.net + second.cash,
    secondCash: second.cash,
  };
}

export function stagePlanFor(state) {
  if (state.venue.id !== 'festival') return null;
  return state.show ? state.show.stages || null : state.booking.stages || null;
}

function stageBookingTerms(raw, state) {
  const terms = festivalTerms(raw), b = state.booking;
  if (state.venue.id !== 'festival' || !D.ARTISTS[b.secondId] || b.secondId === b.artistId || !b.secondTerms || !b.terms) throw new TypeError('Invalid Festival bill');
  return terms;
}

function stageContract(raw, state) {
  const terms = stageBookingTerms(raw, state), maxPrice = venueSpec(state.venue).priceMax;
  if (!isInt(raw.price) || raw.price < D.PRICE_MIN || raw.price > maxPrice || !isObj(raw.ads)) throw new TypeError('Invalid Festival promotion');
  const ads = {};
  for (const channel of D.AD_CHANNELS) {
    const value = raw.ads[channel];
    if (!isInt(value) || value < 0 || value > D.AD_MAX_PER_CHANNEL) throw new TypeError('Invalid Festival ads');
    ads[channel] = value;
  }
  return { ...terms, price: raw.price, ads };
}

function stageAudience(state, inputs, mainDraw, secondDraw) {
  const main = artistFor(state.booking.artistId), v = inputs.venue;
  const dem = demand({ draw: mainDraw * (state.booking.terms?.drawMult || 1), price: inputs.price,
    fairPrice: main.fairPrice, ads: inputs.ads, venueRep: inputs.venueRep });
  const response = inputs.incidentId ? findResponse(inputs.incidentId, inputs.responseId) : null;
  return { capacity: v.capacity, secondCapacity: venueSpec(state.venue).secondCap,
    demand: Math.round(dem), mainDraw: Math.round(mainDraw * state.booking.terms.drawMult),
    secondDraw: Math.round(secondDraw * state.booking.secondTerms.drawMult), price: inputs.price,
    presaleShare: presaleSplit(dem, buzz(inputs.ads), v.capacity).share, walkupMult: response?.walkupMult ?? 1 };
}

function stageShowFor(state, withIncident) {
  const inputs = showInputs(state, evaluateVenue(state.venue), withIncident), terms = stagePlanFor(state);
  if (!terms) return evaluateShow(inputs);
  const secondRoll = rollShow((state.seed ^ 0x9e3779b9) >>> 0, state.booking.secondId);
  const audience = stageAudience(state, inputs, inputs.draw, secondRoll.draw);
  const main = evaluateShow({ ...inputs, stageSales: festivalSales(terms, audience) });
  const c = main.costs, v = inputs.venue;
  const accounts = festivalSettlement(terms, {
    audience,
    rig: { paTier: v.paTier || null, housePa: v.housePa, lights: !!v.lights,
      ...(inputs.equipment ? { equipmentOperation: inputs.equipment.cost } : {}) },
    siteCosts: { rental: c.lot, permit: c.permit, fence: c.fence, staff: c.staff, bars: c.bars, restrooms: c.restrooms, ads: c.ads, incident: c.incident },
    mainDeal: state.booking.deal, mainAsk: state.booking.terms.ask, bar: main.bar, broadcast: !!v.broadcast,
  });
  const relation = (pay, ask) => clamp(D.REL_BASE + Math.round(D.REL_SLOPE * (pay / ask - 1)), D.REL_MIN_STEP, D.REL_MAX_STEP);
  return { ...main, stageAccounts: accounts, attendance: accounts.sales.attendance,
    presale: accounts.sales.presale, walkupAfterIncident: accounts.sales.walkup, ticketGross: accounts.sales.ticketGross,
    costs: { ...c, mainCrew: accounts.production.main.crew, secondProduction: accounts.production.second.total, total: accounts.costs },
    upfront: accounts.upfront, artistPay: accounts.main.artistPay, artistTotal: accounts.artistPay,
    net: accounts.net, result: accounts.net >= 0 && main.satisfaction >= D.PASS_SATISFACTION ? 'pass' : 'retry',
    relDelta: relation(accounts.main.artistPay, state.booking.terms.ask),
    secondRelDelta: relation(accounts.second.artistPay, state.booking.secondTerms.ask),
  };
}

export function stageForecastFor(state) {
  const terms = stagePlanFor(state);
  if (!terms) return null;
  const inputs = showInputs(state, evaluateVenue(state.venue), false);
  const main = artistFor(state.booking.artistId), second = artistFor(state.booking.secondId), corners = [];
  for (const mainDraw of [main.drawMin, main.drawMax]) for (const secondDraw of [second.drawMin, second.drawMax]) {
    corners.push(festivalSales(terms, stageAudience(state, inputs, mainDraw, secondDraw)));
  }
  const range = values => ({ low: Math.min(...values), high: Math.max(...values) });
  return { capacity: inputs.venue.capacity, attendance: range(corners.map(x => x.attendance)),
    presale: range(corners.map(x => x.presale)), ticketGross: range(corners.map(x => x.ticketGross)),
    main: range(corners.map(x => x.main.attendance)), second: range(corners.map(x => x.second.attendance)) };
}

function secondStage(state) {
  if (!state.booking || !state.booking.secondId) return null;
  const spec = venueSpec(state.venue);
  const id = state.booking.secondId;
  const artist = artistFor(id);
  const terms = state.booking.secondTerms || termsFor(id, state.reputation.artists[id]);
  const roll = rollShow((state.seed ^ 0x9e3779b9) >>> 0, id);
  const full = evaluateVenue(state.venue);
  const cap = Math.min(full.capacity, spec.secondCap || 400);
  const small = {
    ...full,
    capacity: cap,
    seats: 0,
    rental: 0,
    permitFee: 0,
    lights: 0,
    bars: 0,
    restrooms: 0,
    fence: 0,
    gates: 1,
    exits: 1,
    housePa: true,
    paTier: full.paTier || 'M',
    clearTiles: Math.min(full.clearTiles, cap),
    broadcast: false,
    density: D.FLOOR_DENSITY,
  };
  const result = evaluateShow({
    venue: small,
    deal: 'door',
    price: artist.fairPrice,
    ads: zeroAds(),
    venueRep: state.show && isInt(state.show.venueRep) ? state.show.venueRep : state.reputation.venue,
    draw: roll.draw,
    ask: terms.ask,
    drawMult: terms.drawMult,
    artistId: id,
    incidentId: null,
    responseId: null,
    broadcast: false,
  });
  const cash = result.ticketGross + result.bar - result.artistPay;
  return {
    artistId: id, name: artist.name, attendance: result.attendance, artistPay: result.artistPay,
    ticketGross: result.ticketGross, bar: result.bar, cash,
  };
}

function savedRunCancellation(raw) {
  if (!raw) return {};
  try {
    const q = heldRunQuote(raw.terms, raw.completed);
    return q.remaining ? { runCancellation: { terms: q.terms, completed: q.completed } } : {};
  } catch { return {}; }
}

export function seatingPlanFor(state) {
  if (state.venue.id !== 'amphitheater') return null;
  return state.show ? state.show.seating || null : state.booking.seating || null;
}
export function seatingForecastFor(state) {
  const terms = seatingPlanFor(state);
  if (!terms) return null;
  const artist = artistFor(state.booking.artistId), venue = evaluateVenue(state.venue), share = presaleSplit(0, buzz(state.promotion.ads), venue.capacity).share;
  const at = draw => seatingSales(terms, {
    potential: demand({ draw: draw * (state.booking.terms?.drawMult || 1), price: artist.fairPrice, fairPrice: artist.fairPrice, ads: state.promotion.ads, venueRep: state.reputation.venue }),
    capacity: venue.capacity, seats: venue.seats, lawnPrice: terms.lawnPrice ?? state.promotion.price,
    seatPrice: terms.seatPrice ?? state.promotion.seatPrice, fairPrice: artist.fairPrice, presaleShare: share,
  });
  return { low: at(artist.drawMin), high: at(artist.drawMax) };
}

export function heldRunFor(state) {
  const source = state.show?.run || (!state.show && state.booking.run);
  return source ? heldRunQuote(source, state.show?.night || 1) : null;
}

export function ticketingPlanFor(state) {
  if (state.venue.id !== 'club') return null;
  return state.show ? state.show.ticketing || null : state.promotion.ticketing || null;
}

// Public forecast inputs only: changing the hidden show seed cannot change this quote.
export function ticketingForecastFor(state) {
  if (state.venue.id !== 'club') return null;
  const artist = artistFor(state.booking.artistId), venue = evaluateVenue(state.venue);
  const terms = ticketingPlanFor(state) || { version: 1, plan: 'direct' };
  const at = draw => {
    const dem = demand({ draw: draw * (state.booking.terms?.drawMult || 1), price: state.promotion.price,
      fairPrice: artist.fairPrice, ads: state.promotion.ads, venueRep: state.reputation.venue });
    const base = presaleSplit(dem, buzz(state.promotion.ads), venue.capacity);
    const split = ticketingSplit(terms, { demand: dem, baseShare: base.share, capacity: venue.capacity });
    return ticketingReceipt(terms, { presale: split.presale, price: state.promotion.price });
  };
  return { low: at(artist.drawMin), high: at(artist.drawMax) };
}

export function equipmentFor(state) {
  return state.equipment ? Ownership.loadOwnership(state.equipment) : null;
}

export function careerLedgerFor(state) {
  return state.cashJournal ? Journal.loadCareerLedger(state.cashJournal) : null;
}

function equipmentTerms(raw, checkpoint, requireAsset = false) {
  if (!isObj(raw) || raw.version !== 1 || !checkpoint || !isInt(raw.at) || raw.at < 0 || raw.at > checkpoint.commands.length) throw new TypeError('Invalid equipment booking');
  const owned = Ownership.loadOwnership({ version: 1, commands: checkpoint.commands.slice(0, raw.at) });
  if (raw.assetId === null && !requireAsset) return { version: 1, at: raw.at, assetId: null };
  if (!owned.assets.some(asset => asset.id === raw.assetId)) throw new TypeError('Booked equipment is not in the ownership source');
  return { version: 1, at: raw.at, assetId: raw.assetId };
}

export function equipmentPlanFor(state) {
  const marker = state.show?.equipment || state.booking?.equipment;
  if (!marker?.assetId || !state.equipment) return null;
  const terms = equipmentTerms(marker, state.equipment, true), venue = evaluateVenue(state.venue);
  return { terms, cost: D.OWNED_EQUIPMENT['small-pa'].operation, eligible: !venue.housePa && venue.paTier === 'S' };
}

// The booking stores a prefix, so later learning cannot rewrite an already sold show.
export function researchFor(state) {
  return state.research ? Research.loadResearch(state.research) : null;
}

export function researchEffectsFor(state) {
  const marker = state.booking?.research, checkpoint = state.research;
  const learned = marker?.version === 1 && checkpoint && isInt(marker.at) && marker.at >= 0 && marker.at <= checkpoint.commands.length
    ? Research.loadResearch({ ...checkpoint, commands: checkpoint.commands.slice(0, marker.at) }).learned : [];
  const venue = evaluateVenue(state.venue), live = state.show?.flow?.version === 1;
  return { learned, patchScore: learned.includes('patch') && venue.paTier ? D.RESEARCH_EFFECTS.patchScore : 0,
    barWorkerRate: learned.includes('service') && live ? D.RESEARCH_EFFECTS.barWorkerRate : 0,
    gateRate: learned.includes('admission') && live ? D.RESEARCH_EFFECTS.gateRate : 0 };
}

export function researchNightFor(state) {
  if (!state.research || !state.show) return null;
  const receipt = settlementFor(state);
  if (!receipt) return null;
  return { kind: 'night', id: `show_${state.seed}_${state.show.night || 1}`, departments: {
    production: receipt.attendance > 0 && !!evaluateVenue(state.venue).paTier,
    guestServices: (receipt.services?.barServed || 0) > 0,
    admissions: (receipt.services?.admitted || 0) > 0,
    venueOperations: receipt.attendance > 0,
  } };
}

// Live pilot specifications are derived from the booked show, never imported balances.
export function liveIncidentMinute(state) {
  const roll = rollShow(state.seed, state.booking.artistId);
  return Math.ceil(incidentAtFor(state.show.incidentId, roll.timing) * D.LIVE_SERVICES.closeAt);
}

export function liveArrivalPlan(state) {
  const surge = state.seed % D.LIVE_SERVICES.surgeEvery === 0;
  return { minutes: surge ? D.LIVE_SERVICES.surgeArrivalMinutes : D.LIVE_SERVICES.steadyArrivalMinutes, label: surge ? 'Concentrated doors rush' : 'Steady arrivals' };
}

function liveServiceSpec(state) {
  const source = { ...state, show: { ...state.show, services: undefined } };
  const preview = showPreview(source), venue = evaluateVenue(state.venue);
  const rule = D.LIVE_SERVICES, research = researchEffectsFor(state);
  const access = state.show.flow?.version === 1 ? liveAccessFor(state) : null;
  const minutes = liveArrivalPlan(state).minutes;
  const split = (n, i) => Math.floor(n * i / minutes) - Math.floor(n * (i - 1) / minutes);
  return { id: 'show_' + state.seed + '_' + (state.show.night || 1), closeAt: rule.closeAt,
    gateRate: (access?.usableGates ?? venue.gates) * (D.GATE_RATE + research.gateRate),
    barRate: rule.barBaseRate + Math.max(0, (access?.usableBars ?? venue.bars) - 1) * rule.extraBarRate,
    workerRate: rule.workerRate + research.barWorkerRate, gateWorkerRate: rule.gateWorkerRate,
    gatePatience: rule.gatePatience, barPatience: rule.barPatience, travelMinutes: rule.travelMinutes,
    ticketPrice: state.promotion.price, barNet: D.BAR_NET_PER_HEAD,
    arrivals: Array.from({ length: minutes }, (_, i) => ({ minute: i + 1,
      prepaid: split(preview.presale, i + 1), walkup: split(preview.attendance - preview.presale, i + 1) })) };
}

export function liveAccessFor(state) {
  const access = lotAccess(state.venue.objects, venueSpec(state.venue).grid);
  const floor = new Set(access.floorCells.map(p => key(p.x, p.y)));
  const connected = type => state.venue.objects.filter(o => o.type === type && footprint(o).some(([x, y]) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => floor.has(key(x + dx, y + dy)))));
  const bars = connected('bar'), vendors = connected('food');
  const restrooms = connected('restroom'), trailers = connected('trailer');
  return { ...access, bars, usableBars: bars.length, vendors, usableVendors: vendors.length, restrooms, trailers };
}

function facilityTerms(raw, locked = false) {
  if (!isObj(raw) || raw.version !== 1 || ['cleaner', 'utilities', 'preference', ...(locked ? ['trailer'] : [])].some(k => typeof raw[k] !== 'boolean')) throw new TypeError('Invalid sanitation terms');
  return { version: 1, cleaner: raw.cleaner, utilities: raw.utilities, preference: raw.preference, ...(locked ? { trailer: raw.trailer } : {}) };
}

// Quotes become locked production costs; fulfillment always uses actual geometry.
export function sanitationPlanFor(state) {
  const terms = state.show ? state.show.sanitation : state.promotion.sanitation;
  if (!terms || state.venue.id !== 'lot') return null;
  const access = liveAccessFor(state), venue = evaluateVenue(state.venue);
  const placedTrailer = state.venue.objects.some(o => o.type === 'trailer');
  const trailer = state.show ? terms.trailer : placedTrailer;
  const spec = { version: 1, portables: access.restrooms.length, portableAccess: access.restrooms.length > 0,
    trailer: placedTrailer && trailer, trailerAccess: access.trailers.length === 1,
    utilities: terms.utilities && venue.watts <= venueSpec(state.venue).watts, cleaner: terms.cleaner };
  const readyTrailer = spec.trailer && spec.trailerAccess && spec.utilities;
  const preferenceAvailable = state.booking.artistId === 'sodium-arcade' && readyTrailer && terms.cleaner;
  const charges = { trailer: trailer ? D.SANITATION_COSTS.trailer : 0, cleaner: terms.cleaner ? D.SANITATION_COSTS.cleaner : 0,
    utilities: terms.utilities ? D.SANITATION_COSTS.utilities : 0 };
  return { terms: { ...terms, trailer }, spec, charges, cost: Object.values(charges).reduce((sum, n) => sum + n, 0),
    placedPortables: venue.restrooms, usableStalls: access.restrooms.length + (readyTrailer ? SANITATION.trailerStalls : 0),
    preference: { accepted: terms.preference, available: preferenceAvailable, fulfilled: terms.preference && preferenceAvailable } };
}

export function liveServicesFor(state, { events = false } = {}) {
  if (!state.show?.services) return null;
  const run = Services.loadServices(state.show.services), summary = Services.serviceSummary(run);
  if (state.show.flow?.version !== 1) return { ...summary, ...(events ? { events: run.events } : {}) };
  const access = liveAccessFor(state), exits = access.portals.filter(p => p.type === 'exit' && p.usable);
  const departure = advanceDeparture(createDeparture(summary.admitted, exits.length), summary.closed ? state.show.flow.minute : 0);
  const flow = departureSummary(departure);
  const vendor = state.show.food ? concessionsFor(state.show.services, foodTerms(state.show.food.plan, access.usableVendors === 1)) : null;
  const food = vendor ? { terms: vendor.terms, stock: vendor.stock, totals: vendor.totals, ...(events ? { events: vendor.events } : {}) } : null;
  const plan = sanitationPlanFor(state);
  const facility = plan ? sanitationFor(state.show.services, plan.spec, vendor?.terms || null) : null;
  const sanitation = facility ? { ...plan, totals: facility.totals, stalls: facility.stalls, worker: facility.worker, ...(events ? { events: facility.events } : {}) } : null;
  const history = events ? [...run.events, ...(vendor?.events || []), ...(facility?.events.map(e => ({ ...e, entity: 'sanitation' })) || [])].sort((a, b) => a.minute - b.minute) : null;
  if (history) for (const event of departureEvents(departure)) {
    let remaining = event.result.count;
    exits.forEach((_, i) => {
      const count = Math.min(remaining, D.GUEST_FLOW.exitRate); remaining -= count;
      if (count) history.push({ ...event, id: `${run.spec.id}:${event.id}:exit:${i}`, minute: D.LIVE_SERVICES.closeAt + event.minute,
        cause: 'normal-departure', result: { count, portal: i } });
    });
  }
  return { ...summary, ...(food ? { food } : {}), ...(sanitation ? { sanitation } : {}), minute: summary.minute + departure.minute, serviceClosed: summary.closed,
    closed: summary.closed && flow.complete, inside: flow.remaining, departed: flow.departed,
    departure: { ...flow, active: summary.closed, ...(events ? { portals: exits, access } : {}) },
    ...(events ? { events: history } : {}) };
}

export function liveEndMinute(state) {
  const summary = liveServicesFor(state);
  return D.LIVE_SERVICES.closeAt + (summary?.departure?.duration || 0);
}

function serviceResponse(state, responseId) {
  const response = findResponse(state.show.incidentId, responseId);
  return { id: state.show.incidentId + ':' + responseId,
    walkupPercent: Math.round((response.walkupMult ?? 1) * 100),
    gatePercent: Math.round((response.flowMult ?? 1) * 100) };
}

export function settlementPayout(result, deal) {
  if (!result) return 0;
  // The response action has already paid the incident; do not withhold it again.
  if (result.stageAccounts) return result.stageAccounts.payout + result.stageAccounts.siteCosts.incident;
  // Sponsor money arrives before doors (it reduces upfront). Counting it again here
  // would pay the same check twice. Broadcast and the second stage arrive at settlement.
  return result.ticketGross + result.bar + (result.foodIncome || 0) + (result.broadcast || 0)
    + (result.secondCash || 0) - (result.ticketing?.fee || 0) - (deal === 'door' ? result.artistPay : 0);
}

// ---------------------------------------------------------------------------
// Actions

const fail = (state, error) => ({ state, error });

function applyRep(s, repHold, relHold) {
  s.reputation.venue = clamp(s.reputation.venue + repHold, 0, 100);
  const id = s.booking.artistId;
  s.reputation.artists[id] = clamp((s.reputation.artists[id] || 0) + relHold, -100, 100);
}

function applyUnlocks(s) {
  const p = careerProgress(s);
  if (p.goalMet) s.unlocks.club = true;
  if (s.unlocks.club && p.tier.club.met) s.unlocks.amphitheater = true;
  if (s.unlocks.amphitheater && p.tier.amphitheater.met) s.unlocks.festival = true;
  if (s.unlocks.festival && p.tier.festival.met) s.unlocks.complete = true;
}

export function applyAction(state, action) {
  const result = applyActionCore(state, action);
  if (result.error || !state.cashJournal || !result.state.cashJournal) return result;
  const next = result.state, delta = next.cash - state.cash;
  try {
    let journal = careerLedgerFor(state);
    if (journal.balance !== state.cash) throw new Error('Journal does not match available cash');
    const movements = [], reference = `show_${state.seed}_${state.show?.night || 1}`;
    if (action.type === 'acceptSettlement') {
      const payout = settlementPayout(settlementFor(state), state.booking.deal);
      if (payout) movements.push({ category: 'settlement', cashDelta: payout, reference });
      const cancellation = next.show?.cancelled ? heldRunFor(next).penalty : 0;
      if (cancellation) movements.push({ category: 'cancellation', cashDelta: -cancellation, reference });
      const opening = delta - payout + cancellation;
      if (opening) movements.push({ category: 'showOpening', cashDelta: opening, reference: `show_${next.seed}_${next.show.night}` });
    } else if (delta) {
      const category = action.type === 'equipment' ? action.command.kind === 'buy' ? 'acquisition' : 'disposal'
        : action.type === 'research' ? delta < 0 ? 'development' : 'developmentRefund'
        : action.type === 'confirmPromotion' ? 'showOpening' : action.type === 'respond' ? 'incident' : null;
      if (!category) throw new Error('Unclassified career cash movement');
      movements.push({ category, cashDelta: delta, reference: action.type === 'equipment' ? action.command.id
        : action.type === 'research' ? `research_${action.command.project}_${next.research.commands.length}` : reference });
    }
    if (movements.reduce((total, movement) => total + movement.cashDelta, 0) !== delta) throw new Error('Cash movement mismatch');
    for (const movement of movements) {
      const appended = Journal.appendCareerLedger(journal, { sequence: journal.nextSequence, ...movement });
      if (appended.error) throw new Error(appended.error);
      journal = appended.state;
    }
    if (journal.balance !== next.cash) throw new Error('Journal balance mismatch');
    next.cashJournal = Journal.saveCareerLedger(journal);
  } catch {
    // Optional history must not block paid show operations or change their cash.
    next.cashJournal = Journal.saveCareerLedger(Journal.createCareerLedger(next.cash));
    next.equipmentNotice = 'Cash journal restarted at preserved cash; earlier itemized history is incomplete';
  }
  return result;
}

function applyActionCore(state, action) {
  if (!isObj(action)) return fail(state, 'Unknown action');
  const s = clone(state);
  const need = (phase) => (s.phase === phase ? null : `That can only be done during ${phase}`);
  let err;

  switch (action.type) {
    case 'enableEquipment': {
      if (!['book', 'done'].includes(s.phase)) return fail(state, 'Equipment is available between bookings');
      if (s.equipment) return fail(state, 'Equipment ownership is already enabled');
      if (!s.history.length && s.mode !== 'sandbox') return fail(state, 'Settle your first show before enabling equipment');
      s.equipment = Ownership.saveOwnership(Ownership.createOwnership());
      s.cashJournal = Journal.saveCareerLedger(Journal.createCareerLedger(s.cash));
      return { state: s, error: null };
    }
    case 'equipment': {
      if (!['book', 'done'].includes(s.phase)) return fail(state, 'Buy and sell equipment between bookings');
      if (!s.equipment) return fail(state, 'Enable equipment ownership first');
      const result = Ownership.applyOwnership(equipmentFor(s), action.command, { cash: s.cash });
      if (result.error) return fail(state, result.error);
      s.equipment = Ownership.saveOwnership(result.state); s.cash += result.cashDelta;
      return { state: s, error: null };
    }
    case 'assignEquipment': {
      if ((err = need('build'))) return fail(state, err);
      if (!s.equipment || !s.booking.equipment) return fail(state, 'Enable equipment before booking this show');
      const terms = { ...s.booking.equipment, assetId: action.assetId };
      try { s.booking.equipment = equipmentTerms(terms, s.equipment); }
      catch { return fail(state, 'Choose an owned asset or return to rental'); }
      if (action.assetId !== null && !equipmentPlanFor(s).eligible) return fail(state, 'Place a small PA; house and medium systems cannot use this asset');
      return { state: s, error: null };
    }
    case 'enableResearch': {
      if (!['book', 'done'].includes(s.phase)) return fail(state, 'Development is available between bookings');
      if (s.research) return fail(state, 'Development is already enabled');
      if (!s.history.length && s.mode !== 'sandbox') return fail(state, 'Settle your first show before enabling development');
      s.research = Research.saveResearch(Research.createResearch(s.mode));
      return { state: s, error: null };
    }
    case 'research': {
      if (!['book', 'done'].includes(s.phase)) return fail(state, 'Development is available between bookings');
      if (!s.research) return fail(state, 'Enable development first');
      if (!['start', 'pause', 'resume', 'cancel'].includes(action.command?.kind)) return fail(state, 'Choose a development project action');
      const result = Research.applyResearch(researchFor(s), action.command, { cash: s.cash });
      if (result.error) return fail(state, result.error);
      s.research = Research.saveResearch(result.state); s.cash += result.cashDelta;
      return { state: s, error: null };
    }
    case 'chooseSideAct': {
      if ((err = need('book'))) return fail(state, err);
      if (!stageOpenersFor(s).includes(action.artistId)) return fail(state, 'Choose an eligible Festival side act');
      s.booking.secondId = action.artistId;
      s.booking.secondTerms = null;
      delete s.booking.stages;
      delete s.stagesNotice;
      return { state: s, error: null };
    }
    case 'chooseDeal': {
      if ((err = need('book'))) return fail(state, err);
      if (!DEALS.includes(action.deal) && action.deal !== 'sponsor') return fail(state, 'Choose a guarantee or a door deal');
      if (action.deal === 'sponsor' && !venueSpec(s.venue).sponsor) return fail(state, 'This room does not take a sponsor');
      const offers = offersFor(s);
      const artistId = action.artistId === undefined ? offers[0] : action.artistId;
      if (!offers.includes(artistId)) return fail(state, 'That act is not on offer for this show');
      const terms = termsFor(artistId, s.reputation.artists[artistId]);
      if (action.deal === 'door' && !terms.doorOk) {
        const a = artistFor(artistId);
        return fail(state, a.guaranteeOnly ? `${a.name} only plays for a guarantee`
          : `${a.name} will only play for a guarantee after the last door deal`);
      }
      if (artistId !== s.booking.artistId) s.promotion.price = artistFor(artistId).fairPrice;
      const spec = venueSpec(s.venue);
      const nights = spec.nights.includes(action.nights) ? action.nights : (s.booking.nights || 1);
      let secondId = null;
      let secondTerms = null;
      if (spec.secondStage && typeof action.secondId === 'string' && action.secondId !== artistId && D.ARTISTS[action.secondId]) {
        const st = termsFor(action.secondId, s.reputation.artists[action.secondId]);
        secondId = action.secondId;
        secondTerms = { ask: st.ask, drawMult: st.drawMult };
      }
      s.booking = { artistId, deal: action.deal, terms: { ask: terms.ask, drawMult: terms.drawMult }, nights: spec.nights.includes(nights) ? nights : 1, secondId, secondTerms };
      if (action.stagePolicy !== undefined) {
        if (action.stagePolicy !== 1 || !secondId || !termsFor(secondId, s.reputation.artists[secondId]).doorOk) return fail(state, 'Choose a distinct side act eligible for a door deal');
        try { s.booking.stages = stageBookingTerms({ version: 1 }, s); }
        catch { return fail(state, 'Stage accounting needs a Festival booking with two distinct acts'); }
      }
      if (action.seatingPolicy !== undefined) {
        if (action.seatingPolicy !== 1 || spec.id !== 'amphitheater') return fail(state, 'That booking cannot use separate seat sales');
        s.booking.seating = seatingTerms({ version: 1 });
      }
      if (action.runPolicy !== undefined) {
        if (action.runPolicy !== 1 || spec.id !== 'amphitheater' || s.booking.nights < 2) return fail(state, 'That booking cannot use a held-run policy');
        s.booking.run = heldRunTerms({ version: 1, nights: s.booking.nights, ask: terms.ask });
      }
      if (s.research) s.booking.research = { version: 1, at: s.research.commands.length };
      if (s.equipment) s.booking.equipment = { version: 1, at: s.equipment.commands.length, assetId: null };
      if (spec.seats) s.promotion.seatPrice = s.promotion.price + 10;
      s.phase = 'build';
      return { state: s, error: null };
    }
    case 'chooseVenue': {
      if ((err = need('book'))) return fail(state, err);
      const id = action.venueId;
      if (!D.VENUES[id]) return fail(state, 'Unknown room');
      if (!venueUnlocked(s, id)) return fail(state, 'That room is still locked');
      if (s.venue.id !== id) {
        delete s.booking.stages;
        delete s.stagesNotice;
        delete s.booking.seating;
        delete s.seatingNotice;
        delete s.booking.run;
        delete s.runNotice;
        delete s.promotion.ticketing;
        delete s.ticketingNotice;
        s.layouts[s.venue.id] = s.venue.objects;
        const spec = D.VENUES[id];
        s.venue = { id, grid: { w: spec.grid.w, h: spec.grid.h }, objects: s.layouts[id] || [] };
      }
      return { state: s, error: null };
    }
    case 'place': {
      if ((err = need('build'))) return fail(state, err);
      const o = action.object;
      if (!isObj(o)) return fail(state, 'Nothing to place');
      const obj = { type: o.type, x: o.x, y: o.y, rot: o.rot === undefined ? 0 : o.rot };
      const { problems } = validatePlacement([...s.venue.objects, obj], s.venue);
      const mine = problems.find((p) => p.index === s.venue.objects.length);
      if (mine) return fail(state, mine.message);
      const t = D.OBJECT_TYPES[obj.type];
      s.venue.objects.push(t.kit ? { type: obj.type, x: 0, y: 0, rot: 0 } : obj);
      return { state: s, error: null };
    }
    case 'setLayout': {
      if ((err = need('build'))) return fail(state, err);
      if (!Array.isArray(action.objects)) return fail(state, 'A layout is a list of objects');
      const objects = action.objects.map((o) => (isObj(o) ? { type: o.type, x: o.x, y: o.y, rot: o.rot === undefined ? 0 : o.rot } : o));
      const { accepted, problems } = validatePlacement(objects, s.venue);
      if (problems.length) return fail(state, problems[0].message);
      s.venue.objects = accepted;
      return { state: s, error: null };
    }
    case 'remove': {
      if ((err = need('build'))) return fail(state, err);
      if (!isInt(action.index) || action.index < 0 || action.index >= s.venue.objects.length) {
        return fail(state, 'No object at that position in the list');
      }
      s.venue.objects.splice(action.index, 1);
      return { state: s, error: null };
    }
    case 'confirmBuild': {
      if ((err = need('build'))) return fail(state, err);
      const v = evaluateVenue(s.venue);
      if (!v.ready) return fail(state, [...v.missing, ...v.problems.map((p) => p.message)].join('; ') || 'The venue has no capacity');
      s.phase = 'promote';
      return { state: s, error: null };
    }
    case 'setPromotion': {
      if ((err = need('promote'))) return fail(state, err);
      const spec = venueSpec(s.venue);
      const price = action.price === undefined ? s.promotion.price : action.price;
      const priceMax = spec.priceMax || D.PRICE_MAX;
      if (!isInt(price) || price < D.PRICE_MIN || price > priceMax) {
        return fail(state, `Ticket price must be a whole number from ${D.PRICE_MIN} to ${priceMax}`);
      }
      const ads = { ...s.promotion.ads, ...(isObj(action.ads) ? action.ads : {}) };
      for (const c of Object.keys(ads)) {
        if (!D.AD_CHANNELS.includes(c)) return fail(state, `Unknown ad channel "${c}"`);
        if (!isInt(ads[c]) || ads[c] < 0 || ads[c] > D.AD_MAX_PER_CHANNEL) {
          return fail(state, `Ad spend must be a whole number from 0 to ${D.AD_MAX_PER_CHANNEL}`);
        }
      }
      s.promotion.price = price;
      s.promotion.ads = ads;
      if (action.services !== undefined) {
        if (typeof action.services !== 'boolean' || (action.services && s.venue.id !== 'lot')) return fail(state, 'Choose live services only for the Lot');
        s.promotion.liveServices = action.services;
      }
      if (action.foodPlan !== undefined) {
        if (s.venue.id !== 'lot' || (action.foodPlan !== null && !Object.hasOwn(FOOD_PLANS, action.foodPlan))) return fail(state, 'Choose a valid Lot food plan');
        s.promotion.foodPlan = action.foodPlan;
      }
      if (action.ticketing !== undefined) {
        if (s.venue.id !== 'club') return fail(state, 'Ticketing options are available in Fathom Hall');
        try { s.promotion.ticketing = action.ticketing === null ? null : ticketingTerms(action.ticketing); }
        catch { return fail(state, 'Choose valid ticketing terms'); }
        delete s.ticketingNotice;
      }
      if (action.sanitation !== undefined) {
        if (s.venue.id !== 'lot') return fail(state, 'Sanitation trial is available in the Lot');
        try { s.promotion.sanitation = action.sanitation === null ? null : facilityTerms(action.sanitation); }
        catch { return fail(state, 'Choose valid sanitation terms'); }
      }
      if (spec.seats && action.seatPrice !== undefined) {
        if (!isInt(action.seatPrice) || action.seatPrice < D.PRICE_MIN || action.seatPrice > priceMax) {
          return fail(state, `Seat price must be a whole number from ${D.PRICE_MIN} to ${priceMax}`);
        }
        s.promotion.seatPrice = action.seatPrice;
      }
      return { state: s, error: null };
    }
    case 'confirmPromotion': {
      if ((err = need('promote'))) return fail(state, err);
      const useServices = action.services === undefined ? s.promotion.liveServices === true : action.services === true;
      if (useServices && (action.pilot === true || s.venue.id !== 'lot' || !evaluateVenue(s.venue).bars)) {
        return fail(state, 'Live services needs the Lot and a bar, without the doors snapshot');
      }
      if (action.flow !== undefined && action.flow !== 1) return fail(state, 'Unknown live flow version');
      if (action.flow === 1) {
        if (!useServices) return fail(state, 'Normal departure requires live services');
        const access = liveAccessFor(s);
        if (!access.usableGates || !access.usableExits || !access.usableBars) return fail(state, 'Connect admission, a bar and an exit to the main audience floor before opening doors');
      }
      if (s.promotion.foodPlan && (!useServices || action.flow !== 1 || liveAccessFor(s).usableVendors !== 1)) return fail(state, 'Food needs live services and one connected stall before doors');
      const equipment = equipmentPlanFor(s);
      if (equipment && !equipment.eligible) return fail(state, 'The assigned asset needs a placed small PA before doors');
      const facilities = sanitationPlanFor(s);
      if (s.venue.objects.some(o => o.type === 'trailer') && !facilities) return fail(state, 'Enable sanitation for the placed trailer before doors');
      if (facilities) {
        if (!useServices || action.flow !== 1) return fail(state, 'Sanitation needs the live Lot clock');
        if (!facilities.usableStalls) return fail(state, 'Connect usable sanitation before doors; the trailer also needs utilities');
        if (facilities.terms.utilities && !facilities.terms.trailer) return fail(state, 'Utilities need a placed trailer');
        if (facilities.terms.preference && !facilities.preference.available) return fail(state, 'The optional changing area needs Sodium Arcade, a connected powered trailer and a cleaner');
      }
      const upfront = upfrontFor(s);
      if (s.mode !== 'sandbox' && upfront > s.cash) return fail(state, `This show needs $${upfront} before doors, but you have $${s.cash}`);
      s.cash -= upfront;
      s.promotion.confirmed = true;
      const incidentId = incidentFor(s.seed, s.booking.artistId, s.venue, s.forcedIncident, 1);
      s.show = { incidentId, responseId: null, venueRep: s.reputation.venue, night: 1, repHold: 0, relHold: 0 };
      if (equipment) s.show.equipment = equipment.terms;
      if (s.booking.seating) s.show.seating = seatingContract({ ...s.booking.seating, lawnPrice: s.promotion.price, seatPrice: s.promotion.seatPrice });
      if (s.booking.stages) s.show.stages = stageContract({ ...s.booking.stages, price: s.promotion.price, ads: s.promotion.ads }, s);
      if (s.booking.run) s.show.run = heldRunTerms(s.booking.run);
      if (s.venue.id === 'club' && s.promotion.ticketing) s.show.ticketing = ticketingTerms(s.promotion.ticketing);
      const v = evaluateVenue(s.venue);
      if (action.pilot === true && s.venue.id === 'lot' && v.bars > 0 && v.gates > 0) s.show.pilotCrew = null;
      if (useServices || s.promotion.liveServices !== undefined) s.promotion.liveServices = useServices;
      if (action.flow === 1) s.show.flow = { version: 1, minute: 0 };
      if (facilities) s.show.sanitation = facilityTerms(facilities.terms, true);
      if (s.promotion.foodPlan) s.show.food = { version: 1, plan: s.promotion.foodPlan };
      if (useServices) s.show.services = Services.saveServices(Services.createServices(liveServiceSpec(s)));
      s.phase = 'show';
      return { state: s, error: null };
    }
    case 'chooseDoorCrew': {
      if ((err = need('show'))) return fail(state, err);
      if (!s.show || s.show.pilotCrew !== null) return fail(state, 'There is no doors choice to make');
      if (action.choice !== 'bar' && action.choice !== 'gate') return fail(state, 'Choose bar service or admission');
      s.show.pilotCrew = action.choice;
      return { state: s, error: null };
    }
    case 'advanceLive': {
      if ((err = need('show'))) return fail(state, err);
      if (!s.show.services) return fail(state, 'Live services is not enabled for this show');
      const current = liveServicesFor(s).minute;
      if (!isInt(action.minute) || action.minute < current || action.minute > liveEndMinute(s)) return fail(state, 'Choose a future whole minute within this show’s timeline');
      const minute = s.show.responseId ? action.minute : Math.min(action.minute, liveIncidentMinute(s));
      s.show.services = Services.saveServices(Services.advanceServices(Services.loadServices(s.show.services), Math.min(D.LIVE_SERVICES.closeAt, minute)));
      if (s.show.flow) s.show.flow.minute = Math.max(0, minute - D.LIVE_SERVICES.closeAt);
      if (s.show.responseId && liveServicesFor(s).closed) s.phase = 'settle';
      return { state: s, error: null };
    }
    case 'assignLiveWorker': {
      if ((err = need('show'))) return fail(state, err);
      if (!s.show.services) return fail(state, 'Live services is not enabled for this show');
      const result = Services.assignServiceWorker(Services.loadServices(s.show.services), action.station);
      if (result.error) return fail(state, result.error);
      s.show.services = Services.saveServices(result.state);
      return { state: s, error: null };
    }
    case 'respond': {
      if ((err = need('show'))) return fail(state, err);
      if (s.show && s.show.pilotCrew === null) return fail(state, 'Choose where the doors crew works first');
      if (s.show.responseId) return fail(state, 'The incident response is already recorded');
      if (s.show.services && s.show.services.minute < liveIncidentMinute(s)) return fail(state, 'The incident has not happened yet');
      const response = findResponse(s.show.incidentId, action.responseId);
      if (!response) return fail(state, 'That response does not fit this incident');
      if (response.cost > s.cash) return fail(state, `${response.label} costs $${response.cost}; you have $${s.cash}`);
      s.cash -= response.cost;
      s.show.responseId = response.id;
      if (s.show.services) {
        const run = Services.loadServices(s.show.services);
        s.show.services = Services.saveServices(Services.applyServiceResponse(run, serviceResponse(s, response.id)).state);
      }
      s.phase = s.show.services && !liveServicesFor(s).closed ? 'show' : 'settle';
      return { state: s, error: null };
    }
    case 'acceptSettlement': {
      if ((err = need('settle'))) return fail(state, err);
      const r = settlementFor(s);
      const run = heldRunFor(s), cancel = action.cancelRemaining === true;
      if (action.cancelRemaining !== undefined && typeof action.cancelRemaining !== 'boolean') return fail(state, 'Choose whether to cancel the remaining nights');
      if (cancel && (!run || !run.remaining)) return fail(state, 'There are no contracted remaining nights to cancel');
      const signingCash = s.cash + settlementPayout(r, s.booking.deal);
      if (run?.remaining && !cancel && s.mode !== 'sandbox' && upfrontFor(s) > signingCash) {
        return fail(state, `Next night needs $${upfrontFor(s)}; signing leaves $${signingCash}. Choose cancellation for $${run.penalty} to end the run.`);
      }
      s.cash = signingCash - (cancel ? run.penalty : 0);
      if (cancel) s.show.cancelled = true;
      if (s.research) {
        const progress = Research.applyResearch(researchFor(s), researchNightFor(s), { cash: s.cash });
        if (!progress.error) s.research = Research.saveResearch(progress.state);
        else s.researchNotice = progress.error;
      }
      const night = s.show.night || 1;
      const nights = run?.terms.nights || s.booking.nights || 1;
      s.history.push({
        showId: s.history.length + 1,
        cashAfter: s.cash,
        ...(cancel ? { runCancellation: { terms: run.terms, completed: night } } : {}),
        seed: s.seed,
        deal: s.booking.deal,
        attendance: r.attendance,
        satisfaction: r.satisfaction,
        net: r.net,
        artistPay: r.artistTotal ?? r.artistPay,
        result: r.result,
        weakest: r.weakest,
        settledAt: typeof action.at === 'string' ? action.at : null,
        venueId: s.venue.id,
        night,
      });
      const repHold = (s.show.repHold || 0) + r.repDelta;
      const relHold = (s.show.relHold || 0) + r.relDelta;
      if (night < nights && !cancel) {
        const upfront = upfrontFor(s);
        if (s.mode !== 'sandbox' && upfront > s.cash) {
          applyRep(s, repHold, relHold);
          applyUnlocks(s);
          s.phase = 'done';
          return { state: s, error: null };
        }
        s.cash -= upfront;
        const nextNight = night + 1;
        s.show = {
          night: nextNight,
          incidentId: incidentFor(s.seed, s.booking.artistId, s.venue, s.forcedIncident, nextNight),
          responseId: null,
          venueRep: s.show.venueRep,
          repHold,
          relHold,
          ...(s.show.equipment ? { equipment: clone(s.show.equipment) } : {}),
          ...(s.show.seating ? { seating: clone(s.show.seating) } : {}),
          ...(s.show.run ? { run: clone(s.show.run) } : {}),
        };
        s.phase = 'show';
        return { state: s, error: null };
      }
      applyRep(s, repHold, relHold);
      if (r.stageAccounts) {
        const id = s.booking.secondId;
        s.reputation.artists[id] = clamp((s.reputation.artists[id] || 0) + r.secondRelDelta, -100, 100);
      }
      applyUnlocks(s);
      s.phase = 'done';
      return { state: s, error: null };
    }
    case 'back': {
      if (s.phase === 'build') s.phase = 'book';
      else if (s.phase === 'promote') s.phase = 'build';
      else return fail(state, 'You can only go back from Build or Promote');
      return { state: s, error: null };
    }
    case 'nextShow':
    case 'retry': {
      if ((err = need('done'))) return fail(state, err);
      // R-21: a career carries on after a bad night; it ends only when the next show is unaffordable.
      if (action.type === 'nextShow' && s.mode !== 'sandbox' && s.cash < nextShowCost(s)) {
        return fail(state, `The next show needs at least $${nextShowCost(s)} before doors and you have $${s.cash}. Start over to try again.`);
      }
      if (action.type === 'retry' && s.mode === 'scenario') {
        return { state: createGame(nextSeed(s.seed), { mode: 'scenario', scenario: s.scenario }), error: null };
      }
      const fresh = createGame(nextSeed(s.seed), { mode: s.mode, scenario: s.scenario });
      fresh.venue = s.venue;
      fresh.layouts = s.layouts || fresh.layouts;
      if (action.type === 'nextShow') {
        fresh.cash = s.cash;
        fresh.reputation = s.reputation;
        fresh.unlocks = s.unlocks;
        fresh.history = s.history;
        if (s.equipment) fresh.equipment = clone(s.equipment);
        if (s.cashJournal) fresh.cashJournal = clone(s.cashJournal);
        if (s.equipmentNotice) fresh.equipmentNotice = s.equipmentNotice;
        if (s.research) fresh.research = clone(s.research);
        if (s.researchNotice) fresh.researchNotice = s.researchNotice;
        if (s.mode === 'sandbox') fresh.cash = s.cash;
      }
      const first = offersFor(fresh)[0];
      fresh.booking.artistId = first;
      fresh.promotion.price = artistFor(first).fairPrice;
      return { state: fresh, error: null };
    }
    default:
      return fail(state, `Unknown action "${action.type}"`);
  }
}

// ---------------------------------------------------------------------------
// Save validation (SAVE_FORMAT.md). Runs on every load and import.

function supportsPhase(s, phase) {
  const venueReady = () => evaluateVenue(s.venue).ready;
  switch (phase) {
    case 'book': return true;
    case 'build': return s.booking.deal !== null;
    case 'promote': return s.booking.deal !== null && venueReady();
    case 'show': return supportsPhase(s, 'promote') && s.promotion.confirmed && s.show !== null;
    case 'settle': return supportsPhase(s, 'show') && s.show.responseId !== null && (!s.show.services || liveServicesFor(s).closed);
    case 'done': return supportsPhase(s, 'settle') && s.history.length > 0;
    default: return false;
  }
}

const intOr = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback);

// ---------------------------------------------------------------------------
// Save migration (SAVE_FORMAT.md). Pure: returns a stored state of any known version in
// the current version, or the input unchanged when it is not a recognisable save (so
// normalizeState can reject it). Applied one version at a time.

export function migrateSave(raw) {
  if (!isObj(raw) || !isInt(raw.schema)) return raw;
  let s = raw;
  if (s.schema === 1) s = migrateV1toV2(s);
  return s;
}

// Version 2 retuned tier 1 to the Lot (CT-DEC-09) by halving every per-person and money
// value, so a version 1 save converts the same way: cash, ad spend and the history's
// attendance and money halve. Version 2 also renamed Velvet Static (a real band's name) to
// Sodium Arcade, so the artist's id moves with its relationship. A finished show is closed with
// Next show, which R-21 opens after any night, or Start over when the next show is
// unaffordable, so a sheet signed at the old scale is never replayed at the new one.
function migrateV1toV2(raw) {
  const half = (n) => (isInt(n) ? Math.round(n / 2) : n);
  const s = clone(raw);
  s.schema = 2;
  s.cash = half(s.cash);
  const renamed = { 'velvet-static': 'sodium-arcade' };
  if (isObj(s.booking) && renamed[s.booking.artistId]) s.booking.artistId = renamed[s.booking.artistId];
  if (isObj(s.reputation) && isObj(s.reputation.artists)) {
    s.reputation.artists = Object.fromEntries(Object.entries(s.reputation.artists).map(([id, v]) => [renamed[id] || id, v]));
  }
  if (isObj(s.promotion) && isObj(s.promotion.ads)) {
    for (const c of Object.keys(s.promotion.ads)) s.promotion.ads[c] = half(s.promotion.ads[c]);
  }
  if (Array.isArray(s.history)) {
    s.history = s.history.map((h) => (isObj(h)
      ? { ...h, attendance: half(h.attendance), net: half(h.net), artistPay: half(h.artistPay) } : h));
  }
  if (s.phase !== 'done') return s;
  const state = normalizeState(s, isInt(s.seed) ? s.seed : 1);
  if (state.phase !== 'done') return state;
  const next = applyAction(state, { type: 'nextShow' });
  if (!next.error) return next.state;
  const over = applyAction(state, { type: 'retry' });
  return over.error ? state : over.state;
}

export function normalizeState(raw, fallbackSeed = 1) {
  if (!isObj(raw) || raw.schema !== D.SCHEMA_VERSION) return createGame(fallbackSeed);
  const s = createGame(isInt(raw.seed) && raw.seed >= 0 && raw.seed <= 0xffffffff ? raw.seed : fallbackSeed);

  s.cash = clamp(intOr(raw.cash, D.START_CASH), -1e9, 1e9);

  const rawObjects = isObj(raw.venue) && Array.isArray(raw.venue.objects) ? raw.venue.objects.slice(0, 1000) : [];
  if (isObj(raw.venue) && D.VENUES[raw.venue.id]) {
    const spec = D.VENUES[raw.venue.id];
    s.venue = { id: spec.id, grid: { w: spec.grid.w, h: spec.grid.h }, objects: [] };
  }
  s.venue.objects = validateLayout(rawObjects.map((o) => (isObj(o)
    ? { type: o.type, x: o.x, y: o.y, rot: o.rot === undefined ? 0 : o.rot } : o)), s.venue).accepted;

  const booking = isObj(raw.booking) ? raw.booking : {};
  if (typeof booking.artistId === 'string' && D.ARTISTS[booking.artistId]) s.booking.artistId = booking.artistId;
  s.booking.deal = DEALS.includes(booking.deal) || booking.deal === 'sponsor' ? booking.deal : null;
  // Terms arrived with the Lot career; a booking made before them has none and uses the act's
  // base ask and draw, as it did when it was made. An ask below $1 is dropped the same way:
  // settlement divides by it (R-17).
  const terms = isObj(booking.terms) ? booking.terms : null;
  if (s.booking.deal && terms && isInt(terms.ask) && terms.ask > 0 && typeof terms.drawMult === 'number' && Number.isFinite(terms.drawMult)) {
    s.booking.terms = { ask: clamp(terms.ask, 1, 1e6), drawMult: clamp(terms.drawMult, 0.5, 1.5) };
  }
  s.unlocks.club = isObj(raw.unlocks) && raw.unlocks.club === true;
  s.unlocks.amphitheater = isObj(raw.unlocks) && raw.unlocks.amphitheater === true;
  s.unlocks.festival = isObj(raw.unlocks) && raw.unlocks.festival === true;
  s.unlocks.complete = isObj(raw.unlocks) && raw.unlocks.complete === true;
  if (raw.mode === 'sandbox' || raw.mode === 'scenario') s.mode = raw.mode;
  if (s.mode === 'scenario') {
    s.scenario = 'wet-lot';
    s.forcedIncident = 'rain';
  }
  if (raw.research !== undefined) {
    try {
      const research = Research.loadResearch(raw.research);
      if (research.mode !== s.mode) throw new Error('Development mode mismatch');
      s.research = Research.saveResearch(research);
      if (booking.research?.version === 1 && isInt(booking.research.at) && booking.research.at >= 0 && booking.research.at <= research.commands.length) {
        s.booking.research = { version: 1, at: booking.research.at };
      } else if (booking.research !== undefined) s.researchNotice = 'Invalid booking development was removed';
      if (research.commands.length >= Research.RESEARCH_COMMAND_LIMIT) s.researchNotice = 'Research history is full; no new development command was applied';
    } catch {
      s.research = Research.saveResearch(Research.createResearch(s.mode));
      s.researchNotice = 'Invalid development was reset; cash was preserved';
    }
  }
  if (raw.equipment !== undefined) {
    try { s.equipment = Ownership.saveOwnership(Ownership.loadOwnership(raw.equipment)); }
    catch {
      s.equipment = Ownership.saveOwnership(Ownership.createOwnership());
      s.equipmentNotice = 'Invalid ownership was cleared; cash was preserved';
    }
    if (booking.equipment !== undefined) {
      try { s.booking.equipment = equipmentTerms(booking.equipment, s.equipment); }
      catch { s.equipmentNotice = 'Invalid booked equipment was removed; cash was preserved'; }
    }
    try {
      const journal = Journal.loadCareerLedger(raw.cashJournal);
      if (journal.balance !== s.cash) throw new Error('Journal mismatch');
      s.cashJournal = Journal.saveCareerLedger(journal);
    } catch {
      s.cashJournal = Journal.saveCareerLedger(Journal.createCareerLedger(s.cash));
      s.equipmentNotice = 'Cash journal restarted at preserved cash; earlier itemized history is incomplete';
    }
    if (typeof raw.equipmentNotice === 'string' && raw.equipmentNotice) s.equipmentNotice ||= 'Earlier equipment or journal recovery left incomplete history';
  }
  const room = venueSpec(s.venue);
  if (s.booking.deal === 'sponsor' && !room.sponsor) s.booking.deal = null;
  s.booking.nights = room.nights.includes(booking.nights) ? booking.nights : 1;
  if (booking.seating !== undefined) {
    try {
      if (room.id !== 'amphitheater') throw new TypeError('Wrong seating room');
      s.booking.seating = seatingTerms(booking.seating);
    } catch { s.seatingNotice = 'Invalid seat sales booking removed; cash was preserved'; }
  }
  if (typeof raw.seatingNotice === 'string' && raw.seatingNotice) s.seatingNotice ||= 'Earlier seat sales recovery preserved cash; original terms may be incomplete';
  if (booking.run !== undefined) {
    try {
      const terms = heldRunTerms(booking.run);
      if (room.id !== 'amphitheater' || terms.nights !== s.booking.nights || terms.ask !== s.booking.terms?.ask) throw new TypeError('Mismatched run');
      s.booking.run = terms;
    } catch { s.runNotice = 'Invalid held-run booking removed; cash was preserved'; }
  }
  if (typeof raw.runNotice === 'string' && raw.runNotice) s.runNotice ||= 'Earlier held-run recovery preserved cash; original terms may be incomplete';
  if (room.secondStage && typeof booking.secondId === 'string' && D.ARTISTS[booking.secondId]) {
    s.booking.secondId = booking.secondId;
    const st = isObj(booking.secondTerms) ? booking.secondTerms : null;
    if (st && isInt(st.ask) && st.ask > 0 && typeof st.drawMult === 'number' && Number.isFinite(st.drawMult)) {
      s.booking.secondTerms = { ask: clamp(st.ask, 1, 1e6), drawMult: clamp(st.drawMult, 0.5, 1.5) };
    }
  }
  if (booking.stages !== undefined) {
    try { s.booking.stages = stageBookingTerms(booking.stages, s); }
    catch { s.stagesNotice = 'Invalid Festival booking policy removed; cash and history were preserved'; }
  }
  if (typeof raw.stagesNotice === 'string' && raw.stagesNotice) s.stagesNotice ||= 'Earlier Festival recovery preserved cash; original terms may be incomplete';
  if (isObj(raw.layouts)) {
    for (const id of D.VENUE_ORDER) {
      if (!Array.isArray(raw.layouts[id])) continue;
      const spec = D.VENUES[id];
      const asVenue = { id, grid: { w: spec.grid.w, h: spec.grid.h }, objects: [] };
      s.layouts[id] = validateLayout(raw.layouts[id].map((o) => (isObj(o)
        ? { type: o.type, x: o.x, y: o.y, rot: o.rot === undefined ? 0 : o.rot } : o)), asVenue).accepted;
    }
  }

  const promo = isObj(raw.promotion) ? raw.promotion : {};
  s.promotion.price = clamp(intOr(promo.price, artistFor(s.booking.artistId).fairPrice), D.PRICE_MIN, room.priceMax || D.PRICE_MAX);
  const ads = isObj(promo.ads) ? promo.ads : {};
  for (const c of D.AD_CHANNELS) s.promotion.ads[c] = clamp(intOr(ads[c], 0), 0, D.AD_MAX_PER_CHANNEL);
  s.promotion.confirmed = promo.confirmed === true;
  if (room.id === 'lot' && typeof promo.liveServices === 'boolean') s.promotion.liveServices = promo.liveServices;
  if (room.id === 'lot' && (promo.foodPlan === null || Object.hasOwn(FOOD_PLANS, promo.foodPlan))) s.promotion.foodPlan = promo.foodPlan;
  if (room.id === 'lot' && promo.sanitation !== undefined) {
    try { s.promotion.sanitation = promo.sanitation === null ? null : facilityTerms(promo.sanitation); } catch { s.promotion.sanitation = null; }
  }
  if (promo.ticketing !== undefined) {
    try {
      if (room.id !== 'club') throw new TypeError('Wrong ticketing room');
      s.promotion.ticketing = promo.ticketing === null ? null : ticketingTerms(promo.ticketing);
    } catch { s.ticketingNotice = 'Invalid ticketing selection removed; cash was preserved'; }
  }
  if (typeof raw.ticketingNotice === 'string' && raw.ticketingNotice) s.ticketingNotice ||= 'Earlier ticketing recovery preserved cash; original terms may be incomplete';
  if (room.seats) s.promotion.seatPrice = clamp(intOr(promo.seatPrice, s.promotion.price + 10), D.PRICE_MIN, room.priceMax || D.PRICE_MAX);

  const rep = isObj(raw.reputation) ? raw.reputation : {};
  s.reputation.venue = clamp(intOr(rep.venue, 0), 0, 100);
  const rel = isObj(rep.artists) ? rep.artists : {};
  for (const id of Object.keys(D.ARTISTS)) s.reputation.artists[id] = clamp(intOr(rel[id], 0), -100, 100);

  if (Array.isArray(raw.history)) {
    s.history = raw.history.filter(isObj).slice(-200).map((h, i) => ({
      showId: i + 1,
      ...(Number.isSafeInteger(h.cashAfter) ? { cashAfter: h.cashAfter } : {}),
      ...savedRunCancellation(h.runCancellation),
      seed: isInt(h.seed) ? h.seed >>> 0 : 0,
      deal: DEALS.includes(h.deal) || h.deal === 'sponsor' ? h.deal : null,
      attendance: intOr(h.attendance, 0),
      satisfaction: clamp(intOr(h.satisfaction, 0), 0, 100),
      net: intOr(h.net, 0),
      artistPay: intOr(h.artistPay, 0),
      result: h.result === 'pass' ? 'pass' : 'retry',
      weakest: typeof h.weakest === 'string' ? h.weakest : null,
      settledAt: typeof h.settledAt === 'string' ? h.settledAt : null,
      venueId: D.VENUES[h.venueId] ? h.venueId : 'lot',
      night: isInt(h.night) && h.night > 0 ? h.night : 1,
    }));
  }

  // The incident is re-derived from the seed, never read from the save.
  if (isObj(raw.show)) {
    const night = isInt(raw.show.night) && raw.show.night > 0 ? raw.show.night : 1;
    const incidentId = incidentFor(s.seed, s.booking.artistId, s.venue, s.forcedIncident, night);
    s.show = {
      incidentId,
      responseId: findResponse(incidentId, raw.show.responseId) ? raw.show.responseId : null,
      venueRep: clamp(intOr(raw.show.venueRep, s.reputation.venue), 0, 100),
      night: isInt(raw.show.night) && raw.show.night > 0 ? raw.show.night : 1,
      repHold: intOr(raw.show.repHold, 0),
      relHold: intOr(raw.show.relHold, 0),
    };
    if (raw.show.seating !== undefined) {
      try {
        if (room.id !== 'amphitheater') throw new TypeError('Wrong seating room');
        const terms = seatingContract(raw.show.seating);
        if ([terms.lawnPrice, terms.seatPrice].some(price => price < D.PRICE_MIN || price > room.priceMax)) throw new TypeError('Invalid locked price');
        s.show.seating = terms;
      } catch { s.seatingNotice = 'Invalid paid seat sales terms removed; cash and signed history were preserved'; }
    }
    if (raw.show.stages !== undefined) {
      try { s.show.stages = stageContract(raw.show.stages, s); }
      catch { s.stagesNotice = 'Invalid paid Festival terms removed; cash and signed history were preserved'; }
    }
    if (raw.show.run !== undefined) {
      try {
        if (room.id !== 'amphitheater') throw new TypeError('Wrong held-run room');
        const quote = heldRunQuote(raw.show.run, s.show.night);
        s.show.run = quote.terms;
        if (raw.phase === 'done' && raw.show.cancelled === true && quote.remaining) s.show.cancelled = true;
      } catch { s.runNotice = 'Invalid held-run show terms removed; cash and signed history were preserved'; }
    }
    if (raw.show.ticketing !== undefined) {
      try {
        if (room.id !== 'club') throw new TypeError('Wrong ticketing room');
        s.show.ticketing = ticketingTerms(raw.show.ticketing);
      } catch { s.ticketingNotice = 'Invalid paid ticketing terms removed; cash and signed history were preserved'; }
    }
    if (raw.show.equipment !== undefined) {
      try { s.show.equipment = equipmentTerms(raw.show.equipment, s.equipment, true); }
      catch { s.equipmentNotice = 'Invalid paid equipment terms were removed; cash and signed history were preserved'; }
    }
    if (s.venue.id === 'lot' && s.venue.objects.some((o) => o.type === 'bar')
      && Object.prototype.hasOwnProperty.call(raw.show, 'pilotCrew')) {
      s.show.pilotCrew = raw.show.pilotCrew === 'bar' || raw.show.pilotCrew === 'gate' ? raw.show.pilotCrew : null;
    }
  }

  if (s.show && s.venue.id === 'lot' && s.venue.objects.some(o => o.type === 'bar') && isObj(raw.show?.services)) {
    if (raw.show.flow !== undefined) { s.show.flow = { version: 1, minute: 0 }; if (raw.show.flow?.version !== 1) s.show.serviceRecovered = true; }
    const spec = liveServiceSpec(s), stored = raw.show.services;
    try {
      if (!Array.isArray(stored.commands)) throw new Error('Missing service commands');
      const commands = stored.commands.map(command => {
        if (command?.kind !== 'response') return command;
        if (!s.show.responseId || command.minute < liveIncidentMinute(s)) throw new Error('Invalid service response timing');
        return { ...command, response: serviceResponse(s, s.show.responseId) };
      });
      const minute = s.show.responseId ? stored.minute : Math.min(stored.minute, liveIncidentMinute(s));
      const run = Services.loadServices({ ...stored, spec, commands, minute });
      if (!!s.show.responseId !== !!run.response) throw new Error('Missing service response');
      s.show.services = Services.saveServices(run);
    } catch {
      // Retain already-paid response costs and restart only the invalid service timeline.
      s.show.serviceRecovered = true;
      let run = Services.createServices(spec);
      if (s.show.responseId) {
        run = Services.advanceServices(run, liveIncidentMinute(s));
        run = Services.applyServiceResponse(run, serviceResponse(s, s.show.responseId)).state;
      }
      if (raw.phase === 'done' && s.history.some(h => h.seed === s.seed && h.night === s.show.night)) {
        run = Services.advanceServices(run, D.LIVE_SERVICES.closeAt);
      }
      s.show.services = Services.saveServices(run);
    }
    if (raw.show.food !== undefined) {
      if (s.show.flow && raw.show.food?.version === 1 && Object.hasOwn(FOOD_PLANS, raw.show.food.plan)) s.show.food = { version: 1, plan: raw.show.food.plan };
      else s.show.serviceRecovered = true;
    }
    if (raw.show.sanitation !== undefined) {
      try {
        if (!s.show.flow) throw new TypeError('Sanitation requires normal flow');
        s.show.sanitation = facilityTerms(raw.show.sanitation, true);
      } catch { s.show.serviceRecovered = true; }
    }
    if (s.show.flow) {
      const saved = raw.show.flow?.version === 1 ? raw.show.flow.minute : null, summary = liveServicesFor(s);
      const valid = isInt(saved) && saved >= 0 && saved <= (summary.departure.duration || 0)
        && (s.show.services.minute === D.LIVE_SERVICES.closeAt || saved === 0);
      if (valid) s.show.flow.minute = saved;
      else s.show.serviceRecovered = true;
      // A signed receipt remains signed if its departure field was damaged.
      if (raw.phase === 'done' && s.history.some(h => h.seed === s.seed && h.night === s.show.night)) s.show.flow.minute = summary.departure.duration || 0;
    }
    if (raw.show.serviceRecovered === true) s.show.serviceRecovered = true;
    delete s.show.pilotCrew;
  }

  let i = PHASES.indexOf(PHASES.includes(raw.phase) ? raw.phase : 'book');
  while (i > 0 && !supportsPhase(s, PHASES[i])) i -= 1;
  s.phase = PHASES[i];
  if (i < PHASES.indexOf('show')) {
    s.show = null;
    s.promotion.confirmed = false;
  }
  return s;
}
