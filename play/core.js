(function attachMixmashCore(global) {
  function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  function hashStringSeed(text) {
    let hash = 2166136261;
    for (let i = 0; i < String(text).length; i++) {
      hash ^= String(text).charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
  }

  function getPlatformRushSeed(stageKey, seedId = null) {
    const stage = stageKey || 'battlefield';
    if (!seedId) return hashStringSeed(`platform-rush:${stage}`);
    return hashStringSeed(`platform-rush:${stage}:${String(seedId).slice(0, 64)}`);
  }

  function sanitizeCpuLevel(value) {
    const level = finite(value, 3);
    return level === 1 || level === 5 ? level : 3;
  }

  function sanitizeShareSeed(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().slice(0, 64);
    return /^[a-zA-Z0-9_-]+$/.test(trimmed) ? trimmed : null;
  }

  function parseShareBoolean(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const normalized = String(value).toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  function isValidSnapshotPlayer(raw) {
    return !!raw &&
      typeof raw.fighterKey === 'string' &&
      Number.isFinite(raw.x) &&
      Number.isFinite(raw.y) &&
      Number.isFinite(raw.vx) &&
      Number.isFinite(raw.vy) &&
      (raw.controlType === 'human' || raw.controlType === 'cpu');
  }

  function isValidActiveMatchSnapshot(snapshot, context) {
    const ctx = context || {};
    const snapshotModes = Array.isArray(ctx.snapshotModes) ? ctx.snapshotModes : [];
    const matchTypes = Array.isArray(ctx.matchTypes) ? ctx.matchTypes : [];
    const stageKeys = Array.isArray(ctx.stageKeys) ? ctx.stageKeys : [];
    const playerValidator = typeof ctx.isValidPlayer === 'function' ? ctx.isValidPlayer : isValidSnapshotPlayer;
    return !!snapshot &&
      snapshot.version === ctx.version &&
      snapshotModes.includes(snapshot.mode) &&
      matchTypes.includes(snapshot.matchType) &&
      stageKeys.includes(snapshot.selectedStage) &&
      Array.isArray(snapshot.players) &&
      snapshot.players.length === 2 &&
      snapshot.players.every(playerValidator) &&
      (!snapshot.damageNumbers || Array.isArray(snapshot.damageNumbers));
  }

  global.MixmashCore = Object.freeze({
    finite,
    hashStringSeed,
    getPlatformRushSeed,
    sanitizeCpuLevel,
    sanitizeShareSeed,
    parseShareBoolean,
    isValidSnapshotPlayer,
    isValidActiveMatchSnapshot,
  });
})(globalThis);
