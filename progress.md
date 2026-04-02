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
- Single HTML file (~1,400 lines)
- Centralized physics: `applyPhysics(p, dt, opts)`
- Input abstraction: `getPlayerInput(p)` handles human/CPU/gamepad
- State machine: 13 player states (idle, walk, jump, fall, attack, hitstun, shield, dodge, spotdodge, airdodge, grab, grabbing, grabbed, dead, respawning)
- 3 stages, 2 fighters, 3 game modes, 3 CPU difficulty levels
