import { CommissionedArtCache } from './commissioned-art.mjs';
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
const APPROVAL_REPORT_URLS = Object.freeze({
  'artist-test': new URL('./art/reports/artist-test-approval.json', import.meta.url),
  'golden-scene': new URL('./art/reports/golden-approval.json', import.meta.url),
});
const APPROVAL_REPORT_SCOPES = Object.freeze({
  'artist-test': 'artist-test',
  'golden-scene': 'full',
});
const APPROVAL_RECEIPT_SCHEMA = 'marsscape-art-approval-receipt/v1';
const APPROVAL_STORAGE_PREFIX = 'marsscape.dec79.approval.v1';
const VIEW = RENDER_CONTRACT.board;
const VALID_LIGHTING = new Set(['auto', ...Object.keys(RENDER_CONTRACT.light.profiles)]);
const VALID_MODES = new Set(['auto', 'commissioned', 'procedural']);
const VALID_ZOOMS = new Set([
  RENDER_CONTRACT.pixelDensity.minViewportZoom,
  RENDER_CONTRACT.pixelDensity.normalGameplayZoom,
  RENDER_CONTRACT.pixelDensity.maxViewportZoom,
]);
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
  loadStatus: document.querySelector('#loadStatus'),
  sceneStatus: document.querySelector('#sceneStatus'),
  canvasDescription: document.querySelector('#canvasDescription'),
  playPause: document.querySelector('#playPause'),
  timeScrubber: document.querySelector('#timeScrubber'),
  timeReadout: document.querySelector('#timeReadout'),
  beatButtons: [...document.querySelectorAll('[data-beat-index]')],
  previousBeat: document.querySelector('#previousBeat'),
  nextBeat: document.querySelector('#nextBeat'),
  scopeSelect: document.querySelector('#scopeSelect'),
  lightingSelect: document.querySelector('#lightingSelect'),
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
  approvalEvidenceStatus: document.querySelector('#approvalEvidenceStatus'),
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
  reviewCoverage: {
    'artist-test': { matrix: false, animationMs: 0, lastAnimationTime: null, frameTimings: [] },
    'golden-scene': { beats: new Set(), frameTimings: [] },
  },
  approvalReceipts: {
    'artist-test': null,
    'golden-scene': null,
  },
  receiptDownloadUrl: null,
  receiptDownloadKey: null,
};

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

function validateApprovalReport(report, scope) {
  const reasons = [];
  const requirements = scopeRequirements(scope);
  const expectedScope = APPROVAL_REPORT_SCOPES[scope];
  const counts = report?.counts || {};
  const digests = report?.artifactDigests || {};
  const digestPattern = /^[a-f0-9]{64}$/;
  const indexedRuntimeHash = state.indexMeta?.runtimeAssetHashes?.[expectedScope]
    || (expectedScope === 'full' ? state.indexMeta?.runtimeAssetHash : null);
  const expect = (condition, message) => {
    if (!condition) reasons.push(message);
  };

  expect(report?.reportVersion === 1, 'Report schema version is not 1.');
  expect(report?.scope === expectedScope, `Report scope must be ${expectedScope}.`);
  expect(report?.contractVersion === RENDER_CONTRACT.version, `Report must target contract v${RENDER_CONTRACT.version}.`);
  expect(report?.decision === RENDER_CONTRACT.decision, `Report must target ${RENDER_CONTRACT.decision}.`);
  expect(Boolean(state.indexMeta?.manifestHash), 'Runtime index has no manifest hash.');
  expect(report?.manifestHash === state.indexMeta?.manifestHash, 'Report and runtime-index manifest hashes differ.');
  expect(report?.approval === true, 'Report was not generated in strict approval mode.');
  expect(report?.passed === true, 'Strict validator did not pass.');
  expect(report?.approvalReady === true, 'Strict validator did not mark the package approval-ready.');
  expect(report?.machineReady === true, 'Approval report did not pass the fail-closed machine-ready gate.');
  expect(report?.indexVerification?.passed === true, 'Runtime-index verification did not pass.');
  expect(digests.algorithm === 'SHA-256', 'Artifact evidence must use SHA-256.');
  expect(digests.scope === expectedScope, `Artifact evidence scope must be ${expectedScope}.`);
  expect(digests.complete === true, 'Artifact byte evidence is incomplete.');
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
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable; approval cannot be checksummed.');
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function approvalStorageKey(scope, packageHash = state.approvalEvidence[scope]?.report?.artifactDigests?.packageHash) {
  return `${APPROVAL_STORAGE_PREFIX}:${scope}:${packageHash || 'missing-package'}`;
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
    checksum: receipt.checksum,
    localOnly: true,
  };
}

