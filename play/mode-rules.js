(function attachMixmashModeRules(global) {
  function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  function sanitizeCpuLevel(value) {
    const level = finite(value, 3);
    return level === 1 || level === 5 ? level : 3;
  }

  const MATCH_TYPES = Object.freeze(['stock', 'time', 'training', 'rush']);

  const MODE_SELECT_ITEMS = Object.freeze([
    { name: 'Stock Match', desc: '3 stocks, last one standing wins', key: 'stock' },
    { name: 'Time Match', desc: '3 minutes, most KOs wins', key: 'time' },
    { name: 'Training', desc: 'Practice mode with hitbox display', key: 'training' },
    { name: 'Platform Rush', desc: 'Solo route: collect records and hidden Deep Cuts', key: 'rush' },
  ].map(Object.freeze));

  const PROFILE_CHALLENGES = Object.freeze([
    { id: 'first_match', name: 'First Match', desc: 'Finish any stock or time match.' },
    { id: 'first_win', name: 'First Win', desc: 'Win a stock or time match as P1.' },
    { id: 'rush_complete', name: 'Deep Cut Route', desc: 'Complete every Platform Rush pickup.' },
    { id: 'encore_explorer', name: 'Encore Explorer', desc: 'Play Rune Foundry or Crystal Canopy.' },
  ].map(Object.freeze));

  const PLATFORM_RUSH = Object.freeze({
    timeLimit: 120,
    records: 8,
    deepCuts: 2,
    collectRadius: 34,
    ghostSampleEvery: 12,
    ghostLimit: 720,
  });

  function compactPlatformRushCollectible(raw) {
    return {
      id: typeof (raw && raw.id) === 'string' ? raw.id : 'rush-item',
      type: raw && raw.type === 'deepCut' ? 'deepCut' : 'record',
      x: finite(raw && raw.x, 0),
      y: finite(raw && raw.y, 0),
      platformIndex: finite(raw && raw.platformIndex, 0),
      hidden: !!(raw && raw.hidden),
      collected: !!(raw && raw.collected),
      value: finite(raw && raw.value, raw && raw.type === 'deepCut' ? 300 : 100),
    };
  }

  function createPlatformRushState(raw) {
    return {
      active: !!(raw && raw.active),
      seed: finite(raw && raw.seed, 0),
      timeRemaining: finite(raw && raw.timeRemaining, PLATFORM_RUSH.timeLimit),
      score: finite(raw && raw.score, 0),
      recordsCollected: finite(raw && raw.recordsCollected, 0),
      totalRecords: finite(raw && raw.totalRecords, PLATFORM_RUSH.records),
      deepCutsCollected: finite(raw && raw.deepCutsCollected, 0),
      totalDeepCuts: finite(raw && raw.totalDeepCuts, PLATFORM_RUSH.deepCuts),
      finished: !!(raw && raw.finished),
      resultReason: typeof (raw && raw.resultReason) === 'string' ? raw.resultReason : null,
      collectibles: Array.isArray(raw && raw.collectibles) ? raw.collectibles.map(compactPlatformRushCollectible) : [],
    };
  }

  function createDefaultQuickFightSetup(fighterKeys) {
    const keys = Array.isArray(fighterKeys) ? fighterKeys : [];
    return {
      p1Fighter: keys[0] || 'deadmau5',
      p2Fighter: keys[1] || keys[0] || 'skrillex',
      selectedStage: 'battlefield',
      matchType: 'stock',
      p1Cpu: false,
      p2Cpu: true,
      p1CpuLevel: 3,
      p2CpuLevel: 3,
    };
  }

  function sanitizeQuickFightSetup(raw, context) {
    const ctx = context || {};
    const fighterKeys = Array.isArray(ctx.fighterKeys) ? ctx.fighterKeys : [];
    const stageKeys = Array.isArray(ctx.stageKeys) ? ctx.stageKeys : [];
    const matchTypes = Array.isArray(ctx.matchTypes) ? ctx.matchTypes : MATCH_TYPES;
    const fallback = ctx.fallback || createDefaultQuickFightSetup(fighterKeys);
    const p1Fighter = fighterKeys.includes(raw && raw.p1Fighter) ? raw.p1Fighter : fallback.p1Fighter;
    const p2Fighter = fighterKeys.includes(raw && raw.p2Fighter) ? raw.p2Fighter : fallback.p2Fighter;
    const selectedStage = stageKeys.includes(raw && raw.selectedStage) ? raw.selectedStage : fallback.selectedStage;
    const matchType = raw && matchTypes.includes(raw.matchType) && raw.matchType !== 'rush' ? raw.matchType : fallback.matchType;
    return {
      p1Fighter,
      p2Fighter,
      selectedStage,
      matchType,
      p1Cpu: !!(raw && raw.p1Cpu),
      p2Cpu: raw && raw.p2Cpu !== undefined ? !!raw.p2Cpu : fallback.p2Cpu,
      p1CpuLevel: sanitizeCpuLevel(raw && raw.p1CpuLevel),
      p2CpuLevel: sanitizeCpuLevel(raw && raw.p2CpuLevel),
    };
  }

  global.MixmashModeRules = Object.freeze({
    MATCH_TYPES,
    MODE_SELECT_ITEMS,
    PROFILE_CHALLENGES,
    PLATFORM_RUSH,
    compactPlatformRushCollectible,
    createPlatformRushState,
    createDefaultQuickFightSetup,
    sanitizeQuickFightSetup,
  });
})(globalThis);
