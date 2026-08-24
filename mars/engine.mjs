// MarsScape colony engine — server-authoritative. Ported from MarsScape v0.4.0
// (see mars/parity/ for the feature ledger). Game logic lives here and runs on the
// authority; the browser sends commands and never sends trusted totals.

export const ENGINE_VERSION = 4;

// Timing is MarsScape's: the 600 ms RuneScape tick, 100 ticks to a sol (60 s).
export const TICK_MS = 600;
export const TICKS_PER_SOL = 100;
export const MAX_OFFLINE_TICKS = 12 * 60 * 60 * 1000 / TICK_MS;

// The exact RuneScape XP curve. 99 costs 13,034,431 xp — the whole progression arc
// is calibrated against this table, so it is generated, never approximated.
export const XP_TABLE = (() => {
  const table = [0, 0];
  let points = 0;
  for (let level = 1; level < 100; level += 1) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table[level + 1] = Math.floor(points / 4);
  }
  return table;
})();

export function xpForLevel(level) {
  return XP_TABLE[Math.max(1, Math.min(99, level))] || 0;
}

export function levelForXp(xp) {
  const value = Math.max(0, Number(xp) || 0);
  let level = 1;
  while (level < 99 && XP_TABLE[level + 1] <= value) level += 1;
  return level;
}

export const ITEMS = {
  iron_ore: { name: 'Iron Ore', short: 'Fe Ore', color: '#b9c1c6', stack: 24 },
  copper_ore: { name: 'Copper Ore', short: 'Cu Ore', color: '#d98145', stack: 24 },
  titanium_ore: { name: 'Titanium Ore', short: 'Ti Ore', color: '#e8edf0', stack: 24 },
  silicate_ore: { name: 'Silicate Ore', short: 'Si Ore', color: '#e0b062', stack: 24 },
  rare_ore: { name: 'Rare-Earth Ore', short: 'RE Ore', color: '#b07fd8', stack: 24 },
  iridium_ore: { name: 'Iridium Ore', short: 'Ir Ore', color: '#8b8f96', stack: 24 },
  ice: { name: 'Ice', short: 'Ice', color: '#84d6e9', stack: 24 },
  geode: { name: 'Geode', short: 'Geode', color: '#7fe3c8', stack: 24 },
  iron_bar: { name: 'Iron Bar', short: 'Fe Bar', color: '#c6ced2', stack: 24 },
  copper_bar: { name: 'Copper Bar', short: 'Cu Bar', color: '#f29a54', stack: 24 },
  titanium_bar: { name: 'Titanium Bar', short: 'Ti Bar', color: '#eef3f6', stack: 24 },
  glass: { name: 'Silicate Glass', short: 'Glass', color: '#a8d8e0', stack: 48 },
  alloy: { name: 'Rare-Earth Alloy', short: 'Alloy', color: '#c79ae8', stack: 24 },
  iridium_bar: { name: 'Iridium Bar', short: 'Ir Bar', color: '#aab0b8', stack: 24 },
  water: { name: 'Water', short: 'Water', color: '#63c7e1', stack: 48 },
  frame: { name: 'Frame', short: 'Frame', color: '#aeb8bf', stack: 12 },
  composite_frame: { name: 'Composite Frame', short: 'C-Frame', color: '#cfd8de', stack: 12 },
  component: { name: 'Component', short: 'Comp', color: '#76d6d2', stack: 12 },
  advanced_component: { name: 'Advanced Component', short: 'Adv Comp', color: '#9ae8e2', stack: 12 },
  insulation: { name: 'Insulation Mat', short: 'Insul', color: '#dcd2bb', stack: 24 },
  fertilizer: { name: 'Fertilizer', short: 'Fert', color: '#b3a06a', stack: 24 },
  food: { name: 'Food', short: 'Food', color: '#8ccf69', stack: 24 },
  soy: { name: 'Soy', short: 'Soy', color: '#c8d68a', stack: 24 },
  algae: { name: 'Algae', short: 'Algae', color: '#6fbf7a', stack: 24 },
  berries: { name: 'Hydro Berries', short: 'Berries', color: '#7f8fd8', stack: 24 },
  genefruit: { name: 'Genefruit', short: 'Genefruit', color: '#c07fd8', stack: 24 },
  fuel: { name: 'Fuel Cell', short: 'Fuel', color: '#e0a03a', stack: 12 },
};

// How much oxygen one unit restores when rationed.
export const EDIBLES = { food: 6, soy: 8, algae: 9, berries: 11, genefruit: 15 };

export const SKILLS = {
  mining: { name: 'Mining', accent: '#d2c9ba' },
  water: { name: 'Water Extraction', accent: '#7fd8ee' },
  fabrication: { name: 'Fabrication', accent: '#f0a45f' },
  engineering: { name: 'Engineering', accent: '#d8d0c0' },
  agriculture: { name: 'Agriculture', accent: '#91ce67' },
  robotics: { name: 'Robotics', accent: '#8fd0b6', postgame: true },
  exploration: { name: 'Exploration', accent: '#e0c07f', postgame: true },
  research: { name: 'Research', accent: '#87d8d9' },
  piloting: { name: 'Piloting', accent: '#7fa8e3' },
  survival: { name: 'Survival', accent: '#e3be66' },
};

export const REGIONS = {
  landing_basin: { name: 'Landing Basin', home: true, gate: null },
  dune_sea: { name: 'Dune Sea', home: false, gate: { skill: 'piloting', lvl: 1 }, baseTravelTicks: 20 },
};
export const FUTURE_REGIONS = [
  { name: 'Canyon Network', req: 'Piloting 20' },
  { name: 'Polar Cap', req: 'Piloting 40 + insulated suit' },
];

export const ROVERS = {
  buggy: { name: 'Survey Buggy', mult: 1.0 },
  rover2: { name: 'Rover Mk2', mult: 0.7 },
  rover3: { name: 'Rover Mk3', mult: 0.5 },
};
const ROVER_ORDER = ['buggy', 'rover2', 'rover3'];
const TRAVEL_FUEL = 1;

export const PICKS = {
  stone: { name: 'Stone Pick', mult: 1, crit: 0 },
  steel: { name: 'Steel Pick', mult: 0.8, crit: 1 },
  titanium: { name: 'Titanium Pick', mult: 0.65, crit: 2 },
  laser: { name: 'Laser Pick', mult: 0.5, crit: 4 },
};
const PICK_ORDER = ['stone', 'steel', 'titanium', 'laser'];

export const EQUIP_SLOTS = ['suit', 'helmet', 'gloves', 'boots', 'scanner', 'backpack'];
export const EQUIP_TIERS = ['canvas', 'steel', 'titan', 'composite'];
const EQUIP_TIER_META = {
  canvas: { lvl: 5, xp: 40, cost: { iron_bar: 3, frame: 1 } },
  steel: { lvl: 15, xp: 90, cost: { iron_bar: 4, copper_bar: 3, frame: 2 } },
  titan: { lvl: 30, xp: 200, requiresBuilding: 'machine', cost: { titanium_bar: 4, frame: 2, component: 2 } },
  composite: { lvl: 45, xp: 420, requiresResearch: 'alloy_tempering', cost: { alloy: 3, titanium_bar: 4, advanced_component: 1 } },
};
const EQUIP_SLOT_META = {
  suit: { stat: 'o2' }, helmet: { stat: 'o2' }, gloves: { stat: 'crit' },
  boots: { stat: 'speed' }, scanner: { stat: 'geode' }, backpack: { stat: 'pack' },
};
const EQUIP_STATS = {
  suit: { o2: [4, 8, 12, 16] },
  helmet: { o2: [2, 4, 6, 8] },
  gloves: { crit: [1, 2, 3, 4] },
  boots: { speed: [8, 15, 22, 30] },
  scanner: { geode: [1, 2, 3, 4] },
  backpack: { pack: [2, 4, 6, 8] },
};

// 17 nodes. `lvl` is the skill gate (the ore/ice ladder); `yield` the base quantity.
// MarsScape depletes every node after the same number of gathers and then respawns
// it — there are no per-node charge counts (see src/main.js: `{charges:5, cd:0}`).
// The balance baseline's xp/hr and time-to-99 are computed against this uniform model.
export const NODE_CHARGES = 5;

