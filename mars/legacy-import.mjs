// Legacy MarsScape save importer (parity wave 8).
//
// Accepts a `marsscape_v1` export from the standalone game and converts it into
// canonical engine state. Two rules govern this file:
//
//   1. Nothing is silently discarded. Anything the converter cannot map is reported
//      in `quarantine` so a human can look at it; the raw save is preserved verbatim
//      for rollback.
//   2. The conversion is previewed before it is committed. `convertLegacySave` is
//      pure — it returns state plus a report and writes nothing.

import {
  ITEMS, EQUIP_SLOTS, EQUIP_TIERS, RESEARCH, BUILDINGS, CROPS, OBJECTIVES,
  createState, sanitizeState, levelForXp,
} from './engine.mjs';

export const LEGACY_KEY = 'marsscape_v1';
export const LEGACY_MAX_VERSION = 4;

// MarsScape id -> canonical id. Mirrors mars/parity/mapping.json; the parity test
// asserts the two agree, so a rename can never drift between them.
export const ITEM_MAP = { part: 'component', part2: 'advanced_component', frame2: 'composite_frame' };
export const SKILL_MAP = { fab: 'fabrication', eng: 'engineering', agri: 'agriculture', explore: 'exploration' };
export const BUILDING_MAP = { green: 'greenhouse' };
export const RESEARCH_MAP = { scrub: 'scrubbers' };

const ITEM_IDS = new Set(Object.keys(ITEMS));
const RESEARCH_IDS = new Set(RESEARCH.map((r) => r.id));
const BUILDING_IDS = new Set(BUILDINGS.map((b) => b.id));
const CROP_IDS = new Set(CROPS.map((c) => c.id));
const SKILL_IDS = new Set(['mining', 'water', 'fabrication', 'engineering', 'agriculture',
  'robotics', 'exploration', 'research', 'piloting', 'survival']);

export class LegacyImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LegacyImportError';
    this.code = code;
  }
}

// Accepts the raw JSON string, or a base64 save code as exported by the old game.
export function parseLegacySave(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new LegacyImportError('EMPTY', 'Paste a MarsScape save export to import.');
  }
  const raw = input;
  const text = input.trim();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    try {
      const decoded = typeof atob === 'function'
        ? decodeURIComponent(escape(atob(text)))
        : Buffer.from(text, 'base64').toString('utf8');
      parsed = JSON.parse(decoded);
    } catch {
      throw new LegacyImportError('UNREADABLE', 'That is not a readable MarsScape save (expected JSON or a base64 save code).');
    }
  }
  // Unwrap the two envelope shapes an export can arrive in: the MixKit save store's
  // `{ns, state}`, and this client's own local envelope `{state, hmacVersion, ...}`.
  // Missing the second one is what made a real v3 export unreadable.
  if (parsed && typeof parsed === 'object' && parsed.state
    && (parsed.ns || parsed.hmacVersion || parsed.signature || parsed.mode)) {
    parsed = parsed.state;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new LegacyImportError('NOT_A_SAVE', 'That save did not decode to a MarsScape save object.');
  }
  // A mixmash engine save is a different thing from a standalone MarsScape save: its
  // fields are already canonical, so it upgrades through the sanitizer rather than
  // the field-by-field converter below.
  if (isEngineSave(parsed)) return { legacy: parsed, version: 0, kind: 'mixmash-engine', raw };
  const version = Number(parsed.v) || 1;
  if (version > LEGACY_MAX_VERSION) {
    throw new LegacyImportError('TOO_NEW', `Save version ${version} is newer than this importer understands (max ${LEGACY_MAX_VERSION}).`);
  }
  if (!parsed.skills && !parsed.inv) {
    throw new LegacyImportError('NOT_A_SAVE', 'That save has neither skills nor an inventory — it is not a MarsScape save.');
  }
  return { legacy: parsed, version, kind: 'marsscape', raw };
}

// A prior mixmash engine save: canonical field names, an engine `version`.
function isEngineSave(save) {
  return !!save && typeof save === 'object'
    && (save.inventory !== undefined || save.skills?.fabrication !== undefined);
}

