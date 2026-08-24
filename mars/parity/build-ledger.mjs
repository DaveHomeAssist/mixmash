#!/usr/bin/env node
// Generates mars/parity/LEDGER.md from the frozen MarsScape baseline, the live
// engine, and mapping.json. The ledger is generated, never hand-edited: run
// `node mars/parity/build-ledger.mjs` after any engine change that ports a feature.
//
// Exit codes: 0 ok, 1 a baseline feature has no disposition (or an invalid one).

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(join(HERE, p), 'utf8'));

const provenance = readJson('baseline/PROVENANCE.json');
const mapping = readJson('mapping.json');
const baseline = await import('./baseline/data.js');
const engine = await import('../engine.mjs');

const problems = [];

// --- 1. the baseline must be untouched -------------------------------------
const actual = 'sha256:' + createHash('sha256')
  .update(readFileSync(join(HERE, 'baseline/data.js')))
  .digest('hex');
if (actual !== provenance.checksums['data.js']) {
  problems.push(
    `baseline/data.js checksum drift.\n  expected ${provenance.checksums['data.js']}\n  actual   ${actual}\n` +
    '  The baseline is a preservation artifact. Do not edit it to make parity pass; ' +
    're-capture it from marsscape and bump the commit + checksum together.');
}

// --- 2. data parity ---------------------------------------------------------
const idsOf = (v) => (Array.isArray(v) ? v.map((x) => x.id) : Object.keys(v));
const VALID = new Set(['Ported', 'Intentionally Retired', 'Deferred']);

const domains = mapping.domains.map((d) => {
  const baseIds = idsOf(baseline[d.baseline]);
  const targetIds = d.target ? new Set(idsOf(engine[d.target])) : new Set();
  const rows = baseIds.map((id) => {
    const mapped = mapping.rename[d.key]?.[id] ?? id;
    if (targetIds.has(mapped)) {
      return { id, mapped, status: 'Ported', wave: null, note: '' };
    }
    const disp = mapping.dispositions[`${d.key}:${id}`];
    if (!disp) {
      problems.push(`${d.key}:${id} is absent from the engine and has no disposition.`);
      return { id, mapped: null, status: 'UNDISPOSITIONED', wave: null, note: '' };
    }
    if (!VALID.has(disp.status)) {
      problems.push(`${d.key}:${id} has invalid status "${disp.status}".`);
    }
    if (disp.status === 'Intentionally Retired' && !disp.reason) {
      problems.push(`${d.key}:${id} is Intentionally Retired without a reason. Retirement requires an approved reason.`);
    }
    return { id, mapped: null, status: disp.status, wave: disp.wave ?? null, note: disp.note ?? '' };
  });
  const ported = rows.filter((r) => r.status === 'Ported').length;
  return { ...d, rows, ported, total: rows.length };
});

// engine features with no baseline counterpart — additions the port must not lose either
const additions = mapping.domains.flatMap((d) => {
  if (!d.target) return [];
  const mappedBase = new Set(idsOf(baseline[d.baseline]).map((id) => mapping.rename[d.key]?.[id] ?? id));
  return idsOf(engine[d.target]).filter((id) => !mappedBase.has(id)).map((id) => ({ domain: d.label, id }));
});

// --- 3. behaviour parity ----------------------------------------------------
const behaviours = mapping.behaviors.map((b) => ({
  ...b,
  status: b.present === true ? 'Ported' : b.present === 'partial' ? 'Partial' : 'Deferred',
}));

// --- 4. render --------------------------------------------------------------
const dataTotal = domains.reduce((a, d) => a + d.total, 0);
const dataPorted = domains.reduce((a, d) => a + d.ported, 0);
const behPorted = behaviours.filter((b) => b.status === 'Ported').length;
const pct = (n, d) => (d === 0 ? '100.0' : ((n / d) * 100).toFixed(1));

const waveName = (w) => (w === null || w === undefined ? '—' : `${w} · ${mapping.waves[w]}`);
const esc = (s) => String(s).replace(/\|/g, '\\|');

const L = [];
L.push('# MarsScape → mixmash/mars parity ledger');
L.push('');
L.push('<!-- GENERATED FILE — do not edit by hand. Run: node mars/parity/build-ledger.mjs -->');
L.push('');
L.push('`marsscape` remains **authoritative for gameplay** until every row below reads `Ported`');
L.push('or carries an approved retirement. It must not be archived, redirected, or relabelled');
L.push('legacy before then.');
L.push('');
L.push('| | |');
L.push('|---|---|');
L.push(`| Baseline | \`${provenance.source.repository}\` @ \`${provenance.source.commit.slice(0, 12)}\` (v${provenance.source.version}) |`);
L.push(`| Target | \`${provenance.target.repository}\` @ \`${provenance.target.commit.slice(0, 12)}\` (engine v${provenance.target.engineVersion}) |`);
L.push(`| Data parity | **${dataPorted}/${dataTotal}** (${pct(dataPorted, dataTotal)}%) |`);
L.push(`| Behaviour parity | **${behPorted}/${behaviours.length}** (${pct(behPorted, behaviours.length)}%) |`);
L.push(`| Dispositioned | ${problems.length === 0 ? '**100%** — every feature accounted for' : '**INCOMPLETE**'} |`);
L.push('');