export const NODES = [
  { id: 'iron-north', name: 'North Iron Seam', type: 'ore', item: 'iron_ore', skill: 'mining', xp: 16, hard: 3, x: 2, y: 2, charges: NODE_CHARGES },
  { id: 'iron-south', name: 'South Iron Seam', type: 'ore', item: 'iron_ore', skill: 'mining', xp: 16, hard: 3, x: 3, y: 7, charges: NODE_CHARGES },
  { id: 'iron-east', name: 'East Iron Seam', type: 'ore', item: 'iron_ore', skill: 'mining', xp: 16, hard: 3, x: 8, y: 6, charges: NODE_CHARGES },
  { id: 'copper-ridge', name: 'Copper Ridge', type: 'ore', item: 'copper_ore', skill: 'mining', xp: 26, hard: 4, lvl: 10, x: 7, y: 3, charges: NODE_CHARGES },
  { id: 'copper-basin', name: 'Basin Copper', type: 'ore', item: 'copper_ore', skill: 'mining', xp: 26, hard: 4, lvl: 10, x: 1, y: 8, charges: NODE_CHARGES },
  { id: 'ice-pocket', name: 'Ice Pocket', type: 'ice', item: 'ice', skill: 'water', xp: 20, hard: 3, x: 4, y: 3, charges: NODE_CHARGES },
  { id: 'ice-scarp', name: 'Ice Scarp', type: 'ice', item: 'ice', skill: 'water', xp: 20, hard: 3, x: 8, y: 5, charges: NODE_CHARGES },
  { id: 'permafrost-bed', name: 'Permafrost Bed', type: 'ice', item: 'ice', skill: 'water', xp: 48, hard: 5, lvl: 20, x: 4, y: 6, charges: NODE_CHARGES },
  { id: 'brine-well', name: 'Brine Well', type: 'ice', item: 'ice', skill: 'water', xp: 90, hard: 6, lvl: 40, yieldBase: 2, x: 9, y: 7, charges: NODE_CHARGES },
  { id: 'titanium-vein', name: 'Titanium Vein', type: 'ore', item: 'titanium_ore', skill: 'mining', xp: 55, hard: 6, lvl: 25, x: 5, y: 1, charges: NODE_CHARGES, requiresBuilding: 'machine' },
  { id: 'silicate-bed-north', name: 'Silicate Bed', type: 'ore', item: 'silicate_ore', skill: 'mining', xp: 80, hard: 7, lvl: 30, x: 6, y: 2, charges: NODE_CHARGES },
  { id: 'silicate-bed-west', name: 'West Silicate Bed', type: 'ore', item: 'silicate_ore', skill: 'mining', xp: 80, hard: 7, lvl: 30, x: 1, y: 5, charges: NODE_CHARGES },
  { id: 'rare-earth-seam', name: 'Rare-Earth Seam', type: 'ore', item: 'rare_ore', skill: 'mining', xp: 150, hard: 8, lvl: 55, x: 3, y: 2, charges: NODE_CHARGES },
  { id: 'iridium-lode', name: 'Iridium Lode', type: 'ore', item: 'iridium_ore', skill: 'mining', xp: 205, hard: 10, lvl: 75, x: 7, y: 2, charges: NODE_CHARGES },
  { id: 'dune-iron-scree', name: 'Iron Scree', type: 'ore', item: 'iron_ore', skill: 'mining', xp: 18, hard: 2, yieldBase: 2, x: 2, y: 4, charges: NODE_CHARGES, regionId: 'dune_sea' },
  { id: 'dune-wreck-site', name: 'Wreck Site', type: 'salvage', item: 'component', skill: 'mining', xp: 74, hard: 7, x: 7, y: 6, charges: NODE_CHARGES, regionId: 'dune_sea' },
  { id: 'dune-silicate-dunes', name: 'Silicate Dunes', type: 'ore', item: 'silicate_ore', skill: 'mining', xp: 88, hard: 6, lvl: 30, yieldBase: 2, x: 4, y: 4, charges: NODE_CHARGES, regionId: 'dune_sea' },
];

// The postgame Exploration beacon — a node that only exists after the Great Storm.
export const EXPEDITION_NODE = {
  id: 'expedition-beacon', name: 'Expedition Beacon', type: 'explore', item: 'component',
  skill: 'exploration', xp: 120, hard: 8, x: 9, y: 3, charges: NODE_CHARGES,
};

export const BUILDINGS = [
  { id: 'habitat', name: 'Habitat', model: 'dome', x: 5, y: 9, cost: {}, prebuilt: true, description: 'Life support anchor. Adds oxygen generation.' },
  { id: 'depot', name: 'Colony Depot', model: 'crate', x: 6, y: 9, cost: { iron_bar: 4, frame: 2 }, description: 'The bank. Unlimited storage; drones deliver here.' },
  { id: 'solar', name: 'Solar Array', model: 'array', x: 3, y: 8, cost: { iron_bar: 6, frame: 3, component: 2 }, description: 'Restores power generation and stabilizes the machine shop.' },
  { id: 'water', name: 'Water Plant', model: 'tower', x: 2, y: 6, cost: { iron_bar: 8, frame: 4, ice: 10 }, description: 'Purifies ice into usable water.' },
  { id: 'machine', name: 'Machine Shop', model: 'foundry', x: 7, y: 8, cost: { iron_bar: 10, copper_bar: 6, frame: 6 }, description: 'Unlocks titanium work and better fabrication.' },
  { id: 'greenhouse', name: 'Greenhouse', model: 'glass', x: 8, y: 6, cost: { frame: 8, component: 4, water: 15 }, description: 'Grows food and improves oxygen output.' },
  { id: 'lab', name: 'Research Lab', model: 'scope', x: 5, y: 5, cost: { titanium_bar: 6, component: 6, frame: 8 }, description: 'Turns rare materials into permanent upgrades.' },
  { id: 'reactor', name: 'Fusion Reactor', model: 'reactor', x: 5, y: 3, cost: { titanium_bar: 12, component: 10, frame: 10 }, description: 'A stable power crown. Unlocks the Great Storm objective.' },
];

// Tiers II and III per upgradable structure. Index 0 = the II upgrade, 1 = the III.
export const BUILD_TIERS = {
  habitat: [
    { cost: { frame: 6, glass: 2 }, engLvl: 10, o2: 0.03 },
    { cost: { composite_frame: 2, glass: 4, insulation: 2 }, engLvl: 35, o2: 0.04 },
  ],
  solar: [
    { cost: { component: 4, glass: 3 }, engLvl: 15, power: 0.04 },
    { cost: { advanced_component: 2, glass: 6 }, engLvl: 40, power: 0.05 },
  ],
  water: [
    { cost: { frame: 4, glass: 2 }, engLvl: 20, purify: 1 },
    { cost: { advanced_component: 1, alloy: 1 }, engLvl: 45, purify: 1 },
  ],
  machine: [
    { cost: { frame: 6, component: 3 }, engLvl: 25, smelt: 1 },
    { cost: { alloy: 2, advanced_component: 2 }, engLvl: 50, smelt: 1 },
  ],
  greenhouse: [
    { cost: { glass: 4, water: 10 }, engLvl: 20, o2: 0.02 },
    { cost: { glass: 8, advanced_component: 1 }, engLvl: 45, o2: 0.03, plot: 1 },
  ],
};
export const MAX_TIER = 3;
export const OVERCLOCK_LVL = 25;
export const OVERCLOCK_MULT = 1.35;
export const FAULT_CHANCE = 0.0025;
export const FAULTABLE = ['habitat', 'solar', 'greenhouse', 'reactor'];

export const SMELT_RECIPES = [
  { id: 'smelt-iron', ticks: 4, name: 'Smelt Iron Bar', input: { iron_ore: 1 }, output: { iron_bar: 1 }, power: 2, xp: 18, requiresBuilding: null },
  { id: 'smelt-copper', ticks: 5, name: 'Smelt Copper Bar', input: { copper_ore: 1 }, output: { copper_bar: 1 }, power: 2, xp: 24, requiresBuilding: null },
  { id: 'smelt-titanium', ticks: 7, name: 'Smelt Titanium Bar', input: { titanium_ore: 1 }, output: { titanium_bar: 1 }, power: 4, xp: 52, requiresBuilding: 'machine' },
  { id: 'smelt-glass', ticks: 5, name: 'Fuse Silicate Glass', input: { silicate_ore: 1 }, output: { glass: 1 }, power: 3, xp: 64, requiresBuilding: 'machine' },
  { id: 'smelt-alloy', ticks: 6, name: 'Smelt RE Alloy', input: { rare_ore: 1 }, output: { alloy: 1 }, power: 4, xp: 120, requiresBuilding: 'machine' },
  { id: 'smelt-iridium', ticks: 8, name: 'Smelt Iridium Bar', input: { iridium_ore: 1 }, output: { iridium_bar: 1 }, power: 6, xp: 210, requiresBuilding: 'machine', requiresResearch: 'iridium_refining' },
];

export const CRAFT_RECIPES = [
  { id: 'craft-frame', name: 'Frame', input: { iron_bar: 2 }, output: { frame: 1 }, xp: 16 },
  { id: 'craft-component', name: 'Component', input: { copper_bar: 2 }, output: { component: 1 }, xp: 24 },
  { id: 'craft-composite-frame', name: 'Composite Frame', input: { glass: 2, frame: 2 }, output: { composite_frame: 1 }, xp: 110, lvl: 28, requiresBuilding: 'machine', description: 'Glass-braced frame for tier-III structures.' },
  { id: 'craft-advanced-component', name: 'Advanced Component', input: { alloy: 1, glass: 1, component: 2 }, output: { advanced_component: 1 }, xp: 190, lvl: 38, requiresBuilding: 'machine', description: "Rare-earth electronics for the colony's best hardware." },
  { id: 'craft-insulation', name: 'Insulation Mat', input: { glass: 1, frame: 1 }, output: { insulation: 1 }, xp: 70, lvl: 22, description: 'Layered thermal wrap. Habitat III and cold-region gear need it.' },
  { id: 'craft-fertilizer', name: 'Fertilizer', input: { algae: 2, water: 1 }, output: { fertilizer: 2 }, xp: 60, lvl: 18, requiresResearch: 'fertilizer_synth', description: 'Cuts crop cycle time by a quarter when spread on a plot.' },
  { id: 'craft-steel-pick', name: 'Steel Pick', input: { iron_bar: 4, component: 1 }, gear: { pickaxe: 'steel' }, xp: 70 },
  { id: 'craft-titanium-pick', name: 'Titanium Pick', input: { titanium_bar: 5, component: 2 }, gear: { pickaxe: 'titanium' }, xp: 190, requiresBuilding: 'machine' },
  { id: 'craft-laser-pick', name: 'Laser Pick', input: { titanium_bar: 6, component: 4 }, gear: { pickaxe: 'laser' }, xp: 400, lvl: 20, requiresResearch: 'laser_optics', description: 'Vaporises rock. Top tier mining speed.' },
  { id: 'craft-mining-drone', name: 'Mining Drone', input: { titanium_bar: 4, component: 3 }, drone: true, xp: 150, lvl: 8, requiresPostgame: true, description: 'Autonomous rig that works a vein and delivers to the Depot.' },
  { id: 'craft-fuel-cell', name: 'Fuel Cell', input: { water: 2 }, output: { fuel: 1 }, xp: 20 },
  { id: 'craft-rover-2', name: 'Rover Mk2', input: { titanium_bar: 6, component: 4 }, gear: { rover: 'rover2' }, xp: 200, lvl: 12, requiresBuilding: 'machine' },
  { id: 'craft-rover-3', name: 'Rover Mk3', input: { titanium_bar: 10, component: 6 }, gear: { rover: 'rover3' }, xp: 420, lvl: 35, requiresBuilding: 'machine' },
];
// The 24 equipment recipes (6 slots x 4 tiers), same idiom as the source game.
for (const tier of EQUIP_TIERS) {
  const meta = EQUIP_TIER_META[tier];
  for (const slot of EQUIP_SLOTS) {
    const stat = EQUIP_SLOT_META[slot].stat;
    const value = EQUIP_STATS[slot][stat][EQUIP_TIERS.indexOf(tier)];
    CRAFT_RECIPES.push({
      id: `craft-equip-${tier}-${slot}`,
      name: `${capitalize(tier)} ${capitalize(slot)}`,
      input: meta.cost,
      gear: { equip: { slot, tier } },
      xp: meta.xp,
      lvl: meta.lvl,
      requiresBuilding: meta.requiresBuilding || null,
      requiresResearch: meta.requiresResearch || null,
      description: `+${value}${stat === 'pack' ? '' : '%'} ${statLabel(stat)}.`,
    });
  }
}
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
function statLabel(stat) {
  return { o2: 'O2 efficiency', crit: 'quality chance', speed: 'travel speed', geode: 'geode find', pack: 'pack capacity' }[stat] || stat;
}

