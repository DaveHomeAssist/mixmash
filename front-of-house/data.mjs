// Front of House adjustable values and content tables.
//
// This file is canonical for every number the rules use (CT-DEC-07). The rules
// themselves are specified by name in front-of-house/docs/RULES.md; change a value here,
// then run `npm run sim:front-of-house` and commit the regenerated balance baseline.

export const GAME_TITLE = 'Front of House';
export const SAVE_NAMESPACE = 'front_of_house_v1'; // localStorage key (CT-DEC-06, SAVE_FORMAT.md)
export const SCHEMA_VERSION = 2; // 2: the Lot tier retune (SAVE_FORMAT.md, migrateSave in engine.mjs)
export const VENUE_NAME = 'Oak St. Lot'; // the first playable's parking lot (fictional, CT-DEC-03)

// Lot and money. Tier 1 of the career is the Lot, for 50 to 150 people (CT-DEC-09); every
// per-person and money value below was halved from the first playable's 300-person lot.
export const START_CASH = 3000;
export const GRID = { w: 24, h: 16 };
export const PERMIT_CAP = 150;
export const FLOOR_DENSITY = 1.5; // people per open tile (a tile is 2 m by 2 m); capacity rounds down
export const EXIT_CAPACITY = 50;
export const GENERATOR_WATTS = 20000; // off-grid generator included in the lot rental
export const SIGHT_RANGE = 12; // tiles from the middle of the stage front
export const SIGHT_CONE_DEGREES = 90;

// Demand (R-04 to R-07)
export const PRICE_BASE = 1.5;
export const PRICE_SLOPE = 0.5;
export const PRICE_FLOOR = 0.25;
export const PRICE_CEIL = 1.25;
export const PRICE_MIN = 10;
export const PRICE_MAX = 40;
export const AD_CHANNELS = ['flyers', 'social', 'radio'];
export const AD_REACH = { flyers: 0.15, social: 0.3, radio: 0.25 };
export const AD_SATURATION = 250;
export const AD_MAX_PER_CHANNEL = 2500;
export const AD_SLIDER_MAX = 1000; // the Promote screen's slider range and step
export const AD_STEP = 25;
export const REP_DIVISOR = 200;
export const PRESALE_BASE = 0.4;
export const PRESALE_PER_BUZZ = 0.5;
export const PRESALE_MAX = 0.8;

// Satisfaction (R-09)
export const W_SOUND = 35;
export const W_SIGHT = 20;
export const W_AMENITY = 20;
export const W_FLOW = 15;
export const W_INCIDENT = 10;
export const PA_COVERAGE = { S: 100, M: 250 };
export const NO_LIGHTS_MULT = 0.8; // the production score without a light rig
export const BAR_RATIO = 125;
export const RESTROOM_RATIO = 40;
export const GATE_RATE = 5; // people per minute per gate
export const DOORS_MINUTES = 60;

// Money (R-10 to R-15)
export const BAR_NET_PER_HEAD = 6;
export const BAR_SHORTFALL = 0.6;
export const LOT_RENTAL = 400;
export const PERMIT = 125;
export const FENCE_KIT = 150;
export const PA_RENTAL = { S: 200, M: 450 };
export const LIGHTS_RENTAL = 175;
export const BAR_SETUP = 100;
export const RESTROOM_UNIT = 60;
export const STAFF_RATE = 75;
export const SECURITY_PER = 50;
export const DOOR_STAFF_PER_GATE = 1;
export const BAR_STAFF_PER_BAR = 2;
export const DOOR_SPLIT = 0.7;
export const PASS_SATISFACTION = 60;

// Reputation (R-16, R-17)
export const REP_SAT_SLOPE = 0.5;
export const REL_BASE = 5;
export const REL_SLOPE = 20;
export const REL_MIN_STEP = -20;
export const REL_MAX_STEP = 10;

// Placeable objects (R-18). Footprints are for rotation 0; rotations 1 and 3 swap w and h.
// `group` caps how many of a kind may be placed; `edge` objects sit on the lot boundary;
// `nextToStage` objects must touch the stage; `blocksSight` objects block sightlines (R-03).
export const OBJECT_TYPES = {
  stage: { label: 'Stage', w: 6, h: 3, watts: 0, group: 'stage', max: 1 },
  'pa-s': { label: 'PA (small)', w: 1, h: 1, watts: 3000, group: 'pa', max: 1, nextToStage: true, paTier: 'S' },
  'pa-m': { label: 'PA (medium)', w: 1, h: 1, watts: 6000, group: 'pa', max: 1, nextToStage: true, paTier: 'M' },
  lights: { label: 'Light tower', w: 1, h: 1, watts: 8000, group: 'lights', max: 1, blocksSight: true },
  bar: { label: 'Bar', w: 2, h: 1, watts: 1500, blocksSight: true },
  restroom: { label: 'Restroom unit', w: 1, h: 1, watts: 0, blocksSight: true },
  gate: { label: 'Entry gate', w: 1, h: 1, watts: 0, edge: true },
  exit: { label: 'Exit', w: 1, h: 1, watts: 0, edge: true },
  fence: { label: 'Fence kit', kit: true, watts: 0, group: 'fence', max: 1 },
};