async function verifyStoredReceipt(receipt, scope) {
  if (!receipt || receipt.schema !== APPROVAL_RECEIPT_SCHEMA) return false;
  if (state.approvalEvidence[scope]?.valid !== true) return false;
  if (receipt.scope !== APPROVAL_REPORT_SCOPES[scope]) return false;
  if (receipt.manifestHash !== state.indexMeta?.manifestHash) return false;
  const currentDigests = state.approvalEvidence[scope]?.report?.artifactDigests;
  if (!currentDigests || receipt.packageHash !== currentDigests.packageHash) return false;
  if (receipt.runtimeAssetHash !== currentDigests.runtimeAssetHash) return false;
  if (receipt.contractVersion !== RENDER_CONTRACT.version || receipt.decision !== RENDER_CONTRACT.decision) return false;
  if (receipt.checksum?.algorithm !== 'SHA-256' || typeof receipt.checksum.value !== 'string') return false;
  const { checksum, ...payload } = receipt;
  return await sha256(payload) === checksum.value;
}

async function loadStoredReceipts() {
  for (const scope of Object.keys(APPROVAL_REPORT_URLS)) {
    try {
      const raw = globalThis.localStorage?.getItem(approvalStorageKey(scope));
      if (!raw) continue;
      const receipt = JSON.parse(raw);
      if (await verifyStoredReceipt(receipt, scope)) state.approvalReceipts[scope] = receipt;
      else addWarning({ code: 'APPROVAL_RECEIPT_INVALID', id: scope, response: 'Ignored local receipt with invalid scope, manifest, or checksum.' });
    } catch (error) {
      addWarning({ code: 'APPROVAL_RECEIPT_UNREADABLE', id: scope, response: `${error?.message || 'Local receipt could not be read'}.` });
    }
  }
}

function selectedHumanChecks() {
  return [...(state.humanChecks[state.scope] || new Set())].sort();
}

function captureHumanChecks() {
  if (!elements.reviewChecklist) return;
  state.humanChecks[state.scope] = new Set([...elements.reviewChecklist.querySelectorAll('input[name="reviewCriterion"]:checked')]
    .map((input) => input.value));
}

function restoreHumanChecks() {
  const selected = state.humanChecks[state.scope] || new Set();
  for (const input of elements.reviewChecklist?.querySelectorAll('input[name="reviewCriterion"]') || []) {
    input.checked = selected.has(input.value);
  }
}

function approvalPerformanceSummary(scope = state.scope) {
  const samples = state.reviewCoverage[scope]?.frameTimings || [];
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
    pass: samples.length >= RENDER_CONTRACT.performance.sampleFrames
      && p95Ms <= RENDER_CONTRACT.performance.p95FrameMs
      && droppedRatio <= RENDER_CONTRACT.performance.maxDroppedFrameRatio,
  };
}

function approvalCoverageSummary(scope = state.scope) {
  if (scope === 'artist-test') {
    const coverage = state.reviewCoverage[scope];
    return {
      matrix: coverage.matrix,
      animationMs: Math.round(coverage.animationMs),
      requiredAnimationMs: RENDER_CONTRACT.animation.clips.idle.frames * RENDER_CONTRACT.animation.clips.idle.frameMs,
      complete: coverage.matrix
        && coverage.animationMs >= RENDER_CONTRACT.animation.clips.idle.frames * RENDER_CONTRACT.animation.clips.idle.frameMs,
    };
  }
  const reviewedBeats = [...state.reviewCoverage[scope].beats].sort();
  return {
    reviewedBeats,
    requiredBeats: state.scene?.beats.map((beat) => beat.id) || [],
    complete: reviewedBeats.length === (state.scene?.beats.length || 8),
  };
}

function currentFrameIsApprovalQuality() {
  const cache = commissionedCache.getTelemetry();
  const requirements = scopeRequirements();
  return state.approvalEvidence[state.scope]?.valid === true
    && requirements.requiredExports > 0
    && requirements.indexedExports === requirements.requiredExports
    && requirements.readyAssets === requirements.assets
    && state.zoom === RENDER_CONTRACT.pixelDensity.normalGameplayZoom
    && state.renderMode !== 'procedural'
    && !state.forceFallback
    && state.frameSources.requested > 0
    && state.frameSources.commissioned === state.frameSources.requested
    && state.frameSources.legacy === 0
    && state.frameSources.procedural === 0
    && cache.stateFallbacks === 0
    && cache.brokenClips === 0
    && cache.decodeFailures === 0
    && cache.invalidDimensions === 0;
}

