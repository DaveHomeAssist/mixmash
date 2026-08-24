// Guards the MarsScape -> mixmash/mars port. These tests do not check that the port
// is finished; they check that the ledger tells the truth about how finished it is,
// so gameplay work cannot be quietly lost the way it was the first time.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(join(HERE, p), 'utf8'));

const provenance = readJson('baseline/PROVENANCE.json');
const mapping = readJson('mapping.json');
const baseline = await import('./baseline/data.js');
const engine = await import('../engine.mjs');

const idsOf = (v) => (Array.isArray(v) ? v.map((x) => x.id) : Object.keys(v));

test('the frozen MarsScape baseline is unmodified', () => {
  const actual = 'sha256:' + createHash('sha256')
    .update(readFileSync(join(HERE, 'baseline/data.js')))
    .digest('hex');
  assert.equal(actual, provenance.checksums['data.js'],
    'baseline/data.js changed. It is a preservation artifact — re-capture it from marsscape ' +
    'and bump source.commit + checksum together, never edit it to make parity pass.');
});

test('every MarsScape feature is Ported or carries a disposition', () => {
  const undispositioned = [];
  for (const d of mapping.domains) {
    const target = d.target ? new Set(idsOf(engine[d.target])) : new Set();
    for (const id of idsOf(baseline[d.baseline])) {
      const mapped = mapping.rename[d.key]?.[id] ?? id;
      if (target.has(mapped)) continue;
      if (!mapping.dispositions[`${d.key}:${id}`]) undispositioned.push(`${d.key}:${id}`);
    }
  }
  assert.deepEqual(undispositioned, [],
    'These MarsScape features are absent from the engine with no recorded decision.');
});

test('retirement always carries an approved reason', () => {
  for (const [key, disp] of Object.entries(mapping.dispositions)) {
    assert.ok(['Ported', 'Intentionally Retired', 'Deferred'].includes(disp.status),
      `${key} has invalid status "${disp.status}"`);
    if (disp.status === 'Intentionally Retired') {
      assert.ok(disp.reason && disp.reason.length > 0,
        `${key} is Intentionally Retired with no reason. Retirement requires an approved reason.`);
    }
  }
});

test('no engine feature is orphaned from the baseline mapping', () => {
  // If a rename is wrong, the baseline id looks deferred and the engine id looks
  // orphaned. This catches that from the other side.
  const orphans = [];
  for (const d of mapping.domains) {
    if (!d.target) continue;
    const mappedBase = new Set(idsOf(baseline[d.baseline]).map((id) => mapping.rename[d.key]?.[id] ?? id));
    for (const id of idsOf(engine[d.target])) {
      if (!mappedBase.has(id)) orphans.push(`${d.key}:${id}`);
    }
  }
  assert.deepEqual(orphans, [],
    'These engine ids do not correspond to any MarsScape feature. Either add the rename ' +
    'to mapping.json, or record them as intentional additions.');
});

test('LEDGER.md is current', () => {
  const before = readFileSync(join(HERE, 'LEDGER.md'), 'utf8');
  execFileSync(process.execPath, [join(HERE, 'build-ledger.mjs')], { stdio: 'pipe' });
  const after = readFileSync(join(HERE, 'LEDGER.md'), 'utf8');
  assert.equal(after, before,
    'LEDGER.md is stale. Run `node mars/parity/build-ledger.mjs` and commit the result.');
});

test('the behaviour contract stays honest about the XP curve', () => {
  // The single most consequential divergence: mixmash reaches 99 at 240,100 xp,
  // MarsScape at 13,034,431. While that holds, xp_curve_runescape cannot read Ported.
  const beh = mapping.behaviors.find((b) => b.id === 'xp_curve_runescape');
  const matches = engine.levelForXp(baseline.xpForLevel(99) - 1) === 98
    && engine.levelForXp(baseline.xpForLevel(50)) === 50;
  assert.equal(beh.present === true, matches,
    matches
      ? 'The engine now matches the RuneScape curve — set behaviors.xp_curve_runescape.present = true.'
      : 'behaviors.xp_curve_runescape claims Ported, but the engine curve still diverges.');
});

test('the marsscape test contract is recorded for cutover', () => {
  assert.equal(mapping.testContract.marsscape.total, 97);
  const summed = Object.values(mapping.testContract.marsscape.files).reduce((a, b) => a + b, 0);
  assert.equal(summed, 97, 'per-file test counts must sum to the recorded total');
});
