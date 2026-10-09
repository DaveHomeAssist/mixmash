# MIXMASH Product Upgrade Roadmap

Updated 2026-10-09. Scope: the MIXMASH fighter at `/play/`. Studio hub pages and the other games in this repo are tracked separately unless a roadmap item explicitly names them; a short studio snapshot and the open decisions are recorded below so this file is not read as the whole picture.

Cross-catalog UX/mobile/performance polish for every game — including `/play/` tickets MM-101 through MM-105 — is tracked separately in [`docs/SPRINT_BOARDS.md`](docs/SPRINT_BOARDS.md).

## Current Baseline

- Browser platform fighter with 14 fighters, 11 stages, stock, time, training, Platform Rush, keyboard, gamepad, CPU, pause, fullscreen, DOM command menu, options/config persistence, local progression, and shareable URL presets.
- Active match resume snapshots are live through `mixmash_active_match_snapshot`, with schema/storage constants and validation in `play/snapshot-data.js` plus `play/core.js`.
- Combat math has a pure testable core in `src/combat.js`; stage data, fighter data, input binding data, mode rules, snapshot schema, seed/share validation, and catalog tests are now split from `play/index.html` while the renderer/game loop remains a static page.
- Fighter rails: `npm test` (combat math, extracted play core/catalog/system modules, alongside the MarsScape, Front of House, hub and admin catalog suites), `npm run smoke:play` (title, menu, controls, training, resume, Platform Rush, progression, share links, content pack, async ghosts), and `npm run smoke:mobile` (touch start and on-screen pad on phone and tablet configs).
- This repo is a multi-game studio and also ships serverless functions on Vercel (`vercel.json`, `api/**`) alongside the GitHub Pages deploy.
- CI (`.github/workflows/ci.yml`) runs on every push to `gh-pages` with no path filter (the admin catalog check covers every tracked file), on every pull request, and on manual dispatch. The `test` job runs `npm ci`, the Front of House vendor/asset checks, `npm test`, `npm run vercel-build`, the MarsScape art validate/report/contact-sheet drift checks, the MarsScape and Front of House simulation and docs drift checks, then installs Chromium and WebKit and runs the landing, Front of House, art visual, play, catalog, zelda2mario, admin and mobile touch smokes. Separate jobs handle Front of House performance calibration (manual) and paired performance regression (pull requests that touch the renderer).
- Live host: `https://mixmash.games/play/`.

## Studio Snapshot (2026-10-09)

- The homepage at `https://mixmash.games/` is the six-game festival catalog (`src/hub/catalog.mjs`): MIXMASH (Released), Pitch Riot (Released), Front of House (Early playable; noindex, out of the sitemap), MarsScape, Garden OS: Story Mode and Age of Dave (Playable preview).
- Mobile and tablet fix program (`test/mobile-touch-smoke.mjs`, 12 phone/tablet configs in WebKit and Chromium): MarsScape map nodes, skill rows and Reset view now give a 44 px touch target (phase 3b), and Age of Dave's start, guide and Controls buttons are 44 px with an Order switch that turns a tap into the right-click command on touch screens (phase 4). The only remaining expected failure is the Front of House 40 px buttons.
- Age of Dave touch limits that need an `aoe2-clone` C++ change rather than a page change: the lobby civ/player choice is keyboard-only, there are no numbered control groups, and box-select by touch drag is unverified on real devices.
- Physical phones, tablets, controllers and two-person local play are not certified by browser emulation.

## Open Decisions for Dave

| Decision | State | Where |
|---|---|---|
| Real DJ/festival names | Open. The base roster and the Encore content (Printworks, Electric Forest, Flume, Zomboy) use real DJ/festival names as parody; whether to keep them or rename is not decided (see D1). | `/play/` fighter and stage data |
| PR #11 art review (DEC-79 paid-test candidate) | Open, not merged. The PR itself says not to merge until Dave reviews the paid-test scene in game at 1.0x, completes the seven acceptance checks, and records the receipt in `mars/docs/DECISIONS.md`. | `dec79-paid-test-candidate` |
| Age of Dave control groups | Open. No control-group binding exists in the shipped WASM build; adding one is an engine change in the `aoe2-clone` repo, not this one. | `docs/SPRINT_BOARDS.md` EMPIRES notes |