L.push('## Summary by domain');
L.push('');
L.push('| Domain | Ported | Total | Gap |');
L.push('|---|---:|---:|---:|');
for (const d of domains) L.push(`| ${d.label} | ${d.ported} | ${d.total} | ${d.total - d.ported} |`);
L.push(`| **Data total** | **${dataPorted}** | **${dataTotal}** | **${dataTotal - dataPorted}** |`);
L.push('');

L.push('## Remaining work by wave');
L.push('');
const byWave = new Map();
for (const d of domains) {
  for (const r of d.rows) {
    if (r.status === 'Ported') continue;
    const k = r.wave ?? 'unassigned';
    if (!byWave.has(k)) byWave.set(k, []);
    byWave.get(k).push(`${d.label}: ${r.id}`);
  }
}
for (const b of behaviours) {
  if (b.status === 'Ported') continue;
  const k = b.wave ?? 'unassigned';
  if (!byWave.has(k)) byWave.set(k, []);
  byWave.get(k).push(`Behaviour: ${b.label}${b.status === 'Partial' ? ' (partial)' : ''}`);
}
L.push('| Wave | Items outstanding |');
L.push('|---|---:|');
for (const k of [...byWave.keys()].sort()) L.push(`| ${waveName(k)} | ${byWave.get(k).length} |`);
L.push('');

L.push('## Behaviour contract');
L.push('');
L.push('| Behaviour | Status | Wave | Note |');
L.push('|---|---|---|---|');
for (const b of behaviours) {
  L.push(`| ${esc(b.label)} | ${b.status} | ${waveName(b.wave)} | ${esc(b.note ?? '')} |`);
}
L.push('');

L.push('## Data contract');
L.push('');
for (const d of domains) {
  L.push(`### ${d.label} — ${d.ported}/${d.total}`);
  L.push('');
  L.push('| MarsScape id | Canonical id | Status | Wave |');
  L.push('|---|---|---|---|');
  for (const r of d.rows) {
    L.push(`| \`${esc(r.id)}\` | ${r.mapped ? `\`${esc(r.mapped)}\`` : '—'} | ${r.status} | ${waveName(r.wave)} |`);
  }
  L.push('');
}

if (additions.length) {
  L.push('## Engine additions with no MarsScape counterpart');
  L.push('');
  L.push('These exist only in `mixmash/mars`. They are kept; listed so the port does not regress them.');
  L.push('');
  L.push('| Domain | Id |');
  L.push('|---|---|');
  for (const a of additions) L.push(`| ${a.domain} | \`${esc(a.id)}\` |`);
  L.push('');
}

L.push('## Save migration contract');
L.push('');
L.push(`Legacy key: \`${baseline.SAVE_KEY}\`. ${mapping.saveFields.$comment}`);
L.push('');
L.push('| Legacy field | Canonical mapping |');
L.push('|---|---|');
for (const [k, v] of Object.entries(mapping.saveFields.map)) L.push(`| \`${esc(k)}\` | ${esc(v)} |`);
L.push('');
for (const r of mapping.saveFields.rules) L.push(`- ${r}`);
L.push('');

L.push('## Acceptance gates');
L.push('');
const gates = [
  ['All data features dispositioned', problems.length === 0, 'this generator'],
  [`Data parity 100% (${dataPorted}/${dataTotal})`, dataPorted === dataTotal, 'this generator'],
  [`Behaviour parity 100% (${behPorted}/${behaviours.length})`, behPorted === behaviours.length, 'this generator'],
  [`mixmash baseline suite stays green (${mapping.testContract.mixmashBaseline.total} pre-port tests)`, null, '`npm test` in CI'],
  ['MarsScape behavioural contract represented', null, `\`npm test\` — ${mapping.testContract.mixmashCurrent.total} cases covering ${mapping.testContract.areasCovered.length} areas; see note below`],
  ['Balance simulator passes every verdict', null, '`npm run sim` in CI (exits non-zero on any FAIL)'],
  ['Real legacy save fixtures migrate with no loss', null, '`mars/test-legacy-import.mjs`'],
  ['`marsscape` intact until this ledger reaches 100%', null, 'repository policy — see mars/parity/README.md'],
];
L.push('| Gate | Status | Enforced by |');
L.push('|---|---|---|');
for (const [g, ok, by] of gates) {
  L.push(`| ${g} | ${ok === true ? 'PASS' : ok === false ? 'NOT MET' : 'CI'} | ${by} |`);
}
L.push('');
L.push(`> The MarsScape suite had ${mapping.testContract.marsscape.total} cases against a jsdom client; this engine is headless and`);
L.push('> server-authoritative, so coverage is matched by behavioural area rather than');
L.push(`> test-for-test. Areas covered: ${mapping.testContract.areasCovered.join(', ')}.`);
L.push('');

writeFileSync(join(HERE, 'LEDGER.md'), L.join('\n'));

if (problems.length) {
  console.error('Parity ledger problems:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`LEDGER.md written — data ${dataPorted}/${dataTotal}, behaviour ${behPorted}/${behaviours.length}, all features dispositioned.`);