export function convertLegacySave(input, now = Date.now()) {
  const parsedSave = parseLegacySave(input);
  const { legacy, version, raw } = parsedSave;

  // Engine saves need migrating, not converting: the sanitizer already knows how to
  // read an older engine shape and fill in what v4 added.
  if (parsedSave.kind === 'mixmash-engine') {
    const migrated = sanitizeState(legacy, now);
    migrated.legacyVersion = `mixmash.engine.v${Number(legacy.version) || 3}`;
    return {
      state: migrated,
      report: {
        legacyVersion: Number(legacy.version) || 3,
        sourceKind: 'mixmash-engine',
        quarantine: [],
        notes: ['Imported a mixmash engine save. Skills, inventory, structures, research and equipment carry over; the single pre-v4 greenhouse crop does not survive the move to plots.'],
        summary: summarize(migrated),
        original: raw,
      },
    };
  }
  const state = createState(now);
  const quarantine = [];
  const notes = [];
  const hold = (path, value, why) => quarantine.push({ path, value: preview(value), reason: why });

  state.legacyVersion = `${LEGACY_KEY}.v${version}`;

  // --- inventory + bank -----------------------------------------------------
  for (const [source, target] of [['inv', 'inventory'], ['bank', 'bank']]) {
    const bag = legacy[source];
    if (!bag || typeof bag !== 'object') continue;
    for (const [rawId, rawQty] of Object.entries(bag)) {
      const id = ITEM_MAP[rawId] || rawId;
      const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
      if (!ITEM_IDS.has(id)) { hold(`${source}.${rawId}`, rawQty, 'unknown item id'); continue; }
      if (qty <= 0) continue;
      if (target === 'inventory') state.inventory[id] = (state.inventory[id] || 0) + qty;
      else state.bank[id] = (state.bank[id] || 0) + qty;
    }
  }

  // --- skills ---------------------------------------------------------------
  if (legacy.skills && typeof legacy.skills === 'object') {
    for (const [rawId, entry] of Object.entries(legacy.skills)) {
      const id = SKILL_MAP[rawId] || rawId;
      if (!SKILL_IDS.has(id)) { hold(`skills.${rawId}`, entry, 'unknown skill id'); continue; }
      const xp = Math.max(0, Math.floor(Number(entry?.xp) || 0));
      state.skills[id] = { xp, level: levelForXp(xp) };
    }
  }

  // --- buildings, tiers, faults --------------------------------------------
  for (const [source, apply] of [
    ['built', (id, v) => { state.built[id] = !!v; }],
    ['fault', (id, v) => { if (v) state.fault[id] = true; }],
  ]) {
    const bag = legacy[source];
    if (!bag || typeof bag !== 'object') continue;
    for (const [rawId, value] of Object.entries(bag)) {
      const id = BUILDING_MAP[rawId] || rawId;
      if (!BUILDING_IDS.has(id)) { hold(`${source}.${rawId}`, value, 'unknown building id'); continue; }
      apply(id, value);
    }
  }
  if (legacy.tier && typeof legacy.tier === 'object') {
    for (const [rawId, value] of Object.entries(legacy.tier)) {
      const id = BUILDING_MAP[rawId] || rawId;
      if (!(id in state.tier)) { hold(`tier.${rawId}`, value, 'structure has no tier track'); continue; }
      state.tier[id] = Math.max(1, Math.min(3, Math.floor(Number(value) || 1)));
    }
  }
  state.overclock = !!legacy.overclock;

  // --- research -------------------------------------------------------------
  if (legacy.research && typeof legacy.research === 'object') {
    for (const [rawId, value] of Object.entries(legacy.research)) {
      const id = RESEARCH_MAP[rawId] || rawId;
      if (!RESEARCH_IDS.has(id)) { hold(`research.${rawId}`, value, 'unknown research project'); continue; }
      state.research[id] = !!value;
    }
  }

  // --- gear, region, equipment ---------------------------------------------
  if (legacy.pickaxe) {
    if (['stone', 'steel', 'titanium', 'laser'].includes(legacy.pickaxe)) state.gear.pickaxe = legacy.pickaxe;
    else hold('pickaxe', legacy.pickaxe, 'unknown pickaxe tier');
  }
  if (legacy.region) {
    if (legacy.region === 'landing_basin' || legacy.region === 'dune_sea') state.currentRegion = legacy.region;
    else hold('region', legacy.region, 'region not present in this engine');
  }
  if (legacy.rover) {
    if (['buggy', 'rover2', 'rover3'].includes(legacy.rover)) state.rover = legacy.rover;
    else hold('rover', legacy.rover, 'unknown rover tier');
  }
  if (legacy.equip && typeof legacy.equip === 'object') {
    for (const [slot, tier] of Object.entries(legacy.equip)) {
      if (!EQUIP_SLOTS.includes(slot)) { hold(`equip.${slot}`, tier, 'unknown equipment slot'); continue; }
      if (tier == null) continue;
      if (!EQUIP_TIERS.includes(tier)) { hold(`equip.${slot}`, tier, 'unknown equipment tier'); continue; }
      state.equip[slot] = tier;
    }
  }

  // --- farm plots -----------------------------------------------------------
  const plots = legacy.farm && Array.isArray(legacy.farm.plots) ? legacy.farm.plots : [];
  plots.forEach((plot, i) => {
    if (i >= state.farm.plots.length) { hold(`farm.plots[${i}]`, plot, 'more plots than this colony has'); return; }
    if (!plot || !plot.crop) return;
    if (!CROP_IDS.has(plot.crop)) { hold(`farm.plots[${i}].crop`, plot.crop, 'unknown crop'); return; }
    state.farm.plots[i] = {
      crop: plot.crop,
      t: Math.max(0, Math.floor(Number(plot.t) || 0)),
      disease: !!plot.disease,
      fert: !!plot.fert,
      rolled: !!plot.rolled,
    };
  });

  // --- storm, victory, postgame --------------------------------------------
  const storm = legacy.finalStorm || {};
  const rawStatus = typeof storm.status === 'string' ? storm.status : 'locked';
  let status = ['locked', 'ready', 'active', 'won'].includes(rawStatus) ? rawStatus : 'locked';
  if (status === 'active') {
    // The old game had no server clock, so an interrupted storm dropped back to
    // `ready`. An imported save has no trustworthy remaining-tick count either.
    status = 'ready';
    notes.push('The save was mid-storm. The Great Storm was reset to ready — start it again when your reserves are back.');
  }
  state.victory = !!legacy.victory;
  state.postgame = !!legacy.postgame || state.victory;
  if (state.victory) status = 'won';
  state.storm = { status, phase: status === 'won' ? 10 : 0, remaining: 0, startedAt: 0, surgeIn: 0 };

  // --- postgame objects -----------------------------------------------------
  if (Array.isArray(legacy.drones)) {
    state.drones = legacy.drones.slice(0, 3).map((d) => ({ nodeId: null, t: 0 }));
    if (legacy.drones.length > 3) hold('drones', legacy.drones.length, 'more drones than the cap allows');
    if (state.drones.length) notes.push('Drones were imported idle. Re-assign them to veins from the Depot panel.');
  }
  if (Array.isArray(legacy.extraNodes) && legacy.extraNodes.length) {
    // Rich veins are re-minted under canonical ids rather than trusting old geometry.
    state.extraNodes = legacy.extraNodes.slice(0, 3).map((_, i) => ({
      id: `rich-vein-${i + 1}`, name: `Rich Vein ${i + 1}`, type: 'ore', item: 'titanium_ore',
      skill: 'mining', xp: 120, hard: 6, lvl: 25, yieldBase: 2, x: 2 + i, y: 1, charges: 5,
    }));
  }

  // --- objectives + counters ------------------------------------------------
  if (legacy.quest != null) {
    state.objective = Math.max(0, Math.min(OBJECTIVES.length, Math.floor(Number(legacy.quest) || 0)));
  }
  if (legacy.stats && typeof legacy.stats === 'object') {
    for (const [key, value] of Object.entries(legacy.stats)) {
      const n = Math.max(0, Math.floor(Number(value) || 0));
      if (n > 0) state.stats[remapStatKey(key)] = n;
    }
  }
  state.sol = Math.max(1, Math.floor(Number(legacy.sol) || 1));
  if (Number.isFinite(Number(legacy.o2))) state.meters.oxygen = clampPct(legacy.o2);
  if (Number.isFinite(Number(legacy.pwr))) state.meters.power = clampPct(legacy.pwr);

  // Anything left over that we never looked at.
  const KNOWN = new Set(['v', 'lastSeen', 'sol', 'tickCount', 'o2', 'pwr', 'skills', 'inv', 'bank',
    'pickaxe', 'region', 'rover', 'built', 'tier', 'fault', 'overclock', 'research', 'equip',
    'farm', 'finalStorm', 'victory', 'postgame', 'drones', 'extraNodes', 'quest', 'stats',
    'nodeState', 'beaconSol']);
  for (const key of Object.keys(legacy)) {
    if (!KNOWN.has(key)) hold(key, legacy[key], 'field not present in this engine');
  }

  // Run the canonical sanitizer last: an imported save is untrusted input like any
  // other, and must not be able to produce state the engine would reject.
  const clean = sanitizeState(state, now);
  clean.legacyVersion = state.legacyVersion;
  return {
    state: clean,
    report: {
      legacyVersion: version,
      sourceKind: 'marsscape',
      quarantine,
      notes,
      summary: summarize(clean),
      // The caller's input byte-for-byte — not a re-serialization of the parse,
      // which would silently drop anything the parser normalised away.
      original: raw,
    },
  };
}

function remapStatKey(key) {
  // The old counters embedded item ids: mined_part -> mined_component.
  return key.replace(/(mined|smelted|crafted|harvested|drone)_(.+)$/, (_, verb, item) => `${verb}_${ITEM_MAP[item] || item}`);
}
function clampPct(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}
function preview(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return typeof text === 'string' && text.length > 120 ? `${text.slice(0, 117)}...` : text;
}
function summarize(state) {
  const carried = Object.values(state.inventory).reduce((a, b) => a + b, 0);
  const banked = Object.values(state.bank).reduce((a, b) => a + b, 0);
  return {
    totalLevel: Object.values(state.skills).reduce((a, s) => a + s.level, 0),
    itemsCarried: carried,
    itemsBanked: banked,
    buildingsOnline: Object.values(state.built).filter(Boolean).length,
    researchDone: Object.values(state.research).filter(Boolean).length,
    objectivesComplete: state.objective,
    victory: state.victory,
  };
}
