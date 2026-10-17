# Backyard Horseshoes — Phase 3 prototype

Built from DaveHomeAssist/curling-simulator commit `28330bbda511300f72c13db4bc2ec0b931e7e661` ([source PR6](https://github.com/DaveHomeAssist/curling-simulator/pull/6), merged as `d206cceb6b494d1778eebabfa12597fbd2bde799`). Source planning and release evidence live in `docs/HORSESHOES_PHASE3_BRIEF.md` and `docs/HORSESHOES_RELEASE.md` in that repository.

## Play

Options offers local two-player, solo versus computer, and practice. Each player pitches two shoes; all four share one physical world. Final resting geometry determines cancellation scoring: ringers 3, closest eligible shoes within six inches 1, no leaner bonus. Fouls remain invalid after a bounce into the pit. Scoring player leads the next inning; ends reverse. First to at least 21 after a complete inning wins.

Solo gives Player 2 to a computer. Easy searches 6 candidates and Normal 12 in cloned Rapier worlds with identical materials, launch resolution, existing shoes and scoring. Search runs in a worker; it does not steer after release. Advance innings manually to inspect the score. Restart or changing mode/difficulty cancels pending search.

Sound starts off. Enable it in Options and adjust volume. Stake, shoe and ground contacts have distinct procedural sounds, aggregated across compound colliders with resting-contact suppression. Replay is silent. Sound is optional when unavailable.

After a settled throw, replay the last or best throw in the current match/practice run. Pause, scrub and exit from Play. Replay displays recorded transforms, including displaced shoes; it never changes the live score or world. Restart clears recordings.

Drag to orbit and wheel/pinch to zoom. Keyboard shortcuts defer to focused controls. Light/dark modes remain available, light by default. The page stays within the viewport; history/options scroll inside bounded panels. Ultrawide screens place controls beside the court.

## Preservation and limits

The route stays unlisted with `noindex, nofollow`. Original Curling and Mixmash homepage are unchanged. No online play or saved matches; only theme preference is stored locally. Physics materials and tilted/stacked adjudication remain provisional. No wind, deformable soil or stake flex. Physical phone, screen-reader and human listening/play acceptance are separate from automated checks.

## Build and verification

Run `npx vite build --base /horseshoes/` in source. Copy `dist/horseshoes.html` to `horseshoes/index.html` plus its referenced JS/CSS, shared Three.js chunk and AI worker chunk. Never patch generated bundles directly.

76 source tests/build passed on the Linux runner. Browser checks completed local matches (84 throws per viewport) and solo matches (24 throws/six innings, both difficulties), plus audio output/mute, replay preservation, stale AI cancellation, native keys, emulated touch and return links. Maximum observed candidate search was about 0.8 seconds on that runner; device performance varies. No human acceptance is implied.

Run `npm run smoke:horseshoes` for both local and solo regression suites. Set `HORSESHOES_BASE_URL=https://mixmash.games/horseshoes/` to test publication. Exact CI/merge/deployment/live evidence belongs to the pull request and source release record. Next: physical-device play feedback and confirmed corrections only.
