import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deflateRawSync, deflateSync } from 'node:zlib';
import { RENDER_CONTRACT, assetPath } from './render-contract.mjs';
import {
  RUNTIME_IDENTITY_SCHEMA,
  RUNTIME_INDEX_VERSION,
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

function tempRoot(t, prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function pngChunk(type, data) {
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
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

function craftedRgbaPng(width, height, inflated) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(inflated)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function mutatePngChunk(png, type, mutate, repairCrc = false) {
  const result = Buffer.from(png);
  let offset = 8;
  while (offset + 12 <= result.length) {
    const length = result.readUInt32BE(offset);
    const chunkType = result.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (chunkType === type) {
      mutate(result.subarray(dataStart, dataEnd), result, dataEnd);
      if (repairCrc) result.writeUInt32BE(crc32(result.subarray(offset + 4, dataEnd)), dataEnd);
      return result;
    }
    offset = dataEnd + 4;
  }
  throw new Error(`PNG fixture has no ${type} chunk`);
}

function asepriteChunk(type, data) {
  const chunk = Buffer.alloc(6 + data.length);
  chunk.writeUInt32LE(chunk.length, 0);
  chunk.writeUInt16LE(type, 4);
  data.copy(chunk, 6);
  return chunk;
}

function asepriteCel(spec = {}) {
  const type = spec.type || 'raw';
  const typeCode = { raw: 0, linked: 1, compressed: 2, tilemap: 3 }[type];
  if (typeCode === undefined) throw new Error(`Unknown Aseprite fixture cel type ${type}`);
  let payload;
  if (type === 'raw' || type === 'compressed') {
    const celWidth = spec.width ?? 1;
    const celHeight = spec.height ?? 1;
    const pixels = spec.pixels || (spec.undersizedRaw ? Buffer.from([77, 184, 212]) : Buffer.alloc(celWidth * celHeight * 4, 127));
    const image = Buffer.alloc(4);
    image.writeUInt16LE(celWidth, 0);
    image.writeUInt16LE(celHeight, 2);
    const encoded = type === 'compressed'
      ? spec.corruptCompressed ? Buffer.from([120, 156, 0]) : spec.encodedPayload || deflateSync(pixels)
      : pixels;
    payload = Buffer.concat([image, encoded]);
  } else if (type === 'linked') {
    payload = Buffer.alloc(2);
    payload.writeUInt16LE(spec.linkedFrame ?? 0, 0);
  } else payload = Buffer.alloc(33, 1);
  const cel = Buffer.alloc(16 + payload.length);
  cel.writeUInt16LE(spec.layerIndex ?? 0, 0);
  cel[6] = 255;
  cel.writeUInt16LE(typeCode, 7);
  payload.copy(cel, 16);
  return asepriteChunk(0x2005, cel);
}

function asepriteSource(width, height, options = {}) {
  const layerName = Buffer.from(options.layerName || 'Paint Layer 1');
  const layer = Buffer.alloc(18 + layerName.length);
  layer.writeUInt16LE(3, 0);
  layer.writeUInt16LE(0, 2);
  layer.writeUInt16LE(width, 6);
  layer.writeUInt16LE(height, 8);
  layer[12] = 255;
  layer.writeUInt16LE(layerName.length, 16);
  layerName.copy(layer, 18);

  const celSpecs = options.cels || [{
    type: options.celType || 'raw',
    layerIndex: options.celLayerIndex ?? 0,
    linkedFrame: options.linkedFrame,
    undersizedRaw: options.undersizedRaw,
    corruptCompressed: options.corruptCompressed,
  }];
  const frames = celSpecs.map((spec, frameIndex) => {
    const chunks = [];
    if (frameIndex === 0) chunks.push(asepriteChunk(0x2004, layer));
    if (spec) chunks.push(asepriteCel(spec));
    const frame = Buffer.alloc(16);
    frame.writeUInt32LE(16 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 0);
    frame.writeUInt16LE(0xf1fa, 4);
    frame.writeUInt16LE(chunks.length, 6);
    frame.writeUInt16LE(100, 8);
    frame.writeUInt32LE(chunks.length, 12);
    return Buffer.concat([frame, ...chunks]);
  });

  const header = Buffer.alloc(128);
  header.writeUInt32LE(128 + frames.reduce((sum, frame) => sum + frame.length, 0), 0);
  header.writeUInt16LE(0xa5e0, 4);
  header.writeUInt16LE(frames.length, 6);
  header.writeUInt16LE(width, 8);
  header.writeUInt16LE(height, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(1, 14);
  return Buffer.concat([header, ...frames]);
}

function packBitsRows(rowBytes, rows) {
  const encodedRows = [];
  const lengths = Buffer.alloc(rows * 2);
  for (let row = 0; row < rows; row += 1) {
    const parts = [];
    let remaining = rowBytes;
    while (remaining > 0) {
      const count = Math.min(128, remaining);
      parts.push(Buffer.concat([Buffer.from([count - 1]), Buffer.alloc(count, (row + 31) & 255)]));
      remaining -= count;
    }
    const encoded = Buffer.concat(parts);
    lengths.writeUInt16BE(encoded.length, row * 2);
    encodedRows.push(encoded);
  }
  return Buffer.concat([lengths, ...encodedRows]);
}

function psdPixelData(rowBytes, rows, compression = 'raw', options = {}) {
  const code = { raw: 0, rle: 1, zip: 2, zipPrediction: 3 }[compression];
  if (code === undefined) throw new Error(`Unknown PSD fixture compression ${compression}`);
  let payload;
  if (compression === 'raw') {
    payload = Buffer.alloc(rowBytes * rows, 127);
    if (options.undersized) payload = payload.subarray(0, payload.length - 1);
  } else if (compression === 'rle') payload = options.corrupt ? Buffer.alloc(2) : packBitsRows(rowBytes, rows);
  else payload = options.corrupt ? Buffer.from([120, 156, 0]) : deflateSync(Buffer.alloc(rowBytes * rows, 127));
  const header = Buffer.alloc(2);
  header.writeUInt16BE(code, 0);
  return Buffer.concat([header, payload]);
}

function psdSource(width, height, options = {}) {
  const header = Buffer.alloc(26);
  header.write('8BPS', 0, 4, 'ascii');
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(1, 12);
  header.writeUInt32BE(height, 14);
  header.writeUInt32BE(width, 18);
  header.writeUInt16BE(8, 22);
  header.writeUInt16BE(1, 24);
  const emptySection = Buffer.alloc(4);

  const layerCount = options.includeLayer === false ? 0 : 1;
  let layerInfoBody;
  if (!layerCount) {
    layerInfoBody = Buffer.alloc(2);
  } else {
    const layerWidth = options.layerWidth || width;
    const layerHeight = options.layerHeight || height;
    const channelCount = options.channelCount || 1;
    const channelData = options.channelData || psdPixelData(layerWidth, layerHeight, options.compression || 'raw', {
      undersized: options.undersizedRaw,
      corrupt: options.corruptCompressed,
    });
    const name = Buffer.from(options.layerName || 'Layer 1');
    const paddedNameLength = (name.length + 1 + 3) & ~3;
    const extra = Buffer.alloc(8 + paddedNameLength);
    extra[8] = name.length;
    name.copy(extra, 9);
    const record = Buffer.alloc(18 + channelCount * 6 + 12 + 4 + extra.length);
    record.writeInt32BE(0, 0);
    record.writeInt32BE(0, 4);
    record.writeInt32BE(layerHeight, 8);
    record.writeInt32BE(layerWidth, 12);
    record.writeUInt16BE(channelCount, 16);
    for (let channel = 0; channel < channelCount; channel += 1) {
      record.writeInt16BE(channel, 18 + channel * 6);
      record.writeUInt32BE(channelData.length, 20 + channel * 6);
    }
    const blendOffset = 18 + channelCount * 6;
    record.write('8BIM', blendOffset, 4, 'ascii');
    record.write('norm', blendOffset + 4, 4, 'ascii');
    record[blendOffset + 8] = 255;
    record.writeUInt32BE(extra.length, blendOffset + 12);
    extra.copy(record, blendOffset + 16);
    layerInfoBody = Buffer.concat([Buffer.from([0, 1]), record, ...Array.from({ length: channelCount }, () => channelData)]);
    if (layerInfoBody.length % 2) layerInfoBody = Buffer.concat([layerInfoBody, Buffer.from([0])]);
  }
  const layerInfo = Buffer.alloc(4 + layerInfoBody.length);
  layerInfo.writeUInt32BE(layerInfoBody.length, 0);
  layerInfoBody.copy(layerInfo, 4);
  const globalMask = Buffer.alloc(4);
  const layerMask = Buffer.alloc(4 + layerInfo.length + globalMask.length);
  layerMask.writeUInt32BE(layerInfo.length + globalMask.length, 0);
  layerInfo.copy(layerMask, 4);
  globalMask.copy(layerMask, 4 + layerInfo.length);
  const composite = psdPixelData(width, height, options.compositeCompression || options.compression || 'raw');
  return Buffer.concat([header, emptySection, emptySection, layerMask, composite]);
}

function zipArchive(files, options = {}) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const [name, value] of files) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(value);
    const method = options.compress && name !== 'mimetype' ? 8 : 0;
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const checksum = crc32(data);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    localParts.push(local, compressed);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(localOffset, 42);
    nameBytes.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length + compressed.length;
  }
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, central, eocd]);
}

