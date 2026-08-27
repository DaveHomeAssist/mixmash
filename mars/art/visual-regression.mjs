import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  COMMISSIONED_INDEX_VERSION,
  COMMISSIONED_RUNTIME_IDENTITY_SCHEMA,
} from '../commissioned-art.mjs';
import { RENDER_CONTRACT } from '../render-contract.mjs';
import { pngDifference } from './validate-assets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const GOLDEN_BEATS = Object.freeze([
  'land-at-outpost',
  'survey-site',
  'place-solar-array-blueprint',
  'build-and-connect-power',
  'activate-extractor',
  'dispatch-rover',
  'dust-storm',
  'repair-at-sunrise',
]);
const LIGHTING_PROFILES = Object.freeze(['dawn', 'daylight', 'storm', 'night']);
const EMPTY_RUNTIME_ASSET_HASH = createHash('sha256')
  .update(JSON.stringify({ schema: COMMISSIONED_RUNTIME_IDENTITY_SCHEMA, assets: [] }))
  .digest('hex');

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function numberFrom(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readPath(source, path) {
  return path.reduce((value, key) => value?.[key], source);
}

function firstDefined(source, paths, fallback = undefined) {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
}

function commissionedTelemetry(state) {
  return firstDefined(state, [
    ['commissionedArt'],
    ['commissioned'],
    ['telemetry', 'cache'],
    ['telemetry', 'commissionedArt'],
    ['telemetry', 'commissioned'],
    ['rendering', 'commissionedArt'],
  ], {});
}

function commissionedWarnings(state) {
  const warnings = firstDefined(state, [
    ['commissionedWarnings'],
    ['warnings'],
    ['telemetry', 'warnings'],
    ['telemetry', 'commissionedWarnings'],
  ], []);
  return Array.isArray(warnings) ? warnings : [];
}

function fallbackDrawCount(state) {
  const telemetry = commissionedTelemetry(state);
  return Math.max(
    numberFrom(telemetry.fallbackDrawn),
    numberFrom(state?.rendering?.fallbackDrawn),
    numberFrom(state?.rendering?.proceduralDrawn),
    numberFrom(state?.telemetry?.fallbackDrawn),
    numberFrom(state?.telemetry?.proceduralDrawn),
    numberFrom(state?.telemetry?.frameSources?.legacy) + numberFrom(state?.telemetry?.frameSources?.procedural),
    numberFrom(state?.telemetry?.totals?.legacy) + numberFrom(state?.telemetry?.totals?.procedural),
  );
}

function frameFallbackDrawCount(state) {
  return numberFrom(state?.telemetry?.frameSources?.legacy)
    + numberFrom(state?.telemetry?.frameSources?.procedural);
}

function frameSourceCoverage(state) {
  const sources = state?.telemetry?.frameSources || {};
  const requested = numberFrom(sources.requested);
  const commissioned = numberFrom(sources.commissioned);
  const legacy = numberFrom(sources.legacy);
  const procedural = numberFrom(sources.procedural);
  return {
    requested,
    commissioned,
    legacy,
    procedural,
    resolved: commissioned + legacy + procedural,
  };
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

async function waitForUrl(url, processHandle) {
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processHandle.exitCode !== null) throw new Error(`MarsScape server exited with ${processHandle.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`MarsScape server did not become ready: ${lastError?.message || 'unknown error'}`);
}

async function startLocalServer(port) {
  const processHandle = spawn(process.execPath, ['mars/server.mjs'], {
    cwd: REPO_ROOT,
    env: { ...process.env, MARSSCAPE_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stderr = [];
  processHandle.stderr.on('data', (chunk) => stderr.push(String(chunk)));
  const url = `http://127.0.0.1:${port}/mars/`;
  try {
    await waitForUrl(url, processHandle);
  } catch (error) {
    processHandle.kill('SIGTERM');
    throw new Error(`${error.message}${stderr.length ? `\n${stderr.join('')}` : ''}`);
  }
  return { processHandle, url };
}

async function gameState(page) {
  return page.evaluate(() => {
    if (typeof window.render_game_to_text === 'function') {
      return JSON.parse(window.render_game_to_text());
    }
    const board = document.querySelector('#isoBoard');
    if (!board) throw new Error('MarsScape board telemetry is unavailable');
    return {
      viewport: {
        scale: Number(board.style.getPropertyValue('--user-scale')) || 1,
      },
      rendering: {
        pixelMode: board.dataset.renderMode === 'pixel',
        spritesDrawn: Number(board.dataset.spritesDrawn) || 0,
        proceduralDrawn: Number(board.dataset.proceduralDrawn) || 0,
        bitmapCount: Number(board.dataset.spriteBitmaps) || 0,
      },
    };
  });
}

async function goldenState(page) {
  return page.evaluate(() => {
    if (typeof window.render_golden_scene_to_text !== 'function') {
      throw new Error('Golden-scene text telemetry is unavailable');
    }
    const rendered = window.render_golden_scene_to_text();
    return typeof rendered === 'string' ? JSON.parse(rendered) : rendered;
  });
}

async function goldenControls(page) {
  return page.evaluate(() => {
    const selectedBeat = document.querySelector('[data-beat-index][aria-current="step"]');
    const value = (selector) => document.querySelector(selector)?.value;
    const checked = (selector) => document.querySelector(selector)?.checked === true;
    return {
      beatIndex: Number(selectedBeat?.dataset.beatIndex),
      zoom: Number(value('#zoomSelect')),
      lighting: value('#lightingSelect'),
      renderMode: value('#renderModeSelect'),
      anchors: checked('#showAnchors'),
      footprints: checked('#showFootprints'),
      labels: checked('#showLabels'),
      reducedMotion: checked('#reducedMotion'),
      forceFallback: checked('#forceFallback'),
    };
  });
}

async function settleGoldenScene(page) {
  await page.evaluate(() => new Promise((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
  }));
}

async function setSelect(page, selector, value) {
  await page.locator(selector).selectOption(String(value));
  await settleGoldenScene(page);
}

async function setToggle(page, selector, checked) {
  await page.locator(selector).setChecked(checked);
  await settleGoldenScene(page);
}

async function configureGoldenScene(page, options = {}) {
  if (options.zoom !== undefined) await setSelect(page, '#zoomSelect', options.zoom);
  if (options.lighting !== undefined) await setSelect(page, '#lightingSelect', options.lighting);
  if (options.renderMode !== undefined) await setSelect(page, '#renderModeSelect', options.renderMode);
  if (options.anchors !== undefined) await setToggle(page, '#showAnchors', options.anchors);
  if (options.footprints !== undefined) await setToggle(page, '#showFootprints', options.footprints);
  if (options.labels !== undefined) await setToggle(page, '#showLabels', options.labels);
  if (options.reducedMotion !== undefined) await setToggle(page, '#reducedMotion', options.reducedMotion);
  if (options.forceFallback !== undefined) await setToggle(page, '#forceFallback', options.forceFallback);
}

async function chooseBeat(page, index) {
  await page.locator(`[data-beat-index="${index}"]`).click();
  await settleGoldenScene(page);
}

async function captureGoldenScene(page, outputDirectory, files, name) {
  const path = join(outputDirectory, name);
  await page.locator('#goldenCanvas').screenshot({ path });
  const state = await goldenState(page);
  const controls = await goldenControls(page);
  files.push({ name, path });
  return {
    name,
    controls,
    state,
    commissioned: commissionedTelemetry(state),
    warnings: commissionedWarnings(state),
  };
}

async function benchmarkGoldenScene(page) {
  const performanceContract = RENDER_CONTRACT.performance;
  const raw = await page.evaluate(async ({ warmupFrames, sampleFrames, frameStepMs }) => {
    const owner = typeof window.__goldenScene?.advanceTime === 'function'
      ? window.__goldenScene
      : window;
    const advance = typeof owner.advanceTime === 'function' ? owner.advanceTime : null;
    if (!advance) throw new Error('Golden-scene deterministic advanceTime hook is unavailable');

    for (let frame = 0; frame < warmupFrames; frame += 1) {
      await advance.call(owner, frameStepMs);
    }

    const frameTimes = [];
    for (let frame = 0; frame < sampleFrames; frame += 1) {
      const started = performance.now();
      await advance.call(owner, frameStepMs);
      frameTimes.push(performance.now() - started);
    }
    return frameTimes;
  }, {
    warmupFrames: performanceContract.warmupFrames,
    sampleFrames: performanceContract.sampleFrames,
    frameStepMs: 1000 / performanceContract.targetFramesPerSecond,
  });

  const p50FrameMs = percentile(raw, 0.5);
  const p95FrameMs = percentile(raw, 0.95);
  const maxFrameMs = Math.max(...raw);
  const droppedFrames = raw.filter((duration) => duration > performanceContract.frameBudgetMs).length;
  const droppedFrameRatio = droppedFrames / raw.length;
  const pass = p95FrameMs <= performanceContract.p95FrameMs
    && droppedFrameRatio <= performanceContract.maxDroppedFrameRatio;

  return {
    deterministicStepMs: 1000 / performanceContract.targetFramesPerSecond,
    warmupFrames: performanceContract.warmupFrames,
    sampleFrames: raw.length,
    p50FrameMs,
    p95FrameMs,
    maxFrameMs,
    droppedFrames,
    droppedFrameRatio,
    thresholds: {
      frameBudgetMs: performanceContract.frameBudgetMs,
      p95FrameMs: performanceContract.p95FrameMs,
      maxDroppedFrameRatio: performanceContract.maxDroppedFrameRatio,
    },
    pass,
  };
}

function compareScreenshots(files, baselineDirectory, updateBaseline, maxDiff) {
  const comparisons = [];
  if (!baselineDirectory) return comparisons;
  mkdirSync(baselineDirectory, { recursive: true });
  for (const file of files) {
    const baseline = join(baselineDirectory, file.name);
    if (updateBaseline || !existsSync(baseline)) {
      if (!updateBaseline) {
        comparisons.push({ name: file.name, status: 'missing-baseline', ratio: null });
        continue;
      }
      copyFileSync(file.path, baseline);
      comparisons.push({ name: file.name, status: 'baseline-updated', ratio: 0 });
      continue;
    }
    const difference = pngDifference(readFileSync(baseline), readFileSync(file.path));
    comparisons.push({
      name: file.name,
      status: difference.compatible && difference.ratio <= maxDiff ? 'pass' : 'fail',
      ...difference,
    });
  }
  return comparisons;
}

const args = process.argv.slice(2);
const requestedUrl = optionValue(args, '--url');
const outputDirectory = resolve(optionValue(args, '--output', join(REPO_ROOT, '.art-validation', 'marsscape')));
const baselineValue = optionValue(args, '--baseline');
const baselineDirectory = baselineValue ? resolve(baselineValue) : null;
const updateBaseline = args.includes('--update-baseline');
const maxDiff = Number(optionValue(args, '--max-diff', '0.01'));
const port = Number(process.env.MARSSCAPE_ART_PORT || 8791);
let localServer = null;
let browser = null;

try {
  const gameUrl = requestedUrl || (localServer = await startLocalServer(port)).url;
  mkdirSync(outputDirectory, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(gameUrl, { waitUntil: 'networkidle' });
  await page.locator('#startButton').waitFor({ state: 'visible' });
  await page.locator('#startButton').click();
  await page.locator('#boot').waitFor({ state: 'hidden' });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });

  const initial = await gameState(page);
  if (initial.viewport.scale !== 1) throw new Error(`Expected normal gameplay zoom 1; received ${initial.viewport.scale}`);
  if (!initial.rendering.pixelMode || initial.rendering.spritesDrawn < 1) throw new Error('Pixel Art mode did not draw sprites');

  const files = [];
  const pixelPath = join(outputDirectory, 'mars-normal-pixel.png');
  await page.locator('#isoViewport').screenshot({ path: pixelPath, animations: 'disabled' });
  files.push({ name: 'mars-normal-pixel.png', path: pixelPath });

  await page.locator('#pixelModeButton').click();
  const procedural = await gameState(page);
  if (procedural.rendering.pixelMode || procedural.rendering.proceduralDrawn < 1) throw new Error('Procedural fallback mode did not draw fallback models');
  const proceduralPath = join(outputDirectory, 'mars-normal-procedural.png');
  await page.locator('#isoViewport').screenshot({ path: proceduralPath, animations: 'disabled' });
  files.push({ name: 'mars-normal-procedural.png', path: proceduralPath });

  const specPage = await context.newPage();
  specPage.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`art-spec: ${message.text()}`);
  });
  specPage.on('pageerror', (error) => consoleErrors.push(`art-spec: ${error.message}`));
  await specPage.goto(new URL('art-spec.html', gameUrl).href, { waitUntil: 'networkidle' });
  await specPage.waitForFunction(() => Number(document.documentElement.dataset.spriteBitmaps) >= 33);
  const specState = JSON.parse(await specPage.evaluate(() => window.render_spec_to_text()));
  if (specState.contractVersion !== RENDER_CONTRACT.version || specState.spriteBitmaps < 33) {
    throw new Error('Art-spec contract or bitmap proof is stale');
  }
  const specPath = join(outputDirectory, 'mars-art-spec.png');
  await specPage.screenshot({ path: specPath, fullPage: true, animations: 'disabled' });
  files.push({ name: 'mars-art-spec.png', path: specPath });

  const contactPage = await context.newPage();
  contactPage.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`contact-sheet: ${message.text()}`);
  });
  contactPage.on('pageerror', (error) => consoleErrors.push(`contact-sheet: ${error.message}`));
  await contactPage.goto(new URL('art/reports/golden-contact-sheet.html', gameUrl).href, { waitUntil: 'networkidle' });
  const contactCards = await contactPage.locator('main article').count();
  if (contactCards !== 26) throw new Error(`Expected 26 golden contact-sheet cards; received ${contactCards}`);
  const contactAnchors = await contactPage.locator('.anchor').count();
  const contactFootprints = await contactPage.locator('.footprint').count();
  if (contactAnchors !== 26 || contactFootprints !== 26) {
    throw new Error('Golden contact sheet is missing anchor or footprint overlays');
  }
  const contactPath = join(outputDirectory, 'mars-golden-contact-sheet.png');
  await contactPage.screenshot({ path: contactPath, fullPage: true, animations: 'disabled' });
  files.push({ name: 'mars-golden-contact-sheet.png', path: contactPath });

  const goldenPage = await context.newPage();
  const goldenConsoleWarnings = [];
  goldenPage.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`golden-scene: ${message.text()}`);
    if (message.type() === 'warning') goldenConsoleWarnings.push(message.text());
  });
  goldenPage.on('pageerror', (error) => consoleErrors.push(`golden-scene: ${error.message}`));
  await goldenPage.goto(new URL('golden-scene.html', gameUrl).href, { waitUntil: 'networkidle' });
  await goldenPage.waitForFunction(() => typeof window.render_golden_scene_to_text === 'function');
  await goldenPage.waitForFunction(() => {
    const value = JSON.parse(window.render_golden_scene_to_text());
    if (value.error) throw new Error(value.error);
    return value.ready === true;
  });
  await goldenPage.locator('#goldenCanvas').waitFor({ state: 'visible' });

  // Golden-scene captures deliberately keep real renderer motion enabled. Determinism
  // comes from the scene's clock hook rather than CSS animation suppression.
  await configureGoldenScene(goldenPage, {
    zoom: RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
    lighting: 'auto',
    renderMode: 'auto',
    anchors: true,
    footprints: true,
    labels: false,
    reducedMotion: false,
    forceFallback: false,
  });

  const beatCaptures = [];
  for (let index = 0; index < GOLDEN_BEATS.length; index += 1) {
    await chooseBeat(goldenPage, index);
    const capture = await captureGoldenScene(
      goldenPage,
      outputDirectory,
      files,
      `golden-beat-${String(index + 1).padStart(2, '0')}-${GOLDEN_BEATS[index]}.png`,
    );
    const controlsPass = capture.controls.beatIndex === index
      && capture.controls.zoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom
      && capture.controls.labels === false
      && capture.controls.anchors === true
      && capture.controls.footprints === true
      && capture.state?.beat?.index === index
      && capture.state?.view?.zoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom
      && capture.state?.view?.overlays?.labels === false
      && capture.state?.view?.overlays?.anchors === true
      && capture.state?.view?.overlays?.footprints === true;
    beatCaptures.push({ ...capture, pass: controlsPass });
  }

  const lightingCaptures = [];
  for (const profile of LIGHTING_PROFILES) {
    await setSelect(goldenPage, '#lightingSelect', profile);
    const capture = await captureGoldenScene(
      goldenPage,
      outputDirectory,
      files,
      `golden-light-${profile}.png`,
    );
    lightingCaptures.push({
      ...capture,
      pass: capture.controls.lighting === profile && capture.state?.beat?.lighting === profile,
    });
  }

  await configureGoldenScene(goldenPage, {
    lighting: 'auto',
    renderMode: 'auto',
    forceFallback: false,
    reducedMotion: false,
  });
  await chooseBeat(goldenPage, 6);
  const autoResolutionCapture = await captureGoldenScene(
    goldenPage,
    outputDirectory,
    files,
    'golden-auto-resolution.png',
  );
  const autoResolutionProof = {
    ...autoResolutionCapture,
    fallbackDrawn: fallbackDrawCount(autoResolutionCapture.state),
    frameFallbackDrawn: frameFallbackDrawCount(autoResolutionCapture.state),
    frameSources: frameSourceCoverage(autoResolutionCapture.state),
  };
  autoResolutionProof.pass = autoResolutionProof.controls.renderMode === 'auto'
    && autoResolutionProof.controls.forceFallback === false
    && autoResolutionProof.state?.view?.renderMode === 'auto'
    && autoResolutionProof.state?.view?.forceFallback === false
    && autoResolutionProof.frameSources.requested > 0
    && autoResolutionProof.frameSources.resolved === autoResolutionProof.frameSources.requested;

  // Keep missing-asset behavior independently testable after a complete commissioned
  // package lands. A clean context receives a valid but intentionally empty runtime
  // index, then must resolve the scene through legacy/procedural fallbacks in auto mode.
  const missingContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  await missingContext.route('**/assets/commissioned/index.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      version: COMMISSIONED_INDEX_VERSION,
      runtimeIdentitySchema: COMMISSIONED_RUNTIME_IDENTITY_SCHEMA,
      contractVersion: RENDER_CONTRACT.version,
      decision: RENDER_CONTRACT.decision,
      scope: 'full',
      manifestHash: createHash('sha256')
        .update(JSON.stringify(JSON.parse(readFileSync(join(REPO_ROOT, 'mars', 'art', 'golden-slice.json'), 'utf8'))))
        .digest('hex'),
      runtimeAssetHash: EMPTY_RUNTIME_ASSET_HASH,
      runtimeAssetHashes: {
        full: EMPTY_RUNTIME_ASSET_HASH,
        'artist-test': EMPTY_RUNTIME_ASSET_HASH,
      },
      availableExports: 0,
      assets: [],
    }),
  }));
  const missingPage = await missingContext.newPage();
  const missingFixtureConsoleWarnings = [];
  missingPage.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`golden-missing-fixture: ${message.text()}`);
    if (message.type() === 'warning') missingFixtureConsoleWarnings.push(message.text());
  });
  missingPage.on('pageerror', (error) => consoleErrors.push(`golden-missing-fixture: ${error.message}`));
  await missingPage.goto(new URL('golden-scene.html', gameUrl).href, { waitUntil: 'networkidle' });
  await missingPage.waitForFunction(() => typeof window.render_golden_scene_to_text === 'function');
  await missingPage.waitForFunction(() => {
    const value = JSON.parse(window.render_golden_scene_to_text());
    if (value.error) throw new Error(value.error);
    return value.ready === true;
  });
  await configureGoldenScene(missingPage, {
    zoom: RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
    lighting: 'storm',
    renderMode: 'auto',
    anchors: true,
    footprints: true,
    labels: false,
    reducedMotion: false,
    forceFallback: false,
  });
  await chooseBeat(missingPage, 6);
  const missingFixtureCapture = await captureGoldenScene(
    missingPage,
    outputDirectory,
    files,
    'golden-missing-asset-fallback.png',
  );
  const missingFixtureTelemetry = commissionedTelemetry(missingFixtureCapture.state);
  const missingFixtureSources = frameSourceCoverage(missingFixtureCapture.state);
  const missingFixtureWarnings = commissionedWarnings(missingFixtureCapture.state);
  const missingAssetFallbackProof = {
    ...missingFixtureCapture,
    fixture: {
      strategy: 'valid empty commissioned runtime index',
      indexedAssets: 0,
      indexIdentityVerified: missingFixtureTelemetry.indexIdentityVerified === true,
      contractVersion: RENDER_CONTRACT.version,
      decision: RENDER_CONTRACT.decision,
    },
    frameSources: missingFixtureSources,
    fallbackDrawn: frameFallbackDrawCount(missingFixtureCapture.state),
    cacheMissing: numberFrom(missingFixtureTelemetry.missing),
    consoleWarnings: missingFixtureConsoleWarnings,
  };
  missingAssetFallbackProof.pass = missingAssetFallbackProof.controls.renderMode === 'auto'
    && missingAssetFallbackProof.controls.forceFallback === false
    && missingAssetFallbackProof.state?.view?.renderMode === 'auto'
    && missingAssetFallbackProof.state?.view?.forceFallback === false
    && missingFixtureSources.requested > 0
    && missingAssetFallbackProof.fixture.indexIdentityVerified === true
    && missingFixtureSources.commissioned === 0
    && missingFixtureSources.resolved === missingFixtureSources.requested
    && missingAssetFallbackProof.fallbackDrawn > 0
    && missingAssetFallbackProof.cacheMissing > 0
    && !missingFixtureWarnings.some((warning) => warning.code === 'COMMISSIONED_INDEX_FAILED')
    && missingFixtureWarnings.some((warning) => warning.code === 'COMMISSIONED_SPRITE_MISSING');
  await missingContext.close();

  await configureGoldenScene(goldenPage, { renderMode: 'procedural', forceFallback: true });
  const proceduralCapture = await captureGoldenScene(
    goldenPage,
    outputDirectory,
    files,
    'golden-forced-procedural.png',
  );
  const proceduralProof = {
    ...proceduralCapture,
    fallbackDrawn: fallbackDrawCount(proceduralCapture.state),
    frameProceduralDrawn: numberFrom(proceduralCapture.state?.telemetry?.frameSources?.procedural),
  };
  proceduralProof.pass = proceduralProof.controls.renderMode === 'procedural'
    && proceduralProof.controls.forceFallback === true
    && proceduralProof.state?.view?.renderMode === 'procedural'
    && proceduralProof.state?.view?.forceFallback === true
    && proceduralProof.frameProceduralDrawn > 0;

  await configureGoldenScene(goldenPage, {
    renderMode: 'auto',
    forceFallback: false,
    reducedMotion: true,
  });
  await goldenPage.evaluate(() => window.advanceTime(0));
  const reducedMotionBefore = await goldenState(goldenPage);
  await goldenPage.evaluate(() => window.advanceTime(600));
  const reducedMotionCapture = await captureGoldenScene(
    goldenPage,
    outputDirectory,
    files,
    'golden-reduced-motion.png',
  );
  const reducedMotionProof = {
    ...reducedMotionCapture,
    animationTimeBeforeMs: reducedMotionBefore?.view?.animationTimeMs,
    animationTimeAfterMs: reducedMotionCapture.state?.view?.animationTimeMs,
  };
  reducedMotionProof.pass = reducedMotionProof.controls.reducedMotion === true
    && reducedMotionProof.state?.view?.reducedMotion === true
    && reducedMotionProof.animationTimeBeforeMs === reducedMotionProof.animationTimeAfterMs;

  await configureGoldenScene(goldenPage, {
    zoom: RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
    lighting: 'storm',
    renderMode: 'auto',
    anchors: true,
    footprints: true,
    labels: false,
    reducedMotion: false,
    forceFallback: false,
  });
  await chooseBeat(goldenPage, 6);
  const performance = await benchmarkGoldenScene(goldenPage);
  const finalGoldenState = await goldenState(goldenPage);
  const finalCommissioned = commissionedTelemetry(finalGoldenState);
  const runtimeWarnings = commissionedWarnings(finalGoldenState);

  const goldenGates = {
    normalZoomBeatSequence: beatCaptures.length === GOLDEN_BEATS.length && beatCaptures.every((capture) => capture.pass),
    lightingProfiles: lightingCaptures.length === LIGHTING_PROFILES.length && lightingCaptures.every((capture) => capture.pass),
    commissionedAutoResolution: autoResolutionProof.pass,
    missingAssetFallback: missingAssetFallbackProof.pass,
    forcedProcedural: proceduralProof.pass,
    reducedMotion: reducedMotionProof.pass,
    performance: performance.pass,
  };
  const failedGoldenGates = Object.entries(goldenGates)
    .filter(([, pass]) => !pass)
    .map(([name]) => name);

  const comparisons = compareScreenshots(files, baselineDirectory, updateBaseline, maxDiff);
  const failedComparisons = comparisons.filter((comparison) => comparison.status === 'fail');
  const report = {
    url: gameUrl,
    contractVersion: RENDER_CONTRACT.version,
    normalGameplayZoom: initial.viewport.scale,
    pixelRendering: initial.rendering,
    proceduralRendering: procedural.rendering,
    artSpec: specState,
    contactSheet: { cards: contactCards, anchors: contactAnchors, footprints: contactFootprints },
    goldenScene: {
      gates: goldenGates,
      beatCaptures,
      lightingCaptures,
      autoMode: autoResolutionProof,
      missingAssetFallback: missingAssetFallbackProof,
      forcedProcedural: proceduralProof,
      reducedMotion: reducedMotionProof,
      performance,
      commissionedTelemetry: {
        final: finalCommissioned,
        cachedBitmaps: numberFrom(finalCommissioned.cachedBitmaps),
        brokenClips: numberFrom(finalCommissioned.brokenClips),
        stateFallbacks: numberFrom(finalCommissioned.stateFallbacks),
        legacyStateFallbacks: numberFrom(finalGoldenState?.telemetry?.totals?.legacyStateFallbacks),
      },
      runtimeWarnings,
      consoleWarnings: goldenConsoleWarnings,
    },
    screenshots: files,
    comparisons,
    consoleErrors,
  };
  const reportPath = join(outputDirectory, 'visual-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const failed = consoleErrors.length > 0 || failedComparisons.length > 0 || failedGoldenGates.length > 0;
  console.log(`MarsScape visual regression: ${failed ? 'FAIL' : 'PASS'}`);
  console.log(`Screenshots: ${outputDirectory}`);
  console.log(`Pixel sprites: ${initial.rendering.spritesDrawn}; procedural fallback: ${procedural.rendering.proceduralDrawn}; art-spec bitmaps: ${specState.spriteBitmaps}`);
  console.log(`Golden captures: ${beatCaptures.length} beats; ${lightingCaptures.length} lighting profiles; ${files.length} total screenshots`);
  console.log(`Golden auto mode: commissioned=${autoResolutionProof.frameSources.commissioned}; fallback=${autoResolutionProof.frameFallbackDrawn}; resolved=${autoResolutionProof.frameSources.resolved}/${autoResolutionProof.frameSources.requested}`);
  console.log(`Golden fallback fixture: fallback=${missingAssetFallbackProof.fallbackDrawn}; missing=${missingAssetFallbackProof.cacheMissing}; forced=${proceduralProof.fallbackDrawn}; reduced-motion=${reducedMotionProof.pass ? 'pass' : 'fail'}`);
  console.log(`Performance: p50=${performance.p50FrameMs.toFixed(2)}ms; p95=${performance.p95FrameMs.toFixed(2)}ms; max=${performance.maxFrameMs.toFixed(2)}ms; dropped=${(performance.droppedFrameRatio * 100).toFixed(2)}%`);
  console.log(`Commissioned cache: ${numberFrom(finalCommissioned.cachedBitmaps)} bitmaps; broken clips=${numberFrom(finalCommissioned.brokenClips)}; state fallbacks=${numberFrom(finalCommissioned.stateFallbacks)}; legacy state fallbacks=${numberFrom(finalGoldenState?.telemetry?.totals?.legacyStateFallbacks)}; warnings=${runtimeWarnings.length}`);
  if (comparisons.length) console.log(`Comparisons: ${comparisons.map((item) => `${item.name}=${item.status}`).join(', ')}`);
  if (failedGoldenGates.length) console.log(`Golden gate failures: ${failedGoldenGates.join(', ')}`);
  if (consoleErrors.length) console.log(`Console errors: ${consoleErrors.join(' | ')}`);
  if (failed) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (localServer?.processHandle && localServer.processHandle.exitCode === null) localServer.processHandle.kill('SIGTERM');
}
