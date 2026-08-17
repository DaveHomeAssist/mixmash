export const ENGINE_VERSION = 3;
export const TICK_MS = 5000;
export const MAX_OFFLINE_TICKS = 12 * 60 * 60 * 1000 / TICK_MS;

export const ITEMS = {
  iron_ore: { name: 'Iron Ore', short: 'Fe Ore', color: '#b9c1c6' },
  copper_ore: { name: 'Copper Ore', short: 'Cu Ore', color: '#d98145' },
  titanium_ore: { name: 'Titanium Ore', short: 'Ti Ore', color: '#e8edf0' },
  ice: { name: 'Ice', short: 'Ice', color: '#84d6e9' },
  iron_bar: { name: 'Iron Bar', short: 'Fe Bar', color: '#c6ced2' },
  copper_bar: { name: 'Copper Bar', short: 'Cu Bar', color: '#f29a54' },
  titanium_bar: { name: 'Titanium Bar', short: 'Ti Bar', color: '#eef3f6' },
  water: { name: 'Water', short: 'Water', color: '#63c7e1' },
  frame: { name: 'Frame', short: 'Frame', color: '#aeb8bf' },
  component: { name: 'Component', short: 'Comp', color: '#76d6d2' },
  food: { name: 'Food', short: 'Food', color: '#8ccf69' },
  fuel: { name: 'Fuel Cell', short: 'Fuel', color: '#e0a03a' },
};

export const SKILLS = {
  mining: { name: 'Mining', accent: '#d2c9ba' },
  water: { name: 'Water Extraction', accent: '#7fd8ee' },
  fabrication: { name: 'Fabrication', accent: '#f0a45f' },
  engineering: { name: 'Engineering', accent: '#d8d0c0' },
  agriculture: { name: 'Agriculture', accent: '#91ce67' },
  research: { name: 'Research', accent: '#87d8d9' },
  survival: { name: 'Survival', accent: '#e3be66' },
  piloting: { name: 'Piloting', accent: '#7fa8e3' },
};

// Regions beyond the home basin. `gate` is a skill/level requirement to travel there
// (dune_sea's is trivially met at Piloting 1 — the real gate is having built the Water
// Plant and holding a Fuel Cell, matching the original game's design). `baseTravelTicks`
// is expressed in the original game's 600ms tick, not this engine's 5000ms TICK_MS —
// travel duration is computed once (see travelDurationMs) and stored as an arrival
// timestamp, so it never depends on the tick loop's own grain.
export const REGIONS = {
  landing_basin: { name: 'Landing Basin', home: true, gate: null },
  dune_sea: { name: 'Dune Sea', home: false, gate: { skill: 'piloting', lvl: 1 }, baseTravelTicks: 20 },
};
const TRAVEL_TICK_MS = 600;

export const ROVERS = {
  buggy: { name: 'Survey Buggy', mult: 1.0 },
  rover2: { name: 'Rover Mk2', mult: 0.7 },
  rover3: { name: 'Rover Mk3', mult: 0.5 },
};
const ROVER_ORDER = ['buggy', 'rover2', 'rover3'];
const TRAVEL_FUEL = 1;

// 6 slots x 4 tiers, ported from MarsScape v0.4.0's equipment system. Tiers requiring
// materials this simpler engine doesn't have (glass, alloy, iridium) are substituted
// with iron/titanium bar + component at comparable cost, and composite's original
// research prerequisite (alloy_tempering) is dropped since no equivalent research
// project exists here yet.
export const EQUIP_SLOTS = ['suit', 'helmet', 'gloves', 'boots', 'scanner', 'backpack'];
export const EQUIP_TIERS = ['canvas', 'steel', 'titan', 'composite'];
const EQUIP_TIER_META = {
  canvas: { lvl: 5, xp: 40, cost: { iron_bar: 3, frame: 1 } },
  steel: { lvl: 15, xp: 90, cost: { iron_bar: 4, copper_bar: 3, frame: 2 } },
  titan: { lvl: 30, xp: 200, requiresBuilding: 'machine', cost: { titanium_bar: 4, frame: 2, component: 2 } },
  composite: { lvl: 45, xp: 420, cost: { titanium_bar: 6, component: 4 } },
};
const EQUIP_SLOT_META = {
  suit: { stat: 'o2' },
  helmet: { stat: 'o2' },
  gloves: { stat: 'crit' },
  boots: { stat: 'speed' },
  scanner: { stat: 'geode' },
  backpack: { stat: 'pack' },
};
const EQUIP_STATS = {
  suit: { o2: [4, 8, 12, 16] },
  helmet: { o2: [2, 4, 6, 8] },
  gloves: { crit: [1, 2, 3, 4] },
  boots: { speed: [8, 15, 22, 30] },
  scanner: { geode: [1, 2, 3, 4] },
  backpack: { pack: [2, 4, 6, 8] },
};

