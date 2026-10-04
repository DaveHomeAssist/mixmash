// Descriptive measurements only: these bins are not device acceptance gates.
export async function withDeadline(operation, milliseconds) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Measurement deadline exceeded; incomplete timing window')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export function summarize(samples) {
  if (!samples.length || samples.some(n => !Number.isFinite(n) || n < 0)) throw new Error('Expected nonempty finite, nonnegative timing samples');
  const sorted = [...samples].sort((a, b) => a - b), sum = samples.reduce((a, b) => a + b, 0);
  const percentile = p => sorted[Math.ceil(p * sorted.length) - 1];
  return {
    count: samples.length, elapsedMs: sum, meanMs: sum / samples.length,
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), maxMs: sorted.at(-1),
    above16_7: samples.filter(n => n > 16.7).length, above33_3: samples.filter(n => n > 33.3).length,
    above50: samples.filter(n => n > 50).length,
    fullStallMs: samples.filter(n => n > 50).reduce((a, b) => a + b, 0),
    excessStallMs: samples.filter(n => n > 50).reduce((a, b) => a + b - 50, 0),
  };
}

export function cameraAt(seconds) {
  const t = Math.max(0, Math.min(30, seconds));
  if (t < 10) return { yaw: t * 36, pitch: 45, zoom: 1, x: 12, y: 8 };
  if (t < 20) return { yaw: 37, pitch: 45, zoom: 1 + 2 * (1 - Math.abs(t - 15) / 5), x: 12, y: 8 };
  return { yaw: 135, pitch: 15 + 70 * (1 - Math.abs(t - 25) / 5), zoom: 1, x: 12, y: 8 };
}
