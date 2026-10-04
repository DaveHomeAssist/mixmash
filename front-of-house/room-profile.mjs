// Versioned room acoustics and authored terrain; logical game units, not venue engineering.
import { ROOM_PROFILES } from './data.mjs';
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function roomProfileTerms(raw, venueId) {
  if (!object(raw) || raw.version !== 1 || !Object.hasOwn(ROOM_PROFILES, venueId)) throw new TypeError('Invalid room profile');
  return { version: 1 };
}
export function roomProfileFor(venue) {
  return venue?.profile?.version === 1 && Object.hasOwn(ROOM_PROFILES, venue.id) ? ROOM_PROFILES[venue.id] : null;
}
export function groundHeight(profile, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Invalid ground point');
  return profile ? Math.max(0, Math.min(y, profile.lawnEnd) - profile.lawnStart) * profile.risePerTile : 0;
}

// Intersect the horizontal ray with a footprint, then compare height at every
// piecewise-linear endpoint. This avoids tile stepping missing a narrow obstacle.
export function blocksView(profile, from, to, obstacle) {
  if (!profile || ![from?.x, from?.y, from?.z, to?.x, to?.y, to?.z, obstacle?.x, obstacle?.y, obstacle?.w, obstacle?.h, obstacle?.height].every(Number.isFinite)
    || obstacle.w <= 0 || obstacle.h <= 0 || obstacle.height < 0) throw new TypeError('Invalid sight ray');
  let near = 0, far = 1;
  for (const [axis, size] of [['x', 'w'], ['y', 'h']]) {
    const delta = to[axis] - from[axis], start = obstacle[axis], end = start + obstacle[size];
    if (Math.abs(delta) < 1e-12) {
      if (from[axis] < start || from[axis] > end) return false;
    } else {
      const a = (start - from[axis]) / delta, b = (end - from[axis]) / delta;
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      if (near > far) return false;
    }
  }
  if (far <= 1e-9 || near >= 1 - 1e-9) return false;
  const points = [Math.max(near, 1e-9), Math.min(far, 1 - 1e-9)];
  const dy = to.y - from.y;
  for (const row of [profile.lawnStart, profile.lawnEnd]) {
    const knee = dy ? (row - from.y) / dy : -1;
    if (knee > near && knee < far) points.push(knee);
  }
  return points.some(t => {
    const x = from.x + (to.x - from.x) * t, y = from.y + dy * t;
    return groundHeight(profile, x, y) + obstacle.height >= from.z + (to.z - from.z) * t - 1e-9;
  });
}

export function roomSightlines(profile, { grid, occupied, stage, obstacles }) {
  if (!profile || !Number.isInteger(grid?.w) || !Number.isInteger(grid?.h) || grid.w < 1 || grid.h < 1 || grid.w * grid.h > 10000
    || !(occupied instanceof Set) || !Array.isArray(obstacles)) throw new TypeError('Invalid sightline layout');
  const clear = new Set(), blocked = new Set();
  if (!stage) return { clear, blocked };
  if (![...stage.front, ...stage.facing].every(Number.isFinite) || Math.abs(Math.hypot(...stage.facing) - 1) > 1e-9) throw new TypeError('Invalid stage direction');
  const [sx, sy] = stage.front, from = { x: sx, y: sy, z: groundHeight(profile, sx, sy) + profile.performerHeight };
  const cosine = Math.cos(profile.sightDegrees * Math.PI / 360);
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
    const key = `${x},${y}`; if (occupied.has(key)) continue;
    const dx = x + 0.5 - sx, dy = y + 0.5 - sy, distance = Math.hypot(dx, dy);
    if (!distance || distance > profile.sightRange || dx * stage.facing[0] + dy * stage.facing[1] < distance * cosine - 1e-9) continue;
    const to = { x: x + 0.5, y: y + 0.5, z: groundHeight(profile, x + 0.5, y + 0.5) + profile.eyeHeight };
    (obstacles.some(o => blocksView(profile, from, to, o)) ? blocked : clear).add(key);
  }
  return { clear, blocked };
}

// Delay coverage is a union of open floor cells beyond the included system's
// nearest-floor allocation. It is a game supply model, not acoustic prediction.
export function delayCoverage({ grid, occupied, front, towers, baseCapacity, density, capacity, range }) {
  if (!Number.isInteger(grid?.w) || !Number.isInteger(grid?.h) || grid.w < 1 || grid.h < 1 || grid.w * grid.h > 10000
    || !(occupied instanceof Set) || !Array.isArray(front) || front.length !== 2 || !front.every(Number.isFinite)
    || !Array.isArray(towers) || towers.length > 2 || !towers.every(t => Number.isInteger(t.x) && Number.isInteger(t.y) && t.x >= 0 && t.y >= 0 && t.x < grid.w && t.y < grid.h)
    || ![baseCapacity, capacity].every(n => Number.isSafeInteger(n) && n >= 0)
    || !Number.isFinite(density) || density <= 0 || !Number.isFinite(range) || range <= 0) throw new TypeError('Invalid delay coverage');
  const cells = [];
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
    const key = `${x},${y}`;
    if (!occupied.has(key)) cells.push({ x, y, key, distance: (x + 0.5 - front[0]) ** 2 + (y + 0.5 - front[1]) ** 2 });
  }
  cells.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  const base = new Set(cells.slice(0, Math.ceil(baseCapacity / density)).map(c => c.key));
  const added = new Set(cells.filter(c => !base.has(c.key) && towers.some(t => (c.x - t.x) ** 2 + (c.y - t.y) ** 2 <= range ** 2)).map(c => c.key));
  const extraCapacity = Math.min(Math.max(0, capacity - baseCapacity), Math.floor(added.size * density));
  return { base, added, extraCapacity, soundCapacity: baseCapacity + extraCapacity };
}