export const NODES = [
  { id: 'iron-north', name: 'North Iron Seam', type: 'ore', item: 'iron_ore', skill: 'mining', xp: 18, x: 2, y: 2, charges: 5 },
  { id: 'iron-south', name: 'South Iron Seam', type: 'ore', item: 'iron_ore', skill: 'mining', xp: 18, x: 3, y: 7, charges: 5 },
  { id: 'copper-ridge', name: 'Copper Ridge', type: 'ore', item: 'copper_ore', skill: 'mining', xp: 26, x: 7, y: 3, charges: 4 },
  { id: 'copper-basin', name: 'Basin Copper', type: 'ore', item: 'copper_ore', skill: 'mining', xp: 26, x: 1, y: 8, charges: 4 },
  { id: 'ice-pocket', name: 'Ice Pocket', type: 'ice', item: 'ice', skill: 'water', xp: 22, x: 4, y: 3, charges: 5 },
  { id: 'ice-scarp', name: 'Ice Scarp', type: 'ice', item: 'ice', skill: 'water', xp: 22, x: 8, y: 5, charges: 5 },
  { id: 'titanium-vein', name: 'Titanium Vein', type: 'ore', item: 'titanium_ore', skill: 'mining', xp: 58, x: 5, y: 1, charges: 3, requiresBuilding: 'machine' },
  // Dune Sea (regionId set; nodes with no regionId belong to landing_basin). Ported
  // 2 of the original 3 Dune Sea node types (Iron Scree, Wreck Site) — Silicate Dunes
  // deferred since this engine has no silicate/glass material chain yet.
  { id: 'dune-iron-scree', name: 'Iron Scree', type: 'ore', item: 'iron_ore', skill: 'mining', xp: 20, x: 2, y: 4, charges: 6, regionId: 'dune_sea', yieldBonus: 1 },
  { id: 'dune-wreck-site', name: 'Wreck Site', type: 'salvage', item: 'component', skill: 'mining', xp: 48, x: 7, y: 6, charges: 3, regionId: 'dune_sea' },
];

export const BUILDINGS = [
  { id: 'habitat', name: 'Habitat', model: 'dome', x: 5, y: 9, cost: {}, prebuilt: true, description: 'Life support anchor. Adds oxygen generation.' },
  { id: 'solar', name: 'Solar Array', model: 'array', x: 3, y: 8, cost: { iron_bar: 6, frame: 3, component: 2 }, description: 'Restores power generation and stabilizes the machine shop.' },
  { id: 'water', name: 'Water Plant', model: 'tower', x: 2, y: 6, cost: { iron_bar: 8, frame: 4, ice: 10 }, description: 'Purifies ice into usable water.' },
  { id: 'machine', name: 'Machine Shop', model: 'foundry', x: 7, y: 8, cost: { iron_bar: 10, copper_bar: 6, frame: 6 }, description: 'Unlocks titanium work and better fabrication.' },
  { id: 'greenhouse', name: 'Greenhouse', model: 'glass', x: 8, y: 6, cost: { frame: 8, component: 4, water: 15 }, description: 'Grows food and improves oxygen output.' },
  { id: 'lab', name: 'Research Lab', model: 'scope', x: 5, y: 5, cost: { titanium_bar: 6, component: 6, frame: 8 }, description: 'Turns rare materials into permanent upgrades.' },
  { id: 'reactor', name: 'Fusion Reactor', model: 'reactor', x: 5, y: 3, cost: { titanium_bar: 12, component: 10, frame: 10 }, description: 'A stable power crown. Unlocks the Great Storm objective.' },
];

