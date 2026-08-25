# MarsScape Art Roadmap

The engineering phases are authorized. New art is not. Phase gates are evidence requirements, not aspirations.

## Phase 0 — Render contract

Lock projection, the drawn-diamond footprint, light direction, anchors, multi-tile rules, palette, and manifest naming.

**Delivered by:** `mars/render-contract.mjs`, `mars/art-spec.html`, and `mars/docs/ART_DIRECTION.md`.

**Gate:** a generator or artist can produce an asset that fits without reading gameplay code.

## Phase 1 — Canvas sprite pipeline

Rasterize the authored pixel maps once, cache them as `ImageBitmap`, and draw them through a single `drawSprite()` seam. Preserve procedural board rendering and emoji inventory icons as fallbacks. Add a persisted Pixel Art toggle. Remove the unused `settlement-atlas.svg` boot dependency.

**Gate:** all 13 authored sprites prime into the bitmap cache; supported board entities render through it; switching Pixel Art off restores the procedural board; catalog smoke asserts the board telemetry.

## Phase 2 — Anchor set

Produce six final assets: astronaut, iron vein, ice deposit, habitat, solar array, and one item icon. Review them together on the real board.

**Gate:** Dave accepts the six as the style bar. No coverage generation starts before that acceptance.

## Phase 3 — Coverage sweep, worst first

1. Late-game items currently using emoji fallback.
2. Eight node material families.
3. Eight building models × three tiers × built, ghost, and faulted states.
4. Actors and animation frames.

**Gate:** no emoji is visible in normal play with Pixel Art enabled.

## Phase 4 — Environment and light

Create horizon backdrops for two live and two planned regions, parallax ridges, day/dusk tint, and storm wash.

## Phase 5 — UI chrome

Create 9-slice panels, meter orbs, tab icons, and a self-hosted pixel display font while retaining readable body type.

## Phase 6 — Motion

Add gather impact, XP float, storm particles, and drone flight. Respect reduced-motion preference and preserve deterministic gameplay timing.

## Consistency controls

- Every prompt carries the exact palette and two accepted anchors.
- One sheet covers one material family only.
- New art is reviewed on a contact sheet and on the real board.
- Near-misses are rejected and regenerated; they do not become alternate styles.
- Raster assets remain under the existing page budget and are measured before merge.