// 20 projects in 3 gated tiers. A tier opens once RESEARCH_TIER_REQ projects in the
// tier below are done, so progression fans out rather than unlocking all at once.
export const RESEARCH_TIER_REQ = 3;
export const RESEARCH = [
  { id: 'drills', tier: 1, name: 'Reinforced Drills', input: { titanium_bar: 4, component: 4 }, description: 'Mining and ice work yield more on rich strikes.', effect: 'Faster gathering.' },
  { id: 'scrubbers', tier: 1, name: 'O2 Scrubbers', input: { component: 3, food: 10 }, description: 'Improves colony oxygen regeneration.', effect: '+0.06 O2 / tick.' },
  { id: 'loaders', tier: 1, name: 'Auto Loaders', input: { component: 4, titanium_bar: 6 }, description: 'Smelting has a chance to duplicate output.', effect: 'Faster smelting.' },
  { id: 'laser_optics', tier: 1, name: 'Laser Optics', input: { titanium_bar: 6, component: 6 }, description: 'Unlocks the Laser Pick at the forge.', effect: 'Best pickaxe.' },
  { id: 'grow_lights', tier: 1, name: 'Grow Lights', input: { glass: 3, component: 3 }, description: 'Crops grow 20% faster.', effect: '-20% crop cycle.' },
  { id: 'survey_markers', tier: 1, name: 'Survey Markers', input: { iron_bar: 6, glass: 2 }, description: 'Depleted veins respawn sooner.', effect: 'Faster respawns.' },
  { id: 'deep_drilling', tier: 2, name: 'Deep Drilling', input: { geode: 2, titanium_bar: 6 }, description: '+3% quality chance on ore veins.', effect: '+3% mining quality.' },
  { id: 'cryo_insulation', tier: 2, name: 'Cryo Insulation', input: { insulation: 3, glass: 3 }, description: '+3% purity chance on ice work.', effect: '+3% ice purity.' },
  { id: 'fertilizer_synth', tier: 2, name: 'Fertilizer Synthesis', input: { algae: 6, glass: 2 }, description: 'Unlocks the Fertilizer recipe at the forge.', effect: 'Fertilizer recipe.' },
  { id: 'grid_buffers', tier: 2, name: 'Grid Buffers', input: { component: 6, glass: 4 }, description: 'Colony power regeneration improves.', effect: '+0.05 Power / tick.' },
  { id: 'cargo_frame', tier: 2, name: 'Cargo Frame', input: { frame: 6, insulation: 2 }, description: '+2 pack slots.', effect: '+2 pack slots.' },
  { id: 'drone_tuning', tier: 2, name: 'Drone Tuning', input: { component: 8, geode: 1 }, description: 'Drones work two ticks faster.', effect: 'Faster drones.' },
  { id: 'thermal_recyclers', tier: 2, name: 'Thermal Recyclers', input: { insulation: 4, component: 4 }, description: 'Waste heat becomes oxygen.', effect: '+0.03 O2 / tick.' },
  { id: 'iridium_refining', tier: 3, name: 'Iridium Refining', input: { geode: 3, alloy: 4 }, description: 'Unlocks iridium smelting at the machine shop.', effect: 'Iridium bars.' },
  { id: 'quality_assay', tier: 3, name: 'Quality Assay', input: { geode: 4, glass: 6 }, description: 'Geodes turn up twice as often.', effect: '2x geode chance.' },
  { id: 'automation_core', tier: 3, name: 'Automation Core', input: { advanced_component: 2, alloy: 3 }, description: 'Overclock faults happen half as often.', effect: 'Safer overclock.' },
  { id: 'xeno_agronomy', tier: 3, name: 'Xeno-Agronomy', input: { berries: 8, geode: 2 }, description: 'Unlocks the Genefruit crop.', effect: 'Genefruit (best ration).' },
  { id: 'orbital_uplink', tier: 3, name: 'Orbital Uplink', input: { advanced_component: 3, alloy: 4 }, description: 'Mission Control guidance grants +3% xp to everything.', effect: '+3% all xp.' },
  { id: 'alloy_tempering', tier: 3, name: 'Alloy Tempering', input: { alloy: 6, iridium_bar: 2 }, description: 'Unlocks Composite equipment at the forge.', effect: 'Tier-4 gear.' },
  { id: 'emergency_protocols', tier: 3, name: 'Emergency Protocols', input: { advanced_component: 2, insulation: 4 }, description: 'The Survival emergency beacon restores twice as much.', effect: 'Stronger beacon.' },
];

export const BASE_PLOTS = 3;
export const DISEASE_CHANCE = 0.1;
export const CROPS = [
  { id: 'potato', name: 'Potato', item: 'food', lvl: 1, ticks: 14, water: 1, xp: 40, min: 1, max: 2 },
  { id: 'soy', name: 'Soy', item: 'soy', lvl: 15, ticks: 22, water: 1, xp: 70, min: 1, max: 2 },
  { id: 'algae', name: 'Algae Vat', item: 'algae', lvl: 30, ticks: 30, water: 2, xp: 110, min: 2, max: 3 },
  { id: 'berries', name: 'Hydro Berries', item: 'berries', lvl: 45, ticks: 40, water: 2, xp: 170, min: 1, max: 3 },
  { id: 'genefruit', name: 'Genefruit', item: 'genefruit', lvl: 60, ticks: 55, water: 3, xp: 260, min: 1, max: 2, requiresResearch: 'xeno_agronomy' },
];

// The 14-objective progression arc. `check` reads only canonical state, so an
// objective can never be completed by anything the client claims.
export const OBJECTIVES = [
  { id: 'obj-mine-iron', text: 'Mine 5 iron ore from a vein', check: (s) => stat(s, 'mined_iron_ore') >= 5 },
  { id: 'obj-smelt-iron', text: 'Smelt an Iron Bar at the machine shop', check: (s) => stat(s, 'smelted_iron_bar') >= 1 },
  { id: 'obj-craft-frames', text: 'Craft 3 Frames at the forge', check: (s) => stat(s, 'crafted_frame') >= 3 },
  { id: 'obj-build-solar', text: 'Build the Solar Array to secure power', check: (s) => !!s.built.solar },
  { id: 'obj-extract-ice', text: 'Extract 12 ice for the water supply', check: (s) => stat(s, 'mined_ice') >= 12 },
  { id: 'obj-build-water', text: 'Build the Water Plant', check: (s) => !!s.built.water },
  { id: 'obj-build-machine', text: 'Build the Machine Shop to reach titanium', check: (s) => !!s.built.machine },
  { id: 'obj-smelt-titanium', text: 'Smelt your first Titanium Bar', check: (s) => stat(s, 'smelted_titanium_bar') >= 1 },
  { id: 'obj-build-greenhouse', text: 'Build the Greenhouse', check: (s) => !!s.built.greenhouse },
  { id: 'obj-harvest-crops', text: 'Harvest 5 crops in the Greenhouse', check: (s) => stat(s, 'harvested_crop') >= 5 },
  { id: 'obj-build-lab', text: 'Build the Research Lab', check: (s) => !!s.built.lab },
  { id: 'obj-research-any', text: 'Complete any research project', check: (s) => RESEARCH.some((p) => s.research[p.id]) },
  { id: 'obj-build-reactor', text: 'Build the Fusion Reactor', check: (s) => !!s.built.reactor },
  { id: 'obj-endure-storm', text: 'Endure the Great Storm with O2 and Power above 50%', check: (s) => !!s.victory },
];

// The Great Storm: 250 ticks in 10 phases of 25.
export const STORM_TOTAL = 250;
export const STORM_PHASE = 25;

const ITEM_IDS = Object.keys(ITEMS);
const SKILL_IDS = Object.keys(SKILLS);
const BUILDING_IDS = BUILDINGS.map((b) => b.id);
const RESEARCH_IDS = RESEARCH.map((p) => p.id);
const REGION_IDS = Object.keys(REGIONS);
const ROVER_IDS = Object.keys(ROVERS);
const CROP_IDS = CROPS.map((c) => c.id);
const TIERED_IDS = Object.keys(BUILD_TIERS);
const BASE_PACK = 28;

export class GameError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.status = status;
  }
}

function stat(state, key) {
  return (state.stats && state.stats[key]) || 0;
}
function bump(state, key, n = 1) {
  state.stats[key] = (state.stats[key] || 0) + n;
}

