// Static environment ownership and bounds: scenery never participates in placement or saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLotEnvironment } from './lot-environment.mjs';
import { Raycaster, Vector3 } from './vendor/three/three.module.min.js';

test('Lot surroundings are batched, static, owned decoration beyond the playable fence', () => {
  const env = createLotEnvironment(24, 16), meshes = env.group.children;
  assert.equal(env.info().batches, meshes.length);
  assert.ok(meshes.length <= 12);
  for (const mesh of meshes) {
    assert.ok(mesh.isMesh);
    assert.equal(mesh.castShadow, false);
    if (mesh.name === 'lot-setting') {
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) if (positions.getY(i) > 0) {
        const x = positions.getX(i), z = positions.getZ(i);
        assert.ok(x < 0 || x > 24 || z < 0 || z > 16, 'elevated decoration stays outside the lot');
      }
    }
  }
  const fogNear = env.fog.near; env.setNight(true); assert.equal(env.fog.near, fogNear);
  let disposed = 0; const owned = new Set();
  meshes.forEach(m => { if (m.isInstancedMesh) owned.add(m); owned.add(m.geometry); owned.add(m.material); if (m.material.map) owned.add(m.material.map); if (m.material.uniforms?.grain) owned.add(m.material.uniforms.grain.value); });
  owned.forEach(resource => resource.addEventListener('dispose', () => disposed++));
  env.dispose(); assert.equal(disposed, owned.size); assert.equal(env.group.children.length, 0);
});

// Hidden surfaces add fill cost without contributing any visible scenery.
test('decorative ground leaves the playable floor open and retains the exterior', () => {
  const env = createLotEnvironment(24, 16); env.group.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(12, 2, 8), new Vector3(0, -1, 0), 0, 4);
  assert.equal(ray.intersectObjects(env.group.children, false).length, 0);
  for (const x of [-2, -10]) {
    ray.set(new Vector3(x, 2, 8), new Vector3(0, -1, 0));
    assert.ok(ray.intersectObjects(env.group.children, false).length > 0);
  }
  const setting = env.group.getObjectByName('lot-setting');
  const day = setting.material.uniforms.night.value;
  env.setNight(true); assert.equal(setting.material.uniforms.night.value === day, false);
  env.setNight(false); assert.equal(setting.material.uniforms.night.value === day, true);
  env.dispose();
});
