// Cosmetic ensembles must remain bounded, deterministic and independent of saves.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Box3 } from './vendor/three/three.module.min.js';
import { createPerformers } from './performers.mjs';
import { bandLook } from './menu-art.mjs';
const artists = ['gravel-hymnal','sodium-arcade','juniper-switchboard','salt-ledger','pallet-chorus','tin-relay','gutter-census','hollow-census','amber-turnout','paper-voltage','north-kettle'];
test('all ensembles fit every stage rotation and never mutate their input', () => {
  const band = createPerformers();
  for (const artistId of artists) for (let rot = 0; rot < 4; rot++) {
    const input = Object.freeze({ artistId, performing: true, t: 12 });
    const stage = Object.freeze({ x: 2, y: 3, rot }); band.update(input, stage, true);
    assert.equal(band.info().count, bandLook(artistId).roles.length);
    const b = new Box3().setFromObject(band.group);
    assert.ok(b.min.x >= 2 && b.max.x <= 2 + (rot % 2 ? 3 : 6));
    assert.ok(b.min.z >= 3 && b.max.z <= 3 + (rot % 2 ? 6 : 3));
    assert.ok(b.min.y >= .5 && b.max.y < 1.6);
  }
  band.dispose(); band.dispose();
});
test('reduced motion is still; absent acts or stages never leave visible performers', () => {
  const band = createPerformers(), stage = { x: 0, y: 0, rot: 0 };
  const input = { artistId: 'tin-relay', performing: true, t: 5 };
  band.update(input, stage, false); const pose = band.group.children.map(m => [m.position.toArray(), m.rotation.toArray()]);
  band.update({ ...input, t: 12 }, stage, false); assert.deepEqual(band.group.children.map(m => [m.position.toArray(), m.rotation.toArray()]), pose);
  for (const [scene, s] of [[{ ...input, performing: false }, stage], [input, null], [{ ...input, artistId: null }, stage]]) { band.update(scene, s, true); assert.equal(band.info().count, 0); }
  band.dispose();
});
test('motion changes only presentation poses and changing acts disposes old meshes', () => {
  const band = createPerformers(), stage = { x: 0, y: 0, rot: 0 }, input = Object.freeze({ artistId: 'sodium-arcade', performing: true, t: 1 });
  band.update(input, stage, true); const old = [...band.group.children], pose = old[0].rotation.z;
  band.update({ ...input, t: 2 }, stage, true); assert.notEqual(old[0].rotation.z, pose);
  let freed = 0; old.forEach(mesh => mesh.geometry.addEventListener('dispose', () => freed++));
  band.update({ ...input, artistId: 'tin-relay' }, stage, false); assert.equal(freed, old.length); assert.deepEqual(band.info().roles, ['keys', 'keys']);
  band.dispose(); assert.equal(band.group.children.length, 0);
});