function noteApprovalCoverage(beat, renderMs) {
  const coverage = state.reviewCoverage[state.scope];
  if (!coverage || !currentFrameIsApprovalQuality()) {
    if (coverage && Object.hasOwn(coverage, 'lastAnimationTime')) coverage.lastAnimationTime = null;
    return;
  }
  coverage.frameTimings.push(renderMs);
  if (coverage.frameTimings.length > RENDER_CONTRACT.performance.sampleFrames) coverage.frameTimings.shift();
  if (state.scope === 'artist-test') {
    coverage.matrix = true;
    if (!state.reducedMotion) {
      if (coverage.lastAnimationTime !== null) {
        const delta = Math.max(0, Math.min(50, state.animationTimeMs - coverage.lastAnimationTime));
        coverage.animationMs += delta;
      }
      coverage.lastAnimationTime = state.animationTimeMs;
    } else {
      coverage.lastAnimationTime = null;
    }
  } else {
    coverage.beats.add(beat.id);
  }
}

function approvalGate() {
  const evidence = state.approvalEvidence[state.scope];
  const requirements = scopeRequirements();
  const coverage = approvalCoverageSummary();
  const approvalPerformance = approvalPerformanceSummary();
  const checks = selectedHumanChecks();
  const requiredChecks = elements.reviewChecklist?.querySelectorAll('input[name="reviewCriterion"]').length || 7;
  const reasons = [];
  if (!evidence?.valid) reasons.push(evidence?.reasons?.[0] || 'Strict approval evidence is unavailable.');
  if (requirements.readyAssets !== requirements.assets || requirements.indexedExports !== requirements.requiredExports) reasons.push('Runtime index does not contain every scoped export.');
  if (state.zoom !== RENDER_CONTRACT.pixelDensity.normalGameplayZoom) reasons.push('Return to 1.0x normal gameplay zoom.');
  if (state.renderMode === 'procedural' || state.forceFallback) reasons.push('Use commissioned-with-fallback mode without forced fallback.');
  if (!currentFrameIsApprovalQuality()) reasons.push('The active approval view is not fully commissioned or has runtime fallback faults.');
  if (!coverage.complete) reasons.push(state.scope === 'artist-test' ? 'Review the complete paid-test matrix and animation.' : 'Review all eight beats with commissioned assets.');
  if (!approvalPerformance.pass) reasons.push(`Collect ${RENDER_CONTRACT.performance.sampleFrames} qualifying 1.0x performance samples.`);
  if (checks.length !== requiredChecks) reasons.push(`Complete all ${requiredChecks} human acceptance checks.`);
  return {
    ready: reasons.length === 0,
    status: reasons.length === 0 ? 'ready' : 'blocked',
    reasons,
    checks,
    requiredChecks,
    evidence: approvalReportSummary(evidence),
    requirements,
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
    requirements: gate.requirements,
    coverage: gate.coverage,
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
  state.zoom = zoom;
  if (elements.zoomSelect) elements.zoomSelect.value = String(zoom);
  render(true);
  return zoom;
}

function setMode(value) {
  if (!VALID_MODES.has(value)) throw new RangeError(`Unknown render mode: ${value}`);
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
  state.reducedMotion = Boolean(value);
  if (elements.reducedMotion) elements.reducedMotion.checked = state.reducedMotion;
  render(true);
  return state.reducedMotion;
}

function setScope(value) {
  if (!['artist-test', 'golden-scene'].includes(value)) throw new RangeError(`Unknown review scope: ${value}`);
  captureHumanChecks();
  state.scope = value;
  if (elements.scopeSelect) elements.scopeSelect.value = value;
  restoreHumanChecks();
  prepareReceiptDownload(state.approvalReceipts[value]);
  render(true);
  return value;
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
  ctx.strokeStyle = '#725438';
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
  context.strokeStyle = '#725438';
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
    elements.warningTelemetry.innerHTML = warnings.length
      ? `<ul>${warnings.map((warning) => `<li><strong>${escapeHtml(warning.code)}</strong> · ${escapeHtml(warning.id)}<br><span>${escapeHtml(warning.response)}</span></li>`).join('')}</ul>`
      : '<p class="empty-state">No runtime warnings reported.</p>';
  }
}

