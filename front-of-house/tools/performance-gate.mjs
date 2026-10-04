// Paired CI regression limits; these are change-detection tolerances, not device frame-rate targets.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { summarize } from './performance-stats.mjs';

export const BASELINE = '6ed7b7c2991ef0d8ccc71fe167444f5422cd7483';
export const LIMITS = Object.freeze({ frameMean: { ratio: 1.25, floorMs: 8 }, frameP95: { ratio: 1.25, floorMs: 8 }, cpuP95: { ratio: 1.5, floorMs: 1 } });
const viewports = [[1440, 900], [375, 812], [2560, 720]];
const hash = value => createHash('sha256').update(value).digest('hex');
const median = values => [...values].sort((a, b) => a - b)[1];
const sourceFiles = ['package-lock.json', 'front-of-house/lot-assets.json', 'front-of-house/engine.mjs', 'front-of-house/data.mjs', 'front-of-house/lot-camera.mjs', 'front-of-house/lot-models.mjs', 'front-of-house/lot-renderer.mjs', 'front-of-house/lot-presentation.mjs', 'front-of-house/tools/performance-stats.mjs', 'test/front-of-house-performance.mjs'];

export function validateReport(report, rawById, fixtures) {
  assert.equal(report.mode, 'renderer diagnostic baseline', 'Quick windows cannot establish a gate');
  assert.ok(report.finishedAt); assert.equal(report.source.dirty, false); assert.deepEqual(report.errors, []);
  const p = report.protocol;
  for (const [key, value] of Object.entries({ warmupMs: 10000, measurementMs: 30000, repeats: 3, requestedDpr: 1, headless: true, requestedBackend: 'software', reducedMotion: 'no-preference', shadows: '1024 PCFSoft', antialias: true, adaptiveQuality: false })) assert.deepEqual(p[key], value, key);
  assert.deepEqual(p.viewports, viewports); assert.ok([0, 20].includes(p.faultCpuMs || 0));
  assert.equal(report.ci?.provider, 'github-actions'); assert.equal(report.ci.runnerClass, 'ubuntu-24.04');
  for (const key of ['runId', 'attempt', 'image', 'imageVersion']) assert.ok(report.ci[key] && report.ci[key] !== 'unknown', key);
  assert.equal(report.runs.length, 18); const ids = new Set();
  for (const [width, height] of viewports) for (const sceneName of ['empty', 'crowd']) for (let repeat = 1; repeat <= 3; repeat++) ids.add(`${width}x${height}-${sceneName}-${repeat}`);
  for (const r of report.runs) {
    assert.ok(ids.delete(r.id), `Missing or duplicate window ${r.id}`);
    assert.equal(r.id, `${r.viewport.width}x${r.viewport.height}-${r.sceneName}-${r.repeat}`);
    assert.equal(r.valid, true); assert.deepEqual(r.errors, []); assert.deepEqual(r.violations, []);
    assert.equal(r.environment.browserDpr, 1); assert.equal(r.environment.effectiveDpr, 1);
    assert.deepEqual(r.environment.backing, r.viewport); assert.match(r.environment.renderer, /SwiftShader/i);
    const raw = rawById[r.id]; assert.ok(raw, `Missing raw window ${r.id}`);
    assert.equal(raw.unchanged, true); assert.equal(raw.status.state, 'ready'); assert.equal(raw.finalVisibility, 'visible'); assert.deepEqual(raw.violations, []);
    assert.ok(raw.end - raw.start >= 30000); assert.equal(r.elapsedMs, raw.end - raw.start);
    assert.equal(raw.frames.length, raw.submissions.length); assert.ok(raw.frames.every(n => n > 0));
    assert.deepEqual(summarize(raw.frames), r.frame); assert.deepEqual(summarize(raw.submissions), r.cpuSubmission);
    assert.ok(Math.abs(r.frame.elapsedMs - r.elapsedMs) < 0.01, 'Frames must span the complete window');
    assert.equal(raw.quality.dpr, 1); assert.deepEqual(raw.quality.backing, r.viewport);
    assert.equal(raw.quality.motion, true);
    assert.equal(raw.quality.representativeGuests, r.sceneName === 'crowd' ? 150 : 0);
    assert.equal(raw.quality.representedAttendance, r.sceneName === 'crowd' ? 150 : 0);
    assert.deepEqual(raw.quality, r.finalQuality);
  }
  assert.equal(ids.size, 0); assert.equal(fixtures.empty.scene.crowd, 0); assert.equal(fixtures.crowd.scene.crowd, 150);
  return report;
}

