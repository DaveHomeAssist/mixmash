// Generate/check the source-owned Lot sample manifest with measured bounds and source digests.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Box3 } from '../vendor/three/three.module.min.js';
import { createLotModels, MODEL_REVISION, MODEL_METADATA, AUTHORING_REFERENCE } from '../lot-models.mjs';
import { OBJECT_TYPES } from '../data.mjs';
const root = new URL('../', import.meta.url), hash = b => createHash('sha256').update(b).digest('hex');
const sources = {};
for (const file of ['lot-models.mjs', 'lot-camera.mjs', 'lot-presentation.mjs', 'lot-renderer.mjs']) sources[file] = hash(await readFile(new URL(file, root)));
const models = createLotModels(), round = n => Math.round(n * 100000) / 100000;
const assets = [];
for (const type of [...Object.keys(OBJECT_TYPES).filter(id => !OBJECT_TYPES[id].kit), 'guest']) {
  const model = type === 'guest' ? models.guest() : models.create({ type, x: 0, y: 0, rot: 0 });
  const bounds = new Box3().setFromObject(model); let meshCount = 0; model.traverse(o => { if (o.isMesh) meshCount++; });
  const spec = OBJECT_TYPES[type];
  assets.push({ id: type, logicalFootprint: spec ? [spec.w, spec.h] : null,
    pivot: 'footprint center at ground; guest feet at origin', forward: '+Z',
    visualBounds: { min: bounds.min.toArray().map(round), max: bounds.max.toArray().map(round) },
    meshCount, pickProxy: type === 'guest' ? 'not selectable; representative decoration' : 'opaque rendered mesh surfaces',
    materialRevision: MODEL_REVISION, lod: 'fixed source detail; guests instanced',
    contentDigest: hash(JSON.stringify({ source: sources['lot-models.mjs'], three: '0.184.0', type, footprint: spec ? [spec.w, spec.h] : null })) });
}
models.dispose();
const manifest = { revision: MODEL_REVISION, provenance: MODEL_METADATA, authoringReference: AUTHORING_REFERENCE, sources, assets,
  acceptance: { technical: 'See automated camera, footprint, scene and lifecycle tests', visual: 'Human review pending', physicalCalibration: 'Not performed', physicalDevices: 'Not accepted by this manifest' } };
const target = new URL('lot-assets.json', root), text = JSON.stringify(manifest, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(await readFile(target, 'utf8'), text, 'Lot manifest is stale; regenerate after source changes');
else await writeFile(target, text);
console.log(`Lot manifest ${MODEL_REVISION}: ${assets.length} source-owned samples, measured bounds and SHA-256 source digests.`);
