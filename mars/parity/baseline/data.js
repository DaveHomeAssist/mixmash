/* MarsScape — static game data + XP curve. Pure: no imports, no DOM, no state. */
const TICK = 600;           // ms per game tick (the RuneScape tick)
const TICKS_PER_SOL = 100;  // one sol = 100 ticks = 60s, everywhere
const SAVE_KEY = "marsscape_v1";

/* ---------- static data ---------- */
const ITEMS = {
  iron_ore:{em:"🪨",nm:"Iron Ore",stack:24},
  copper_ore:{em:"🟤",nm:"Copper Ore",stack:24},
  titanium_ore:{em:"⬜",nm:"Titanium Ore",stack:24},
  silicate_ore:{em:"🔶",nm:"Silicate Ore",stack:24},
  rare_ore:{em:"🟣",nm:"Rare-Earth Ore",stack:24},
  iridium_ore:{em:"⚫",nm:"Iridium Ore",stack:24},
  ice:{em:"🧊",nm:"Ice",stack:24},
  geode:{em:"💎",nm:"Geode",stack:24},
  iron_bar:{em:"🔩",nm:"Iron Bar",stack:48},
  copper_bar:{em:"🟠",nm:"Copper Bar",stack:48},
  titanium_bar:{em:"⚙️",nm:"Titanium Bar",stack:48},
  glass:{em:"🪟",nm:"Silicate Glass",stack:48},
  alloy:{em:"🧲",nm:"RE Alloy",stack:48},
  iridium_bar:{em:"⚪",nm:"Iridium Bar",stack:48},
  water:{em:"💧",nm:"Water",stack:48},
  frame:{em:"🔲",nm:"Frame",stack:48},
  frame2:{em:"🔳",nm:"Composite Frame",stack:48},
  part:{em:"🔌",nm:"Component",stack:48},
  part2:{em:"🎛️",nm:"Advanced Component",stack:48},
  insulation:{em:"🧻",nm:"Insulation Mat",stack:48},
  fertilizer:{em:"🧂",nm:"Fertilizer",stack:48},
  food:{em:"🥔",nm:"Potato",stack:48},
  soy:{em:"🫘",nm:"Soy",stack:48},
  algae:{em:"🟢",nm:"Algae",stack:48},
  berries:{em:"🫐",nm:"Hydro Berries",stack:48},
  genefruit:{em:"🍇",nm:"Genefruit",stack:48},
  fuel:{em:"⛽",nm:"Fuel Cell",stack:48},
};

/* rationable food: O2 restored per unit (before Survival bonus) */
const EDIBLES = {food:6, soy:8, algae:9, berries:11, genefruit:15};

const SKILLS = {
  mining:{em:"⛏️",nm:"Mining", perk:"New ore tiers at 10, 25, 30, 55 and 75; quality doubles climb with level."},
  water:{em:"💧",nm:"Ice Harvesting", perk:"Deeper ice tiers at 20 and 40; purity doubles climb with level."},
  fab:{em:"🔨",nm:"Fabrication", perk:"Recipes and gear tiers unlock from level 1 through 45."},
  eng:{em:"🔧",nm:"Engineering", perk:"Servicing restores more per level; building tiers and overclock."},
  agri:{em:"🌱",nm:"Agriculture", unlock:s=>s.built.green, lockNote:"Build the Greenhouse to begin farming.", perk:"New crops at 15, 30, 45 and 60 across three plots."},
  robotics:{em:"🤖",nm:"Robotics", unlock:s=>!!s.postgame, lockNote:"Unlocks in New Expedition+ after the Great Storm.", perk:"Drone cap rises at levels 10 and 20; drones deposit to the bank."},
  explore:{em:"🧭",nm:"Exploration", unlock:s=>!!s.postgame, lockNote:"Unlocks in New Expedition+ after the Great Storm.", perk:"Better trek loot; discover rich veins."},
  research:{em:"🔬",nm:"Research", unlock:s=>s.built.lab, lockNote:"Build the Research Lab to begin.", perk:"A 20-project tech tree in three tiers."},
  piloting:{em:"🛰️",nm:"Piloting", unlock:s=>!!s.built.water, lockNote:"Build the Water Plant (fuel needs water) to begin driving.", perk:"Faster travel and new regions at 10, 20 and 40; rover tiers cut travel time."},
  survival:{em:"🛡️",nm:"Survival", perk:"Storm resistance, low-O2 grace at 25, emergency beacon at 50."},
};