function replaceCentralUncompressedSizes(archive, sizes) {
  const result = Buffer.from(archive);
  const eocdOffset = result.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocdOffset >= 0, 'fixture has a ZIP end-of-directory record');
  let offset = result.readUInt32LE(eocdOffset + 16);
  for (const size of sizes) {
    assert.equal(result.readUInt32LE(offset), 0x02014b50, 'fixture has the next ZIP central entry');
    result.writeUInt32LE(size, offset + 24);
    offset += 46 + result.readUInt16LE(offset + 28) + result.readUInt16LE(offset + 30) + result.readUInt16LE(offset + 32);
  }
  return result;
}

function lzfLiteralPayload(buffer) {
  const parts = [Buffer.from([1])];
  for (let offset = 0; offset < buffer.length; offset += 32) {
    const chunk = buffer.subarray(offset, Math.min(offset + 32, buffer.length));
    parts.push(Buffer.from([chunk.length - 1]), chunk);
  }
  return Buffer.concat(parts);
}

function kraSource(width, height, options = {}) {
  const documentName = 'MarsScape';
  const layerName = 'layer1';
  const xml = options.xml || `<?xml version="1.0" encoding="UTF-8"?><DOC><IMAGE name="${documentName}" width="${width}" height="${height}"><layers><layer name="Paint Layer 1" nodetype="paintlayer" filename="${layerName}" /></layers></IMAGE></DOC>`;
  const tileBytes = Buffer.alloc(64 * 64 * 4);
  tileBytes.set([77, 184, 212, 255]);
  const tileCompression = options.tileCompression || 'NONE';
  let tilePayload = tileCompression === 'LZF' ? lzfLiteralPayload(tileBytes) : tileBytes;
  if (options.undersizedRaw) tilePayload = tilePayload.subarray(0, tilePayload.length - 1);
  if (options.corruptLzf) tilePayload = Buffer.from([1, 32, 255]);
  const tileCount = options.tileCount ?? 1;
  const layerData = Buffer.concat([
    Buffer.from(`VERSION 2\nTILEWIDTH 64\nTILEHEIGHT 64\nPIXELSIZE 4\nDATA ${tileCount}\n0,0,${tileCompression},${tilePayload.length}\n`),
    tilePayload,
  ]);
  const files = [
    ['mimetype', Buffer.from('application/x-krita')],
    ['maindoc.xml', Buffer.from(xml)],
    ['mergedimage.png', rgbaPng(width, height)],
    ['preview.png', rgbaPng(Math.min(width, 8), Math.min(height, 8))],
  ];
  if (options.includeLayer !== false) {
    files.push([`${documentName}/layers/${layerName}`, layerData]);
    files.push([`${documentName}/layers/${layerName}.defaultpixel`, Buffer.alloc(4)]);
  }
  return zipArchive(files, { compress: options.compress !== false });
}

