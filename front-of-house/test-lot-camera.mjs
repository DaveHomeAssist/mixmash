// Camera contract tests use the real Three.js projection matrices without a GPU.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLotCamera } from './lot-camera.mjs';
import { createLotModels } from './lot-models.mjs';
import { footprint } from './engine.mjs';
import { Vector3, Box3 } from './vendor/three/three.module.min.js';

test('ground picking inverts CSS projection at arbitrary yaw, pitch, zoom and canvas offset', () => {
  const c = createLotCamera();
  c.resize({ x: 73, y: 91, w: 1440, h: 900 }, { x: 180, y: 70, w: 900, h: 590 });
  for (const yaw of [37, 135]) for (const pitch of [15, 85]) for (const zoom of [1, 1.5, 2, 3]) {
    c.setCamera({ yaw, pitch, zoom });
    for (const [x, y] of [[0.5, 0.5], [23.5, 15.5], [12.5, 8.5], [9.5, 3.5]]) {
      const p = c.project(x, y); assert.deepEqual(c.tileAt(p.x, p.y), { x: Math.floor(x), y: Math.floor(y) });
    }
    const p = c.project(-0.5, 8); assert.equal(c.tileAt(p.x, p.y), null);
  }
});

test('Fit respects actual HUD safe area at desktop, phone and ultrawide dimensions', () => {
  const c = createLotCamera();
  for (const [w, h] of [[1440, 900], [375, 812], [2560, 720]]) {
    c.resize({ x: 0, y: 0, w, h }, { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.45 });
    for (const yaw of [37, 135]) {
      c.setCamera({ yaw, pitch: 48, zoom: 1, x: 12, y: 8 });
      for (const x of [0, 24]) for (const y of [0, 16]) for (const z of [0, 3.5]) assert.equal(c.project(x, y, z).clear, true);
    }
  }
});

test('camera clamps bad values, Plan is stable, and zoom preserves its ground anchor', () => {
  const c = createLotCamera(); c.resize({ x: 20, y: 40, w: 1000, h: 700 });
  c.setCamera({ yaw: -683, pitch: 190, zoom: 30, x: -200, y: 99 });
  assert.deepEqual([c.info().yaw, c.info().pitch, c.info().zoom, c.info().x, c.info().y], [37, 85, 3, 0, 16]);
  c.setCamera({ yaw: NaN, pitch: Infinity }); assert.equal(c.info().yaw, 37); assert.equal(c.info().pitch, 85);
  assert.equal(c.preset('unknown'), false);
  c.preset('plan'); assert.equal(c.info().pitch, 90);
  const p = c.project(9.5, 5.5); assert.deepEqual(c.tileAt(p.x, p.y), { x: 9, y: 5 });
  c.setCamera({ yaw: 135 }); assert.equal(c.info().pitch, 85);
  c.preset('wide');
  const before = c.groundAt(510, 365); c.zoomTo(2, 490, 325); const after = c.groundAt(510, 365);
  assert.ok(Math.abs(before.x - after.x) < 1e-7 && Math.abs(before.y - after.y) < 1e-7);
  c.resize({ w: 0, h: 0 }); assert.ok(Number.isFinite(c.info().distance));
});

test('sample orientation and occupied bounds agree with engine footprints in all rotations', () => {
  const models = createLotModels();
  for (const type of ['stage', 'pa-m', 'bar', 'restroom', 'gate']) for (let rot = 0; rot < 4; rot++) {
    const object = { type, x: 4, y: 5, rot };
    const original = structuredClone(object), mesh = models.create(object); mesh.updateMatrixWorld(true);
    const box = new Box3().setFromObject(mesh), cells = footprint(object);
    assert.ok(box.min.x >= Math.min(...cells.map(c => c[0])) - 0.001);
    assert.ok(box.max.x <= Math.max(...cells.map(c => c[0])) + 1.001);
    assert.ok(box.min.z >= Math.min(...cells.map(c => c[1])) - 0.001);
    assert.ok(box.max.z <= Math.max(...cells.map(c => c[1])) + 1.001);
    if (type === 'stage') {
      const forward = new Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
      const expected = [[0, 1], [-1, 0], [0, -1], [1, 0]][rot];
      assert.ok(Math.abs(forward.x - expected[0]) < 1e-7 && Math.abs(forward.z - expected[1]) < 1e-7);
    }
    assert.deepEqual(object, original);
  }
  models.dispose(); models.dispose(); assert.deepEqual(models.counts(), { geometries: 0, materials: 0 });
});
