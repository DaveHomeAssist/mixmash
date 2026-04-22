Original prompt: Create a Smash Bros-style fighting game (BrawlForge) based on smash-game-plan.md — prototype first approach with 2 fighters, platforms, attacks, damage %, knockback, blast zones, stocks, local 2P.

## Progress

### Phase 0: Bug Fixes + Physics Centralization ✓
- [x] Centralized physics into `applyPhysics(p, dt, opts)` — eliminates 4-way duplication
- [x] Fixed dodge skipping platform collision
- [x] Shield HP clamped to 0 (no negative)
- [x] Removed dead code (state.platforms, state.matchTimer)
- [x] Input buffer system (5-frame window for attacks/jumps)
- [x] Run speed wired up (hold direction >6 frames for run)

### Phase 1: Core Combat Additions ✓
- [x] DI (Directional Influence) — shift knockback angle up to 18 degrees
- [x] Grab/throw system — grab startup, pummel, 4 directional throws
- [x] Spot dodge — down+shield, 20 frames, i-frames 3-17
- [x] Aerial dodge — shield in air, directional drift, one per airtime
- [x] Clang system — opposing hitboxes cancel with spark effects
- [x] Special fall after air dodge

### Phase 2: Stages + Stage Select ✓
- [x] Final Destination stage (flat, no platforms)
- [x] Skybridge stage with moving side platforms
- [x] Moving platform system (sinusoidal oscillation, player carry)
- [x] Stage select screen with miniature platform previews
- [x] Parallax backgrounds (stars, mountains, clouds per stage)
- [x] Stage hazard toggle

### Phase 3: Character Select Screen ✓
- [x] Grid layout with fighter portraits and stats
- [x] P1 (blue) and P2 (red) cursor navigation
- [x] CPU toggle per player (W/S or Up/Down)
- [x] CPU difficulty cycle (L1/L3/L5)
- [x] Mirror match support (alt colors)
- [x] Enter as universal confirm

### Phase 4: CPU AI ✓
- [x] Behavior tree: recovery, DI, defense, close/mid/far range
- [x] Level 1: random actions, 30-frame delay
- [x] Level 3: weighted actions, basic shield, 15-frame delay
- [x] Level 5: optimal spacing, reads opponent, 5-frame delay
- [x] CPU integrates with same input interface as human

### Phase 5: Game Modes ✓
- [x] Stock Match (3 stocks, last standing wins)
- [x] Time Match (3 minutes, score-based, infinite respawn)
- [x] Training Mode (infinite stocks, hitbox vis, frame data, damage reset)
- [x] Mode select screen between stage select and match

### Phase 6: Visual Polish ✓
- [x] Procedural idle breathing animation
- [x] Run dust trail particles
- [x] Damage number popups (float up, fade out, color-coded)
- [x] Final KO slow-mo + camera zoom (0.3x speed, 1.5x zoom, 90 frames)
- [x] Win screen confetti burst (120 particles)
- [x] Crowd cheer sound on KO
- [x] Clang sound effect

### Phase 7: Options Menu ✓
- [x] Volume control (0-100%)
- [x] Hitbox display toggle
- [x] Stage hazards toggle
- [x] localStorage persistence
- [x] Accessible from title screen (O key)

### Phase 8: Gamepad Support ✓
- [x] Gamepad API polling with dead zone
- [x] Standard mapping (D-pad, A=jump, X=attack, Y=special, R1/R2=shield)
- [x] Keyboard + gamepad merge (OR logic)
- [x] Controller rumble on hit (scales with damage)
- [x] Auto-assign gamepads to human players

### Phase 9: Testing Infrastructure ✓
- [x] render_game_to_text includes: matchType, stage, score, controlType, cpuLevel, grabTarget, slowMo, damageNumbers count
- [x] advanceTime works with slow-mo
- [x] No console errors across all test runs

### Verified via Playwright Tests
- Character select screen renders with portraits, stats, CPU tags
- Menu flow: title → charselect → stageselect → modeselect → playing
- CPU AI approaches, attacks, defends in gameplay
- Damage numbers visible during combat
- Parallax backgrounds render (stars, mountains)
- Particles active during combat (41+ particles)
- Stock/damage HUD displays correctly
- No console errors