export const SMELT_RECIPES = [
  { id: 'smelt-iron', name: 'Smelt Iron Bar', input: { iron_ore: 1 }, output: { iron_bar: 1 }, power: 2, xp: 20, requiresBuilding: null },
  { id: 'smelt-copper', name: 'Smelt Copper Bar', input: { copper_ore: 1 }, output: { copper_bar: 1 }, power: 2, xp: 28, requiresBuilding: null },
  { id: 'smelt-titanium', name: 'Smelt Titanium Bar', input: { titanium_ore: 1 }, output: { titanium_bar: 1 }, power: 4, xp: 60, requiresBuilding: 'machine' },
];

export const CRAFT_RECIPES = [
  { id: 'craft-frame', name: 'Frame', input: { iron_bar: 2 }, output: { frame: 1 }, xp: 16 },
  { id: 'craft-component', name: 'Component', input: { copper_bar: 2 }, output: { component: 1 }, xp: 24 },
  { id: 'craft-steel-pick', name: 'Steel Pick', input: { iron_bar: 4, component: 1 }, gear: { pickaxe: 'steel' }, xp: 70 },
  { id: 'craft-titanium-pick', name: 'Titanium Pick', input: { titanium_bar: 5, component: 2 }, gear: { pickaxe: 'titanium' }, xp: 190, requiresBuilding: 'machine' },
  { id: 'craft-fuel-cell', name: 'Fuel Cell', input: { water: 2 }, output: { fuel: 1 }, xp: 20 },
  // Rovers cut travel time to Dune Sea; tiers ported from MarsScape v0.4.0 with
  // part/alloy costs remapped onto this engine's simpler component/bar palette.
  { id: 'craft-rover-2', name: 'Rover Mk2', input: { titanium_bar: 6, component: 4 }, gear: { rover: 'rover2' }, xp: 200, lvl: 12, requiresBuilding: 'machine' },
  { id: 'craft-rover-3', name: 'Rover Mk3', input: { titanium_bar: 10, component: 6 }, gear: { rover: 'rover3' }, xp: 420, lvl: 35, requiresBuilding: 'machine' },
];
// Generate the 24 equipment recipes (6 slots x 4 tiers), same idiom as the source game.
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

export const RESEARCH = [
  { id: 'drills', name: 'Reinforced Drills', input: { titanium_bar: 4, component: 4 }, description: 'Gathering returns one extra resource on rich strikes.' },
  { id: 'scrubbers', name: 'O2 Scrubbers', input: { component: 3, food: 8 }, description: 'Improves oxygen recovery each tick.' },
  { id: 'loaders', name: 'Auto Loaders', input: { component: 4, titanium_bar: 6 }, description: 'Smelting has a chance to duplicate output.' },
];

const ITEM_IDS = Object.keys(ITEMS);
const SKILL_IDS = Object.keys(SKILLS);
const BUILDING_IDS = BUILDINGS.map((building) => building.id);
const RESEARCH_IDS = RESEARCH.map((project) => project.id);
const NODE_IDS = NODES.map((node) => node.id);
const REGION_IDS = Object.keys(REGIONS);
const ROVER_IDS = Object.keys(ROVERS);

export class GameError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.status = status;
  }
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
    skills: Object.fromEntries(SKILL_IDS.map((id) => [id, { xp: 0, level: 1 }])),
    built: Object.fromEntries(BUILDINGS.map((building) => [building.id, !!building.prebuilt])),
    research: Object.fromEntries(RESEARCH_IDS.map((id) => [id, false])),
    nodes: Object.fromEntries(NODES.map((node) => [node.id, { charges: node.charges, cooldownUntil: 0 }])),
    gear: { pickaxe: 'stone' },
    farm: { plantedAt: 0, ready: false },
    storm: { status: 'locked', phase: 0, endsAt: 0 },
    player: { x: 5, y: 9 },
    currentRegion: 'landing_basin',
    rover: 'buggy',
    travel: null,
    equip: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])),
    commandIds: [],
    events: [{ tone: 'info', text: 'You step out of the lander. Mission Control: start with iron ore.' }],
  };
}

