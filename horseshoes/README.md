# Backyard Horseshoes — local match prototype

Phase 2 of the Three.js / Rapier prototype, built from the readable source in
DaveHomeAssist/curling-simulator commit `1feaf16dbbd4d44b4795f64cea1cfa7ae5897a61`, merged by source
[PR2](https://github.com/DaveHomeAssist/curling-simulator/pull/2) as
`2773cb4a79dea95c8bbd0efd502e31481fc281f4`. Replaces the Phase 1 practice-only
bundle while retaining practice mode and the PR155 navigation/keyboard fixes.

## Player flow

Two local players pitch two consecutive shoes each. All four shoes share the
physics world and can displace earlier shoes. Final resting geometry decides
cancellation scoring: ringers 3, closest eligible shoes within six inches 1,
leaners no extra bonus. Outside-ground contact is latched as a foul even after a
bounce into the pit. Foul bodies are removed before the next delivery. The
scoring player leads the next inning; tied innings retain the previous leader.
Ends reverse each inning. First to 21 after a complete inning wins.

Score shows the reason for each shoe and the inning history. Counted shoes glow
in close view. Options contains restart, practice, repeatable presets, fullscreen
and collider diagnostics. Drag to orbit, wheel/pinch to zoom. Aim and strength
use sliders; keyboard shortcuts defer to focused controls. Light/dark modes are
available; light is the first-use default. The page fits desktop and mobile
viewports; long history/options scroll inside their panels.

## Boundaries

The route stays unlisted and `noindex, nofollow`. Original Curling and the Mixmash
homepage are unchanged. No AI, online play, audio, replay or saved matches.
Only theme preference is stored locally. Rigid-body materials and tilted/stacked
scoring remain provisional, not tournament adjudication. No wind, stake flex or
deformable soil. Rapier 0.21.0 and Three.js 0.180.0 are locked in source.

## Build and verification

Source build: `npx vite build --base /horseshoes/`. Copy `dist/horseshoes.html` to
this directory's `index.html` and its referenced assets only. Do not patch the
minified bundle; make future changes in the source repository.

71 source tests and production build passed on the Linux runner. Browser smoke
completed 84-throw matches at 1440×900, 375×812 and 667×375, covering mouse,
emulated touch, keyboard, orbit/zoom, both themes, practice, retry, stable rest,
scoring, end reversal, match completion and restart. Physical-device/human
acceptance remains separate. Run `npm run smoke:horseshoes`; set
`HORSESHOES_BASE_URL=https://mixmash.games/horseshoes/` to exercise publication.

Phase 1 full postmerge CI38989410478 passed at published merge2c417b3.
Phase 2 CI, publication and live verification are recorded in the owning pull
requests and source release record. Next: gather physical-device play feedback.
Phase 3 AI/audio/replay remains deferred. Source planning and release records:
`docs/HORSESHOES_PHASE2_BRIEF.md`, `docs/HORSESHOES_RELEASE.md` in the source repo.

## Keyboard history correction

Source commit `c06f8a6` places tabs before their panels in keyboard order, gives
score history a focus target/ring, and preserves native scrolling keys. The
expanded smoke reproduces the old failure and checks Tab into history plus
ArrowDown/End scrolling without changing throw strength. Physics/scoring and
all existing game routes remain unchanged.
