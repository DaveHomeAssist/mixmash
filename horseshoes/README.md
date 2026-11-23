# Backyard Horseshoes — Phase 3 prototype

Built from DaveHomeAssist/curling-simulator commit `4d09e2fe4107b479444584bbd01acca688fa8593` ([source PR16](https://github.com/DaveHomeAssist/curling-simulator/pull/16)). Source planning and release evidence live in `docs/HORSESHOES_PHASE3_BRIEF.md` and `docs/HORSESHOES_RELEASE.md` in that repository.

## Play

The arrival menu offers local two-player, solo versus computer, and practice. Each player pitches two shoes; all four share one physical world. Final resting geometry determines cancellation scoring: ringers 3, closest eligible shoes within six inches 1, no leaner bonus. Fouls remain invalid after a bounce into the pit. Scoring player leads the next inning; ends reverse. First to at least 21 after a complete inning wins.

Solo gives Player 2 to a computer. Easy searches 6 candidates and Normal 12 in cloned Rapier worlds with identical materials, launch resolution, existing shoes and scoring. Search runs in a worker; it does not steer after release. Advance innings manually to inspect the score. Opening Menu pauses physics, AI and replay. Mode/difficulty choices apply only after Start new game; Resume preserves the current match. Starting a new game cancels pending search.

Sound starts off. Enable it in Menu and adjust volume. Stake, shoe and ground contacts have distinct procedural sounds, aggregated across compound colliders with resting-contact suppression. Replay is silent. Sound is optional when unavailable.

After a settled throw, replay the last or best throw in the current match/practice run. Pause, scrub and exit from Controls. Replay displays recorded transforms, including displaced shoes; it never changes the live score or world. Restart clears recordings.

Controls and Score use neutral tab navigation above the deck. Aim/arc are blue, delivery violet and strength warm; Throw has its own orange accent. The separate Menu button opens grouped game, sound, display and help settings with keyboard focus containment and Escape to resume.

Drag to orbit and wheel/pinch to zoom. Keyboard shortcuts defer to focused controls. Light/dark modes remain available, light by default. The page stays within the viewport; history/menu content scroll inside bounded panels. Ultrawide screens place controls beside the court.

## Preservation and limits

The route stays unlisted with `noindex, nofollow`. Original Curling and Mixmash homepage are unchanged. No online play or saved matches; only theme preference is stored locally. Physics materials and tilted/stacked adjudication remain provisional. No wind, deformable soil or stake flex. Physical phone, screen-reader and human listening/play acceptance are separate from automated checks.

## Build and verification

Run `npx vite build --base /horseshoes/` in source. Copy `dist/horseshoes.html` to `horseshoes/index.html` plus its referenced JS/CSS, shared Three.js chunk, AI worker chunk and FMP venue JSON. Never patch generated bundles directly.

The Phase 3 release passed 78 source tests/build on the Linux runner; the later pavilion release passed 80. Browser checks completed local matches (84 throws per viewport) and solo matches (24 throws/six innings, both difficulties), plus audio output/mute, replay preservation, stale AI cancellation, native keys, emulated touch and return links. Maximum observed candidate search was about 0.8 seconds on that runner; device performance varies. No human acceptance is implied.

Run `npm run smoke:horseshoes` for local, solo and menu regression suites. Set `HORSESHOES_BASE_URL=https://mixmash.games/horseshoes/` to test publication. Exact CI/merge/deployment/live evidence belongs to the pull request and source release record. Next: physical-device play feedback and confirmed corrections only.

## FMP setting

The decorative lawn, pavilion and seating are reused from DaveHomeAssist/system-by-dave’s FMP camera simulator at revision `18a1a4e165f326aa8f7a0ae9505b29b67db575ac`, with Dave Robertson’s explicit authorization. Copyright (c) 2026 Dave Robertson. All rights reserved. Geometry/materials only; no operational camera records or network data. The level game patch is an adaptation of an approximate venue model, not a surveyed court. Source provenance and reproducible export instructions live in `src/horseshoes/assets/README.md` in curling-simulator.

Menu pause/focus, explicit new-game choices, both themes and distinct control colors passed at desktop, phone, short landscape and ultrawide sizes on Dominic. Venue likeness and physical-device acceptance remain human follow-ups; exact candidate CI and published checks remain release gates.

## Pavilion broadcast

Four schematic lawn delay monitors show a silent instant replay of each settled throw, while the next throw remains available. The feed holds its final frame; menu/hidden page pause it, and a new game clears it. The intro is a six-second camera pass with Skip, Escape, pointer or throw cancellation; reduced motion skips it. Menu offers Tour venue and View delay screens. Throwing from the optional screen view returns to the court.

The Horseshoes adapter consumes the existing pinned FMP geometry under ECP-1.0; D1–D4 lawn delay anchor names and source demo dimensions remain unchanged. It adds only a simulated screen feed, with no hardware connection or producer changes. Source brief: docs/HORSESHOES_BROADCAST_BRIEF.md. The pavilion broadcast release was verified through source PR13/14 and Mixmash PR170, including CI, Pages, live asset parity and browser checks. The source release record owns exact evidence and next steps.

Venue views stay disabled while loading or if the four named screen anchors are unavailable, with a visible menu status. The court remains playable. The replay camera tracks the recorded shoe in flight and at the landing.


## Audit corrections and hardening

Short landscape windows place controls beside the court. Very small windows
provide Court, Controls and Score tabs so actions are reachable without page
scrolling; Menu keeps theme selection and return links available. Regression
checks measure each required control against the viewport and clipping ancestors,
including 568×320 and the 320×256 stress case, in both themes.

The production entry applies a Content Security Policy permitting same-origin
scripts, workers and assets, with WebAssembly compilation for Rapier. It blocks
inline JavaScript, frames, objects, base URLs and form submission. Referrer
information is suppressed. The source development server binds to loopback by
default. These are defense-in-depth controls, not proof of absence of all bugs.

GitHub Pages directly hosts this route with HTTPS enforcement. It cannot apply
custom per-route response headers in this configuration. HSTS, `nosniff` and
server-enforced framing restrictions remain hosting limitations; document meta
policies cannot replace them. No DNS, hosting or original-game changes are made
by this maintenance work. Exact candidate verification is recorded in the source
release document and release PR; physical-device and human acceptance remain
separate.

The source toolchain uses Vite7.3.7 and Vitest4.1.12 with patched transitive dependencies. The October18 repair audit reports zero known vulnerabilities for both the full lockfile and runtime-only dependencies; all80 source tests and487 integrated Mixmash unit tests pass. Runtime Three.js and Rapier versions are unchanged.
