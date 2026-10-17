// Presentation-only suggestions (docs/ANTICIPATORY_UX.md). Readers never commit a choice:
// every applyAction call here runs on the current state as a dry run and its result is
// discarded (the engine never changes its input). Suggestions use only public state and the
// player's own preferences, never the hidden draw or the seeded incident.

import * as D from './data.mjs';
import { applyAction, artistFor, festivalPolicyFor, offersFor, termsFor, upfrontFor, validatePlacement, venueSpec } from './engine.mjs';

// The tools that answer last night's weakest satisfaction part; the client keeps only those the
// room offers. Incident handling has no tool.
export const WEAKEST_TOOLS = Object.freeze({
  amenities: ['bar', 'restroom', 'bar-tent', 'restroom-block'],
  sound: ['pa-m', 'pa-s', 'lights'],
  flow: ['gate', 'exit'],
  sightlines: [],
  incident: [],
});

const dry = (state, action) => {
  try { return applyAction(state, action); } catch { return { state, error: 'unavailable' }; }
};
const shortBy = (s) => (s.mode === 'sandbox' ? 0 : Math.max(0, upfrontFor(s) - s.cash));

// Book: the deal remembered for each offered act, and what the doors would need under each deal
// with the current layout and no ads. `dealAction(artistId, deal)` builds the same action the
// Book buttons send, so a dry run matches what a press would do.
export function bookSuggestions(state, prefs, dealAction) {
  if (state.phase !== 'book') return [];
  const spec = venueSpec(state.venue);
  return offersFor(state).map((id) => {
    const terms = termsFor(id, state.reputation.artists[id] || 0);
    const short = {};
    for (const deal of ['guarantee', 'door', ...(spec.sponsor ? ['sponsor'] : [])]) {
      if (deal === 'door' && !terms.doorOk) continue;
      const r = dry(state, dealAction(id, deal));
      short[deal] = r.error ? null : shortBy(r.state);
    }
    const remembered = prefs.suggest ? prefs.acts[id]?.deal : null;
    const lastDeal = remembered && short[remembered] !== undefined ? remembered : null;
    const highlightDoor = short.guarantee > 0 && short.door === 0;
    return { artistId: id, lastDeal, short, highlightDoor };
  });
}

// Build: last night's weakest part and the tools that address it, shown on Build entry.
export function buildSuggestion(state, prefs) {
  if (state.phase !== 'build' || !prefs.suggest) return null;
  const last = state.history.at(-1);
  if (!last || !own(WEAKEST_TOOLS, last.weakest)) return null;
  return { weakest: last.weakest, tools: WEAKEST_TOOLS[last.weakest], lastTool: prefs.rooms[state.venue.id]?.lastTool || null };
}

// Promote: the price and ads last opened with this act, if applying them changes something,
// stays inside the room's limits and would not leave the doors short.
export function promoteSuggestion(state, prefs) {
  if (state.phase !== 'promote' || !prefs.suggest) return null;
  const memory = prefs.acts[state.booking.artistId];
  if (!memory || (memory.price === undefined && !memory.ads)) return null;
  const spec = venueSpec(state.venue);
  const fixed = festivalPolicyFor(state)?.sponsorPrice;
  const price = fixed !== undefined || memory.price === undefined ? state.promotion.price
    : Math.min(Math.max(memory.price, D.PRICE_MIN), spec.priceMax || D.PRICE_MAX);
  const ads = memory.ads || state.promotion.ads;
  const same = price === state.promotion.price && D.AD_CHANNELS.every((c) => (ads[c] || 0) === (state.promotion.ads[c] || 0));
  if (same) return null;
  const r = dry(state, { type: 'setPromotion', price, ads });
  if (r.error || shortBy(r.state) > 0) return null;
  return { price, ads, adTotal: D.AD_CHANNELS.reduce((sum, c) => sum + (ads[c] || 0), 0) };
}

// Show: the response this player chose the last time this incident came up.
export function incidentSuggestion(state, prefs) {
  const id = state.show?.incidentId;
  if (!prefs.suggest || !id || !own(D.INCIDENTS, id)) return null;
  const response = prefs.incidents[id];
  return D.INCIDENTS[id].responses.some((r) => r.id === response) ? response : null;
}

// Done: the next show's offers, from a dry run of Book the next show.
export function nextShowPreview(state) {
  if (state.phase !== 'done') return null;
  const r = dry(state, { type: 'nextShow' });
  if (r.error) return null;
  return offersFor(r.state).map((id) => {
    const rel = r.state.reputation.artists[id] || 0;
    return { artistId: id, name: artistFor(id).name, ask: termsFor(id, rel).ask, relationship: rel };
  });
}

// Tools that only fit at particular tiles: the edge for gates and exits, touching the stage for a PA.
export function hasPlacementRule(type) {
  const t = D.OBJECT_TYPES[type];
  return !!(t && (t.edge || t.nextToStage));
}

// Every top-corner tile where this tool would be accepted, as "x,y" keys; the ghost's own check.
export function legalTiles(venue, type, rot = 0) {
  const tiles = new Set();
  if (!hasPlacementRule(type)) return tiles;
  const { w, h } = venueSpec(venue).grid;
  const index = venue.objects.length;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const { problems } = validatePlacement([...venue.objects, { type, x, y, rot }], venue);
      if (!problems.some((p) => p.index === index)) tiles.add(`${x},${y}`);
    }
  }
  return tiles;
}

function own(table, key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
}
