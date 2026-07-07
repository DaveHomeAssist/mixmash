# MIXMASH Product Upgrade Roadmap

Updated 2026-07-06. Scope: the MIXMASH fighter at `/play/`. Studio hub pages and the other games in this repo are tracked separately unless a roadmap item explicitly names them.

## Current Baseline

- Browser platform fighter with 14 fighters, 11 stages, stock, time, training, Platform Rush, keyboard, gamepad, CPU, pause, fullscreen, DOM command menu, options/config persistence, local progression, and shareable URL presets.
- Active match resume snapshots are live through `mixmash_active_match_snapshot`, with schema/storage constants and validation in `play/snapshot-data.js` plus `play/core.js`.
- Combat math has a pure testable core in `src/combat.js`; stage data, fighter data, input binding data, mode rules, snapshot schema, seed/share validation, and catalog tests are now split from `play/index.html` while the renderer/game loop remains a static page.
- Tests available today: `npm test`, `npm run smoke:play`, and `npm run vercel-build`. `npm test` covers combat math, extracted play core/catalog/system modules, and MarsScape API/engine rails. `npm run smoke:play` covers the `/play/` browser flow through title, menu, controls, training, resume, Platform Rush, progression, share links, content pack, and async ghost behavior.
- This repo is a multi-game studio (fighter at `/play/`, plus MarsScape, Garden, Empires) and already ships serverless functions on Vercel (`vercel.json`, `api/**`) alongside the GitHub Pages deploy.
- CI runs `npm test`, `npm run vercel-build`, installs Chromium, and runs `npm run smoke:play` on pull requests, manual dispatch, and pushes to `gh-pages`. The push trigger includes `play/**`, `mars/**`, `api/**`, package files, and the workflow itself, so fighter and backend changes are no longer skipped on the deploy path.
- Live host: `https://mixmash.games/play/`.

## Product Direction

MIXMASH should move from "impressive browser fighter demo" to "replayable browser party fighter." The highest value upgrades are the ones that make a new player understand the game faster, make repeated sessions feel different, and give the project enough verification rails to keep adding content without breaking core combat.

## Decision Gates

| Gate | Status | Decision Needed | Why It Matters |
|------|--------|-----------------|----------------|
| D1: Character and venue identity | Re-themed 2026-07-07 | Encore content re-skinned to match the DJ/festival roster: Printworks and Electric Forest stages, Flume and Zomboy fighters. Same real-name parody basis as the base roster. | Prioritizes thematic cohesion; likeness exposure now consistent with the rest of the roster. |
| D2: Hosting security model | Resolved for GitHub Pages | `/play/index.html` now includes a JS frame guard and exposes its state through `render_game_to_text()`. Real `frame-ancestors` headers still require a future Vercel-hosted `/play/` move. | Gives the current static host a practical frame defense without a hosting rewrite. |
| D3: Online scope | Resolved as async local ghost | No real-time network multiplayer in this pass. Platform Rush records and replays local ghosts keyed by deterministic stage/seed. | Adds replayable async behavior without latency/backend risk. |
| D4: Progression storage | Resolved as local-only | `mixmash_profile` stores versioned local stats, challenge completions, best Rush times, and ghost data with corruption recovery and reset. | Adds repeat-play progression without cloud privacy or account scope. |

## Prioritized Upgrade Checklist

### P0: Roadmap Cleanup and Verification Rails

Status: Implemented locally; verified 2026-07-06.

Definition of done:
- `ROADMAP.md` matches current repo reality.
- CI runs the same core checks developers run locally, and its `push` path filter covers the code it verifies (`play/**`, `mars/**`, `api/**`, not just `src/**`/`test/**`).
- A failed resume, combat math, or build check blocks merge on both the pull-request and direct-push-to-`gh-pages` paths.
- `render_game_to_text()` remains the automation contract for gameplay smoke tests.

Implementation plan:
1. Keep this roadmap current as product scope changes.
2. (Done) Widen the `.github/workflows/ci.yml` push path filter to include `play/**`, `mars/**`, and `api/**` so fighter/backend pushes to `gh-pages` actually trigger CI.
3. Expand `.github/workflows/ci.yml` from `npm test` to also run `npm run vercel-build`. Remember `vercel-build` only checks `api/**`/`mars/**`, so it is a backend rail, not a fighter rail.
4. Promote `npm run smoke:play` to a required CI step — it is the fighter's only end-to-end rail — behind a cached Playwright browser install rather than treating it as optional.
5. Add a short verification section to future PRs and commits: commands run, live URL checked, known gaps.

