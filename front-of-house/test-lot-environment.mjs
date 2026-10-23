// Static environment ownership and bounds: scenery never participates in placement or saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLotEnvironment } from './lot-environment.mjs';
import { Box3, Matrix4, Mesh } from './vendor/three/three.module.min.js';

test('Lot surroundings are batched, static, owned decoration beyond the playable fence', () => {
  const env = createLotEnvironment(24, 16), meshes = env.group.children;
  assert.equal(env.info().batches, meshes.length);
  assert.ok(meshes.length <= 12);
  for (const mesh of meshes) {
    assert.ok(mesh.isMesh);
    assert.equal(mesh.castShadow, false);
    if (mesh.isInstancedMesh) for (let i = 0; i < mesh.count; i++) {
      const matrix = new Matrix4(); mesh.getMatrixAt(i, matrix);
      const sample = new Mesh(mesh.geometry, mesh.material); sample.applyMatrix4(matrix);
      const b = new Box3().setFromObject(sample);
      if (b.max.y > 0) assert.ok(b.max.x < 0 || b.min.x > 24 || b.max.z < 0 || b.min.z > 16, 'elevated decoration stays outside the lot');
    }
  }
  const fogNear = env.fog.near; env.setNight(true); assert.equal(env.fog.near, fogNear);
  let disposed = 0; const owned = new Set();
  meshes.forEach(m => { if (m.isInstancedMesh) owned.add(m); owned.add(m.geometry); owned.add(m.material); if (m.material.map) owned.add(m.material.map); });
  owned.forEach(resource => resource.addEventListener('dispose', () => disposed++));
  env.dispose(); assert.equal(disposed, owned.size); assert.equal(env.group.children.length, 0);
});
