import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');

async function loadBrowserGlobals(files) {
  const sandbox = { globalThis: null };
  sandbox.globalThis = sandbox;
  for (const file of files) {
    const source = await readFile(path.join(ROOT, file), 'utf8');
    vm.runInNewContext(source, sandbox, { filename: file });
  }
  return sandbox;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('input module exposes canonical keyboard binding tables', async () => {
  const sandbox = await loadBrowserGlobals(['play/input-data.js']);
  const input = sandbox.MixmashInputData;
  assert.equal(input.DEFAULT_P1_BINDS.left, 'KeyA');
  assert.equal(input.DEFAULT_P1_BINDS.attack2, 'Space');
  assert.equal(input.DEFAULT_P2_BINDS.left, 'ArrowLeft');
  assert.deepEqual(plain(input.CONTROL_ACTIONS), ['left', 'right', 'up', 'down', 'attack', 'special', 'shield']);
  const keyBindings = input.createDefaultKeyBindings();
  assert.equal(keyBindings.P1_ATTACK, 'KeyJ');
  assert.equal(keyBindings.P2_ATTACK, 'Numpad1');
  assert.equal(Object.keys(keyBindings).length, 14);
});

test('mode rules module owns Platform Rush and quick fight defaults', async () => {
  const sandbox = await loadBrowserGlobals(['play/mode-rules.js']);
  const rules = sandbox.MixmashModeRules;
  assert.deepEqual(plain(rules.MATCH_TYPES), ['stock', 'time', 'training', 'rush']);
  assert.equal(rules.PLATFORM_RUSH.records, 8);
  assert.equal(rules.PLATFORM_RUSH.deepCuts, 2);
  assert.equal(rules.MODE_SELECT_ITEMS.at(-1).key, 'rush');
  assert.equal(rules.PROFILE_CHALLENGES.some((challenge) => challenge.id === 'rush_complete'), true);

  const setup = rules.sanitizeQuickFightSetup(
    { p1Fighter: 'bad', p2Fighter: 'bassforger', selectedStage: 'crystalCanopy', matchType: 'rush', p2Cpu: false, p1CpuLevel: 5, p2CpuLevel: 9 },
    { fighterKeys: ['runeweaver', 'bassforger'], stageKeys: ['battlefield', 'crystalCanopy'] }
  );
  assert.equal(setup.p1Fighter, 'runeweaver');
  assert.equal(setup.p2Fighter, 'bassforger');
  assert.equal(setup.selectedStage, 'crystalCanopy');
  assert.equal(setup.matchType, 'stock');
  assert.equal(setup.p2Cpu, false);
  assert.equal(setup.p1CpuLevel, 5);
  assert.equal(setup.p2CpuLevel, 3);

  const rush = rules.createPlatformRushState({
    active: true,
    collectibles: [{ id: 'x', type: 'deepCut', x: Infinity, y: 12, value: 350 }],
  });
  assert.equal(rush.active, true);
  assert.equal(rush.timeRemaining, 120);
  assert.equal(rush.totalRecords, 8);
  assert.equal(rush.totalDeepCuts, 2);
  assert.deepEqual(plain(rush.collectibles[0]), {
    id: 'x',
    type: 'deepCut',
    x: 0,
    y: 12,
    platformIndex: 0,
    hidden: false,
    collected: false,
    value: 350,
  });
});

test('snapshot module centralizes storage keys and delegates schema validation', async () => {
  const sandbox = await loadBrowserGlobals(['play/core.js', 'play/snapshot-data.js']);
  const snapshot = sandbox.MixmashSnapshotData;
  assert.equal(snapshot.STORAGE_KEYS.activeMatchSnapshot, 'mixmash_active_match_snapshot');
  assert.equal(snapshot.STORAGE_KEYS.quickFightSetup, 'mixmash_quick_fight_setup');
  assert.equal(snapshot.ACTIVE_MATCH_SNAPSHOT_VERSION, 1);
  assert.equal(snapshot.MIXMASH_PROFILE_VERSION, 1);
  assert.equal(snapshot.SNAPSHOT_SAVE_INTERVAL, 15);
  assert.deepEqual(plain(snapshot.SNAPSHOT_MODES), ['playing', 'training', 'paused']);

  const valid = {
    version: 1,
    mode: 'playing',
    matchType: 'rush',
    selectedStage: 'battlefield',
    players: [
      { fighterKey: 'runeweaver', x: 0, y: 0, vx: 0, vy: 0, controlType: 'human' },
      { fighterKey: 'bassforger', x: 1, y: 0, vx: 0, vy: 0, controlType: 'cpu' },
    ],
  };
  assert.equal(snapshot.isValidActiveMatchSnapshot(valid, {
    version: 1,
    snapshotModes: snapshot.SNAPSHOT_MODES,
    matchTypes: ['stock', 'time', 'training', 'rush'],
    stageKeys: ['battlefield'],
    isValidPlayer: (player) => ['runeweaver', 'bassforger'].includes(player.fighterKey) && Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.vx) && Number.isFinite(player.vy),
  }), true);
  assert.equal(snapshot.isValidActiveMatchSnapshot({ ...valid, selectedStage: 'bad' }, {
    version: 1,
    snapshotModes: snapshot.SNAPSHOT_MODES,
    matchTypes: ['stock', 'time', 'training', 'rush'],
    stageKeys: ['battlefield'],
  }), false);
});