// resource nodes on the surface — lvl gates by the governing skill
const NODES = [
  {id:"iron1", kind:"mine", item:"iron_ore", em:"🪨", nm:"Iron Vein", hard:3, xp:16, x:18, y:44},
  {id:"iron2", kind:"mine", item:"iron_ore", em:"🪨", nm:"Iron Vein", hard:3, xp:16, x:26, y:66},
  {id:"iron3", kind:"mine", item:"iron_ore", em:"🪨", nm:"Iron Vein", hard:3, xp:16, x:82, y:62},
  {id:"cop1",  kind:"mine", item:"copper_ore", em:"🟤", nm:"Copper Vein", hard:4, xp:26, lvl:10, x:70, y:40},
  {id:"cop2",  kind:"mine", item:"copper_ore", em:"🟤", nm:"Copper Vein", hard:4, xp:26, lvl:10, x:14, y:73},
  {id:"ice1",  kind:"ice",  item:"ice", em:"🧊", nm:"Ice Deposit", hard:3, xp:20, x:36, y:36},
  {id:"ice2",  kind:"ice",  item:"ice", em:"🧊", nm:"Ice Deposit", hard:3, xp:20, x:86, y:44},
  {id:"perma1",kind:"ice",  item:"ice", em:"❄️", nm:"Permafrost Bed", hard:5, xp:48, lvl:20, x:44, y:62},
  {id:"brine1",kind:"ice",  item:"ice", em:"🌀", nm:"Brine Well", hard:6, xp:90, lvl:40, yield:2, x:90, y:72},
  {id:"tita1", kind:"mine", item:"titanium_ore", em:"⬜", nm:"Titanium Vein", hard:6, xp:55, lvl:25, x:50, y:19, lockBy:"machine"},
  {id:"silica1",kind:"mine", item:"silicate_ore", em:"🔶", nm:"Silicate Bed", hard:7, xp:80, lvl:30, x:62, y:28},
  {id:"silica2",kind:"mine", item:"silicate_ore", em:"🔶", nm:"Silicate Bed", hard:7, xp:80, lvl:30, x:10, y:50},
  {id:"rare1", kind:"mine", item:"rare_ore", em:"🟣", nm:"Rare-Earth Seam", hard:8, xp:150, lvl:55, x:30, y:22},
  {id:"irid1", kind:"mine", item:"iridium_ore", em:"⚫", nm:"Iridium Lode", hard:10, xp:205, lvl:75, x:74, y:24},
  // ---- Dune Sea region (reached by rover) ----
  {id:"dune_iron", region:"dune_sea", kind:"mine", item:"iron_ore", em:"🪨", nm:"Iron Scree", hard:2, xp:18, yield:2, x:22, y:60},
  {id:"dune_wreck", region:"dune_sea", kind:"mine", item:"part", em:"🛰️", nm:"Wreck Site", hard:7, xp:74, lvl:1, x:64, y:52},
  {id:"dune_silica", region:"dune_sea", kind:"mine", item:"silicate_ore", em:"🏜️", nm:"Silicate Dunes", hard:6, xp:88, lvl:30, yield:2, x:44, y:40},
];

/* ---------- regions (Phase 2) ---------- */
const REGIONS = {
  landing_basin:{nm:"Landing Basin", em:"🏕️", gate:null, home:true,
    blurb:"Your colony's home. Every structure — Depot, Machine Shop, Greenhouse, Lab — is here."},
  dune_sea:{nm:"Dune Sea", em:"🏜️", gate:{skill:"piloting", lvl:1}, travelTicks:20,
    blurb:"A rolling silicate desert east of the basin: rich silicate dunes, scattered wreck sites, easy iron scree. No colony structures — gather here, process back home."},
};
const FUTURE_REGIONS = [
  {nm:"Canyon Network", em:"🏜️", req:"Piloting 20"},
  {nm:"Polar Cap", em:"❄️", req:"Piloting 40 + insulated suit"},
];

/* rover tiers (travel-time multiplier) */
const ROVERS = {
  buggy:{nm:"Survey Buggy", mult:1.0},
  rover2:{nm:"Rover Mk2", mult:0.7},
  rover3:{nm:"Rover Mk3", mult:0.5},
};
const TRAVEL_FUEL = 1;    // fuel cells per trip