## Product Direction

MIXMASH should move from "impressive browser fighter demo" to "replayable browser party fighter." The highest value upgrades are the ones that make a new player understand the game faster, make repeated sessions feel different, and give the project enough verification rails to keep adding content without breaking core combat.

## Decision Gates

| Gate | Status | Decision Needed | Why It Matters |
|------|--------|-----------------|----------------|
| D1: Character and venue identity | Re-themed 2026-07-07; real-name decision open | Encore content re-skinned to match the DJ/festival roster: Printworks and Electric Forest stages, Flume and Zomboy fighters. Same real-name parody basis as the base roster. Whether to keep real DJ/festival names is still Dave's call. | Prioritizes thematic cohesion; likeness exposure now consistent with the rest of the roster. |
| D2: Hosting security model | Resolved for GitHub Pages | `/play/index.html` now includes a JS frame guard and exposes its state through `render_game_to_text()`. Real `frame-ancestors` headers still require a future Vercel-hosted `/play/` move. | Gives the current static host a practical frame defense without a hosting rewrite. |
| D3: Online scope | Resolved as async local ghost | No real-time network multiplayer in this pass. Platform Rush records and replays local ghosts keyed by deterministic stage/seed. | Adds replayable async behavior without latency/backend risk. |
| D4: Progression storage | Resolved as local-only | `mixmash_profile` stores versioned local stats, challenge completions, best Rush times, and ghost data with corruption recovery and reset. | Adds repeat-play progression without cloud privacy or account scope. |

## Prioritized Upgrade Checklist

### P0: Roadmap Cleanup and Verification Rails

Status: Shipped. CI later dropped the push path filter entirely, so every push to `gh-pages` runs the full suite (see Current Baseline).

Definition of done:
- `ROADMAP.md` matches current repo reality.
- CI runs the same core checks developers run locally, and its `push` path filter covers the code it verifies (`play/**`, `mars/**`, `api/**`, not just `src/**`/`test/**`).
- A failed resume, combat math, or build check blocks merge on both the pull-request and direct-push-to-`gh-pages` paths.
- `render_game_to_text()` remains the automation contract for gameplay smoke tests.

Implementation plan:
1. Keep this roadmap current as product scope changes.
2. (Done, then superseded) Widen the `.github/workflows/ci.yml` push path filter; the filter has since been removed so every `gh-pages` push runs CI.
3. (Done) CI runs `npm run vercel-build`. It syntax-checks the API, MarsScape, Front of House, admin and hub scripts, so it is a backend/build rail, not a fighter rail.
4. (Done) `npm run smoke:play` is a CI step, together with `npm run smoke:mobile` for the touch path.
5. Add a short verification section to future PRs and commits: commands run, live URL checked, known gaps.

Verification:
- `npm test`
- `npm run vercel-build`
- `npm run smoke:play` locally before shipping gameplay changes.

### P1: First Session and Controls Upgrade

Status: Shipped to `gh-pages` (live at `/play/`); verified 2026-07-06.

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

Status: Shipped to `gh-pages` (live at `/play/`); verified 2026-07-06.

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

Status: Shipped to `gh-pages` (live at `/play/`); verified 2026-07-06.

Definition of done:
- New mode is selectable from mode select.
- A player collects vinyl records and hidden "Deep Cuts" across stage geometry.
- Placement never spawns collectibles outside reachable bounds on all 11 current stages.
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

Status: Shipped to `gh-pages` (live at `/play/`); verified 2026-07-06. Encore content re-themed 2026-07-07 to real DJ/festival identities (Printworks, Electric Forest, Flume, Zomboy) for cohesion with the base roster.

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

Status: Shipped to `gh-pages` (live at `/play/`); verified 2026-07-06. D4 is resolved as local-only storage.

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

Status: Shipped to `gh-pages` (live at `/play/`); verified 2026-07-06. Cloud leaderboards remain out of scope because D4 is local-only.

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

Status: Shipped to `gh-pages` (live at `/play/`); verified 2026-07-06. D3 is resolved as async local ghosts, not real-time multiplayer.

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

Status: Shipped to `gh-pages` (live at `/play/`); verified 2026-07-06.

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
