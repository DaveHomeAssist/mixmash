# Backyard Horseshoes prototype

An isolated static build of the Phase 1 physics practice mode from
`DaveHomeAssist/curling-simulator` commit `d855db8`.

## Player problem

Provide a quick, readable way to aim and throw one physically simulated
horseshoe without changing or replacing the original curling game.

## Player flow

Choose aim, strength, arc, and flip or turn delivery; throw; watch the rigid
body simulation settle; then retry immediately. Close camera and collider
diagnostics are optional.

## Smallest release scope

The route contains one practice court, one inclined stake, one compound
collider shoe with an open mouth, desktop and touch controls, fixed 120 Hz
Rapier stepping, render interpolation, diagnostics, and repeatable presets.

## Exclusions

No full innings, scoring, opponent, deformable soil, aerodynamic model, wind,
stake vibration, online play, magnetic stake behavior, or post-release steering.

## Rules, data, and saves

This prototype does not adjudicate regulation scoring and stores no player data
or saved game state.

## Dependencies

The static bundle contains Three.js 0.180.0 and
`@dimforge/rapier3d-compat` 0.21.0. Source dependency versions are locked in the
source repository's `package-lock.json`.

## Risks

Physical parameters remain provisional. Browser and device performance can vary,
and the first load includes the bundled Rapier runtime. Cross-platform bitwise
determinism is not promised.

## Acceptance

The `/horseshoes/` route loads without console or request errors, launches a
shoe through mouse, keyboard, and touch input, supports immediate retry, keeps
the shoe mouth open in collision geometry, and reaches a stable rest state.

## Mixmash integration corrections

The deployed bundle includes a narrow integration patch over the recorded Phase 1
build: Curling links to its existing GitHub Pages game, Mixmash links to the
existing homepage, and the global keyboard shortcuts defer to focused native
controls and modified browser shortcuts. The application asset was fingerprinted
again so cached clients receive the correction. Physics is unchanged. The mobile
court height now leaves room for utility controls at 375 × 812 without page
scrolling. Retry also clears the previous throw’s hit banner immediately.
The recorded source commit is provenance from PR #154; it was not available from
the source repository during this verification, so this is an explicit deployment
patch rather than a claim of a new source build. Preserve these corrections when
replacing the static bundle from source.

Run `npm run smoke:horseshoes` for the local browser regression. Set
`HORSESHOES_BASE_URL=https://mixmash.games/horseshoes/` to exercise publication.
The smoke covers assets, mouse and emulated touch, native keyboard activation,
throw/retry, presets, stable rest, and return navigation. Physical device and
human play acceptance remain separate.
