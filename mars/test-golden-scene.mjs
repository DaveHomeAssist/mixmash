import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RENDER_CONTRACT } from './render-contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const scene = JSON.parse(readFileSync(join(HERE, 'art', 'golden-scene.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(HERE, 'art', 'golden-slice.json'), 'utf8'));
const artistApproval = JSON.parse(readFileSync(join(HERE, 'art', 'reports', 'artist-test-approval.json'), 'utf8'));
const goldenApproval = JSON.parse(readFileSync(join(HERE, 'art', 'reports', 'golden-approval.json'), 'utf8'));
const html = readFileSync(join(HERE, 'golden-scene.html'), 'utf8');
const client = readFileSync(join(HERE, 'golden-scene.js'), 'utf8');
const css = readFileSync(join(HERE, 'golden-scene.css'), 'utf8');

function key(asset) {
  return `${asset.family}:${asset.id}`;
}

function cssColour(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[a-f0-9]{6})`, 'i'));
  assert.ok(match, `CSS token --${name} exists`);
  return match[1];
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(left, right) {
  const luminances = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

test('golden scene is locked to DEC-79 and the executable renderer contract', () => {
  assert.equal(scene.version, 1);
  assert.equal(scene.contractVersion, RENDER_CONTRACT.version);
  assert.equal(scene.decision, RENDER_CONTRACT.decision);
  assert.equal(scene.normalGameplayZoom, RENDER_CONTRACT.pixelDensity.normalGameplayZoom);
  assert.equal(scene.defaultReview.zoom, 1);
});

test('golden scene has the exact eight-beat approved sequence shape', () => {
  assert.deepEqual(scene.beats.map((beat) => beat.id), manifest.sequence);
  for (const beat of scene.beats) {
    assert.ok(beat.description.length > 20, `${beat.id} has an operator-readable description`);
    assert.ok(beat.assertions.length >= 2, `${beat.id} has explicit visual assertions`);
    assert.equal(RENDER_CONTRACT.light.profiles[beat.lighting] !== undefined, true, `${beat.id} uses a renderer lighting profile`);
    assert.equal(beat.camera.zoom, 1, `${beat.id} defaults to normal gameplay zoom`);
  }
});

test('every golden-slice asset, state, effect, and lighting profile appears in review evidence', () => {
  const declared = new Map(manifest.assets.map((asset) => [key(asset), asset]));
  const rendered = new Set([
    ...scene.terrain.map((entry) => entry.asset),
    ...scene.beats.flatMap((beat) => beat.entities.map((entity) => entity.asset)),
  ]);
  assert.deepEqual([...rendered].sort(), [...declared.keys()].sort());

  const renderedStates = new Set(scene.beats.flatMap((beat) => beat.entities.map((entity) => entity.state)));
  assert.deepEqual([...renderedStates].sort(), [...RENDER_CONTRACT.states].sort());

  const renderedEffects = new Set(scene.beats.flatMap((beat) => beat.entities
    .filter((entity) => entity.asset.startsWith('effect:'))
    .map((entity) => entity.asset.split(':')[1])));
  assert.deepEqual([...renderedEffects].sort(), ['dust', 'power_glow', 'repair', 'selection', 'warning']);
  assert.deepEqual([...new Set(scene.beats.map((beat) => beat.lighting))].sort(), ['dawn', 'daylight', 'night', 'storm']);

  for (const beat of scene.beats) {
    for (const entity of beat.entities) {
      const asset = declared.get(entity.asset);
      assert.ok(asset, `${entity.asset} is declared`);
      assert.ok(asset.states.some((state) => state.name === entity.state), `${entity.asset}:${entity.state} is a declared export state`);
    }
  }
});

test('machine-complete scene data cannot impersonate human approval', () => {
  assert.equal(scene.approval.status, 'blocked');
  assert.equal(scene.approval.requiresHuman, true);
  assert.equal(scene.approval.requiredZoom, 1);
  assert.match(scene.approval.reason, /absent/i);
  assert.ok(scene.reviewChecks.includes('procedural_fallback'));
  assert.ok(scene.reviewChecks.includes('reduced_motion'));
  assert.ok(scene.reviewChecks.includes('performance'));
});

test('the in-renderer review surface is semantic, deployable, and fail-closed', () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/mixmash\.games\/mars\/golden-scene\.html"/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /<canvas id="goldenCanvas" width="940" height="620"/);
  assert.equal((html.match(/data-beat-index=/g) || []).length, 8);
  assert.match(html, /id="zoomSelect"/);
  assert.match(html, /<option value="1" selected>1\.0x normal<\/option>/);
  assert.match(html, /id="reducedMotion"/);
  assert.match(html, /id="recordApproval"[^>]*disabled/);
  assert.match(html, /id="approvalEvidenceStatus"/);
  assert.match(html, /id="approvalGateStatus"[^>]*role="status"/);
  assert.match(html, /id="approvalReceiptStatus"/);
  assert.match(html, /id="reviewContextStatus"[^>]*role="status"/);
  assert.equal((html.match(/<input[^>]*name="reviewCriterion"[^>]*disabled/g) || []).length, 7);
  assert.match(html, /id="approvalBlockerList"/);
  assert.match(html, /id="downloadApprovalReceipt"[^>]*download[^>]*hidden/);
  assert.match(html, /type="module" src="\.\/golden-scene\.js"/);
  assert.match(client, /new CommissionedArtCache/);
  assert.match(client, /commissionedCache\.draw/);
  assert.match(client, /legacyCache\.drawSprite/);
  assert.match(client, /drawProceduralAsset/);
  assert.match(client, /window\.render_golden_scene_to_text/);
  assert.match(client, /window\.advanceTime/);
  assert.match(client, /window\.__goldenScene/);
  assert.match(client, /elements\.recordApproval\.disabled = !gate\.ready/);
});

test('live regions update only for meaningful state changes and expose every blocker', () => {
  assert.match(client, /function setTextIfChanged\(element, value\)/);
  assert.match(client, /if \(element\.textContent === text\) return false/);
  assert.match(client, /function setMarkupIfChanged\(element, markup, signature = markup\)/);
  assert.match(client, /warningSignature !== state\.warningSignature/);
  assert.match(client, /setMarkupIfChanged\(elements\.warningTelemetry, warningMarkup/);
  assert.match(client, /reasons\.push\(\.\.\.\(evidence\?\.reasons\?\.length \? evidence\.reasons/);
  assert.match(client, /gate\.reasons\.map\(\(reason\) => `<li>/);
  assert.doesNotMatch(client, /gate\.reasons\.slice\(/);
  assert.doesNotMatch(html, /id="approvalReason"[^>]*(?:aria-live|role="status")/);
});