// colony buildings (order = build ladder), placed on map
const BUILDINGS = [
  {id:"habitat", em:"🛖", nm:"Habitat", x:50, y:82, prebuilt:true,
    blurb:"Life support core. Produces a trickle of oxygen.",
    cost:{}, effect:"Colony origin. +0.05 O2 / tick."},
  {id:"depot", em:"📦", nm:"Colony Depot", x:58, y:78,
    blurb:"The bank. Unlimited storage — click it to deposit and withdraw.",
    cost:{iron_bar:4, frame:2}, effect:"Opens colony storage. Drones deliver here."},
  {id:"solar", em:"🔆", nm:"Solar Array", x:34, y:70,
    blurb:"Photovoltaic field. Restores power so the machine shop can run.",
    cost:{iron_bar:6, frame:3, part:2}, effect:"+0.09 Power / tick."},
  {id:"water", em:"🚰", nm:"Water Plant", x:26, y:56,
    blurb:"Purifies ice into usable water. Click the plant on the map to run it.",
    cost:{iron_bar:8, frame:4, ice:10}, effect:"Turns Ice into Water. Water feeds the Greenhouse and farming."},
  {id:"machine", em:"🏭", nm:"Machine Shop", x:66, y:70,
    blurb:"Heavy fabrication. Unlocks titanium and better tools.",
    cost:{iron_bar:10, copper_bar:6, frame:6}, effect:"Unlocks titanium mining, smelting, and the Titanium Pick."},
  {id:"green", em:"🌿", nm:"Greenhouse", x:70, y:56,
    blurb:"Pressurised grow domes. Three plots; new crops as Agriculture grows.",
    cost:{frame:8, part:4, water:15}, effect:"Unlocks Agriculture. +0.06 O2 / tick."},
  {id:"lab", em:"🔬", nm:"Research Lab", x:50, y:46,
    blurb:"Turns rare materials into permanent colony upgrades.",
    cost:{titanium_bar:6, part:6, frame:8}, effect:"Unlocks the Research track."},
  {id:"reactor", em:"☢️", nm:"Fusion Reactor", x:50, y:32,
    blurb:"The crown of the colony. Limitless power for the city to come.",
    cost:{titanium_bar:12, part:10, frame:10}, effect:"+0.4 Power / tick. Unlocks the final objective: the Great Storm."},
];

/* Engineering building tiers — index 0 = upgrade to II, index 1 = upgrade to III.
   Effects stack on the base building effect. */
const BUILD_TIERS = {
  habitat:[{cost:{frame:6, glass:2}, engLvl:10, o2:0.03}, {cost:{frame2:2, glass:4, insulation:2}, engLvl:35, o2:0.04}],
  solar:  [{cost:{part:4, glass:3}, engLvl:15, pwr:0.04}, {cost:{part2:2, glass:6}, engLvl:40, pwr:0.05}],
  water:  [{cost:{frame:4, glass:2}, engLvl:20, purify:1}, {cost:{part2:1, alloy:1}, engLvl:45, purify:1}],
  machine:[{cost:{frame:6, part:3}, engLvl:25, smelt:1},  {cost:{alloy:2, part2:2}, engLvl:50, smelt:1}],
  green:  [{cost:{glass:4, water:10}, engLvl:20, o2:0.02}, {cost:{glass:8, part2:1}, engLvl:45, o2:0.03, plot:1}],
};
const OVERCLOCK_LVL = 25;      // Engineering level to unlock the overclock toggle
const OVERCLOCK_MULT = 1.35;   // positive building output multiplier while overclocked
const FAULT_CHANCE = 0.0025;   // per-tick chance of a building fault while overclocked

