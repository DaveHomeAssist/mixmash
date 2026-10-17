// Front of House device preferences (docs/ANTICIPATORY_UX.md section 3).
//
// One versioned localStorage key, separate from the career save (front_of_house_v1): view
// choices and the player's own recent habits that the suggestions read. Nothing here is game
// state; no cash, seed, time or free text is stored, and it never leaves the browser. Every
// reader takes the storage object, so tests run without a DOM and a blocked store is harmless.

import * as D from './data.mjs';

export const PREFS_KEY = 'front_of_house_prefs';
export const PREFS_VERSION = 1;
export const PREFS_SOFT_LIMIT = 2048; // serialized bytes kept after trimming the oldest habits
export const PREFS_HARD_LIMIT = 4096; // a stored value larger than this is discarded on read
export const LEGACY_KEYS = Object.freeze({ renderer: 'front_of_house_renderer', theme: 'front_of_house_theme' });
export const MAX_ACTS = 16;
export const MAX_INCIDENTS = 8;
export const HINT_CAP = 3;
export const HINTS = ['legalTiles', 'rendererSwitch'];
export const TAB_PHASES = ['book', 'build', 'promote', 'done'];
const DEALS = ['guarantee', 'door', 'sponsor'];
const PRICE_CAP = 200;

const own = (table, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const wholeIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export function defaultPrefs() {
  return {
    v: PREFS_VERSION,
    suggest: true,
    view: { renderer: null, theme: 'light' },
    hints: Object.fromEntries(HINTS.map((h) => [h, 0])),
    phone: { tabs: {} },
    rooms: {},
    acts: {},
    incidents: {},
  };
}

function normalizeAds(raw) {
  if (!isObj(raw)) return null;
  const ads = {};
  for (const c of D.AD_CHANNELS) {
    const n = raw[c] === undefined ? 0 : raw[c];
    if (!wholeIn(n, 0, D.AD_SLIDER_MAX) || n % D.AD_STEP !== 0) return null;
    ads[c] = n;
  }
  return ads;
}

function normalizeAct(raw) {
  if (!isObj(raw)) return null;
  const act = {};
  if (DEALS.includes(raw.deal)) act.deal = raw.deal;
  if (wholeIn(raw.price, D.PRICE_MIN, PRICE_CAP)) act.price = raw.price;
  const ads = normalizeAds(raw.ads);
  if (ads) act.ads = ads;
  return Object.keys(act).length ? act : null;
}

// Accepts anything (parsed JSON, a damaged object) and returns a valid version 1 record.
// Only the content tables' own ids survive, never inherited names such as `constructor`.
export function normalizePrefs(raw) {
  const prefs = defaultPrefs();
  if (!isObj(raw) || raw.v !== PREFS_VERSION) return prefs;
  if (typeof raw.suggest === 'boolean') prefs.suggest = raw.suggest;
  if (isObj(raw.view)) {
    if (raw.view.renderer === '2d' || raw.view.renderer === '3d') prefs.view.renderer = raw.view.renderer;
    if (raw.view.theme === 'dark' || raw.view.theme === 'light') prefs.view.theme = raw.view.theme;
  }
  if (isObj(raw.hints)) for (const h of HINTS) if (wholeIn(raw.hints[h], 0, HINT_CAP)) prefs.hints[h] = raw.hints[h];
  if (isObj(raw.phone) && isObj(raw.phone.tabs)) {
    for (const phase of TAB_PHASES) {
      const tab = raw.phone.tabs[phase];
      if (typeof tab === 'string' && tab.length > 0 && tab.length <= 40) prefs.phone.tabs[phase] = tab;
    }
  }
  if (isObj(raw.rooms)) {
    for (const [id, room] of Object.entries(raw.rooms)) {
      if (!own(D.VENUES, id) || !isObj(room)) continue;
      const next = {};
      if (own(D.OBJECT_TYPES, room.lastTool)) next.lastTool = room.lastTool;
      if (typeof room.sightlines === 'boolean') next.sightlines = room.sightlines;
      if (Object.keys(next).length) prefs.rooms[id] = next;
    }
  }
  if (isObj(raw.acts)) {
    for (const [id, value] of Object.entries(raw.acts)) {
      if (!own(D.ARTISTS, id)) continue;
      const act = normalizeAct(value);
      if (act) prefs.acts[id] = act;
    }
    trimTo(prefs.acts, MAX_ACTS);
  }
  if (isObj(raw.incidents)) {
    for (const [id, response] of Object.entries(raw.incidents)) {
      if (!own(D.INCIDENTS, id) || !D.INCIDENTS[id].responses.some((r) => r.id === response)) continue;
      prefs.incidents[id] = response;
    }
    trimTo(prefs.incidents, MAX_INCIDENTS);
  }
  return prefs;
}

// Objects keep insertion order: the first key is the least recently used.
function trimTo(record, max) {
  const keys = Object.keys(record);
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) delete record[key];
}