function editableSource(asset, options = {}) {
  const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
  const extension = asset.editableSource.split('.').pop();
  if (extension === 'aseprite') return asepriteSource(spriteClass.canvasWidth, spriteClass.canvasHeight, options);
  if (extension === 'psd') return psdSource(spriteClass.canvasWidth, spriteClass.canvasHeight, options);
  if (extension === 'kra') return kraSource(spriteClass.canvasWidth, spriteClass.canvasHeight, options);
  throw new Error(`No editable fixture for .${extension}`);
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

function writeValidExport(root, manifest, png = rgbaPng(84, 42)) {
  const asset = manifest.assets[0];
  const state = asset.states[0];
  const exportFile = join(root, manifest.exportRoot, assetPath(asset.family, asset.id, state.name, 1));
  mkdirSync(join(exportFile, '..'), { recursive: true });
  writeFileSync(exportFile, png);
  return exportFile;
}

function writeValidPackage(root, manifest, png = rgbaPng(84, 42)) {
  const asset = manifest.assets[0];
  const exportFile = writeValidExport(root, manifest, png);
  const sourceFile = join(root, asset.editableSource);
  mkdirSync(join(sourceFile, '..'), { recursive: true });
  writeFileSync(sourceFile, editableSource(asset));
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
    writeFileSync(sourceFile, editableSource(asset));
  }
}

