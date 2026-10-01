// Concert Tycoon rules engine.
//
// Pure and deterministic: no DOM access, no Math.random, no clock. Every function
// takes state (or plain inputs) and returns new state or derived numbers, so the
// browser client, the tests and the balance simulator all run the same rules.
// Rule IDs (R-NN) refer to tycoon/docs/RULES.md; every number comes from data.mjs.

import * as D from './data.mjs';

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
export function rollShow(seed, artistId = D.DEFAULT_ARTIST) {
  const artist = artistFor(artistId);
  const rng = mulberry32(seed);
  const draw = artist.drawMin + Math.floor(rng() * (artist.drawMax - artist.drawMin + 1));
  const incidentId = D.INCIDENT_ORDER[Math.floor(rng() * D.INCIDENT_ORDER.length)];
  const incidentAt = Math.round((0.2 + rng() * 0.6) * 1000) / 1000;
  return { draw, incidentId, incidentAt };
}

// ---------------------------------------------------------------------------
// State

export function createGame(seed = 1) {
  const artist = artistFor(D.DEFAULT_ARTIST);
  return {
    schema: D.SCHEMA_VERSION,
    seed: seed >>> 0,
    phase: 'book',
    cash: D.START_CASH,
    venue: { id: 'lot', grid: { w: D.GRID.w, h: D.GRID.h }, objects: [] },
    booking: { artistId: D.DEFAULT_ARTIST, deal: null },
    promotion: { price: artist.fairPrice, ads: zeroAds(), confirmed: false },
    show: null,
    reputation: { venue: 0, artists: Object.fromEntries(Object.keys(D.ARTISTS).map((id) => [id, 0])) },
    history: [],
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

function onEdge(x, y) {
  return x === 0 || y === 0 || x === D.GRID.w - 1 || y === D.GRID.h - 1;
}

// Validates a layout in placement order. Returns the objects that pass, plus a problem
// for each one that doesn't. Placement checks run in order; the "touches the stage"
// check runs against the accepted stage wherever it sits in the list.
export function validateLayout(objects) {
  const accepted = [];
  const problems = [];
  const occupied = new Set();
  const groupCounts = {};
  let watts = 0;

  objects.forEach((raw, index) => {
    const reject = (message) => problems.push({ index, type: raw && raw.type, message });
    if (!isObj(raw)) return reject('Not an object');
    const t = D.OBJECT_TYPES[raw.type];
    if (!t) return reject(`Unknown object type "${raw.type}"`);
    const obj = { type: raw.type, x: t.kit ? 0 : raw.x, y: t.kit ? 0 : raw.y, rot: t.kit ? 0 : raw.rot };
    if (!t.kit) {
      if (!isInt(obj.x) || !isInt(obj.y) || !isInt(obj.rot) || obj.rot < 0 || obj.rot > 3) {
        return reject(`${t.label} needs whole-number x, y and a rotation from 0 to 3`);
      }
      const tiles = footprint(obj);
      if (tiles.some(([x, y]) => x < 0 || y < 0 || x >= D.GRID.w || y >= D.GRID.h)) {
        return reject(`${t.label} does not fit inside the lot`);
      }
      if (tiles.some(([x, y]) => occupied.has(key(x, y)))) return reject(`${t.label} overlaps another object`);
      if (t.edge && !tiles.every(([x, y]) => onEdge(x, y))) return reject(`${t.label} must sit on the lot boundary`);
    }
    if (t.group && t.max !== undefined && (groupCounts[t.group] || 0) >= t.max) {
      return reject(t.group === 'pa' ? 'Only one PA can be rented' : `Only ${t.max} ${t.label} allowed`);
    }
    if (watts + t.watts > D.GENERATOR_WATTS) {
      return reject(`${t.label} would draw ${watts + t.watts} W, over the ${D.GENERATOR_WATTS} W generator`);
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

// R-03: open tiles inside the sight cone with a clear line to the middle of the stage front.
function countClearTiles(objects, occupied) {
  const stage = objects.find((o) => o.type === 'stage');
  if (!stage) return 0;
  const blocking = new Set();
  for (const o of objects) {
    if (D.OBJECT_TYPES[o.type].blocksSight) footprint(o).forEach(([x, y]) => blocking.add(key(x, y)));
  }
  const { facing, front } = stageGeometry(stage);
  const cosHalf = Math.cos(((D.SIGHT_CONE_DEGREES / 2) * Math.PI) / 180);
  let clear = 0;
  for (let y = 0; y < D.GRID.h; y += 1) {
    for (let x = 0; x < D.GRID.w; x += 1) {
      if (occupied.has(key(x, y))) continue;
      const dx = x + 0.5 - front[0];
      const dy = y + 0.5 - front[1];
      const dist = Math.hypot(dx, dy);
      if (dist === 0 || dist > D.SIGHT_RANGE) continue;
      if (dx * facing[0] + dy * facing[1] < dist * cosHalf - 1e-9) continue;
      const steps = Math.ceil(dist / 0.25);
      let blocked = false;
      for (let i = 1; i < steps && !blocked; i += 1) {
        const px = front[0] + (dx * i) / steps;
        const py = front[1] + (dy * i) / steps;
        if (blocking.has(key(Math.floor(px), Math.floor(py)))) blocked = true;
      }
      if (!blocked) clear += 1;
    }
  }
  return clear;
}

// Everything the rules need to know about a layout.
export function evaluateVenue(venue) {
  const objects = isObj(venue) && Array.isArray(venue.objects) ? venue.objects : [];
  const { accepted, problems } = validateLayout(objects);
  const occupied = new Set();
  accepted.forEach((o) => footprint(o).forEach(([x, y]) => occupied.add(key(x, y))));
  const count = (type) => accepted.filter((o) => o.type === type).length;
  const pa = accepted.find((o) => D.OBJECT_TYPES[o.type].paTier);
  const stats = {
    stage: count('stage'),
    paTier: pa ? D.OBJECT_TYPES[pa.type].paTier : null,
    lights: count('lights'),
    bars: count('bar'),
    restrooms: count('restroom'),
    gates: count('gate'),
    exits: count('exit'),
    fence: count('fence'),
    watts: accepted.reduce((sum, o) => sum + D.OBJECT_TYPES[o.type].watts, 0),
    openFloorTiles: D.GRID.w * D.GRID.h - occupied.size,
  };
  stats.clearTiles = countClearTiles(accepted, occupied);
  // R-01
  stats.capacity = Math.min(D.PERMIT_CAP, D.FLOOR_DENSITY * stats.openFloorTiles, D.EXIT_CAPACITY * stats.exits);
  stats.capacityLimit = stats.capacity === D.PERMIT_CAP ? 'permit'
    : stats.capacity === D.EXIT_CAPACITY * stats.exits ? 'exits' : 'floor';
  stats.staff = staffFor(stats);
  // R-18 build requirements
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

// inputs: { venue (evaluateVenue stats), deal, price, ads, venueRep, draw, artistId,
//           incidentId, responseId }. A missing incidentId means nothing went wrong.
export function evaluateShow(inputs) {
  const artist = artistFor(inputs.artistId);
  const v = inputs.venue;
  const response = inputs.incidentId ? findResponse(inputs.incidentId, inputs.responseId) : null;
  const pf = priceFactor(inputs.price, artist.fairPrice);
  const bz = buzz(inputs.ads);
  const dem = demand({ draw: inputs.draw, price: inputs.price, fairPrice: artist.fairPrice, ads: inputs.ads, venueRep: inputs.venueRep });
  const { share, presale, walkup } = presaleSplit(dem, bz, v.capacity);
  const walkupAfterIncident = Math.round(walkup * (response && response.walkupMult !== undefined ? response.walkupMult : 1));
  const attendance = Math.max(0, Math.min(v.capacity, presale + walkupAfterIncident));

  // R-09
  const per = (supply) => (attendance > 0 ? Math.min(1, supply / attendance) : 1);
  const parts = {
    sound: v.paTier ? per(D.PA_COVERAGE[v.paTier]) * (v.lights ? 1 : D.NO_LIGHTS_MULT) : 0,
    sightlines: per(v.clearTiles * D.FLOOR_DENSITY),
    amenities: (per(v.bars * D.BAR_RATIO) + per(v.restrooms * D.RESTROOM_RATIO)) / 2,
    flow: per(v.gates * D.GATE_RATE * D.DOORS_MINUTES) * (response && response.flowMult !== undefined ? response.flowMult : 1),
    incident: inputs.incidentId ? (response ? response.score : 0) : 1,
  };
  const weights = { sound: D.W_SOUND, sightlines: D.W_SIGHT, amenities: D.W_AMENITY, flow: D.W_FLOW, incident: D.W_INCIDENT };
  const satisfaction = Math.round(Object.keys(weights).reduce((s, k) => s + weights[k] * parts[k], 0));
  const weakest = Object.keys(weights).reduce((worst, k) =>
    (weights[k] * (1 - parts[k]) > weights[worst] * (1 - parts[worst]) ? k : worst), 'sound');

  // R-10, R-13, R-14, R-15
  const ticketGross = attendance * inputs.price;
  const served = Math.min(attendance, v.bars * D.BAR_RATIO);
  const bar = Math.round(D.BAR_NET_PER_HEAD * (satisfaction / 100)
    * (served + (attendance - served) * D.BAR_SHORTFALL));
  const adSpend = D.AD_CHANNELS.reduce((s, c) => s + ((inputs.ads && inputs.ads[c]) || 0), 0);
  const costs = {
    lot: D.LOT_RENTAL,
    permit: D.PERMIT,
    pa: v.paTier ? D.PA_RENTAL[v.paTier] : 0,
    lights: v.lights ? D.LIGHTS_RENTAL : 0,
    bars: v.bars * D.BAR_SETUP,
    restrooms: v.restrooms * D.RESTROOM_UNIT,
    fence: D.FENCE_KIT,
    staff: staffFor(v) * D.STAFF_RATE,
    ads: adSpend,
    incident: response ? response.cost : 0,
  };
  costs.total = Object.values(costs).reduce((a, b) => a + b, 0);
  const guarantee = artist.ask;
  const artistPay = inputs.deal === 'guarantee' ? guarantee : Math.round(D.DOOR_SPLIT * Math.max(0, ticketGross - costs.total));
  const net = ticketGross + bar - costs.total - artistPay;
  const result = net >= 0 && satisfaction >= D.PASS_SATISFACTION ? 'pass' : 'retry';

  // R-12
  const upfront = costs.total - costs.incident + (inputs.deal === 'guarantee' ? guarantee : 0);

  // R-16, R-17
  const repDelta = Math.round(D.REP_SAT_SLOPE * (satisfaction - D.PASS_SATISFACTION));
  const relDelta = clamp(D.REL_BASE + Math.round(D.REL_SLOPE * (artistPay / artist.ask - 1)), D.REL_MIN_STEP, D.REL_MAX_STEP);

  return {
    priceFactor: pf, buzz: bz, demand: dem, presaleShare: share, presale, walkup, walkupAfterIncident, attendance,
    parts, satisfaction, weakest, ticketGross, bar, costs, upfront, artistPay, net, result, repDelta, relDelta,
  };
}

function showInputs(state, venueStats, withIncident) {
  const roll = rollShow(state.seed, state.booking.artistId);
  return {
    venue: venueStats,
    deal: state.booking.deal,
    price: state.promotion.price,
    ads: state.promotion.ads,
    venueRep: state.reputation.venue,
    draw: roll.draw,
    artistId: state.booking.artistId,
    incidentId: withIncident && state.show ? state.show.incidentId : null,
    responseId: withIncident && state.show ? state.show.responseId : null,
  };
}

// R-12: money due before the show, for the current choices.
export function upfrontFor(state) {
  return evaluateShow(showInputs(state, evaluateVenue(state.venue), false)).upfront;
}

// The Promote screen's attendance range. The draw itself stays hidden.
export function forecast(state) {
  const artist = artistFor(state.booking.artistId);
  const v = evaluateVenue(state.venue);
  const at = (draw) => {
    const dem = demand({ draw, price: state.promotion.price, fairPrice: artist.fairPrice, ads: state.promotion.ads, venueRep: state.reputation.venue });
    const { presale, walkup } = presaleSplit(dem, buzz(state.promotion.ads), v.capacity);
    return Math.min(v.capacity, presale + walkup);
  };
  return { low: at(artist.drawMin), high: at(artist.drawMax), capacity: v.capacity };
}

// The settlement sheet for a show whose incident has been answered.
export function settlementFor(state) {
  if (!state.show || !state.show.responseId) return null;
  return evaluateShow(showInputs(state, evaluateVenue(state.venue), true));
}

// ---------------------------------------------------------------------------
// Actions

const fail = (state, error) => ({ state, error });

export function applyAction(state, action) {
  if (!isObj(action)) return fail(state, 'Unknown action');
  const s = clone(state);
  const need = (phase) => (s.phase === phase ? null : `That can only be done during ${phase}`);
  let err;

  switch (action.type) {
    case 'chooseDeal': {
      if ((err = need('book'))) return fail(state, err);
      if (!DEALS.includes(action.deal)) return fail(state, 'Choose a guarantee or a door deal');
      s.booking.deal = action.deal;
      s.phase = 'build';
      return { state: s, error: null };
    }
    case 'place': {
      if ((err = need('build'))) return fail(state, err);
      const o = action.object;
      if (!isObj(o)) return fail(state, 'Nothing to place');
      const obj = { type: o.type, x: o.x, y: o.y, rot: o.rot === undefined ? 0 : o.rot };
      const { problems } = validateLayout([...s.venue.objects, obj]);
      const mine = problems.find((p) => p.index === s.venue.objects.length);
      if (mine) return fail(state, mine.message);
      const t = D.OBJECT_TYPES[obj.type];
      s.venue.objects.push(t.kit ? { type: obj.type, x: 0, y: 0, rot: 0 } : obj);
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
      const price = action.price === undefined ? s.promotion.price : action.price;
      if (!isInt(price) || price < D.PRICE_MIN || price > D.PRICE_MAX) {
        return fail(state, `Ticket price must be a whole number from ${D.PRICE_MIN} to ${D.PRICE_MAX}`);
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
      return { state: s, error: null };
    }
    case 'confirmPromotion': {
      if ((err = need('promote'))) return fail(state, err);
      const upfront = upfrontFor(s);
      if (upfront > s.cash) return fail(state, `This show needs $${upfront} before doors, but you have $${s.cash}`);
      s.cash -= upfront;
      s.promotion.confirmed = true;
      s.show = { incidentId: rollShow(s.seed, s.booking.artistId).incidentId, responseId: null };
      s.phase = 'show';
      return { state: s, error: null };
    }
    case 'respond': {
      if ((err = need('show'))) return fail(state, err);
      const response = findResponse(s.show.incidentId, action.responseId);
      if (!response) return fail(state, 'That response does not fit this incident');
      if (response.cost > s.cash) return fail(state, `${response.label} costs $${response.cost}; you have $${s.cash}`);
      s.cash -= response.cost;
      s.show.responseId = response.id;
      s.phase = 'settle';
      return { state: s, error: null };
    }
    case 'acceptSettlement': {
      if ((err = need('settle'))) return fail(state, err);
      const r = settlementFor(s);
      s.cash += r.ticketGross + r.bar - (s.booking.deal === 'door' ? r.artistPay : 0);
      s.reputation.venue = clamp(s.reputation.venue + r.repDelta, 0, 100);
      const id = s.booking.artistId;
      s.reputation.artists[id] = clamp((s.reputation.artists[id] || 0) + r.relDelta, -100, 100);
      s.history.push({
        showId: s.history.length + 1,
        seed: s.seed,
        deal: s.booking.deal,
        attendance: r.attendance,
        satisfaction: r.satisfaction,
        net: r.net,
        artistPay: r.artistPay,
        result: r.result,
        weakest: r.weakest,
        settledAt: typeof action.at === 'string' ? action.at : null,
      });
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
      const last = s.history[s.history.length - 1];
      if (action.type === 'nextShow' && (!last || last.result !== 'pass')) return fail(state, 'Pass this show before booking the next one');
      const fresh = createGame(nextSeed(s.seed));
      fresh.venue = s.venue;
      fresh.history = s.history;
      if (action.type === 'nextShow') {
        fresh.cash = s.cash;
        fresh.reputation = s.reputation;
      }
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
    case 'settle': return supportsPhase(s, 'show') && s.show.responseId !== null;
    case 'done': return supportsPhase(s, 'settle') && s.history.length > 0;
    default: return false;
  }
}

const intOr = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback);

export function normalizeState(raw, fallbackSeed = 1) {
  if (!isObj(raw) || raw.schema !== D.SCHEMA_VERSION) return createGame(fallbackSeed);
  const s = createGame(isInt(raw.seed) && raw.seed >= 0 && raw.seed <= 0xffffffff ? raw.seed : fallbackSeed);

  s.cash = clamp(intOr(raw.cash, D.START_CASH), -1e9, 1e9);

  const rawObjects = isObj(raw.venue) && Array.isArray(raw.venue.objects) ? raw.venue.objects.slice(0, 1000) : [];
  s.venue.objects = validateLayout(rawObjects.map((o) => (isObj(o)
    ? { type: o.type, x: o.x, y: o.y, rot: o.rot === undefined ? 0 : o.rot } : o))).accepted;

  const booking = isObj(raw.booking) ? raw.booking : {};
  if (typeof booking.artistId === 'string' && D.ARTISTS[booking.artistId]) s.booking.artistId = booking.artistId;
  s.booking.deal = DEALS.includes(booking.deal) ? booking.deal : null;

  const promo = isObj(raw.promotion) ? raw.promotion : {};
  s.promotion.price = clamp(intOr(promo.price, artistFor(s.booking.artistId).fairPrice), D.PRICE_MIN, D.PRICE_MAX);
  const ads = isObj(promo.ads) ? promo.ads : {};
  for (const c of D.AD_CHANNELS) s.promotion.ads[c] = clamp(intOr(ads[c], 0), 0, D.AD_MAX_PER_CHANNEL);
  s.promotion.confirmed = promo.confirmed === true;

  const rep = isObj(raw.reputation) ? raw.reputation : {};
  s.reputation.venue = clamp(intOr(rep.venue, 0), 0, 100);
  const rel = isObj(rep.artists) ? rep.artists : {};
  for (const id of Object.keys(D.ARTISTS)) s.reputation.artists[id] = clamp(intOr(rel[id], 0), -100, 100);

  if (Array.isArray(raw.history)) {
    s.history = raw.history.filter(isObj).slice(-200).map((h, i) => ({
      showId: i + 1,
      seed: isInt(h.seed) ? h.seed >>> 0 : 0,
      deal: DEALS.includes(h.deal) ? h.deal : null,
      attendance: intOr(h.attendance, 0),
      satisfaction: clamp(intOr(h.satisfaction, 0), 0, 100),
      net: intOr(h.net, 0),
      artistPay: intOr(h.artistPay, 0),
      result: h.result === 'pass' ? 'pass' : 'retry',
      weakest: typeof h.weakest === 'string' ? h.weakest : null,
      settledAt: typeof h.settledAt === 'string' ? h.settledAt : null,
    }));
  }

  // The incident is re-derived from the seed, never read from the save.
  if (isObj(raw.show)) {
    const incidentId = rollShow(s.seed, s.booking.artistId).incidentId;
    s.show = { incidentId, responseId: findResponse(incidentId, raw.show.responseId) ? raw.show.responseId : null };
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
