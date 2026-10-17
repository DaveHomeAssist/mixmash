// Lighting visual adapter: bounds, component identity, invalid input and unchanged game state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Group, Raycaster, Vector3 } from './vendor/three/three.module.min.js';
import { createLotModels } from './lot-models.mjs';
import { addLightingRig } from './lighting-models.mjs';
import { createGame, settlementFor } from './engine.mjs';
test('Lighting representations stay inside their existing footprint and preserve game data', () => {
  const models = createLotModels(), state = createGame(3), before = JSON.stringify(state), receipt = settlementFor(state);
  for (const type of ['lights']) {
    const object = { type, x: 0, y: 0, rot: 0 }, original = JSON.stringify(object);
    const model = models.create(object), bounds = new Box3().setFromObject(model), ids = [];
    model.traverse(node => { if (node.isMesh) ids.push(node.userData.componentId); });
    assert.ok(bounds.max.x - bounds.min.x <= 1 && bounds.max.z - bounds.min.z <= 1);
    assert.ok(bounds.min.y >= -0.001 && bounds.max.y > 2.7 && bounds.max.y < 2.9);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes('left.body') && ids.includes('centre.dome'));
    model.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(.5, 4, .5), new Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(model, true).length > 0, 'tower remains selectable from above');
    assert.equal(JSON.stringify(object), original);
  }
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(settlementFor(state), receipt);
  assert.throws(() => addLightingRig(new Group(), () => {}, 0), /Invalid/);
  models.dispose();
});
