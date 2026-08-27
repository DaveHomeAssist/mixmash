import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { RENDER_CONTRACT, assetPath, footprintCornersFromCenter } from '../render-contract.mjs';
import { spriteHTML } from '../sprites.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MANIFEST_PATH = join(HERE, 'golden-slice.json');
export const DEFAULT_MARS_ROOT = dirname(HERE);
export const DEFAULT_RUNTIME_INDEX_PATH = join(DEFAULT_MARS_ROOT, 'assets', 'commissioned', 'index.json');
export const APPROVAL_REPORT_FILENAMES = Object.freeze({
  'artist-test': 'artist-test-approval.json',
  full: 'golden-approval.json',
});
export const ART_SCOPES = Object.freeze(['full', 'artist-test']);
const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const FILE_PATTERN = /^sprites\/[a-z0-9]+(?:_[a-z0-9]+)*\/[a-z0-9]+(?:_[a-z0-9]+)*__[a-z0-9]+(?:_[a-z0-9]+)*__f\d{2}\.png$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function loadArtManifest(path = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function artManifestHash(manifest) {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

function fileSha256(path) {
  if (!path || !existsSync(path) || !statSync(path).isFile()) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function digestEntries(entries) {
  const sorted = [...entries].sort((left, right) => left.path.localeCompare(right.path));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

export function artPackageDigests(manifest, options = {}) {
  const marsRoot = resolve(options.marsRoot || DEFAULT_MARS_ROOT);
  const scope = options.scope || 'full';
  const exportRoot = safePath(marsRoot, manifest?.exportRoot);
  const exports = [];
  const editableSources = [];

  for (const asset of selectAssets(manifest, scope)) {
    for (const state of asset.states || []) {
      if (!Number.isInteger(state.frames) || state.frames < 1) continue;
      for (let frame = 1; frame <= state.frames; frame += 1) {
        const path = assetPath(asset.family, asset.id, state.name, frame);
        const file = exportRoot ? safePath(exportRoot, path) : null;
        exports.push({ path, sha256: fileSha256(file) });
      }
    }
    const path = asset.editableSource || '';
    const extension = extname(path).slice(1).toLowerCase();
    const file = RENDER_CONTRACT.export.editableExtensions.includes(extension) ? safePath(marsRoot, path) : null;
    editableSources.push({ path, sha256: fileSha256(file) });
  }

  exports.sort((left, right) => left.path.localeCompare(right.path));
  editableSources.sort((left, right) => left.path.localeCompare(right.path));
  const runtimeAssetHash = digestEntries(exports);
  const packageHash = createHash('sha256')
    .update(JSON.stringify({ exports, editableSources }))
    .digest('hex');
  return {
    algorithm: 'SHA-256',
    scope,
    complete: exports.length > 0
      && editableSources.length > 0
      && exports.every((entry) => entry.sha256)
      && editableSources.every((entry) => entry.sha256),
    runtimeAssetHash,
    packageHash,
    exports,
    editableSources,
  };
}

function selectAssets(manifest, scope = 'full') {
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  if (scope === 'full') return assets;
  if (scope !== 'artist-test') return [];
  return assets
    .filter((asset) => asset.artistTest)
    .map((asset) => {
      const names = new Set(Array.isArray(asset.artistTestStates) ? asset.artistTestStates : []);
      return { ...asset, states: asset.states.filter((state) => names.has(state.name)) };
    });
}

function allDeclaredExports(manifest) {
  return new Set((manifest?.assets || []).flatMap((asset) => (asset.states || []).flatMap((state) => (
    Number.isInteger(state.frames)
      ? Array.from({ length: state.frames }, (_, index) => assetPath(asset.family, asset.id, state.name, index + 1))
      : []
  ))));
}

function safePath(root, value) {
  if (typeof value !== 'string' || !value || isAbsolute(value)) return null;
  const target = resolve(root, value);
  return target === root || target.startsWith(`${root}${sep}`) ? target : null;
}

function addIssue(target, code, asset, message, response) {
  target.push({ code, asset: asset ? `${asset.family}:${asset.id}` : null, message, response });
}

function expectedAnchor(spriteClass) {
  if (spriteClass.anchor === 'feet') return { type: 'feet', x: 0.5, y: 1 };
  return { type: spriteClass.anchor, x: 0.5, y: 0.5 };
}

function matchesAnchor(actual, expected) {
  if (!actual) return true;
  return actual.type === expected.type && actual.x === expected.x && actual.y === expected.y;
}

function listPngFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) visit(path);
      else if (stats.isFile() && extname(entry).toLowerCase() === '.png') files.push(path);
    }
  };
  visit(root);
  return files;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Not a PNG file');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const idat = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error(`Truncated PNG chunk ${type}`);
    const data = buffer.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!width || !height || !idat.length) throw new Error('PNG is missing IHDR or IDAT data');
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`Expected non-interlaced 8-bit RGBA PNG; received bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }

  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idat));
  const expectedLength = height * (rowBytes + 1);
  if (inflated.length !== expectedLength) throw new Error(`Unexpected PNG data length ${inflated.length}; expected ${expectedLength}`);

  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowOffset = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[rowOffset + x - rowBytes] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[rowOffset + x - rowBytes - bytesPerPixel] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + above;
      else if (filter === 3) value = raw + Math.floor((left + above) / 2);
      else if (filter === 4) value = raw + paeth(left, above, upperLeft);
      else throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[rowOffset + x] = value & 255;
    }
    sourceOffset += rowBytes;
  }

  let transparentPixels = 0;
  let visiblePixels = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) transparentPixels += 1;
    if (pixels[index] > 0) visiblePixels += 1;
  }

  return { width, height, bitDepth, colorType, pixels, transparentPixels, visiblePixels };
}

export function pngDifference(leftBuffer, rightBuffer) {
  const left = decodePng(leftBuffer);
  const right = decodePng(rightBuffer);
  if (left.width !== right.width || left.height !== right.height) {
    return { compatible: false, width: [left.width, right.width], height: [left.height, right.height], changedPixels: null, ratio: 1 };
  }
  let changedPixels = 0;
  const pixelCount = left.width * left.height;
  for (let index = 0; index < left.pixels.length; index += 4) {
    if (
      left.pixels[index] !== right.pixels[index]
      || left.pixels[index + 1] !== right.pixels[index + 1]
      || left.pixels[index + 2] !== right.pixels[index + 2]
      || left.pixels[index + 3] !== right.pixels[index + 3]
    ) changedPixels += 1;
  }
  return { compatible: true, width: left.width, height: left.height, changedPixels, ratio: changedPixels / pixelCount };
}

export function validateArtManifest(manifest, options = {}) {
  const marsRoot = resolve(options.marsRoot || DEFAULT_MARS_ROOT);
  const approval = !!options.approval;
  const scope = options.scope || 'full';
  const errors = [];
  const warnings = [];
  const assets = selectAssets(manifest, scope);
  const expectedFiles = new Set();
  const declaredFiles = allDeclaredExports(manifest);
  let presentExports = 0;
  let missingExports = 0;
  let editableSources = 0;

  if (!ART_SCOPES.includes(scope)) {
    addIssue(errors, 'INVALID_SCOPE', null, `Unknown validation scope ${scope}.`, `Use one of: ${ART_SCOPES.join(', ')}.`);
  }

  if (manifest?.contractVersion !== RENDER_CONTRACT.version) {
    addIssue(errors, 'CONTRACT_VERSION', null, `Manifest contract ${manifest?.contractVersion} does not match renderer contract ${RENDER_CONTRACT.version}.`, 'Regenerate or migrate the manifest.');
  }
  if (manifest?.decision !== RENDER_CONTRACT.decision) {
    addIssue(errors, 'DECISION_LINK', null, `Manifest decision ${manifest?.decision || 'missing'} does not match ${RENDER_CONTRACT.decision}.`, 'Link the active renderer decision.');
  }
  if (!assets.length) addIssue(errors, 'EMPTY_MANIFEST', null, `No art assets are declared for scope ${scope}.`, 'Declare the required assets and state subset.');

  const exportRoot = safePath(marsRoot, manifest?.exportRoot);
  if (!exportRoot) addIssue(errors, 'EXPORT_ROOT', null, 'exportRoot must be a safe relative path.', 'Use a path beneath mars/.');

  for (const asset of assets) {
    if (!ID_PATTERN.test(asset?.family || '') || !ID_PATTERN.test(asset?.id || '')) {
      addIssue(errors, 'INVALID_ID', asset, 'Family and id must use lowercase snake_case.', 'Rename the asset and every export.');
      continue;
    }
    const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
    if (!spriteClass) {
      addIssue(errors, 'INVALID_CLASS', asset, `Unknown sprite class ${asset.class}.`, 'Use a class from render-contract.mjs.');
      continue;
    }

    const anchor = expectedAnchor(spriteClass);
    if (!matchesAnchor(asset.anchor, anchor)) {
      addIssue(errors, 'INVALID_ANCHOR', asset, `Anchor ${JSON.stringify(asset.anchor)} does not match ${JSON.stringify(anchor)}.`, 'Flag footprint mismatch and block approval.');
    }

    const footprint = asset.footprint;
    if (
      !footprint
      || !Number.isInteger(footprint.width)
      || !Number.isInteger(footprint.depth)
      || footprint.width < 1
      || footprint.depth < 1
      || footprint.origin !== 'centre'
    ) {
      addIssue(errors, 'INVALID_FOOTPRINT', asset, `Footprint ${JSON.stringify(footprint)} is invalid.`, 'Use positive integer cells with centre origin and review the overlay.');
    }

    const states = Array.isArray(asset.states) ? asset.states : [];
    if (!states.length) addIssue(errors, 'MISSING_STATES', asset, 'No states are declared.', 'Declare at least the active state.');
    for (const state of states) {
      if (!RENDER_CONTRACT.states.includes(state?.name)) {
        addIssue(errors, 'INVALID_STATE', asset, `Unknown state ${state?.name}.`, 'Use a canonical state name.');
        continue;
      }
      if (!Number.isInteger(state.frames) || state.frames < 1 || state.frames > 99) {
        addIssue(errors, 'INVALID_FRAMES', asset, `Frame count ${state.frames} is invalid for ${state.name}.`, 'Use one to 99 frames.');
        continue;
      }
      if (!RENDER_CONTRACT.animation.allowedFrameMs.includes(state.frameMs)) {
        addIssue(errors, 'INVALID_TIMING', asset, `Frame time ${state.frameMs}ms is not allowed for ${state.name}.`, `Use ${RENDER_CONTRACT.animation.allowedFrameMs.join(', ')}ms.`);
      }

      let firstFramePresent = false;
      let missingInClip = 0;
      for (let frame = 1; frame <= state.frames; frame += 1) {
        const relativeExport = assetPath(asset.family, asset.id, state.name, frame);
        expectedFiles.add(relativeExport);
        const file = exportRoot ? safePath(exportRoot, relativeExport) : null;
        if (!file || !existsSync(file)) {
          missingExports += 1;
          missingInClip += 1;
          const target = approval ? errors : warnings;
          addIssue(target, 'MISSING_SPRITE', asset, `${relativeExport} is missing.`, `Render ${asset.fallback || 'procedural or emoji fallback'} and log a warning.`);
          continue;
        }

        presentExports += 1;
        if (frame === 1) firstFramePresent = true;
        try {
          const png = decodePng(readFileSync(file));
          if (png.width !== spriteClass.canvasWidth || png.height !== spriteClass.canvasHeight) {
            addIssue(errors, 'INVALID_DIMENSIONS', asset, `${relativeExport} is ${png.width}x${png.height}; expected ${spriteClass.canvasWidth}x${spriteClass.canvasHeight}.`, 'Fail validation and re-export without scaling or cropping.');
          }
          if (!png.transparentPixels || !png.visiblePixels) {
            addIssue(errors, 'INVALID_TRANSPARENCY', asset, `${relativeExport} must contain visible pixels and transparent pixels.`, 'Export straight-alpha RGBA on a transparent background.');
          }
        } catch (error) {
          addIssue(errors, 'INVALID_PNG', asset, `${relativeExport}: ${error.message}`, 'Export a non-interlaced 8-bit RGBA PNG.');
        }
      }

      if (state.frames > 1 && missingInClip > 0) {
        const target = approval ? errors : warnings;
        addIssue(
          target,
          'BROKEN_ANIMATION',
          asset,
          `${state.name} is missing ${missingInClip} of ${state.frames} frames.`,
          firstFramePresent ? 'Load static frame 01 safely and report the broken clip.' : `Use ${asset.fallback || 'procedural fallback'} because frame 01 is absent.`,
        );
      }
    }

    const source = safePath(marsRoot, asset.editableSource);
    const extension = extname(asset.editableSource || '').slice(1).toLowerCase();
    const sourceValid = source && RENDER_CONTRACT.export.editableExtensions.includes(extension) && existsSync(source);
    if (sourceValid) editableSources += 1;
    else {
      const target = approval ? errors : warnings;
      addIssue(target, 'MISSING_EDITABLE_SOURCE', asset, `${asset.editableSource || 'Editable source path'} is missing or unsupported.`, 'Block final asset approval.');
    }
  }

  if (exportRoot) {
    for (const file of listPngFiles(exportRoot)) {
      const relativeFile = relative(exportRoot, file).split(sep).join('/');
      if (!FILE_PATTERN.test(relativeFile)) {
        addIssue(errors, 'INVALID_FILENAME', null, `${relativeFile} does not match the naming contract.`, 'Rename to family/id__state__fNN.png.');
      } else if (!expectedFiles.has(relativeFile) && !declaredFiles.has(relativeFile)) {
        addIssue(warnings, 'UNLISTED_EXPORT', null, `${relativeFile} is not declared in the golden manifest.`, 'Declare it or remove it from the approval package.');
      }
    }
  }

  const expectedExports = expectedFiles.size;
  return {
    passed: errors.length === 0,
    approval,
    scope,
    contractVersion: RENDER_CONTRACT.version,
    decision: RENDER_CONTRACT.decision,
    manifestHash: artManifestHash(manifest),
    approvalReady: approval && errors.length === 0 && warnings.length === 0,
    counts: {
      assets: assets.length,
      expectedExports,
      presentExports,
      missingExports,
      editableSources,
      errors: errors.length,
      warnings: warnings.length,
    },
    errors,
    warnings,
  };
}

function runtimeLoop(asset, state) {
  if (state.frames <= 1) return false;
  if (asset.class === 'effect' || state.name === 'damaged') return false;
  return true;
}

function validRuntimeFrame(file, spriteClass) {
  if (!file || !existsSync(file)) return false;
  try {
    const png = decodePng(readFileSync(file));
    return png.width === spriteClass.canvasWidth
      && png.height === spriteClass.canvasHeight
      && png.transparentPixels > 0
      && png.visiblePixels > 0;
  } catch {
    return false;
  }
}

export function generateRuntimeIndex(manifest, options = {}) {
  const marsRoot = resolve(options.marsRoot || DEFAULT_MARS_ROOT);
  const scope = options.scope || 'full';
  const exportRoot = safePath(marsRoot, manifest?.exportRoot);
  const assets = [];
  const runtimeFiles = [];
  const artistTestRuntimeFiles = [];
  let availableExports = 0;

  if (exportRoot && ART_SCOPES.includes(scope)) {
    for (const asset of selectAssets(manifest, scope)) {
      const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
      if (!spriteClass) continue;
      const states = {};
      for (const state of asset.states || []) {
        if (!RENDER_CONTRACT.states.includes(state.name) || !Number.isInteger(state.frames) || state.frames < 1) continue;
        const frames = [];
        const frameEntries = [];
        for (let frame = 1; frame <= state.frames; frame += 1) {
          const relativeExport = assetPath(asset.family, asset.id, state.name, frame);
          const file = safePath(exportRoot, relativeExport);
          if (validRuntimeFrame(file, spriteClass)) {
            frames.push(relativeExport);
            frameEntries.push({ path: relativeExport, sha256: fileSha256(file) });
          }
        }
        // Frame 01 is the only safe broken-clip fallback. Never index a later
        // frame when the first frame is absent or invalid.
        const firstFrame = assetPath(asset.family, asset.id, state.name, 1);
        if (frames[0] !== firstFrame) continue;
        runtimeFiles.push(...frameEntries);
        if (asset.artistTest && (asset.artistTestStates || []).includes(state.name)) {
          artistTestRuntimeFiles.push(...frameEntries);
        }
        availableExports += frames.length;
        states[state.name] = {
          declaredFrames: state.frames,
          frameMs: state.frameMs,
          loop: runtimeLoop(asset, state),
          frames,
        };
      }
      if (!Object.keys(states).length) continue;
      assets.push({
        family: asset.family,
        id: asset.id,
        class: asset.class,
        anchor: expectedAnchor(spriteClass),
        screenOffset: { x: spriteClass.screenOffsetX || 0, y: spriteClass.screenOffsetY || 0 },
        canvas: { width: spriteClass.canvasWidth, height: spriteClass.canvasHeight, scale: spriteClass.scale },
        footprint: asset.footprint,
        fallback: asset.fallback || null,
        fallbackSprite: asset.fallbackSprite || null,
        states,
      });
    }
  }

  return {
    version: 1,
    contractVersion: RENDER_CONTRACT.version,
    decision: RENDER_CONTRACT.decision,
    scope,
    manifestHash: artManifestHash(manifest),
    runtimeAssetHash: digestEntries(runtimeFiles),
    runtimeAssetHashes: {
      full: digestEntries(runtimeFiles),
      'artist-test': digestEntries(artistTestRuntimeFiles),
    },
    availableExports,
    assets,
  };
}

export function serializeRuntimeIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function writeRuntimeIndex(manifest, outputPath = DEFAULT_RUNTIME_INDEX_PATH, options = {}) {
  const index = generateRuntimeIndex(manifest, options);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serializeRuntimeIndex(index));
  return index;
}

export function verifyRuntimeIndex(manifest, indexPath = DEFAULT_RUNTIME_INDEX_PATH, options = {}) {
  const expected = serializeRuntimeIndex(generateRuntimeIndex(manifest, options));
  if (!existsSync(indexPath)) {
    return { passed: false, reason: 'missing', expected, actual: null };
  }
  const actual = readFileSync(indexPath, 'utf8');
  return { passed: actual === expected, reason: actual === expected ? null : 'stale', expected, actual };
}

function conciseIndexVerification(verification) {
  return verification
    ? { passed: verification.passed === true, reason: verification.reason || null }
    : undefined;
}

export function reportDocument(report, options = {}) {
  const runtimeIndex = options.runtimeIndex;
  const indexVerification = conciseIndexVerification(options.indexVerification);
  const artifactDigests = options.artifactDigests;
  const machineReady = report.approval === true
    && report.approvalReady === true
    && indexVerification?.passed === true
    && artifactDigests?.complete === true;
  return {
    reportVersion: 1,
    ...report,
    machineReady,
    ...(artifactDigests ? { artifactDigests } : {}),
    ...(runtimeIndex ? { runtimeIndex: { assets: runtimeIndex.assets.length, availableExports: runtimeIndex.availableExports } } : {}),
    ...(indexVerification ? { indexVerification } : {}),
  };
}

export function serializeReportDocument(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function buildApprovalReportDocuments(manifest, options = {}) {
  const marsRoot = resolve(options.marsRoot || DEFAULT_MARS_ROOT);
  const runtimeIndexPath = resolve(options.runtimeIndexPath || join(marsRoot, 'assets', 'commissioned', 'index.json'));
  const indexVerification = options.indexVerification || verifyRuntimeIndex(manifest, runtimeIndexPath, { marsRoot, scope: 'full' });
  const documents = {};
  for (const scope of ['artist-test', 'full']) {
    documents[scope] = reportDocument(
      validateArtManifest(manifest, { marsRoot, approval: true, scope }),
      { indexVerification, artifactDigests: artPackageDigests(manifest, { marsRoot, scope }) },
    );
  }
  return documents;
}

export function writeApprovalReports(manifest, outputDirectory, options = {}) {
  const documents = buildApprovalReportDocuments(manifest, options);
  mkdirSync(outputDirectory, { recursive: true });
  for (const [scope, filename] of Object.entries(APPROVAL_REPORT_FILENAMES)) {
    writeFileSync(join(outputDirectory, filename), serializeReportDocument(documents[scope]));
  }
  return documents;
}

export function verifyApprovalReports(manifest, outputDirectory, options = {}) {
  const documents = buildApprovalReportDocuments(manifest, options);
  const reports = {};
  let passed = true;
  for (const [scope, filename] of Object.entries(APPROVAL_REPORT_FILENAMES)) {
    const path = join(outputDirectory, filename);
    const expected = serializeReportDocument(documents[scope]);
    const actual = existsSync(path) ? readFileSync(path, 'utf8') : null;
    const current = actual === expected;
    reports[scope] = { passed: current, reason: actual === null ? 'missing' : current ? null : 'stale' };
    if (!current) passed = false;
  }
  return { passed, reports };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function firstExpectedExport(asset) {
  const preferred = asset.states.find((state) => state.name === 'active') || asset.states[0];
  return assetPath(asset.family, asset.id, preferred.name, 1);
}

function contactGeometry(asset, spriteClass) {
  const center = { x: 130, y: 112 };
  const corners = footprintCornersFromCenter(0, 0, asset.footprint.width, asset.footprint.depth);
  const points = ['north', 'east', 'south', 'west']
    .map((key) => `${center.x + corners[key].x},${center.y + corners[key].y}`)
    .join(' ');
  const anchor = expectedAnchor(spriteClass);
  const screenOffset = {
    x: spriteClass.screenOffsetX || 0,
    y: spriteClass.screenOffsetY || 0,
  };
  return { center, points, anchor, screenOffset };
}

function previewMarkup(asset, manifest, marsRoot, outputDirectory) {
  const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
  const expected = firstExpectedExport(asset);
  const root = safePath(marsRoot, manifest.exportRoot);
  const file = root && safePath(root, expected);
  const image = file && existsSync(file)
    ? `<img src="${escapeHtml(relative(outputDirectory, file).split(sep).join('/'))}" alt="" />`
    : asset.fallbackSprite
      ? `<div class="fallback">${spriteHTML(asset.fallbackSprite, 3)}</div>`
      : '<div class="missing">PROCEDURAL<br />FALLBACK</div>';
  const geometry = contactGeometry(asset, spriteClass);
  return `<div class="preview">
      <svg class="footprint" viewBox="0 0 260 190" aria-hidden="true">
        <polygon points="${geometry.points}" />
        <line class="offset-line" x1="${geometry.center.x}" y1="${geometry.center.y}" x2="${geometry.center.x + geometry.screenOffset.x}" y2="${geometry.center.y + geometry.screenOffset.y}" />
        <circle class="ground-point" cx="${geometry.center.x}" cy="${geometry.center.y}" r="4" />
      </svg>
      <div class="asset-box" style="width:${spriteClass.canvasWidth * spriteClass.scale}px;height:${spriteClass.canvasHeight * spriteClass.scale}px;left:${geometry.center.x + geometry.screenOffset.x}px;top:${geometry.center.y + geometry.screenOffset.y}px;--anchor-x:${geometry.anchor.x * 100}%;--anchor-y:${geometry.anchor.y * 100}%;--anchor-shift-x:${-geometry.anchor.x * 100}%;--anchor-shift-y:${-geometry.anchor.y * 100}%">
        ${image}
        <span class="anchor" title="${escapeHtml(geometry.anchor.type)} anchor"></span>
      </div>
    </div>`;
}

export function generateContactSheet(manifest, outputPath, options = {}) {
  const marsRoot = resolve(options.marsRoot || DEFAULT_MARS_ROOT);
  const report = options.report || validateArtManifest(manifest, { marsRoot });
  const outputDirectory = dirname(outputPath);
  const cards = manifest.assets.map((asset) => {
    const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
    const states = asset.states.map((state) => `${state.name} ${state.frames}f/${state.frameMs}ms`).join(' | ');
    return `<article>
      <header><span>${escapeHtml(asset.category)}</span><strong>${escapeHtml(asset.id)}</strong></header>
      ${previewMarkup(asset, manifest, marsRoot, outputDirectory)}
      <p>${spriteClass.canvasWidth}x${spriteClass.canvasHeight} source | ${spriteClass.scale}x gameplay | ${escapeHtml(spriteClass.anchor)}</p>
      <p>Footprint ${asset.footprint.width}x${asset.footprint.depth} from ${escapeHtml(asset.footprint.origin)} | ground offset (${spriteClass.screenOffsetX || 0},${spriteClass.screenOffsetY || 0})</p>
      <small>${escapeHtml(states)}</small>
      <code>${escapeHtml(firstExpectedExport(asset))}</code>
    </article>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MarsScape DEC-79 Golden Contact Sheet</title>
  <style>
    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background:#15100d; color:#f2ede6; }
    body { margin:0; padding:24px; }
    h1 { margin:0 0 8px; }
    .summary { color:#c4bcab; margin:0 0 24px; }
    main { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; }
    article { min-width:0; padding:14px; border:1px solid #6b4a33; background:#211812; }
    header { display:flex; justify-content:space-between; gap:12px; margin-bottom:12px; color:#9fe0f0; }
    header strong { color:#f2ede6; }
    .preview { position:relative; height:190px; overflow:hidden; background:linear-gradient(160deg,#1d3a44,#6b4a33); image-rendering:pixelated; }
    .asset-box { position:absolute; z-index:2; display:grid; place-items:center; transform:translate(var(--anchor-shift-x),var(--anchor-shift-y)); }
    .preview img, .fallback { position:relative; z-index:2; max-width:100%; max-height:100%; image-rendering:pixelated; }
    .footprint { position:absolute; inset:0; z-index:1; width:100%; height:100%; opacity:.84; }
    .footprint polygon { fill:#4db8d422; stroke:#9fe0f0; stroke-width:2; stroke-dasharray:4 3; }
    .footprint .offset-line { stroke:#f0d488; stroke-width:2; }
    .footprint .ground-point { fill:#15100d; stroke:#9fe0f0; stroke-width:2; }
    .anchor { position:absolute; z-index:3; left:var(--anchor-x); top:var(--anchor-y); width:12px; height:12px; border:2px solid #f0d488; border-radius:50%; transform:translate(-50%,-50%); }
    .anchor::before, .anchor::after { content:""; position:absolute; background:#f0d488; }
    .anchor::before { width:18px; height:1px; left:-3px; top:5px; }
    .anchor::after { width:1px; height:18px; left:5px; top:-3px; }
    .missing { position:relative; z-index:2; padding:8px; border:1px solid #d7a74c; color:#f0d488; text-align:center; }
    p, small, code { display:block; overflow-wrap:anywhere; }
    p { margin:10px 0 0; color:#c4bcab; font-size:12px; }
    small { margin-top:8px; color:#9fe0f0; }
    code { margin-top:8px; color:#f2b285; font-size:11px; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none!important; transition:none!important; } }
  </style>
</head>
<body>
  <h1>MarsScape DEC-79 Golden Contact Sheet</h1>
  <p class="summary">Contract v${manifest.contractVersion} | ${report.counts.assets} assets | ${report.counts.presentExports}/${report.counts.expectedExports} exports present | ${report.counts.missingExports} procedural fallbacks expected</p>
  <main>${cards}</main>
</body>
</html>`;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html);
  return { outputPath, bytes: Buffer.byteLength(html), cards: manifest.assets.length };
}

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function printIssues(label, issues) {
  if (!issues.length) return;
  console.log(`${label} (${issues.length})`);
  for (const issue of issues.slice(0, 20)) {
    console.log(`- ${issue.code}${issue.asset ? ` ${issue.asset}` : ''}: ${issue.message} Response: ${issue.response}`);
  }
  if (issues.length > 20) console.log(`- ... ${issues.length - 20} more`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const manifestPath = resolve(optionValue(args, '--manifest', DEFAULT_MANIFEST_PATH));
  const marsRoot = resolve(optionValue(args, '--mars-root', DEFAULT_MARS_ROOT));
  const approval = args.includes('--approval');
  const scope = optionValue(args, '--scope', 'full');
  const manifest = loadArtManifest(manifestPath);
  const report = validateArtManifest(manifest, { marsRoot, approval, scope });
  const contactSheet = optionValue(args, '--contact-sheet');
  if (contactSheet) generateContactSheet(manifest, resolve(contactSheet), { marsRoot, report });
  const runtimeIndexPath = optionValue(args, '--runtime-index');
  let runtimeIndex = null;
  if (runtimeIndexPath) runtimeIndex = writeRuntimeIndex(manifest, resolve(runtimeIndexPath), { marsRoot, scope: 'full' });
  const verifyIndexPath = optionValue(args, '--verify-runtime-index');
  const indexVerification = verifyIndexPath
    ? verifyRuntimeIndex(manifest, resolve(verifyIndexPath), { marsRoot, scope: 'full' })
    : null;
  const approvalReportsPath = optionValue(args, '--approval-reports');
  const approvalReports = approvalReportsPath
    ? writeApprovalReports(manifest, resolve(approvalReportsPath), {
      marsRoot,
      runtimeIndexPath: verifyIndexPath ? resolve(verifyIndexPath) : join(marsRoot, 'assets', 'commissioned', 'index.json'),
      indexVerification,
    })
    : null;
  const verifyApprovalReportsPath = optionValue(args, '--verify-approval-reports');
  const approvalReportVerification = verifyApprovalReportsPath
    ? verifyApprovalReports(manifest, resolve(verifyApprovalReportsPath), {
      marsRoot,
      runtimeIndexPath: verifyIndexPath ? resolve(verifyIndexPath) : join(marsRoot, 'assets', 'commissioned', 'index.json'),
      indexVerification,
    })
    : null;
  const reportPath = optionValue(args, '--report');
  if (reportPath) {
    const output = resolve(reportPath);
    mkdirSync(dirname(output), { recursive: true });
    const artifactDigests = approval ? artPackageDigests(manifest, { marsRoot, scope }) : null;
    writeFileSync(output, serializeReportDocument(reportDocument(report, { runtimeIndex, indexVerification, artifactDigests })));
  }
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`MarsScape art validation: ${report.passed ? 'PASS' : 'FAIL'}`);
    console.log(`Scope: ${scope}; contract v${report.contractVersion}; manifest ${report.manifestHash.slice(0, 12)}`);
    console.log(JSON.stringify(report.counts));
    printIssues('Errors', report.errors);
    printIssues('Warnings', report.warnings);
    if (contactSheet) console.log(`Contact sheet: ${resolve(contactSheet)}`);
    if (runtimeIndexPath) console.log(`Runtime index: ${resolve(runtimeIndexPath)} (${runtimeIndex.assets.length} assets; ${runtimeIndex.availableExports} exports)`);
    if (indexVerification) console.log(`Runtime index verification: ${indexVerification.passed ? 'PASS' : `FAIL (${indexVerification.reason})`}`);
    if (approvalReportsPath) console.log(`Approval reports: ${resolve(approvalReportsPath)} (${Object.keys(approvalReports).length} scopes)`);
    if (approvalReportVerification) console.log(`Approval report verification: ${approvalReportVerification.passed ? 'PASS' : 'FAIL'}`);
    if (reportPath) console.log(`Report: ${resolve(reportPath)}`);
  }
  if (
    !report.passed
    || (approval && !report.approvalReady)
    || (indexVerification && !indexVerification.passed)
    || (approvalReportVerification && !approvalReportVerification.passed)
  ) process.exitCode = 1;
}
