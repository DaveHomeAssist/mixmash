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

function key(asset) {
  return `${asset.family}:${asset.id}`;
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
  assert.match(html, /id="approvalReceiptStatus"/);
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
  assert.match(client, /digests\.exports\) && digests\.exports\.length === requirements\.requiredExports/);
  assert.match(client, /digests\.editableSources\) && digests\.editableSources\.length === requirements\.assets/);
  assert.match(client, /counts\.presentExports === requirements\.requiredExports/);
  assert.match(client, /counts\.editableSources === requirements\.assets/);
});

test('future approval requires renderer coverage and creates only local checksummed evidence', () => {
  assert.match(client, /state\.zoom === RENDER_CONTRACT\.pixelDensity\.normalGameplayZoom/);
  assert.match(client, /state\.frameSources\.commissioned === state\.frameSources\.requested/);
  assert.match(client, /coverage\.beats\.add\(beat\.id\)/);
  assert.match(client, /coverage\.animationMs >= RENDER_CONTRACT\.animation\.clips\.idle\.frames/);
  assert.match(client, /approvalPerformance\.pass/);
  assert.match(client, /checks\.length !== requiredChecks/);
  assert.match(client, /APPROVAL_RECEIPT_SCHEMA = 'marsscape-art-approval-receipt\/v1'/);
  assert.match(client, /globalThis\.localStorage\?\.setItem\(approvalStorageKey/);
  assert.match(client, /receipt\.packageHash !== currentDigests\.packageHash/);
  assert.match(client, /receipt\.runtimeAssetHash !== currentDigests\.runtimeAssetHash/);
  assert.match(client, /globalThis\.crypto\.subtle\.digest\('SHA-256'/);
  assert.match(client, /new Blob\(/);
  assert.match(client, /URL\.createObjectURL/);
  assert.match(client, /getApprovalStatus/);
  assert.match(client, /getApprovalReceipt/);
});

test('commissioned non-active states retain renderer-owned structural cues', () => {
  assert.match(
    client,
    /if \(commissioned\) \{[\s\S]*?if \(stateName !== 'active'\) \{[\s\S]*?drawStateTreatment\([\s\S]*?noteSource\('commissioned'\)/,
  );
});
