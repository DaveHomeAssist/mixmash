import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';
import { RENDER_CONTRACT, assetPath } from './render-contract.mjs';
import {
  artPackageDigests,
  artManifestHash,
  decodePng,
  generateContactSheet,
  generateRuntimeIndex,
  loadArtManifest,
  pngDifference,
  verifyApprovalReports,
  verifyRuntimeIndex,
  validateArtManifest,
  writeApprovalReports,
  writeRuntimeIndex,
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

function writeArtistTestPackage(root, manifest) {
  for (const asset of manifest.assets.filter((candidate) => candidate.artistTest)) {
    const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
    const selectedStates = new Set(asset.artistTestStates);
    for (const state of asset.states.filter((candidate) => selectedStates.has(candidate.name))) {
      for (let frame = 1; frame <= state.frames; frame += 1) {
        const exportFile = join(root, manifest.exportRoot, assetPath(asset.family, asset.id, state.name, frame));
        mkdirSync(join(exportFile, '..'), { recursive: true });
        writeFileSync(exportFile, rgbaPng(spriteClass.canvasWidth, spriteClass.canvasHeight));
      }
    }
    const sourceFile = join(root, asset.editableSource);
    mkdirSync(join(sourceFile, '..'), { recursive: true });
    writeFileSync(sourceFile, 'editable source fixture');
  }
}

test('DEC-79 contract matches the 33-map runtime palette and geometry', () => {
  assert.equal(RENDER_CONTRACT.version, 3);
  assert.equal(RENDER_CONTRACT.decision, 'DEC-79');
  const contractColors = new Set(Object.values(RENDER_CONTRACT.palette));
  for (const color of Object.values(palette())) assert.ok(contractColors.has(color), `${color} is locked by the render contract`);
  assert.deepEqual(RENDER_CONTRACT.spriteClasses.actor, {
    canvasWidth: 12,
    canvasHeight: 18,
    scale: 3,
    anchor: 'feet',
    screenOffsetX: 0,
    screenOffsetY: 4,
    footprintWidth: 1,
    footprintDepth: 1,
  });
  assert.deepEqual(RENDER_CONTRACT.states, ['blueprint', 'construction', 'active', 'disabled', 'damaged']);
  assert.deepEqual(Object.keys(RENDER_CONTRACT.light.profiles), ['dawn', 'daylight', 'storm', 'night']);
  assert.equal(RENDER_CONTRACT.performance.sampleFrames, 300);
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
  const paidTest = validateArtManifest(manifest, { scope: 'artist-test' });
  assert.equal(paidTest.counts.assets, 4);
  assert.equal(paidTest.counts.expectedExports, 8);
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

test('the paid artist gate validates only its explicit eight-export package', () => {
  const root = mkdtempSync(join(tmpdir(), 'mars-art-paid-'));
  const manifest = loadArtManifest();
  writeArtistTestPackage(root, manifest);
  const report = validateArtManifest(manifest, { marsRoot: root, approval: true, scope: 'artist-test' });
  assert.equal(report.approvalReady, true);
  assert.equal(report.scope, 'artist-test');
  assert.equal(report.counts.assets, 4);
  assert.equal(report.counts.expectedExports, 8);
  assert.equal(report.counts.presentExports, 8);
  assert.equal(report.counts.editableSources, 4);
  assert.equal(report.manifestHash, artManifestHash(manifest));
});

test('runtime index includes only valid frame-01-safe exports and detects drift', () => {
  const root = mkdtempSync(join(tmpdir(), 'mars-art-index-'));
  const manifest = singleAssetManifest({ states: [{ name: 'active', frames: 2, frameMs: 300 }] });
  writeValidPackage(root, manifest);
  const index = generateRuntimeIndex(manifest, { marsRoot: root });
  assert.equal(index.contractVersion, RENDER_CONTRACT.version);
  assert.equal(index.assets.length, 1);
  assert.equal(index.availableExports, 1);
  assert.equal(index.runtimeAssetHashes.full, index.runtimeAssetHash);
  assert.match(index.runtimeAssetHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(index.assets[0].anchor, { type: 'tile-centre', x: 0.5, y: 0.5 });
  assert.deepEqual(index.assets[0].screenOffset, { x: 0, y: 0 });
  assert.equal(index.assets[0].states.active.declaredFrames, 2);
  assert.deepEqual(index.assets[0].states.active.frames, ['sprites/terrain/base_soil__active__f01.png']);

  const indexPath = join(root, 'assets', 'commissioned', 'index.json');
  writeRuntimeIndex(manifest, indexPath, { marsRoot: root });
  assert.equal(verifyRuntimeIndex(manifest, indexPath, { marsRoot: root }).passed, true);
  writeFileSync(indexPath, '{}\n');
  assert.deepEqual(
    { passed: verifyRuntimeIndex(manifest, indexPath, { marsRoot: root }).passed, reason: verifyRuntimeIndex(manifest, indexPath, { marsRoot: root }).reason },
    { passed: false, reason: 'stale' },
  );
});

test('runtime index keeps paid-test byte identity scoped inside a larger package', () => {
  const root = mkdtempSync(join(tmpdir(), 'mars-art-scoped-hash-'));
  const manifest = {
    ...singleAssetManifest({ artistTest: true, artistTestStates: ['active'] }),
    assets: [
      singleAssetManifest({ artistTest: true, artistTestStates: ['active'] }).assets[0],
      {
        ...singleAssetManifest().assets[0],
        id: 'rocky_soil',
        editableSource: 'art/sources/terrain/rocky_soil.aseprite',
      },
    ],
  };
  for (const asset of manifest.assets) {
    const exportFile = join(root, manifest.exportRoot, assetPath(asset.family, asset.id, 'active', 1));
    const sourceFile = join(root, asset.editableSource);
    mkdirSync(join(exportFile, '..'), { recursive: true });
    mkdirSync(join(sourceFile, '..'), { recursive: true });
    writeFileSync(exportFile, rgbaPng(84, 42));
    writeFileSync(sourceFile, `${asset.id} editable source`);
  }
  const index = generateRuntimeIndex(manifest, { marsRoot: root });
  const paidDigests = artPackageDigests(manifest, { marsRoot: root, scope: 'artist-test' });
  const fullDigests = artPackageDigests(manifest, { marsRoot: root, scope: 'full' });
  assert.equal(index.runtimeAssetHashes['artist-test'], paidDigests.runtimeAssetHash);
  assert.equal(index.runtimeAssetHashes.full, fullDigests.runtimeAssetHash);
  assert.notEqual(index.runtimeAssetHashes['artist-test'], index.runtimeAssetHashes.full);
});

test('strict approval reports are deterministic and include runtime-index evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'mars-art-approval-reports-'));
  const manifest = singleAssetManifest({ artistTest: true, artistTestStates: ['active'] });
  writeValidPackage(root, manifest);
  const indexPath = join(root, 'assets', 'commissioned', 'index.json');
  writeRuntimeIndex(manifest, indexPath, { marsRoot: root });
  const reportDirectory = join(root, 'art', 'reports');
  const documents = writeApprovalReports(manifest, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath });

  assert.equal(documents['artist-test'].reportVersion, 1);
  assert.equal(documents['artist-test'].approvalReady, true);
  assert.equal(documents['artist-test'].machineReady, true);
  assert.equal(documents['artist-test'].artifactDigests.complete, true);
  assert.match(documents['artist-test'].artifactDigests.packageHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(documents['artist-test'].indexVerification, { passed: true, reason: null });
  assert.equal(documents.full.approvalReady, true);
  assert.equal(verifyApprovalReports(manifest, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath }).passed, true);

  writeFileSync(join(reportDirectory, 'artist-test-approval.json'), '{}\n');
  const stale = verifyApprovalReports(manifest, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath });
  assert.equal(stale.passed, false);
  assert.equal(stale.reports['artist-test'].reason, 'stale');

  writeFileSync(indexPath, '{}\n');
  const staleIndexDocuments = writeApprovalReports(manifest, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath });
  assert.equal(staleIndexDocuments['artist-test'].approvalReady, true);
  assert.equal(staleIndexDocuments['artist-test'].machineReady, false);
  assert.deepEqual(staleIndexDocuments['artist-test'].indexVerification, { passed: false, reason: 'stale' });
});