export function sanitizeState(raw, now = Date.now()) {
  const base = createState(now);
  if (!raw || typeof raw !== 'object') return base;
  const state = {
    ...base,
    version: ENGINE_VERSION,
    seq: int(raw.seq, 0, 1_000_000_000),
    createdAt: int(raw.createdAt, 0, now) || now,
    updatedAt: int(raw.updatedAt, 0, now) || now,
    lastTickAt: int(raw.lastTickAt, 0, now) || now,
    sol: int(raw.sol, 1, 9999),
    tickCount: int(raw.tickCount, 0, 1_000_000_000),
    meters: {
      oxygen: clamp(raw.meters?.oxygen, 0, 100),
      power: clamp(raw.meters?.power, 0, 100),
    },
    inventory: cleanNumberMap(raw.inventory, ITEM_IDS, 0, 999),
    skills: cleanSkills(raw.skills),
    built: cleanBoolMap(raw.built, BUILDING_IDS, { habitat: true }),
    research: cleanBoolMap(raw.research, RESEARCH_IDS),
    nodes: cleanNodes(raw.nodes),
    gear: { pickaxe: ['stone', 'steel', 'titanium'].includes(raw.gear?.pickaxe) ? raw.gear.pickaxe : 'stone' },
    farm: {
      plantedAt: int(raw.farm?.plantedAt, 0, now),
      ready: !!raw.farm?.ready,
    },
    storm: cleanStorm(raw.storm),
    player: {
      x: int(raw.player?.x, 0, 10),
      y: int(raw.player?.y, 0, 10),
    },
    currentRegion: REGION_IDS.includes(raw.currentRegion) ? raw.currentRegion : 'landing_basin',
    rover: ROVER_IDS.includes(raw.rover) ? raw.rover : 'buggy',
    travel: cleanTravel(raw.travel, now),
    equip: cleanEquip(raw.equip),
    commandIds: Array.isArray(raw.commandIds) ? raw.commandIds.filter((id) => typeof id === 'string').slice(-40) : [],
    events: cleanEvents(raw.events),
  };
  if (!state.built.habitat) state.built.habitat = true;
  return state;
}

