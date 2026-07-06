import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createState, sanitizeState } from './engine.mjs';

test('gather command mutates only canonical server state', () => {
  const before = createState(1_700_000_000_000);
  const { state } = applyCommand(before, { id: 'cmd-1', type: 'gather', nodeId: 'iron-north' }, 1_700_000_005_000);
  assert.equal(state.inventory.iron_ore, 1);
  assert.equal(state.skills.mining.xp, 18);
  assert.equal(state.seq, 1);
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
  assert.equal(clean.inventory.iron_ore, 999);
  assert.equal(clean.built.habitat, true);
});
