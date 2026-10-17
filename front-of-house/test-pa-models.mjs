// PA visual adapter: bounds, component identity, invalid input and unchanged game state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Group } from './vendor/three/three.module.min.js';
import { createLotModels } from './lot-models.mjs';
import { addPaRig } from './pa-models.mjs';
import { createGame, settlementFor } from './engine.mjs';
test('PA representations stay inside their existing footprint and preserve game data', () => {
  const models = createLotModels(), state = createGame(3), before = JSON.stringify(state), receipt = settlementFor(state);
  for (const type of ['pa-s', 'pa-m']) {
    const object = { type, x: 0, y: 0, rot: 0 }, original = JSON.stringify(object);
    const model = models.create(object), bounds = new Box3().setFromObject(model), ids = [];
    model.traverse(node => { if (node.isMesh) ids.push(node.userData.componentId); });
    assert.ok(bounds.max.x - bounds.min.x <= 1 && bounds.max.z - bounds.min.z <= 1);
    assert.ok(bounds.min.y >= -0.001 && bounds.max.y > .9);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes('left.zlx.cabinet') && ids.includes('right.sub1.ekx.cabinet'));
    assert.equal(JSON.stringify(object), original);
  }
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(settlementFor(state), receipt);
  assert.throws(() => addPaRig(new Group(), () => {}, 'unknown', 2), /Unsupported/);
  assert.throws(() => addPaRig(new Group(), () => {}, 'pa-s', 0), /Invalid/);
  models.dispose();
});
