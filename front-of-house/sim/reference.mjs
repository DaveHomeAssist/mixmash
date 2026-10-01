// Reference layouts and strategies shared by the engine tests and the balance simulator.
// They are fixtures, not rules: changing one changes the baseline, not the game.

export const REFERENCE_LAYOUT = [
  { type: 'fence', x: 0, y: 0, rot: 0 },
  { type: 'stage', x: 9, y: 0, rot: 0 },
  { type: 'pa-m', x: 8, y: 0, rot: 0 },
  { type: 'lights', x: 15, y: 0, rot: 0 },
  { type: 'bar', x: 1, y: 8, rot: 0 },
  { type: 'restroom', x: 20, y: 12, rot: 0 },
  { type: 'restroom', x: 21, y: 12, rot: 0 },
  { type: 'restroom', x: 22, y: 12, rot: 0 },
  { type: 'restroom', x: 20, y: 13, rot: 0 },
  { type: 'gate', x: 12, y: 15, rot: 0 },
  { type: 'exit', x: 0, y: 5, rot: 0 },
  { type: 'exit', x: 23, y: 5, rot: 0 },
  { type: 'exit', x: 0, y: 14, rot: 0 },
];

// Cheaper rig: small PA, no light tower, three restrooms.
export const BUDGET_LAYOUT = REFERENCE_LAYOUT
  .filter((o) => o.type !== 'lights' && !(o.type === 'restroom' && o.x === 20 && o.y === 13))
  .map((o) => (o.type === 'pa-m' ? { ...o, type: 'pa-s' } : o));

export const REFERENCE_ADS = { flyers: 0, social: 300, radio: 300 };
export const REFERENCE_PRICE = 20;

// The worked example in RULES.md, as plain engine inputs.
export const WORKED_EXAMPLE = {
  venue: { capacity: 300, clearTiles: 50, paTier: 'M', lights: 1, bars: 1, restrooms: 4, gates: 1 },
  price: 20,
  ads: { flyers: 0, social: 300, radio: 300 },
  venueRep: 0,
  draw: 200,
  artistId: 'velvet-static',
  incidentId: 'pa-dropout',
  responseId: 'wait',
};