function markdownRows(section) {
  return section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| ---'))
    .slice(1)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
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

test('the art audit uses only the five requested classifications and accounts for every commissioned asset', () => {
  const audit = readFileSync(new URL('./docs/ART_AUDIT.md', import.meta.url), 'utf8');
  const allowed = new Set(['Production-ready', 'Adaptable', 'Reference-only', 'Replace', 'Missing']);
  const systemSection = audit.split('## System audit\n')[1].split('## Asset inventory\n')[0];
  const runtimeSection = audit.split('## Asset inventory\n')[1].split('## Missing golden-slice art\n')[0];
  const missingSection = audit.split('## Missing golden-slice art\n')[1].split('## PR #8 disposition\n')[0];

  for (const row of markdownRows(systemSection)) {
    assert.ok(allowed.has(row[1]), `${row[0]} uses an unsupported classification: ${row[1]}`);
  }
  for (const row of markdownRows(runtimeSection)) {
    assert.ok(allowed.has(row[2]), `${row[0]} uses an unsupported classification: ${row[2]}`);
  }
  for (const row of markdownRows(missingSection)) {
    assert.equal(row[2], 'Missing', `${row[0]} must stay Missing until commissioned evidence exists`);
  }

  const manifest = loadArtManifest();
  for (const asset of manifest.assets) {
    assert.ok(missingSection.includes('`' + asset.id + '`'), `${asset.family}:${asset.id} is not classified in the missing-art inventory`);
  }
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

test('planned missing art warns with fallback in normal mode and blocks approval mode', (t) => {
  const root = tempRoot(t, 'mars-art-missing-');
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

test('a renderer-ready RGBA export and editable source pass strict approval', (t) => {
  const root = tempRoot(t, 'mars-art-valid-');
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

test('editable-source approval requires valid layered Aseprite, PSD, or KRA structure', (t) => {
  for (const extension of ['aseprite', 'psd', 'kra']) {
    const root = tempRoot(t, `mars-art-${extension}-`);
    const manifest = singleAssetManifest({ editableSource: `art/sources/terrain/base_soil.${extension}` });
    const { sourceFile } = writeValidPackage(root, manifest);
    const validBytes = editableSource(manifest.assets[0]);
    assert.deepEqual(validBytes, editableSource(manifest.assets[0]), `${extension} fixture is deterministic`);

    const validReport = validateArtManifest(manifest, { marsRoot: root, approval: true });
    assert.equal(validReport.approvalReady, true, `${extension} layered source passes approval`);
    assert.equal(validReport.counts.editableSources, 1);
    const validDigests = artPackageDigests(manifest, { marsRoot: root });
    assert.equal(validDigests.complete, true);
    assert.match(validDigests.editableSources[0].sha256, /^[a-f0-9]{64}$/);

    const validVariants = extension === 'aseprite'
      ? [asepriteSource(84, 42, { cels: [{ type: 'raw' }, { type: 'linked', linkedFrame: 0 }] })]
      : extension === 'psd'
        ? ['rle', 'zip', 'zipPrediction'].map((compression) => psdSource(84, 42, { compression }))
        : [kraSource(84, 42, { tileCompression: 'LZF' })];
    for (const bytes of validVariants) {
      writeFileSync(sourceFile, bytes);
      assert.equal(validateArtManifest(manifest, { marsRoot: root, approval: true }).approvalReady, true, `${extension} valid variant passes`);
    }

    const invalidCases = [
      ['plaintext', Buffer.from('not an editable art document')],
      ['renamed PNG', rgbaPng(84, 42)],
      ['truncated document', validBytes.subarray(0, Math.floor(validBytes.length / 2))],
      ['bad layer structure', editableSource(manifest.assets[0], extension === 'aseprite'
        ? { celLayerIndex: 1 }
        : { includeLayer: false })],
    ];
    for (const [label, bytes] of invalidCases) {
      writeFileSync(sourceFile, bytes);
      const report = validateArtManifest(manifest, { marsRoot: root, approval: true });
      const issue = report.errors.find((candidate) => candidate.code === 'INVALID_EDITABLE_SOURCE');
      assert.ok(issue, `${extension} ${label} must be INVALID_EDITABLE_SOURCE`);
      assert.equal(report.errors.some((candidate) => candidate.code === 'MISSING_EDITABLE_SOURCE'), false);
      assert.match(issue.response, /block final asset approval/i);
      const digests = artPackageDigests(manifest, { marsRoot: root });
      assert.equal(digests.complete, false, `${extension} ${label} cannot complete package identity`);
      assert.equal(digests.editableSources[0].sha256, null, `${extension} ${label} bytes are not hashed as an approved source`);
    }

    writeFileSync(sourceFile, validBytes);
    assert.equal(validateArtManifest(manifest, { marsRoot: root, approval: true }).approvalReady, true);
  }
});

test('editable-source canvas dimensions must match the renderer sprite class', (t) => {
  const root = tempRoot(t, 'mars-art-source-size-');
  const manifest = singleAssetManifest();
  const { sourceFile } = writeValidPackage(root, manifest);
  writeFileSync(sourceFile, asepriteSource(83, 42));
  const report = validateArtManifest(manifest, { marsRoot: root, approval: true });
  const issue = report.errors.find((candidate) => candidate.code === 'INVALID_EDITABLE_SOURCE');
  assert.ok(issue);
  assert.match(issue.message, /83x42; expected 84x42/);
  assert.equal(artPackageDigests(manifest, { marsRoot: root }).editableSources[0].sha256, null);
});

test('Aseprite approval rejects unresolved links, cycles, tilemaps, and corrupt pixel payloads', (t) => {
  const root = tempRoot(t, 'mars-art-aseprite-adversarial-');
  const manifest = singleAssetManifest();
  const { sourceFile } = writeValidPackage(root, manifest);
  const invalidSources = [
    ['self-linked-only cel', asepriteSource(84, 42, { cels: [{ type: 'linked', linkedFrame: 0 }] })],
    ['linked cel cycle', asepriteSource(84, 42, { cels: [{ type: 'linked', linkedFrame: 1 }, { type: 'linked', linkedFrame: 0 }] })],
    ['tilemap cel', asepriteSource(84, 42, { cels: [{ type: 'tilemap' }] })],
    ['undersized raw cel', asepriteSource(84, 42, { undersizedRaw: true })],
    ['corrupt compressed cel', asepriteSource(84, 42, { celType: 'compressed', corruptCompressed: true })],
  ];
  for (const [label, bytes] of invalidSources) {
    writeFileSync(sourceFile, bytes);
    const report = validateArtManifest(manifest, { marsRoot: root, approval: true });
    assert.ok(report.errors.some((issue) => issue.code === 'INVALID_EDITABLE_SOURCE'), label);
    const digests = artPackageDigests(manifest, { marsRoot: root });
    assert.equal(digests.complete, false, `${label} blocks package completion`);
    assert.equal(digests.editableSources[0].sha256, null, `${label} is not hashed`);
  }
});

test('PSD and KRA approval validates decompressed payload sizes and fails closed on corruption', (t) => {
  for (const extension of ['psd', 'kra']) {
    const root = tempRoot(t, `mars-art-${extension}-payload-`);
    const manifest = singleAssetManifest({ editableSource: `art/sources/terrain/base_soil.${extension}` });
    const { sourceFile } = writeValidPackage(root, manifest);
    const invalidSources = extension === 'psd'
      ? [
        ['undersized PSD raw channel', psdSource(84, 42, { undersizedRaw: true })],
        ['corrupt PSD RLE channel', psdSource(84, 42, { compression: 'rle', corruptCompressed: true })],
        ['corrupt PSD ZIP channel', psdSource(84, 42, { compression: 'zip', corruptCompressed: true })],
        ['corrupt PSD prediction ZIP channel', psdSource(84, 42, { compression: 'zipPrediction', corruptCompressed: true })],
      ]
      : [
        ['undersized KRA NONE tile', kraSource(84, 42, { undersizedRaw: true })],
        ['corrupt KRA LZF tile', kraSource(84, 42, { tileCompression: 'LZF', corruptLzf: true })],
        ['oversize KRA member', replaceCentralUncompressedSizes(kraSource(84, 42), [16 * 1024 * 1024 + 1])],
        ['oversize KRA aggregate', replaceCentralUncompressedSizes(kraSource(84, 42), [12 * 1024 * 1024, 12 * 1024 * 1024, 12 * 1024 * 1024])],
      ];
    for (const [label, bytes] of invalidSources) {
      writeFileSync(sourceFile, bytes);
      const report = validateArtManifest(manifest, { marsRoot: root, approval: true });
      assert.ok(report.errors.some((issue) => issue.code === 'INVALID_EDITABLE_SOURCE'), label);
      assert.equal(artPackageDigests(manifest, { marsRoot: root }).editableSources[0].sha256, null, `${label} is excluded from digests`);
    }
  }
});

test('Aseprite and PSD reject compact multi-payload aggregate decode expansion', (t) => {
  const asepritePixels = Buffer.alloc(2048 * 2048 * 4);
  const asepriteCompressed = deflateSync(asepritePixels);
  const psdChannel = psdPixelData(4096, 4096, 'zip');
  const sources = [
    ['aseprite', asepriteSource(84, 42, {
      cels: Array.from({ length: 3 }, () => ({
        type: 'compressed',
        width: 2048,
        height: 2048,
        encodedPayload: asepriteCompressed,
      })),
    })],
    ['psd', psdSource(84, 42, {
      layerWidth: 4096,
      layerHeight: 4096,
      channelCount: 3,
      channelData: psdChannel,
    })],
  ];
  for (const [extension, bytes] of sources) {
    const root = tempRoot(t, `mars-art-${extension}-aggregate-`);
    const manifest = singleAssetManifest({ editableSource: `art/sources/terrain/base_soil.${extension}` });
    const { sourceFile } = writeValidPackage(root, manifest);
    writeFileSync(sourceFile, bytes);
    const report = validateArtManifest(manifest, { marsRoot: root, approval: true });
    assert.ok(report.errors.some((issue) => issue.code === 'INVALID_EDITABLE_SOURCE' && /aggregate decoded-output/.test(issue.message)), extension);
    assert.equal(artPackageDigests(manifest, { marsRoot: root }).editableSources[0].sha256, null, `${extension} aggregate is excluded from digests`);
  }
});

test('KRA approval rejects fake XML structure and aggregate decoded tile expansion', (t) => {
  const root = tempRoot(t, 'mars-art-kra-structural-');
  const manifest = singleAssetManifest({ editableSource: 'art/sources/terrain/base_soil.kra' });
  const { sourceFile } = writeValidPackage(root, manifest);
  const image = '<IMAGE name="MarsScape" width="84" height="42">';
  const fakeLayer = '<layer name="Fake" nodetype="paintlayer" filename="layer1" />';
  const encodedEntity = kraSource(84, 42, {
    xml: '<?xml version="1.0"?><DOC><IMAGE name="MarsScape" width="84" height="42"><layers><layer name="Paint &lt; Layer" nodetype="paintlayer" filename="layer1" /></layers></IMAGE></DOC>',
  });
  writeFileSync(sourceFile, encodedEntity);
  assert.equal(validateArtManifest(manifest, { marsRoot: root, approval: true }).approvalReady, true, 'encoded predefined entity remains valid');
  const invalidSources = [
    ['comment-contained fake layer', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC>${image}<layers><!-- ${fakeLayer} --></layers></IMAGE></DOC>` })],
    ['malformed XML nesting', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC>${image}<layers>${fakeLayer}</IMAGE></layers></DOC>` })],
    ['unterminated final closing tag', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC>${image}<layers>${fakeLayer}</layers></IMAGE></DOC` })],
    ['duplicate IMAGE structure', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC>${image}<layers>${fakeLayer}</layers></IMAGE>${image}<layers>${fakeLayer}</layers></IMAGE></DOC>` })],
    ['DTD declaration', kraSource(84, 42, { xml: `<?xml version="1.0"?><!DOCTYPE DOC [<!ENTITY layer "${fakeLayer}">]><DOC>${image}<layers>&layer;</layers></IMAGE></DOC>` })],
    ['stray attribute ampersand', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC><IMAGE name="Mars&Scape" width="84" height="42"><layers>${fakeLayer}</layers></IMAGE></DOC>` })],
    ['unknown element-text entity', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC>${image}<layers>&bogus;${fakeLayer}</layers></IMAGE></DOC>` })],
    ['raw attribute less-than', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC><IMAGE name="Mars<Sc" width="84" height="42"><layers>${fakeLayer}</layers></IMAGE></DOC>` })],
    ['raw CDATA terminator in text', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC>${image}<layers>]]>${fakeLayer}</layers></IMAGE></DOC>` })],
    ['raw XML control character', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC>${image}<layers><layer name="Paint\u0001Layer" nodetype="paintlayer" filename="layer1" /></layers></IMAGE></DOC>` })],
    ['raw XML control character in text', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC>${image}<layers>\u0001${fakeLayer}</layers></IMAGE></DOC>` })],
    ['raw XML control character in comment', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC>${image}<layers><!-- \u0001 -->${fakeLayer}</layers></IMAGE></DOC>` })],
    ['raw XML control character in CDATA', kraSource(84, 42, { xml: `<?xml version="1.0"?><DOC>${image}<layers><![CDATA[\u0001]]>${fakeLayer}</layers></IMAGE></DOC>` })],
    ['aggregate NONE tile expansion', kraSource(84, 42, { tileCount: 4097, tileCompression: 'NONE' })],
    ['aggregate LZF tile expansion', kraSource(84, 42, { tileCount: 4097, tileCompression: 'LZF' })],
  ];
  for (const [label, bytes] of invalidSources) {
    writeFileSync(sourceFile, bytes);
    const report = validateArtManifest(manifest, { marsRoot: root, approval: true });
    const issue = report.errors.find((candidate) => candidate.code === 'INVALID_EDITABLE_SOURCE');
    assert.ok(issue, label);
    assert.equal(artPackageDigests(manifest, { marsRoot: root }).editableSources[0].sha256, null, `${label} is excluded from digests`);
  }
});

test('editable sources reject symlink escapes and oversize files before hashing', (t) => {
  const root = tempRoot(t, 'mars-art-source-containment-');
  const outside = tempRoot(t, 'mars-art-source-outside-');
  const manifest = singleAssetManifest();
  writeValidExport(root, manifest);
  const outsideSource = join(outside, 'terrain', 'base_soil.aseprite');
  mkdirSync(join(outsideSource, '..'), { recursive: true });
  writeFileSync(outsideSource, editableSource(manifest.assets[0]));
  mkdirSync(join(root, 'art'), { recursive: true });
  symlinkSync(outside, join(root, 'art', 'sources'));

  const escaped = validateArtManifest(manifest, { marsRoot: root, approval: true });
  assert.ok(escaped.errors.some((issue) => issue.code === 'INVALID_EDITABLE_SOURCE' && /symlink|outside/i.test(issue.message)));
  assert.equal(artPackageDigests(manifest, { marsRoot: root }).editableSources[0].sha256, null);

  rmSync(join(root, 'art', 'sources'));
  const sourceFile = join(root, manifest.assets[0].editableSource);
  mkdirSync(join(sourceFile, '..'), { recursive: true });
  symlinkSync(outsideSource, sourceFile);
  const linked = validateArtManifest(manifest, { marsRoot: root, approval: true });
  assert.ok(linked.errors.some((issue) => issue.code === 'INVALID_EDITABLE_SOURCE' && /symlink/i.test(issue.message)));
  assert.equal(artPackageDigests(manifest, { marsRoot: root }).editableSources[0].sha256, null);

  rmSync(sourceFile);
  writeFileSync(sourceFile, Buffer.from([0]));
  truncateSync(sourceFile, 32 * 1024 * 1024 + 1);
  const oversize = validateArtManifest(manifest, { marsRoot: root, approval: true });
  assert.ok(oversize.errors.some((issue) => issue.code === 'INVALID_EDITABLE_SOURCE' && /exceeds/i.test(issue.message)));
  const oversizeDigests = artPackageDigests(manifest, { marsRoot: root });
  assert.equal(oversizeDigests.complete, false);
  assert.equal(oversizeDigests.editableSources[0].sha256, null);
});

test('commissioned PNG validation rejects oversized headers and compact decompression bombs before approval', (t) => {
  const root = tempRoot(t, 'mars-art-png-limits-');
  const manifest = singleAssetManifest();
  const { exportFile } = writeValidPackage(root, manifest);
  const valid = rgbaPng(84, 42);
  const hostile = [
    ['oversized IHDR', craftedRgbaPng(0xffffffff, 0xffffffff, Buffer.from([0]))],
    ['compact deflate bomb', craftedRgbaPng(84, 42, Buffer.alloc(42 * (84 * 4 + 1) + 1))],
    ['flipped IHDR CRC', mutatePngChunk(valid, 'IHDR', (_data, png, crcOffset) => { png[crcOffset + 3] ^= 1; })],
    ['flipped IDAT CRC', mutatePngChunk(valid, 'IDAT', (_data, png, crcOffset) => { png[crcOffset + 3] ^= 1; })],
    ['nonzero compression method', mutatePngChunk(valid, 'IHDR', (data) => { data[10] = 1; }, true)],
    ['nonzero filter method', mutatePngChunk(valid, 'IHDR', (data) => { data[11] = 1; }, true)],
  ];
  for (const [label, bytes] of hostile) {
    writeFileSync(exportFile, bytes);
    const report = validateArtManifest(manifest, { marsRoot: root, approval: true });
    assert.ok(report.errors.some((issue) => ['INVALID_DIMENSIONS', 'INVALID_PNG'].includes(issue.code)), label);
    const digests = artPackageDigests(manifest, { marsRoot: root });
    assert.equal(digests.exports[0].sha256, null, `${label} is not hashed`);
    assert.equal(digests.complete, false, `${label} blocks package completion`);
    assert.equal(generateRuntimeIndex(manifest, { marsRoot: root }).assets.length, 0, `${label} is excluded from runtime index`);
  }
});

test('commissioned exports reject direct, intermediate, and export-root symlink escapes', (t) => {
  for (const kind of ['direct', 'intermediate', 'root']) {
    const root = tempRoot(t, `mars-art-export-${kind}-`);
    const outside = tempRoot(t, `mars-art-export-${kind}-outside-`);
    const manifest = singleAssetManifest();
    const { exportFile } = writeValidPackage(root, manifest);
    const relativeExport = assetPath('terrain', 'base_soil', 'active', 1);
    const outsideFile = join(outside, relativeExport);
    mkdirSync(join(outsideFile, '..'), { recursive: true });
    writeFileSync(outsideFile, rgbaPng(84, 42, [176, 96, 58, 255]));

    if (kind === 'direct') {
      rmSync(exportFile);
      symlinkSync(outsideFile, exportFile);
    } else if (kind === 'intermediate') {
      const sprites = join(root, manifest.exportRoot, 'sprites');
      rmSync(sprites, { recursive: true, force: true });
      symlinkSync(join(outside, 'sprites'), sprites);
    } else {
      const exportRoot = join(root, manifest.exportRoot);
      rmSync(exportRoot, { recursive: true, force: true });
      symlinkSync(outside, exportRoot);
    }

    const report = validateArtManifest(manifest, { marsRoot: root, approval: true });
    assert.ok(report.errors.some((issue) => issue.code === 'INVALID_EXPORT_PATH'), `${kind} symlink fails containment`);
    const digests = artPackageDigests(manifest, { marsRoot: root });
    assert.equal(digests.exports[0].sha256, null, `${kind} symlink bytes are not hashed`);
    assert.equal(digests.complete, false, `${kind} symlink blocks approval identity`);
    assert.equal(generateRuntimeIndex(manifest, { marsRoot: root }).assets.length, 0, `${kind} symlink is excluded from runtime index`);
  }
});

test('the paid artist gate validates only its explicit eight-export package', (t) => {
  const root = tempRoot(t, 'mars-art-paid-');
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

test('runtime index includes only valid frame-01-safe exports and detects drift', (t) => {
  const root = tempRoot(t, 'mars-art-index-');
  const manifest = singleAssetManifest({ states: [{ name: 'active', frames: 2, frameMs: 300 }] });
  writeValidPackage(root, manifest);
  const index = generateRuntimeIndex(manifest, { marsRoot: root });
  assert.equal(index.version, RUNTIME_INDEX_VERSION);
  assert.equal(index.runtimeIdentitySchema, RUNTIME_IDENTITY_SCHEMA);
  assert.equal(index.contractVersion, RENDER_CONTRACT.version);
  assert.equal(index.assets.length, 1);
  assert.equal(index.availableExports, 1);
  assert.equal(index.runtimeAssetHashes.full, index.runtimeAssetHash);
  assert.match(index.runtimeAssetHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(index.assets[0].anchor, { type: 'tile-centre', x: 0.5, y: 0.5 });
  assert.deepEqual(index.assets[0].screenOffset, { x: 0, y: 0 });
  assert.equal(index.assets[0].states.active.declaredFrames, 2);
  const frame = index.assets[0].states.active.frames[0];
  assert.deepEqual(Object.keys(frame), ['path', 'sha256']);
  assert.equal(frame.path, 'sprites/terrain/base_soil__active__f01.png');
  assert.match(frame.sha256, /^[a-f0-9]{64}$/);
  assert.equal(frame.sha256, artPackageDigests(manifest, { marsRoot: root }).exports[0].sha256);

  const indexPath = join(root, 'assets', 'commissioned', 'index.json');
  writeRuntimeIndex(manifest, indexPath, { marsRoot: root });
  assert.equal(verifyRuntimeIndex(manifest, indexPath, { marsRoot: root }).passed, true);
  writeFileSync(indexPath, '{}\n');
  assert.deepEqual(
    { passed: verifyRuntimeIndex(manifest, indexPath, { marsRoot: root }).passed, reason: verifyRuntimeIndex(manifest, indexPath, { marsRoot: root }).reason },
    { passed: false, reason: 'stale' },
  );
});

test('runtime and package identity bind render metadata while retaining exact frame-byte SHA-256', (t) => {
  const root = tempRoot(t, 'mars-art-metadata-identity-');
  const manifest = singleAssetManifest({
    artistTest: true,
    artistTestStates: ['active'],
    fallbackSprite: 'base_soil',
  });
  const { exportFile } = writeValidPackage(root, manifest);
  const indexPath = join(root, 'assets', 'commissioned', 'index.json');
  const reportDirectory = join(root, 'art', 'reports');
  const baselineIndex = writeRuntimeIndex(manifest, indexPath, { marsRoot: root });
  writeApprovalReports(manifest, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath });
  const baseline = artPackageDigests(manifest, { marsRoot: root, scope: 'artist-test' });
  const frameSha = baselineIndex.assets[0].states.active.frames[0].sha256;

  assert.equal(baseline.runtimeIdentitySchema, RUNTIME_IDENTITY_SCHEMA);
  assert.deepEqual(baselineIndex.assets[0], {
    family: 'terrain',
    id: 'base_soil',
    class: 'terrain',
    anchor: { type: 'tile-centre', x: 0.5, y: 0.5 },
    screenOffset: { x: 0, y: 0 },
    canvas: { width: 84, height: 42, scale: 1 },
    footprint: { width: 1, depth: 1, origin: 'centre' },
    fallback: 'procedural:terrain',
    fallbackSprite: 'base_soil',
    states: {
      active: {
        declaredFrames: 1,
        frameMs: 600,
        loop: false,
        frames: [{ path: 'sprites/terrain/base_soil__active__f01.png', sha256: frameSha }],
      },
    },
  });

  const metadataDrift = structuredClone(manifest);
  metadataDrift.assets[0].states[0].frameMs = 300;
  metadataDrift.assets[0].footprint = { width: 2, depth: 1, origin: 'centre' };
  metadataDrift.assets[0].fallback = 'procedural:rock';
  metadataDrift.assets[0].fallbackSprite = null;
  const driftedIndex = generateRuntimeIndex(metadataDrift, { marsRoot: root, scope: 'artist-test' });
  const drifted = artPackageDigests(metadataDrift, { marsRoot: root, scope: 'artist-test' });

  assert.equal(readFileSync(exportFile).length > 0, true);
  assert.equal(driftedIndex.assets[0].states.active.frames[0].sha256, frameSha);
  assert.equal(drifted.exports[0].sha256, baseline.exports[0].sha256);
  assert.notEqual(drifted.runtimeAssetHash, baseline.runtimeAssetHash);
  assert.notEqual(drifted.packageHash, baseline.packageHash);
  const staleIndex = verifyRuntimeIndex(metadataDrift, indexPath, { marsRoot: root });
  assert.equal(staleIndex.passed, false);
  assert.equal(staleIndex.reason, 'stale');
  assert.equal(verifyApprovalReports(metadataDrift, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath }).passed, false);
});

test('runtime index keeps paid-test byte identity scoped inside a larger package', (t) => {
  const root = tempRoot(t, 'mars-art-scoped-hash-');
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
    writeFileSync(sourceFile, editableSource(asset, { layerName: `${asset.id} layer` }));
  }
  const index = generateRuntimeIndex(manifest, { marsRoot: root });
  const paidDigests = artPackageDigests(manifest, { marsRoot: root, scope: 'artist-test' });
  const fullDigests = artPackageDigests(manifest, { marsRoot: root, scope: 'full' });
  assert.equal(index.runtimeAssetHashes['artist-test'], paidDigests.runtimeAssetHash);
  assert.equal(index.runtimeAssetHashes.full, fullDigests.runtimeAssetHash);
  assert.notEqual(index.runtimeAssetHashes['artist-test'], index.runtimeAssetHashes.full);
});

test('strict approval reports are deterministic and include runtime-index evidence', (t) => {
  const root = tempRoot(t, 'mars-art-approval-reports-');
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

test('package identity invalidates approval evidence when export or editable-source bytes change', (t) => {
  const root = tempRoot(t, 'mars-art-package-hash-');
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
  writeFileSync(sourceFile, editableSource(manifest.assets[0], { layerName: 'Changed Layer' }));
  const changedSource = artPackageDigests(manifest, { marsRoot: root, scope: 'artist-test' });
  assert.equal(changedSource.runtimeAssetHash, changedExport.runtimeAssetHash);
  assert.notEqual(changedSource.packageHash, changedExport.packageHash);
  assert.equal(verifyRuntimeIndex(manifest, indexPath, { marsRoot: root }).passed, true);
  assert.equal(verifyApprovalReports(manifest, reportDirectory, { marsRoot: root, runtimeIndexPath: indexPath }).passed, false);
});

test('invalid dimensions, transparency, and anchors fail clearly', (t) => {
  const dimensionRoot = tempRoot(t, 'mars-art-size-');
  const dimensionManifest = singleAssetManifest({ anchor: { type: 'feet', x: 0.5, y: 1 } });
  writeValidPackage(dimensionRoot, dimensionManifest, rgbaPng(83, 42));
  const dimensionReport = validateArtManifest(dimensionManifest, { marsRoot: dimensionRoot, approval: true });
  assert.ok(dimensionReport.errors.some((issue) => issue.code === 'INVALID_DIMENSIONS' && issue.message.includes('83x42')));
  assert.ok(dimensionReport.errors.some((issue) => issue.code === 'INVALID_ANCHOR'));

  const alphaRoot = tempRoot(t, 'mars-art-alpha-');
  const alphaManifest = singleAssetManifest();
  const opaque = rgbaPng(84, 42, [77, 184, 212, 255], false);
  writeValidPackage(alphaRoot, alphaManifest, opaque);
  assert.equal(decodePng(opaque).transparentPixels, 0);
  const alphaReport = validateArtManifest(alphaManifest, { marsRoot: alphaRoot, approval: true });
  assert.ok(alphaReport.errors.some((issue) => issue.code === 'INVALID_TRANSPARENCY'));
});

test('broken animation keeps frame 01 as the declared safe fallback', (t) => {
  const root = tempRoot(t, 'mars-art-animation-');
  const manifest = singleAssetManifest({ states: [{ name: 'active', frames: 4, frameMs: 150 }] });
  writeValidPackage(root, manifest);
  const report = validateArtManifest(manifest, { marsRoot: root });
  const broken = report.warnings.find((issue) => issue.code === 'BROKEN_ANIMATION');
  assert.ok(broken);
  assert.match(broken.response, /frame 01/i);
});

test('contact-sheet generation includes anchor, footprint, state, and fallback evidence', (t) => {
  const root = tempRoot(t, 'mars-art-sheet-');
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

test('PNG difference supports bounded full-page captures larger than commissioned sprite limits', () => {
  const width = 2050;
  const height = 2050;
  const decodedBytes = height * (width * 4 + 1);
  assert.ok(decodedBytes > 16 * 1024 * 1024);
  const screenshot = craftedRgbaPng(width, height, Buffer.alloc(decodedBytes));
  const result = pngDifference(screenshot, screenshot);
  assert.deepEqual(result, { compatible: true, width, height, changedPixels: 0, ratio: 0 });
});