export function createState(now = Date.now()) {
  return {
    version: ENGINE_VERSION,
    seq: 0,
    createdAt: now,
    updatedAt: now,
    lastTickAt: now,
    sol: 1,
    tickCount: 0,
    meters: { oxygen: 100, power: 100 },
    inventory: Object.fromEntries(ITEM_IDS.map((id) => [id, 0])),
    bank: {},
    skills: Object.fromEntries(SKILL_IDS.map((id) => [id, { xp: 0, level: 1 }])),
    built: Object.fromEntries(BUILDINGS.map((b) => [b.id, !!b.prebuilt])),
    tier: Object.fromEntries(TIERED_IDS.map((id) => [id, 1])),
    fault: {},
    overclock: false,
    research: Object.fromEntries(RESEARCH_IDS.map((id) => [id, false])),
    nodes: Object.fromEntries(allNodeDefs(null).map((n) => [n.id, { charges: n.charges, cooldownUntil: 0 }])),
    gear: { pickaxe: 'stone' },
    farm: { plots: freshPlots(BASE_PLOTS) },
    storm: { status: 'locked', phase: 0, remaining: 0, startedAt: 0, surgeIn: 0 },
    victory: false,
    postgame: false,
    drones: [],
    extraNodes: [],
    objective: 0,
    stats: {},
    beaconSol: 0,
    busyUntil: 0,
    player: { x: 5, y: 9 },
    currentRegion: 'landing_basin',
    rover: 'buggy',
    travel: null,
    equip: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])),
    commandIds: [],
    events: [{ tone: 'info', text: 'You step out of the lander. Mission Control: start with iron ore.' }],
  };
}

function freshPlots(count) {
  return Array.from({ length: count }, () => ({ crop: null, t: 0, disease: false, fert: false, rolled: false }));
}

// Node set is state-dependent: the expedition beacon and discovered rich veins only
// exist in the postgame, so every lookup goes through here rather than the constant.
function allNodeDefs(state) {
  const extra = state && Array.isArray(state.extraNodes) ? state.extraNodes : [];
  const exped = state && state.postgame ? [EXPEDITION_NODE] : [];
  return [...NODES, ...extra, ...exped];
}
function findNode(state, nodeId) {
  return allNodeDefs(state).find((n) => n.id === nodeId);
}
function nodeRegion(node) {
  return node.regionId || 'landing_basin';
}

/* ---------------------------------------------------------------- pack + bank */

export function packCap(state) {
  return BASE_PACK + equipStats(state).pack + (state.research.cargo_frame ? 2 : 0);
}
function stackSize(itemId) {
  return ITEMS[itemId]?.stack || 24;
}
export function packSlots(state) {
  return Object.entries(state.inventory)
    .reduce((total, [id, qty]) => total + (qty > 0 ? Math.ceil(qty / stackSize(id)) : 0), 0);
}
// Would adding n of id overflow the pack? Partial stacks still accept, which is why
// this counts slots rather than a flat item cap.
export function canCarry(state, itemId, n = 1) {
  const current = state.inventory[itemId] || 0;
  const currentSlots = current > 0 ? Math.ceil(current / stackSize(itemId)) : 0;
  const after = packSlots(state) - currentSlots + Math.ceil((current + n) / stackSize(itemId));
  return after <= packCap(state);
}
export function bankQty(state, itemId) {
  return (state.bank && state.bank[itemId]) || 0;
}
function addBank(state, itemId, n) {
  if (!ITEMS[itemId]) throw new GameError('BAD_ITEM', `Unknown item: ${itemId}`, 400);
  state.bank[itemId] = (state.bank[itemId] || 0) + n;
  if (state.bank[itemId] <= 0) delete state.bank[itemId];
}
// Loot never wedges the pack: it routes to the Depot when built, otherwise only as
// much as the pack can hold. Overflow is dropped, never a soft-block.
function award(state, itemId, n) {
  if (state.built.depot) { addBank(state, itemId, n); return n; }
  let fit = 0;
  for (let i = 0; i < n; i += 1) {
    if (!canCarry(state, itemId, 1)) break;
    addItem(state, itemId, 1);
    fit += 1;
  }
  return fit;
}

/* ------------------------------------------------------------------- sanitize */

export function sanitizeState(raw, now = Date.now()) {
  const base = createState(now);
  if (!raw || typeof raw !== 'object') return base;
  const research = cleanBoolMap(raw.research, RESEARCH_IDS);
  const state = {
    ...base,
    version: ENGINE_VERSION,
    seq: int(raw.seq, 0, 1_000_000_000),
    createdAt: int(raw.createdAt, 0, now) || now,
    updatedAt: int(raw.updatedAt, 0, now) || now,
    lastTickAt: int(raw.lastTickAt, 0, now) || now,
    sol: int(raw.sol, 1, 99_999),
    tickCount: int(raw.tickCount, 0, 1_000_000_000),
    meters: {
      oxygen: clamp(raw.meters?.oxygen, 0, 100),
      power: clamp(raw.meters?.power, 0, 100),
    },
    inventory: cleanNumberMap(raw.inventory, ITEM_IDS, 0, 99_999),
    bank: cleanBank(raw.bank),
    skills: cleanSkills(raw.skills),
    built: cleanBoolMap(raw.built, BUILDING_IDS, { habitat: true }),
    tier: cleanTiers(raw.tier),
    fault: cleanBoolMap(raw.fault, BUILDING_IDS),
    overclock: !!raw.overclock,
    research,
    gear: { pickaxe: PICK_ORDER.includes(raw.gear?.pickaxe) ? raw.gear.pickaxe : 'stone' },
    storm: cleanStorm(raw.storm),
    victory: !!raw.victory,
    postgame: !!raw.postgame,
    extraNodes: cleanExtraNodes(raw.extraNodes),
    objective: int(raw.objective, 0, OBJECTIVES.length),
    stats: cleanStats(raw.stats),
    beaconSol: int(raw.beaconSol, 0, 99_999),
    busyUntil: int(raw.busyUntil, 0, now + 86_400_000),
    player: { x: int(raw.player?.x, 0, 10), y: int(raw.player?.y, 0, 10) },
    currentRegion: REGION_IDS.includes(raw.currentRegion) ? raw.currentRegion : 'landing_basin',
    rover: ROVER_IDS.includes(raw.rover) ? raw.rover : 'buggy',
    travel: cleanTravel(raw.travel, now),
    equip: cleanEquip(raw),
    commandIds: Array.isArray(raw.commandIds) ? raw.commandIds.filter((id) => typeof id === 'string').slice(-40) : [],
    events: cleanEvents(raw.events),
  };
  if (!state.built.habitat) state.built.habitat = true;
  state.farm = { plots: cleanPlots(raw.farm, state) };
  state.nodes = cleanNodes(raw.nodes, state);
  state.drones = cleanDrones(raw.drones, state);
  return state;
}

/* -------------------------------------------------------------------- systems */

export function passiveRates(state, opts = {}) {
  const tierOf = (id) => state.tier[id] || 1;
  const up = (id, i, key) => BUILD_TIERS[id]?.[i]?.[key] || 0;
  const online = (id) => state.built[id] && !state.fault[id];
  let o2 = 0;
  let power = 0;
  if (online('habitat')) o2 += 0.05 + (tierOf('habitat') >= 2 ? up('habitat', 0, 'o2') : 0) + (tierOf('habitat') >= 3 ? up('habitat', 1, 'o2') : 0);
  if (online('greenhouse')) o2 += 0.06 + (tierOf('greenhouse') >= 2 ? up('greenhouse', 0, 'o2') : 0) + (tierOf('greenhouse') >= 3 ? up('greenhouse', 1, 'o2') : 0);
  if (state.research.scrubbers) o2 += 0.06;
  if (state.research.thermal_recyclers) o2 += 0.03;
  if (online('solar') && !opts.solarBlind) power += 0.09 + (tierOf('solar') >= 2 ? up('solar', 0, 'power') : 0) + (tierOf('solar') >= 3 ? up('solar', 1, 'power') : 0);
  if (online('reactor')) power += 0.4;
  if (state.research.grid_buffers) power += 0.05;
  if (state.overclock) { o2 *= OVERCLOCK_MULT; power *= OVERCLOCK_MULT; }
  return { oxygen: -0.04 + o2, power: -0.05 + power };
}

function survivalTick(state) {
  const storming = state.storm.status === 'active';
  const rates = passiveRates(state, { solarBlind: storming });
  let { oxygen, power } = rates;
  if (storming) {
    const mult = Math.max(0.7, 1 - state.skills.survival.level * 0.006);
    oxygen -= 0.34 * mult;
    power -= 0.55 * mult;
  }
  const stats = equipStats(state);
  if (oxygen < 0) oxygen *= (1 - stats.o2 / 100);
  const survival = state.skills.survival.level;
  if (survival >= 25 && state.meters.oxygen < 15 && oxygen < 0) oxygen *= 0.5; // low-O2 grace
  state.meters.oxygen = clamp(state.meters.oxygen + oxygen, 0, 100);
  state.meters.power = clamp(state.meters.power + power, 0, 100);
  // Emergency beacon: one automatic rescue per sol from Survival 50.
  if (survival >= 50 && state.sol > state.beaconSol && (state.meters.oxygen < 5 || state.meters.power < 5)) {
    const boost = state.research.emergency_protocols ? 30 : 15;
    state.meters.oxygen = clamp(state.meters.oxygen + boost, 0, 100);
    state.meters.power = clamp(state.meters.power + boost, 0, 100);
    state.beaconSol = state.sol;
    addEvent(state, 'warn', 'Emergency beacon fired. O2 and Power partially restored.');
  }
}

export function cropNeed(state, plot) {
  const crop = CROPS.find((c) => c.id === plot.crop);
  if (!crop) return 0;
  let need = crop.ticks;
  if (state.research.grow_lights) need *= 0.8;
  if (plot.fert) need *= 0.75;
  return Math.max(4, Math.round(need));
}

function farmTick(state) {
  if (!state.built.greenhouse) return;
  state.farm.plots.forEach((plot, index) => {
    if (!plot.crop || plot.disease) return;
    const need = cropNeed(state, plot);
    if (plot.t >= need) return;
    plot.t += 1;
    // One disease roll per crop, at the halfway point. Blight pauses growth; it
    // never kills the crop.
    if (plot.t === Math.ceil(need / 2) && !plot.rolled) {
      plot.rolled = true;
      if (Math.random() < DISEASE_CHANCE) {
        plot.disease = true;
        addEvent(state, 'warn', `Blight has taken plot ${index + 1}. Growth is paused until treated.`);
        return;
      }
    }
    if (plot.t >= need) addEvent(state, 'good', `Plot ${index + 1} is ready to harvest.`);
  });
}