export function advanceState(input, now = Date.now()) {
  const state = sanitizeState(input, now);
  const elapsed = Math.max(0, now - state.lastTickAt);
  const ticks = Math.min(MAX_OFFLINE_TICKS, Math.floor(elapsed / TICK_MS));
  if (ticks <= 0) return state;

  const rates = meterRates(state);
  const suitO2 = equipStats(state).o2;
  if (rates.oxygen < 0) rates.oxygen *= (1 - suitO2 / 100); // suit/helmet efficiency softens loss only
  for (let i = 0; i < ticks; i += 1) {
    state.tickCount += 1;
    if (state.tickCount % 100 === 0) {
      state.sol += 1;
      gainSkill(state, 'survival', 6);
      addEvent(state, 'info', `Sol ${state.sol} begins.`);
    }
    state.meters.oxygen = clamp(state.meters.oxygen + rates.oxygen, 0, 100);
    state.meters.power = clamp(state.meters.power + rates.power, 0, 100);
    if (state.farm.plantedAt && !state.farm.ready && now - state.farm.plantedAt >= 90_000) {
      state.farm.ready = true;
      addEvent(state, 'good', 'The greenhouse crop is ready to harvest.');
    }
    if (state.storm.status === 'active') {
      state.storm.phase = Math.min(10, Math.floor((now - state.storm.startedAt) / 18_000) + 1);
      if (state.meters.oxygen < 50 || state.meters.power < 50) {
        state.storm.status = 'ready';
        state.storm.phase = 0;
        state.meters.oxygen = Math.max(55, state.meters.oxygen);
        state.meters.power = Math.max(55, state.meters.power);
        addEvent(state, 'warn', 'Storm protocol failed. Restore reserves and try again.');
      } else if (state.storm.phase >= 10) {
        state.storm.status = 'won';
        gainSkill(state, 'survival', 220);
        addEvent(state, 'good', 'The colony endured the Great Storm. New Expedition+ is secure.');
      }
    }
  }
  state.lastTickAt += ticks * TICK_MS;

  // Travel resolves against real elapsed time, not the tick grid above — a rover trip
  // is an arrival timestamp (like farm.ready / storm.endsAt), not a running counter.
  if (state.travel && now >= state.travel.arrivalAt) {
    const region = REGIONS[state.travel.destRegion];
    state.currentRegion = state.travel.destRegion;
    state.travel = null;
    if (region) {
      gainSkill(state, 'piloting', region.home ? 30 : 50);
      addEvent(state, 'good', `Arrived at ${region.name}.`);
    }
  }

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
    case 'gather':
      gather(state, command.nodeId);
      break;
    case 'build':
      build(state, command.buildingId);
      break;
    case 'smelt':
      smelt(state, command.recipeId);
      break;
    case 'craft':
      craft(state, command.recipeId);
      break;
    case 'purify':
      purify(state);
      break;
    case 'service':
      service(state, command.buildingId);
      break;
    case 'plant':
      plant(state, now);
      break;
    case 'harvest':
      harvest(state);
      break;
    case 'research':
      research(state, command.projectId);
      break;
    case 'ration':
      ration(state);
      break;
    case 'startStorm':
      startStorm(state, now);
      break;
    case 'travel':
      travel(state, command.destRegion, now);
      break;
    case 'tick':
      addEvent(state, 'info', 'Mission clock advanced.');
      break;
    case 'reset':
      return { state: createState(now), events: [{ tone: 'warn', text: 'Colony reset.' }] };
    default:
      throw new GameError('UNKNOWN_COMMAND', `Unknown command: ${command.type}`, 400);
  }

  if (commandId) state.commandIds = [...state.commandIds, commandId].slice(-40);
  state.seq += 1;
  state.updatedAt = now;
  return { state, events: state.events.slice(0, Math.max(0, state.events.length - beforeEvents)) };
}

export function publicState(input, now = Date.now()) {
  const state = advanceState(input, now);
  return {
    ...state,
    stats: equipStats(state),
    catalog: {
      items: ITEMS,
      skills: SKILLS,
      nodes: NODES,
      buildings: BUILDINGS,
      smeltRecipes: SMELT_RECIPES,
      craftRecipes: CRAFT_RECIPES,
      research: RESEARCH,
      regions: REGIONS,
      rovers: ROVERS,
    },
  };
}

export function levelForXp(xp) {
  return Math.max(1, Math.min(99, Math.floor(Math.sqrt(Math.max(0, xp)) / 5) + 1));
}

