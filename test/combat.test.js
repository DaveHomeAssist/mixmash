import { describe, it, expect } from 'vitest';
import { finite, calcKnockback, knockbackVelocity } from '../src/combat.js';

// A representative real attack def from FIGHTER_DEFS (deadmau5 forward smash).
const REAL_ATK = { damage: 16, kbBase: 85, kbScale: 130, angle: 32 };

describe('finite', () => {
  it('passes finite numbers through', () => {
    expect(finite(3.5)).toBe(3.5);
    expect(finite(0)).toBe(0);
    expect(finite(-42)).toBe(-42);
  });
  it('replaces NaN / Infinity / undefined / null with the fallback', () => {
    expect(finite(NaN)).toBe(0);
    expect(finite(Infinity)).toBe(0);
    expect(finite(-Infinity)).toBe(0);
    expect(finite(undefined)).toBe(0);
    expect(finite(null)).toBe(0);
    expect(finite('nope')).toBe(0);
    expect(finite(NaN, 1)).toBe(1);
  });
});

describe('calcKnockback — behavior preserved for valid inputs', () => {
  it('matches the original formula for a real attack', () => {
    const weight = 1.3;
    const targetDamage = 40;
    const expected =
      (REAL_ATK.damage * 0.1 + 2) * REAL_ATK.kbScale * (1 + targetDamage / 100) / weight + REAL_ATK.kbBase;
    expect(calcKnockback(REAL_ATK, targetDamage, weight)).toBeCloseTo(expected, 10);
  });
  it('scales up with target damage (rage/percent)', () => {
    const low = calcKnockback(REAL_ATK, 0, 1);
    const high = calcKnockback(REAL_ATK, 150, 1);
    expect(high).toBeGreaterThan(low);
  });
  it('is inversely proportional to weight (heavier = less launch)', () => {
    const light = calcKnockback(REAL_ATK, 50, 0.8);
    const heavy = calcKnockback(REAL_ATK, 50, 1.4);
    expect(light).toBeGreaterThan(heavy);
  });
});

describe('calcKnockback — NaN invariant (Phase 1 DoD)', () => {
  const degenerate = [
    ['zero weight', REAL_ATK, 40, 0],
    ['negative weight', REAL_ATK, 40, -1.3],
    ['undefined weight', REAL_ATK, 40, undefined],
    ['NaN target damage', REAL_ATK, NaN, 1.3],
    ['missing kbScale', { damage: 16, kbBase: 85 }, 40, 1.3],
    ['missing kbBase', { damage: 16, kbScale: 130 }, 40, 1.3],
    ['empty attack object', {}, 40, 1.3],
    ['null attack', null, 40, 1.3],
    ['undefined attack', undefined, 40, 1.3],
    ['everything garbage', { damage: 'x', kbScale: null, kbBase: NaN }, Infinity, 0],
  ];
  for (const [name, atk, dmg, weight] of degenerate) {
    it(`returns a finite number for: ${name}`, () => {
      const kb = calcKnockback(atk, dmg, weight);
      expect(Number.isFinite(kb)).toBe(true);
    });
  }
});

describe('knockbackVelocity — NaN invariant', () => {
  it('produces finite vx/vy for a real hit', () => {
    const kb = calcKnockback(REAL_ATK, 60, 1.0);
    const v = knockbackVelocity(kb, REAL_ATK.angle, 1);
    expect(Number.isFinite(v.vx)).toBe(true);
    expect(Number.isFinite(v.vy)).toBe(true);
    expect(v.vy).toBeLessThanOrEqual(0); // launches upward
  });
  it('never emits NaN even with a NaN angle or magnitude', () => {
    const bad = [
      knockbackVelocity(NaN, 32, 1),
      knockbackVelocity(200, NaN, 1),
      knockbackVelocity(200, 45, NaN),
      knockbackVelocity(undefined, undefined, undefined),
    ];
    for (const v of bad) {
      expect(Number.isFinite(v.vx)).toBe(true);
      expect(Number.isFinite(v.vy)).toBe(true);
    }
  });
});
