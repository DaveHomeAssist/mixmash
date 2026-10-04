// Validate reporting math independently of machine speed; no synthetic FPS acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, cameraAt } from '../front-of-house/tools/performance-stats.mjs';

test('nearest-rank percentiles retain stalls and use strict reporting-bin boundaries', () => {
  const values = [100, 50, 16.7, 33.3, 10], s = summarize(values);
  assert.deepEqual(values, [100, 50, 16.7, 33.3, 10]);
  assert.deepEqual(s, { count: 5, elapsedMs: 210, meanMs: 42, p50Ms: 33.3, p95Ms: 100, p99Ms: 100, maxMs: 100, above16_7: 3, above33_3: 2, above50: 1, fullStallMs: 100, excessStallMs: 50 });
  assert.equal(summarize(Array.from({ length: 100 }, (_, i) => i + 1)).p95Ms, 95);
  for (const input of [[], [NaN], [-1], [Infinity]]) assert.throws(() => summarize(input));
});

test('camera path covers a full orbit, zoom range and pitch range at fixed target', () => {
  assert.deepEqual(cameraAt(0), { yaw: 0, pitch: 45, zoom: 1, x: 12, y: 8 });
  assert.equal(cameraAt(9.999).yaw > 359, true);
  assert.equal(cameraAt(10).zoom, 1); assert.equal(cameraAt(15).zoom, 3); assert.equal(cameraAt(19.999).zoom < 1.001, true);
  assert.equal(cameraAt(20).pitch, 15); assert.equal(cameraAt(25).pitch, 85); assert.equal(cameraAt(30).pitch, 15);
});
