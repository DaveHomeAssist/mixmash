// Reference layouts and strategies shared by the engine tests and the balance simulator.
// They are fixtures, not rules: changing one changes the baseline, not the game. The
// reference layout is the game's own suggested layout, so the baseline describes what
// players are offered.

import { STARTER_LAYOUT } from '../data.mjs';

export const REFERENCE_LAYOUT = STARTER_LAYOUT;

// Cheaper rig: small PA, no light tower, three restrooms.
export const BUDGET_LAYOUT = REFERENCE_LAYOUT
  .filter((o) => o.type !== 'lights' && !(o.type === 'restroom' && o.x === 20 && o.y === 13))
  .map((o) => (o.type === 'pa-m' ? { ...o, type: 'pa-s' } : o));

export const REFERENCE_ADS = { flyers: 0, social: 150, radio: 150 };
export const REFERENCE_PRICE = 20;

// The worked example in RULES.md, as plain engine inputs.
export const WORKED_EXAMPLE = {
  venue: { capacity: 150, clearTiles: 50, paTier: 'M', lights: 1, bars: 1, restrooms: 4, gates: 1 },
  price: 20,
  ads: { flyers: 0, social: 150, radio: 150 },
  venueRep: 0,
  draw: 100,
  artistId: 'velvet-static',
  incidentId: 'pa-dropout',
  responseId: 'wait',
};
