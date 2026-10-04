// Budget and evidence rejection tests: synthetic timing is evaluator coverage, never measured acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE, compareReports, validateReport } from '../front-of-house/tools/performance-gate.mjs';
import { summarize } from '../front-of-house/tools/performance-stats.mjs';

function evidence() {
  const fixtures = { empty: { scene: { crowd: 0 } }, crowd: { scene: { crowd: 150 } } }, raw = {};
  const report = {
    mode: 'renderer diagnostic baseline', finishedAt: '2026-10-04', source: { commit: BASELINE, dirty: false }, errors: [],
    protocol: { warmupMs: 10000, measurementMs: 30000, repeats: 3, requestedDpr: 1, headless: true, requestedBackend: 'software', reducedMotion: 'no-preference', shadows: '1024 PCFSoft', antialias: true, adaptiveQuality: false, viewports: [[1440, 900], [375, 812], [2560, 720]], launchArgs: ['--use-angle=swiftshader'] },
    ci: { provider: 'github-actions', runnerClass: 'ubuntu-24.04', runId: '123', attempt: '1', image: 'ubuntu24', imageVersion: 'test' },
    host: { platform: 'linux', architecture: 'x64', kernel: 'test', cpu: 'test', cpuCount: 4, memoryBytes: 16000000000 }, browser: '149', runs: [],
  };
  for (const [width, height] of report.protocol.viewports) for (const sceneName of ['empty', 'crowd']) for (let repeat = 1; repeat <= 3; repeat++) {
    const viewport = { width, height }, id = `${width}x${height}-${sceneName}-${repeat}`;
    const quality = { dpr: 1, backing: viewport, motion: true, representativeGuests: sceneName === 'crowd' ? 150 : 0, representedAttendance: sceneName === 'crowd' ? 150 : 0, objects: [] };
    raw[id] = { start: 10000, end: 40000, frames: Array(300).fill(100), submissions: Array(300).fill(4), unchanged: true, status: { state: 'ready' }, finalVisibility: 'visible', violations: [], quality };
    report.runs.push({ id, viewport, sceneName, repeat, valid: true, elapsedMs: 30000, errors: [], violations: [], environment: { browserDpr: 1, effectiveDpr: 1, backing: viewport, renderer: 'ANGLE SwiftShader' }, frame: summarize(raw[id].frames), cpuSubmission: summarize(raw[id].submissions), finalQuality: quality });
  }
  return { report, raw, fixtures };
}

test('all eighteen complete windows are mandatory, with matching raw statistics and retained quality', () => {
  const e = evidence(); assert.equal(validateReport(e.report, e.raw, e.fixtures), e.report);
  for (const mutate of [
    x => x.report.runs.pop(), x => { x.report.runs[0] = x.report.runs[1]; },
    x => { x.report.mode = 'harness validation only'; }, x => { x.report.source.dirty = true; },
    x => { x.report.runs[0].frame.p95Ms = 1; }, x => { x.raw[x.report.runs[0].id].violations.push({ type: 'resize' }); },
    x => { x.raw[x.report.runs[0].id].quality.dpr = 0.5; }, x => { x.raw[x.report.runs[0].id].end = 39999; },
    x => { x.report.protocol.shadows = 'off'; }, x => { x.report.runs[0].environment.renderer = 'Metal'; },
    x => { x.report.ci.imageVersion = 'unknown'; },
  ]) { const changed = structuredClone(e); mutate(changed); assert.throws(() => validateReport(changed.report, changed.raw, changed.fixtures)); }
});

test('median tolerates one noisy repeat but rejects sustained frame or CPU regressions at strict limits', () => {
  const a = evidence(), b = structuredClone(a);
  const compare = () => compareReports(a.report, b.report, a.fixtures, b.fixtures);
  assert.equal(compare().pass, true);
  b.report.runs[0].frame.meanMs = 1000; assert.equal(compare().pass, true);
  b.report.runs[1].frame.meanMs = 125; assert.equal(compare().pass, true);
  b.report.runs[1].frame.meanMs = 125.001; assert.equal(compare().pass, false);
  b.report.runs[0].frame.meanMs = b.report.runs[1].frame.meanMs = 100;
  b.report.runs[0].cpuSubmission.p95Ms = b.report.runs[1].cpuSubmission.p95Ms = 6;
  assert.equal(compare().pass, true);
  b.report.runs[0].cpuSubmission.p95Ms = b.report.runs[1].cpuSubmission.p95Ms = 6.001;
  assert.equal(compare().pass, false);
});

test('absolute tolerance protects tiny CPU values and fault mode still evaluates actual timing', () => {
  const a = evidence(), b = structuredClone(a);
  for (const r of a.report.runs) r.cpuSubmission.p95Ms = 0.5;
  for (const r of b.report.runs) r.cpuSubmission.p95Ms = 1.5;
  assert.equal(compareReports(a.report, b.report, a.fixtures, b.fixtures).pass, true);
  b.report.protocol.faultCpuMs = 20;
  assert.throws(() => compareReports(a.report, b.report, a.fixtures, b.fixtures));
  assert.equal(compareReports(a.report, b.report, a.fixtures, b.fixtures, { fault: true }).pass, true, 'Fault flag alone cannot prove rejection');
  for (const r of b.report.runs) r.cpuSubmission.p95Ms = 20.5;
  const result = compareReports(a.report, b.report, a.fixtures, b.fixtures, { fault: true });
  assert.equal(result.pass, false); assert.equal(result.groups.length, 6);
});

test('different hosts, browsers, scenes or render quality require recalibration rather than a misleading pass', () => {
  const a = evidence();
  for (const mutate of [
    x => { x.report.browser = '150'; }, x => { x.report.ci.runId = 'different'; }, x => { x.report.host.cpuCount = 8; },
    x => { x.fixtures.crowd.scene.crowd = 149; }, x => { x.report.runs[0].finalQuality.objects = [{ type: 'different' }]; },
    x => { x.report.protocol.launchArgs = []; },
  ]) { const b = structuredClone(a); mutate(b); assert.throws(() => compareReports(a.report, b.report, a.fixtures, b.fixtures)); }
});
