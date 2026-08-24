import test from 'node:test';
import assert from 'node:assert/strict';
import { convertLegacySave, parseLegacySave, LegacyImportError } from './legacy-import.mjs';
import { levelForXp, xpForLevel } from './engine.mjs';

// A realistic marsscape_v1 (SAVE_VERSION 4) save: mid-postgame, banked resources,
// tiered structures, a diseased plot, drones and a discovered rich vein.
function legacySave(overrides = {}) {
  return {
    v: 4,
    lastSeen: 1_700_000_000_000,
    sol: 42,
    o2: 88,
    pwr: 71,
    skills: {
      mining: { xp: xpForLevel(72) }, water: { xp: xpForLevel(55) },
      fab: { xp: xpForLevel(60) }, eng: { xp: xpForLevel(48) },
      agri: { xp: xpForLevel(33) }, robotics: { xp: xpForLevel(21) },
      explore: { xp: xpForLevel(12) }, research: { xp: xpForLevel(40) },
      piloting: { xp: xpForLevel(27) }, survival: { xp: xpForLevel(51) },
    },
    inv: { iron_ore: 12, part: 6, frame2: 2, part2: 1, geode: 3, water: 20 },
    bank: { iron_bar: 240, glass: 85, alloy: 30, part: 44, iridium_bar: 5 },
    pickaxe: 'laser',
    region: 'dune_sea',
    rover: 'rover3',
    built: { habitat: true, depot: true, solar: true, water: true, machine: true, green: true, lab: true, reactor: true },
    tier: { habitat: 3, solar: 2, water: 1, machine: 3, green: 2 },
    fault: { solar: true },
    overclock: true,
    research: { drills: true, scrub: true, loaders: true, deep_drilling: true, quality_assay: true, alloy_tempering: true },
    equip: { suit: 'composite', helmet: 'titan', gloves: 'steel', boots: 'composite', scanner: 'titan', backpack: null },
    farm: { plots: [{ crop: 'berries', t: 18, disease: true, fert: true, rolled: true }, { crop: 'algae', t: 5 }, { crop: null }] },
    finalStorm: { status: 'won', t: 0 },
    victory: true,
    postgame: true,
    drones: [{ node: 'iron1', t: 3 }, { node: 'cop1', t: 1 }],
    extraNodes: [{ id: 'rich1', item: 'titanium_ore' }],
    quest: 14,
    stats: { mined_iron_ore: 320, smelted_iron_bar: 140, crafted_frame: 55, mined_part: 9 },
    ...overrides,
  };
}

test('a real legacy save migrates without losing progression', () => {
  const { state, report } = convertLegacySave(JSON.stringify(legacySave()), 1_700_000_100_000);

  // skills, including the three renamed ones and the two postgame ones
  assert.equal(state.skills.mining.level, 72);
  assert.equal(state.skills.fabrication.level, 60, 'fab -> fabrication');
  assert.equal(state.skills.engineering.level, 48, 'eng -> engineering');
  assert.equal(state.skills.agriculture.level, 33, 'agri -> agriculture');
  assert.equal(state.skills.exploration.level, 12, 'explore -> exploration');
  assert.equal(state.skills.robotics.level, 21);

  // inventory and bank, including renamed items
  assert.equal(state.inventory.component, 6, 'part -> component');
  assert.equal(state.inventory.composite_frame, 2, 'frame2 -> composite_frame');
  assert.equal(state.inventory.advanced_component, 1, 'part2 -> advanced_component');
  assert.equal(state.inventory.geode, 3);
  assert.equal(state.bank.iron_bar, 240, 'banked resources survive');
  assert.equal(state.bank.component, 44, 'banked renamed items survive');
  assert.equal(state.bank.iridium_bar, 5);

  // structures, tiers, faults, overclock
  assert.equal(state.built.greenhouse, true, 'green -> greenhouse');
  assert.equal(state.tier.habitat, 3);
  assert.equal(state.tier.greenhouse, 2, 'tier keys are remapped too');
  assert.equal(state.fault.solar, true, 'an outstanding fault is carried, not cleared');
  assert.equal(state.overclock, true);

  // research, equipment, gear
  assert.equal(state.research.scrubbers, true, 'scrub -> scrubbers');
  assert.equal(state.research.alloy_tempering, true);
  assert.equal(state.equip.suit, 'composite');
  assert.equal(state.equip.backpack, null);
  assert.equal(state.gear.pickaxe, 'laser');
  assert.equal(state.rover, 'rover3');
  assert.equal(state.currentRegion, 'dune_sea');

  // farm, objectives, postgame
  assert.equal(state.farm.plots[0].crop, 'berries');
  assert.equal(state.farm.plots[0].disease, true, 'blight is preserved, not silently cured');
  assert.equal(state.farm.plots[0].fert, true);
  assert.equal(state.objective, 14, 'all 14 objectives stay complete');
  assert.equal(state.victory, true);
  assert.equal(state.postgame, true);
  assert.equal(state.storm.status, 'won');
  assert.equal(state.drones.length, 2);
  assert.equal(state.extraNodes.length, 1);
  assert.equal(state.stats.mined_component, 9, 'stat keys are remapped with their item');
  assert.equal(state.stats.mined_iron_ore, 320);

  assert.equal(report.quarantine.length, 0, 'a clean save quarantines nothing');
  assert.equal(report.legacyVersion, 4);
  assert.equal(state.legacyVersion, 'marsscape_v1.v4');
});

