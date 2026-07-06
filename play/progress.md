Original prompt: Implement the MIXMASH Product Upgrade Roadmap for the `/play/` fighter, preserving the roadmap scope and verifying each completed slice against the current worktree.

## 2026-07-06

- Active slice: P0 verification rails plus P1 first-session and controls upgrade.
- Current approach: keep the existing Enter setup flow, add `Q` Quick Fight for the fast first-session path, persist the last match setup separately from `mixmash_opts`, and expose options control tester state through `render_game_to_text`.
- Verification target for this slice: `npm test`, `npm run vercel-build`, `npm run smoke:play`, plus a screenshot/state check through the web-game Playwright client.

### Expanded menu architecture request

- Added scope from Dave's attached menu blueprint: DOM overlay controller, focus trap, pause-game event, onboarding/sandbox actions, remap listener, audio matrix, and `mixmash_config_v1` persistence.
- The old canvas Options screen remains in code as fallback, but `O` now opens the DOM command menu and active gameplay pauses while it is open.

### P2 Training Lab and combat readability

- Added bounded recent combat events for hits, shield hits, throws, pummels, KOs, and training ringouts.
- Training mode now renders damage, hitstun, shield HP, attack phase/frame data, launch vectors, hitstop, shake intensity, and recent hit rows.
- `render_game_to_text()` now exposes `combat` and `training` telemetry so smoke tests can assert combat readability state directly.
- Camera shake now decays from a deterministic vector derived from the hit launch and attacker momentum instead of random jitter.

### P3 Platform Rush solo mode

- Added `rush` as a selectable match type for Platform Rush while keeping Quick Fight on stock/time/training defaults.
- Platform Rush uses deterministic per-stage collectible placement anchored to platform geometry: 8 visible vinyl records plus 2 hidden Deep Cuts.
- Added solo runtime state for timer, score, collection counts, completion reason, restart, result screen, and active-match snapshot resume.
- `render_game_to_text()` now exposes `platformRush` with item coordinates, collected flags, next target, current-stage placement proof, and all-stage placement reports.
- Smoke coverage now launches Rush through mode select, collects a record and Deep Cut, verifies pause/reload/resume, restarts in-run, completes all objectives, and restarts from results.

### P4 Encore Content Pack

- Resolved D1 for new public content by adding original names only: Rune Foundry, Crystal Canopy, Rune Weaver, and Bass Forger.
- Stage count is now 11 and fighter count is now 14 through the canonical `STAGES` and `FIGHTER_DEFS` tables.
- Added readable optional moving hazards on both new stages using the existing `hazardsOn` pipeline.
- Added runic and crystal procedural music cues, exposed automatically through the existing DOM audio track selector and `mixmash_config_v1` persistence.
- Shifted the title surface and new content art toward a retro fantasy arena direction with custom forge/crystal backgrounds, platform materials, fighter props, and attack VFX.
- `render_game_to_text()` now exposes `contentPack` counts, keys, cue inventory, hazard-stage inventory, and visual direction for automation.
- Smoke coverage now asserts the new counts/keys/cues, launches both new stage/fighter combinations, screenshots them, and verifies hazards move only when enabled.

### P5 Local Progression and Challenges

- Resolved D4 as local-only for now and added versioned `mixmash_profile` storage with corrupt localStorage recovery.
- Profile tracks completed versus matches, P1 wins, KOs, per-fighter plays/wins/KOs, favorite fighter, Platform Rush runs/completions, and best Platform Rush clear by stage.
- Added a Progress tab to the DOM command menu with local stats, challenge completion rows, and a reset action guarded by a browser confirmation.
- Added non-blocking challenges for first match, first P1 win, Platform Rush completion, and Encore stage exploration.
- Versus progression records only at stock/time result boundaries; Platform Rush progression records only when the run finishes.
- `render_game_to_text()` now exposes `profile` for automation.
- Smoke coverage now verifies corrupt profile recovery, Progress tab state, stock result stat updates, Platform Rush completion stats/best time, challenge flags, and profile reset.

### P6 Shareable Party Layer

- Added validated URL preset loading with `mix=1`, fighters, stage, mode, CPU flags/levels, hazards, seed, and optional `start=1`.
- Normal match links load the setup without auto-starting; daily challenge links auto-start Platform Rush with a deterministic seed.
- Added current match and daily challenge copy actions to the DOM command menu.
- Platform Rush placement now accepts an optional seed id while preserving default stage-based placement when no seed is supplied.
- Active match snapshots now retain the challenge seed id for seeded Rush resumes.
- `render_game_to_text()` now exposes `share` with applied preset, generated URLs, and active seed id.
- Smoke coverage now verifies malformed URL fallback, valid match preset loading/start, and repeated deterministic challenge placement from the same URL.

### P7 Online Multiplayer Prototype

- Resolved D3 as async-only for this static fighter: no real-time WebRTC or backend-authoritative multiplayer in this pass.
- Added a local Platform Rush ghost prototype that records compact `[time,x,y]` samples on completed runs and replays the best local ghost for the same stage/seed.
- Ghost data is stored under the local profile, keyed by stage and seed id, and never blocks live play if missing or corrupt.
- Ghost replay rendering is visual-only and advances with fixed game frames, so pause, resume, tab backgrounding, and local controls remain unaffected by network state.
- `render_game_to_text()` now exposes `onlinePrototype` with the selected async path, network-disabled status, failure-mode handling, and ghost availability.
- Smoke coverage now verifies a completed Rush run stores a ghost and a restarted run exposes the async local ghost replay.

### P8 Engine Modularization and Maintainability

- Added `play/core.js` as a shared browser/Node core module for deterministic seed generation, URL/share validation, CPU-level validation, and active-match snapshot validation.
- Extracted the canonical stage catalog to `play/stage-data.js` and fighter catalog to `play/fighter-data.js`, loaded before the main static page script.
- The static `/play/index.html` remains shippable as a plain page; it loads `core.js` before the existing inline game script.
- Replaced the inline implementations for hash seed, Platform Rush seed, share seed validation, share booleans, CPU level validation, and active snapshot validation with thin calls into `MixmashCore`.
- Added `test/play-core.test.mjs` and `test/play-catalog.test.mjs` to exercise the extracted modules directly in Node by loading the same browser global scripts in a VM.
- `npm test` now includes the new core and catalog module tests in addition to combat and MarsScape suites.

### 2026-07-06 continuation audit

- Re-read the updated roadmap objective and found `ROADMAP.md` still described the old 12-fighter/9-stage baseline and unresolved D1-D4 gates.
- Resolved D2 for the current GitHub Pages model by adding a JS frame guard to `/play/index.html`; `render_game_to_text()` now exposes the frame guard state for smoke verification.
- Finished the remaining P8 extraction gap by adding `play/input-data.js`, `play/mode-rules.js`, and `play/snapshot-data.js` for input binding tables, mode/profile challenge rules, Platform Rush constants/state sanitization, and snapshot storage/schema constants.
- Updated `/play/index.html` to consume the extracted input, mode, and snapshot modules while keeping rendering/canvas orchestration inline.
- Added `test/play-system-modules.test.mjs` and included it in `npm test`.
- Updated `ROADMAP.md` to match current repo reality: P0-P8 implemented locally, D1/D2/D3/D4 resolved for this release, live deployment still separate.
- Completion audit found seeded Platform Rush placement reports could rebuild collectibles from animated platform coordinates on moving-platform stages. Fixed Rush generation/reachability to use base platform geometry and added smoke coverage that every active collectible reports reachable.