## Architecture
- Single HTML file (~6,200 lines)
- Centralized physics: `applyPhysics(p, dt, opts)`
- Input abstraction: `getPlayerInput(p)` handles human/CPU/gamepad
- State machine covers grounded, aerial, dodge, shield, grab, KO, and respawn flows
- 9 stages, 12 fighters, 3 game modes, 3 CPU difficulty levels

## April 2 DJ Pass
- Replaced the default fighter selection fallback with DJ roster defaults so fresh loads resolve valid fighters.
- Added a six-fighter DJ art dispatch layer: `deadmau5`, `Skrillex`, `Marshmello`, `Daft Punk`, `Tiesto`, and `Subtronics`.
- Kept the existing combat data and wired the new roster into gameplay rendering and the character picker.
- Added `Festival Main Stage` with a dedicated `festival` platform theme plus new parallax shapes: `lasergrid`, `ledwall`, `speakerstacks`, `crowd`, and `spotlights`.
- Fixed the title-to-character-select `Enter` carry bug so one confirm no longer auto-skips the picker.

### April 2 Verification
- `new Function(...)` parse check on the inline `<script>` passed.
- Playwright client captured `charselect` mode after a single title confirm; DJ portraits rendered for `deadmau5` and `Skrillex`.
- Playwright client captured `stageselect` with the new `Festival Main Stage` card visible.
- Playwright client captured live `festival` gameplay with both DJ fighters rendered, festival background layers active, and combat state updating normally.

### April 2 Test Follow-up
- Browser smoke test reconfirmed title -> charselect -> stageselect -> modeselect -> playing on `index.html`.
- Found a combat regression: grounded attacks were reading `damage` from `hitbox.damage`, which produced `NaN` knockback and broke camera/parallax rendering with a non-finite gradient error.
- Fixed attack state setup by cloning attack definitions per move instance and reading charge scaling from the top-level attack `damage` value.
- TODO: rerun the deterministic attack test after the fix and confirm damage, hitstun, and parallax rendering stay finite.

### April 2 Stage Construction Pass
- Reworked stage geometry across `skybridge`, `festival`, `tomorrowland`, `ultra`, `burningMan`, `coachella`, and `edc` to create stronger silhouette variance: more asymmetry, staggered heights, and distinct moving-platform lanes.
- Kept `battlefield` and `finalDest` as the baseline control shapes so the roster still has familiar competitive anchors.
- Verified a fresh stage-select capture shows visibly different platform stacks and spacing across the grid.
- Verified a live `festival` match still reaches gameplay cleanly after stage selection, with no console errors and normal movement/combat state updates.

### April 2 Music Pass
- Added procedural background music with Web Audio scheduling instead of external audio files, keeping the build self-contained for static hosting.
- Introduced mode/stage-aware cues: `menu` for title and selection screens, `neon` for festival/EDC/Ultra gameplay, plus `sky`, `sunset`, `fantasy`, `cosmic`, `clash`, and `victory` cue families.
- Added a persisted `Music` toggle to the options menu while keeping the existing master `Volume` as the shared output level.
- Extended `render_game_to_text` with `musicOn`, `musicCue`, `musicStep`, and `audioState` for browser verification.
- Verified in Playwright that menu music starts after input, the options toggle clears/restores the cue, and `Festival Stage` gameplay switches from `menu` to `neon` with `audioState: running` and no console errors.

### April 2 Control Matrix Verification
- Added a reusable deterministic Playwright harness at `output/verify_controls_matrix.mjs` to verify roster/role control coverage without relying on live `requestAnimationFrame` timing drift.
- Verified all 12 fighters across four roles: `P1` human, `P2` human, `CPU P1`, and `CPU P2`.
- Human checks covered `left`, `right`, `jump`, `shield`, `spot dodge`, `attack`, `P1 alt attack` (`Space`), and grounded `special`/grab.
- CPU checks covered approach movement, recovery jump, close-range attack, grounded special/grab into throw, and reactive shield.
- Final matrix result: `300/300` checks passed, with `0` console errors and `0` page errors.
- Primary artifacts: `output/web-game/control-matrix/summary.json`, `p1-deadmau5-special.png`, `p2-skrillex-shield.png`, `cpu-p1-marshmello-special.png`, and `cpu-p2-daftpunk-shield.png`.
- Supplemental standard client smoke artifact: `output/web-game/control-matrix-client/shot-0.png` with matching text state in `output/web-game/control-matrix-client/state-0.json`.