export function droneCap(state) {
  return Math.min(3, 1 + Math.floor(state.skills.robotics.level / 10));
}

function droneTick(state) {
  if (!state.drones.length) return;
  let interval = Math.max(6, 12 - Math.floor(state.skills.robotics.level / 8));
  if (state.research.drone_tuning) interval = Math.max(4, interval - 2);
  for (const drone of state.drones) {
    drone.t = (drone.t || 0) + 1;
    if (drone.t < interval) continue;
    drone.t = 0;
    const node = findNode(state, drone.nodeId);
    if (!node) continue;
    if (state.built.depot) addBank(state, node.item, 1);
    else if (canCarry(state, node.item, 1)) addItem(state, node.item, 1);
    else continue;
    gainSkill(state, 'robotics', 8);
    bump(state, `drone_${node.item}`);
  }
}

function overclockTick(state) {
  if (!state.overclock) return;
  let chance = FAULT_CHANCE;
  if (state.research.automation_core) chance *= 0.5;
  if (Math.random() >= chance) return;
  const candidates = FAULTABLE.filter((id) => state.built[id] && !state.fault[id]);
  if (!candidates.length) return;
  const id = candidates[Math.floor(Math.random() * candidates.length)];
  state.fault[id] = true;
  addEvent(state, 'warn', `Overclock fault: the ${buildingName(id)} tripped offline. Service it to restore output.`);
}

function stormTick(state) {
  if (state.storm.status !== 'active') return;
  state.storm.remaining -= 1;
  state.storm.phase = Math.min(10, Math.floor((STORM_TOTAL - state.storm.remaining) / STORM_PHASE) + 1);
  state.storm.surgeIn -= 1;
  if (state.storm.surgeIn <= 0) {
    state.storm.surgeIn = 30 + Math.floor(Math.random() * 22);
    const soften = state.skills.survival.level >= 40 ? 2 : 0; // Survival 40 perk
    if (Math.random() < 0.5) {
      state.meters.oxygen = clamp(state.meters.oxygen - (6 - soften), 0, 100);
      addEvent(state, 'warn', `A pressure spike hits the domes. Oxygen -${6 - soften}.`);
    } else {
      state.meters.power = clamp(state.meters.power - (9 - soften), 0, 100);
      addEvent(state, 'warn', `Grit chokes the intakes. Power -${9 - soften}.`);
    }
  }
  if (state.meters.oxygen < 50 || state.meters.power < 50) { failStorm(state); return; }
  if (state.storm.remaining <= 0) winStorm(state);
}

function failStorm(state) {
  state.storm = { status: 'ready', phase: 0, remaining: 0, startedAt: 0, surgeIn: 0 };
  state.meters.oxygen = Math.max(state.meters.oxygen, 55);
  state.meters.power = Math.max(state.meters.power, 55);
  addEvent(state, 'warn', 'Storm protocol failed. A meter fell below 50%. Restock and retry.');
}

function winStorm(state) {
  state.storm = { status: 'won', phase: 10, remaining: 0, startedAt: 0, surgeIn: 0 };
  state.victory = true;
  state.postgame = true;
  gainSkill(state, 'survival', 200);
  addEvent(state, 'good', 'The colony endured the Great Storm. New Expedition+ is open: Robotics and Exploration are live.');
}

function respawnTick(state, now) {
  for (const node of allNodeDefs(state)) {
    const entry = state.nodes[node.id];
    if (entry && entry.cooldownUntil && now >= entry.cooldownUntil) {
      entry.charges = node.charges;
      entry.cooldownUntil = 0;
    }
  }
}

function objectiveTick(state) {
  while (state.objective < OBJECTIVES.length) {
    const objective = OBJECTIVES[state.objective];
    if (!objective.check(state)) break;
    state.objective += 1;
    addEvent(state, 'good', `Objective complete: ${objective.text}`);
  }
}

export function totalLevel(state) {
  return SKILL_IDS.reduce((sum, id) => sum + state.skills[id].level, 0);
}

/* --------------------------------------------------------------------- ticking */

export function advanceState(input, now = Date.now()) {
  const state = sanitizeState(input, now);
  const elapsed = Math.max(0, now - state.lastTickAt);
  const ticks = Math.min(MAX_OFFLINE_TICKS, Math.floor(elapsed / TICK_MS));
  if (ticks <= 0) return state;

  for (let i = 0; i < ticks; i += 1) {
    state.tickCount += 1;
    if (state.tickCount % TICKS_PER_SOL === 0) {
      state.sol += 1;
      gainSkill(state, 'survival', 6);
      addEvent(state, 'info', `Sol ${state.sol} begins.`);
    }
    survivalTick(state);
    farmTick(state);
    droneTick(state);
    overclockTick(state);
    stormTick(state);
  }
  state.lastTickAt += ticks * TICK_MS;
  respawnTick(state, now);

  // Travel resolves against real elapsed time, not the tick grid above — a rover trip
  // is an arrival timestamp, not a running counter.
  if (state.travel && now >= state.travel.arrivalAt) {
    const region = REGIONS[state.travel.destRegion];
    state.currentRegion = state.travel.destRegion;
    state.travel = null;
    if (region) {
      gainSkill(state, 'piloting', region.home ? 30 : 50);
      addEvent(state, 'good', `Arrived at ${region.name}.`);
    }
  }
  objectiveTick(state);
  state.updatedAt = now;
  return state;
}

export function applyCommand(input, command, now = Date.now()) {
  if (!command || typeof command !== 'object') {
    throw new GameError('BAD_COMMAND', 'Command body is required', 400);
  }
  const state = advanceState(input, now);
  const commandId = typeof command.id === 'string' ? command.id : '';
  if (commandId && state.commandIds.includes(commandId)) {
    return { state, events: [] };
  }

  const beforeEvents = state.events.length;
  switch (command.type) {
    case 'gather': gather(state, command.nodeId, now); break;
    case 'build': build(state, command.buildingId); break;
    case 'upgrade': upgrade(state, command.buildingId); break;
    case 'overclock': setOverclock(state, command.on); break;
    case 'smelt': smelt(state, command.recipeId, now); break;
    case 'craft': craft(state, command.recipeId); break;
    case 'purify': purify(state, now); break;
    case 'service': service(state, command.buildingId); break;
    case 'plant': plant(state, command.plotIndex, command.cropId, command.useFertilizer); break;
    case 'harvest': harvest(state, command.plotIndex); break;
    case 'treat': treat(state, command.plotIndex); break;
    case 'research': research(state, command.projectId); break;
    case 'ration': ration(state, command.itemId); break;
    case 'deposit': deposit(state, command.itemId, command.qty); break;
    case 'withdraw': withdraw(state, command.itemId, command.qty); break;
    case 'depositAll': depositAll(state); break;
    case 'deployDrone': deployDrone(state, command.nodeId); break;
    case 'startStorm': startStorm(state, now); break;
    case 'travel': travel(state, command.destRegion, now); break;
    case 'tick': addEvent(state, 'info', 'Mission clock advanced.'); break;
    case 'reset': return { state: createState(now), events: [{ tone: 'warn', text: 'Colony reset.' }] };
    default:
      throw new GameError('UNKNOWN_COMMAND', `Unknown command: ${command.type}`, 400);
  }

  objectiveTick(state);
  if (commandId) state.commandIds = [...state.commandIds, commandId].slice(-40);
  state.seq += 1;
  state.updatedAt = now;
  return { state, events: state.events.slice(0, Math.max(0, state.events.length - beforeEvents)) };
}

export function publicState(input, now = Date.now()) {
  const state = advanceState(input, now);
  return {
    ...state,
    stats: state.stats,
    derived: {
      equip: equipStats(state),
      packCap: packCap(state),
      packSlots: packSlots(state),
      droneCap: droneCap(state),
      totalLevel: totalLevel(state),
      objective: OBJECTIVES[state.objective] ? OBJECTIVES[state.objective].text : null,
      openResearchTiers: [1, 2, 3].filter((tier) => researchTierOpen(state, tier)),
    },
    catalog: {
      items: ITEMS, skills: SKILLS, nodes: allNodeDefs(state), buildings: BUILDINGS,
      buildTiers: BUILD_TIERS, smeltRecipes: SMELT_RECIPES, craftRecipes: CRAFT_RECIPES,
      research: RESEARCH, regions: REGIONS, futureRegions: FUTURE_REGIONS, rovers: ROVERS,
      picks: PICKS, crops: CROPS, edibles: EDIBLES,
      objectives: OBJECTIVES.map((o) => ({ id: o.id, text: o.text })),
    },
  };
}

/* -------------------------------------------------------------------- commands */

// Quality "crit" doubles yield and xp, and grows within a tier — so leveling past a
// node's gate keeps paying off rather than only unlocking the next node.
// Action durations, in 600 ms ticks. These are the pacing model the whole balance
// baseline is computed from, and the authority enforces them: without a duration a
// client could spam `gather` and mint xp as fast as it could send requests.
export function gatherTicks(state, node) {
  const skill = node.type === 'ice' ? 'water' : 'mining';
  let base = node.hard || 3;
  if (node.type !== 'ice') base = Math.round(base * PICKS[state.gear.pickaxe].mult);
  base -= Math.floor(state.skills[skill].level / 12);
  if (state.research.drills) base -= 1;
  return Math.max(2, base);
}

export function smeltTicks(state, recipe) {
  let need = recipe.ticks || 4;
  if (state.research.loaders) need -= 1;
  const tier = state.tier.machine || 1;
  need -= (tier >= 2 ? 1 : 0) + (tier >= 3 ? 1 : 0);
  return Math.max(2, need);
}

function requireIdle(state, now) {
  if (state.busyUntil && now < state.busyUntil) {
    throw new GameError('BUSY', 'Still working on the previous action.', 429);
  }
}
function occupy(state, now, ticks) {
  state.busyUntil = now + ticks * TICK_MS;
}

