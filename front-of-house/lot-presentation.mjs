// Cosmetic Lot presentation. Counts/incidents come from the engine snapshot; no simulated transactions.
import * as T from './vendor/three/three.module.min.js';
import { OBJECT_TYPES } from './data.mjs';

const MAX_GUESTS = 180;
const PALETTES = {
  skin: [0xb98c71, 0x704b3b, 0xe0b99c, 0x98664d], clothing: [0x627e8b, 0x80545b, 0x8a8862, 0x384c68, 0xa8b6ba],
  trousers: [0x303c48, 0x4b4945], shoes: [0x252827], hair: [0x28221d, 0x6e5742, 0xa3937d, 0x302e2c],
};
export function createLotPresentation(models) {
  const group = new T.Group(), ownedGeometry = new Set(), ownedMaterial = new Set();
  const gridPoints = [];
  for (let x = 0; x <= 24; x++) gridPoints.push(x, 0.003, 0, x, 0.003, 16);
  for (let y = 0; y <= 16; y++) gridPoints.push(0, 0.003, y, 24, 0.003, y);
  function lines(points, color, opacity = 1) {
    const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(points, 3));
    const material = new T.LineBasicMaterial({ color, opacity, transparent: opacity < 1, depthWrite: opacity === 1 });
    ownedGeometry.add(geometry); ownedMaterial.add(material);
    const line = new T.LineSegments(geometry, material); group.add(line); return line;
  }
  const grid = lines(gridPoints, 0xb6bec0, 0.15), fence = lines([], 0x778185, 0.5);
  const markerGeometry = new T.BoxGeometry(1, 1, 1), markerMaterial = new T.MeshBasicMaterial({ color: 0xff725e });
  ownedGeometry.add(markerGeometry); ownedMaterial.add(markerMaterial);
  const marker = new T.Group();
  for (const [scale, y] of [[[0.07, 0.32, 0.07], 0.27], [[0.075, 0.07, 0.075], 0.035]]) {
    const mesh = new T.Mesh(markerGeometry, markerMaterial); mesh.scale.set(...scale); mesh.position.y = y; marker.add(mesh);
  }
  group.add(marker); marker.visible = false;
  const rain = lines(new Float32Array(240 * 6), 0xb9d0df, 0.42); rain.visible = false;
  const template = models.guest(); template.updateMatrixWorld(true);
  const batches = template.children.map(part => {
    const material = part.material.clone(); material.color.set(0xffffff); ownedMaterial.add(material);
    const mesh = new T.InstancedMesh(part.geometry, material, MAX_GUESTS);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.count = 0; mesh.visible = false; group.add(mesh);
    return { mesh, local: part.matrix.clone(), surface: part.name };
  });
  const transform = new T.Object3D(), matrix = new T.Matrix4(), color = new T.Color();
  let layoutKey = '', actorKey = '', positions = [], crowdCount = 0, fencePanels = 0, gateOpenings = 0, incident = null, offsets = [], lastTime = null, disposed = false;
  function rebuildFence(objects) {
    const hasFence = objects.some(o => o.type === 'fence');
    const points = []; fencePanels = 0; gateOpenings = 0;
    const edge = (x, y, dx, dy) => {
      const opening = objects.some(o => ['gate', 'exit'].includes(o.type) && o.x === Math.min(23, Math.floor(x)) && o.y === Math.min(15, Math.floor(y)));
      if (opening) { gateOpenings++; return; }
      fencePanels++;
      const segment = (a, b) => points.push(...a, ...b);
      const at = (u, h) => [x + dx * u, h, y + dy * u];
      segment(at(0, 0), at(0, 1.05)); segment(at(0, 1), at(1, 1)); segment(at(0, 0.1), at(1, 0.1));
      for (let i = 0; i < 10; i++) for (let j = 1; j < 10; j++) {
        const u = i / 10, h = j / 10; segment(at(u, h), at(u + 0.1, h + 0.1)); segment(at(u + 0.1, h), at(u, h + 0.1));
      }
    };
    if (hasFence) {
      for (let x = 0; x < 24; x++) { edge(x, 0, 1, 0); edge(x, 16, 1, 0); }
      for (let y = 0; y < 16; y++) { edge(0, y, 0, 1); edge(24, y, 0, 1); }
    }
    fence.geometry.dispose(); ownedGeometry.delete(fence.geometry);
    fence.geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(points, 3)); ownedGeometry.add(fence.geometry);
    fence.visible = hasFence;
  }
  function rebuildPositions(objects) {
    const occupied = (x, y) => objects.some(o => {
      const s = OBJECT_TYPES[o.type]; if (!s || s.kit) return false;
      const w = o.rot % 2 ? s.h : s.w, h = o.rot % 2 ? s.w : s.h;
      return x >= o.x && x < o.x + w && y >= o.y && y < o.y + h;
    });
    positions = [];
    for (let i = 0; i < 384; i++) {
      const n = (i * 137) % 384, x = n % 24 + 0.5, y = Math.floor(n / 24) + 0.5;
      if (!occupied(x, y)) positions.push([x, y]);
    }
  }
  function update(input, objects, heights, motion) {
    if (disposed) return;
    const key = JSON.stringify(objects);
    if (key !== layoutKey) { rebuildFence(objects); rebuildPositions(objects); layoutKey = key; }
    const requested = Math.max(0, Math.round(input.crowd || 0));
    const nextActorKey = `${key}:${requested}`;
    if (nextActorKey !== actorKey) {
      crowdCount = Math.min(MAX_GUESTS, requested, positions.length);
      for (const batch of batches) {
        batch.mesh.count = crowdCount; batch.mesh.visible = crowdCount > 0;
        const palette = PALETTES[batch.surface] || PALETTES.clothing;
        for (let i = 0; i < crowdCount; i++) batch.mesh.setColorAt(i, color.set(palette[i % palette.length]));
        if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
      }
      actorKey = nextActorKey; lastTime = null;
    }
    const t = motion && Number.isFinite(input.t) ? input.t : 0;
    if (t !== lastTime) {
      offsets = [];
      for (let i = 0; i < crowdCount; i++) {
        const sway = motion && t > 0 ? Math.sin(t * 1.2 + i * 1.7) * 0.025 : 0;
        transform.position.set(positions[i][0], 0, positions[i][1]); transform.rotation.set(0, Math.PI + sway, 0); transform.updateMatrix();
        for (const batch of batches) { matrix.multiplyMatrices(transform.matrix, batch.local); batch.mesh.setMatrixAt(i, matrix); }
        if (i < 3) offsets.push(sway);
      }
      for (const batch of batches) batch.mesh.instanceMatrix.needsUpdate = true;
      lastTime = t;
    }
    grid.visible = !input.night || !!input.showClear; fence.material.opacity = input.night ? 0.25 : 0.45;
    marker.visible = !!input.incident && input.incident !== 'rain';
    incident = null;
    if (marker.visible) {
      const desired = input.incident === 'pa-dropout' ? ['pa-s', 'pa-m'] : input.incident === 'gate-jam' ? ['gate'] : ['stage'];
      const index = objects.findIndex(o => desired.includes(o.type));
      const o = objects[index], spec = o && OBJECT_TYPES[o.type];
      if (o && spec) {
        marker.position.set(o.x + (o.rot % 2 ? spec.h : spec.w) / 2, (heights[index] || 1) + 0.15, o.y + (o.rot % 2 ? spec.w : spec.h) / 2);
        incident = { id: input.incident, objectIndex: index, type: o.type, position: marker.position.toArray() };
      } else marker.visible = false;
    }
    rain.visible = input.incident === 'rain';
    if (rain.visible) {
      const a = rain.geometry.attributes.position.array;
      for (let i = 0; i < 240; i++) {
        const x = ((i * 73) % 240) / 10, z = ((i * 47) % 160) / 10, y = 4 - ((i * 0.173 + t * 3) % 4);
        a.set([x, y, z, x + 0.03, y - 0.16, z + 0.02], i * 6);
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
  }
  function dispose() {
    if (disposed) return; disposed = true;
    batches.forEach(b => b.mesh.dispose()); ownedGeometry.forEach(g => g.dispose()); ownedMaterial.forEach(m => m.dispose());
    ownedGeometry.clear(); ownedMaterial.clear(); group.clear();
  }
  return { group, update, dispose, info: () => ({ fencePanels, gateOpenings, incident, rain: rain.visible, grid: grid.visible, representativeGuests: crowdCount, guestBatches: batches.length, offsets }) };
}
