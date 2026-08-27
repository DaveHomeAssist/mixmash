import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { RENDER_CONTRACT, assetPath } from '../render-contract.mjs';
import { spriteHTML } from '../sprites.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MANIFEST_PATH = join(HERE, 'golden-slice.json');
export const DEFAULT_MARS_ROOT = dirname(HERE);
const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const FILE_PATTERN = /^sprites\/[a-z0-9]+(?:_[a-z0-9]+)*\/[a-z0-9]+(?:_[a-z0-9]+)*__[a-z0-9]+(?:_[a-z0-9]+)*__f\d{2}\.png$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function loadArtManifest(path = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
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
    for (const entry of readdirSync(directory)) {
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
  const errors = [];
  const warnings = [];
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  const expectedFiles = new Set();
  let presentExports = 0;
  let missingExports = 0;
  let editableSources = 0;

  if (manifest?.contractVersion !== RENDER_CONTRACT.version) {
    addIssue(errors, 'CONTRACT_VERSION', null, `Manifest contract ${manifest?.contractVersion} does not match renderer contract ${RENDER_CONTRACT.version}.`, 'Regenerate or migrate the manifest.');
  }
  if (manifest?.decision !== RENDER_CONTRACT.decision) {
    addIssue(errors, 'DECISION_LINK', null, `Manifest decision ${manifest?.decision || 'missing'} does not match ${RENDER_CONTRACT.decision}.`, 'Link the active renderer decision.');
  }
  if (!assets.length) addIssue(errors, 'EMPTY_MANIFEST', null, 'No art assets are declared.', 'Declare the golden vertical slice.');

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
      } else if (!expectedFiles.has(relativeFile)) {
        addIssue(warnings, 'UNLISTED_EXPORT', null, `${relativeFile} is not declared in the golden manifest.`, 'Declare it or remove it from the approval package.');
      }
    }
  }

  const expectedExports = expectedFiles.size;
  return {
    passed: errors.length === 0,
    approval,
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
  const anchor = expectedAnchor(spriteClass);
  return `<div class="preview">
      <svg class="footprint" viewBox="0 0 84 42" aria-hidden="true"><path d="M42 1 83 21 42 41 1 21Z" /></svg>
      <div class="asset-box" style="width:${spriteClass.canvasWidth * spriteClass.scale}px;height:${spriteClass.canvasHeight * spriteClass.scale}px;--anchor-x:${anchor.x * 100}%;--anchor-y:${anchor.y * 100}%">
        ${image}
        <span class="anchor" title="${escapeHtml(anchor.type)} anchor"></span>
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
      <p>Footprint ${asset.footprint.width}x${asset.footprint.depth} from ${escapeHtml(asset.footprint.origin)}</p>
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
    .preview { position:relative; display:grid; place-items:center; height:150px; overflow:hidden; background:linear-gradient(160deg,#1d3a44,#6b4a33); image-rendering:pixelated; }
    .asset-box { position:relative; z-index:2; display:grid; place-items:center; }
    .preview img, .fallback { position:relative; z-index:2; max-width:100%; max-height:100%; image-rendering:pixelated; }
    .footprint { position:absolute; z-index:1; width:84px; height:42px; opacity:.75; }
    .footprint path { fill:#4db8d422; stroke:#9fe0f0; stroke-width:2; stroke-dasharray:4 3; }
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
  const manifest = loadArtManifest(manifestPath);
  const report = validateArtManifest(manifest, { marsRoot, approval });
  const contactSheet = optionValue(args, '--contact-sheet');
  if (contactSheet) generateContactSheet(manifest, resolve(contactSheet), { marsRoot, report });
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`MarsScape art validation: ${report.passed ? 'PASS' : 'FAIL'}`);
    console.log(JSON.stringify(report.counts));
    printIssues('Errors', report.errors);
    printIssues('Warnings', report.warnings);
    if (contactSheet) console.log(`Contact sheet: ${resolve(contactSheet)}`);
  }
  if (!report.passed) process.exitCode = 1;
}