export function critChance(state, node) {
  const skill = node.type === 'ice' ? 'water' : 'mining';
  const level = state.skills[skill].level;
  let chance = Math.max(0, (level - (node.lvl || 1)) * 0.4);
  chance += equipStats(state).crit;
  if (node.type !== 'ice') {
    chance += PICKS[state.gear.pickaxe].crit || 0;
    if (state.research.deep_drilling) chance += 3;
  } else if (state.research.cryo_insulation) chance += 3;
  return Math.min(40, chance) / 100;
}

export function geodeChance(state) {
  let chance = 2 + equipStats(state).geode;
  if (state.research.quality_assay) chance *= 2;
  return chance / 100;
}

function gather(state, nodeId, now) {
  const node = findNode(state, nodeId);
  if (!node) throw new GameError('NODE_NOT_FOUND', 'Resource node not found', 404);
  if (nodeRegion(node) !== state.currentRegion) {
    throw new GameError('WRONG_REGION', `${node.name} is not in your current region.`);
  }
  if (node.requiresBuilding && !state.built[node.requiresBuilding]) {
    throw new GameError('NODE_LOCKED', `${node.name} requires ${buildingName(node.requiresBuilding)}.`);
  }
  const skill = node.skill;
  if (node.lvl && state.skills[skill].level < node.lvl) {
    throw new GameError('LEVEL_LOW', `${node.name} requires ${SKILLS[skill].name} level ${node.lvl}.`);
  }
  requireIdle(state, now);
  const entry = state.nodes[node.id] || { charges: node.charges, cooldownUntil: 0 };
  if (entry.cooldownUntil > now) throw new GameError('NODE_COOLDOWN', `${node.name} is respawning.`);
  if (entry.charges <= 0) {
    entry.cooldownUntil = now + respawnMs(state);
    state.nodes[node.id] = entry;
    throw new GameError('NODE_DEPLETED', `${node.name} is respawning.`);
  }

  const crit = Math.random() < critChance(state, node);
  const base = node.yieldBase || 1;
  const drillBonus = state.research.drills && Math.random() < 0.18 ? 1 : 0;
  const qty = base * (crit ? 2 : 1) + drillBonus;
  if (!canCarry(state, node.item, qty)) throw new GameError('PACK_FULL', 'Pack is full.');
  addItem(state, node.item, qty);
  bump(state, `mined_${node.item}`, qty);
  gainSkill(state, skill, node.xp * (crit ? 2 : 1));

  if (node.type !== 'ice' && Math.random() < geodeChance(state)) {
    award(state, 'geode', 1);
    gainSkill(state, 'mining', 12);
    addEvent(state, 'good', 'Scanner pinged a geode in the spoil.');
  }
  // Exploration treks can turn up a rich vein — a permanent extra node.
  if (node.type === 'explore') {
    gainSkill(state, 'exploration', 40);
    if (Math.random() < 0.12) discoverRichVein(state);
  }
  entry.charges -= 1;
  if (entry.charges <= 0) {
    entry.charges = 0;
    entry.cooldownUntil = now + respawnMs(state);
  }
  state.nodes[node.id] = entry;
  state.player = { x: node.x, y: node.y };
  occupy(state, now, gatherTicks(state, node));
  addEvent(state, 'good', `Gathered ${qty} ${ITEMS[node.item].name}${crit ? ' (quality strike)' : ''}.`);
}

function respawnMs(state) {
  return (state.research.survey_markers ? 4 : 6) * TICKS_PER_SOL * TICK_MS / 10;
}

function discoverRichVein(state) {
  if (state.extraNodes.length >= 3) return;
  const index = state.extraNodes.length + 1;
  const vein = {
    id: `rich-vein-${index}`, name: `Rich Vein ${index}`, type: 'ore', item: 'titanium_ore',
    skill: 'mining', xp: 120, hard: 6, lvl: 25, yieldBase: 2, x: 1 + index, y: 1, charges: NODE_CHARGES,
  };
  state.extraNodes.push(vein);
  state.nodes[vein.id] = { charges: vein.charges, cooldownUntil: 0 };
  addEvent(state, 'good', `Survey trek found ${vein.name}.`);
}

function build(state, buildingId) {
  const building = BUILDINGS.find((b) => b.id === buildingId);
  if (!building) throw new GameError('BUILDING_NOT_FOUND', 'Building not found', 404);
  if (state.currentRegion !== 'landing_basin') {
    throw new GameError('AWAY_FROM_BASIN', 'Construction happens at the Landing Basin. Drive home first.');
  }
  if (state.built[building.id]) throw new GameError('ALREADY_BUILT', `${building.name} is already online.`);
  spendItems(state, building.cost);
  state.built[building.id] = true;
  state.player = { x: building.x, y: building.y };
  gainSkill(state, 'engineering', 45);
  addEvent(state, 'good', `${building.name} is online.`);
  if (allBuildingsOnline(state) && state.storm.status === 'locked' && !state.victory) {
    state.storm.status = 'ready';
    addEvent(state, 'warn', 'Great Storm detected. Stock food, oxygen, and power before starting.');
  }
}

function upgrade(state, buildingId) {
  const tiers = BUILD_TIERS[buildingId];
  if (!tiers) throw new GameError('NOT_UPGRADABLE', 'That structure has no upgrade path.');
  if (!state.built[buildingId]) throw new GameError('BUILDING_REQUIRED', `Build the ${buildingName(buildingId)} first.`);
  if (state.currentRegion !== 'landing_basin') {
    throw new GameError('AWAY_FROM_BASIN', 'Upgrades happen at the Landing Basin. Drive home first.');
  }
  const current = state.tier[buildingId] || 1;
  if (current >= MAX_TIER) throw new GameError('MAX_TIER', `${buildingName(buildingId)} is already at tier III.`);
  const step = tiers[current - 1];
  if (state.skills.engineering.level < step.engLvl) {
    throw new GameError('LEVEL_LOW', `Tier ${current + 1} needs Engineering ${step.engLvl}.`);
  }
  spendItems(state, step.cost);
  state.tier[buildingId] = current + 1;
  if (step.plot) state.farm.plots.push({ crop: null, t: 0, disease: false, fert: false, rolled: false });
  gainSkill(state, 'engineering', 60 * current);
  addEvent(state, 'good', `${buildingName(buildingId)} upgraded to tier ${romanTier(current + 1)}.`);
}

function romanTier(n) {
  return ['I', 'II', 'III'][n - 1] || String(n);
}

function setOverclock(state, on) {
  if (state.skills.engineering.level < OVERCLOCK_LVL) {
    throw new GameError('LEVEL_LOW', `Overclock needs Engineering ${OVERCLOCK_LVL}.`);
  }
  state.overclock = !!on;
  addEvent(state, on ? 'warn' : 'info', on
    ? 'Systems overclocked. Output up 35%, but structures may fault.'
    : 'Overclock disengaged.');
}

function service(state, buildingId) {
  const building = BUILDINGS.find((b) => b.id === buildingId && state.built[b.id]);
  if (!building) throw new GameError('BUILDING_NOT_FOUND', 'Online building not found', 404);
  const faulted = !!state.fault[building.id];
  if (faulted) delete state.fault[building.id];
  const level = state.skills.engineering.level;
  state.meters.power = clamp(state.meters.power + 5 + Math.floor(level / 2), 0, 100);
  state.meters.oxygen = clamp(state.meters.oxygen + 3 + Math.floor(level / 3), 0, 100);
  gainSkill(state, 'engineering', 34);
  state.player = { x: building.x, y: building.y };
  addEvent(state, 'good', faulted
    ? `Cleared the fault on ${building.name}. Output restored.`
    : `Serviced ${building.name}.`);
}

function smelt(state, recipeId, now) {
  const recipe = SMELT_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) throw new GameError('RECIPE_NOT_FOUND', 'Smelting recipe not found', 404);
  if (state.currentRegion !== 'landing_basin') {
    throw new GameError('AWAY_FROM_BASIN', 'The Machine Shop is back at the Landing Basin. Drive home to smelt.');
  }
  requireUnlocks(state, recipe);
  requireIdle(state, now);
  if (state.meters.power < recipe.power) throw new GameError('POWER_LOW', 'Power too low to run the machine shop.');
  spendItems(state, recipe.input);
  const multiplier = state.research.loaders && Math.random() < 0.12 ? 2 : 1;
  addItems(state, scaleItems(recipe.output, multiplier));
  for (const id of Object.keys(recipe.output)) bump(state, `smelted_${id}`, multiplier);
  state.meters.power = clamp(state.meters.power - recipe.power, 0, 100);
  gainSkill(state, 'fabrication', recipe.xp);
  state.player = { x: 7, y: 8 };
  occupy(state, now, smeltTicks(state, recipe));
  addEvent(state, 'good', `${recipe.name} complete${multiplier > 1 ? ' with duplicate output' : ''}.`);
}

function craft(state, recipeId) {
  const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) throw new GameError('RECIPE_NOT_FOUND', 'Crafting recipe not found', 404);
  requireUnlocks(state, recipe);
  if (recipe.lvl && state.skills.fabrication.level < recipe.lvl) {
    throw new GameError('LEVEL_LOW', `${recipe.name} requires Fabrication level ${recipe.lvl}.`);
  }
  if (recipe.drone && state.drones.length >= droneCap(state)) {
    throw new GameError('DRONE_CAP', `Drone cap is ${droneCap(state)}. Train Robotics to raise it.`);
  }
  spendItems(state, recipe.input);
  if (recipe.output) {
    addItems(state, recipe.output);
    for (const id of Object.keys(recipe.output)) bump(state, `crafted_${id}`, recipe.output[id]);
  }
  if (recipe.gear) applyGear(state, recipe.gear);
  if (recipe.drone) {
    state.drones.push({ nodeId: null, t: 0 });
    addEvent(state, 'info', 'Drone built. Deploy it to a vein from the colony panel.');
  }
  gainSkill(state, 'fabrication', recipe.xp);
  state.player = { x: 7, y: 8 };
  addEvent(state, 'good', `Fabricated ${recipe.name}.`);
}