/* distinct SVG silhouettes per building */
const BSVG = {
  habitat:`<svg viewBox="0 0 48 32"><path d="M6 28a18 14 0 0 1 36 0z" fill="#cdbba3" stroke="#7a6a58" stroke-width="1.5"/><rect x="20" y="19" width="8" height="9" rx="2" fill="#5b4c3e"/><circle cx="24" cy="14" r="3" fill="#4db8d4"/></svg>`,
  depot:`<svg viewBox="0 0 48 32"><rect x="8" y="12" width="32" height="16" rx="2" fill="#a99680" stroke="#7a6a58" stroke-width="1.5"/><path d="M8 12l16-7 16 7" fill="#8a7663" stroke="#7a6a58" stroke-width="1.5"/><rect x="20" y="18" width="8" height="10" fill="#5b4c3e"/><path d="M12 16h6M30 16h6" stroke="#e0a03a" stroke-width="2"/></svg>`,
  solar:`<svg viewBox="0 0 48 32"><rect x="22" y="18" width="4" height="10" fill="#8a7663"/><g transform="rotate(-12 24 12)"><rect x="6" y="6" width="36" height="12" rx="1.5" fill="#3f6f8c"/><path d="M6 10h36M6 14h36M15 6v12M24 6v12M33 6v12" stroke="#9fd2e8" stroke-width="1"/></g></svg>`,
  water:`<svg viewBox="0 0 48 32"><rect x="10" y="8" width="18" height="20" rx="4" fill="#cdbba3" stroke="#7a6a58" stroke-width="1.5"/><rect x="28" y="18" width="10" height="4" fill="#8a7663"/><path d="M40 12l3.4 5.4a3.4 3.4 0 1 1-6.8 0z" fill="#4db8d4"/><path d="M14 13h10" stroke="#4db8d4" stroke-width="2"/></svg>`,
  machine:`<svg viewBox="0 0 48 32"><path d="M6 14l10-6v6l10-6v6l16-4v18H6z" fill="#a99680"/><rect x="6" y="20" width="36" height="8" fill="#8a7663"/><rect x="10" y="4" width="4" height="12" fill="#6b5b4a"/><circle cx="18" cy="23" r="3.4" fill="#4a3d31"/><circle cx="18" cy="23" r="1.3" fill="#cdbba3"/><rect x="30" y="20" width="6" height="8" fill="#4a3d31"/></svg>`,
  green:`<svg viewBox="0 0 48 32"><path d="M6 28a18 13 0 0 1 36 0z" fill="#bfe3d2" opacity=".9"/><path d="M6 28a18 13 0 0 1 36 0z" fill="none" stroke="#79a58c" stroke-width="1.5"/><path d="M12 28a12 9 0 0 1 24 0M24 15v13" stroke="#79a58c" stroke-width="1"/><path d="M20 28c0-5 2-7 4-8 2 1 4 3 4 8z" fill="#78b25b"/></svg>`,
  lab:`<svg viewBox="0 0 48 32"><rect x="8" y="16" width="26" height="12" rx="2" fill="#cdbba3" stroke="#7a6a58" stroke-width="1.5"/><circle cx="37" cy="9" r="6" fill="none" stroke="#7a6a58" stroke-width="1.5"/><path d="M37 9l6-6" stroke="#7a6a58" stroke-width="1.5"/><circle cx="37" cy="9" r="2.4" fill="#4db8d4"/><rect x="13" y="20" width="5" height="4" fill="#4db8d4"/><rect x="21" y="20" width="5" height="4" fill="#4db8d4"/></svg>`,
  reactor:`<svg viewBox="0 0 48 32"><path d="M16 6h16l-4 9 5 13H11l5-13z" fill="#cdbba3" stroke="#7a6a58" stroke-width="1.5"/><ellipse cx="24" cy="21" rx="6.2" ry="2.6" fill="#7fd7ea"/><path d="M19 4c1.5-2.5 8.5-2.5 10 0" stroke="#9aa4a8" stroke-width="2" fill="none"/></svg>`,
};

/* New Expedition+ : the Expedition Beacon (post-game exploration) */
const EXPED = {id:"exped", kind:"explore", item:"part", em:"🧭", nm:"Expedition Beacon", x:90, y:33};

/* legacy single-crop cycle length (v2 saves migrate from this) */
const GREEN_TICKS = 14;

/* the Great Storm (final objective) — measured in its own unit, storm phases,
   so "sol" can mean exactly TICKS_PER_SOL ticks everywhere else */
const STORM_TOTAL = 250;      // ticks (10 storm phases of 25 ticks each)
const STORM_PHASE = 25;

// forge recipes (smelt = tick action at machine shop; craft = instant at forge)
const SMELT = [
  {id:"s_iron", em:"🔩", nm:"Smelt Iron Bar", inp:{iron_ore:1}, out:"iron_bar", ticks:4, xp:18, pwr:2},
  {id:"s_copper", em:"🟠", nm:"Smelt Copper Bar", inp:{copper_ore:1}, out:"copper_bar", ticks:5, xp:24, pwr:2},
  {id:"s_tita", em:"⚙️", nm:"Smelt Titanium Bar", inp:{titanium_ore:1}, out:"titanium_bar", ticks:7, xp:52, pwr:4, need:"machine"},
  {id:"s_glass", em:"🪟", nm:"Fuse Silicate Glass", inp:{silicate_ore:1}, out:"glass", ticks:5, xp:64, pwr:3, need:"machine"},
  {id:"s_alloy", em:"🧲", nm:"Smelt RE Alloy", inp:{rare_ore:1}, out:"alloy", ticks:6, xp:120, pwr:4, need:"machine"},
  {id:"s_irid", em:"⚪", nm:"Smelt Iridium Bar", inp:{iridium_ore:1}, out:"iridium_bar", ticks:8, xp:210, pwr:6, need:"iridium_refining"},
];

