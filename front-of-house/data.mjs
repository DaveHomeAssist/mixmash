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
// Opt-in Lot doors experiment only. These are trial values, not new balance defaults.
export const LOT_PILOT_RUSH_MINUTES = 18;
export const LOT_PILOT_WALKUP_LOSS = 0.2; // share of a rush queue that turns away without a ticket
export const LOT_PILOT_GATE_MULT = 1.5; // existing gate works faster with the reassigned worker
export const LOT_PILOT_BAR_CAPACITY_LOSS = 0.5; // half of one bar's service capacity

// Opt-in live Lot services (R-LIVE-01). These values never change legacy shows.
export const LIVE_SERVICES = {
  closeAt: 240, steadyArrivalMinutes: 36, surgeArrivalMinutes: 6, surgeEvery: 3,
  gatePatience: 12, barPatience: 12, travelMinutes: 2,
  workerRate: 2, gateWorkerRate: 5, barBaseRate: 1, extraBarRate: 3,
};

// Normal departure pilot: gameplay throughput, never occupancy or evacuation capacity.
export const GUEST_FLOW = { exitRate: 5 };

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
  food: { label: 'Food stall', w: 2, h: 1, watts: 0, group: 'food', max: 1, blocksSight: true, lotOnly: true },
  trailer: { label: 'Facility trailer', w: 3, h: 2, watts: 1500, group: 'trailer', max: 1, blocksSight: true, lotOnly: true },
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
  'salt-ledger': { name: 'Salt Ledger', genre: 'Regional rock', drawMin: 180, drawMax: 380, fairPrice: 28, ask: 1600 },
  'pallet-chorus': { name: 'Pallet Chorus', genre: 'Indie', drawMin: 140, drawMax: 300, fairPrice: 24, ask: 1100 },
  'tin-relay': { name: 'Tin Relay', genre: 'Electronic', drawMin: 200, drawMax: 420, fairPrice: 32, ask: 2200, guaranteeOnly: true },
  'gutter-census': { name: 'Gutter Census', genre: 'National rock', drawMin: 700, drawMax: 1600, fairPrice: 48, ask: 8000, guaranteeOnly: true },
  'hollow-census': { name: 'Hollow Census', genre: 'National folk', drawMin: 500, drawMax: 1200, fairPrice: 42, ask: 5500 },
  'amber-turnout': { name: 'Amber Turnout', genre: 'Pop', drawMin: 900, drawMax: 2000, fairPrice: 60, ask: 12000, guaranteeOnly: true },
  'paper-voltage': { name: 'Paper Voltage', genre: 'Headliner', drawMin: 3500, drawMax: 8000, fairPrice: 90, ask: 35000, guaranteeOnly: true },
  'north-kettle': { name: 'North Kettle', genre: 'Headliner', drawMin: 2800, drawMax: 6500, fairPrice: 80, ask: 24000, guaranteeOnly: true },
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

// Later tiers (CT-DEC-11). The Lot's numbers above stay the source for tier 1.
// New acts are fictional; the name check is in docs/WORLD.md.
export const SPONSOR_PAY = 8000;
export const BROADCAST_PER_HEAD = 2;
export const SANDBOX_CASH = 1000000;
export const SCENARIO_CASH = 2600;

export const CLUB_ROSTER = ['salt-ledger', 'pallet-chorus', 'tin-relay'];
export const AMP_ROSTER = ['gutter-census', 'hollow-census', 'amber-turnout'];
export const FEST_ROSTER = ['paper-voltage', 'north-kettle', 'gutter-census'];
export const FEST_HEADLINERS = ['paper-voltage', 'north-kettle'];
export const FEST_HEADLINE_RELATIONSHIP = 20;

export const CLUB_GOAL = { sellouts: 1, venueRep: 70, cash: 18000, loyalAct: 15 };
export const AMP_GOAL = { sellouts: 1, venueRep: 80, cash: 50000, loyalAct: 15 };
export const FEST_GOAL = { attendance: 5000, cash: 80000, loyalAct: 10 };

