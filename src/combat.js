// MIXMASH combat math — pure, testable core.
//
// This module is the CANONICAL reference for knockback math and the finite-number
// invariant. The live game (play/index.html) currently keeps an inline copy of
// calcKnockback with the identical hardened body; keep the two in sync until the
// game is refactored to import this module directly (tracked in ROADMAP.md Phase 1).

/**
 * Coerce a value to a finite number, falling back when it is NaN/Infinity/undefined.
 * This is the single guard that upholds the Phase 1 DoD: "no NaN mutations in the
 * runtime entity pool."
 */
export function finite(x, fallback = 0) {
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Smash-style knockback. Formula is unchanged for valid inputs; every input is
 * coerced finite and weight is guarded against <= 0 so the result is ALWAYS a
 * finite number — a malformed or partially-cloned attack def can never emit NaN
 * into a target's velocity, hitstun timer, or the camera.
 */
export function calcKnockback(atkData = {}, targetDamage = 0, targetWeight = 1) {
  const damage = finite(atkData && atkData.damage, 0);
  const kbScale = finite(atkData && atkData.kbScale, 0);
  const kbBase = finite(atkData && atkData.kbBase, 0);
  const pct = finite(targetDamage, 0);
  let weight = finite(targetWeight, 1);
  if (weight <= 0) weight = 1; // never divide by zero or a negative weight

  const kb = (damage * 0.1 + 2) * kbScale * (1 + pct / 100) / weight + kbBase;
  return finite(kb, 0);
}

/**
 * Resolve a knockback magnitude + launch angle (degrees) into a finite velocity
 * vector. Guards the trig product so a NaN angle can't poison the entity pool.
 */
export function knockbackVelocity(kb, angleDeg, dirX) {
  const angle = finite(angleDeg, 0) * Math.PI / 180;
  const mag = finite(kb, 0);
  const dir = finite(dirX, 1);
  return {
    vx: finite(Math.cos(angle) * mag * dir, 0),
    vy: finite(-Math.abs(Math.sin(angle) * mag), 0),
  };
}