test('human acceptance is fail-closed and bound to the current package and view', () => {
  assert.match(client, /function humanApprovalContextKey\(scope = state\.scope\)/);
  assert.match(client, /packageContext\.packageHash/);
  assert.match(client, /packageContext\.runtimeAssetHash/);
  assert.match(client, /packageContext\.runtimeIdentitySchema/);
  assert.match(client, /packageContext\.reviewSurfaceHash/);
  assert.match(client, /state\.zoom !== RENDER_CONTRACT\.pixelDensity\.normalGameplayZoom/);
  assert.match(client, /state\.renderMode === 'procedural'/);
  assert.match(client, /state\.forceFallback/);
  assert.match(client, /state\.reducedMotion/);
  assert.match(client, /state\.humanCheckContexts\[state\.scope\] !== contextKey/);
  assert.match(client, /input\.disabled = !contextKey \|\| !canonicalDom/);
  assert.match(client, /if \(zoom !== state\.zoom\) invalidateHumanChecks\(\)/);
  assert.match(client, /if \(value !== state\.renderMode\) invalidateHumanChecks\(\)/);
  assert.match(client, /invalidateHumanChecks\(state\.scope\)/);
  assert.match(client, /invalidateHumanChecks\(value\)/);
});

test('paid artist scope removes sequence controls and names its review context', () => {
  assert.match(html, /id="playbackBar"/);
  assert.match(html, /id="sequencePanel"/);
  assert.match(client, /elements\.sequencePanel\.hidden = artistTest/);
  assert.match(client, /elements\.playbackBar\.hidden = artistTest/);
  assert.match(client, /elements\.playPause\.disabled = artistTest/);
  assert.match(client, /elements\.timeScrubber\.disabled = artistTest/);
  assert.match(client, /MarsScape paid artist test matrix at normal gameplay scale/);
  assert.match(client, /scopeLabel = state\.scope === 'artist-test' \? 'paid artist test' : 'golden scene'/);
});