function requireUnlocks(state, recipe) {
  if (recipe.requiresBuilding && !state.built[recipe.requiresBuilding]) {
    throw new GameError('RECIPE_LOCKED', `${recipe.name} requires ${buildingName(recipe.requiresBuilding)}.`);
  }
  if (recipe.requiresResearch && !state.research[recipe.requiresResearch]) {
    throw new GameError('RESEARCH_REQUIRED', `${recipe.name} requires ${researchName(recipe.requiresResearch)}.`);
  }
  if (recipe.requiresPostgame && !state.postgame) {
    throw new GameError('POSTGAME_REQUIRED', `${recipe.name} unlocks in New Expedition+ after the Great Storm.`);
  }
}

function applyGear(state, gear) {
  if (gear.pickaxe) {
    if (PICK_ORDER.indexOf(gear.pickaxe) <= PICK_ORDER.indexOf(state.gear.pickaxe)) {
      throw new GameError('NO_DOWNGRADE', 'You already have an equal or better pickaxe.');
    }
    state.gear.pickaxe = gear.pickaxe;
  }
  if (gear.rover) {
    if (ROVER_ORDER.indexOf(gear.rover) <= ROVER_ORDER.indexOf(state.rover)) {
      throw new GameError('NO_DOWNGRADE', 'You already have an equal or better rover.');
    }
    state.rover = gear.rover;
  }
  if (gear.equip) {
    const { slot, tier } = gear.equip;
    const current = state.equip[slot];
    if (current && EQUIP_TIERS.indexOf(tier) <= EQUIP_TIERS.indexOf(current)) {
      throw new GameError('NO_DOWNGRADE', 'You already have an equal or better item in that slot.');
    }
    state.equip[slot] = tier;
  }
}

function purify(state, now) {
  if (!state.built.water) throw new GameError('BUILDING_REQUIRED', 'Build the Water Plant first.');
  requireIdle(state, now);
  const yieldQty = 1 + (state.tier.water >= 2 ? 1 : 0) + (state.tier.water >= 3 ? 1 : 0);
  spendItems(state, { ice: 1 });
  addItem(state, 'water', yieldQty);
  gainSkill(state, 'water', 16);
  state.player = { x: 2, y: 6 };
  occupy(state, now, Math.max(2, 4 - (state.tier.water >= 2 ? 1 : 0)));
  addEvent(state, 'good', `Purified ${yieldQty} Water.`);
}

function plotAt(state, plotIndex) {
  const index = int(plotIndex, 0, state.farm.plots.length - 1);
  const plot = state.farm.plots[index];
  if (!plot) throw new GameError('PLOT_NOT_FOUND', 'Plot not found', 404);
  return { index, plot };
}

function plant(state, plotIndex, cropId, useFertilizer) {
  if (!state.built.greenhouse) throw new GameError('BUILDING_REQUIRED', 'Build the Greenhouse first.');
  const { index, plot } = plotAt(state, plotIndex);
  if (plot.crop) throw new GameError('PLOT_BUSY', `Plot ${index + 1} is already planted.`);
  const crop = CROPS.find((c) => c.id === cropId);
  if (!crop) throw new GameError('CROP_NOT_FOUND', 'Crop not found', 404);
  if (state.skills.agriculture.level < crop.lvl) {
    throw new GameError('LEVEL_LOW', `${crop.name} needs Agriculture ${crop.lvl}.`);
  }
  if (crop.requiresResearch && !state.research[crop.requiresResearch]) {
    throw new GameError('RESEARCH_REQUIRED', `${crop.name} requires ${researchName(crop.requiresResearch)}.`);
  }
  const cost = { water: crop.water };
  if (useFertilizer) cost.fertilizer = 1;
  spendItems(state, cost);
  state.farm.plots[index] = { crop: crop.id, t: 0, disease: false, fert: !!useFertilizer, rolled: false };
  state.player = { x: 8, y: 6 };
  addEvent(state, 'info', `Planted ${crop.name} in plot ${index + 1}${useFertilizer ? ' with fertilizer' : ''}.`);
}

function harvest(state, plotIndex) {
  const { index, plot } = plotAt(state, plotIndex);
  if (!plot.crop) throw new GameError('PLOT_EMPTY', `Plot ${index + 1} is empty.`);
  if (plot.disease) throw new GameError('PLOT_DISEASED', `Plot ${index + 1} is blighted. Treat it first.`);
  const crop = CROPS.find((c) => c.id === plot.crop);
  if (plot.t < cropNeed(state, plot)) throw new GameError('CROP_NOT_READY', `Plot ${index + 1} is not ready.`);
  const qty = crop.min + Math.floor(Math.random() * (crop.max - crop.min + 1));
  award(state, crop.item, qty);
  bump(state, 'harvested_crop', qty);
  gainSkill(state, 'agriculture', crop.xp);
  state.farm.plots[index] = { crop: null, t: 0, disease: false, fert: false, rolled: false };
  state.player = { x: 8, y: 6 };
  addEvent(state, 'good', `Harvested ${qty} ${ITEMS[crop.item].name}.`);
}

function treat(state, plotIndex) {
  const { index, plot } = plotAt(state, plotIndex);
  if (!plot.disease) throw new GameError('PLOT_HEALTHY', `Plot ${index + 1} is not blighted.`);
  spendItems(state, { water: 1 });
  plot.disease = false;
  gainSkill(state, 'agriculture', 25);
  addEvent(state, 'good', `Treated the blight in plot ${index + 1}. Growth resumes.`);
}

export function researchTierOpen(state, tier) {
  if (tier === 1) return true;
  const done = RESEARCH.filter((p) => p.tier === tier - 1 && state.research[p.id]).length;
  return done >= RESEARCH_TIER_REQ;
}

function research(state, projectId) {
  if (state.currentRegion !== 'landing_basin') {
    throw new GameError('AWAY_FROM_BASIN', 'The Research Lab is back at the Landing Basin. Drive home first.');
  }
  if (!state.built.lab) throw new GameError('BUILDING_REQUIRED', 'Build the Research Lab first.');
  const project = RESEARCH.find((p) => p.id === projectId);
  if (!project) throw new GameError('PROJECT_NOT_FOUND', 'Research project not found', 404);
  if (state.research[project.id]) throw new GameError('PROJECT_DONE', `${project.name} is already researched.`);
  if (!researchTierOpen(state, project.tier)) {
    throw new GameError('TIER_LOCKED', `Tier ${project.tier} needs ${RESEARCH_TIER_REQ} tier-${project.tier - 1} projects first.`);
  }
  spendItems(state, project.input);
  state.research[project.id] = true;
  if (project.id === 'cargo_frame') addEvent(state, 'info', 'Cargo frame fitted: +2 pack slots.');
  gainSkill(state, 'research', 140);
  state.player = { x: 5, y: 5 };
  addEvent(state, 'good', `Research complete: ${project.name}.`);
}

function ration(state, itemId) {
  const id = EDIBLES[itemId] ? itemId : 'food';
  spendItems(state, { [id]: 1 });
  const restore = EDIBLES[id] + Math.floor(state.skills.survival.level / 2);
  state.meters.oxygen = clamp(state.meters.oxygen + restore, 0, 100);
  gainSkill(state, 'survival', 14);
  addEvent(state, 'good', `Rationed ${ITEMS[id].name}. Oxygen +${restore}.`);
}

/* ------------------------------------------------------------- Colony Depot */

function requireDepot(state) {
  if (!state.built.depot) throw new GameError('BUILDING_REQUIRED', 'Build the Colony Depot first.');
  if (state.currentRegion !== 'landing_basin') {
    throw new GameError('AWAY_FROM_BASIN', 'The Depot is back at the Landing Basin. Drive home first.');
  }
}

function deposit(state, itemId, qty) {
  requireDepot(state);
  if (!ITEMS[itemId]) throw new GameError('BAD_ITEM', `Unknown item: ${itemId}`, 400);
  const moved = Math.min(int(qty, 0, 99_999), state.inventory[itemId] || 0);
  if (moved <= 0) throw new GameError('NOTHING_TO_MOVE', `No ${ITEMS[itemId].name} to deposit.`);
  addItem(state, itemId, -moved);
  addBank(state, itemId, moved);
  addEvent(state, 'info', `Deposited ${moved} ${ITEMS[itemId].name}.`);
}

function withdraw(state, itemId, qty) {
  requireDepot(state);
  if (!ITEMS[itemId]) throw new GameError('BAD_ITEM', `Unknown item: ${itemId}`, 400);
  const wanted = Math.min(int(qty, 0, 99_999), bankQty(state, itemId));
  if (wanted <= 0) throw new GameError('NOTHING_TO_MOVE', `No ${ITEMS[itemId].name} banked.`);
  if (!canCarry(state, itemId, wanted)) throw new GameError('PACK_FULL', 'Not enough pack space.');
  addBank(state, itemId, -wanted);
  addItem(state, itemId, wanted);
  addEvent(state, 'info', `Withdrew ${wanted} ${ITEMS[itemId].name}.`);
}

function depositAll(state) {
  requireDepot(state);
  let moved = 0;
  for (const itemId of ITEM_IDS) {
    const qty = state.inventory[itemId] || 0;
    if (qty <= 0) continue;
    addItem(state, itemId, -qty);
    addBank(state, itemId, qty);
    moved += qty;
  }
  if (!moved) throw new GameError('NOTHING_TO_MOVE', 'The pack is already empty.');
  addEvent(state, 'info', `Deposited ${moved} items into the Depot.`);
}

function deployDrone(state, nodeId) {
  const drone = state.drones.find((d) => !d.nodeId);
  if (!drone) throw new GameError('NO_IDLE_DRONE', 'No idle drone. Build one at the forge.');
  const node = findNode(state, nodeId);
  if (!node) throw new GameError('NODE_NOT_FOUND', 'Resource node not found', 404);
  drone.nodeId = node.id;
  drone.t = 0;
  addEvent(state, 'good', `Drone assigned to ${node.name}.`);
}

