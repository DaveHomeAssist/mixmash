// Front of House adjustable values and content tables.
//
// This file is canonical for every number the rules use (CT-DEC-07). The rules
// themselves are specified by name in front-of-house/docs/RULES.md; change a value here,
// then run `npm run sim:front-of-house` and commit the regenerated balance baseline.

export const GAME_TITLE = 'Front of House';
export const SAVE_NAMESPACE = 'front_of_house_v1'; // localStorage key (CT-DEC-06, SAVE_FORMAT.md)
export const SCHEMA_VERSION = 1;

// Lot and money
export const START_CASH = 6000;
export const GRID = { w: 24, h: 16 };
export const PERMIT_CAP = 300;
export const FLOOR_DENSITY = 3; // people per open tile (a tile is 2 m by 2 m)
export const EXIT_CAPACITY = 100;
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
export const AD_SATURATION = 500;
export const AD_MAX_PER_CHANNEL = 5000;
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
export const PA_COVERAGE = { S: 200, M: 500 };
export const NO_LIGHTS_MULT = 0.8; // the production score without a light rig
export const BAR_RATIO = 250;
export const RESTROOM_RATIO = 75;
export const GATE_RATE = 5; // people per minute per gate
export const DOORS_MINUTES = 60;

// Money (R-10 to R-15)
export const BAR_NET_PER_HEAD = 6;
export const BAR_SHORTFALL = 0.6;
export const LOT_RENTAL = 800;
export const PERMIT = 250;
export const FENCE_KIT = 300;
export const PA_RENTAL = { S: 400, M: 900 };
export const LIGHTS_RENTAL = 350;
export const BAR_SETUP = 200;
export const RESTROOM_UNIT = 120;
export const STAFF_RATE = 150;
export const SECURITY_PER = 100;
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

// Artists. `ask` is the guarantee the artist expects (ARTIST_ASK in RULES.md).
export const ARTISTS = {
  'velvet-static': {
    name: 'Velvet Static',
    genre: 'Indie rock',
    drawMin: 150,
    drawMax: 260,
    fairPrice: 20,
    ask: 1000,
  },
};
export const DEFAULT_ARTIST = 'velvet-static';

// Incidents (R-11). Exactly one per show, chosen by the seeded generator.
export const INCIDENTS = {
  rain: {
    label: 'Rain at doors',
    responses: [
      { id: 'ride-out', label: 'Ride it out', cost: 0, score: 0.3, walkupMult: 0.6 },
      { id: 'ponchos', label: 'Hand out ponchos', cost: 250, score: 0.7, walkupMult: 0.8 },
      { id: 'canopy', label: 'Rent a canopy', cost: 500, score: 0.9, walkupMult: 0.9 },
    ],
  },
  'pa-dropout': {
    label: 'PA dropout mid-set',
    responses: [
      { id: 'wait', label: 'Wait it out', cost: 0, score: 0.3 },
      { id: 'backup-amp', label: 'Swap in the backup amp', cost: 200, score: 0.8 },
    ],
  },
  'gate-jam': {
    label: 'Gate jam at doors',
    responses: [
      { id: 'ride-out', label: 'Ride it out', cost: 0, score: 0.3, flowMult: 0.6 },
      { id: 'second-lane', label: 'Open a second lane', cost: 150, score: 0.9 },
    ],
  },
};
export const INCIDENT_ORDER = ['rain', 'pa-dropout', 'gate-jam'];

// Balance simulation targets (front-of-house/sim/simulate.mjs). Changing one is a design decision.
export const SIM_SEEDS = 500;
export const BALANCE_TARGETS = {
  referencePassRateMin: 0.25,
  referencePassRateMax: 0.9,
};