test('page boundaries retain the art-bible 3:1 non-text contrast floor', () => {
  const boundaries = ['line', 'line-soft'].map(cssColour);
  const adjacentSurfaces = ['basalt', 'surface', 'surface-raised', 'surface-control'].map(cssColour);
  for (const boundary of boundaries) {
    for (const surface of adjacentSurfaces) {
      assert.ok(contrastRatio(boundary, surface) >= 3, `${boundary} against ${surface} is at least 3:1`);
    }
  }
  assert.match(css, /\.canvas-frame[\s\S]*?border: 1px solid var\(--line\)/);
  assert.match(css, /\.button:disabled[\s\S]*?border-color: var\(--line-soft\)/);
  assert.match(css, /body \.mixnav a,[\s\S]*?border-color: var\(--line\)/);
});

test('shared navigation follows the skip link in focus order on this page', () => {
  assert.match(html, /<body[^>]*>\s*<a class="skip-link"/);
  assert.match(client, /function placeSharedNavAfterSkipLink\(\)/);
  assert.match(client, /elements\.skipLink\.insertAdjacentElement\('afterend', nav\)/);
  assert.match(client, /installSharedNavFocusOrder\(\);\s*void initialise\(\);/);
});

test('strict per-scope reports are validated against the live contract and remain blocked today', () => {
  assert.equal(artistApproval.scope, 'artist-test');
  assert.equal(artistApproval.counts.assets, 4);
  assert.equal(artistApproval.counts.expectedExports, 8);
  assert.equal(artistApproval.approvalReady, false);
  assert.equal(artistApproval.machineReady, false);
  assert.equal(artistApproval.artifactDigests.complete, false);
  assert.match(artistApproval.artifactDigests.packageHash, /^[a-f0-9]{64}$/);
  assert.equal(goldenApproval.scope, 'full');
  assert.equal(goldenApproval.counts.assets, 26);
  assert.equal(goldenApproval.counts.expectedExports, 108);
  assert.equal(goldenApproval.approvalReady, false);
  assert.equal(goldenApproval.machineReady, false);
  assert.equal(goldenApproval.artifactDigests.complete, false);
  assert.match(goldenApproval.artifactDigests.packageHash, /^[a-f0-9]{64}$/);

  assert.match(client, /artist-test-approval\.json/);
  assert.match(client, /golden-approval\.json/);
  assert.match(client, /report\?\.scope === expectedScope/);
  assert.match(client, /report\?\.contractVersion === RENDER_CONTRACT\.version/);
  assert.match(client, /report\?\.decision === RENDER_CONTRACT\.decision/);
  assert.match(client, /report\?\.manifestHash === state\.indexMeta\?\.manifestHash/);
  assert.match(client, /report\?\.approval === true/);
  assert.match(client, /report\?\.passed === true/);
  assert.match(client, /report\?\.approvalReady === true/);
  assert.match(client, /report\?\.machineReady === true/);
  assert.match(client, /report\?\.indexVerification\?\.passed === true/);
  assert.match(client, /digests\.runtimeAssetHash === indexedRuntimeHash/);
  assert.match(client, /digests\.runtimeIdentitySchema === RUNTIME_IDENTITY_SCHEMA/);
  assert.match(client, /state\.indexMeta\?\.identityVerified === true/);
  assert.match(client, /state\.indexMeta\?\.scopedIdentityVerified === true/);
  assert.match(client, /digests\.exports\) && digests\.exports\.length === requirements\.requiredExports/);
  assert.match(client, /digests\.editableSources\) && digests\.editableSources\.length === requirements\.assets/);
  assert.match(client, /counts\.presentExports === requirements\.requiredExports/);
  assert.match(client, /counts\.editableSources === requirements\.assets/);
});

