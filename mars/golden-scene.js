import {
  COMMISSIONED_INDEX_VERSION,
  COMMISSIONED_RUNTIME_IDENTITY_SCHEMA,
  CommissionedArtCache,
  runtimeAssetIdentityHash,
  sha256Bytes,
} from './commissioned-art.mjs';
import {
  RENDER_CONTRACT,
  footprintCornersFromCenter,
  projectGrid,
} from './render-contract.mjs';
import { SpriteBitmapCache } from './sprite-canvas.mjs';

const SCENE_URL = new URL('./art/golden-scene.json', import.meta.url);
const MANIFEST_URL = new URL('./art/golden-slice.json', import.meta.url);
const COMMISSIONED_INDEX_URL = new URL('./assets/commissioned/index.json', import.meta.url);
const COMMISSIONED_BASE_URL = new URL('./assets/commissioned/', import.meta.url);
const REVIEW_SURFACE_RESOURCES = Object.freeze([
  Object.freeze({ path: 'golden-scene.html', url: new URL('./golden-scene.html', import.meta.url).href }),
  Object.freeze({ path: 'golden-scene.css', url: new URL('./golden-scene.css', import.meta.url).href }),
  Object.freeze({ path: 'golden-scene.js', url: new URL('./golden-scene.js', import.meta.url).href }),
  Object.freeze({ path: 'art/golden-scene.json', url: SCENE_URL.href }),
  Object.freeze({ path: 'art/golden-slice.json', url: MANIFEST_URL.href }),
  Object.freeze({ path: 'render-contract.mjs', url: new URL('./render-contract.mjs', import.meta.url).href }),
  Object.freeze({ path: 'commissioned-art.mjs', url: new URL('./commissioned-art.mjs', import.meta.url).href }),
  Object.freeze({ path: 'sprite-canvas.mjs', url: new URL('./sprite-canvas.mjs', import.meta.url).href }),
  Object.freeze({ path: 'sprites.mjs', url: new URL('./sprites.mjs', import.meta.url).href }),
  Object.freeze({ path: '../src/kit/nav.js', url: new URL('../src/kit/nav.js', import.meta.url).href }),
]);
const APPROVAL_REPORT_URLS = Object.freeze({
  'artist-test': new URL('./art/reports/artist-test-approval.json', import.meta.url),
  'golden-scene': new URL('./art/reports/golden-approval.json', import.meta.url),
});
const APPROVAL_REPORT_SCOPES = Object.freeze({
  'artist-test': 'artist-test',
  'golden-scene': 'full',
});
const APPROVAL_RECEIPT_SCHEMA = 'marsscape-art-approval-receipt/v3';
const APPROVAL_STORAGE_PREFIX = 'marsscape.dec79.approval.v3';
const RUNTIME_IDENTITY_SCHEMA = COMMISSIONED_RUNTIME_IDENTITY_SCHEMA;
const VIEW = RENDER_CONTRACT.board;
const VALID_LIGHTING = new Set(['auto', ...Object.keys(RENDER_CONTRACT.light.profiles)]);
const VALID_MODES = new Set(['auto', 'commissioned', 'procedural']);
const VALID_ZOOMS = new Set([
  RENDER_CONTRACT.pixelDensity.minViewportZoom,
  RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
  RENDER_CONTRACT.pixelDensity.maxViewportZoom,
]);
const GOLDEN_REVIEW_ZOOMS = Object.freeze([...VALID_ZOOMS].sort((left, right) => left - right));
const GOLDEN_REVIEW_LIGHTING = Object.freeze(Object.keys(RENDER_CONTRACT.light.profiles));
const CANONICAL_HUMAN_CHECKS = Object.freeze([
  Object.freeze({ id: 'reviewAnchors', value: 'anchors' }),
  Object.freeze({ id: 'reviewFootprints', value: 'footprints' }),
  Object.freeze({ id: 'reviewReadability', value: 'readability' }),
  Object.freeze({ id: 'reviewScale', value: 'scale' }),
  Object.freeze({ id: 'reviewLighting', value: 'lighting' }),
  Object.freeze({ id: 'reviewAnimation', value: 'animation' }),
  Object.freeze({ id: 'reviewPerformance', value: 'performance' }),
]);
const CANONICAL_HUMAN_CHECK_VALUES = Object.freeze(CANONICAL_HUMAN_CHECKS.map((check) => check.value));
const LOW_EFFECTS = new Set(['selection', 'power_glow']);
const TERRAIN_COLOURS = Object.freeze({
  base_soil: ['#a2502e', '#71351f'],
  rocky_soil: ['#8b5d45', '#50382d'],
  disturbed_ground: ['#81503a', '#432e24'],
  edge: ['#8f4328', '#4d2118'],
  cliff_slope: ['#7a4937', '#3c2a24'],
});
const ARTIST_TEST_SCENE = Object.freeze({
  id: 'paid_artist_test',
  title: 'Paid artist test matrix',
  durationMs: 2400,
  lighting: 'daylight',
  camera: Object.freeze({ centre: Object.freeze([5, 4.5]), zoom: 1 }),
  description: 'The paid test package shown in one gameplay-scale scene: base soil, habitat active and damaged variants, animated astronaut, and blue crystal.',
  assertions: Object.freeze([
    'all paid-test exports are judged at normal gameplay zoom',
    'damaged habitat differs structurally and astronaut frame 01 is safe',
  ]),
  entities: Object.freeze([
    Object.freeze({ asset: 'building:habitat', state: 'active', at: Object.freeze([4, 3]) }),
    Object.freeze({ asset: 'building:habitat', state: 'damaged', at: Object.freeze([6, 3]) }),
    Object.freeze({ asset: 'actor:astronaut', state: 'active', at: Object.freeze([4.5, 5]) }),
    Object.freeze({ asset: 'resource:blue_crystal', state: 'active', at: Object.freeze([6, 5]) }),
  ]),
});

const canvas = document.querySelector('#goldenCanvas');
const context = canvas?.getContext('2d', { alpha: false });
const elements = Object.freeze({
  skipLink: document.querySelector('.skip-link'),
  loadStatus: document.querySelector('#loadStatus'),
  sceneStatus: document.querySelector('#sceneStatus'),
  stageTitle: document.querySelector('#stageTitle'),
  canvasDescription: document.querySelector('#canvasDescription'),
  playbackBar: document.querySelector('#playbackBar'),
  playPause: document.querySelector('#playPause'),
  timeScrubber: document.querySelector('#timeScrubber'),
  timeReadout: document.querySelector('#timeReadout'),
  sequencePanel: document.querySelector('#sequencePanel'),
  beatButtons: [...document.querySelectorAll('[data-beat-index]')],
  previousBeat: document.querySelector('#previousBeat'),
  nextBeat: document.querySelector('#nextBeat'),
  scopeSelect: document.querySelector('#scopeSelect'),
  lightingSelect: document.querySelector('#lightingSelect'),
  autoLightingOption: document.querySelector('#autoLightingOption'),
  renderModeSelect: document.querySelector('#renderModeSelect'),
  zoomSelect: document.querySelector('#zoomSelect'),
  showAnchors: document.querySelector('#showAnchors'),
  showFootprints: document.querySelector('#showFootprints'),
  showLabels: document.querySelector('#showLabels'),
  reducedMotion: document.querySelector('#reducedMotion'),
  forceFallback: document.querySelector('#forceFallback'),
  assetTelemetry: document.querySelector('#assetTelemetry'),
  performanceTelemetry: document.querySelector('#performanceTelemetry'),
  warningTelemetry: document.querySelector('#warningTelemetry'),
  reviewChecklist: document.querySelector('#reviewChecklist'),
  reviewHelp: document.querySelector('#reviewHelp'),
  reviewContextStatus: document.querySelector('#reviewContextStatus'),
  approvalEvidenceStatus: document.querySelector('#approvalEvidenceStatus'),
  approvalGateStatus: document.querySelector('#approvalGateStatus'),
  approvalReason: document.querySelector('#approvalReason'),
  recordApproval: document.querySelector('#recordApproval'),
  approvalReceiptStatus: document.querySelector('#approvalReceiptStatus'),
  downloadApprovalReceipt: document.querySelector('#downloadApprovalReceipt'),
  gateBadge: document.querySelector('.gate-badge'),
});

const state = {
  ready: false,
  fatalError: null,
  scene: null,
  manifest: null,
  manifestAssets: new Map(),
  artistTestAssets: new Set(),
  indexMeta: null,
  reviewSurface: {
    status: 'loading',
    algorithm: 'SHA-256',
    hash: null,
    resources: [],
    reasons: ['Review-surface integrity has not loaded.'],
  },
  beatOffsets: [],
  totalDurationMs: 1,
  beatIndex: 0,
  sequenceTimeMs: 0,
  animationTimeMs: 0,
  playing: false,
  scope: 'golden-scene',
  lighting: 'auto',
  renderMode: 'auto',
  zoom: RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
  overlays: {
    anchors: true,
    footprints: true,
    labels: true,
  },
  reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true,
  forceFallback: false,
  manualClock: false,
  warnings: [],
  frameSources: { requested: 0, commissioned: 0, legacy: 0, procedural: 0 },
  totals: { requested: 0, commissioned: 0, legacy: 0, procedural: 0, legacyStateFallbacks: 0 },
  legacyStateFallbackKeys: new Set(),
  visibleSources: [],
  visibleTerrain: [],
  frameTimings: [],
  lastRenderMs: 0,
  lastTelemetryPaint: 0,
  lastRafTime: null,
  approvalEvidence: {
    'artist-test': null,
    'golden-scene': null,
  },
  humanChecks: {
    'artist-test': new Set(),
    'golden-scene': new Set(),
  },
  humanCheckContexts: {
    'artist-test': null,
    'golden-scene': null,
  },
  reviewCoverage: {
    'artist-test': {
      contextKey: null,
      matrix: false,
      animationMs: 0,
      lastAnimationTime: null,
      frameTimings: [],
    },
    'golden-scene': {
      contextKey: null,
      beatZooms: new Set(),
      lightingProfiles: new Set(),
      proceduralFallbackAt1x: false,
      reducedMotionCommissionedAt1x: false,
      frameTimings: [],
    },
  },
  approvalReceipts: {
    'artist-test': null,
    'golden-scene': null,
  },
  receiptDownloadUrl: null,
  receiptDownloadKey: null,
  warningSignature: null,
};

const domUpdateSignatures = new WeakMap();

function addWarning(warning) {
  const entry = {
    code: String(warning?.code || 'RENDER_WARNING'),
    id: String(warning?.id || 'unknown'),
    response: String(warning?.response || 'Fallback retained.'),
  };
  const key = `${entry.code}:${entry.id}`;
  if (state.warnings.some((candidate) => `${candidate.code}:${candidate.id}` === key)) return;
  state.warnings.push(entry);
  if (state.warnings.length > 40) state.warnings.shift();
}

const commissionedCache = new CommissionedArtCache({ onWarning: addWarning });
const legacyCache = new SpriteBitmapCache(undefined, { onWarning: addWarning });

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setTextIfChanged(element, value) {
  if (!element) return false;
  const text = String(value);
  if (element.textContent === text) return false;
  element.textContent = text;
  return true;
}

function setMarkupIfChanged(element, markup, signature = markup) {
  if (!element) return false;
  if (domUpdateSignatures.get(element) === signature || element.innerHTML === markup) {
    domUpdateSignatures.set(element, signature);
    return false;
  }
  element.innerHTML = markup;
  domUpdateSignatures.set(element, signature);
  return true;
}

function setDataStateIfChanged(element, value) {
  if (!element || element.dataset.state === value) return false;
  element.dataset.state = value;
  return true;
}

function placeSharedNavAfterSkipLink() {
  const nav = globalThis.__mixmashNav?.element || document.querySelector('.mixnav');
  if (!elements.skipLink || !nav) return false;
  if (elements.skipLink.nextElementSibling !== nav) {
    elements.skipLink.insertAdjacentElement('afterend', nav);
  }
  return true;
}

