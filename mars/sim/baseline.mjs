export function compareRateBaseline(baseline, currentRates, tolerance = 0.10) {
  const problems = [];
  if (!baseline?.rates || typeof baseline.rates !== 'object') {
    return { ok: false, problems: [{ kind: 'missing-baseline', message: 'The committed rate baseline is missing or unreadable.' }] };
  }

  for (const [skillKey, bands] of Object.entries(baseline.rates)) {
    if (!bands || typeof bands !== 'object') continue;
    for (const [level, prior] of Object.entries(bands)) {
      const current = currentRates?.[skillKey]?.[level];
      if (!Number.isFinite(prior) || prior <= 0) {
        problems.push({ kind: 'invalid-baseline', skillKey, level, message: `${skillKey} level ${level} has an invalid committed rate.` });
        continue;
      }
      if (!Number.isFinite(current)) {
        problems.push({ kind: 'missing-rate', skillKey, level, prior, message: `${skillKey} level ${level} is missing from the current simulation.` });
        continue;
      }
      if (current < prior * (1 - tolerance)) {
        const pct = (current - prior) / prior * 100;
        problems.push({ kind: 'regression', skillKey, level, prior, current, pct });
      }
    }
  }

  return { ok: problems.length === 0, problems };
}