export function compareReports(baseline, candidate, baselineFixtures, candidateFixtures, { fault = false } = {}) {
  assert.equal(baseline.source.commit, BASELINE, 'Pinned baseline changed; recalibration required');
  assert.equal(baseline.protocol.faultCpuMs || 0, 0);
  assert.equal(candidate.protocol.faultCpuMs || 0, fault ? 20 : 0, 'Unexpected diagnostic injection');
  assert.deepEqual(candidate.ci, baseline.ci, 'Pair must run in the same CI job/run/image');
  for (const key of ['platform', 'architecture', 'kernel', 'cpu', 'cpuCount', 'memoryBytes']) assert.deepEqual(candidate.host[key], baseline.host[key], key);
  assert.equal(candidate.browser, baseline.browser, 'Browser changed; explicit calibration required');
  assert.equal(candidate.source.sha256?.['front-of-house/tools/performance-stats.mjs'], baseline.source.sha256?.['front-of-house/tools/performance-stats.mjs'], 'Camera path/reporting source changed; recalibration required');
  assert.deepEqual(candidate.protocol.launchArgs, baseline.protocol.launchArgs);
  for (const scene of ['empty', 'crowd']) assert.deepEqual(candidateFixtures[scene].scene, baselineFixtures[scene].scene, 'Rendered fixture changed; explicit calibration required');
  for (const r of candidate.runs) {
    const b = baseline.runs.find(x => x.id === r.id); assert.ok(b);
    assert.equal(r.environment.renderer, b.environment.renderer);
    for (const key of ['backing', 'dpr', 'motion', 'representativeGuests', 'representedAttendance', 'objects']) assert.deepEqual(r.finalQuality[key], b.finalQuality[key], `Quality changed: ${key}`);
  }
  const groups = [];
  for (const [width, height] of viewports) for (const scene of ['empty', 'crowd']) {
    const select = r => r.runs.filter(x => x.viewport.width === width && x.viewport.height === height && x.sceneName === scene);
    const a = select(baseline), b = select(candidate); assert.equal(a.length, 3); assert.equal(b.length, 3);
    const getters = { frameMean: r => r.frame.meanMs, frameP95: r => r.frame.p95Ms, cpuP95: r => r.cpuSubmission.p95Ms };
    const metrics = Object.fromEntries(Object.entries(getters).map(([name, get]) => {
      const before = median(a.map(get)), after = median(b.map(get)), limit = Math.max(before * LIMITS[name].ratio, before + LIMITS[name].floorMs);
      return [name, { baselineMs: before, candidateMs: after, limitMs: limit, pass: after <= limit }];
    }));
    groups.push({ id: `${width}x${height}-${scene}`, metrics, pass: Object.values(metrics).every(x => x.pass) });
  }
  return { baseline: baseline.source.commit, candidate: candidate.source.commit, ci: candidate.ci, fault, limits: LIMITS, groups, pass: groups.every(g => g.pass) };
}

export async function loadEvidence(directory, checkout) {
  const report = JSON.parse(await readFile(resolve(directory, 'report.json'), 'utf8'));
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim(), report.source.commit);
  assert.deepEqual(Object.keys(report.source.sha256).sort(), [...sourceFiles].sort());
  for (const path of sourceFiles) assert.equal(hash(await readFile(resolve(checkout, path))), report.source.sha256[path], `Source digest: ${path}`);
  const fixtures = {}, raw = {};
  for (const scene of ['empty', 'crowd']) {
    const bytes = await readFile(resolve(directory, `${scene}-fixture.json`)); assert.equal(hash(bytes), report.fixtureSha256[scene]); fixtures[scene] = JSON.parse(bytes);
  }
  for (const r of report.runs) {
    assert.match(r.id, /^\d+x\d+-(empty|crowd)-[123]$/);
    const bytes = await readFile(resolve(directory, `${r.id}-raw.json`)); assert.equal(hash(bytes), r.rawSha256, `Raw digest: ${r.id}`); raw[r.id] = JSON.parse(bytes);
  }
  validateReport(report, raw, fixtures); return { report, fixtures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [baselineDir, candidateDir, baselineRoot, candidateRoot, output, flag] = process.argv.slice(2);
  assert.ok(baselineDir && candidateDir && baselineRoot && candidateRoot && output && (!flag || flag === '--expect-fault'), 'Expected baseline/candidate directories, checkouts, output and optional --expect-fault');
  const baseline = await loadEvidence(baselineDir, baselineRoot), candidate = await loadEvidence(candidateDir, candidateRoot);
  const result = compareReports(baseline.report, candidate.report, baseline.fixtures, candidate.fixtures, { fault: flag === '--expect-fault' });
  await writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (flag === '--expect-fault') assert.equal(result.pass, false, 'Intentional slowdown did not fail the measured budget');
  else assert.equal(result.pass, true, 'Measured renderer regression exceeds the declared limits');
}
