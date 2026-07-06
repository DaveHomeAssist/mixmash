import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

async function loadCore() {
  const source = await readFile(new URL('../play/core.js', import.meta.url), 'utf8');
  const sandbox = { Math, Number, String, RegExp, Object, Array, globalThis: null };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'play/core.js' });
  return sandbox.MixmashCore;
}

test('platform rush seeds preserve defaults and namespace explicit challenge seeds', async () => {
  const core = await loadCore();
  assert.equal(core.getPlatformRushSeed('battlefield'), core.hashStringSeed('platform-rush:battlefield'));
  assert.notEqual(core.getPlatformRushSeed('battlefield', 'daily_test'), core.getPlatformRushSeed('battlefield'));
  assert.equal(core.getPlatformRushSeed('', null), core.hashStringSeed('platform-rush:battlefield'));
});

test('share validators clamp invalid URL values', async () => {
  const core = await loadCore();
  assert.equal(core.sanitizeShareSeed('daily_20260706'), 'daily_20260706');
  assert.equal(core.sanitizeShareSeed('bad seed'), null);
  assert.equal(core.sanitizeShareSeed('../bad'), null);
  assert.equal(core.parseShareBoolean('1', false), true);
  assert.equal(core.parseShareBoolean('false', true), false);
  assert.equal(core.parseShareBoolean('maybe', true), true);
  assert.equal(core.sanitizeCpuLevel(1), 1);
  assert.equal(core.sanitizeCpuLevel(5), 5);
  assert.equal(core.sanitizeCpuLevel(99), 3);
});

test('active match snapshot validation is data driven', async () => {
  const core = await loadCore();
  const context = {
    version: 1,
    snapshotModes: ['playing', 'training', 'paused'],
    matchTypes: ['stock', 'time', 'training', 'rush'],
    stageKeys: ['battlefield', 'runeFoundry'],
  };
  const valid = {
    version: 1,
    mode: 'playing',
    matchType: 'stock',
    selectedStage: 'runeFoundry',
    players: [
      { fighterKey: 'runeweaver', x: 0, y: 0, vx: 0, vy: 0, controlType: 'human' },
      { fighterKey: 'bassforger', x: 1, y: 0, vx: 0, vy: 0, controlType: 'cpu' },
    ],
    damageNumbers: [],
  };
  assert.equal(core.isValidActiveMatchSnapshot(valid, context), true);
  assert.equal(core.isValidActiveMatchSnapshot({ ...valid, selectedStage: 'missing' }, context), false);
  assert.equal(core.isValidActiveMatchSnapshot({ ...valid, players: valid.players.slice(0, 1) }, context), false);
  assert.equal(core.isValidActiveMatchSnapshot({ ...valid, damageNumbers: 'bad' }, context), false);
});