Verification:
- `npm test`
- `npm run vercel-build`
- `npm run smoke:play` locally before shipping gameplay changes.

### P1: First Session and Controls Upgrade

Status: Implemented locally; verified 2026-07-06.

Definition of done:
- A first-time player can start a match in under 30 seconds without reading external docs.
- Keyboard and gamepad input states are visible in a compact control tester.
- Single-player defaults are clear: P1 human, P2 CPU, sensible stage and mode defaults.
- P2 controls do not crowd the screen when P2 is CPU.
- Resume availability is visible without adding menu clutter.

Implementation plan:
1. Add a first-session path from title to "Quick Fight" with conservative defaults.
2. Add a controls tester panel in options that shows live pressed inputs and detected gamepads.
3. Persist the last selected quick fight setup beside existing options.
4. Collapse or simplify P2 control help when P2 is CPU.
5. Extend Playwright smoke coverage for quick fight, options, gamepad-safe fallback, pause, resume, and reset.

Verification:
- `npm run smoke:play`
- Manual browser check on desktop and mobile viewport sizes.
- Confirm no console errors and no overlapping menu text.

### P2: Training Lab and Combat Readability

Status: Implemented locally; verified 2026-07-06.

Definition of done:
- Training mode exposes useful combat feedback: damage, hitstun, shield state, attack state, launch vector, and recent hit events.
- Camera shake is deterministic and tied to hit strength rather than random jitter.
- Hit sparks, damage numbers, shield effects, and KO feedback remain readable on every stage.
- Combat math emits no `NaN`, `Infinity`, or undefined velocity/state mutations.

Implementation plan:
1. Expand `renderTrainingHUD()` with compact frame and hit feedback.
2. Add a small event buffer for recent hits and expose it through `render_game_to_text()`.
3. Replace random camera shake with a decaying vector based on attacker momentum and hit strength.
4. Keep combat calculations in `src/combat.js` and migrate inline copies in `/play/` toward shared logic where static hosting allows.
5. Add Node tests for any extracted combat functions and a Playwright scenario for training mode feedback.

Verification:
- `npm test`
- `npm run smoke:play`
- Targeted screenshot inspection of training mode on at least three visually different stages.

### P3: Platform Rush Solo Mode

Status: Implemented locally; verified 2026-07-06.

Definition of done:
- New mode is selectable from mode select.
- A player collects vinyl records and hidden "Deep Cuts" across stage geometry.
- Placement never spawns collectibles outside reachable bounds on all 9 current stages.
- Mode has timer, score, restart, pause, result screen, and resume snapshot compatibility.
- Solo mode has a clean text-state contract for automation.

Implementation plan:
1. Add a mode state object separate from stock/time/training match rules.
2. Define per-stage spawn zones using existing platforms, blast zones, and camera bounds.
3. Add deterministic seeded placement so smoke tests can assert known objective positions.
4. Add scoring, timer, end conditions, and result copy.
5. Add smoke coverage for launch, collect, hidden objective, restart, and resume.

Verification:
- `npm test`
- `npm run smoke:play`
- New Platform Rush smoke script or added scenario inside the existing smoke test.
- Manual screenshot pass for all stages.

### P4: Encore Content Pack

Status: Implemented locally; verified 2026-07-06. Encore content re-themed 2026-07-07 to real DJ/festival identities (Printworks, Electric Forest, Flume, Zomboy) for cohesion with the base roster.

Definition of done:
- Two new stages ship, bringing the fighter stage count from 9 to 11.
- Two new fighters or fighter variants ship with distinct movement/combat profiles.
- Stage hazards are readable, optional, and covered by tests or smoke scenarios.
- Background track selector exists and persists through existing options storage.
- Content is visually distinct without sacrificing fighter readability.

Implementation plan:
1. Resolve D1 naming and likeness direction before adding public-facing content.
2. Add stage definitions first, with conservative geometry and visual identity.
3. Add fighters or variants using existing `FIGHTER_DEFS` patterns.
4. Add a background track selector to options, wired into the existing Web Audio scheduler.
5. Add visual and gameplay smoke coverage for the new stages and fighters.

Verification:
- `npm test`
- `npm run smoke:play`
- Manual all-stage/fighter spot check.
- Mobile viewport text and canvas framing check.