export const CLUB_STARTER = [
  { type: 'fence', x: 0, y: 0, rot: 0 },
  { type: 'stage', x: 7, y: 0, rot: 0 },
  { type: 'lights', x: 14, y: 0, rot: 0 },
  { type: 'bar', x: 1, y: 6, rot: 0 },
  { type: 'bar', x: 16, y: 6, rot: 0 },
  { type: 'restroom', x: 1, y: 12, rot: 0 },
  { type: 'restroom', x: 2, y: 12, rot: 0 },
  { type: 'restroom', x: 17, y: 12, rot: 0 },
  { type: 'restroom', x: 18, y: 12, rot: 0 },
  { type: 'gate', x: 10, y: 13, rot: 0 },
  { type: 'exit', x: 0, y: 7, rot: 0 },
  { type: 'exit', x: 19, y: 7, rot: 0 },
];
export const CLUB_CHEAPEST = [
  { type: 'fence', x: 0, y: 0, rot: 0 },
  { type: 'stage', x: 7, y: 0, rot: 0 },
  { type: 'gate', x: 10, y: 13, rot: 0 },
  { type: 'exit', x: 0, y: 7, rot: 0 },
];
export const AMP_STARTER = [
  { type: 'fence', x: 0, y: 0, rot: 0 },
  { type: 'stage', x: 11, y: 0, rot: 0 },
  { type: 'lights', x: 18, y: 0, rot: 0 },
  { type: 'bar', x: 2, y: 8, rot: 0 },
  { type: 'bar', x: 22, y: 8, rot: 0 },
  { type: 'restroom', x: 2, y: 16, rot: 0 },
  { type: 'restroom', x: 3, y: 16, rot: 0 },
  { type: 'restroom', x: 24, y: 16, rot: 0 },
  { type: 'restroom', x: 25, y: 16, rot: 0 },
  { type: 'gate', x: 14, y: 17, rot: 0 },
  { type: 'exit', x: 0, y: 9, rot: 0 },
  { type: 'exit', x: 27, y: 9, rot: 0 },
  { type: 'exit', x: 0, y: 16, rot: 0 },
];
export const AMP_CHEAPEST = [
  { type: 'fence', x: 0, y: 0, rot: 0 },
  { type: 'stage', x: 11, y: 0, rot: 0 },
  { type: 'gate', x: 14, y: 17, rot: 0 },
  { type: 'exit', x: 0, y: 9, rot: 0 },
];
export const FEST_STARTER = [
  { type: 'fence', x: 0, y: 0, rot: 0 },
  { type: 'stage', x: 16, y: 0, rot: 0 },
  { type: 'lights', x: 24, y: 0, rot: 0 },
  { type: 'bar', x: 2, y: 10, rot: 0 },
  { type: 'bar', x: 34, y: 10, rot: 0 },
  { type: 'bar', x: 18, y: 14, rot: 0 },
  { type: 'restroom', x: 2, y: 22, rot: 0 },
  { type: 'restroom', x: 3, y: 22, rot: 0 },
  { type: 'restroom', x: 36, y: 22, rot: 0 },
  { type: 'restroom', x: 37, y: 22, rot: 0 },
  { type: 'gate', x: 20, y: 23, rot: 0 },
  { type: 'exit', x: 0, y: 12, rot: 0 },
  { type: 'exit', x: 39, y: 12, rot: 0 },
  { type: 'exit', x: 0, y: 22, rot: 0 },
  { type: 'exit', x: 39, y: 22, rot: 0 },
];
export const FEST_CHEAPEST = [
  { type: 'fence', x: 0, y: 0, rot: 0 },
  { type: 'stage', x: 16, y: 0, rot: 0 },
  { type: 'gate', x: 20, y: 23, rot: 0 },
  { type: 'exit', x: 0, y: 12, rot: 0 },
];

export const VENUES = {
  lot: {
    id: 'lot', name: 'Oak St. Lot', tier: 1,
    grid: { w: 24, h: 16 }, permit: 150, watts: 20000, rental: 400, permitFee: 125,
    housePa: null, seats: 0, priceMax: 40, roster: ROSTER, defaultArtist: DEFAULT_ARTIST,
    incidents: null, sponsor: false, broadcast: false, secondStage: false, nights: [1],
    pillars: [], starter: STARTER_LAYOUT, cheapest: CHEAPEST_LAYOUT,
  },
  club: {
    id: 'club', name: 'Fathom Hall', tier: 2,
    grid: { w: 20, h: 14 }, permit: 360, watts: 60000, rental: 1200, permitFee: 400,
    housePa: 'M', seats: 0, priceMax: 50, exitCapacity: 200, roster: CLUB_ROSTER, defaultArtist: 'salt-ledger',
    incidents: null, sponsor: false, broadcast: false, secondStage: false, nights: [1],
    pillars: [[6, 5], [6, 6], [13, 5], [13, 6]],
    starter: CLUB_STARTER, cheapest: CLUB_CHEAPEST,
  },
  amphitheater: {
    id: 'amphitheater', name: 'Loam Shell', tier: 3,
    grid: { w: 28, h: 18 }, permit: 700, watts: 120000, rental: 4000, permitFee: 1500,
    housePa: 'M', seats: 400, priceMax: 80, exitCapacity: 400, roster: AMP_ROSTER, defaultArtist: 'hollow-census',
    incidents: ['rain', 'pa-dropout', 'gate-jam', 'curfew'],
    sponsor: false, broadcast: false, secondStage: false, nights: [1, 2, 3],
    pillars: [], starter: AMP_STARTER, cheapest: AMP_CHEAPEST,
  },
  festival: {
    id: 'festival', name: 'Split Acre', tier: 4,
    grid: { w: 40, h: 24 }, permit: 6000, watts: 250000, rental: 12000, permitFee: 4000,
    housePa: 'M', seats: 0, priceMax: 120, density: 8, exitCapacity: 2000, roster: FEST_ROSTER, defaultArtist: 'paper-voltage',
    incidents: ['rain', 'pa-dropout', 'gate-jam', 'curfew'],
    sponsor: true, broadcast: true, secondStage: true, secondCap: 500, nights: [1],
    pillars: [], starter: FEST_STARTER, cheapest: FEST_CHEAPEST,
  },
};
export const VENUE_ORDER = ['lot', 'club', 'amphitheater', 'festival'];