function gather(state, nodeId) {
  const node = NODES.find((candidate) => candidate.id === nodeId);
  if (!node) throw new GameError('NODE_NOT_FOUND', 'Resource node not found', 404);
  if (nodeRegion(node) !== state.currentRegion) {
    throw new GameError('WRONG_REGION', `${node.name} is not in your current region.`);
  }
  if (node.requiresBuilding && !state.built[node.requiresBuilding]) {
    throw new GameError('NODE_LOCKED', `${node.name} requires ${buildingName(node.requiresBuilding)}.`);
  }
  const nodeState = state.nodes[node.id] || { charges: node.charges, cooldownUntil: 0 };
  if (nodeState.cooldownUntil > Date.now()) throw new GameError('NODE_COOLDOWN', `${node.name} is respawning.`);
  if (nodeState.charges <= 0) {
    nodeState.charges = node.charges;
    nodeState.cooldownUntil = Date.now() + 30_000;
    state.nodes[node.id] = nodeState;
    throw new GameError('NODE_DEPLETED', `${node.name} is respawning.`);
  }
  const packCap = 40 + equipStats(state).pack;
  if (packSize(state) >= packCap && !state.inventory[node.item]) {
    throw new GameError('PACK_FULL', 'Pack is full.');
  }
  const stats = equipStats(state);
  const critBonus = Math.random() * 100 < stats.crit ? 1 : 0;
  const drillBonus = state.research.drills && Math.random() < 0.18 ? 1 : 0;
  const bonus = Math.max(critBonus, drillBonus);
  addItem(state, node.item, (node.yieldBonus || 0) + 1 + bonus);
  gainSkill(state, node.skill, node.xp);

  // The scanner's `geode` stat: a chance to spot a mineral geode in an ore seam,
  // which cracks open into titanium. Ore nodes only — there is nothing to find
  // in an ice scarp — and never on the titanium seam itself.
  if (node.type === 'ore' && node.item !== 'titanium_ore' && Math.random() * 100 < stats.geode) {
    addItem(state, 'titanium_ore', 1);
    gainSkill(state, 'mining', 12);
    addEvent(state, 'good', 'Scanner pinged a geode — cracked it open for 1 Titanium Ore.');
  }
  nodeState.charges -= 1;
  if (nodeState.charges <= 0) {
    nodeState.charges = 0;
    nodeState.cooldownUntil = Date.now() + 30_000;
  }
  state.nodes[node.id] = nodeState;
  state.player = { x: node.x, y: node.y };
  addEvent(state, 'good', `Gathered ${(node.yieldBonus || 0) + 1 + bonus} ${ITEMS[node.item].name}.`);
}

function build(state, buildingId) {
  const building = BUILDINGS.find((candidate) => candidate.id === buildingId);
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
  if (building.id === 'reactor' && allBuildingsOnline(state)) {
    state.storm.status = 'ready';
    addEvent(state, 'warn', 'Great Storm detected. Stock food, oxygen, and power before starting.');
  }
}

function smelt(state, recipeId) {
  const recipe = SMELT_RECIPES.find((candidate) => candidate.id === recipeId);
  if (!recipe) throw new GameError('RECIPE_NOT_FOUND', 'Smelting recipe not found', 404);
  if (state.currentRegion !== 'landing_basin') {
    throw new GameError('AWAY_FROM_BASIN', 'The Machine Shop is back at the Landing Basin. Drive home to smelt.');
  }
  if (recipe.requiresBuilding && !state.built[recipe.requiresBuilding]) {
    throw new GameError('RECIPE_LOCKED', `${recipe.name} requires ${buildingName(recipe.requiresBuilding)}.`);
  }
  if (state.meters.power < recipe.power) throw new GameError('POWER_LOW', 'Power too low to run the machine shop.');
  spendItems(state, recipe.input);
  const multiplier = state.research.loaders && Math.random() < 0.12 ? 2 : 1;
  addItems(state, scaleItems(recipe.output, multiplier));
  state.meters.power = clamp(state.meters.power - recipe.power, 0, 100);
  gainSkill(state, 'fabrication', recipe.xp);
  state.player = { x: 7, y: 8 };
  addEvent(state, 'good', `${recipe.name} complete${multiplier > 1 ? ' with duplicate output' : ''}.`);
}

function craft(state, recipeId) {
  const recipe = CRAFT_RECIPES.find((candidate) => candidate.id === recipeId);
  if (!recipe) throw new GameError('RECIPE_NOT_FOUND', 'Crafting recipe not found', 404);
  if (recipe.requiresBuilding && !state.built[recipe.requiresBuilding]) {
    throw new GameError('RECIPE_LOCKED', `${recipe.name} requires ${buildingName(recipe.requiresBuilding)}.`);
  }
  if (recipe.lvl && state.skills.fabrication.level < recipe.lvl) {
    throw new GameError('LEVEL_LOW', `${recipe.name} requires Fabrication level ${recipe.lvl}.`);
  }
  spendItems(state, recipe.input);
  if (recipe.output) addItems(state, recipe.output);
  if (recipe.gear) applyGear(state, recipe.gear);
  gainSkill(state, 'fabrication', recipe.xp);
  state.player = { x: 7, y: 8 };
  addEvent(state, 'good', `Fabricated ${recipe.name}.`);
}