function prepareReceiptDownload(receipt) {
  if (!elements.downloadApprovalReceipt) return;
  const nextKey = receipt ? `${receipt.receiptId}:${receipt.checksum?.value || ''}` : null;
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
    scope: report.scope,
    approval: {
      status: 'approved',
      localOnly: true,
      humanRequired: true,
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
        exportCount: report.artifactDigests.exports.length,
        editableSourceCount: report.artifactDigests.editableSources.length,
      },
    },
    runtimeIndex: {
      version: state.indexMeta.version,
      scope: state.indexMeta.scope,
      manifestHash: state.indexMeta.manifestHash,
      availableExports: state.indexMeta.availableExports,
      scopedRuntimeAssetHash: state.indexMeta.runtimeAssetHashes?.[report.scope]
        || state.indexMeta.runtimeAssetHash,
    },
    rendererReview: {
      page: `${location.origin}${location.pathname}`,
      zoom: state.zoom,
      renderMode: state.renderMode,
      forceFallback: state.forceFallback,
      reducedMotion: state.reducedMotion,
      coverage: gate.coverage,
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
    elements.recordApproval.textContent = 'Recording local receipt…';
  }
  try {
    const payload = buildApprovalReceiptPayload(gate);
    const receipt = {
      ...payload,
      checksum: {
        algorithm: 'SHA-256',
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
      elements.approvalReceiptStatus.textContent = `Receipt failed: ${error?.message || 'local storage or checksum unavailable'}.`;
    }
    updateApproval();
    return null;
  }
}

function updateApproval() {
  const gate = approvalGate();
  const evidence = state.approvalEvidence[state.scope];
  const receipt = state.approvalReceipts[state.scope];
  document.body.dataset.reviewState = gate.status;
  if (elements.gateBadge) {
    elements.gateBadge.dataset.state = gate.status;
    elements.gateBadge.textContent = gate.ready ? 'Ready' : 'Blocked';
  }
  if (elements.recordApproval) {
    elements.recordApproval.disabled = !gate.ready;
    elements.recordApproval.setAttribute('aria-disabled', String(!gate.ready));
    elements.recordApproval.textContent = receipt ? 'Record updated approval receipt' : 'Record golden scene approval';
  }
  if (elements.approvalEvidenceStatus) {
    elements.approvalEvidenceStatus.dataset.state = evidence?.valid ? 'ready' : 'blocked';
    elements.approvalEvidenceStatus.textContent = evidence?.valid
      ? `Strict evidence valid: ${evidence.report.scope}, manifest ${evidence.report.manifestHash.slice(0, 12)}.`
      : `Strict evidence blocked: ${evidence?.reasons?.[0] || 'report unavailable'}`;
  }
  if (elements.approvalReason) {
    elements.approvalReason.dataset.state = gate.status;
    elements.approvalReason.innerHTML = gate.ready
      ? `<strong>Ready to record.</strong> Strict evidence, all ${gate.requiredChecks} human checks, complete renderer coverage, and qualifying performance evidence passed at 1.0x.`
      : `<strong>Approval blocked.</strong> ${gate.reasons.slice(0, 3).map(escapeHtml).join(' ')}${gate.reasons.length > 3 ? ` ${gate.reasons.length - 3} more gate${gate.reasons.length - 3 === 1 ? '' : 's'} remain.` : ''}`;
  }
  if (elements.approvalReceiptStatus) {
    elements.approvalReceiptStatus.textContent = receipt
      ? `Local receipt ${receipt.receiptId} recorded ${new Date(receipt.recordedAt).toLocaleString()}; package ${receipt.packageHash.slice(0, 12)}; checksum ${receipt.checksum.value.slice(0, 12)}.`
      : 'No local approval receipt is recorded for this scope and manifest.';
  }
  prepareReceiptDownload(receipt);
}