test('package identity invalidates approval evidence when export or editable-source bytes change', () => {
  const root = mkdtempSync(join(tmpdir(), 'mars-art-package-hash-'));
  const manifest = singleAssetManifest({ artistTest: true, artistTestStates: ['active'] });
  const { exportFile, sourceFile } = writeValidPackage(root, manifest);
  const indexPath = join(root, 'assets', 'commissioned', 'index.json');
  const reportDirectory = join(root, 'art', 'reports');
  writeRuntimeIndex(manifest, indexPath, { marsRoot: root });
  const initial = writeApprovalReports(manifest, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath });
  const initialDigests = artPackageDigests(manifest, { marsRoot: root, scope: 'artist-test' });
  assert.equal(initial['artist-test'].machineReady, true);

  writeFileSync(exportFile, rgbaPng(84, 42, [176, 96, 58, 255]));
  const changedExport = artPackageDigests(manifest, { marsRoot: root, scope: 'artist-test' });
  assert.notEqual(changedExport.runtimeAssetHash, initialDigests.runtimeAssetHash);
  assert.notEqual(changedExport.packageHash, initialDigests.packageHash);
  assert.equal(verifyRuntimeIndex(manifest, indexPath, { marsRoot: root }).passed, false);
  assert.equal(verifyApprovalReports(manifest, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath }).passed, false);

  writeRuntimeIndex(manifest, indexPath, { marsRoot: root });
  const afterExport = writeApprovalReports(manifest, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath });
  assert.equal(afterExport['artist-test'].machineReady, true);
  writeFileSync(sourceFile, 'changed editable source fixture');
  const changedSource = artPackageDigests(manifest, { marsRoot: root, scope: 'artist-test' });
  assert.equal(changedSource.runtimeAssetHash, changedExport.runtimeAssetHash);
  assert.notEqual(changedSource.packageHash, changedExport.packageHash);
  assert.equal(verifyRuntimeIndex(manifest, indexPath, { marsRoot: root }).passed, true);
  assert.equal(verifyApprovalReports(manifest, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath }).passed, false);
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
  const manifest = singleAssetManifest({
    category: 'Buildings',
    family: 'building',
    id: 'habitat',
    class: 'building',
    footprint: { width: 2, depth: 1, origin: 'centre' },
    fallback: 'procedural:building',
    editableSource: 'art/sources/building/habitat.aseprite',
  });
  const output = join(root, 'reports', 'contact-sheet.html');
  const result = generateContactSheet(manifest, output, { marsRoot: root });
  assert.equal(result.cards, 1);
  assert.equal(existsSync(output), true);
  const html = readFileSync(output, 'utf8');
  assert.match(html, /class="anchor"/);
  assert.match(html, /class="footprint"/);
  assert.match(html, /ground offset \(0,18\)/);
  assert.match(html, /<polygon points="109,80\.5 193,122\.5 151,143\.5 67,101\.5"/);
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
