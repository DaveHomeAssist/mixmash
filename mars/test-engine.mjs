import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createState, equipStats, levelForXp, sanitizeState } from './engine.mjs';

function withFuel(state, count = 1) {
  state.inventory.fuel = count;
  return state;
}

test('gather command mutates only canonical server state', () => {
  const realRandom = Math.random;
  try {
    // Pin the rolls: 0.99 clears neither the quality crit nor the 2% geode chance,
    // both of which would otherwise add mining xp and make this assertion flaky.
    Math.random = () => 0.99;
    const before = createState(1_700_000_000_000);
    const { state } = applyCommand(before, { id: 'cmd-1', type: 'gather', nodeId: 'iron-north' }, 1_700_000_005_000);
    assert.equal(state.inventory.iron_ore, 1);
    assert.equal(state.skills.mining.xp, 16); // MarsScape's iron-vein xp
    assert.equal(state.seq, 1);
  } finally {
    Math.random = realRandom;
  }
});

test('duplicate command id is idempotent', () => {
  const before = createState(1_700_000_000_000);
  const first = applyCommand(before, { id: 'same', type: 'gather', nodeId: 'iron-north' }, 1_700_000_005_000).state;
  const second = applyCommand(first, { id: 'same', type: 'gather', nodeId: 'iron-north' }, 1_700_000_010_000).state;
  assert.equal(second.inventory.iron_ore, 1);
});

test('build rejects unaffordable structures', () => {
  const before = createState(1_700_000_000_000);
  assert.throws(
    () => applyCommand(before, { id: 'cmd-2', type: 'build', buildingId: 'solar' }, 1_700_000_005_000),
    /Need 6 Iron Bar/,
  );
});

test('sanitizer clamps tampered resource values', () => {
  const dirty = createState();
  dirty.meters.oxygen = 9999;
  dirty.inventory.iron_ore = 1_000_000;
  dirty.built.habitat = false;
  const clean = sanitizeState(dirty);
  assert.equal(clean.meters.oxygen, 100);
  assert.equal(clean.inventory.iron_ore, 99_999); // slot-based pack is the real bound now
  assert.equal(clean.built.habitat, true);
});

// --- Phase 2 port: regions, Piloting/travel, rovers, equipment ---

test('travel departs, spends fuel, and sets an arrival timestamp (not a live counter)', () => {
  const before = withFuel(createState(1_700_000_000_000));
  const { state } = applyCommand(before, { id: 't1', type: 'travel', destRegion: 'dune_sea' }, 1_700_000_000_000);
  assert.equal(state.inventory.fuel, 0);
  assert.equal(state.currentRegion, 'landing_basin', 'region does not change until arrival resolves');
  assert.equal(state.travel.destRegion, 'dune_sea');
  assert.ok(state.travel.arrivalAt > 1_700_000_000_000);
});

test('travel is blocked without fuel, mid-trip, or during the storm', () => {
  const noFuel = createState(1_700_000_000_000);
  assert.throws(() => applyCommand(noFuel, { id: 't2', type: 'travel', destRegion: 'dune_sea' }, 1_700_000_000_000), /Need 1 Fuel/);

  const midTrip = applyCommand(withFuel(createState(1_700_000_000_000), 2), { id: 't3', type: 'travel', destRegion: 'dune_sea' }, 1_700_000_000_000).state;
  // Still traveling to dune_sea (currentRegion hasn't flipped yet) — a second attempt
  // at the same destination must hit ALREADY_TRAVELING, not ALREADY_THERE.
  assert.throws(() => applyCommand(midTrip, { id: 't4', type: 'travel', destRegion: 'dune_sea' }, 1_700_000_000_500), /already underway/);

  const duringStorm = withFuel(createState(1_700_000_000_000));
  duringStorm.storm.status = 'active';
  assert.throws(() => applyCommand(duringStorm, { id: 't5', type: 'travel', destRegion: 'dune_sea' }, 1_700_000_000_000), /Great Storm/);
});

test('travel arrival flips region and grants Piloting XP once the arrival time passes', () => {
  const before = withFuel(createState(1_700_000_000_000));
  const departed = applyCommand(before, { id: 't6', type: 'travel', destRegion: 'dune_sea' }, 1_700_000_000_000).state;
  const arrivalAt = departed.travel.arrivalAt;

  const tooEarly = applyCommand(departed, { id: 't7', type: 'tick' }, arrivalAt - 1).state;
  assert.equal(tooEarly.currentRegion, 'landing_basin');

  const arrived = applyCommand(departed, { id: 't8', type: 'tick' }, arrivalAt + 1).state;
  assert.equal(arrived.currentRegion, 'dune_sea');
  assert.equal(arrived.travel, null);
  assert.equal(arrived.skills.piloting.xp, 50);
});

