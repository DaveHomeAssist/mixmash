import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRateBaseline } from './sim/baseline.mjs';

const committed = { rates: { mining: { 1: 1000, 10: 2000 } } };

test('rate baseline rejects losses greater than ten percent', () => {
  const result = compareRateBaseline(committed, { mining: { 1: 899, 10: 2000 } });
  assert.equal(result.ok, false);
  assert.equal(result.problems[0].kind, 'regression');
  assert.equal(result.problems[0].pct.toFixed(1), '-10.1');
});

test('rate baseline permits an exact ten-percent change', () => {
  const result = compareRateBaseline(committed, { mining: { 1: 900, 10: 2000 } });
  assert.equal(result.ok, true);
});

test('rate baseline rejects removed progression rows', () => {
  const result = compareRateBaseline(committed, { mining: { 1: 1000 } });
  assert.equal(result.ok, false);
  assert.equal(result.problems[0].kind, 'missing-rate');
});

test('rate baseline cannot silently recreate a deleted committed baseline', () => {
  const result = compareRateBaseline(null, { mining: { 1: 1000 } });
  assert.equal(result.ok, false);
  assert.equal(result.problems[0].kind, 'missing-baseline');
});