/* ---------- equipment ---------- */
const EQUIP_SLOTS = ["suit","helmet","gloves","boots","scanner","backpack"];
const EQUIP_SLOT_META = {
  suit:{em:"🥼", nm:"Suit", stat:"o2", statNm:"O2 efficiency"},
  helmet:{em:"⛑️", nm:"Helmet", stat:"o2", statNm:"O2 efficiency"},
  gloves:{em:"🧤", nm:"Gloves", stat:"crit", statNm:"quality chance"},
  boots:{em:"🥾", nm:"Boots", stat:"speed", statNm:"walk speed"},
  scanner:{em:"📡", nm:"Scanner", stat:"geode", statNm:"geode find"},
  backpack:{em:"🎒", nm:"Backpack", stat:"pack", statNm:"pack slots"},
};
const EQUIP_TIERS = ["canvas","steel","titan","composite"];
const EQUIP_TIER_META = {
  canvas:{nm:"Canvas", lvl:5, xp:40, cost:{iron_bar:3, frame:1}},
  steel:{nm:"Steel", lvl:15, xp:90, cost:{iron_bar:4, copper_bar:3, frame:2}},
  titan:{nm:"Titan", lvl:30, xp:200, need:"machine", cost:{titanium_bar:4, glass:2, part:2}},
  composite:{nm:"Composite", lvl:45, xp:420, need:"alloy_tempering", cost:{iridium_bar:3, alloy:2, part2:2}},
};
/* stat value per slot per tier index (canvas, steel, titan, composite) */
const EQUIP_STATS = {
  suit:{o2:[4,8,12,16]},
  helmet:{o2:[2,4,6,8]},
  gloves:{crit:[1,2,3,4]},
  boots:{speed:[8,15,22,30]},
  scanner:{geode:[1,2,3,4]},
  backpack:{pack:[2,4,6,8]},
};

const CRAFT = [
  {id:"c_frame", em:"🔲", nm:"Frame", inp:{iron_bar:2}, out:{frame:1}, xp:14, lvl:1,
    desc:"Structural frame. The backbone of every building."},
  {id:"c_part", em:"🔌", nm:"Component", inp:{copper_bar:2}, out:{part:1}, xp:22, lvl:3,
    desc:"Electronics for solar, research and reactors."},
  {id:"c_frame2", em:"🔳", nm:"Composite Frame", inp:{glass:2, frame:2}, out:{frame2:1}, xp:110, lvl:28, need:"machine",
    desc:"Glass-braced frame for tier-III structures."},
  {id:"c_part2", em:"🎛️", nm:"Advanced Component", inp:{alloy:1, glass:1, part:2}, out:{part2:1}, xp:190, lvl:38, need:"machine",
    desc:"Rare-earth electronics for the colony's best hardware."},
  {id:"c_insulation", em:"🧻", nm:"Insulation Mat", inp:{glass:1, frame:1}, out:{insulation:1}, xp:70, lvl:22,
    desc:"Layered thermal wrap. Habitat III and cold-region gear need it."},
  {id:"c_fert", em:"🧂", nm:"Fertilizer", inp:{algae:2, water:1}, out:{fertilizer:2}, xp:60, lvl:18, need:"fertilizer_synth",
    desc:"Cuts crop cycle time by a quarter. Spread on a plot when planting."},
  {id:"c_steel", em:"⛏️", nm:"Steel Pick", inp:{iron_bar:4}, out:{}, gear:{pickaxe:"steel"}, xp:60, lvl:5,
    desc:"Faster mining than the stone pick you landed with."},
  {id:"c_titapick", em:"⛏️", nm:"Titanium Pick", inp:{titanium_bar:5}, out:{}, gear:{pickaxe:"titanium"}, xp:180, lvl:12, need:"machine",
    desc:"Bites through titanium veins with ease."},
  {id:"c_laser", em:"⛏️", nm:"Laser Pick", inp:{titanium_bar:6, part:4}, out:{}, gear:{pickaxe:"laser"}, xp:400, lvl:20, need:"laser_optics",
    desc:"Vaporises rock. Top tier mining speed."},
  {id:"c_drone", em:"🤖", nm:"Mining Drone", inp:{titanium_bar:4, part:3}, out:{}, drone:true, xp:150, lvl:8, need:"postgame",
    desc:"Autonomous rig that works a vein and delivers to the Depot. Cap rises with Robotics."},
  {id:"c_fuel", em:"⛽", nm:"Fuel Cell", inp:{water:2}, out:{fuel:1}, xp:20, lvl:1,
    desc:"Refined from water. Rovers burn one per trip between regions. (Chemistry takes this over in a later expedition.)"},
  {id:"c_rover2", em:"🛻", nm:"Rover Mk2", inp:{titanium_bar:6, part:4}, out:{}, gear:{rover:"rover2"}, xp:200, lvl:12, need:"machine",
    desc:"Cuts cross-region travel time by ~30%."},
  {id:"c_rover3", em:"🚙", nm:"Rover Mk3", inp:{alloy:3, part2:2}, out:{}, gear:{rover:"rover3"}, xp:420, lvl:35, need:"machine",
    desc:"Halves cross-region travel time. Top tier."},
];
/* generate the 24 equipment recipes (6 slots × 4 tiers) */
for (const tier of EQUIP_TIERS) {
  const tm = EQUIP_TIER_META[tier];
  for (const slot of EQUIP_SLOTS) {
    const sm = EQUIP_SLOT_META[slot];
    const ti = EQUIP_TIERS.indexOf(tier);
    const val = EQUIP_STATS[slot][sm.stat][ti];
    CRAFT.push({
      id:`c_${tier}_${slot}`, em:sm.em, nm:`${tm.nm} ${sm.nm}`,
      inp:tm.cost, out:{}, gear:{equip:slot, tier},
      xp:tm.xp, lvl:tm.lvl, need:tm.need,
      desc:`${sm.nm} (${tm.nm}): +${val}${sm.stat==="pack"?"":"%"} ${sm.statNm}.`,
    });
  }
}
const PICKS = {
  stone:{nm:"Stone Pick", mult:1.0, crit:0},
  steel:{nm:"Steel Pick", mult:0.8, crit:1},
  titanium:{nm:"Titanium Pick", mult:0.65, crit:2},
  laser:{nm:"Laser Pick", mult:0.5, crit:4},
};