// Generalized so rovers/equipment plug into the same craft-time gear application as
// the original pickaxe-only case, each with its own anti-downgrade guard (crafting a
// tier at or below what's already held is blocked, matching the source game).
function applyGear(state, gear) {
  if (gear.pickaxe) {
    // Unchanged from the pre-port behavior: no anti-downgrade check here originally,
    // so none is added now — only the new rover/equip gear kinds get the guard.
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

function purify(state) {
  if (!state.built.water) throw new GameError('BUILDING_REQUIRED', 'Build the Water Plant first.');
  spendItems(state, { ice: 1 });
  addItem(state, 'water', 1);
  gainSkill(state, 'water', 16);
  state.player = { x: 2, y: 6 };
  addEvent(state, 'good', 'Purified 1 Water.');
}

function service(state, buildingId) {
  const building = BUILDINGS.find((candidate) => candidate.id === buildingId && state.built[candidate.id]);
  if (!building) throw new GameError('BUILDING_NOT_FOUND', 'Online building not found', 404);
  const level = state.skills.engineering.level;
  state.meters.power = clamp(state.meters.power + 5 + Math.floor(level / 2), 0, 100);
  state.meters.oxygen = clamp(state.meters.oxygen + 3 + Math.floor(level / 3), 0, 100);
  gainSkill(state, 'engineering', 34);
  state.player = { x: building.x, y: building.y };
  addEvent(state, 'good', `Serviced ${building.name}.`);
}

function plant(state, now) {
  if (!state.built.greenhouse) throw new GameError('BUILDING_REQUIRED', 'Build the Greenhouse first.');
  if (state.farm.plantedAt && !state.farm.ready) throw new GameError('CROP_GROWING', 'Crop is still growing.');
  spendItems(state, { water: 1 });
  state.farm = { plantedAt: now, ready: false };
  state.player = { x: 8, y: 6 };
  addEvent(state, 'info', 'Greenhouse crop planted.');
}

function harvest(state) {
  if (!state.farm.ready) throw new GameError('CROP_NOT_READY', 'Crop is not ready.');
  addItem(state, 'food', 2);
  gainSkill(state, 'agriculture', 42);
  state.farm = { plantedAt: 0, ready: false };
  state.player = { x: 8, y: 6 };
  addEvent(state, 'good', 'Harvested 2 Food.');
}

function research(state, projectId) {
  if (state.currentRegion !== 'landing_basin') {
    throw new GameError('AWAY_FROM_BASIN', 'The Research Lab is back at the Landing Basin. Drive home first.');
  }
  if (!state.built.lab) throw new GameError('BUILDING_REQUIRED', 'Build the Research Lab first.');
  const project = RESEARCH.find((candidate) => candidate.id === projectId);
  if (!project) throw new GameError('PROJECT_NOT_FOUND', 'Research project not found', 404);
  if (state.research[project.id]) throw new GameError('PROJECT_DONE', `${project.name} is already researched.`);
  spendItems(state, project.input);
  state.research[project.id] = true;
  gainSkill(state, 'research', 140);
  state.player = { x: 5, y: 5 };
  addEvent(state, 'good', `Research complete: ${project.name}.`);
}

function ration(state) {
  spendItems(state, { food: 1 });
  state.meters.oxygen = clamp(state.meters.oxygen + 8 + Math.floor(state.skills.survival.level / 2), 0, 100);
  gainSkill(state, 'survival', 14);
  addEvent(state, 'good', 'Rations distributed. Oxygen recovered.');
}

function startStorm(state, now) {
  if (!allBuildingsOnline(state)) throw new GameError('COLONY_INCOMPLETE', 'All colony systems must be online before the storm.');
  if (state.meters.oxygen < 70 || state.meters.power < 70) {
    throw new GameError('RESERVES_LOW', 'Start with oxygen and power at 70% or higher.');
  }
  state.storm = { status: 'active', phase: 1, startedAt: now, endsAt: now + 180_000 };
  addEvent(state, 'warn', 'The Great Storm begins. Hold oxygen and power above 50%.');
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
  // Boots' `speed` is a percentage cut on the trip, applied before the flat
  // Piloting reduction so gear and skill stack rather than one masking the other.
  const speedMult = 1 - Math.min(90, Math.max(0, equipStats(state).speed)) / 100;
  const geared = Math.round(region.baseTravelTicks * roverMult * speedMult);
  const ticks = Math.max(4, geared - pilotCut);
  return ticks * TRAVEL_TICK_MS;
}

function nodeRegion(node) {
  return node.regionId || 'landing_basin';
}

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

function meterRates(state) {
  let oxygen = -0.06;
  let power = -0.08;
  if (state.built.habitat) oxygen += 0.08;
  if (state.built.greenhouse) oxygen += 0.05;
  if (state.research.scrubbers) oxygen += 0.06;
  if (state.built.solar) power += 0.13;
  if (state.built.reactor) power += 0.4;
  if (state.storm.status === 'active') {
    const softness = Math.max(0.72, 1 - state.skills.survival.level * 0.01);
    oxygen -= 0.32 * softness;
    power -= 0.48 * softness;
  }
  return { oxygen, power };
}

function gainSkill(state, skillId, xp) {
  const skill = state.skills[skillId];
  if (!skill) return;
  const before = skill.level;
  skill.xp = int(skill.xp + xp, 0, 10_000_000);
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
  state.inventory[itemId] = int((state.inventory[itemId] || 0) + qty, 0, 999);
}

function addEvent(state, tone, text) {
  state.events = [{ tone, text }, ...state.events].slice(0, 24);
}

function allBuildingsOnline(state) {
  return BUILDINGS.every((building) => !!state.built[building.id]);
}

function buildingName(id) {
  return BUILDINGS.find((building) => building.id === id)?.name || id;
}

function packSize(state) {
  return Object.values(state.inventory).filter((qty) => qty > 0).length;
}

function scaleItems(items, multiplier) {
  return Object.fromEntries(Object.entries(items).map(([itemId, qty]) => [itemId, qty * multiplier]));
}

function cleanNumberMap(raw, allowed, min, max) {
  const clean = Object.fromEntries(allowed.map((id) => [id, 0]));
  if (!raw || typeof raw !== 'object') return clean;
  for (const id of allowed) clean[id] = int(raw[id], min, max);
  return clean;
}

function cleanBoolMap(raw, allowed, defaults = {}) {
  const clean = Object.fromEntries(allowed.map((id) => [id, !!defaults[id]]));
  if (!raw || typeof raw !== 'object') return clean;
  for (const id of allowed) clean[id] = !!raw[id] || !!defaults[id];
  return clean;
}

function cleanSkills(raw) {
  const clean = {};
  for (const id of SKILL_IDS) {
    const xp = int(raw?.[id]?.xp, 0, 10_000_000);
    clean[id] = { xp, level: levelForXp(xp) };
  }
  return clean;
}

function cleanNodes(raw) {
  const clean = {};
  for (const node of NODES) {
    clean[node.id] = {
      charges: int(raw?.[node.id]?.charges, 0, node.charges),
      cooldownUntil: int(raw?.[node.id]?.cooldownUntil, 0, Date.now() + 86_400_000),
    };
  }
  return clean;
}

function cleanStorm(raw) {
  const statuses = ['locked', 'ready', 'active', 'won'];
  return {
    status: statuses.includes(raw?.status) ? raw.status : 'locked',
    phase: int(raw?.phase, 0, 10),
    startedAt: int(raw?.startedAt, 0, Date.now() + 86_400_000),
    endsAt: int(raw?.endsAt, 0, Date.now() + 86_400_000),
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
  if (!raw || typeof raw !== 'object') return clean;
  for (const slot of EQUIP_SLOTS) {
    if (EQUIP_TIERS.includes(raw[slot])) clean[slot] = raw[slot];
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