test('the original save is preserved verbatim for rollback', () => {
  const save = legacySave();
  const { report } = convertLegacySave(JSON.stringify(save));
  assert.deepEqual(JSON.parse(report.original), save);
});

test('unsupported values are quarantined and reported, never dropped silently', () => {
  const { state, report } = convertLegacySave(JSON.stringify(legacySave({
    inv: { iron_ore: 5, voidglass: 99 },
    research: { drills: true, warp_drive: true },
    equip: { suit: 'canvas', jetpack: 'titan' },
    region: 'polar_cap',
    moraleSystem: { happy: true },
  })));
  const paths = report.quarantine.map((q) => q.path);
  assert.ok(paths.includes('inv.voidglass'), 'unknown item is held');
  assert.ok(paths.includes('research.warp_drive'), 'unknown research is held');
  assert.ok(paths.includes('equip.jetpack'), 'unknown slot is held');
  assert.ok(paths.includes('region'), 'unreachable region is held');
  assert.ok(paths.includes('moraleSystem'), 'a whole unknown subsystem is held');
  for (const entry of report.quarantine) assert.ok(entry.reason, 'every quarantined value says why');
  assert.equal(state.currentRegion, 'landing_basin', 'an unmappable region falls back, it does not crash');
  assert.equal(state.inventory.iron_ore, 5, 'the mappable part still imports');
});

test('a save caught mid-storm is reset to ready rather than resumed', () => {
  const { state, report } = convertLegacySave(JSON.stringify(legacySave({
    finalStorm: { status: 'active', t: 120 }, victory: false, postgame: false,
  })));
  assert.equal(state.storm.status, 'ready');
  assert.equal(state.storm.remaining, 0);
  assert.ok(report.notes.some((n) => /mid-storm/i.test(n)), 'the reset is reported to the player');
});

test('base64 save codes and MixKit envelopes both decode', () => {
  const save = legacySave();
  const json = JSON.stringify(save);
  const code = Buffer.from(json, 'utf8').toString('base64');
  assert.equal(parseLegacySave(code).legacy.sol, 42);
  assert.equal(parseLegacySave(JSON.stringify({ ns: 'marsscape', v: 1, state: save })).legacy.sol, 42);
});

test('junk, empty, and too-new saves are refused with a reason', () => {
  for (const [input, code] of [
    ['', 'EMPTY'],
    ['not a save', 'UNREADABLE'],
    ['[1,2,3]', 'NOT_A_SAVE'],
    [JSON.stringify({ v: 99, skills: {} }), 'TOO_NEW'],
    [JSON.stringify({ v: 4, sol: 3 }), 'NOT_A_SAVE'],
  ]) {
    assert.throws(() => parseLegacySave(input), (err) => {
      assert.ok(err instanceof LegacyImportError, `${code} should be a LegacyImportError`);
      assert.equal(err.code, code);
      return true;
    }, `input ${JSON.stringify(input).slice(0, 30)} should be refused as ${code}`);
  }
});

test('an imported save cannot smuggle state past the sanitizer', () => {
  const { state } = convertLegacySave(JSON.stringify(legacySave({
    o2: 9999, sol: -5,
    inv: { iron_ore: 1e12 },
    skills: { mining: { xp: 9e18 } },
  })));
  assert.equal(state.meters.oxygen, 100, 'meters are clamped');
  assert.ok(state.sol >= 1, 'sol cannot go negative');
  assert.ok(state.inventory.iron_ore <= 99_999, 'inventory is clamped');
  assert.equal(state.skills.mining.level, levelForXp(state.skills.mining.xp), 'level always matches xp');
  assert.ok(state.skills.mining.level <= 99);
});