/* ---------- crops (Agriculture) ---------- */
const CROPS = [
  {id:"potato", nm:"Potato", em:"🥔", item:"food", lvl:1, ticks:14, water:1, xp:40, min:1, max:2},
  {id:"soy", nm:"Soy", em:"🫘", item:"soy", lvl:15, ticks:22, water:1, xp:70, min:1, max:2},
  {id:"algae", nm:"Algae Vat", em:"🟢", item:"algae", lvl:30, ticks:30, water:2, xp:110, min:2, max:3},
  {id:"berries", nm:"Hydro Berries", em:"🫐", item:"berries", lvl:45, ticks:40, water:2, xp:170, min:1, max:3},
  {id:"genefruit", nm:"Genefruit", em:"🍇", item:"genefruit", lvl:60, ticks:55, water:3, xp:260, min:1, max:2, need:"xeno_agronomy"},
];
const BASE_PLOTS = 3;
const DISEASE_CHANCE = 0.10;   // per crop cycle; cured by clicking the plot

/* ---------- research: 20 projects in 3 tiers ----------
   tier 2 opens after 3 tier-1 projects; tier 3 after 3 tier-2. */
const RESEARCH = [
  // tier 1
  {id:"drills", tier:1, em:"🛠️", nm:"Reinforced Drills", inp:{titanium_bar:4, part:4}, desc:"Mining and ice work take one less tick.", effect:"Faster gathering."},
  {id:"scrub", tier:1, em:"🫧", nm:"O2 Scrubbers", inp:{part:3, food:10}, desc:"Improves colony oxygen regeneration.", effect:"+0.06 O2 / tick."},
  {id:"loaders", tier:1, em:"🔃", nm:"Auto Loaders", inp:{part:4, titanium_bar:6}, desc:"Smelting runs one tick faster.", effect:"Faster smelting."},
  {id:"laser_optics", tier:1, em:"🔦", nm:"Laser Optics", inp:{titanium_bar:6, part:6}, desc:"Unlocks the Laser Pick at the forge.", effect:"Best pickaxe."},
  {id:"grow_lights", tier:1, em:"💡", nm:"Grow Lights", inp:{glass:3, part:3}, desc:"Crops grow 20% faster.", effect:"-20% crop cycle."},
  {id:"survey_markers", tier:1, em:"📍", nm:"Survey Markers", inp:{iron_bar:6, glass:2}, desc:"Depleted veins respawn two ticks sooner.", effect:"Faster respawns."},
  // tier 2
  {id:"deep_drilling", tier:2, em:"🕳️", nm:"Deep Drilling", inp:{geode:2, titanium_bar:6}, desc:"+3% quality chance on ore veins.", effect:"+3% mining quality."},
  {id:"cryo_insulation", tier:2, em:"❄️", nm:"Cryo Insulation", inp:{insulation:3, glass:3}, desc:"+3% purity chance on ice work.", effect:"+3% ice purity."},
  {id:"fertilizer_synth", tier:2, em:"🧂", nm:"Fertilizer Synthesis", inp:{algae:6, glass:2}, desc:"Unlocks the Fertilizer recipe at the forge.", effect:"Fertilizer recipe."},
  {id:"grid_buffers", tier:2, em:"🔋", nm:"Grid Buffers", inp:{part:6, glass:4}, desc:"Colony power regeneration improves.", effect:"+0.05 Power / tick."},
  {id:"cargo_frame", tier:2, em:"🧺", nm:"Cargo Frame", inp:{frame:6, insulation:2}, desc:"+2 pack slots.", effect:"+2 pack slots."},
  {id:"drone_tuning", tier:2, em:"📶", nm:"Drone Tuning", inp:{part:8, geode:1}, desc:"Drones work two ticks faster.", effect:"Faster drones."},
  {id:"thermal_recyclers", tier:2, em:"♨️", nm:"Thermal Recyclers", inp:{insulation:4, part:4}, desc:"Waste heat becomes oxygen.", effect:"+0.03 O2 / tick."},
  // tier 3
  {id:"iridium_refining", tier:3, em:"⚪", nm:"Iridium Refining", inp:{geode:3, alloy:4}, desc:"Unlocks iridium smelting at the machine shop.", effect:"Iridium bars."},
  {id:"quality_assay", tier:3, em:"💎", nm:"Quality Assay", inp:{geode:4, glass:6}, desc:"Geodes turn up twice as often.", effect:"2× geode chance."},
  {id:"automation_core", tier:3, em:"🧠", nm:"Automation Core", inp:{part2:2, alloy:3}, desc:"Overclock faults happen half as often.", effect:"Safer overclock."},
  {id:"xeno_agronomy", tier:3, em:"🍇", nm:"Xeno-Agronomy", inp:{berries:8, geode:2}, desc:"Unlocks the Genefruit crop.", effect:"Genefruit (best ration)."},
  {id:"orbital_uplink", tier:3, em:"🛰️", nm:"Orbital Uplink", inp:{part2:3, alloy:4}, desc:"Mission Control guidance grants +3% xp to everything.", effect:"+3% all xp."},
  {id:"alloy_tempering", tier:3, em:"🔥", nm:"Alloy Tempering", inp:{alloy:6, iridium_bar:2}, desc:"Unlocks Composite equipment at the forge.", effect:"Tier-4 gear."},
  {id:"emergency_protocols", tier:3, em:"🚨", nm:"Emergency Protocols", inp:{part2:2, insulation:4}, desc:"The Survival emergency beacon restores twice as much.", effect:"Stronger beacon."},
];
const RESEARCH_TIER_REQ = 3; // projects of the previous tier to open the next