// Show night runs from doors (19:00) to curfew (23:00); times below are shares of that night.
export const ACT_ON_STAGE_AT = 0.3; // 20:12, when the feed says the act takes the stage

// Incidents (R-11). Exactly one per show, chosen by the seeded generator. `window` is the share of
// show night the incident can happen in (R-11a), so rain arrives at doors and a PA drops out mid-set.
export const INCIDENTS = {
  rain: {
    label: 'Rain at doors',
    window: [0.05, 0.15], // 19:12 to 19:36, as the doors open
    responses: [
      { id: 'ride-out', label: 'Ride it out', cost: 0, score: 0.3, walkupMult: 0.6 },
      { id: 'ponchos', label: 'Hand out ponchos', cost: 125, score: 0.7, walkupMult: 0.8 },
      { id: 'canopy', label: 'Rent a canopy', cost: 250, score: 0.9, walkupMult: 0.9 },
    ],
  },
  'pa-dropout': {
    label: 'PA dropout mid-set',
    window: [0.4, 0.8], // 20:36 to 22:12, after the act is on stage
    responses: [
      { id: 'wait', label: 'Wait it out', cost: 0, score: 0.3 },
      { id: 'backup-amp', label: 'Swap in the backup amp', cost: 100, score: 0.8 },
    ],
  },
  'gate-jam': {
    label: 'Gate jam at doors',
    window: [0.05, 0.2], // 19:12 to 19:48, while the line is still coming in
    responses: [
      { id: 'ride-out', label: 'Ride it out', cost: 0, score: 0.3, flowMult: 0.6 },
      { id: 'second-lane', label: 'Open a second lane', cost: 75, score: 0.9 },
    ],
  },
  curfew: {
    label: 'Noise curfew cuts the set',
    window: [0.88, 0.95], // 22:31 to 22:48, the end of the set
    responses: [
      { id: 'obey', label: 'End the set', cost: 0, score: 0.4, walkupMult: 0.7 },
      { id: 'appeal', label: 'Appeal and finish the song', cost: 400, score: 0.75, walkupMult: 0.9 },
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

// Optional Lot sanitation contract; promoter costs, charged once before doors.
export const SANITATION_COSTS = Object.freeze({ trailer: 240, cleaner: 80, utilities: 60, preferenceRelationship: 2 });

// Optional development pilot; knowledge never grants free equipment or show spending.
export const RESEARCH_PROJECTS = Object.freeze({
  patch: Object.freeze({ label: 'Patch standards', department: 'production', cost: 120, experience: 0, nights: 1 }),
  service: Object.freeze({ label: 'Service training', department: 'guestServices', cost: 180, experience: 1, nights: 2 }),
  admission: Object.freeze({ label: 'Admission lanes', department: 'admissions', cost: 180, experience: 1, nights: 2 }),
});

// Bounded benefits apply only to learned projects frozen at booking.
export const RESEARCH_EFFECTS = Object.freeze({ patchScore: 0.15, barWorkerRate: 1, gateRate: 1 });

// One-family ownership pilot. Acquisition is capital; operation is a later show cost.
export const OWNED_EQUIPMENT = Object.freeze({
  'small-pa': Object.freeze({ label: 'Small PA', objectType: 'pa-s', purchase: 1200, resale: 600, operation: 20 }),
});