// The stored text, trimmed under the soft limit by dropping the oldest act and then the oldest
// incident memories. View choices and hint counters are never dropped.
export function serializePrefs(prefs) {
  const copy = normalizePrefs(prefs);
  let text = JSON.stringify(copy);
  while (text.length > PREFS_SOFT_LIMIT) {
    const acts = Object.keys(copy.acts), incidents = Object.keys(copy.incidents);
    if (acts.length) delete copy.acts[acts[0]];
    else if (incidents.length) delete copy.incidents[incidents[0]];
    else break;
    text = JSON.stringify(copy);
  }
  return text;
}

function read(storage, key) {
  try { return storage ? storage.getItem(key) : null; } catch { return null; }
}

// Reads the key; a missing, oversized or damaged value starts from the defaults. The first read
// folds the older single-purpose renderer and theme keys into `view`.
export function loadPrefs(storage) {
  const text = read(storage, PREFS_KEY);
  let prefs = null;
  if (typeof text === 'string' && text.length <= PREFS_HARD_LIMIT) {
    try { prefs = normalizePrefs(JSON.parse(text)); } catch { prefs = null; }
  }
  if (!prefs) {
    prefs = defaultPrefs();
    const renderer = read(storage, LEGACY_KEYS.renderer);
    if (renderer === '2d' || renderer === '3d') prefs.view.renderer = renderer;
    if (read(storage, LEGACY_KEYS.theme) === 'dark') prefs.view.theme = 'dark';
  }
  return prefs;
}

// Writes the record, and the legacy view keys for one release so an older client keeps the
// player's view. Returns false when the browser refuses storage; play continues regardless.
export function savePrefs(storage, prefs) {
  if (!storage) return false;
  try {
    const clean = normalizePrefs(prefs);
    storage.setItem(PREFS_KEY, serializePrefs(clean));
    if (clean.view.renderer) storage.setItem(LEGACY_KEYS.renderer, clean.view.renderer);
    storage.setItem(LEGACY_KEYS.theme, clean.view.theme);
    return true;
  } catch { return false; }
}

// Forget everything this module stores, including the legacy view keys. The career save is untouched.
export function clearPrefs(storage) {
  if (!storage) return false;
  try {
    storage.removeItem(PREFS_KEY);
    for (const key of Object.values(LEGACY_KEYS)) storage.removeItem(key);
    return true;
  } catch { return false; }
}

// Pure updates: each returns a new record and leaves the input unchanged.
const copyOf = (prefs) => normalizePrefs(JSON.parse(JSON.stringify(prefs)));

export function rememberAct(prefs, artistId, { deal, price, ads } = {}) {
  const next = copyOf(prefs);
  if (!next.suggest || !own(D.ARTISTS, artistId)) return next;
  const patch = Object.fromEntries(Object.entries({ deal, price, ads }).filter(([, v]) => v !== undefined));
  const act = normalizeAct({ ...next.acts[artistId], ...patch });
  delete next.acts[artistId];
  if (act) next.acts[artistId] = act;
  trimTo(next.acts, MAX_ACTS);
  return next;
}

export function rememberIncident(prefs, incidentId, responseId) {
  const next = copyOf(prefs);
  if (!next.suggest || !own(D.INCIDENTS, incidentId) || !D.INCIDENTS[incidentId].responses.some((r) => r.id === responseId)) return next;
  delete next.incidents[incidentId];
  next.incidents[incidentId] = responseId;
  trimTo(next.incidents, MAX_INCIDENTS);
  return next;
}

export function rememberRoom(prefs, venueId, patch) {
  const next = copyOf(prefs);
  if (!own(D.VENUES, venueId)) return next;
  next.rooms[venueId] = { ...next.rooms[venueId], ...patch };
  return normalizePrefs(next);
}

export function rememberTab(prefs, phase, tab) {
  const next = copyOf(prefs);
  if (TAB_PHASES.includes(phase)) next.phone.tabs[phase] = tab;
  return normalizePrefs(next);
}

export function bumpHint(prefs, name) {
  const next = copyOf(prefs);
  if (HINTS.includes(name)) next.hints[name] = Math.min(HINT_CAP, next.hints[name] + 1);
  return next;
}

export function setView(prefs, patch) {
  const next = copyOf(prefs);
  next.view = { ...next.view, ...patch };
  return normalizePrefs(next);
}

// Turning suggestions off also forgets the per-act and per-incident memories.
export function setSuggest(prefs, enabled) {
  const next = copyOf(prefs);
  next.suggest = !!enabled;
  if (!next.suggest) { next.acts = {}; next.incidents = {}; next.rooms = {}; }
  return next;
}