test('rover tier shortens travel duration; Piloting level shortens it further', () => {
  const buggy = withFuel(createState(1_700_000_000_000));
  const buggyTrip = applyCommand(buggy, { id: 't9', type: 'travel', destRegion: 'dune_sea' }, 1_700_000_000_000).state;
  const buggyMs = buggyTrip.travel.arrivalAt - 1_700_000_000_000;

  const piloted = withFuel(createState(1_700_000_000_000));
  piloted.rover = 'rover3';
  piloted.skills.piloting = { xp: 1_000_000, level: levelForXp(1_000_000) };
  const fastTrip = applyCommand(piloted, { id: 't10', type: 'travel', destRegion: 'dune_sea' }, 1_700_000_000_000).state;
  const fastMs = fastTrip.travel.arrivalAt - 1_700_000_000_000;

  assert.ok(fastMs < buggyMs, 'a better rover + higher Piloting level should travel faster');
  assert.ok(fastMs >= 4 * 600, 'duration never drops below the 4-tick floor');
});

test('boots speed cuts travel duration, and stacks with rover and Piloting', () => {
  const NOW = 1_700_000_000_000;
  const bare = withFuel(createState(NOW));
  const bareMs = applyCommand(bare, { id: 'sp1', type: 'travel', destRegion: 'dune_sea' }, NOW)
    .state.travel.arrivalAt - NOW;

  const booted = withFuel(createState(NOW));
  booted.equip.boots = 'composite'; // speed 30
  const bootedMs = applyCommand(booted, { id: 'sp2', type: 'travel', destRegion: 'dune_sea' }, NOW)
    .state.travel.arrivalAt - NOW;

  assert.ok(bootedMs < bareMs, 'composite boots must actually shorten the trip');
  // baseTravelTicks 20, roverMult 1, speed 30% -> round(20 * 0.7) = 14 ticks
  assert.equal(bootedMs, 14 * 600);

  const stacked = withFuel(createState(NOW));
  stacked.equip.boots = 'composite';
  stacked.rover = 'rover3';
  stacked.skills.piloting = { xp: 1_000_000, level: levelForXp(1_000_000) };
  const stackedMs = applyCommand(stacked, { id: 'sp3', type: 'travel', destRegion: 'dune_sea' }, NOW)
    .state.travel.arrivalAt - NOW;
  assert.ok(stackedMs <= bootedMs, 'gear, rover, and skill all compound');
  assert.ok(stackedMs >= 4 * 600, 'duration never drops below the 4-tick floor');
});

test('scanner geode stat yields a geode from ore seams, and only from ore seams', () => {
  const realRandom = Math.random;
  try {
    // 0 is below any non-zero percentage roll, so every chance-gated branch fires.
    Math.random = () => 0;

    const miner = createState(1_700_000_000_000);
    miner.equip.scanner = 'composite'; // geode 4
    const mined = applyCommand(miner, { id: 'g1', type: 'gather', nodeId: 'iron-north' }, 1_700_000_005_000).state;
    assert.equal(mined.inventory.geode, 1, 'an ore gather should turn up a geode');
    assert.ok(mined.inventory.iron_ore >= 1, 'the node still yields its own resource');

    const iceMiner = createState(1_700_000_000_000);
    iceMiner.equip.scanner = 'composite';
    const iced = applyCommand(iceMiner, { id: 'g2', type: 'gather', nodeId: 'ice-pocket' }, 1_700_000_005_000).state;
    assert.equal(iced.inventory.geode || 0, 0, 'ice scarps hold no geodes');

    const bare = createState(1_700_000_000_000);
    const plain = applyCommand(bare, { id: 'g3', type: 'gather', nodeId: 'iron-north' }, 1_700_000_005_000).state;
    assert.ok((plain.inventory.geode || 0) <= 1, 'the base 2% geode chance still applies without a scanner');
  } finally {
    Math.random = realRandom;
  }
});

test('gather is region-scoped: a Dune Sea node cannot be gathered from the basin, and vice versa', () => {
  const atBasin = createState(1_700_000_000_000);
  assert.throws(
    () => applyCommand(atBasin, { id: 'g1', type: 'gather', nodeId: 'dune-iron-scree' }, 1_700_000_000_000),
    /not in your current region/,
  );

  const atDuneSea = createState(1_700_000_000_000);
  atDuneSea.currentRegion = 'dune_sea';
  assert.throws(
    () => applyCommand(atDuneSea, { id: 'g2', type: 'gather', nodeId: 'iron-north' }, 1_700_000_000_000),
    /not in your current region/,
  );
});

test('build/smelt/research are rejected away from the Landing Basin', () => {
  const away = createState(1_700_000_000_000);
  away.currentRegion = 'dune_sea';
  away.inventory.iron_bar = 10;
  away.inventory.frame = 5;
  away.inventory.component = 5;
  assert.throws(() => applyCommand(away, { id: 'b1', type: 'build', buildingId: 'solar' }, 1_700_000_000_000), /Landing Basin/);
  assert.throws(() => applyCommand(away, { id: 'b2', type: 'smelt', recipeId: 'smelt-iron' }, 1_700_000_000_000), /Landing Basin/);
  assert.throws(() => applyCommand(away, { id: 'b3', type: 'research', projectId: 'drills' }, 1_700_000_000_000), /Landing Basin/);
});