function updateUi(forceTelemetry = false) {
  if (!state.ready || !state.scene) return;
  const sequenceBeat = currentBeat();
  const beat = activeReviewBeat();
  const progress = state.sequenceTimeMs / state.totalDurationMs;
  if (elements.playPause) {
    elements.playPause.textContent = state.playing ? 'Pause sequence' : 'Play sequence';
    elements.playPause.setAttribute('aria-pressed', String(state.playing));
  }
  if (elements.sceneStatus) {
    elements.sceneStatus.dataset.state = state.playing ? 'playing' : 'paused';
    elements.sceneStatus.textContent = state.scope === 'artist-test'
      ? `${state.playing ? 'Playing' : 'Paused'}: paid artist test matrix at ${humanise(effectiveLighting(beat)).toLowerCase()}.`
      : `${state.playing ? 'Playing' : 'Paused'}: Beat ${state.beatIndex + 1}, ${sequenceBeat.title.toLowerCase()}.`;
  }
  if (elements.timeScrubber) elements.timeScrubber.value = String(progress);
  if (elements.timeReadout) elements.timeReadout.textContent = `${Math.round(progress * 100)}%`;
  for (const button of elements.beatButtons) {
    const active = Number(button.dataset.beatIndex) === state.beatIndex;
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  if (elements.previousBeat) elements.previousBeat.disabled = state.beatIndex === 0;
  if (elements.nextBeat) elements.nextBeat.disabled = state.beatIndex === state.scene.beats.length - 1;
  if (elements.canvasDescription) {
    const prefix = state.scope === 'artist-test'
      ? 'Paid artist test matrix.'
      : `Beat ${state.beatIndex + 1} of ${state.scene.beats.length}.`;
    elements.canvasDescription.textContent = `${prefix} ${beat.description} Active lighting: ${humanise(effectiveLighting(beat))}. View: ${state.zoom.toFixed(1)}x ${state.renderMode}, ${state.reducedMotion ? 'reduced motion with static frame 01' : 'animation enabled'}.`;
  }
  canvas.setAttribute('aria-label', `MarsScape golden scene, beat ${state.beatIndex + 1}: ${beat.title}`);
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
  elements.forceFallback?.addEventListener('change', (event) => {
    state.forceFallback = event.currentTarget.checked;
    render(true);
  });
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
    const [scene, manifest, commissionedIndex] = await Promise.all([
      fetchJson(SCENE_URL, 'Golden scene'),
      fetchJson(MANIFEST_URL, 'Golden-slice manifest'),
      fetchJson(COMMISSIONED_INDEX_URL, 'Commissioned-art index').catch((error) => {
        addWarning({
          code: 'COMMISSIONED_INDEX_MISSING',
          id: 'index.json',
          response: `${error.message}; legacy and procedural fallbacks retained.`,
        });
        return {
          version: 1,
          contractVersion: RENDER_CONTRACT.version,
          decision: RENDER_CONTRACT.decision,
          assets: [],
        };
      }),
    ]);
    assertSceneContract(scene, manifest);
    state.scene = scene;
    state.manifest = manifest;
    state.indexMeta = commissionedIndex;
    buildSceneIndexes();

    const legacyIds = [...new Set(manifest.assets.map((asset) => asset.fallbackSprite).filter(Boolean))];
    const [commissionedResult, legacyResult] = await Promise.all([
      commissionedCache.loadAndPrime(commissionedIndex, { baseUrl: COMMISSIONED_BASE_URL.href })
        .catch((error) => {
          addWarning({ code: 'COMMISSIONED_INDEX_FAILED', id: 'index.json', response: `${error.message}; legacy and procedural fallbacks retained.` });
          return { index: { assets: 0, states: 0, frames: 0, declaredFrames: 0 }, prime: { requested: 0, loaded: 0, failed: 0 } };
      }),
      legacyCache.prime(legacyIds),
    ]);
    await loadApprovalReports();
    await loadStoredReceipts();
    state.ready = true;
    restoreHumanChecks();
    prepareReceiptDownload(state.approvalReceipts[state.scope]);
    const indexed = commissionedResult.index.assets;
    if (elements.loadStatus) {
      elements.loadStatus.dataset.state = indexed === manifest.assets.length ? 'ready' : 'blocked';
      elements.loadStatus.textContent = indexed === manifest.assets.length
        ? `Loaded: ${indexed} commissioned assets and ${legacyResult} legacy fallbacks.`
        : `Fallback ready: ${indexed}/${manifest.assets.length} commissioned assets indexed; ${legacyResult} legacy sprites cached.`;
    }
    render(true);
  } catch (error) {
    state.fatalError = error?.message || String(error);
    if (elements.loadStatus) {
      elements.loadStatus.dataset.state = 'error';
      elements.loadStatus.textContent = `Load failed: ${state.fatalError}`;
    }
    drawLoading('Golden scene unavailable — see load status.', '#ff9b89');
  }
  requestAnimationFrame(animationLoop);
}

void initialise();