/* ---------- skill unlock ladders (the skill guide + level-up toasts) ---------- */
const UNLOCKS = {
  mining: [
    {lvl:1, tx:"Iron veins"}, {lvl:10, tx:"Copper veins"}, {lvl:25, tx:"Titanium veins (needs Machine Shop)"},
    {lvl:30, tx:"Silicate beds — glass!"}, {lvl:55, tx:"Rare-earth seams — alloy!"}, {lvl:75, tx:"Iridium lodes — endgame metal"},
    {lvl:90, tx:"Voidglass meteor cores (a future region)"},
  ],
  water: [
    {lvl:1, tx:"Surface ice deposits"}, {lvl:20, tx:"Permafrost beds"}, {lvl:40, tx:"Brine wells (double ice)"},
    {lvl:60, tx:"Polar drilling (a future region)"}, {lvl:80, tx:"Cryogeyser tapping (a future region)"},
  ],
  fab: [
    {lvl:1, tx:"Frames"}, {lvl:3, tx:"Components"}, {lvl:5, tx:"Steel Pick + Canvas gear"},
    {lvl:12, tx:"Titanium Pick"}, {lvl:15, tx:"Steel gear"}, {lvl:18, tx:"Fertilizer (with research)"},
    {lvl:20, tx:"Laser Pick (with research)"}, {lvl:22, tx:"Insulation Mats"}, {lvl:28, tx:"Composite Frames"},
    {lvl:30, tx:"Titan gear"}, {lvl:38, tx:"Advanced Components"}, {lvl:45, tx:"Composite gear (with research)"},
  ],
  eng: [
    {lvl:1, tx:"Service structures for O2 + Power"}, {lvl:10, tx:"Habitat II"}, {lvl:15, tx:"Solar II"},
    {lvl:20, tx:"Water Plant II · Greenhouse II"}, {lvl:25, tx:"Machine Shop II · Overclock toggle"},
    {lvl:35, tx:"Habitat III"}, {lvl:40, tx:"Solar III"}, {lvl:45, tx:"Water III · Greenhouse III (4th plot)"}, {lvl:50, tx:"Machine Shop III"},
  ],
  agri: [
    {lvl:1, tx:"Potatoes"}, {lvl:15, tx:"Soy"}, {lvl:30, tx:"Algae vats"},
    {lvl:45, tx:"Hydro berries"}, {lvl:60, tx:"Genefruit (with research)"},
  ],
  robotics: [
    {lvl:1, tx:"First mining drone (NE+)"}, {lvl:10, tx:"Second drone"}, {lvl:20, tx:"Third drone"},
  ],
  explore: [
    {lvl:1, tx:"Expedition treks (NE+)"}, {lvl:10, tx:"+1 loot roll"}, {lvl:20, tx:"+2 loot rolls"},
  ],
  research: [
    {lvl:1, tx:"Tier 1 projects"}, {lvl:1, tx:"Tier 2 after 3 projects"}, {lvl:1, tx:"Tier 3 after 3 tier-2 projects"},
  ],
  piloting: [
    {lvl:1, tx:"Survey Buggy — reach the Dune Sea"}, {lvl:10, tx:"Faster travel routes"},
    {lvl:20, tx:"Canyon Network (a future region)"}, {lvl:30, tx:"Rover Mk3 at the Forge"},
    {lvl:40, tx:"Polar Cap (a future region)"},
  ],
  survival: [
    {lvl:1, tx:"Storm drain resistance (scales to 50)"}, {lvl:10, tx:"Rations restore +2 O2"},
    {lvl:25, tx:"Low-O2 grace: passive drain halved below 15 O2"}, {lvl:40, tx:"Storm surges hit 2 points softer"},
    {lvl:50, tx:"Emergency beacon: automatic rescue once per sol"},
  ],
};