test('craft applies rover and equipment gear, and blocks same-or-worse re-crafts', () => {
  const state = createState(1_700_000_000_000);
  state.built.machine = true;
  state.skills.fabrication = { xp: 1_000_000, level: levelForXp(1_000_000) };
  state.inventory.titanium_bar = 50;
  state.inventory.component = 50;
  state.inventory.iron_bar = 50;
  state.inventory.frame = 50;

  const withRover = applyCommand(state, { id: 'c1', type: 'craft', recipeId: 'craft-rover-2' }, 1_700_000_000_000).state;
  assert.equal(withRover.rover, 'rover2');
  assert.throws(() => applyCommand(withRover, { id: 'c2', type: 'craft', recipeId: 'craft-rover-2' }, 1_700_000_000_000), /equal or better rover/);

  const withGear = applyCommand(withRover, { id: 'c3', type: 'craft', recipeId: 'craft-equip-canvas-suit' }, 1_700_000_000_000).state;
  assert.equal(withGear.equip.suit, 'canvas');
  assert.throws(() => applyCommand(withGear, { id: 'c4', type: 'craft', recipeId: 'craft-equip-canvas-suit' }, 1_700_000_000_000), /equal or better item/);
});

test('craft respects a recipe Fabrication-level gate', () => {
  const state = createState(1_700_000_000_000);
  state.built.machine = true;
  state.inventory.titanium_bar = 50;
  state.inventory.component = 50;
  assert.throws(
    () => applyCommand(state, { id: 'c5', type: 'craft', recipeId: 'craft-rover-2' }, 1_700_000_000_000),
    /Fabrication level 12/,
  );
});

test('equipStats aggregates across all equipped slots', () => {
  const state = createState();
  state.equip.suit = 'composite';
  state.equip.helmet = 'canvas';
  const stats = equipStats(state);
  assert.equal(stats.o2, 16 + 2); // composite suit + canvas helmet
  assert.equal(stats.crit, 0);
});

test('sanitizer falls back to safe defaults for tampered region/rover/equip/travel fields', () => {
  const dirty = createState();
  dirty.currentRegion = 'moon-base';
  dirty.rover = 'rocket-car';
  dirty.equip = { suit: 'diamond' };
  dirty.travel = { destRegion: 'nowhere', arrivalAt: 123 };
  const clean = sanitizeState(dirty);
  assert.equal(clean.currentRegion, 'landing_basin');
  assert.equal(clean.rover, 'buggy');
  assert.equal(clean.equip.suit, null);
  assert.equal(clean.travel, null);
});

test('servicing is paced like every other repeatable action', () => {
  // Review finding 5: service grants xp and meter recovery, so leaving it unpaced
  // left the command-spam hole open in another progression path.
  const NOW = 1_700_000_000_000;
  const state = createState(NOW);
  const first = applyCommand(state, { id: 's1', type: 'service', buildingId: 'habitat' }, NOW).state;
  assert.ok(first.busyUntil > NOW, 'servicing occupies the colonist');
  const xpAfterOne = first.skills.engineering.xp;

  assert.throws(
    () => applyCommand(first, { id: 's2', type: 'service', buildingId: 'habitat' }, NOW),
    (err) => err.code === 'BUSY',
    'a second service at the same instant must be refused',
  );

  // once the action has elapsed it works again
  const later = applyCommand(first, { id: 's3', type: 'service', buildingId: 'habitat' }, first.busyUntil + 1).state;
  assert.ok(later.skills.engineering.xp > xpAfterOne, 'servicing still works after the pacing window');
});

test('a faulted structure blocks the storm instead of counting as online', () => {
  // Codex review: passiveRates treats a fault as producing nothing, but the storm
  // readiness predicate only checked `built` — so overclock could fault the reactor
  // and the run would still start with a dead structure counted as ready.
  const NOW = 1_700_000_000_000;
  const state = createState(NOW);
  for (const id of ['depot', 'solar', 'water', 'machine', 'greenhouse', 'lab', 'reactor']) state.built[id] = true;
  state.meters = { oxygen: 100, power: 100 };

  const ok = applyCommand(state, { id: 'st1', type: 'startStorm' }, NOW).state;
  assert.equal(ok.storm.status, 'active', 'a fully online colony can start the storm');

  const faulted = createState(NOW);
  for (const id of ['depot', 'solar', 'water', 'machine', 'greenhouse', 'lab', 'reactor']) faulted.built[id] = true;
  faulted.meters = { oxygen: 100, power: 100 };
  faulted.fault.reactor = true;
  assert.throws(
    () => applyCommand(faulted, { id: 'st2', type: 'startStorm' }, NOW),
    (err) => err.code === 'SYSTEM_FAULTED' && /Fusion Reactor/.test(err.message),
    'a faulted reactor must block the storm and say which structure',
  );

  // servicing it clears the fault and re-opens the storm
  const serviced = applyCommand(faulted, { id: 'sv', type: 'service', buildingId: 'reactor' }, NOW).state;
  serviced.meters = { oxygen: 100, power: 100 };
  const after = applyCommand(serviced, { id: 'st3', type: 'startStorm' }, serviced.busyUntil + 1).state;
  assert.equal(after.storm.status, 'active');
});