function startStorm(state, now) {
  if (state.storm.status === 'won' || state.victory) throw new GameError('STORM_DONE', 'The Great Storm is already behind you.');
  if (!allBuildingsOnline(state)) throw new GameError('COLONY_INCOMPLETE', 'All colony systems must be online before the storm.');
  if (state.meters.oxygen < 70 || state.meters.power < 70) {
    throw new GameError('RESERVES_LOW', 'Start with oxygen and power at 70% or higher.');
  }
  state.storm = { status: 'active', phase: 1, remaining: STORM_TOTAL, startedAt: now, surgeIn: 35 };
  addEvent(state, 'warn', 'The Great Storm begins. Hold oxygen and power above 50% through all 10 phases.');
}

function travel(state, destRegion, now) {
  const region = REGIONS[destRegion];
  if (!region) throw new GameError('REGION_NOT_FOUND', 'Unknown region', 404);
  if (destRegion === state.currentRegion) throw new GameError('ALREADY_THERE', 'You are already there.');
  if (state.travel) throw new GameError('ALREADY_TRAVELING', 'A trip is already underway.');
  if (state.storm.status === 'active') throw new GameError('STORM_ACTIVE', 'You cannot leave the basin during the Great Storm.');
  if (region.gate && state.skills[region.gate.skill].level < region.gate.lvl) {
    throw new GameError('REGION_LOCKED', `${region.name} requires ${SKILLS[region.gate.skill].name} ${region.gate.lvl}.`);
  }
  if (!region.home) spendItems(state, { fuel: TRAVEL_FUEL });
  const durationMs = region.home ? 0 : travelDurationMs(region, state);
  state.travel = { destRegion, arrivalAt: now + durationMs };
  addEvent(state, 'info', `Departing for ${region.name} — arriving in ${Math.ceil(durationMs / 1000)}s.`);
}

function travelDurationMs(region, state) {
  const roverMult = ROVERS[state.rover]?.mult ?? 1;
  const pilotCut = Math.floor(state.skills.piloting.level / 8);
  const speedMult = 1 - Math.min(90, Math.max(0, equipStats(state).speed)) / 100;
  const geared = Math.round(region.baseTravelTicks * roverMult * speedMult);
  const ticks = Math.max(4, geared - pilotCut);
  return ticks * TICK_MS;
}

/* --------------------------------------------------------------------- helpers */

export function equipStats(state) {
  const totals = { o2: 0, crit: 0, speed: 0, geode: 0, pack: 0 };
  for (const slot of EQUIP_SLOTS) {
    const tier = state.equip[slot];
    if (!tier) continue;
    const ti = EQUIP_TIERS.indexOf(tier);
    if (ti < 0) continue;
    const stats = EQUIP_STATS[slot];
    for (const key in stats) totals[key] += stats[key][ti];
  }
  return totals;
}

function gainSkill(state, skillId, xp) {
  const skill = state.skills[skillId];
  if (!skill) return;
  const amount = state.research.orbital_uplink ? Math.round(xp * 1.03) : xp;
  const before = skill.level;
  skill.xp = int(skill.xp + amount, 0, 200_000_000);
  skill.level = levelForXp(skill.xp);
  if (skill.level > before) addEvent(state, 'good', `${SKILLS[skillId].name} reached level ${skill.level}.`);
}

function spendItems(state, cost = {}) {
  for (const [itemId, qty] of Object.entries(cost)) {
    if ((state.inventory[itemId] || 0) < qty) {
      throw new GameError('MATERIALS_LOW', `Need ${qty} ${ITEMS[itemId]?.name || itemId}.`);
    }
  }
  for (const [itemId, qty] of Object.entries(cost)) addItem(state, itemId, -qty);
}

function addItems(state, items = {}) {
  for (const [itemId, qty] of Object.entries(items)) addItem(state, itemId, qty);
}

function addItem(state, itemId, qty) {
  if (!ITEMS[itemId]) throw new GameError('BAD_ITEM', `Unknown item: ${itemId}`, 400);
  state.inventory[itemId] = int((state.inventory[itemId] || 0) + qty, 0, 99_999);
}

function addEvent(state, tone, text) {
  state.events = [{ tone, text }, ...state.events].slice(0, 24);
}

function allBuildingsOnline(state) {
  return BUILDINGS.every((b) => !!state.built[b.id]);
}
function buildingName(id) {
  return BUILDINGS.find((b) => b.id === id)?.name || id;
}
function researchName(id) {
  return RESEARCH.find((p) => p.id === id)?.name || id;
}
function scaleItems(items, multiplier) {
  return Object.fromEntries(Object.entries(items).map(([id, qty]) => [id, qty * multiplier]));
}

/* -------------------------------------------------------------- sanitize parts */

function cleanNumberMap(raw, allowed, min, max) {
  const clean = Object.fromEntries(allowed.map((id) => [id, 0]));
  if (!raw || typeof raw !== 'object') return clean;
  for (const id of allowed) clean[id] = int(raw[id], min, max);
  return clean;
}
function cleanBank(raw) {
  const clean = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const id of ITEM_IDS) {
    const qty = int(raw[id], 0, 100_000_000);
    if (qty > 0) clean[id] = qty;
  }
  return clean;
}
function cleanBoolMap(raw, allowed, defaults = {}) {
  const clean = Object.fromEntries(allowed.map((id) => [id, !!defaults[id]]));
  if (!raw || typeof raw !== 'object') return clean;
  for (const id of allowed) clean[id] = !!raw[id] || !!defaults[id];
  return clean;
}
function cleanTiers(raw) {
  const clean = Object.fromEntries(TIERED_IDS.map((id) => [id, 1]));
  if (!raw || typeof raw !== 'object') return clean;
  for (const id of TIERED_IDS) clean[id] = int(raw[id], 1, MAX_TIER);
  return clean;
}
function cleanSkills(raw) {
  const clean = {};
  for (const id of SKILL_IDS) {
    const xp = int(raw?.[id]?.xp, 0, 200_000_000);
    clean[id] = { xp, level: levelForXp(xp) };
  }
  return clean;
}
function cleanStats(raw) {
  const clean = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || key.length > 48) continue;
    const n = int(value, 0, 100_000_000);
    if (n > 0) clean[key] = n;
  }
  return clean;
}
function cleanExtraNodes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3)
    .filter((n) => n && typeof n.id === 'string' && /^rich-vein-\d$/.test(n.id) && ITEMS[n.item])
    .map((n) => ({
      id: n.id, name: String(n.name || n.id).slice(0, 40), type: 'ore', item: n.item,
      skill: 'mining', xp: int(n.xp, 1, 400), hard: int(n.hard, 1, 12), lvl: int(n.lvl, 1, 99),
      yieldBase: int(n.yieldBase, 1, 3), x: int(n.x, 0, 10), y: int(n.y, 0, 10), charges: NODE_CHARGES,
    }));
}
function cleanPlots(raw, state) {
  const want = BASE_PLOTS + (state.tier.greenhouse >= 3 ? 1 : 0);
  const source = Array.isArray(raw?.plots) ? raw.plots : [];
  const plots = [];
  for (let i = 0; i < want; i += 1) {
    const p = source[i];
    const crop = CROP_IDS.includes(p?.crop) ? p.crop : null;
    plots.push({
      crop,
      t: crop ? int(p?.t, 0, 500) : 0,
      disease: !!(crop && p?.disease),
      fert: !!(crop && p?.fert),
      rolled: !!(crop && p?.rolled),
    });
  }
  return plots;
}
function cleanNodes(raw, state) {
  const clean = {};
  for (const node of allNodeDefs(state)) {
    clean[node.id] = {
      charges: int(raw?.[node.id]?.charges, 0, node.charges),
      cooldownUntil: int(raw?.[node.id]?.cooldownUntil, 0, Date.now() + 86_400_000),
    };
  }
  return clean;
}
function cleanDrones(raw, state) {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(allNodeDefs(state).map((n) => n.id));
  return raw.slice(0, 3).map((d) => ({
    nodeId: ids.has(d?.nodeId) ? d.nodeId : null,
    t: int(d?.t, 0, 500),
  }));
}
function cleanStorm(raw) {
  const statuses = ['locked', 'ready', 'active', 'won'];
  const status = statuses.includes(raw?.status) ? raw.status : 'locked';
  // The storm is authoritative and runs on real time: an active run keeps its
  // remaining ticks across commands and offline gaps, and resolves in advanceState.
  // (MarsScape dropped an interrupted storm back to `ready` because it had no
  // server clock to resume against; the legacy importer applies that rule instead.)
  return {
    status,
    phase: int(raw?.phase, 0, 10),
    remaining: status === 'active' ? int(raw?.remaining, 0, STORM_TOTAL) : 0,
    startedAt: int(raw?.startedAt, 0, Date.now() + 86_400_000),
    surgeIn: status === 'active' ? int(raw?.surgeIn, 0, 60) : 0,
  };
}
function cleanTravel(raw, now) {
  if (!raw || typeof raw !== 'object') return null;
  if (!REGION_IDS.includes(raw.destRegion)) return null;
  const arrivalAt = int(raw.arrivalAt, 0, now + 86_400_000);
  if (!arrivalAt) return null;
  return { destRegion: raw.destRegion, arrivalAt };
}
function cleanEquip(raw) {
  const clean = Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null]));
  const equip = raw?.equip;
  if (!equip || typeof equip !== 'object') return clean;
  for (const slot of EQUIP_SLOTS) {
    // Tier validity only. The Alloy Tempering gate lives on the craft path, like
    // every other gear gate — re-checking it here would strip legitimately earned
    // gear without adding tamper protection, since a forged save could set the
    // research flag just as easily as the equip slot.
    if (EQUIP_TIERS.includes(equip[slot])) clean[slot] = equip[slot];
  }
  return clean;
}
function cleanEvents(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 24).map((event) => ({
    tone: ['info', 'good', 'warn', 'bad'].includes(event?.tone) ? event.tone : 'info',
    text: String(event?.text || '').slice(0, 180),
  }));
}
function clamp(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}
function int(value, min, max) {
  return Math.round(clamp(value, min, max));
}
