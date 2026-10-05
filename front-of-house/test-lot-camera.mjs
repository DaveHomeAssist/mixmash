// Camera contract tests use the real Three.js projection matrices without a GPU.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLotCamera } from './lot-camera.mjs';
import { createLotModels, FESTIVAL_SCENE } from './lot-models.mjs';
import { createLotPresentation, stageRepresentatives } from './lot-presentation.mjs';
import { VENUES, ROOM_PROFILES } from './data.mjs';
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
  for (const type of ['stage', 'pa-m', 'bar', 'restroom', 'gate', 'delay', 'vip-deck', 'bus-compound']) for (let rot = 0; rot < 4; rot++) {
    const object = { type, x: 4, y: 5, rot };
    const original = structuredClone(object), mesh = models.create(object); mesh.updateMatrixWorld(true);
    const box = new Box3().setFromObject(mesh), cells = footprint(object);
    assert.ok(box.min.x >= Math.min(...cells.map(c => c[0])) - 0.001);
    assert.ok(box.max.x <= Math.max(...cells.map(c => c[0])) + 1.001);
    assert.ok(box.min.z >= Math.min(...cells.map(c => c[1])) - 0.001);
    assert.ok(box.max.z <= Math.max(...cells.map(c => c[1])) + 1.001);
    if (type === 'delay') assert.ok(Math.abs(box.max.y - ROOM_PROFILES.festival.obstacleHeights.delay) < 0.001, 'visible tower agrees with its logical sightline height');
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


test('Festival presentation fits both areas without changing its authored main grid', () => {
  const camera = createLotCamera({ width: FESTIVAL_SCENE.width, depth: FESTIVAL_SCENE.depth });
  for (const [w, h] of [[1440, 900], [375, 812], [2560, 720]]) {
    camera.resize({ x: 0, y: 0, w, h }, { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.5 });
    for (const yaw of [37, 135]) {
      camera.setCamera({ yaw, pitch: 48, zoom: 1, x: 26, y: 12 });
      for (const x of [0, 52]) for (const y of [0, 24]) for (const z of [0, 3.5]) assert.equal(camera.project(x, y, z).clear, true);
    }
  }
  assert.deepEqual(VENUES.festival.grid, { w: 40, h: 24 });
  const models = createLotModels(), room = models.room(VENUES.festival);
  const deck = new Box3().setFromObject(room.children.find(m => m.name === 'festival-side-deck'));
  assert.equal(deck.min.x, FESTIVAL_SCENE.stage.x); assert.equal(deck.max.x, FESTIVAL_SCENE.stage.x + FESTIVAL_SCENE.stage.w);
  assert.ok(deck.min.x >= VENUES.festival.grid.w && deck.max.x <= FESTIVAL_SCENE.width);
  models.dispose(); assert.deepEqual(models.counts(), { geometries: 0, materials: 0, textures: 0 });
});

test('Festival decorative allocation conserves displayed attendance and the global model limit', () => {
  for (const [main, second] of [[5500, 500], [0, 500], [1, 1], [1, 500], [500, 1], [0, 0]]) {
    for (const fraction of [0, 0.1, 0.5, 1]) {
      const crowd = Math.round((main + second) * fraction), input = { main, second }, r = stageRepresentatives(crowd, input);
      assert.deepEqual(input, { main, second }); assert.equal(r.known, true);
      assert.equal(r.displayed.main + r.displayed.second, crowd);
      assert.equal(r.representatives.main + r.representatives.second, Math.min(180, crowd));
      assert.ok(r.representatives.main <= r.displayed.main && r.representatives.second <= r.displayed.second);
    }
  }
  for (const invalid of [null, {}, { main: -1, second: 2 }, { main: 2.5, second: 2 }]) {
    const r = stageRepresentatives(900, invalid); assert.equal(r.known, false); assert.equal(r.second, null);
    assert.deepEqual(r.displayed, { main: 900, second: 0 }); assert.deepEqual(r.representatives, { main: 180, second: 0 });
  }
  const models = createLotModels(), main = createLotPresentation(models, { width: 40, depth: 24 }), side = createLotPresentation(models, { width: 12, depth: 16, indoor: true });
  const split = stageRepresentatives(6000, { main: 5500, second: 500 });
  main.update({ crowd: split.displayed.main }, [], [], false, split.representatives.main);
  side.update({ crowd: split.displayed.second }, [{ type: 'stage', x: 3, y: 1, rot: 0 }], [], false, split.representatives.second);
  assert.equal(main.info().representativeGuests + side.info().representativeGuests, 180);
  main.dispose(); side.dispose(); models.dispose();
});

test('overview rotation round trips and fits every site edge', async () => {
  const { overviewTransform, clipGround } = await import('./site-map-geometry.mjs');
  for (const rotation of [0, 37, 45, 90, 135, 270, 359]) {
    const map = overviewTransform(52, 24, rotation);
    for (const [x, y] of [[0, 0], [52, 24], [0, 24], [52, 0], [46, 10], [20, 12]]) {
      const q = map.project(x, y), p = map.inverse(q.x, q.y);
      assert.ok(q.x >= 5.99 && q.x <= 174.01 && q.y >= 5.99 && q.y <= 104.01);
      assert.ok(Math.abs(p.x - x) < 1e-10 && Math.abs(p.y - y) < 1e-10);
    }
  }
  const polygon = clipGround(10, 10, [p => p.x - 2, p => 5 - p.x, p => p.y - 3, p => 5 - p.y]);
  assert.equal(polygon.length, 4); assert.deepEqual(new Set(polygon.map(p => `${p.x},${p.y}`)), new Set(['2,3', '5,3', '5,5', '2,5']));
  assert.deepEqual(clipGround(10, 10, [p => p.x - 11]), []);
});

test('perspective overview clips the actual safe ground at low pitch and preserves camera pose while panning', () => {
  const camera = createLotCamera({ width: 52, depth: 24 });
  camera.resize({ x: 7, y: 11, w: 1440, h: 900 }, { x: 50, y: 90, w: 1050, h: 690 });
  const check = () => {
    const n = camera.navigation(); assert.ok(n.footprint.length >= 3);
    for (const p of n.footprint) {
      assert.ok(p.x >= -1e-7 && p.y >= -1e-7 && p.x <= 52 + 1e-7 && p.y <= 24 + 1e-7);
      const q = camera.project(p.x, p.y); assert.ok(q.x >= 57 - 1e-5 && q.x <= 1107 + 1e-5 && q.y >= 101 - 1e-5 && q.y <= 791 + 1e-5, JSON.stringify({ p, q, c: camera.info() }));
    }
  };
  for (const yaw of [0, 37, 135, 359]) for (const pitch of [15, 48, 85]) for (const zoom of [1, 1.5, 2, 3]) { camera.setCamera({ yaw, pitch, zoom, x: 26, y: 12 }); check(); }
  for (const preset of ['plan', 'foh', 'stage']) {
    camera.preset(preset); camera.zoomTo(2); const before = camera.info(); camera.panTo(29, 13); const after = camera.info();
    for (const key of ['zoom', 'yaw', 'pitch', 'preset']) assert.equal(after[key], before[key]); check();
  }
});


test('reused camera fit stays equal to a fresh fit after lens, view and safe-area changes', () => {
  for (const [width, depth] of [[24, 16], [22, 14], [28, 18], [52, 24]]) {
    const used = createLotCamera({ width, depth });
    for (const yaw of [37, 135]) for (const pitch of [15, 48, 85]) for (const zoom of [1, 2, 3]) {
      const bounds = { x: 7, y: 11, w: yaw === 37 ? 1440 : 375, h: 812 };
      const safe = { x: 30, y: pitch, w: bounds.w - 80, h: 520 - pitch };
      const target = { yaw, pitch, zoom, x: width * 0.6, y: depth * 0.4 };
      const fresh = createLotCamera({ width, depth });
      for (const c of [used, fresh]) {
        Object.assign(c.camera, { fov: zoom === 2 ? 50 : 42, filmOffset: zoom === 3 ? 2 : 0, near: 0.05, far: 900 });
        c.resize(bounds, safe); c.setCamera(target);
      }
      for (const c of [used, fresh]) { c.panBy(5, -7); c.panTo(width * 0.7, depth * 0.3); c.zoomTo(1.5, bounds.w * 0.6, 330); }
      assert.deepEqual(used.info(), fresh.info());
      assert.deepEqual(used.camera.matrixWorld.elements, fresh.camera.matrixWorld.elements);
      assert.deepEqual(used.camera.projectionMatrix.elements, fresh.camera.projectionMatrix.elements);
      assert.deepEqual(used.navigation(), fresh.navigation());
      const pt = used.project(width * 0.7, depth * 0.3);
      assert.deepEqual(used.groundAt(pt.x, pt.y), fresh.groundAt(pt.x, pt.y));
    }
    for (const preset of ['plan', 'foh', 'stage', 'wide']) {
      used.preset(preset); const before = used.info(); used.panTo(width / 2, depth / 2);
      assert.deepEqual(used.info(), before);
    }
  }
});

test('representative gait keeps bodies grounded, waiting feet planted and reduced motion static', () => {
  const models = createLotModels(), presentation = createLotPresentation(models), template = models.guest();
  const source = { crowd: 2, t: 0.2, serviceCrowd: { actors: [
    { x: 5.5, y: 5.5, heading: 0, moving: true, zone: 'floor' },
    { x: 8.5, y: 5.5, heading: 0, moving: false, zone: 'bar' },
  ], totals: { floor: 1, bar: 1 } } };
  template.updateMatrixWorld(true);
  const original = JSON.stringify(source), batches = presentation.group.children.filter(x => x.isInstancedMesh);
  const capture = (t, motion) => {
    presentation.update({ ...source, t }, [], [], motion);
    return batches.map(b => Array.from({ length: b.count }, (_, i) => { const m = new Matrix4(); b.getMatrixAt(i, m); return m; }));
  };
  const a = capture(0.2, true), b = capture(0.6, true);
  assert.equal(batches.length, template.children.length, 'no additional mesh batches');
  assert.equal(presentation.info().representativeGuests, 2);
  const limbs = template.children.map((part, i) => ({ part, i })).filter(x => x.part.userData.guestLimb);
  for (const { part, i } of limbs) {
    const relative = frame => frame[0][0].clone().multiply(template.children[0].matrix.clone().invert()).invert().multiply(frame[i][0]);
    assert.notDeepEqual(relative(a).elements, relative(b).elements, 'limbs articulate relative to the torso');
    for (const frame of [a, b]) {
      const joint = new Vector3(...part.userData.guestLimb.pivot);
      const posedJoint = joint.clone().applyMatrix4(part.matrix.clone().invert()).applyMatrix4(relative(frame));
      assert.ok(posedJoint.distanceTo(joint) < 0.000001, 'hip and shoulder attachments remain fixed');
    }
    for (const frame of [a, b]) {
      const bounds = new Box3().setFromBufferAttribute(part.geometry.attributes.position).applyMatrix4(frame[i][0]);
      assert.ok(bounds.min.y > -0.005, 'walking feet stay on or above the ground');
      assert.ok(bounds.min.x > 5.2 && bounds.max.x < 5.8 && bounds.min.z > 5.2 && bounds.max.z < 5.8, 'pose remains in representative space');
    }
    if (part.userData.guestLimb.joint === 'hip') {
      const ac = new Vector3().setFromMatrixPosition(a[i][1]), bc = new Vector3().setFromMatrixPosition(b[i][1]);
      assert.ok(ac.distanceTo(bc) < 0.01, 'queue legs remain planted despite idle sway');
    }
  }
  const still = capture(3, false), later = capture(90, false);
  assert.deepEqual(still.map(row => row.map(m => m.elements)), later.map(row => row.map(m => m.elements)));
  assert.equal(JSON.stringify(source), original, 'presentation never edits actor positions or counts');
  presentation.dispose(); models.dispose();
});


test('guest surfaces retain bounded instancing, readable forward face and owned mipmapped textures', () => {
  const a = createLotModels(), b = createLotModels(), guest = a.guest(), again = b.guest();
  assert.equal(guest.children.length, 16, 'surface detail does not add crowd batches');
  const head = guest.children[2], face = head.material.map;
  assert.equal(face.name, 'authored-face');
  const pixel = (u, v) => face.image.data[(Math.round(v * 127) * 256 + Math.round(u * 255)) * 4];
  assert.ok(pixel(0.198, 0.56) < 100, 'first eye faces +Z');
  assert.ok(pixel(0.302, 0.56) < 100, 'second eye faces +Z');
  assert.equal(pixel(0.75, 0.56), 255, 'no face on back of head');
  assert.deepEqual(face.image.data, again.children[2].material.map.image.data, 'source-authored map is deterministic');
  assert.equal(head.geometry.attributes.position.count, 425, 'bounded shared face geometry');
  for (const part of guest.children) {
    for (const value of part.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
    if (part.material.map) assert.equal(part.material.map.generateMipmaps, true);
  }
  assert.equal(a.counts().textures, 4, 'texture allocation is constant across crowd sizes');
  const roughMetal = a.material(0xb0b8bd, 0.7).roughness;
  assert.ok(roughMetal < guest.children[0].material.roughness, 'metal and cloth have distinct surface response');
  const textures = new Set(guest.children.map(p => p.material.map).filter(Boolean));
  let disposals = 0; for (const texture of textures) texture.addEventListener('dispose', () => disposals++);
  a.dispose(); a.dispose(); assert.equal(disposals, textures.size, 'each shared texture disposed exactly once');
  assert.deepEqual(a.counts(), { geometries: 0, materials: 0, textures: 0 }); b.dispose();
});

test('clothed anatomy stays connected, shared and inside the guest geometry budget', () => {
  const models = createLotModels(), guest = models.guest(), copy = models.guest();
  guest.updateMatrixWorld(true);
  assert.equal(guest.children.length, 16);
  let vertices = 0;
  for (const [i, part] of guest.children.entries()) {
    assert.equal(part.geometry, copy.children[i].geometry, 'crowd figures share geometry');
    const { position, normal } = part.geometry.attributes;
    vertices += position.count;
    for (const index of part.geometry.index.array) assert.ok(index < position.count);
    // Sphere seam/pole duplicates can be unreferenced; only drawn vertices need normals.
    for (const j of new Set(part.geometry.index.array)) {
      const length = Math.hypot(normal.getX(j), normal.getY(j), normal.getZ(j));
      assert.ok(Number.isFinite(length) && Math.abs(length - 1) < 0.001, 'valid surface normals');
    }
  }
  assert.ok(vertices < 2500, 'contour rings keep per-figure geometry below the rejected dense candidate');
  const torso = guest.children[0].geometry.attributes.position;
  for (const y of [-0.5, -0.25, 0.15, 0.32, 0.42, 0.5]) {
    assert.ok(Array.from({ length: torso.count }, (_, i) => torso.getY(i)).some(v => Math.abs(v - y) < 0.00001), 'authored shoulder and collar contours retained');
  }
  const bounds = i => new Box3().setFromObject(guest.children[i]);
  assert.ok(bounds(0).intersectsBox(bounds(1)), 'neck enters the shirt collar');
  for (const [sleeve, arm, hand] of [[10, 11, 12], [13, 14, 15]]) {
    assert.ok(bounds(0).intersectsBox(bounds(sleeve)), 'sleeve joins shoulder');
    assert.ok(bounds(sleeve).intersectsBox(bounds(arm)), 'forearm enters sleeve');
    assert.ok(bounds(arm).intersectsBox(bounds(hand)), 'wrist meets hand');
  }
  const body = new Box3().setFromObject(guest);
  assert.ok(body.min.y >= -0.001 && Math.abs(body.max.y - 0.9) < 0.005);
  assert.ok(body.min.x > -0.2 && body.max.x < 0.2, 'existing representative width');
  const owned = new Set(guest.children.map(part => part.geometry));
  let disposed = 0;
  for (const geometry of owned) geometry.addEventListener('dispose', () => disposed++);
  models.dispose(); models.dispose();
  assert.equal(disposed, owned.size, 'new shared profiles disposed exactly once');
});