// The layout the Build screen offers as "Use the suggested layout". The tests and the
// balance simulator use it as their reference layout too (sim/reference.mjs).
export const STARTER_LAYOUT = [
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

// The cheapest venue that passes R-18 (one exit, so 50 people). Its cost on a door deal with no
// ads is the least a show can cost; below that, the career is out of money (R-21).
export const CHEAPEST_LAYOUT = [
  { type: 'fence', x: 0, y: 0, rot: 0 },
  { type: 'stage', x: 9, y: 0, rot: 0 },
  { type: 'pa-s', x: 8, y: 0, rot: 0 },
  { type: 'gate', x: 12, y: 15, rot: 0 },
  { type: 'exit', x: 0, y: 5, rot: 0 },
];

// Artists. `ask` is the guarantee the artist expects (ARTIST_ASK in RULES.md). Every act is
// fictional (CT-DEC-03); the name checks are recorded in docs/WORLD.md.
export const ARTISTS = {
  'gravel-hymnal': {
    name: 'Gravel Hymnal',
    genre: 'Folk',
    drawMin: 55,
    drawMax: 100,
    fairPrice: 15,
    ask: 300,
  },
  // Renamed from Velvet Static in save version 2: that name belongs to a real UK indie band
  // (CT-DEC-03 name checks).
  'sodium-arcade': {
    name: 'Sodium Arcade',
    genre: 'Indie rock',
    drawMin: 75,
    drawMax: 130,
    fairPrice: 20,
    ask: 500,
  },
  'juniper-switchboard': {
    name: 'Juniper Switchboard',
    genre: 'Funk and soul',
    drawMin: 95,
    drawMax: 150,
    fairPrice: 25,
    ask: 800,
    guaranteeOnly: true, // an established act: it never plays for the door
  },
};
export const DEFAULT_ARTIST = 'sodium-arcade';

// The Lot career (R-19 to R-21, CT-DEC-10). The first show always offers the default act;
// later shows offer OFFERS_PER_SHOW acts from the roster, chosen by the seed.
export const ROSTER = ['gravel-hymnal', 'sodium-arcade', 'juniper-switchboard'];
export const OFFERS_PER_SHOW = 2;
export const REL_ASK_SLOPE = 0.005; // each relationship point takes 0.5% off the ask (or adds it)
export const REL_DRAW_SLOPE = 0.005; // and adds 0.5% to the draw: an act that likes you promotes the show
export const REL_DOOR_FLOOR = -20; // at or below this, an act only plays for a guarantee
export const ASK_ROUNDING = 10;
// Meeting all three unlocks the Club, tier 2 (CT-DEC-09). The unlock stays once earned.
export const LOT_GOAL = { sellouts: 1, venueRep: 60, cash: 6000, loyalAct: 20 }; // loyalAct: one act's relationship

// Incidents (R-11). Exactly one per show, chosen by the seeded generator.
export const INCIDENTS = {
  rain: {
    label: 'Rain at doors',
    responses: [
      { id: 'ride-out', label: 'Ride it out', cost: 0, score: 0.3, walkupMult: 0.6 },
      { id: 'ponchos', label: 'Hand out ponchos', cost: 125, score: 0.7, walkupMult: 0.8 },
      { id: 'canopy', label: 'Rent a canopy', cost: 250, score: 0.9, walkupMult: 0.9 },
    ],
  },
  'pa-dropout': {
    label: 'PA dropout mid-set',
    responses: [
      { id: 'wait', label: 'Wait it out', cost: 0, score: 0.3 },
      { id: 'backup-amp', label: 'Swap in the backup amp', cost: 100, score: 0.8 },
    ],
  },
  'gate-jam': {
    label: 'Gate jam at doors',
    responses: [
      { id: 'ride-out', label: 'Ride it out', cost: 0, score: 0.3, flowMult: 0.6 },
      { id: 'second-lane', label: 'Open a second lane', cost: 75, score: 0.9 },
    ],
  },
};
export const INCIDENT_ORDER = ['rain', 'pa-dropout', 'gate-jam'];

// Balance simulation targets (front-of-house/sim/simulate.mjs). Changing one is a design decision.
export const SIM_SEEDS = 500;
export const BALANCE_TARGETS = {
  referencePassRateMin: 0.25,
  referencePassRateMax: 0.9,
  // The Lot career (Phase 4): careful play reaches the Club on nearly every seed, it takes a run
  // of shows, and careless play reaches it far less often.
  careerSeeds: 300,
  careerShows: 12,
  carefulReachMin: 0.9,
  careerMinShows: 4,
  careGapMin: 0.25,
};
