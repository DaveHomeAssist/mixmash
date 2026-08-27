import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';
import { RENDER_CONTRACT, assetPath } from './render-contract.mjs';
import {
  decodePng,
  generateContactSheet,
  loadArtManifest,
  pngDifference,
  validateArtManifest,
} from './art/validate-assets.mjs';
import { palette } from './sprites.mjs';

function pngChunk(type, data) {
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  return chunk;
}

function rgbaPng(width, height, color = [77, 184, 212, 255], transparentFirst = true) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x += 1) {
      const pixel = transparentFirst && x === 0 && y === 0 ? [0, 0, 0, 0] : color;
      row.set(pixel, 1 + x * 4);
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function singleAssetManifest(overrides = {}) {
  const asset = {
    category: 'Terrain',
    family: 'terrain',
    id: 'base_soil',
    class: 'terrain',
    states: [{ name: 'active', frames: 1, frameMs: 600 }],
    footprint: { width: 1, depth: 1, origin: 'centre' },
    fallback: 'procedural:terrain',
    editableSource: 'art/sources/terrain/base_soil.aseprite',
    ...overrides,
  };
  return {
    version: 1,
    contractVersion: RENDER_CONTRACT.version,
    decision: RENDER_CONTRACT.decision,
    exportRoot: 'assets/commissioned',
    sourceRoot: 'art/sources',
    assets: [asset],
    lightingProfiles: [],
    sequence: [],
  };
}

function writeValidPackage(root, manifest, png = rgbaPng(84, 42)) {
  const asset = manifest.assets[0];
  const state = asset.states[0];
  const exportFile = join(root, manifest.exportRoot, assetPath(asset.family, asset.id, state.name, 1));
  const sourceFile = join(root, asset.editableSource);
  mkdirSync(join(exportFile, '..'), { recursive: true });
  mkdirSync(join(sourceFile, '..'), { recursive: true });
  writeFileSync(exportFile, png);
  writeFileSync(sourceFile, 'editable source fixture');
  return { exportFile, sourceFile };
}

test('DEC-79 contract matches the 33-map runtime palette and geometry', () => {
  assert.equal(RENDER_CONTRACT.version, 2);
  assert.equal(RENDER_CONTRACT.decision, 'DEC-79');
  const contractColors = new Set(Object.values(RENDER_CONTRACT.palette));
  for (const color of Object.values(palette())) assert.ok(contractColors.has(color), `${color} is locked by the render contract`);
  assert.deepEqual(RENDER_CONTRACT.spriteClasses.actor, {
    canvasWidth: 12,
    canvasHeight: 18,
    scale: 3,
    anchor: 'feet',
    footprintWidth: 1,
    footprintDepth: 1,
  });
  assert.deepEqual(RENDER_CONTRACT.states, ['blueprint', 'construction', 'active', 'disabled', 'damaged']);
});

test('the golden slice covers every required category, state, lighting profile, and scene beat', () => {
  const manifest = loadArtManifest();
  const categories = new Set(manifest.assets.map((asset) => asset.category));
  assert.deepEqual([...categories].sort(), ['Buildings', 'Effects', 'Infrastructure', 'Props', 'Resources', 'Terrain', 'Units']);
  const states = new Set(manifest.assets.flatMap((asset) => asset.states.map((state) => state.name)));
  assert.deepEqual([...states].sort(), [...RENDER_CONTRACT.states].sort());
  assert.deepEqual(manifest.lightingProfiles.map((profile) => profile.id), ['dawn', 'daylight', 'storm', 'night']);
  assert.deepEqual(manifest.sequence, [
    'land_at_outpost',
    'survey_site',
    'place_solar_array_blueprint',
    'build_and_connect_power',
    'activate_extractor',
    'dispatch_rover',
    'dust_storm',
    'repair_at_sunrise',
  ]);
  assert.deepEqual(
    manifest.assets.filter((asset) => asset.artistTest).map((asset) => asset.id),
    ['base_soil', 'habitat', 'astronaut', 'blue_crystal'],
  );
});

test('planned missing art warns with fallback in normal mode and blocks approval mode', () => {
  const root = mkdtempSync(join(tmpdir(), 'mars-art-missing-'));
  const manifest = singleAssetManifest();
  const normal = validateArtManifest(manifest, { marsRoot: root });
  assert.equal(normal.passed, true);
  assert.ok(normal.warnings.some((issue) => issue.code === 'MISSING_SPRITE' && issue.response.includes('procedural:terrain')));
  assert.ok(normal.warnings.some((issue) => issue.code === 'MISSING_EDITABLE_SOURCE'));
  const approval = validateArtManifest(manifest, { marsRoot: root, approval: true });
  assert.equal(approval.passed, false);
  assert.ok(approval.errors.some((issue) => issue.code === 'MISSING_SPRITE'));
  assert.ok(approval.errors.some((issue) => issue.code === 'MISSING_EDITABLE_SOURCE'));
});

test('a renderer-ready RGBA export and editable source pass strict approval', () => {
  const root = mkdtempSync(join(tmpdir(), 'mars-art-valid-'));
  const manifest = singleAssetManifest();
  writeValidPackage(root, manifest);
  const report = validateArtManifest(manifest, { marsRoot: root, approval: true });
  assert.equal(report.approvalReady, true);
  assert.deepEqual(report.counts, {
    assets: 1,
    expectedExports: 1,
    presentExports: 1,
    missingExports: 0,
    editableSources: 1,
    errors: 0,
    warnings: 0,
  });
});

test('invalid dimensions, transparency, and anchors fail clearly', () => {
  const dimensionRoot = mkdtempSync(join(tmpdir(), 'mars-art-size-'));
  const dimensionManifest = singleAssetManifest({ anchor: { type: 'feet', x: 0.5, y: 1 } });
  writeValidPackage(dimensionRoot, dimensionManifest, rgbaPng(83, 42));
  const dimensionReport = validateArtManifest(dimensionManifest, { marsRoot: dimensionRoot, approval: true });
  assert.ok(dimensionReport.errors.some((issue) => issue.code === 'INVALID_DIMENSIONS' && issue.message.includes('83x42')));
  assert.ok(dimensionReport.errors.some((issue) => issue.code === 'INVALID_ANCHOR'));

  const alphaRoot = mkdtempSync(join(tmpdir(), 'mars-art-alpha-'));
  const alphaManifest = singleAssetManifest();
  const opaque = rgbaPng(84, 42, [77, 184, 212, 255], false);
  writeValidPackage(alphaRoot, alphaManifest, opaque);
  assert.equal(decodePng(opaque).transparentPixels, 0);
  const alphaReport = validateArtManifest(alphaManifest, { marsRoot: alphaRoot, approval: true });
  assert.ok(alphaReport.errors.some((issue) => issue.code === 'INVALID_TRANSPARENCY'));
});

test('broken animation keeps frame 01 as the declared safe fallback', () => {
  const root = mkdtempSync(join(tmpdir(), 'mars-art-animation-'));
  const manifest = singleAssetManifest({ states: [{ name: 'active', frames: 4, frameMs: 150 }] });
  writeValidPackage(root, manifest);
  const report = validateArtManifest(manifest, { marsRoot: root });
  const broken = report.warnings.find((issue) => issue.code === 'BROKEN_ANIMATION');
  assert.ok(broken);
  assert.match(broken.response, /frame 01/i);
});

test('contact-sheet generation includes anchor, footprint, state, and fallback evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'mars-art-sheet-'));
  const manifest = singleAssetManifest();
  const output = join(root, 'reports', 'contact-sheet.html');
  const result = generateContactSheet(manifest, output, { marsRoot: root });
  assert.equal(result.cards, 1);
  assert.equal(existsSync(output), true);
  const html = readFileSync(output, 'utf8');
  assert.match(html, /class="anchor"/);
  assert.match(html, /class="footprint"/);
  assert.match(html, /active 1f\/600ms/);
  assert.match(html, /PROCEDURAL/);
});

test('PNG difference reports identical and changed screenshots without dependencies', () => {
  const first = rgbaPng(2, 2, [77, 184, 212, 255]);
  const same = rgbaPng(2, 2, [77, 184, 212, 255]);
  const changed = rgbaPng(2, 2, [176, 96, 58, 255]);
  assert.deepEqual(pngDifference(first, same), { compatible: true, width: 2, height: 2, changedPixels: 0, ratio: 0 });
  assert.equal(pngDifference(first, changed).changedPixels, 3);
});
