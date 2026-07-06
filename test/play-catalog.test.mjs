import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

async function loadCatalog() {
  const sandbox = { globalThis: null };
  sandbox.globalThis = sandbox;
  for (const file of ['../play/stage-data.js', '../play/fighter-data.js']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    vm.runInNewContext(source, sandbox, { filename: file });
  }
  return {
    stages: sandbox.MixmashStageData,
    fighters: sandbox.MixmashFighterData,
  };
}

test('stage catalog exports the full current arena list', async () => {
  const { stages } = await loadCatalog();
  assert.equal(Object.keys(stages).length, 11);
  assert.ok(stages.runeFoundry);
  assert.ok(stages.crystalCanopy);
  assert.equal(stages.runeFoundry.platforms.some((platform) => platform.moving), true);
  assert.equal(stages.crystalCanopy.platforms.some((platform) => platform.moving), true);
});

test('fighter catalog exports the full current roster', async () => {
  const { fighters } = await loadCatalog();
  assert.equal(Object.keys(fighters).length, 14);
  assert.ok(fighters.runeweaver);
  assert.ok(fighters.bassforger);
  assert.equal(fighters.runeweaver.maxJumps, 3);
  assert.equal(fighters.bassforger.armor, true);
});
