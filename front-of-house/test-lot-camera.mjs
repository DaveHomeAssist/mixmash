// Camera contract tests use the real Three.js projection matrices without a GPU.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLotCamera } from './lot-camera.mjs';
import { createLotModels } from './lot-models.mjs';
import { createLotPresentation } from './lot-presentation.mjs';
import { VENUES } from './data.mjs';
import { footprint } from './engine.mjs';
import { Vector3, Box3, Matrix4 } from './vendor/three/three.module.min.js';

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
  models.dispose(); models.dispose(); assert.deepEqual(models.counts(), { geometries: 0, materials: 0, textures: 0 });
});

test('authored reference makes guest, deck, counter and restroom dimensions consistent', () => {
  const models = createLotModels();
  const guest = new Box3().setFromObject(models.guest());
  assert.ok(Math.abs((guest.max.y - guest.min.y) * 2 - 1.8) < 0.005);
  const restroom = new Box3().setFromObject(models.create({ type: 'restroom', x: 0, y: 0, rot: 0 }));
  assert.ok(Math.abs(restroom.max.y * 2 - 2.3) < 0.005);
  for (const [type, child] of [['stage', 0], ['bar', 1]]) {
    const group = models.create({ type, x: 0, y: 0, rot: 0 });
    const top = new Box3().setFromObject(group.children[child]).max.y;
    assert.ok(Math.abs(top * 2 - 1.1) < 0.005, `${type} reference top`);
  }
  models.dispose();
});

test('FOH and Stage use explicit authored eyes following each stage facing, then leave for bounded orbit', () => {
  const c = createLotCamera(); c.resize({ x: 0, y: 0, w: 1440, h: 900 });
  for (let rot = 0; rot < 4; rot++) {
    c.setStage({ type: 'stage', x: 9, y: 2, rot }); c.preset('foh');
    const eye = c.info().authoredEye;
    assert.equal(eye.position[1], 0.83);
    const forward = [[0, 1], [-1, 0], [0, -1], [1, 0]][rot];
    assert.ok((eye.position[0] - eye.target[0]) * forward[0] + (eye.position[2] - eye.target[2]) * forward[1] > 0);
    c.preset('stage'); assert.ok(Math.abs(c.info().authoredEye.position[1] - 1.38) < 1e-8);
    c.setCamera({ yaw: 37, pitch: 1 }); assert.equal(c.info().authoredEye, null); assert.equal(c.info().pitch, 15);
  }
});

test('Club camera fits its actual volume and rejects ground outside the smaller room', () => {
  const c = createLotCamera({ width: 20, depth: 14 });
  for (const [w, h] of [[1440, 900], [375, 812], [2560, 720]]) {
    c.resize({ x: 0, y: 0, w, h }, { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.45 });
    for (const yaw of [37, 135]) {
      c.setCamera({ yaw, pitch: 48, zoom: 1, x: 10, y: 7 });
      for (const x of [0, 20]) for (const y of [0, 14]) for (const z of [0, 3.5]) assert.equal(c.project(x, y, z).clear, true);
      for (const [x, y] of [[0.5, 0.5], [19.5, 13.5], [6.5, 5.5]]) {
        const p = c.project(x, y); assert.deepEqual(c.tileAt(p.x, p.y), { x: Math.floor(x), y: Math.floor(y) });
      }
      const outside = c.project(20.5, 7); assert.equal(c.tileAt(outside.x, outside.y), null);
    }
  }
});

test('Club fixed scenery exactly represents existing pillars and house PA without changing venue metadata', () => {
  const m = createLotModels(), before = structuredClone(VENUES.club), room = m.room(VENUES.club);
  assert.equal(new Set(room.children.map(x => x.name)).size, room.children.length);
  assert.equal(room.children.filter(x => /^club-pillar-\d/.test(x.name)).length, 4);
  for (const [x, y] of VENUES.club.pillars) {
    const b = new Box3().setFromObject(room.getObjectByName(`club-pillar-${x}-${y}`));
    assert.deepEqual(b.min.toArray(), [x, 0, y]); assert.deepEqual(b.max.toArray(), [x + 1, 3, y + 1]);
  }
  assert.equal(room.children.filter(x => /^club-house-pa-(left|right)-\d$/.test(x.name)).length, 8);
  assert.ok(room.children.every(x => x.userData.permanent)); assert.deepEqual(VENUES.club, before);
  assert.equal(m.room(VENUES.lot).children.length, 0); m.dispose();
});

test('Club representative guests stay inside the room and outside props and pillar cells', () => {
  const m = createLotModels(), v = VENUES.club, p = createLotPresentation(m, { width: v.grid.w, depth: v.grid.h, pillars: v.pillars, indoor: true });
  p.update({ crowd: 360, t: 0 }, v.starter, [], false);
  const batch = p.group.children.find(x => x.isInstancedMesh), matrix = new Matrix4();
  assert.equal(p.info().fencePanels, 0); assert.equal(batch.count, 180);
  const occupied = new Set([...v.pillars, ...v.starter.flatMap(footprint)].map(([x, y]) => `${x},${y}`));
  for (let i = 0; i < batch.count; i++) {
    batch.getMatrixAt(i, matrix); const x = matrix.elements[12], y = matrix.elements[14];
    assert.ok(x >= 0 && x < 20 && y >= 0 && y < 14); assert.equal(occupied.has(`${Math.floor(x)},${Math.floor(y)}`), false);
  }
  p.dispose(); m.dispose();
});

test('Loam Shell fits its real room at arbitrary yaw across desktop, phone and ultrawide', () => {
  const { w, h } = VENUES.amphitheater.grid, camera = createLotCamera({ width: w, depth: h });
  for (const [width, height] of [[1440, 900], [375, 812], [2560, 720]]) {
    camera.resize({ x: 0, y: 0, w: width, h: height }, { x: width * 0.1, y: height * 0.1, w: width * 0.8, h: height * 0.5 });
    for (const yaw of [37, 135]) {
      camera.setCamera({ yaw, pitch: 48, zoom: 1, x: w / 2, y: h / 2 });
      for (const x of [0, w]) for (const y of [0, h]) for (const z of [0, 3.5]) assert.equal(camera.project(x, y, z).clear, true);
      const p = camera.project(w - 0.5, h - 0.5); assert.deepEqual(camera.tileAt(p.x, p.y), { x: w - 1, y: h - 1 });
    }
  }
});

test('Loam Shell keeps illustrative seating guides pick-through and its shell outside build tiles', () => {
  const models = createLotModels(), room = models.room(VENUES.amphitheater), names = room.children.map(m => m.name);
  assert.equal(new Set(names).size, names.length);
  const guides = room.children.filter(m => m.userData.pickThrough);
  assert.equal(guides.length, 12);
  for (const guide of guides) {
    assert.equal(guide.castShadow, false);
    const b = new Box3().setFromObject(guide);
    assert.ok(b.min.x >= 0 && b.max.x <= 28 && b.min.z > 3 && b.max.z < 18 && b.max.y < 0.01);
  }
  for (const panel of room.children.filter(m => /^shell-(panel|west|east)/.test(m.name))) {
    const b = new Box3().setFromObject(panel); assert.ok(b.max.z < 0); assert.ok(b.max.y <= 3.5);
  }
  assert.equal(room.children.filter(m => /^amphitheater-house-pa-(left|right)-/.test(m.name)).length, 8);
  models.dispose(); assert.deepEqual(models.counts(), { geometries: 0, materials: 0, textures: 0 });
});