test('future approval requires renderer coverage and creates only local integrity evidence', () => {
  assert.match(client, /state\.zoom === RENDER_CONTRACT\.pixelDensity\.normalGameplayZoom/);
  assert.match(client, /state\.frameSources\.commissioned === state\.frameSources\.requested/);
  assert.match(client, /coverage\.beatZooms\.add\(beatZoomLightingTuple\(beat, state\.zoom, lighting\)\)/);
  assert.match(client, /coverage\.animationMs >= requiredAnimationMs/);
  assert.match(client, /approvalPerformance\.pass/);
  assert.match(client, /checks\.length !== requiredChecks/);
  assert.match(client, /function scopePrimeSelection\(scope = state\.scope\)/);
  assert.match(client, /function scopePackageQuality\(scope = state\.scope\)/);
  assert.match(client, /commissionedCache\.getFrameCoverage\(/);
  assert.match(client, /cacheCoverage\.expected === requirements\.requiredExports/);
  assert.match(client, /cacheCoverage\.cached === requirements\.requiredExports/);
  assert.match(client, /cacheCoverage\.pending === 0/);
  assert.match(client, /cacheCoverage\.failed === 0/);
  assert.match(client, /cacheCoverage\.missing === 0/);
  assert.match(client, /packageQualityMeetsContract\(packageQuality\)/);
  assert.match(client, /packageQuality: gate\.packageQuality/);
  assert.match(client, /packageQualityMeetsContract\(review\?\.packageQuality, scope\)/);
  assert.match(client, /packageQualityMeetsContract\(scopePackageQuality\(scope\), scope\)/);
  assert.match(client, /commissionedCache\.prime\(\{ reducedMotion: false \}\)/);
  assert.match(client, /APPROVAL_RECEIPT_SCHEMA = 'marsscape-art-approval-receipt\/v3'/);
  assert.match(client, /APPROVAL_STORAGE_PREFIX = 'marsscape\.dec79\.approval\.v3'/);
  assert.match(client, /globalThis\.localStorage\?\.setItem\(approvalStorageKey/);
  assert.match(client, /receipt\.packageHash !== context\.packageHash/);
  assert.match(client, /receipt\.runtimeAssetHash !== context\.runtimeAssetHash/);
  assert.match(client, /receipt\.runtimeIdentitySchema !== context\.runtimeIdentitySchema/);
  assert.match(client, /receipt\.reviewSurfaceHash !== context\.reviewSurfaceHash/);
  assert.match(client, /purpose: 'client-integrity-only-not-authentication'/);
  assert.match(client, /authenticated: false/);
  assert.match(client, /authentication: 'external-git-review-required'/);
  assert.match(client, /new Blob\(/);
  assert.match(client, /URL\.createObjectURL/);
  assert.match(client, /getApprovalStatus/);
  assert.match(client, /getApprovalReceipt/);
});

test('full golden approval uses the exact package-bound review-condition ledger', () => {
  const requiredBeatZooms = scene.beats.flatMap((beat) => [0.5, 1, 2.5].map((zoom) => `${beat.id}@${zoom.toFixed(1)}x#${beat.lighting}`));
  assert.equal(requiredBeatZooms.length, 24);
  assert.deepEqual(requiredBeatZooms.slice(0, 3), ['land_at_outpost@0.5x#daylight', 'land_at_outpost@1.0x#daylight', 'land_at_outpost@2.5x#daylight']);
  assert.deepEqual(Object.keys(RENDER_CONTRACT.light.profiles), ['dawn', 'daylight', 'storm', 'night']);

  assert.match(client, /GOLDEN_REVIEW_ZOOMS = Object\.freeze\(\[\.\.\.VALID_ZOOMS\]\.sort/);
  assert.match(client, /GOLDEN_REVIEW_LIGHTING = Object\.freeze\(Object\.keys\(RENDER_CONTRACT\.light\.profiles\)\)/);
  assert.match(client, /contract: 'golden-scene-review-conditions\/v3'/);
  assert.match(client, /tupleSchema: 'beat@zoom#canonical-lighting\/v1'/);
  assert.match(client, /requiredBeatZoomConditions\(\)/);
  assert.match(client, /lightingProfiles\.add\(lighting\)/);
  assert.match(client, /coverage\.proceduralFallbackAt1x = true/);
  assert.match(client, /coverage\.reducedMotionCommissionedAt1x = true/);
  assert.match(client, /currentFrameIsProceduralOnly\(\) && normalZoom && animated/);
  assert.match(client, /commissioned && normalZoom && state\.reducedMotion/);
  assert.match(client, /recordApprovalPerformanceSample\(coverage, renderMs\)/);
  assert.match(client, /conditionLedger: gate\.coverage/);
});

test('beat and zoom credit rejects a non-canonical effective lighting override', () => {
  const beat = scene.beats[0];
  const wrongLighting = Object.keys(RENDER_CONTRACT.light.profiles).find((profile) => profile !== beat.lighting);
  const canonical = `${beat.id}@1.0x#${beat.lighting}`;
  const mismatched = `${beat.id}@1.0x#${wrongLighting}`;
  const required = scene.beats.flatMap((entry) => [0.5, 1, 2.5]
    .map((zoom) => `${entry.id}@${zoom.toFixed(1)}x#${entry.lighting}`));

  assert.notEqual(canonical, mismatched);
  assert.equal(required.includes(mismatched), false);
  assert.match(client, /function beatZoomLightingTuple\(beat, zoom, lighting = beat\.lighting\)/);
  assert.match(client, /if \(lighting === beat\.lighting\) \{/);
  assert.match(client, /beatZoomLightingTuple\(beat, state\.zoom, lighting\)/);
  assert.match(client, /ledger\.beatZooms\?\.tupleSchema === 'beat@zoom#canonical-lighting\/v1'/);
  assert.match(client, /sameOrderedStrings\(ledger\.beatZooms\?\.completed, requiredBeatZooms\)/);
});

test('review evidence resets on manifest, package, runtime metadata, or review-surface digest drift', () => {
  assert.match(client, /key: \[scope, report\.manifestHash, runtimeIdentitySchema, digests\.packageHash, digests\.runtimeAssetHash, reviewSurfaceHash\]\.join\('\|'\)/);
  assert.match(client, /state\.reviewCoverage\[scope\]\?\.contextKey !== contextKey/);
  assert.match(client, /state\.reviewCoverage\[scope\] = createReviewCoverage\(scope, contextKey\)/);
  assert.match(client, /receipt\.packageHash !== context\.packageHash/);
  assert.match(client, /receipt\.runtimeAssetHash !== context\.runtimeAssetHash/);
  assert.match(client, /receipt\.runtimeIdentitySchema !== context\.runtimeIdentitySchema/);
  assert.match(client, /receipt\.reviewSurfaceHash !== context\.reviewSurfaceHash/);
  assert.match(client, /state\.approvalReceipts\[scope\] = null/);
  assert.match(client, /report\?\.manifestHash !== state\.indexMeta\.manifestHash/);
  assert.match(client, /digests\.runtimeAssetHash !== runtimeAssetHash/);
  assert.match(client, /ledger\.packageContext\?\.runtimeAssetHash !== context\.runtimeAssetHash/);
  assert.match(client, /ledger\.packageContext\?\.runtimeIdentitySchema !== context\.runtimeIdentitySchema/);
  assert.match(client, /runtimeIdentitySchema: report\.artifactDigests\.runtimeIdentitySchema/);
  assert.match(client, /runtimeIdentitySchema: state\.indexMeta\.runtimeIdentitySchema/);
});

test('browser approval independently verifies complete ordered runtime-index metadata', () => {
  assert.match(client, /COMMISSIONED_RUNTIME_IDENTITY_SCHEMA/);
  assert.match(client, /function canonicalRuntimeAssetsForScope\(indexMeta, manifest, scope\)/);
  assert.match(client, /async function verifyRuntimeIndexIdentity\(indexMeta, manifest\)/);
  assert.match(client, /async function manifestIdentityHash\(manifest\)/);
  assert.match(client, /sha256Bytes\(new TextEncoder\(\)\.encode\(JSON\.stringify\(manifest\)\)\)/);
  assert.match(client, /indexMeta\.manifestHash !== manifestHash/);
  assert.match(client, /runtimeAssetIdentityHash\(canonicalRuntimeAssetsForScope\(indexMeta, manifest, 'full'\)\)/);
  assert.match(client, /runtimeAssetIdentityHash\(canonicalRuntimeAssetsForScope\(indexMeta, manifest, 'artist-test'\)\)/);
  assert.match(client, /indexMeta\.runtimeAssetHash !== fullHash \|\| indexMeta\.runtimeAssetHashes\?\.full !== fullHash/);
  assert.match(client, /indexMeta\.runtimeAssetHashes\?\.\['artist-test'\] !== artistTestHash/);
  assert.match(client, /commissionedCache\.getIndexMetadata\(\)/);
  assert.match(client, /state\.indexMeta = await verifyRuntimeIndexIdentity/);
  assert.match(client, /manifestIdentityVerified: true/);
  assert.match(client, /commissionedCache\.clear\(\);\s*state\.indexMeta = null/);
});

test('v3 receipts reject incomplete or stale condition ledgers and checklist contracts', () => {
  assert.match(client, /receiptRendererReviewMeetsContract\(receipt, scope\)/);
  assert.match(client, /conditionLedgerMeetsContract\(review\?\.conditionLedger, scope\)/);
  assert.match(client, /sameOrderedStrings\(ledger\.beatZooms\?\.completed, requiredBeatZooms\)/);
  assert.match(client, /sameOrderedStrings\(ledger\.lightingProfiles\?\.completed, \[\.\.\.GOLDEN_REVIEW_LIGHTING\]\)/);
  assert.match(client, /ledger\.proceduralFallbackAt1x\?\.completed === true/);
  assert.match(client, /ledger\.reducedMotionCommissionedAt1x\?\.completed === true/);
  assert.match(client, /performance\?\.samples >= RENDER_CONTRACT\.performance\.sampleFrames/);
  assert.match(client, /performance\?\.qualification\?\.motion === 'animated'/);
  assert.match(client, /sameOrderedStrings\(receipt\?\.humanReview\?\.checks, \[\.\.\.CANONICAL_HUMAN_CHECK_VALUES\]\)/);
  assert.match(client, /humanReviewDomMeetsContract\(\)/);
  assert.doesNotMatch(client, /marsscape-art-approval-receipt\/v1/);
  assert.doesNotMatch(client, /marsscape-art-approval-receipt\/v2/);
});

test('review-surface identity covers the exact deployed renderer files and fails closed', () => {
  const expected = [
    'golden-scene.html',
    'golden-scene.css',
    'golden-scene.js',
    'art/golden-scene.json',
    'art/golden-slice.json',
    'render-contract.mjs',
    'commissioned-art.mjs',
    'sprite-canvas.mjs',
    'sprites.mjs',
    '../src/kit/nav.js',
  ];
  for (const path of expected) assert.match(client, new RegExp(`path: '${path.replace('.', '\\.')}'`));
  assert.match(client, /function computeReviewSurfaceEvidence\(\)/);
  assert.match(client, /response\.arrayBuffer\(\)/);
  assert.match(client, /contract: 'marsscape-review-surface\/v1'/);
  assert.match(client, /state\.reviewSurface = reviewSurface/);
  assert.match(client, /REVIEW_SURFACE_HASH_UNAVAILABLE/);
  assert.match(client, /rendering retained and approval blocked/);
});

test('the seven human checks are immutable and must exactly match deployed DOM ids and values', () => {
  const deployed = [...html.matchAll(/<input id="([^"]+)" name="reviewCriterion" value="([^"]+)" type="checkbox" disabled \/>/g)]
    .map((match) => ({ id: match[1], value: match[2] }));
  assert.deepEqual(deployed, [
    { id: 'reviewAnchors', value: 'anchors' },
    { id: 'reviewFootprints', value: 'footprints' },
    { id: 'reviewReadability', value: 'readability' },
    { id: 'reviewScale', value: 'scale' },
    { id: 'reviewLighting', value: 'lighting' },
    { id: 'reviewAnimation', value: 'animation' },
    { id: 'reviewPerformance', value: 'performance' },
  ]);
  assert.match(client, /const CANONICAL_HUMAN_CHECKS = Object\.freeze\(\[/);
  assert.match(client, /function canonicalHumanReviewInputs\(\)/);
  assert.match(client, /inputs\.length !== CANONICAL_HUMAN_CHECKS\.length/);
  assert.match(client, /if \(!humanReviewDomMeetsContract\(\)\) return false/);
  assert.match(client, /deployed checklist does not exactly match the seven canonical DEC-79 human-check IDs/);
});

test('commissioned non-active states retain renderer-owned structural cues', () => {
  assert.match(
    client,
    /if \(commissioned\) \{[\s\S]*?if \(stateName !== 'active'\) \{[\s\S]*?drawStateTreatment\([\s\S]*?noteSource\('commissioned'\)/,
  );
});