### P5: Local Progression and Challenges

Status: Implemented locally; verified 2026-07-06. D4 is resolved as local-only storage.

Definition of done:
- Local profile tracks match count, wins, KOs, favorite fighter, best Platform Rush times, and challenge completions.
- Data is local-only unless a cloud decision is explicitly made.
- Players can reset progression from options.
- Progression is versioned and resilient to corrupt localStorage data.
- Achievements never block normal play.

Implementation plan:
1. Define `mixmash_profile` with versioned schema and validation.
2. Track stats from match results and Platform Rush completions.
3. Add a compact stats/challenges panel.
4. Add a reset confirmation and migration path.
5. Add tests for validation and smoke coverage for stat updates.

Verification:
- `npm test`
- LocalStorage corruption smoke test.
- Manual replay of one match and one challenge completion.

### P6: Shareable Party Layer

Status: Implemented locally; verified 2026-07-06. Cloud leaderboards remain out of scope because D4 is local-only.

Definition of done:
- Match presets can be shared by URL: fighters, stage, mode, CPU, hazards, and seed.
- Daily or weekly challenge links generate deterministic Platform Rush layouts.
- Shared links do not break resume snapshots or user options.
- Social preview metadata remains correct for the main site and `/play/`.

Implementation plan:
1. Define a compact query parameter schema for match presets and challenge seeds.
2. Validate all URL state before applying it.
3. Add "copy challenge link" and "copy match setup" actions.
4. Add smoke tests for loading valid, missing, and malformed share links.
5. Defer cloud leaderboard work until D4 is resolved.

Verification:
- `npm test`
- Smoke test for seeded challenge load.
- Live URL manual check with copied preset link.

### P7: Online Multiplayer Prototype

Status: Implemented locally; verified 2026-07-06. D3 is resolved as async local ghosts, not real-time multiplayer.

Definition of done:
- Product decision selects one path: no online, async only, WebRTC prototype, or backend authoritative multiplayer.
- Prototype has a small test surface, not a full ranked system.
- Latency, disconnect, pause, and browser tab background behavior are explicitly handled.
- Local play remains unaffected if online fails.

Implementation plan:
1. Decide D3 before writing code.
2. If async only: build challenge ghosts/replays from deterministic input logs.
3. If WebRTC: prototype two-player sync in a separate route or feature flag.
4. If backend authoritative: first extract a deterministic simulation core from `play/index.html`.
5. Add failure-mode UI before any public release.

Verification:
- Architecture review before implementation.
- Deterministic replay tests if async/ghosts are chosen.
- Network interruption smoke checks if real online is chosen.

### P8: Engine Modularization and Maintainability

Status: Implemented locally; verified 2026-07-06.

Definition of done:
- Combat, stage data, fighter data, input mapping, snapshot persistence, and mode rules are separable modules.
- `/play/index.html` remains shippable as a static page.
- No product behavior changes during pure extraction steps.
- Each extracted module has a focused Node test or smoke scenario.

Implementation plan:
1. Extract data-only structures first: stages, fighters, options defaults, snapshot schema.
2. Extract pure functions next: combat math, bounds, placement, input normalization.
3. Keep rendering and canvas orchestration in `/play/index.html` until behavior is covered.
4. Add tests as each pure module is extracted.
5. Avoid framework migration unless a concrete product upgrade requires it.

Verification:
- `npm test`
- `npm run smoke:play`
- `npm run vercel-build`
- Diff review confirming extraction did not change behavior.

## Suggested Release Sequence

1. Release 1.1: P0 plus P1. Goal: new players can start and recover sessions confidently.
2. Release 1.2: P2. Goal: combat feels clearer and is easier to tune.
3. Release 1.3: P3. Goal: first replayable solo loop.
4. Release 1.4: P4, after D1. Goal: content expansion with safer naming posture.
5. Release 1.5: P5 and P6, after D4. Goal: repeat play through local progress and shareable challenges.
6. Release 2.0 candidate: P7 only if D3 chooses real online or async competitive play.

## Do Not Start Yet

- Full network multiplayer outside a deliberate post-ghost architecture decision.
- Public leaderboard while progression remains local-only.
- Large legacy fighter/stage renaming without a separate naming and migration pass.
- Vercel hosting/security rewrite unless stronger response headers become a concrete release requirement.
- Framework migration without a concrete product feature it unlocks.