function installSharedNavFocusOrder() {
  if (placeSharedNavAfterSkipLink() || !document.body || typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(() => {
    if (placeSharedNavAfterSkipLink()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true });
  document.addEventListener('DOMContentLoaded', placeSharedNavAfterSkipLink, { once: true });
}

function assetKey(family, id) {
  return `${family}:${id}`;
}

function splitAsset(reference) {
  const [family, id] = String(reference).split(':');
  return { family, id, key: assetKey(family, id) };
}

function humanise(value) {
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchJson(url, label, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return response.json();
}

function assertSceneContract(scene, manifest) {
  if (scene?.contractVersion !== RENDER_CONTRACT.version || manifest?.contractVersion !== RENDER_CONTRACT.version) {
    throw new Error(`Golden-scene data must target render contract v${RENDER_CONTRACT.version}.`);
  }
  if (scene?.decision !== RENDER_CONTRACT.decision || manifest?.decision !== RENDER_CONTRACT.decision) {
    throw new Error(`Golden-scene data must target ${RENDER_CONTRACT.decision}.`);
  }
  if (!Array.isArray(scene.beats) || scene.beats.length !== 8) {
    throw new Error('Golden-scene data must define the exact eight-beat sequence.');
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new Error('Golden-slice manifest has no assets.');
  }
}

function buildSceneIndexes() {
  state.manifestAssets = new Map(state.manifest.assets.map((asset) => [assetKey(asset.family, asset.id), asset]));
  state.artistTestAssets = new Set(state.manifest.assets
    .filter((asset) => asset.artistTest)
    .map((asset) => assetKey(asset.family, asset.id)));
  let elapsed = 0;
  state.beatOffsets = state.scene.beats.map((beat) => {
    const offset = elapsed;
    elapsed += beat.durationMs;
    return offset;
  });
  state.totalDurationMs = Math.max(1, elapsed);
}

function canonicalRuntimeAssetsForScope(indexMeta, manifest, scope) {
  const assets = Array.isArray(indexMeta?.assets) ? indexMeta.assets : [];
  if (scope === 'full') return assets;
  if (scope !== 'artist-test') return [];
  const selectedStates = new Map((manifest?.assets || [])
    .filter((asset) => asset.artistTest)
    .map((asset) => [assetKey(asset.family, asset.id), new Set(asset.artistTestStates || [])]));
  const selectedAssets = [];
  for (const asset of assets) {
    const selected = selectedStates.get(assetKey(asset.family, asset.id));
    if (!selected) continue;
    const states = {};
    for (const [name, assetState] of Object.entries(asset.states || {})) {
      if (selected.has(name)) states[name] = assetState;
    }
    if (!Object.keys(states).length) continue;
    selectedAssets.push(Object.freeze({
      family: asset.family,
      id: asset.id,
      class: asset.class,
      anchor: asset.anchor,
      screenOffset: asset.screenOffset,
      canvas: asset.canvas,
      footprint: asset.footprint,
      fallback: asset.fallback,
      fallbackSprite: asset.fallbackSprite,
      states: Object.freeze(states),
    }));
  }
  return Object.freeze(selectedAssets);
}

async function manifestIdentityHash(manifest) {
  return sha256Bytes(new TextEncoder().encode(JSON.stringify(manifest)));
}

async function verifyRuntimeIndexIdentity(indexMeta, manifest) {
  if (indexMeta?.identityVerified !== true) throw new Error('Runtime index identity was not independently verified.');
  if (indexMeta.runtimeIdentitySchema !== RUNTIME_IDENTITY_SCHEMA) {
    throw new Error(`Runtime identity schema must be ${RUNTIME_IDENTITY_SCHEMA}.`);
  }
  if (indexMeta.scope !== 'full') throw new Error('Golden-scene review requires the complete full-scope runtime index.');
  const manifestHash = await manifestIdentityHash(manifest);
  if (indexMeta.manifestHash !== manifestHash) {
    throw new Error(`Runtime index manifest hash ${indexMeta.manifestHash || 'missing'} does not match computed ${manifestHash}.`);
  }
  const fullHash = await runtimeAssetIdentityHash(canonicalRuntimeAssetsForScope(indexMeta, manifest, 'full'));
  const artistTestHash = await runtimeAssetIdentityHash(canonicalRuntimeAssetsForScope(indexMeta, manifest, 'artist-test'));
  if (indexMeta.runtimeAssetHash !== fullHash || indexMeta.runtimeAssetHashes?.full !== fullHash) {
    throw new Error('Runtime index full-scope hash does not match its complete ordered normalized assets.');
  }
  if (indexMeta.runtimeAssetHashes?.['artist-test'] !== artistTestHash) {
    throw new Error('Runtime index artist-test hash does not match its complete ordered normalized scoped assets.');
  }
  return Object.freeze({
    ...indexMeta,
    manifestHash,
    runtimeAssetHash: fullHash,
    runtimeAssetHashes: Object.freeze({ full: fullHash, 'artist-test': artistTestHash }),
    identityVerified: true,
    manifestIdentityVerified: true,
    scopedIdentityVerified: true,
  });
}

function scopeRequirements(scope = state.scope) {
  const assets = (state.manifest?.assets || []).filter((asset) => (
    scope === 'artist-test' ? asset.artistTest : true
  ));
  const indexedByKey = new Map((state.indexMeta?.assets || []).map((asset) => [assetKey(asset.family, asset.id), asset]));
  let requiredExports = 0;
  let indexedExports = 0;
  let readyAssets = 0;
  for (const asset of assets) {
    const selectedNames = scope === 'artist-test' ? new Set(asset.artistTestStates || []) : null;
    const states = asset.states.filter((candidate) => !selectedNames || selectedNames.has(candidate.name));
    const indexed = indexedByKey.get(assetKey(asset.family, asset.id));
    let assetReady = states.length > 0;
    for (const assetState of states) {
      requiredExports += assetState.frames;
      const indexedFrames = indexed?.states?.[assetState.name]?.frames?.length || 0;
      indexedExports += Math.min(assetState.frames, indexedFrames);
      if (indexedFrames !== assetState.frames) assetReady = false;
    }
    if (assetReady) readyAssets += 1;
  }
  return {
    assets: assets.length,
    readyAssets,
    requiredExports,
    indexedExports,
  };
}

function scopePrimeSelection(scope = state.scope) {
  return (state.manifest?.assets || [])
    .filter((asset) => scope === 'artist-test' ? asset.artistTest : true)
    .map((asset) => ({
      family: asset.family,
      id: asset.id,
      states: scope === 'artist-test'
        ? [...(asset.artistTestStates || [])]
        : asset.states.map((candidate) => candidate.name),
    }));
}

function scopePackageQuality(scope = state.scope) {
  const requirements = scopeRequirements(scope);
  const cacheCoverage = commissionedCache.getFrameCoverage({
    assets: scopePrimeSelection(scope),
    reducedMotion: false,
  });
  const quality = {
    requiredFrames: requirements.requiredExports,
    indexedFrames: cacheCoverage.expected,
    cachedFrames: cacheCoverage.cached,
    pendingFrames: cacheCoverage.pending,
    failedFrames: cacheCoverage.failed,
    missingFrames: cacheCoverage.missing,
    complete: requirements.requiredExports > 0
      && cacheCoverage.expected === requirements.requiredExports
      && cacheCoverage.cached === requirements.requiredExports
      && cacheCoverage.pending === 0
      && cacheCoverage.failed === 0
      && cacheCoverage.missing === 0
      && cacheCoverage.complete,
  };
  return Object.freeze(quality);
}

function packageQualityMeetsContract(quality, scope = state.scope) {
  const requirements = scopeRequirements(scope);
  return requirements.requiredExports > 0
    && quality?.requiredFrames === requirements.requiredExports
    && quality?.indexedFrames === requirements.requiredExports
    && quality?.cachedFrames === requirements.requiredExports
    && quality?.pendingFrames === 0
    && quality?.failedFrames === 0
    && quality?.missingFrames === 0
    && quality?.complete === true;
}

function approvalReportSummary(evidence = state.approvalEvidence[state.scope]) {
  return {
    status: evidence?.status || 'loading',
    valid: evidence?.valid === true,
    url: evidence?.url || APPROVAL_REPORT_URLS[state.scope].href,
    scope: evidence?.report?.scope || APPROVAL_REPORT_SCOPES[state.scope],
    manifestHash: evidence?.report?.manifestHash || null,
    packageHash: evidence?.report?.artifactDigests?.packageHash || null,
    reasons: [...(evidence?.reasons || ['Strict approval evidence has not loaded.'])],
  };
}

function indexedRuntimeAssetHash(scope) {
  if (state.indexMeta?.scopedIdentityVerified !== true) return null;
  const reportScope = APPROVAL_REPORT_SCOPES[scope];
  return state.indexMeta?.runtimeAssetHashes?.[reportScope]
    || (reportScope === 'full' ? state.indexMeta?.runtimeAssetHash : null);
}

function approvalPackageContext(scope = state.scope) {
  const evidence = state.approvalEvidence[scope];
  const report = evidence?.report;
  const digests = report?.artifactDigests;
  const runtimeAssetHash = indexedRuntimeAssetHash(scope);
  const runtimeIdentitySchema = state.indexMeta?.runtimeIdentitySchema;
  const reviewSurfaceHash = state.reviewSurface.status === 'valid' ? state.reviewSurface.hash : null;
  if (evidence?.valid !== true
    || report?.scope !== APPROVAL_REPORT_SCOPES[scope]
    || !state.indexMeta?.manifestHash
    || report?.manifestHash !== state.indexMeta.manifestHash
    || !digests?.packageHash
    || !digests?.runtimeAssetHash
    || state.indexMeta?.identityVerified !== true
    || state.indexMeta?.manifestIdentityVerified !== true
    || state.indexMeta?.scopedIdentityVerified !== true
    || runtimeIdentitySchema !== RUNTIME_IDENTITY_SCHEMA
    || digests?.runtimeIdentitySchema !== runtimeIdentitySchema
    || digests.runtimeAssetHash !== runtimeAssetHash
    || !/^[a-f0-9]{64}$/.test(reviewSurfaceHash || '')) return null;
  return {
    key: [scope, report.manifestHash, runtimeIdentitySchema, digests.packageHash, digests.runtimeAssetHash, reviewSurfaceHash].join('|'),
    scope,
    manifestHash: report.manifestHash,
    packageHash: digests.packageHash,
    runtimeAssetHash: digests.runtimeAssetHash,
    runtimeIdentitySchema,
    reviewSurfaceHash,
  };
}

function createReviewCoverage(scope, contextKey = null) {
  if (scope === 'artist-test') {
    return {
      contextKey,
      matrix: false,
      animationMs: 0,
      lastAnimationTime: null,
      frameTimings: [],
    };
  }
  return {
    contextKey,
    beatZooms: new Set(),
    lightingProfiles: new Set(),
    proceduralFallbackAt1x: false,
    reducedMotionCommissionedAt1x: false,
    frameTimings: [],
  };
}

function syncReviewCoverageContext(scope = state.scope) {
  const context = approvalPackageContext(scope);
  const contextKey = context?.key || null;
  if (state.reviewCoverage[scope]?.contextKey !== contextKey) {
    state.reviewCoverage[scope] = createReviewCoverage(scope, contextKey);
    const receipt = state.approvalReceipts[scope];
    if (receipt && (!context
      || receipt.manifestHash !== context.manifestHash
      || receipt.packageHash !== context.packageHash
      || receipt.runtimeAssetHash !== context.runtimeAssetHash
      || receipt.runtimeIdentitySchema !== context.runtimeIdentitySchema
      || receipt.reviewSurfaceHash !== context.reviewSurfaceHash)) {
      state.approvalReceipts[scope] = null;
      if (scope === state.scope) prepareReceiptDownload(null);
    }
  }
  return { coverage: state.reviewCoverage[scope], context };
}

function packageContextSummary(scope = state.scope) {
  const context = approvalPackageContext(scope);
  if (!context) return null;
  return {
    scope: context.scope,
    manifestHash: context.manifestHash,
    packageHash: context.packageHash,
    runtimeAssetHash: context.runtimeAssetHash,
    runtimeIdentitySchema: context.runtimeIdentitySchema,
    reviewSurfaceHash: context.reviewSurfaceHash,
  };
}

function beatZoomLightingTuple(beat, zoom, lighting = beat.lighting) {
  return `${beat.id}@${zoom.toFixed(1)}x#${lighting}`;
}

function requiredBeatZoomConditions() {
  return (state.scene?.beats || []).flatMap((beat) => (
    GOLDEN_REVIEW_ZOOMS.map((zoom) => beatZoomLightingTuple(beat, zoom))
  ));
}

function validateApprovalReport(report, scope) {
  const reasons = [];
  const requirements = scopeRequirements(scope);
  const expectedScope = APPROVAL_REPORT_SCOPES[scope];
  const counts = report?.counts || {};
  const digests = report?.artifactDigests || {};
  const digestPattern = /^[a-f0-9]{64}$/;
  const indexedRuntimeHash = indexedRuntimeAssetHash(scope);
  const expect = (condition, message) => {
    if (!condition) reasons.push(message);
  };

  expect(report?.reportVersion === 1, 'Report schema version is not 1.');
  expect(report?.scope === expectedScope, `Report scope must be ${expectedScope}.`);
  expect(report?.contractVersion === RENDER_CONTRACT.version, `Report must target contract v${RENDER_CONTRACT.version}.`);
  expect(report?.decision === RENDER_CONTRACT.decision, `Report must target ${RENDER_CONTRACT.decision}.`);
  expect(Boolean(state.indexMeta?.manifestHash), 'Runtime index has no manifest hash.');
  expect(report?.manifestHash === state.indexMeta?.manifestHash, 'Report and runtime-index manifest hashes differ.');
  expect(state.indexMeta?.version === COMMISSIONED_INDEX_VERSION, `Runtime index schema must be v${COMMISSIONED_INDEX_VERSION}.`);
  expect(state.indexMeta?.runtimeIdentitySchema === RUNTIME_IDENTITY_SCHEMA, `Runtime identity schema must be ${RUNTIME_IDENTITY_SCHEMA}.`);
  expect(state.indexMeta?.identityVerified === true, 'Runtime index asset identity was not independently verified.');
  expect(state.indexMeta?.manifestIdentityVerified === true, 'Fetched manifest identity was not independently verified.');
  expect(state.indexMeta?.scopedIdentityVerified === true, 'Runtime index scoped identities were not independently verified.');
  expect(report?.approval === true, 'Report was not generated in strict approval mode.');
  expect(report?.passed === true, 'Strict validator did not pass.');
  expect(report?.approvalReady === true, 'Strict validator did not mark the package approval-ready.');
  expect(report?.machineReady === true, 'Approval report did not pass the fail-closed machine-ready gate.');
  expect(report?.indexVerification?.passed === true, 'Runtime-index verification did not pass.');
  expect(digests.algorithm === 'SHA-256', 'Artifact evidence must use SHA-256.');
  expect(digests.scope === expectedScope, `Artifact evidence scope must be ${expectedScope}.`);
  expect(digests.complete === true, 'Artifact byte evidence is incomplete.');
  expect(digests.runtimeIdentitySchema === RUNTIME_IDENTITY_SCHEMA, 'Artifact evidence does not bind the runtime metadata schema.');
  expect(digestPattern.test(digests.runtimeAssetHash || ''), 'Runtime asset hash is invalid.');
  expect(digestPattern.test(digests.packageHash || ''), 'Package hash is invalid.');
  expect(digests.runtimeAssetHash === indexedRuntimeHash, 'Strict report and runtime-index asset hashes differ.');
  expect(Array.isArray(digests.exports) && digests.exports.length === requirements.requiredExports, 'Artifact evidence does not cover every scoped export.');
  expect(Array.isArray(digests.editableSources) && digests.editableSources.length === requirements.assets, 'Artifact evidence does not cover every scoped editable source.');
  expect((digests.exports || []).every((entry) => digestPattern.test(entry?.sha256 || '')), 'One or more export byte hashes are invalid.');
  expect((digests.editableSources || []).every((entry) => digestPattern.test(entry?.sha256 || '')), 'One or more editable-source byte hashes are invalid.');
  expect(counts.assets === requirements.assets, `Expected exactly ${requirements.assets} scoped assets.`);
  expect(counts.expectedExports === requirements.requiredExports, `Expected exactly ${requirements.requiredExports} scoped exports.`);
  expect(counts.presentExports === requirements.requiredExports, 'Not every required export is present.');
  expect(counts.missingExports === 0, 'Strict report still contains missing exports.');
  expect(counts.editableSources === requirements.assets, 'Not every scoped asset has an editable source.');
  expect(counts.errors === 0 && Array.isArray(report?.errors) && report.errors.length === 0, 'Strict report contains validation errors.');
  expect(counts.warnings === 0 && Array.isArray(report?.warnings) && report.warnings.length === 0, 'Strict report contains validation warnings.');

  return {
    status: reasons.length ? 'invalid' : 'valid',
    valid: reasons.length === 0,
    url: APPROVAL_REPORT_URLS[scope].href,
    reasons,
    report,
  };
}

async function loadApprovalReport(scope) {
  const url = APPROVAL_REPORT_URLS[scope];
  invalidateHumanChecks(scope);
  try {
    const report = await fetchJson(url, `${scope} strict approval report`, { cache: 'no-store' });
    state.approvalEvidence[scope] = validateApprovalReport(report, scope);
  } catch (error) {
    state.approvalEvidence[scope] = {
      status: 'unavailable',
      valid: false,
      url: url.href,
      reasons: [error?.message || 'Strict approval report is unavailable.'],
      report: null,
    };
  }
  syncReviewCoverageContext(scope);
}

async function loadApprovalReports() {
  await Promise.all(Object.keys(APPROVAL_REPORT_URLS).map(loadApprovalReport));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(stableJson(value));
  return sha256Bytes(bytes);
}

async function computeReviewSurfaceEvidence() {
  try {
    const resources = await Promise.all(REVIEW_SURFACE_RESOURCES.map(async (resource) => {
      const response = await fetch(resource.url, { cache: 'no-store' });
      if (!response?.ok || typeof response.arrayBuffer !== 'function') {
        throw new Error(`${resource.path} returned HTTP ${response?.status ?? 'invalid response'}`);
      }
      const bytes = await response.arrayBuffer();
      return Object.freeze({
        path: resource.path,
        bytes: bytes.byteLength,
        sha256: await sha256Bytes(bytes),
      });
    }));
    const hash = await sha256({
      contract: 'marsscape-review-surface/v1',
      resources: resources.map(({ path, bytes, sha256: digest }) => ({ path, bytes, sha256: digest })),
    });
    return {
      status: 'valid',
      algorithm: 'SHA-256',
      hash,
      resources,
      reasons: [],
    };
  } catch (error) {
    return {
      status: 'unavailable',
      algorithm: 'SHA-256',
      hash: null,
      resources: [],
      reasons: [error?.message || 'Review-surface bytes could not be hashed.'],
    };
  }
}

function reviewSurfaceSummary() {
  return {
    status: state.reviewSurface.status,
    valid: state.reviewSurface.status === 'valid' && /^[a-f0-9]{64}$/.test(state.reviewSurface.hash || ''),
    algorithm: state.reviewSurface.algorithm,
    hash: state.reviewSurface.hash,
    resources: state.reviewSurface.resources.map((resource) => ({ ...resource })),
    reasons: [...state.reviewSurface.reasons],
  };
}

function approvalStorageKey(
  scope,
  packageHash = state.approvalEvidence[scope]?.report?.artifactDigests?.packageHash,
  reviewSurfaceHash = state.reviewSurface.hash,
) {
  return `${APPROVAL_STORAGE_PREFIX}:${scope}:${packageHash || 'missing-package'}:${reviewSurfaceHash || 'missing-review-surface'}`;
}

function receiptSummary(receipt = state.approvalReceipts[state.scope]) {
  if (!receipt) return null;
  return {
    schema: receipt.schema,
    receiptId: receipt.receiptId,
    recordedAt: receipt.recordedAt,
    scope: receipt.scope,
    manifestHash: receipt.manifestHash,
    packageHash: receipt.packageHash,
    runtimeAssetHash: receipt.runtimeAssetHash,
    runtimeIdentitySchema: receipt.runtimeIdentitySchema,
    reviewSurfaceHash: receipt.reviewSurfaceHash,
    integrityDigest: receipt.integrityDigest,
    localOnly: true,
  };
}

async function verifyStoredReceipt(receipt, scope) {
  if (!receipt || receipt.schema !== APPROVAL_RECEIPT_SCHEMA) return false;
  if (!humanReviewDomMeetsContract()) return false;
  const context = approvalPackageContext(scope);
  if (!context || receipt.scope !== APPROVAL_REPORT_SCOPES[scope]) return false;
  if (receipt.manifestHash !== context.manifestHash) return false;
  if (receipt.packageHash !== context.packageHash) return false;
  if (receipt.runtimeAssetHash !== context.runtimeAssetHash) return false;
  if (receipt.runtimeIdentitySchema !== context.runtimeIdentitySchema) return false;
  if (receipt.reviewSurfaceHash !== context.reviewSurfaceHash) return false;
  if (receipt.contractVersion !== RENDER_CONTRACT.version || receipt.decision !== RENDER_CONTRACT.decision) return false;
  if (!packageQualityMeetsContract(scopePackageQuality(scope), scope)) return false;
  if (!receiptRendererReviewMeetsContract(receipt, scope)) return false;
  if (receipt.integrityDigest?.algorithm !== 'SHA-256'
    || receipt.integrityDigest?.purpose !== 'client-integrity-only-not-authentication'
    || receipt.integrityDigest?.authenticated !== false
    || !/^[a-f0-9]{64}$/.test(receipt.integrityDigest?.value || '')) return false;
  const { integrityDigest, ...payload } = receipt;
  return await sha256(payload) === integrityDigest.value;
}

async function loadStoredReceipts() {
  for (const scope of Object.keys(APPROVAL_REPORT_URLS)) {
    try {
      const raw = globalThis.localStorage?.getItem(approvalStorageKey(scope));
      if (!raw) continue;
      const receipt = JSON.parse(raw);
      if (await verifyStoredReceipt(receipt, scope)) state.approvalReceipts[scope] = receipt;
      else addWarning({ code: 'APPROVAL_RECEIPT_INVALID', id: scope, response: 'Ignored local receipt with invalid package, review surface, human-check contract, or integrity digest.' });
    } catch (error) {
      addWarning({ code: 'APPROVAL_RECEIPT_UNREADABLE', id: scope, response: `${error?.message || 'Local receipt could not be read'}.` });
    }
  }
}

function canonicalHumanReviewInputs() {
  if (!elements.reviewChecklist) return [];
  const inputs = [...elements.reviewChecklist.querySelectorAll('input[name="reviewCriterion"], input[type="checkbox"]')];
  if (inputs.length !== CANONICAL_HUMAN_CHECKS.length) return [];
  return inputs.every((input, index) => {
    const expected = CANONICAL_HUMAN_CHECKS[index];
    return input.id === expected.id
      && input.type === 'checkbox'
      && input.name === 'reviewCriterion'
      && input.value === expected.value;
  }) ? inputs : [];
}

function humanReviewDomMeetsContract() {
  return canonicalHumanReviewInputs().length === CANONICAL_HUMAN_CHECKS.length;
}

function selectedHumanChecks() {
  const contextKey = humanApprovalContextKey();
  if (!contextKey || state.humanCheckContexts[state.scope] !== contextKey) return [];
  const selected = state.humanChecks[state.scope] || new Set();
  return CANONICAL_HUMAN_CHECK_VALUES.filter((value) => selected.has(value));
}

function captureHumanChecks() {
  const inputs = canonicalHumanReviewInputs();
  if (inputs.length !== CANONICAL_HUMAN_CHECKS.length) {
    invalidateHumanChecks();
    syncHumanReviewControls();
    return;
  }
  const contextKey = humanApprovalContextKey();
  if (!contextKey) {
    invalidateHumanChecks();
    syncHumanReviewControls();
    return;
  }
  if (state.humanCheckContexts[state.scope] !== contextKey) {
    state.humanChecks[state.scope].clear();
    state.humanCheckContexts[state.scope] = contextKey;
  }
  state.humanChecks[state.scope] = new Set(inputs.filter((input) => input.checked).map((input) => input.value));
}

function invalidateHumanChecks(scope = state.scope) {
  state.humanChecks[scope]?.clear();
  state.humanCheckContexts[scope] = null;
}

function humanApprovalContextKey(scope = state.scope) {
  const packageContext = approvalPackageContext(scope);
  if (scope !== state.scope
    || !packageContext
    || !humanReviewDomMeetsContract()
    || state.zoom !== RENDER_CONTRACT.pixelDensity.normalGameplayZoom
    || state.renderMode === 'procedural'
    || state.forceFallback
    || state.reducedMotion
    || !currentFrameIsApprovalQuality()) return null;
  return [
    scope,
    packageContext.manifestHash,
    packageContext.runtimeIdentitySchema,
    packageContext.packageHash,
    packageContext.runtimeAssetHash,
    packageContext.reviewSurfaceHash,
    state.zoom,
    state.renderMode,
    state.forceFallback,
    state.reducedMotion,
  ].join('|');
}

function humanApprovalContextBlocker() {
  if (!humanReviewDomMeetsContract()) return 'the seven canonical human-check IDs do not exactly match the deployed checklist';
  if (state.reviewSurface.status !== 'valid') return `review-surface integrity is unavailable: ${state.reviewSurface.reasons[0] || 'hash could not be computed'}`;
  if (state.approvalEvidence[state.scope]?.valid !== true) return 'strict commissioned evidence is not valid';
  if (state.zoom !== RENDER_CONTRACT.pixelDensity.normalGameplayZoom) return 'the view is not at 1.0x normal gameplay zoom';
  if (state.renderMode === 'procedural') return 'procedural-only mode is active';
  if (state.forceFallback) return 'forced procedural fallback is active';
  if (state.reducedMotion) return 'reduced-motion inspection is active; return to animation-enabled review before attesting';
  if (!currentFrameIsApprovalQuality()) return 'the current view is not fully commissioned or has runtime fallback faults';
  return null;
}

function syncHumanReviewControls() {
  const canonicalInputs = canonicalHumanReviewInputs();
  const canonicalDom = canonicalInputs.length === CANONICAL_HUMAN_CHECKS.length;
  const contextKey = humanApprovalContextKey();
  if (!contextKey || state.humanCheckContexts[state.scope] !== contextKey) {
    state.humanChecks[state.scope].clear();
    state.humanCheckContexts[state.scope] = contextKey;
  }
  const selected = contextKey ? state.humanChecks[state.scope] : new Set();
  for (const input of elements.reviewChecklist?.querySelectorAll('input[type="checkbox"]') || []) {
    input.disabled = !contextKey || !canonicalDom;
    input.checked = canonicalDom && selected.has(input.value);
  }
  elements.reviewChecklist?.setAttribute('aria-disabled', String(!contextKey));
  const scopeLabel = state.scope === 'artist-test' ? 'paid artist test' : 'golden scene';
  const contextText = contextKey
    ? `Acceptance checks enabled for the current ${scopeLabel} package at 1.0x. Changing scope, package, zoom, render mode, fallback, or motion invalidates these checks.`
    : `Acceptance checks disabled: ${humanApprovalContextBlocker() || 'a valid commissioned approval context is not active'}.`;
  setDataStateIfChanged(elements.reviewContextStatus, contextKey ? 'ready' : 'blocked');
  setTextIfChanged(elements.reviewContextStatus, contextText);
}

function approvalPerformanceSummary(scope = state.scope) {
  const { coverage } = syncReviewCoverageContext(scope);
  const samples = coverage?.frameTimings || [];
  const dropped = samples.filter((duration) => duration > RENDER_CONTRACT.performance.frameBudgetMs).length;
  const droppedRatio = samples.length ? dropped / samples.length : 0;
  const p95Ms = percentile(samples, 0.95);
  return {
    samples: samples.length,
    requiredSamples: RENDER_CONTRACT.performance.sampleFrames,
    p95Ms,
    p95LimitMs: RENDER_CONTRACT.performance.p95FrameMs,
    droppedRatio,
    droppedRatioLimit: RENDER_CONTRACT.performance.maxDroppedFrameRatio,
    qualification: {
      zoom: RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
      sourceRequirement: 'fully-commissioned',
      motion: 'animated',
    },
    pass: samples.length >= RENDER_CONTRACT.performance.sampleFrames
      && p95Ms <= RENDER_CONTRACT.performance.p95FrameMs
      && droppedRatio <= RENDER_CONTRACT.performance.maxDroppedFrameRatio,
  };
}

function approvalCoverageSummary(scope = state.scope) {
  const { coverage, context } = syncReviewCoverageContext(scope);
  const packageContext = context ? packageContextSummary(scope) : null;
  if (scope === 'artist-test') {
    const requiredAnimationMs = RENDER_CONTRACT.animation.clips.idle.frames
      * RENDER_CONTRACT.animation.clips.idle.frameMs;
    const completedAnimationMs = Math.round(coverage.animationMs);
    const animationComplete = coverage.animationMs >= requiredAnimationMs;
    return {
      contract: 'artist-test-review-conditions/v2',
      packageContext,
      matrix: coverage.matrix,
      animationMs: completedAnimationMs,
      requiredAnimationMs,
      conditions: {
        commissionedMatrixAt1x: {
          completed: coverage.matrix,
          required: true,
          zoom: RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
          sourceRequirement: 'fully-commissioned',
        },
        functionalAnimationAt1x: {
          completed: animationComplete,
          completedMs: completedAnimationMs,
          requiredMs: requiredAnimationMs,
          zoom: RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
          sourceRequirement: 'fully-commissioned',
          motion: 'animated',
        },
      },
      complete: Boolean(packageContext && coverage.matrix && animationComplete),
    };
  }
  const requiredBeatZooms = requiredBeatZoomConditions();
  const completedBeatZooms = requiredBeatZooms.filter((condition) => coverage.beatZooms.has(condition));
  const missingBeatZooms = requiredBeatZooms.filter((condition) => !coverage.beatZooms.has(condition));
  const completedLighting = GOLDEN_REVIEW_LIGHTING.filter((profile) => coverage.lightingProfiles.has(profile));
  const missingLighting = GOLDEN_REVIEW_LIGHTING.filter((profile) => !coverage.lightingProfiles.has(profile));
  const reviewedBeats = [...new Set(completedBeatZooms.map((condition) => condition.split('@')[0]))];
  const complete = Boolean(packageContext
    && missingBeatZooms.length === 0
    && missingLighting.length === 0
    && coverage.proceduralFallbackAt1x
    && coverage.reducedMotionCommissionedAt1x);
  return {
    contract: 'golden-scene-review-conditions/v3',
    packageContext,
    reviewedBeats,
    requiredBeats: state.scene?.beats.map((beat) => beat.id) || [],
    beatZooms: {
      tupleSchema: 'beat@zoom#canonical-lighting/v1',
      completed: completedBeatZooms,
      required: requiredBeatZooms,
      missing: missingBeatZooms,
      completedCount: completedBeatZooms.length,
      requiredCount: requiredBeatZooms.length,
      sourceRequirement: 'fully-commissioned',
      motion: 'animated',
    },
    lightingProfiles: {
      completed: completedLighting,
      required: [...GOLDEN_REVIEW_LIGHTING],
      missing: missingLighting,
      completedCount: completedLighting.length,
      requiredCount: GOLDEN_REVIEW_LIGHTING.length,
      requiredZoom: RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
      sourceRequirement: 'fully-commissioned',
      motion: 'animated',
    },
    proceduralFallbackAt1x: {
      completed: coverage.proceduralFallbackAt1x,
      required: true,
      zoom: RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
      renderMode: 'procedural',
    },
    reducedMotionCommissionedAt1x: {
      completed: coverage.reducedMotionCommissionedAt1x,
      required: true,
      zoom: RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
      sourceRequirement: 'fully-commissioned',
    },
    complete,
  };
}

function sameOrderedStrings(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function conditionLedgerMeetsContract(ledger, scope) {
  if (!ledger || ledger.complete !== true) return false;
  const context = packageContextSummary(scope);
  if (!context
    || ledger.packageContext?.scope !== context.scope
    || ledger.packageContext?.manifestHash !== context.manifestHash
    || ledger.packageContext?.packageHash !== context.packageHash
    || ledger.packageContext?.runtimeAssetHash !== context.runtimeAssetHash
    || ledger.packageContext?.runtimeIdentitySchema !== context.runtimeIdentitySchema
    || ledger.packageContext?.reviewSurfaceHash !== context.reviewSurfaceHash) return false;
  if (scope === 'artist-test') {
    const requiredAnimationMs = RENDER_CONTRACT.animation.clips.idle.frames
      * RENDER_CONTRACT.animation.clips.idle.frameMs;
    return ledger.contract === 'artist-test-review-conditions/v2'
      && ledger.conditions?.commissionedMatrixAt1x?.completed === true
      && ledger.conditions?.commissionedMatrixAt1x?.zoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom
      && ledger.conditions?.functionalAnimationAt1x?.completed === true
      && ledger.conditions?.functionalAnimationAt1x?.requiredMs === requiredAnimationMs
      && ledger.conditions?.functionalAnimationAt1x?.completedMs >= requiredAnimationMs;
  }
  const requiredBeatZooms = requiredBeatZoomConditions();
  return ledger.contract === 'golden-scene-review-conditions/v3'
    && ledger.beatZooms?.tupleSchema === 'beat@zoom#canonical-lighting/v1'
    && sameOrderedStrings(ledger.beatZooms?.required, requiredBeatZooms)
    && sameOrderedStrings(ledger.beatZooms?.completed, requiredBeatZooms)
    && Array.isArray(ledger.beatZooms?.missing)
    && ledger.beatZooms.missing.length === 0
    && ledger.beatZooms.sourceRequirement === 'fully-commissioned'
    && ledger.beatZooms.motion === 'animated'
    && sameOrderedStrings(ledger.lightingProfiles?.required, [...GOLDEN_REVIEW_LIGHTING])
    && sameOrderedStrings(ledger.lightingProfiles?.completed, [...GOLDEN_REVIEW_LIGHTING])
    && Array.isArray(ledger.lightingProfiles?.missing)
    && ledger.lightingProfiles.missing.length === 0
    && ledger.lightingProfiles.requiredZoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom
    && ledger.lightingProfiles.sourceRequirement === 'fully-commissioned'
    && ledger.proceduralFallbackAt1x?.zoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom
    && ledger.proceduralFallbackAt1x?.renderMode === 'procedural'
    && ledger.proceduralFallbackAt1x?.completed === true
    && ledger.reducedMotionCommissionedAt1x?.zoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom
    && ledger.reducedMotionCommissionedAt1x?.sourceRequirement === 'fully-commissioned'
    && ledger.reducedMotionCommissionedAt1x?.completed === true;
}

function receiptRendererReviewMeetsContract(receipt, scope) {
  const review = receipt?.rendererReview;
  const performance = review?.performance;
  const sources = review?.finalFrameSources;
  return humanReviewDomMeetsContract()
    && conditionLedgerMeetsContract(review?.conditionLedger, scope)
    && packageQualityMeetsContract(review?.packageQuality, scope)
    && review?.zoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom
    && review?.renderMode !== 'procedural'
    && review?.forceFallback === false
    && review?.reducedMotion === false
    && sources?.requested > 0
    && sources?.commissioned === sources.requested
    && sources?.legacy === 0
    && sources?.procedural === 0
    && performance?.pass === true
    && performance?.samples >= RENDER_CONTRACT.performance.sampleFrames
    && performance?.requiredSamples === RENDER_CONTRACT.performance.sampleFrames
    && performance?.p95Ms <= RENDER_CONTRACT.performance.p95FrameMs
    && performance?.droppedRatio <= RENDER_CONTRACT.performance.maxDroppedFrameRatio
    && performance?.qualification?.zoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom
    && performance?.qualification?.sourceRequirement === 'fully-commissioned'
    && performance?.qualification?.motion === 'animated'
    && receipt?.humanReview?.attested === true
    && receipt?.humanReview?.requiredChecks === CANONICAL_HUMAN_CHECK_VALUES.length
    && sameOrderedStrings(receipt?.humanReview?.checks, [...CANONICAL_HUMAN_CHECK_VALUES]);
}

function currentFrameHasValidScopePackage() {
  const cache = commissionedCache.getTelemetry();
  const requirements = scopeRequirements();
  const packageQuality = scopePackageQuality();
  return approvalPackageContext() !== null
    && requirements.requiredExports > 0
    && requirements.indexedExports === requirements.requiredExports
    && requirements.readyAssets === requirements.assets
    && state.frameSources.requested > 0
    && packageQualityMeetsContract(packageQuality)
    && cache.stateFallbacks === 0
    && cache.brokenClips === 0;
}

function currentFrameIsFullyCommissioned() {
  return currentFrameHasValidScopePackage()
    && state.renderMode !== 'procedural'
    && !state.forceFallback
    && state.frameSources.commissioned === state.frameSources.requested
    && state.frameSources.legacy === 0
    && state.frameSources.procedural === 0;
}

function currentFrameIsProceduralOnly() {
  return currentFrameHasValidScopePackage()
    && state.renderMode === 'procedural'
    && !state.forceFallback
    && state.frameSources.procedural === state.frameSources.requested
    && state.frameSources.commissioned === 0
    && state.frameSources.legacy === 0;
}

function currentFrameIsApprovalQuality() {
  return currentFrameIsFullyCommissioned()
    && state.zoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom;
}

function recordApprovalPerformanceSample(coverage, renderMs) {
  coverage.frameTimings.push(renderMs);
  if (coverage.frameTimings.length > RENDER_CONTRACT.performance.sampleFrames) coverage.frameTimings.shift();
}

function noteApprovalCoverage(beat, renderMs) {
  const { coverage, context } = syncReviewCoverageContext();
  if (!coverage || !context) {
    if (coverage && Object.hasOwn(coverage, 'lastAnimationTime')) coverage.lastAnimationTime = null;
    return;
  }
  const normalZoom = state.zoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom;
  const animated = !state.reducedMotion;
  const commissioned = currentFrameIsFullyCommissioned();
  if (state.scope === 'artist-test') {
    if (!commissioned || !normalZoom || !animated) {
      coverage.lastAnimationTime = null;
      return;
    }
    coverage.matrix = true;
    recordApprovalPerformanceSample(coverage, renderMs);
    if (coverage.lastAnimationTime !== null) {
      const delta = Math.max(0, Math.min(50, state.animationTimeMs - coverage.lastAnimationTime));
      coverage.animationMs += delta;
    }
    coverage.lastAnimationTime = state.animationTimeMs;
    return;
  }

  if (commissioned && animated && VALID_ZOOMS.has(state.zoom)) {
    const lighting = effectiveLighting(beat);
    if (lighting === beat.lighting) {
      coverage.beatZooms.add(beatZoomLightingTuple(beat, state.zoom, lighting));
    }
    if (normalZoom) {
      if (GOLDEN_REVIEW_LIGHTING.includes(lighting)) coverage.lightingProfiles.add(lighting);
      recordApprovalPerformanceSample(coverage, renderMs);
    }
  }
  if (commissioned && normalZoom && state.reducedMotion) {
    coverage.reducedMotionCommissionedAt1x = true;
  }
  if (currentFrameIsProceduralOnly() && normalZoom && animated) {
    coverage.proceduralFallbackAt1x = true;
  }
}

function approvalGate() {
  const evidence = state.approvalEvidence[state.scope];
  const requirements = scopeRequirements();
  const packageQuality = scopePackageQuality();
  const coverage = approvalCoverageSummary();
  const approvalPerformance = approvalPerformanceSummary();
  const checks = selectedHumanChecks();
  const requiredChecks = CANONICAL_HUMAN_CHECK_VALUES.length;
  const reasons = [];
  if (!evidence?.valid) reasons.push(...(evidence?.reasons?.length ? evidence.reasons : ['Strict approval evidence is unavailable.']));
  if (state.reviewSurface.status !== 'valid') reasons.push(`Review-surface integrity is unavailable: ${state.reviewSurface.reasons[0] || 'hash could not be computed'}.`);
  if (!humanReviewDomMeetsContract()) reasons.push('The deployed checklist does not exactly match the seven canonical DEC-79 human-check IDs.');
  if (requirements.readyAssets !== requirements.assets || requirements.indexedExports !== requirements.requiredExports) reasons.push('Runtime index does not contain every scoped export.');
  if (!packageQualityMeetsContract(packageQuality)) {
    reasons.push(`Commissioned package cache is incomplete: ${packageQuality.cachedFrames}/${packageQuality.requiredFrames} scoped frames cached; ${packageQuality.failedFrames} failed (${packageQuality.missingFrames} missing), ${packageQuality.pendingFrames} pending.`);
  }
  if (state.zoom !== RENDER_CONTRACT.pixelDensity.normalGameplayZoom) reasons.push('Return to 1.0x normal gameplay zoom.');
  if (state.renderMode === 'procedural' || state.forceFallback) reasons.push('Use a commissioned view without forced fallback.');
  if (state.reducedMotion) reasons.push('Return to animation-enabled review before recording human acceptance.');
  if (!currentFrameIsApprovalQuality()) reasons.push('The active approval view is not fully commissioned or has runtime fallback faults.');
  if (state.scope === 'artist-test') {
    if (!coverage.conditions.commissionedMatrixAt1x.completed) reasons.push('Render the complete paid-test matrix with commissioned assets at 1.0x.');
    if (!coverage.conditions.functionalAnimationAt1x.completed) reasons.push(`Run the paid-test functional animation at 1.0x for ${coverage.conditions.functionalAnimationAt1x.requiredMs} ms (${coverage.conditions.functionalAnimationAt1x.completedMs} ms complete).`);
  } else {
    if (coverage.beatZooms.missing.length) reasons.push(`Review every commissioned beat at 0.5x, 1.0x, and 2.5x under that beat's canonical scene lighting (${coverage.beatZooms.completedCount}/${coverage.beatZooms.requiredCount} beat/zoom/light conditions complete; missing: ${coverage.beatZooms.missing.join(', ')}).`);
    if (coverage.lightingProfiles.missing.length) reasons.push(`Review commissioned lighting at 1.0x for ${coverage.lightingProfiles.missing.join(', ')} (${coverage.lightingProfiles.completedCount}/${coverage.lightingProfiles.requiredCount} profiles complete).`);
    if (!coverage.proceduralFallbackAt1x.completed) reasons.push('Render a procedural-only golden-scene fallback at 1.0x with animation enabled.');
    if (!coverage.reducedMotionCommissionedAt1x.completed) reasons.push('Render the commissioned golden scene with reduced motion at 1.0x.');
  }
  if (!approvalPerformance.pass) {
    reasons.push(approvalPerformance.samples < approvalPerformance.requiredSamples
      ? `Collect ${approvalPerformance.requiredSamples} commissioned, animated 1.0x performance samples (${approvalPerformance.samples}/${approvalPerformance.requiredSamples} complete).`
      : `Performance evidence failed: p95 ${approvalPerformance.p95Ms.toFixed(2)} ms (limit ${approvalPerformance.p95LimitMs} ms), over-budget ${(approvalPerformance.droppedRatio * 100).toFixed(1)}% (limit ${(approvalPerformance.droppedRatioLimit * 100).toFixed(1)}%).`);
  }
  if (checks.length !== requiredChecks) reasons.push(`Complete all ${requiredChecks} human acceptance checks (${checks.length}/${requiredChecks} complete in this approval context).`);
  return {
    ready: reasons.length === 0,
    status: reasons.length === 0 ? 'ready' : 'blocked',
    reasons,
    checks,
    requiredChecks,
    evidence: approvalReportSummary(evidence),
    requirements,
    packageQuality,
    coverage,
    performance: approvalPerformance,
  };
}

function approvalStatusSnapshot() {
  const gate = approvalGate();
  return {
    status: gate.status,
    canRecord: gate.ready,
    reasons: [...gate.reasons],
    evidence: gate.evidence,
    reviewSurface: reviewSurfaceSummary(),
    requirements: gate.requirements,
    packageQuality: gate.packageQuality,
    coverage: gate.coverage,
    conditionLedger: gate.coverage,
    performance: gate.performance,
    humanChecks: {
      completed: [...gate.checks],
      required: gate.requiredChecks,
    },
    receipt: receiptSummary(),
  };
}

function currentApprovalReceipt() {
  const receipt = state.approvalReceipts[state.scope];
  return receipt ? JSON.parse(JSON.stringify(receipt)) : null;
}

function currentBeat() {
  return state.scene?.beats[state.beatIndex] || null;
}

function activeReviewBeat() {
  return state.scope === 'artist-test' ? ARTIST_TEST_SCENE : currentBeat();
}

function currentBeatElapsed() {
  const beat = currentBeat();
  if (!beat) return 0;
  return Math.max(0, Math.min(beat.durationMs, state.sequenceTimeMs - state.beatOffsets[state.beatIndex]));
}

function activeReviewElapsed() {
  return state.scope === 'artist-test'
    ? state.animationTimeMs % ARTIST_TEST_SCENE.durationMs
    : currentBeatElapsed();
}

function syncBeatFromSequenceTime() {
  if (!state.scene) return;
  const clamped = Math.max(0, Math.min(state.totalDurationMs, state.sequenceTimeMs));
  state.sequenceTimeMs = clamped;
  if (clamped >= state.totalDurationMs) {
    state.beatIndex = state.scene.beats.length - 1;
    return;
  }
  const found = state.scene.beats.findIndex((beat, index) => clamped < state.beatOffsets[index] + beat.durationMs);
  state.beatIndex = Math.max(0, found);
}

function setBeat(value, options = {}) {
  if (!state.scene) return false;
  const index = typeof value === 'string'
    ? state.scene.beats.findIndex((beat) => beat.id === value)
    : Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= state.scene.beats.length) {
    throw new RangeError(`Unknown golden-scene beat: ${value}`);
  }
  state.beatIndex = index;
  state.sequenceTimeMs = state.beatOffsets[index];
  if (options.pause !== false) state.playing = false;
  render(true);
  return true;
}

function setLighting(value) {
  if (!VALID_LIGHTING.has(value)) throw new RangeError(`Unknown lighting profile: ${value}`);
  state.lighting = value;
  if (elements.lightingSelect) elements.lightingSelect.value = value;
  render(true);
  return value;
}

function setZoom(value) {
  const zoom = Number(value);
  if (!VALID_ZOOMS.has(zoom)) throw new RangeError(`Unsupported gameplay zoom: ${value}`);
  if (zoom !== state.zoom) invalidateHumanChecks();
  state.zoom = zoom;
  if (elements.zoomSelect) elements.zoomSelect.value = String(zoom);
  render(true);
  return zoom;
}

function setMode(value) {
  if (!VALID_MODES.has(value)) throw new RangeError(`Unknown render mode: ${value}`);
  if (value !== state.renderMode) invalidateHumanChecks();
  state.renderMode = value;
  if (elements.renderModeSelect) elements.renderModeSelect.value = value;
  render(true);
  return value;
}

function setOverlays(value, enabled) {
  const next = typeof value === 'string' ? { [value]: enabled } : value;
  if (!next || typeof next !== 'object') throw new TypeError('Overlay settings must be an object or name/value pair.');
  for (const [name, setting] of Object.entries(next)) {
    if (!Object.hasOwn(state.overlays, name)) throw new RangeError(`Unknown renderer overlay: ${name}`);
    state.overlays[name] = Boolean(setting);
  }
  if (elements.showAnchors) elements.showAnchors.checked = state.overlays.anchors;
  if (elements.showFootprints) elements.showFootprints.checked = state.overlays.footprints;
  if (elements.showLabels) elements.showLabels.checked = state.overlays.labels;
  render(true);
  return { ...state.overlays };
}

function setReducedMotion(value) {
  const enabled = Boolean(value);
  if (enabled !== state.reducedMotion) invalidateHumanChecks();
  state.reducedMotion = enabled;
  if (elements.reducedMotion) elements.reducedMotion.checked = state.reducedMotion;
  render(true);
  return state.reducedMotion;
}

function setScope(value) {
  if (!['artist-test', 'golden-scene'].includes(value)) throw new RangeError(`Unknown review scope: ${value}`);
  if (value !== state.scope) {
    invalidateHumanChecks(state.scope);
    invalidateHumanChecks(value);
  }
  state.scope = value;
  if (value === 'artist-test') state.playing = false;
  if (elements.scopeSelect) elements.scopeSelect.value = value;
  prepareReceiptDownload(state.approvalReceipts[value]);
  render(true);
  return value;
}

function setForceFallback(value) {
  const enabled = Boolean(value);
  if (enabled !== state.forceFallback) invalidateHumanChecks();
  state.forceFallback = enabled;
  if (elements.forceFallback) elements.forceFallback.checked = enabled;
  render(true);
  return enabled;
}

function setSequenceProgress(value) {
  const progress = Number(value);
  if (!Number.isFinite(progress)) throw new TypeError('Sequence progress must be finite.');
  state.sequenceTimeMs = Math.max(0, Math.min(1, progress)) * state.totalDurationMs;
  syncBeatFromSequenceTime();
  render(true);
  return state.sequenceTimeMs / state.totalDurationMs;
}

function advanceModel(milliseconds) {
  const delta = Number(milliseconds);
  if (!Number.isFinite(delta) || delta < 0) throw new TypeError('advanceTime(ms) requires a non-negative finite duration.');
  if (!state.reducedMotion) state.animationTimeMs += delta;
  if (state.playing) {
    state.sequenceTimeMs += delta;
    if (state.sequenceTimeMs >= state.totalDurationMs) {
      state.sequenceTimeMs = state.totalDurationMs;
      state.playing = false;
    }
    syncBeatFromSequenceTime();
  }
}

function absoluteGrid(x, y) {
  const projected = projectGrid(x, y);
  return { x: VIEW.originX + projected.x, y: VIEW.originY + projected.y };
}

function applyCameraTransform(ctx, beat) {
  const camera = absoluteGrid(beat.camera.centre[0], beat.camera.centre[1]);
  ctx.translate(VIEW.canvasWidth / 2, VIEW.canvasHeight / 2);
  ctx.scale(state.zoom, state.zoom);
  ctx.translate(-camera.x, -camera.y);
}

function diamondPath(ctx, x, y, width, height) {
  ctx.beginPath();
  ctx.moveTo(x, y - height / 2);
  ctx.lineTo(x + width / 2, y);
  ctx.lineTo(x, y + height / 2);
  ctx.lineTo(x - width / 2, y);
  ctx.closePath();
}

function hash2(x, y) {
  return Math.abs(Math.imul(Math.round(x * 10) + 31, 73856093) ^ Math.imul(Math.round(y * 10) + 17, 19349663));
}

function terrainCellMap() {
  const cells = new Map();
  for (const entry of state.scene.terrain) {
    const { id } = splitAsset(entry.asset);
    for (const coordinate of entry.cells || []) cells.set(`${coordinate[0]},${coordinate[1]}`, id);
  }
  return cells;
}

function drawBoardShadow(ctx) {
  const north = absoluteGrid(0, 0);
  const east = absoluteGrid(VIEW.columns - 1, 0);
  const south = absoluteGrid(VIEW.columns - 1, VIEW.rows - 1);
  const west = absoluteGrid(0, VIEW.rows - 1);
  ctx.beginPath();
  ctx.moveTo(north.x, north.y + 18);
  ctx.lineTo(east.x + 39, east.y + 24);
  ctx.lineTo(south.x, south.y + 54);
  ctx.lineTo(west.x - 39, west.y + 24);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fill();
}

function drawBoardSurface(ctx) {
  const north = absoluteGrid(0, 0);
  const east = absoluteGrid(VIEW.columns - 1, 0);
  const south = absoluteGrid(VIEW.columns - 1, VIEW.rows - 1);
  const west = absoluteGrid(0, VIEW.rows - 1);
  ctx.beginPath();
  ctx.moveTo(north.x, north.y - 21);
  ctx.lineTo(east.x + 42, east.y);
  ctx.lineTo(south.x, south.y + 21);
  ctx.lineTo(west.x - 42, west.y);
  ctx.closePath();
  ctx.fillStyle = '#70361f';
  ctx.fill();
}

function drawTerrainProcedural(ctx, id, x, y) {
  const colours = TERRAIN_COLOURS[id] || TERRAIN_COLOURS.base_soil;
  const variant = hash2(x, y);
  const position = absoluteGrid(x, y);
  diamondPath(ctx, position.x, position.y, RENDER_CONTRACT.tile.drawnWidth, RENDER_CONTRACT.tile.drawnHeight);
  ctx.fillStyle = variant % 3 === 0 ? colours[1] : colours[0];
  ctx.fill();
  ctx.strokeStyle = 'rgba(42, 21, 15, 0.62)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(position.x - RENDER_CONTRACT.tile.drawnWidth / 2 + 2, position.y);
  ctx.lineTo(position.x, position.y - RENDER_CONTRACT.tile.drawnHeight / 2 + 1);
  ctx.strokeStyle = 'rgba(255, 226, 178, 0.18)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  if (id === 'rocky_soil' || id === 'disturbed_ground') {
    ctx.fillStyle = id === 'rocky_soil' ? '#3b2a23' : '#d2794d';
    for (let index = 0; index < 3; index += 1) {
      const dx = ((variant >> (index * 3)) % 25) - 12;
      const dy = ((variant >> (index * 4 + 1)) % 11) - 4;
      ctx.fillRect(position.x + dx, position.y + dy, 3, 2);
    }
  }
  if (id === 'edge' || id === 'cliff_slope') {
    ctx.beginPath();
    ctx.moveTo(position.x - 32, position.y + 2);
    ctx.lineTo(position.x, position.y + 18);
    ctx.lineTo(position.x + 32, position.y + 2);
    ctx.lineTo(position.x + 32, position.y + (id === 'cliff_slope' ? 18 : 10));
    ctx.lineTo(position.x, position.y + (id === 'cliff_slope' ? 35 : 27));
    ctx.lineTo(position.x - 32, position.y + (id === 'cliff_slope' ? 18 : 10));
    ctx.closePath();
    ctx.fillStyle = colours[1];
    ctx.fill();
  }
}

function drawBoardEdge(ctx) {
  ctx.fillStyle = '#4d2118';
  for (let index = 0; index < VIEW.rows; index += 1) {
    const west = absoluteGrid(0, index);
    ctx.beginPath();
    ctx.moveTo(west.x - 33, west.y);
    ctx.lineTo(west.x, west.y + 17);
    ctx.lineTo(west.x, west.y + 27);
    ctx.lineTo(west.x - 33, west.y + 10);
    ctx.closePath();
    ctx.fill();
  }
  for (let index = 0; index < VIEW.columns; index += 1) {
    const south = absoluteGrid(index, VIEW.rows - 1);
    ctx.beginPath();
    ctx.moveTo(south.x, south.y + 17);
    ctx.lineTo(south.x + 33, south.y);
    ctx.lineTo(south.x + 33, south.y + 10);
    ctx.lineTo(south.x, south.y + 27);
    ctx.closePath();
    ctx.fill();
  }
}

function classContract(asset) {
  return RENDER_CONTRACT.spriteClasses[asset?.class] || RENDER_CONTRACT.spriteClasses.prop;
}

function drawShadow(ctx, position, className, stateName) {
  if (className === 'terrain' || className === 'terrain_edge' || className === 'effect') return;
  const width = className === 'building' ? 48 : className === 'rover' ? 36 : 26;
  ctx.save();
  ctx.translate(8, 7);
  ctx.beginPath();
  ctx.ellipse(position.x, position.y + 5, width / 2, Math.max(4, width / 6), 0.12, 0, Math.PI * 2);
  ctx.fillStyle = stateName === 'disabled' ? 'rgba(0, 0, 0, 0.18)' : 'rgba(0, 0, 0, 0.34)';
  ctx.fill();
  ctx.restore();
}

function drawBuilding(ctx, id, ground, stateName) {
  const alpha = stateName === 'blueprint' ? 0.48 : stateName === 'disabled' ? 0.62 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#23150f';
  ctx.lineWidth = 2;
  if (id === 'solar_array') {
    ctx.beginPath();
    ctx.moveTo(ground.x - 36, ground.y - 24);
    ctx.lineTo(ground.x + 12, ground.y - 39);
    ctx.lineTo(ground.x + 39, ground.y - 24);
    ctx.lineTo(ground.x - 10, ground.y - 8);
    ctx.closePath();
    ctx.fillStyle = '#2f6f80';
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#9fe0f0';
    ctx.lineWidth = 1;
    for (let offset = -20; offset <= 20; offset += 13) {
      ctx.beginPath();
      ctx.moveTo(ground.x + offset - 13, ground.y - 25);
      ctx.lineTo(ground.x + offset + 22, ground.y - 35);
      ctx.stroke();
    }
    ctx.fillStyle = '#8f96a0';
    ctx.fillRect(ground.x - 3, ground.y - 10, 6, 10);
  } else if (id === 'extractor') {
    ctx.fillStyle = '#8f96a0';
    ctx.fillRect(ground.x - 18, ground.y - 46, 36, 38);
    ctx.strokeRect(ground.x - 18, ground.y - 46, 36, 38);
    ctx.fillStyle = '#e2894a';
    ctx.fillRect(ground.x - 14, ground.y - 37, 28, 8);
    ctx.beginPath();
    ctx.moveTo(ground.x - 7, ground.y - 8);
    ctx.lineTo(ground.x, ground.y + 7);
    ctx.lineTo(ground.x + 7, ground.y - 8);
    ctx.closePath();
    ctx.fillStyle = '#5d646e';
    ctx.fill();
  } else if (id === 'storage') {
    ctx.beginPath();
    ctx.moveTo(ground.x, ground.y - 42);
    ctx.lineTo(ground.x + 30, ground.y - 27);
    ctx.lineTo(ground.x + 30, ground.y - 2);
    ctx.lineTo(ground.x, ground.y + 12);
    ctx.lineTo(ground.x - 30, ground.y - 2);
    ctx.lineTo(ground.x - 30, ground.y - 27);
    ctx.closePath();
    ctx.fillStyle = '#8f96a0';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d7a74c';
    ctx.fillRect(ground.x - 4, ground.y - 35, 8, 37);
  } else {
    ctx.beginPath();
    ctx.arc(ground.x, ground.y - 15, 31, Math.PI, 0);
    ctx.lineTo(ground.x + 31, ground.y);
    ctx.lineTo(ground.x - 31, ground.y);
    ctx.closePath();
    ctx.fillStyle = '#e8e4dc';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1d3a44';
    ctx.fillRect(ground.x - 13, ground.y - 26, 26, 11);
    ctx.fillStyle = '#9fe0f0';
    ctx.fillRect(ground.x - 10, ground.y - 23, 20, 4);
  }
  ctx.restore();
}

function drawResource(ctx, id, ground, stateName) {
  ctx.save();
  ctx.globalAlpha = stateName === 'disabled' ? 0.58 : 1;
  const crystal = id === 'blue_crystal';
  const colours = crystal ? ['#9fe0f0', '#4db8d4', '#2f6f80'] : ['#f2b285', '#b0603a', '#6b4a33'];
  for (const [dx, height, colour] of [[-13, 27, colours[1]], [0, 42, colours[0]], [13, 31, colours[2]]]) {
    ctx.beginPath();
    ctx.moveTo(ground.x + dx, ground.y);
    ctx.lineTo(ground.x + dx - 7, ground.y - height + 10);
    ctx.lineTo(ground.x + dx, ground.y - height);
    ctx.lineTo(ground.x + dx + 7, ground.y - height + 10);
    ctx.lineTo(ground.x + dx + 5, ground.y);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.strokeStyle = '#2a2118';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawActor(ctx, id, ground, stateName) {
  ctx.save();
  ctx.globalAlpha = stateName === 'disabled' ? 0.6 : 1;
  ctx.strokeStyle = '#172d31';
  ctx.lineWidth = 2;
  if (id === 'rover') {
    ctx.fillStyle = '#8f96a0';
    ctx.fillRect(ground.x - 29, ground.y - 25, 58, 20);
    ctx.strokeRect(ground.x - 29, ground.y - 25, 58, 20);
    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(ground.x - 13, ground.y - 37, 27, 13);
    ctx.strokeRect(ground.x - 13, ground.y - 37, 27, 13);
    ctx.fillStyle = '#2a2118';
    for (const dx of [-21, 0, 21]) {
      ctx.beginPath();
      ctx.arc(ground.x + dx, ground.y - 1, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#e8e4dc';
    ctx.beginPath();
    ctx.arc(ground.x, ground.y - 38, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(ground.x - 10, ground.y - 29, 20, 25);
    ctx.strokeRect(ground.x - 10, ground.y - 29, 20, 25);
    ctx.fillStyle = '#1d3a44';
    ctx.fillRect(ground.x - 8, ground.y - 42, 16, 7);
    ctx.strokeStyle = '#e8e4dc';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ground.x - 5, ground.y - 4);
    ctx.lineTo(ground.x - 8, ground.y + 8);
    ctx.moveTo(ground.x + 5, ground.y - 4);
    ctx.lineTo(ground.x + 8, ground.y + 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawInfrastructure(ctx, id, ground, stateName) {
  ctx.save();
  ctx.globalAlpha = stateName === 'blueprint' ? 0.5 : stateName === 'disabled' ? 0.6 : 1;
  ctx.strokeStyle = id === 'power_cable' ? '#e2894a' : '#8f96a0';
  ctx.lineWidth = id === 'pipe' ? 8 : 4;
  ctx.beginPath();
  ctx.moveTo(ground.x - 29, ground.y - 6);
  ctx.lineTo(ground.x + 29, ground.y + 6);
  ctx.stroke();
  if (id === 'junction') {
    ctx.fillStyle = '#5d646e';
    ctx.fillRect(ground.x - 12, ground.y - 18, 24, 20);
    ctx.strokeStyle = '#2a2118';
    ctx.lineWidth = 2;
    ctx.strokeRect(ground.x - 12, ground.y - 18, 24, 20);
    ctx.fillStyle = '#f0d488';
    ctx.fillRect(ground.x - 4, ground.y - 12, 8, 8);
  }
  if (id === 'path_light') {
    ctx.strokeStyle = '#8f96a0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ground.x, ground.y);
    ctx.lineTo(ground.x, ground.y - 34);
    ctx.stroke();
    ctx.fillStyle = '#f0d488';
    ctx.beginPath();
    ctx.arc(ground.x, ground.y - 38, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProp(ctx, id, ground, stateName) {
  ctx.save();
  ctx.globalAlpha = stateName === 'disabled' ? 0.6 : 1;
  ctx.strokeStyle = '#2a2118';
  ctx.lineWidth = 2;
  if (id === 'crate') {
    ctx.fillStyle = '#b0603a';
    ctx.fillRect(ground.x - 16, ground.y - 27, 32, 27);
    ctx.strokeRect(ground.x - 16, ground.y - 27, 32, 27);
    ctx.beginPath();
    ctx.moveTo(ground.x - 13, ground.y - 24);
    ctx.lineTo(ground.x + 13, ground.y - 3);
    ctx.moveTo(ground.x + 13, ground.y - 24);
    ctx.lineTo(ground.x - 13, ground.y - 3);
    ctx.stroke();
  } else if (id === 'antenna') {
    ctx.strokeStyle = '#c8ccd2';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ground.x, ground.y);
    ctx.lineTo(ground.x, ground.y - 49);
    ctx.stroke();
    ctx.strokeStyle = '#9fe0f0';
    ctx.lineWidth = 2;
    for (const radius of [10, 17]) {
      ctx.beginPath();
      ctx.arc(ground.x, ground.y - 48, radius, -1.1, 0.2);
      ctx.stroke();
    }
  } else if (id === 'beacon') {
    ctx.fillStyle = '#5d646e';
    ctx.fillRect(ground.x - 8, ground.y - 31, 16, 31);
    ctx.fillStyle = '#f0d488';
    ctx.beginPath();
    ctx.arc(ground.x, ground.y - 35, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = '#6b4a33';
    for (const [dx, dy, width, height] of [[-18, -8, 23, 7], [-4, -17, 26, 8], [-11, -25, 15, 6]]) {
      ctx.fillRect(ground.x + dx, ground.y + dy, width, height);
      ctx.strokeRect(ground.x + dx, ground.y + dy, width, height);
    }
  }
  ctx.restore();
}

function animationPhase(period = 600) {
  if (state.reducedMotion) return 0;
  return (state.animationTimeMs % period) / period;
}

function drawEffect(ctx, id, ground) {
  const phase = animationPhase(id === 'dust' || id === 'warning' || id === 'repair' ? 600 : 900);
  ctx.save();
  if (id === 'selection') {
    diamondPath(ctx, ground.x, ground.y + 2, 65 + phase * 8, 31 + phase * 4);
    ctx.strokeStyle = '#9fe0f0';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 4]);
    ctx.stroke();
  } else if (id === 'power_glow') {
    ctx.globalAlpha = 0.38 + phase * 0.28;
    ctx.fillStyle = '#72d6e8';
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y - 7, 30 + phase * 8, 14 + phase * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'warning') {
    ctx.translate(0, state.reducedMotion ? 0 : Math.sin(phase * Math.PI * 2) * 3);
    ctx.beginPath();
    ctx.moveTo(ground.x, ground.y - 63);
    ctx.lineTo(ground.x + 18, ground.y - 31);
    ctx.lineTo(ground.x - 18, ground.y - 31);
    ctx.closePath();
    ctx.fillStyle = '#efbd62';
    ctx.fill();
    ctx.strokeStyle = '#2a2118';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#2a2118';
    ctx.fillRect(ground.x - 2, ground.y - 53, 4, 12);
    ctx.fillRect(ground.x - 2, ground.y - 37, 4, 4);
  } else if (id === 'repair') {
    ctx.strokeStyle = '#a8d780';
    ctx.lineWidth = 4;
    const angle = phase * Math.PI * 2;
    for (let index = 0; index < 5; index += 1) {
      const ray = angle + index * Math.PI * 0.4;
      ctx.beginPath();
      ctx.moveTo(ground.x + Math.cos(ray) * 18, ground.y - 24 + Math.sin(ray) * 9);
      ctx.lineTo(ground.x + Math.cos(ray) * 28, ground.y - 24 + Math.sin(ray) * 14);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(ground.x - 3, ground.y - 40, 6, 30);
    ctx.fillRect(ground.x - 14, ground.y - 28, 28, 6);
  } else {
    ctx.fillStyle = 'rgba(226, 137, 74, 0.48)';
    for (let index = 0; index < 7; index += 1) {
      const drift = state.reducedMotion ? 0 : ((phase * 34 + index * 9) % 42);
      const radius = 3 + (index % 3) * 2;
      ctx.beginPath();
      ctx.arc(ground.x - 24 + index * 8 + drift, ground.y - 13 - (index % 3) * 8, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawStateTreatment(ctx, stateName, ground, className) {
  if (stateName === 'active') return;
  const width = className === 'building' ? 72 : className === 'rover' ? 64 : 46;
  ctx.save();
  ctx.lineWidth = 3;
  if (stateName === 'blueprint') {
    ctx.strokeStyle = '#9fe0f0';
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(ground.x - width / 2, ground.y - 58, width, 61);
    ctx.setLineDash([]);
    ctx.fillStyle = '#9fe0f0';
    ctx.fillRect(ground.x - 2, ground.y - 52, 4, 44);
  } else if (stateName === 'construction') {
    ctx.strokeStyle = '#f0d488';
    ctx.beginPath();
    ctx.moveTo(ground.x - width / 2, ground.y);
    ctx.lineTo(ground.x - width / 2, ground.y - 52);
    ctx.lineTo(ground.x + width / 2, ground.y - 52);
    ctx.lineTo(ground.x + width / 2, ground.y);
    ctx.moveTo(ground.x - width / 2, ground.y - 37);
    ctx.lineTo(ground.x + width / 2, ground.y - 20);
    ctx.moveTo(ground.x + width / 2, ground.y - 37);
    ctx.lineTo(ground.x - width / 2, ground.y - 20);
    ctx.stroke();
  } else if (stateName === 'disabled') {
    ctx.fillStyle = 'rgba(20, 20, 20, 0.28)';
    ctx.fillRect(ground.x - width / 2, ground.y - 55, width, 58);
    ctx.strokeStyle = '#f2ede6';
    ctx.beginPath();
    ctx.moveTo(ground.x - width / 2, ground.y - 54);
    ctx.lineTo(ground.x + width / 2, ground.y + 1);
    ctx.stroke();
  } else if (stateName === 'damaged') {
    ctx.strokeStyle = '#ff9b89';
    ctx.beginPath();
    ctx.moveTo(ground.x - 7, ground.y - 58);
    ctx.lineTo(ground.x + 3, ground.y - 42);
    ctx.lineTo(ground.x - 5, ground.y - 30);
    ctx.lineTo(ground.x + 10, ground.y - 13);
    ctx.stroke();
    ctx.fillStyle = '#ff9b89';
    ctx.fillRect(ground.x - width / 2, ground.y - 4, width, 4);
  }
  ctx.restore();
}

function drawProceduralAsset(ctx, asset, position, stateName) {
  const spriteClass = classContract(asset);
  const ground = {
    x: position.x + (spriteClass.screenOffsetX || 0),
    y: position.y + (spriteClass.screenOffsetY || 0),
  };
  if (asset.family === 'building') drawBuilding(ctx, asset.id, ground, stateName);
  else if (asset.family === 'resource') drawResource(ctx, asset.id, ground, stateName);
  else if (asset.family === 'actor') drawActor(ctx, asset.id, ground, stateName);
  else if (asset.family === 'infrastructure') drawInfrastructure(ctx, asset.id, ground, stateName);
  else if (asset.family === 'prop') drawProp(ctx, asset.id, ground, stateName);
  else if (asset.family === 'effect') drawEffect(ctx, asset.id, ground);
  drawStateTreatment(ctx, stateName, ground, asset.class);
}

function noteSource(source) {
  state.frameSources[source] += 1;
  state.totals[source] += 1;
}

function drawAsset(ctx, reference, stateName, x, y, options = {}) {
  const identity = splitAsset(reference);
  const asset = state.manifestAssets.get(identity.key);
  const position = absoluteGrid(x, y);
  state.frameSources.requested += 1;
  state.totals.requested += 1;
  if (!asset) {
    addWarning({ code: 'MANIFEST_ASSET_MISSING', id: identity.key, response: 'Procedural fallback retained.' });
    noteSource('procedural');
    return 'procedural';
  }

  drawShadow(ctx, position, asset.class, stateName);

  const forcedProcedural = state.forceFallback || state.renderMode === 'procedural';
  if (!forcedProcedural) {
    const commissioned = commissionedCache.draw(ctx, asset.family, asset.id, position.x, position.y, {
      state: stateName,
      elapsedMs: state.animationTimeMs,
      reducedMotion: state.reducedMotion,
      alpha: options.alpha,
    });
    if (commissioned) {
      if (stateName !== 'active') {
        const spriteClass = classContract(asset);
        drawStateTreatment(ctx, stateName, {
          x: position.x + (spriteClass.screenOffsetX || 0),
          y: position.y + (spriteClass.screenOffsetY || 0),
        }, asset.class);
      }
      noteSource('commissioned');
      return 'commissioned';
    }

    if (asset.fallbackSprite && state.renderMode !== 'commissioned') {
      const spriteClass = classContract(asset);
      const legacy = legacyCache.drawSprite(
        ctx,
        asset.fallbackSprite,
        position.x + (spriteClass.screenOffsetX || 0),
        position.y + (spriteClass.screenOffsetY || 0),
        {
          scale: spriteClass.scale,
          anchor: spriteClass.anchor === 'feet' ? 'feet' : 'tile-centre',
          alpha: options.alpha ?? (stateName === 'blueprint' ? 0.48 : stateName === 'disabled' ? 0.62 : 1),
        },
      );
      if (legacy) {
        drawStateTreatment(ctx, stateName, {
          x: position.x + (spriteClass.screenOffsetX || 0),
          y: position.y + (spriteClass.screenOffsetY || 0),
        }, asset.class);
        if (stateName !== 'active') {
          const fallbackKey = `${identity.key}:${stateName}`;
          if (!state.legacyStateFallbackKeys.has(fallbackKey)) {
            state.legacyStateFallbackKeys.add(fallbackKey);
            state.totals.legacyStateFallbacks += 1;
          }
        }
        noteSource('legacy');
        return 'legacy';
      }
    }
  }

  if (asset.family === 'terrain') drawTerrainProcedural(ctx, asset.id, x, y);
  else drawProceduralAsset(ctx, asset, position, stateName);
  noteSource('procedural');
  return 'procedural';
}

function drawFootprintOverlay(ctx, entity, asset) {
  const footprint = asset?.footprint || { width: 1, depth: 1 };
  const corners = footprintCornersFromCenter(entity.at[0], entity.at[1], footprint.width, footprint.depth);
  const points = [corners.north, corners.east, corners.south, corners.west]
    .map((point) => ({ x: VIEW.originX + point.x, y: VIEW.originY + point.y }));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(114, 214, 232, 0.09)';
  ctx.fill();
  ctx.strokeStyle = '#72d6e8';
  ctx.lineWidth = 1.5 / state.zoom;
  ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
  ctx.stroke();
  ctx.restore();
}

function drawAnchorOverlay(ctx, entity, asset) {
  const position = absoluteGrid(entity.at[0], entity.at[1]);
  const spriteClass = classContract(asset);
  const anchor = {
    x: position.x + (spriteClass.screenOffsetX || 0),
    y: position.y + (spriteClass.screenOffsetY || 0),
  };
  const radius = 5 / state.zoom;
  ctx.save();
  ctx.strokeStyle = '#ff9b89';
  ctx.fillStyle = '#15100d';
  ctx.lineWidth = 2 / state.zoom;
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(anchor.x - radius * 1.6, anchor.y);
  ctx.lineTo(anchor.x + radius * 1.6, anchor.y);
  ctx.moveTo(anchor.x, anchor.y - radius * 1.6);
  ctx.lineTo(anchor.x, anchor.y + radius * 1.6);
  ctx.stroke();
  ctx.restore();
}

function drawEntityLabel(ctx, entity, source) {
  const identity = splitAsset(entity.asset);
  const position = absoluteGrid(entity.at[0], entity.at[1]);
  const sourceTag = { commissioned: 'C', legacy: 'L', procedural: 'P' }[source] || '?';
  const label = `${humanise(identity.id)} · ${entity.state.toUpperCase()} · ${sourceTag}`;
  ctx.save();
  ctx.font = `${Math.max(8, 11 / state.zoom)}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const metrics = ctx.measureText(label);
  const padding = 4 / state.zoom;
  const height = 17 / state.zoom;
  const y = position.y + 39 / state.zoom;
  ctx.fillStyle = 'rgba(13, 11, 9, 0.88)';
  ctx.fillRect(position.x - metrics.width / 2 - padding, y - height, metrics.width + padding * 2, height);
  ctx.fillStyle = '#f4ead8';
  ctx.fillText(label, position.x, y - 3 / state.zoom);
  ctx.restore();
}

function drawTerrain(ctx) {
  const cells = state.scope === 'artist-test' ? new Map() : terrainCellMap();
  const summary = new Map();
  const coordinates = [];
  for (let y = 0; y < VIEW.rows; y += 1) {
    for (let x = 0; x < VIEW.columns; x += 1) coordinates.push([x, y]);
  }
  coordinates.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
  for (const [x, y] of coordinates) {
    const id = cells.get(`${x},${y}`) || 'base_soil';
    const reference = `terrain:${id}`;
    const source = drawAsset(ctx, reference, 'active', x, y);
    const entry = summary.get(reference) || { asset: reference, cells: 0, source };
    entry.cells += 1;
    entry.source = source;
    summary.set(reference, entry);
  }
  state.visibleTerrain = [...summary.values()];
}

function drawEntities(ctx, beat) {
  const entities = [...beat.entities].sort((left, right) => {
    const leftEffect = splitAsset(left.asset).family === 'effect';
    const rightEffect = splitAsset(right.asset).family === 'effect';
    const leftLow = leftEffect && LOW_EFFECTS.has(splitAsset(left.asset).id);
    const rightLow = rightEffect && LOW_EFFECTS.has(splitAsset(right.asset).id);
    const leftHigh = leftEffect && !leftLow;
    const rightHigh = rightEffect && !rightLow;
    if (leftLow !== rightLow) return leftLow ? -1 : 1;
    if (leftHigh !== rightHigh) return leftHigh ? 1 : -1;
    return (left.at[0] + left.at[1]) - (right.at[0] + right.at[1]) || left.at[0] - right.at[0];
  });

  if (state.overlays.footprints) {
    for (const entity of entities) {
      const identity = splitAsset(entity.asset);
      drawFootprintOverlay(ctx, entity, state.manifestAssets.get(identity.key));
    }
  }

  state.visibleSources = [];
  for (const entity of entities) {
    const identity = splitAsset(entity.asset);
    const alpha = state.scope === 'artist-test' && !state.artistTestAssets.has(identity.key) ? 0.42 : 1;
    const source = drawAsset(ctx, entity.asset, entity.state, entity.at[0], entity.at[1], { alpha });
    state.visibleSources.push({
      asset: entity.asset,
      state: entity.state,
      at: [...entity.at],
      source,
      inArtistTest: state.artistTestAssets.has(identity.key),
    });
    if (state.overlays.anchors) drawAnchorOverlay(ctx, entity, state.manifestAssets.get(identity.key));
  }
  if (state.overlays.labels) {
    for (let index = 0; index < entities.length; index += 1) {
      const entity = entities[index];
      const source = state.visibleSources.find((entry) => entry.asset === entity.asset && entry.at[0] === entity.at[0] && entry.at[1] === entity.at[1])?.source;
      drawEntityLabel(ctx, entity, source);
    }
  }
}

function effectiveLighting(beat) {
  return state.lighting === 'auto' ? beat.lighting : state.lighting;
}

function drawLightingOverlay(ctx, profileName) {
  const profile = RENDER_CONTRACT.light.profiles[profileName] || RENDER_CONTRACT.light.profiles.daylight;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = profile.overlay;
  ctx.globalAlpha = profile.overlayAlpha;
  ctx.fillRect(0, 0, VIEW.canvasWidth, VIEW.canvasHeight);
  ctx.globalAlpha = 1;

  const keyLight = ctx.createLinearGradient(0, 0, VIEW.canvasWidth, VIEW.canvasHeight);
  keyLight.addColorStop(0, profileName === 'night' ? 'rgba(159, 224, 240, 0.13)' : 'rgba(255, 232, 190, 0.16)');
  keyLight.addColorStop(0.48, 'rgba(255, 255, 255, 0)');
  keyLight.addColorStop(1, `rgba(0, 0, 0, ${profile.shadowAlpha * 0.28})`);
  ctx.fillStyle = keyLight;
  ctx.fillRect(0, 0, VIEW.canvasWidth, VIEW.canvasHeight);

  if (profileName === 'storm') {
    const drift = state.reducedMotion ? 0 : (state.animationTimeMs / 14) % 34;
    ctx.strokeStyle = 'rgba(242, 178, 133, 0.16)';
    ctx.lineWidth = 2;
    for (let y = -40; y < VIEW.canvasHeight + 40; y += 34) {
      ctx.beginPath();
      ctx.moveTo(-60 + drift, y);
      ctx.lineTo(VIEW.canvasWidth + 60 + drift, y + 120);
      ctx.stroke();
    }
  }
  if (profileName === 'night') {
    const vignette = ctx.createRadialGradient(VIEW.canvasWidth / 2, VIEW.canvasHeight / 2, 150, VIEW.canvasWidth / 2, VIEW.canvasHeight / 2, 590);
    vignette.addColorStop(0, 'rgba(7, 18, 22, 0)');
    vignette.addColorStop(1, 'rgba(3, 9, 12, 0.58)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW.canvasWidth, VIEW.canvasHeight);
  }
  ctx.restore();
}

function drawCanvasChrome(ctx, beat, lighting) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const mode = state.forceFallback ? 'PROCEDURAL PROOF' : state.renderMode.toUpperCase();
  ctx.fillStyle = 'rgba(13, 11, 9, 0.88)';
  ctx.fillRect(18, 16, 324, 49);
  ctx.strokeStyle = '#9b7655';
  ctx.strokeRect(18.5, 16.5, 323, 48);
  ctx.fillStyle = '#efbd62';
  ctx.font = '700 11px "Courier New", monospace';
  const sceneLabel = state.scope === 'artist-test'
    ? 'PAID TEST · FOUR ASSET PACKAGE'
    : `BEAT ${String(state.beatIndex + 1).padStart(2, '0')} · ${humanise(beat.id).toUpperCase()}`;
  ctx.fillText(sceneLabel, 30, 36);
  ctx.fillStyle = '#e4d2b3';
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText(`${state.zoom.toFixed(1)}x · ${lighting.toUpperCase()} · ${mode}`, 30, 54);

  if (state.scope === 'artist-test') {
    ctx.fillStyle = 'rgba(13, 11, 9, 0.88)';
    ctx.fillRect(VIEW.canvasWidth - 190, 16, 172, 30);
    ctx.strokeStyle = '#72d6e8';
    ctx.strokeRect(VIEW.canvasWidth - 189.5, 16.5, 171, 29);
    ctx.fillStyle = '#72d6e8';
    ctx.font = '700 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAID ARTIST TEST SCOPE', VIEW.canvasWidth - 104, 35);
  }
  ctx.restore();
}

function drawLoading(message, tone = '#e4d2b3') {
  if (!context || !canvas) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = '#15100d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#9b7655';
  context.strokeRect(45.5, 45.5, canvas.width - 91, canvas.height - 91);
  context.fillStyle = tone;
  context.font = '700 18px "Courier New", monospace';
  context.textAlign = 'center';
  context.fillText(message, canvas.width / 2, canvas.height / 2);
  context.textAlign = 'start';
}

function render(forceUi = false) {
  const startedAt = performance.now();
  if (!context || !canvas) return;
  if (state.fatalError) {
    drawLoading('Golden scene unavailable — see load status.', '#ff9b89');
    return;
  }
  if (!state.ready) {
    drawLoading('Loading DEC-79 renderer evidence…');
    return;
  }

  const beat = activeReviewBeat();
  const lighting = effectiveLighting(beat);
  state.frameSources = { requested: 0, commissioned: 0, legacy: 0, procedural: 0 };
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#120e0c';
  context.fillRect(0, 0, VIEW.canvasWidth, VIEW.canvasHeight);

  context.save();
  applyCameraTransform(context, beat);
  drawBoardShadow(context);
  drawBoardSurface(context);
  drawTerrain(context);
  drawEntities(context, beat);
  drawBoardEdge(context);
  context.restore();
  drawLightingOverlay(context, lighting);
  drawCanvasChrome(context, beat, lighting);

  const renderMs = performance.now() - startedAt;
  state.lastRenderMs = renderMs;
  state.frameTimings.push(renderMs);
  if (state.frameTimings.length > RENDER_CONTRACT.performance.sampleFrames) state.frameTimings.shift();
  noteApprovalCoverage(beat, renderMs);
  updateUi(forceUi);
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function performanceSummary() {
  const samples = state.frameTimings;
  const dropped = samples.filter((duration) => duration > RENDER_CONTRACT.performance.frameBudgetMs).length;
  return {
    samples: samples.length,
    lastMs: state.lastRenderMs,
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    maxMs: samples.length ? Math.max(...samples) : 0,
    droppedRatio: samples.length ? dropped / samples.length : 0,
    targetP95Ms: RENDER_CONTRACT.performance.p95FrameMs,
    pass: samples.length >= RENDER_CONTRACT.performance.sampleFrames
      && percentile(samples, 0.95) <= RENDER_CONTRACT.performance.p95FrameMs
      && dropped / samples.length <= RENDER_CONTRACT.performance.maxDroppedFrameRatio,
  };
}

function dlMarkup(rows) {
  return `<dl>${rows.map(([term, value]) => `<dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl>`;
}

function updateTelemetryDom(force = false) {
  const now = performance.now();
  if (!force && now - state.lastTelemetryPaint < 250) return;
  state.lastTelemetryPaint = now;
  const cache = commissionedCache.getTelemetry();
  const perf = performanceSummary();
  const requirements = scopeRequirements();
  if (elements.assetTelemetry) {
    elements.assetTelemetry.setAttribute('aria-busy', 'false');
    elements.assetTelemetry.innerHTML = dlMarkup([
      ['Indexed assets', `${cache.indexedAssets}/${state.manifest?.assets.length || 0}`],
      ['Review scope assets', `${requirements.readyAssets}/${requirements.assets}`],
      ['Review scope exports', `${requirements.indexedExports}/${requirements.requiredExports}`],
      ['All indexed frames', `${cache.indexedFrames}/${cache.declaredFrames}`],
      ['Requested this frame', state.frameSources.requested],
      ['Commissioned', state.frameSources.commissioned],
      ['Legacy sprites', state.frameSources.legacy],
      ['Procedural', state.frameSources.procedural],
      ['ImageBitmap cache', `${cache.cachedBitmaps} ready / ${cache.pendingBitmaps} pending`],
      ['Decode attempts', `${cache.loadAttempts} (${cache.decodeFailures} failed, ${cache.slowDecodes} slow)`],
      ['State fallbacks', cache.stateFallbacks + state.totals.legacyStateFallbacks],
      ['Broken clips', cache.brokenClips],
    ]);
  }
  if (elements.performanceTelemetry) {
    elements.performanceTelemetry.innerHTML = dlMarkup([
      ['Samples', `${perf.samples}/${RENDER_CONTRACT.performance.sampleFrames}`],
      ['Last render', `${perf.lastMs.toFixed(2)} ms`],
      ['p50 / p95', `${perf.p50Ms.toFixed(2)} / ${perf.p95Ms.toFixed(2)} ms`],
      ['Maximum', `${perf.maxMs.toFixed(2)} ms`],
      ['Over budget', `${(perf.droppedRatio * 100).toFixed(1)}%`],
      ['Gate', perf.samples < RENDER_CONTRACT.performance.sampleFrames ? 'sampling' : perf.pass ? 'pass' : 'review'],
    ]);
  }
  if (elements.warningTelemetry) {
    const warnings = state.warnings.slice(-6).reverse();
    const warningSignature = warnings
      .map((warning) => `${warning.code}\u001f${warning.id}\u001f${warning.response}`)
      .join('\u001e');
    const warningMarkup = warnings.length
      ? `<ul>${warnings.map((warning) => `<li><strong>${escapeHtml(warning.code)}</strong> · ${escapeHtml(warning.id)}<br><span>${escapeHtml(warning.response)}</span></li>`).join('')}</ul>`
      : '<p class="empty-state">No runtime warnings reported.</p>';
    if (warningSignature !== state.warningSignature) {
      state.warningSignature = warningSignature;
      setMarkupIfChanged(elements.warningTelemetry, warningMarkup, `warnings:${warningSignature}`);
    }
  }
}

function prepareReceiptDownload(receipt) {
  if (!elements.downloadApprovalReceipt) return;
  const nextKey = receipt ? `${receipt.receiptId}:${receipt.integrityDigest?.value || ''}` : null;
  if (nextKey && nextKey === state.receiptDownloadKey && state.receiptDownloadUrl) return;
  if (state.receiptDownloadUrl) {
    URL.revokeObjectURL(state.receiptDownloadUrl);
    state.receiptDownloadUrl = null;
  }
  state.receiptDownloadKey = nextKey;
  if (!receipt) {
    elements.downloadApprovalReceipt.hidden = true;
    elements.downloadApprovalReceipt.removeAttribute('href');
    return;
  }
  const blob = new Blob([`${JSON.stringify(receipt, null, 2)}\n`], { type: 'application/json' });
  state.receiptDownloadUrl = URL.createObjectURL(blob);
  const date = receipt.recordedAt.slice(0, 10);
  const scope = receipt.scope === 'artist-test' ? 'artist-test' : 'golden';
  elements.downloadApprovalReceipt.href = state.receiptDownloadUrl;
  elements.downloadApprovalReceipt.download = `marsscape-${scope}-approval-${receipt.packageHash.slice(0, 12)}-${date}.json`;
  elements.downloadApprovalReceipt.hidden = false;
}

function buildApprovalReceiptPayload(gate) {
  const evidence = state.approvalEvidence[state.scope];
  const report = evidence.report;
  const recordedAt = new Date().toISOString();
  return {
    schema: APPROVAL_RECEIPT_SCHEMA,
    receiptId: globalThis.crypto?.randomUUID?.() || `marsscape-${Date.now()}-${report.manifestHash.slice(0, 12)}`,
    recordedAt,
    decision: RENDER_CONTRACT.decision,
    contractVersion: RENDER_CONTRACT.version,
    manifestHash: report.manifestHash,
    packageHash: report.artifactDigests.packageHash,
    runtimeAssetHash: report.artifactDigests.runtimeAssetHash,
    runtimeIdentitySchema: report.artifactDigests.runtimeIdentitySchema,
    reviewSurfaceHash: state.reviewSurface.hash,
    scope: report.scope,
    approval: {
      status: 'approved',
      localOnly: true,
      humanRequired: true,
      authentication: 'external-git-review-required',
    },
    strictEvidence: {
      reportUrl: evidence.url,
      reportVersion: report.reportVersion,
      passed: report.passed,
      approval: report.approval,
      approvalReady: report.approvalReady,
      machineReady: report.machineReady,
      counts: { ...report.counts },
      indexVerification: { ...report.indexVerification },
      artifactDigests: {
        algorithm: report.artifactDigests.algorithm,
        complete: report.artifactDigests.complete,
        packageHash: report.artifactDigests.packageHash,
        runtimeAssetHash: report.artifactDigests.runtimeAssetHash,
        runtimeIdentitySchema: report.artifactDigests.runtimeIdentitySchema,
        exportCount: report.artifactDigests.exports.length,
        editableSourceCount: report.artifactDigests.editableSources.length,
      },
    },
    runtimeIndex: {
      version: state.indexMeta.version,
      runtimeIdentitySchema: state.indexMeta.runtimeIdentitySchema,
      scope: state.indexMeta.scope,
      manifestHash: state.indexMeta.manifestHash,
      availableExports: state.indexMeta.availableExports,
      scopedRuntimeAssetHash: state.indexMeta.runtimeAssetHashes?.[report.scope]
        || state.indexMeta.runtimeAssetHash,
    },
    rendererReview: {
      page: `${location.origin}${location.pathname}`,
      reviewSurface: reviewSurfaceSummary(),
      zoom: state.zoom,
      renderMode: state.renderMode,
      forceFallback: state.forceFallback,
      reducedMotion: state.reducedMotion,
      packageQuality: gate.packageQuality,
      coverage: gate.coverage,
      conditionLedger: gate.coverage,
      performance: gate.performance,
      finalFrameSources: { ...state.frameSources },
    },
    humanReview: {
      checks: [...gate.checks],
      requiredChecks: gate.requiredChecks,
      attested: gate.checks.length === gate.requiredChecks,
    },
  };
}

async function recordApprovalReceipt() {
  captureHumanChecks();
  const gate = approvalGate();
  if (!gate.ready) {
    updateApproval();
    return null;
  }
  if (elements.recordApproval) {
    elements.recordApproval.disabled = true;
    setTextIfChanged(elements.recordApproval, 'Recording local receipt…');
  }
  try {
    const payload = buildApprovalReceiptPayload(gate);
    const receipt = {
      ...payload,
      integrityDigest: {
        algorithm: 'SHA-256',
        purpose: 'client-integrity-only-not-authentication',
        authenticated: false,
        value: await sha256(payload),
      },
    };
    globalThis.localStorage?.setItem(approvalStorageKey(state.scope), JSON.stringify(receipt));
    const stored = globalThis.localStorage?.getItem(approvalStorageKey(state.scope));
    if (!stored) throw new Error('The browser did not persist the local approval receipt.');
    state.approvalReceipts[state.scope] = receipt;
    prepareReceiptDownload(receipt);
    updateApproval();
    return receiptSummary(receipt);
  } catch (error) {
    addWarning({ code: 'APPROVAL_RECEIPT_FAILED', id: state.scope, response: error?.message || 'Local approval receipt could not be created.' });
    if (elements.approvalReceiptStatus) {
      setTextIfChanged(elements.approvalReceiptStatus, `Receipt failed: ${error?.message || 'local storage or integrity digest unavailable'}.`);
    }
    updateApproval();
    return null;
  }
}

function updateApproval() {
  syncHumanReviewControls();
  const gate = approvalGate();
  const evidence = state.approvalEvidence[state.scope];
  const receipt = state.approvalReceipts[state.scope];
  document.body.dataset.reviewState = gate.status;
  if (elements.gateBadge) {
    setDataStateIfChanged(elements.gateBadge, gate.status);
    setTextIfChanged(elements.gateBadge, gate.ready ? 'Ready' : 'Blocked');
  }
  if (elements.recordApproval) {
    elements.recordApproval.disabled = !gate.ready;
    elements.recordApproval.setAttribute('aria-disabled', String(!gate.ready));
    const scopeLabel = state.scope === 'artist-test' ? 'paid artist test' : 'golden scene';
    setTextIfChanged(elements.recordApproval, receipt
      ? `Record updated ${scopeLabel} approval receipt`
      : `Record ${scopeLabel} approval`);
  }
  if (elements.approvalEvidenceStatus) {
    setDataStateIfChanged(elements.approvalEvidenceStatus, evidence?.valid ? 'ready' : 'blocked');
    setTextIfChanged(elements.approvalEvidenceStatus, evidence?.valid
      ? `Strict evidence valid: ${evidence.report.scope}, manifest ${evidence.report.manifestHash.slice(0, 12)}.`
      : `Strict evidence blocked: ${evidence?.reasons?.[0] || 'report unavailable'}`);
  }
  if (elements.approvalGateStatus) {
    setDataStateIfChanged(elements.approvalGateStatus, gate.status);
    setTextIfChanged(elements.approvalGateStatus, gate.ready
      ? 'Approval ready: every machine and human requirement passed.'
      : `Approval blocked: ${gate.reasons.length} requirement${gate.reasons.length === 1 ? '' : 's'} remain.`);
  }
  if (elements.approvalReason) {
    setDataStateIfChanged(elements.approvalReason, gate.status);
    const reasonMarkup = gate.ready
      ? `<h3 id="approvalReasonTitle">Approval ready</h3><p id="approvalReasonSummary">Strict evidence, all ${gate.requiredChecks} human checks, complete renderer coverage, and qualifying performance evidence passed at 1.0x.</p>`
      : `<h3 id="approvalReasonTitle">Approval blockers</h3><p id="approvalReasonSummary">Approval is blocked by ${gate.reasons.length} requirement${gate.reasons.length === 1 ? '' : 's'}:</p><ul id="approvalBlockerList">${gate.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>`;
    setMarkupIfChanged(elements.approvalReason, reasonMarkup, `${gate.status}:${gate.reasons.join('\u001f')}`);
  }
  if (elements.approvalReceiptStatus) {
    setTextIfChanged(elements.approvalReceiptStatus, receipt
      ? `Local receipt ${receipt.receiptId} recorded ${new Date(receipt.recordedAt).toLocaleString()}; package ${receipt.packageHash.slice(0, 12)}; client integrity digest ${receipt.integrityDigest.value.slice(0, 12)} (not authentication).`
      : 'No local approval receipt is recorded for this scope and manifest.');
  }
  prepareReceiptDownload(receipt);
}

function syncScopeControls() {
  const artistTest = state.scope === 'artist-test';
  document.body.dataset.reviewScope = state.scope;
  if (elements.sequencePanel) elements.sequencePanel.hidden = artistTest;
  if (elements.playbackBar) elements.playbackBar.hidden = artistTest;
  if (elements.playPause) elements.playPause.disabled = artistTest;
  if (elements.timeScrubber) elements.timeScrubber.disabled = artistTest;
  if (elements.autoLightingOption) {
    setTextIfChanged(elements.autoLightingOption, artistTest ? 'Paid-test daylight' : 'Follow sequence');
  }
  for (const button of elements.beatButtons) button.disabled = artistTest;
  setTextIfChanged(elements.stageTitle, artistTest ? 'Paid artist test matrix' : 'Outpost validation scene');
}

function updateUi(forceTelemetry = false) {
  if (!state.ready || !state.scene) return;
  syncScopeControls();
  const sequenceBeat = currentBeat();
  const beat = activeReviewBeat();
  const progress = state.sequenceTimeMs / state.totalDurationMs;
  if (elements.playPause) {
    setTextIfChanged(elements.playPause, state.playing ? 'Pause sequence' : 'Play sequence');
    elements.playPause.setAttribute('aria-pressed', String(state.playing));
  }
  if (elements.sceneStatus) {
    setDataStateIfChanged(elements.sceneStatus, state.scope === 'artist-test' ? 'ready' : state.playing ? 'playing' : 'paused');
    setTextIfChanged(elements.sceneStatus, state.scope === 'artist-test'
      ? `Reviewing: paid artist test matrix at ${humanise(effectiveLighting(beat)).toLowerCase()}.`
      : `${state.playing ? 'Playing' : 'Paused'}: Beat ${state.beatIndex + 1}, ${sequenceBeat.title.toLowerCase()}.`);
  }
  if (elements.timeScrubber) elements.timeScrubber.value = String(progress);
  if (elements.timeReadout) setTextIfChanged(elements.timeReadout, `${Math.round(progress * 100)}%`);
  for (const button of elements.beatButtons) {
    const active = Number(button.dataset.beatIndex) === state.beatIndex;
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  if (elements.previousBeat) elements.previousBeat.disabled = state.scope === 'artist-test' || state.beatIndex === 0;
  if (elements.nextBeat) elements.nextBeat.disabled = state.scope === 'artist-test' || state.beatIndex === state.scene.beats.length - 1;
  if (elements.canvasDescription) {
    const prefix = state.scope === 'artist-test'
      ? 'Paid artist test matrix.'
      : `Beat ${state.beatIndex + 1} of ${state.scene.beats.length}.`;
    setTextIfChanged(elements.canvasDescription, `${prefix} ${beat.description} Active lighting: ${humanise(effectiveLighting(beat))}. View: ${state.zoom.toFixed(1)}x ${state.renderMode}, ${state.reducedMotion ? 'reduced motion with static frame 01' : 'animation enabled'}.`);
  }
  const canvasLabel = state.scope === 'artist-test'
    ? 'MarsScape paid artist test matrix at normal gameplay scale'
    : `MarsScape golden scene, beat ${state.beatIndex + 1}: ${beat.title}`;
  if (canvas?.getAttribute('aria-label') !== canvasLabel) canvas?.setAttribute('aria-label', canvasLabel);
  updateTelemetryDom(forceTelemetry);
  updateApproval();
}

function renderGoldenSceneToText() {
  const beat = activeReviewBeat();
  const cache = commissionedCache.getTelemetry();
  return JSON.stringify({
    coordinateSystem: state.scene?.coordinateSystem || 'isometric grid, x east, y south',
    contract: {
      decision: RENDER_CONTRACT.decision,
      version: RENDER_CONTRACT.version,
      projection: RENDER_CONTRACT.projection,
      canvas: [VIEW.canvasWidth, VIEW.canvasHeight],
      tile: [RENDER_CONTRACT.tile.logicalWidth, RENDER_CONTRACT.tile.logicalHeight],
    },
    ready: state.ready,
    error: state.fatalError,
    beat: beat ? {
      index: state.beatIndex,
      number: state.beatIndex + 1,
      id: beat.id,
      title: beat.title,
      elapsedMs: Math.round(activeReviewElapsed()),
      durationMs: beat.durationMs,
      lighting: effectiveLighting(beat),
      camera: beat.camera,
      assertions: beat.assertions,
    } : null,
    view: {
      scope: state.scope,
      zoom: state.zoom,
      renderMode: state.renderMode,
      forceFallback: state.forceFallback,
      reducedMotion: state.reducedMotion,
      playing: state.playing,
      clockMode: state.manualClock ? 'deterministic' : 'realtime',
      animationTimeMs: Math.round(state.animationTimeMs),
      sequenceProgress: Number((state.sequenceTimeMs / state.totalDurationMs).toFixed(4)),
      overlays: { ...state.overlays },
    },
    terrain: state.visibleTerrain,
    entities: state.visibleSources,
    telemetry: {
      frameSources: { ...state.frameSources },
      totals: { ...state.totals },
      cache,
      requirements: scopeRequirements(),
      performance: performanceSummary(),
      warnings: state.warnings.slice(-10),
    },
    approval: approvalStatusSnapshot(),
  });
}

function wireControls() {
  elements.playPause?.addEventListener('click', () => {
    if (state.sequenceTimeMs >= state.totalDurationMs) state.sequenceTimeMs = 0;
    state.manualClock = false;
    state.playing = !state.playing;
    syncBeatFromSequenceTime();
    render(true);
  });
  elements.timeScrubber?.addEventListener('input', (event) => setSequenceProgress(event.currentTarget.value));
  for (const button of elements.beatButtons) {
    button.addEventListener('click', () => setBeat(Number(button.dataset.beatIndex)));
  }
  elements.previousBeat?.addEventListener('click', () => setBeat(Math.max(0, state.beatIndex - 1)));
  elements.nextBeat?.addEventListener('click', () => setBeat(Math.min(state.scene.beats.length - 1, state.beatIndex + 1)));
  elements.scopeSelect?.addEventListener('change', (event) => setScope(event.currentTarget.value));
  elements.lightingSelect?.addEventListener('change', (event) => setLighting(event.currentTarget.value));
  elements.renderModeSelect?.addEventListener('change', (event) => setMode(event.currentTarget.value));
  elements.zoomSelect?.addEventListener('change', (event) => setZoom(event.currentTarget.value));
  elements.showAnchors?.addEventListener('change', (event) => setOverlays('anchors', event.currentTarget.checked));
  elements.showFootprints?.addEventListener('change', (event) => setOverlays('footprints', event.currentTarget.checked));
  elements.showLabels?.addEventListener('change', (event) => setOverlays('labels', event.currentTarget.checked));
  elements.reducedMotion?.addEventListener('change', (event) => setReducedMotion(event.currentTarget.checked));
  elements.forceFallback?.addEventListener('change', (event) => setForceFallback(event.currentTarget.checked));
  elements.reviewChecklist?.addEventListener('change', () => {
    captureHumanChecks();
    updateApproval();
  });
  elements.recordApproval?.addEventListener('click', () => {
    void recordApprovalReceipt();
  });
  document.addEventListener('keydown', async (event) => {
    if (event.key.toLowerCase() !== 'f' || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target?.tagName || '')) return;
    event.preventDefault();
    if (document.fullscreenElement) await document.exitFullscreen();
    else await canvas?.parentElement?.requestFullscreen?.();
  });
}

function installAutomationHooks() {
  const getTelemetry = () => ({
    frameSources: { ...state.frameSources },
    totals: { ...state.totals },
    cache: commissionedCache.getTelemetry(),
    requirements: scopeRequirements(),
    performance: performanceSummary(),
    warnings: state.warnings.slice(-10),
  });
  const getApprovalStatus = () => approvalStatusSnapshot();
  const getApprovalReceipt = () => currentApprovalReceipt();
  const automationApi = {
    setBeat,
    setLighting,
    setRenderMode: setMode,
    setMode,
    setZoom,
    setOverlays,
    setReducedMotion,
    setForceFallback,
    setScope,
    setProgress: setSequenceProgress,
    getTelemetry,
    getApprovalStatus,
    getApprovalReceipt,
    get state() {
      return JSON.parse(renderGoldenSceneToText());
    },
  };
  window.render_golden_scene_to_text = renderGoldenSceneToText;
  window.render_game_to_text = renderGoldenSceneToText;
  window.advanceTime = (milliseconds) => {
    if (!state.manualClock) {
      state.manualClock = true;
      state.animationTimeMs = 0;
    }
    advanceModel(milliseconds);
    render(true);
    return renderGoldenSceneToText();
  };
  window.setGoldenSceneBeat = setBeat;
  window.setGoldenSceneLighting = setLighting;
  window.setGoldenSceneZoom = setZoom;
  window.setGoldenSceneMode = setMode;
  window.setGoldenSceneOverlays = setOverlays;
  window.setGoldenSceneReducedMotion = setReducedMotion;
  window.setGoldenSceneForceFallback = setForceFallback;
  window.setGoldenSceneScope = setScope;
  window.setGoldenSceneProgress = setSequenceProgress;
  window.__goldenScene = Object.freeze(automationApi);
  window.goldenScene = Object.freeze({
    renderToText: renderGoldenSceneToText,
    setBeat,
    setLighting,
    setZoom,
    setMode,
    setOverlays,
    setReducedMotion,
    setForceFallback,
    setScope,
    setProgress: setSequenceProgress,
    getTelemetry,
    getApprovalStatus,
    getApprovalReceipt,
  });
}

function animationLoop(timestamp) {
  const previous = state.lastRafTime ?? timestamp;
  const delta = Math.max(0, Math.min(50, timestamp - previous));
  state.lastRafTime = timestamp;
  if (!document.hidden && state.ready && !state.manualClock) {
    advanceModel(delta);
    render(false);
  }
  requestAnimationFrame(animationLoop);
}

async function initialise() {
  drawLoading('Loading DEC-79 renderer evidence…');
  installAutomationHooks();
  wireControls();
  if (elements.reducedMotion) elements.reducedMotion.checked = state.reducedMotion;
  try {
    const [scene, manifest, commissionedIndex, reviewSurface] = await Promise.all([
      fetchJson(SCENE_URL, 'Golden scene'),
      fetchJson(MANIFEST_URL, 'Golden-slice manifest'),
      fetchJson(COMMISSIONED_INDEX_URL, 'Commissioned-art index').catch((error) => {
        addWarning({
          code: 'COMMISSIONED_INDEX_MISSING',
          id: 'index.json',
          response: `${error.message}; legacy and procedural fallbacks retained.`,
        });
        return {
          version: COMMISSIONED_INDEX_VERSION,
          contractVersion: RENDER_CONTRACT.version,
          decision: RENDER_CONTRACT.decision,
          assets: [],
        };
      }),
      computeReviewSurfaceEvidence(),
    ]);
    assertSceneContract(scene, manifest);
    state.scene = scene;
    state.manifest = manifest;
    state.indexMeta = null;
    state.reviewSurface = reviewSurface;
    if (reviewSurface.status !== 'valid') {
      addWarning({
        code: 'REVIEW_SURFACE_HASH_UNAVAILABLE',
        id: 'golden-scene',
        response: `${reviewSurface.reasons[0] || 'Review-surface bytes could not be hashed'}; rendering retained and approval blocked.`,
      });
    }
    buildSceneIndexes();

    const legacyIds = [...new Set(manifest.assets.map((asset) => asset.fallbackSprite).filter(Boolean))];
    const loadCommissioned = async () => {
      const index = await commissionedCache.loadIndex(commissionedIndex, { baseUrl: COMMISSIONED_BASE_URL.href });
      state.indexMeta = await verifyRuntimeIndexIdentity(commissionedCache.getIndexMetadata(), manifest);
      const prime = await commissionedCache.prime({ reducedMotion: false });
      return { index, prime };
    };
    const [commissionedResult, legacyResult] = await Promise.all([
      loadCommissioned()
        .catch((error) => {
          commissionedCache.clear();
          state.indexMeta = null;
          addWarning({ code: 'COMMISSIONED_INDEX_FAILED', id: 'index.json', response: `${error.message}; legacy and procedural fallbacks retained.` });
          return { index: { assets: 0, states: 0, frames: 0, declaredFrames: 0 }, prime: { requested: 0, loaded: 0, failed: 0 } };
      }),
      legacyCache.prime(legacyIds),
    ]);
    await loadApprovalReports();
    await loadStoredReceipts();
    state.ready = true;
    syncHumanReviewControls();
    prepareReceiptDownload(state.approvalReceipts[state.scope]);
    const indexed = commissionedResult.index.assets;
    if (elements.loadStatus) {
      const approvalSurfaceReady = reviewSurface.status === 'valid';
      setDataStateIfChanged(elements.loadStatus, indexed === manifest.assets.length && approvalSurfaceReady ? 'ready' : 'blocked');
      setTextIfChanged(elements.loadStatus, indexed === manifest.assets.length && approvalSurfaceReady
        ? `Loaded: ${indexed} commissioned assets, ${legacyResult} legacy fallbacks, and review surface ${reviewSurface.hash.slice(0, 12)}.`
        : indexed === manifest.assets.length
          ? `Renderer ready: ${indexed} commissioned assets loaded; approval integrity blocked because ${reviewSurface.reasons[0] || 'the review-surface hash is unavailable'}.`
        : `Fallback ready: ${indexed}/${manifest.assets.length} commissioned assets indexed; ${legacyResult} legacy sprites cached.`);
    }
    render(true);
  } catch (error) {
    state.fatalError = error?.message || String(error);
    if (elements.loadStatus) {
      setDataStateIfChanged(elements.loadStatus, 'error');
      setTextIfChanged(elements.loadStatus, `Load failed: ${state.fatalError}`);
    }
    drawLoading('Golden scene unavailable — see load status.', '#ff9b89');
  }
  requestAnimationFrame(animationLoop);
}

installSharedNavFocusOrder();
void initialise();
