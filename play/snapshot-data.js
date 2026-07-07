(function attachMixmashSnapshotData(global) {
  const STORAGE_KEYS = Object.freeze({
    activeMatchSnapshot: 'mixmash_active_match_snapshot',
    quickFightSetup: 'mixmash_quick_fight_setup',
    config: 'mixmash_config_v1',
    profile: 'mixmash_profile',
  });

  const ACTIVE_MATCH_SNAPSHOT_VERSION = 1;
  const MIXMASH_PROFILE_VERSION = 1;
  const SNAPSHOT_SAVE_INTERVAL = 15;
  const SNAPSHOT_MODES = Object.freeze(['playing', 'training', 'paused']);

  function isValidActiveMatchSnapshot(snapshot, context) {
    if (global.MixmashCore && typeof global.MixmashCore.isValidActiveMatchSnapshot === 'function') {
      return global.MixmashCore.isValidActiveMatchSnapshot(snapshot, context);
    }
    return false;
  }

  global.MixmashSnapshotData = Object.freeze({
    STORAGE_KEYS,
    ACTIVE_MATCH_SNAPSHOT_VERSION,
    MIXMASH_PROFILE_VERSION,
    SNAPSHOT_SAVE_INTERVAL,
    SNAPSHOT_MODES,
    isValidActiveMatchSnapshot,
  });
})(globalThis);