const QUESTS = [
  {id:"q1", tx:"Mine 5 iron ore from a vein", chk:s=>s.stats.mined_iron_ore>=5, goal:s=>`${Math.min(5,s.stats.mined_iron_ore)}/5`},
  {id:"q2", tx:"Walk to the Machine Shop site and smelt an Iron Bar", chk:s=>s.stats.smelted_iron_bar>=1, goal:s=>`${Math.min(1,s.stats.smelted_iron_bar)}/1`},
  {id:"q3", tx:"Craft 3 Frames at the Forge tab", chk:s=>s.stats.crafted_frame>=3, goal:s=>`${Math.min(3,s.stats.crafted_frame||0)}/3`},
  {id:"q4", tx:"Build the Solar Array to secure power", chk:s=>s.built.solar, goal:s=>s.built.solar?"done":"pending"},
  {id:"q5", tx:"Extract 12 ice for the water supply", chk:s=>s.stats.mined_ice>=12, goal:s=>`${Math.min(12,s.stats.mined_ice)}/12`},
  {id:"q6", tx:"Build the Water Plant", chk:s=>s.built.water, goal:s=>s.built.water?"done":"pending"},
  {id:"q7", tx:"Build the Machine Shop to reach titanium", chk:s=>s.built.machine, goal:s=>s.built.machine?"done":"pending"},
  {id:"q8", tx:"Smelt your first Titanium Bar", chk:s=>s.stats.smelted_titanium_bar>=1, goal:s=>`${Math.min(1,s.stats.smelted_titanium_bar||0)}/1`},
  {id:"q9", tx:"Build the Greenhouse", chk:s=>s.built.green, goal:s=>s.built.green?"done":"pending"},
  {id:"q10", tx:"Harvest 5 crops in the Greenhouse", chk:s=>s.stats.harvested_food>=5, goal:s=>`${Math.min(5,s.stats.harvested_food||0)}/5`},
  {id:"q11", tx:"Build the Research Lab", chk:s=>s.built.lab, goal:s=>s.built.lab?"done":"pending"},
  {id:"q12", tx:"Complete any research project", chk:s=>Object.keys(s.research).length>=1, goal:s=>Object.keys(s.research).length>=1?"done":"pending"},
  {id:"q13", tx:"Build the Fusion Reactor", chk:s=>s.built.reactor, goal:s=>s.built.reactor?"done":"pending"},
  {id:"q14", tx:"Endure the Great Storm (10 phases) with O2 and Power above 50%", chk:s=>!!s.victory,
    goal:s=>s.victory?"done":(s.finalStorm&&s.finalStorm.status==="active"?`storm phase ${Math.min(10,Math.floor((STORM_TOTAL-s.finalStorm.t)/STORM_PHASE)+1)}/10`:(s.finalStorm&&s.finalStorm.status==="ready"?"awaiting your signal":"pending"))},
];

/* ---------- xp / level curve (RuneScape-style) ---------- */
const XP_TABLE = (()=>{ let pts=0, t=[0,0]; for(let l=1;l<99;l++){pts+=Math.floor(l+300*Math.pow(2,l/7)); t[l+1]=Math.floor(pts/4);} return t; })();
function levelFromXp(xp){ let l=1; while(l<99 && xp>=XP_TABLE[l+1]) l++; return l; }
function xpForLevel(l){ return XP_TABLE[l]||0; }


export {
  TICK, TICKS_PER_SOL, SAVE_KEY, ITEMS, EDIBLES, SKILLS, NODES, BUILDINGS, BUILD_TIERS,
  OVERCLOCK_LVL, OVERCLOCK_MULT, FAULT_CHANCE, BSVG, EXPED, GREEN_TICKS,
  STORM_TOTAL, STORM_PHASE, SMELT, CRAFT, PICKS, CROPS, BASE_PLOTS, DISEASE_CHANCE,
  EQUIP_SLOTS, EQUIP_SLOT_META, EQUIP_TIERS, EQUIP_TIER_META, EQUIP_STATS,
  REGIONS, FUTURE_REGIONS, ROVERS, TRAVEL_FUEL,
  RESEARCH, RESEARCH_TIER_REQ, UNLOCKS, QUESTS,
  XP_TABLE, levelFromXp, xpForLevel,
};
