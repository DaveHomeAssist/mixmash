# MarsScape Art Roadmap

*Companion to `ART_DIRECTION.md`. That document sets the look; this one sets the order
of work, the gates between phases, and the decisions that must be made before any
asset is commissioned.*

*Status: Phase 0 not started. One blocking decision open (section 2).*

## 1. Why the existing plan cannot be executed as written

`ART_DIRECTION.md` was authored for the standalone MarsScape renderer, which placed
nodes and buildings as DOM elements at percentage coordinates on a flat surface. Its
asset manifest reflects that: nodes at 24x24, buildings at 48x32, a single flat facing.

The port replaced that renderer. `mars/game.js` now draws a true 2:1 isometric board:

```
iso(x, y) = ((x - y) * TILE_W, (x + y) * TILE_H)    // TILE_W 42, TILE_H 21
```

Flat sprites do not drop into an isometric board. Every prop needs an isometric facing,
a single shared light direction, and a tile-aligned footprint. The manifest in
`ART_DIRECTION.md` is therefore a **style** reference, not a **spec** — its sizes and
facings are superseded by Phase 0 below.

There is a second, sharper constraint. **The sprite registry cannot draw to the board
at all.** `sprites.mjs` returns HTML strings: `<svg>` from `spriteHTML()`, `<span>`
from `spriteOrEmoji()`. The board is a `<canvas>`. There is no path from the registry
to the board today, which is why the 13 hand-authored sprites appear in exactly one
place — the pack inventory grid.

Consequences for planning:

- Commissioning art before Phase 0 risks an entire batch authored to the wrong
  projection, facing, or footprint.
- "Wire the existing sprites into the board" is not a small change. It requires a
  raster path that does not exist.

### 1.1 A footprint detail that will cost a batch if missed

Tile *spacing* is 42x21, but `drawTile()` draws a **66x34** diamond. Tiles deliberately
overlap to create depth. Art authored to the spacing will leave visible seams between
tiles; art authored to the drawn diamond will not. Phase 0 pins this.

## 2. Open decision — the endpoint (blocking)

`ART_DIRECTION.md` states "painted world, pixel actors". That was designed for a flat
surface. On an isometric board, a painted backdrop *beneath* the tile grid fights the
grid rather than supporting it. Three coherent endpoints:

| | Direction | What it means | Art cost | Integration risk | Ceiling |
|---|---|---|---|---|---|
| **A** | Full isometric pixel art | Everything on the board is isometric pixel art. Painting survives as sky and distant ridges *beyond* the board edge. | High volume | Low | Highest |
| **B** | Painted world, pixel actors | Keep the original vision. Requires re-projecting backdrops per region and reconciling paint with the tile grid. | High | High | High, but the grid undercuts it |
| **C** | Elevated procedural | No sprite pipeline. Invest in lighting, materials, depth cues and motion on the existing canvas draw. | Lowest | None | Caps out — distinctive, never "crafted" |

**Recommendation: A**, with C's lighting discipline applied on top. The renderer has
already made this choice; A stops fighting it, and the painted instinct survives where
it works — the horizon beyond the board.

Nothing downstream can be specified until this is settled, because it determines every
asset spec.

## 3. Phases

Each phase has an exit gate. A phase is not done until its gate is demonstrable.

### Phase 0 — Lock the render contract (engineering, no art)

Produce the spec that makes art commissionable.

- Projection: 2:1 isometric, spacing 42x21, **drawn diamond 66x34**
- One global light direction, stated as an angle, applied to every asset
- Anchor rules: tile-centre for props, feet-centre for actors
- Multi-tile footprint rules for buildings occupying more than 1x1
- Palette lock — reuse the existing CSS custom properties; the palette is right
- Manifest naming and id conventions
- State variants every prop needs: normal, locked, depleted, ghost/planned, faulted

**Gate:** a spec page rendering the grid with measurement overlays, such that the
document can be handed to any generator and produce art that fits without rework.

### Phase 1 — Canvas sprite pipeline (engineering, no art)

- Raster path: pixel map or sheet cell to offscreen canvas, cached as `ImageBitmap`
- `drawSprite(ctx, id, pos)` used by `drawNodeModel`, `drawBuildingModel` and
  `drawPlayerModel`, with the current procedural draw retained as fallback
- The pixel-mode toggle `ART_DIRECTION.md` specifies but which was never built: a
  persisted UI preference in its own localStorage key, **not** in the save schema
- Resolve `settlement-atlas.svg` — it is declared in the manifest, preloaded behind the
  boot gate, and never drawn. Use it or delete it.

**Gate:** the existing 13 sprites render on the board, procedural fallback intact, and
a browser smoke check asserts board sprites are present, not just inventory ones.

### Phase 2 — Anchor set (art, small)

Six sprites at final Phase 0 spec: astronaut, iron vein, ice deposit, habitat, solar
array, one item icon. These are simultaneously the quality bar and the style anchors
every later generation prompt references.

**Gate:** the anchors sit on the real board beside the procedural draw and are judged
better. If they are not, the spec is wrong — return to Phase 0 rather than generating
more.

### Phase 3 — Coverage sweep (art, bulk)

Sequenced worst-first, because coverage is currently inverted: the early game is
authored and the late game is emoji.

1. **The 13 late-game items on emoji fallback** — silicate, rare-earth and iridium ore,
   geode, glass, alloy, iridium bar, insulation, fertilizer, soy, algae, berries,
   genefruit. This is the endgame economy, seen by the most invested players, and it is
   the least finished surface in the game.
2. **8 node kinds** with their state variants
3. **8 building models** across 3 tiers, in built / ghost / faulted states
4. **Actors** — astronaut idle, walk, mine; drones

**Gate:** no emoji visible during normal play.

### Phase 4 — Environment and light (art)

Horizon backdrop beyond the board edge, per region — two live (Landing Basin, Dune Sea)
and two planned (Canyon Network, Polar Cap) — plus parallax ridge layers and a day/dusk
tint. Storm wash stays procedural CSS.

### Phase 5 — UI chrome (art)

9-slice panel frames, meter orbs, tab icons, and a pixel display font for headings with
body text staying DM Sans for readability.

### Phase 6 — Motion (engineering and art)

Gather impact, floating XP, storm particles, drone flight paths.

## 4. The failure mode most likely to sink this

Consistency across separately generated batches. What actually works:

- Every prompt carries the palette hex list **and** two finished anchors as style
  references
- One sheet per material family; never mix materials in a batch
- A contact-sheet review page showing candidate art on the real board beside
  already-shipped art, never in isolation
- Reject and regenerate rather than accepting near-misses. A near-miss accepted early
  becomes the anchor for everything after it.

## 5. How we know it is real

Acceptance criteria for calling the art work done:

- Every interactive element is distinguishable at a glance at 100% zoom on a 390px
  viewport — the mobile width already covered by the catalog smoke
- No emoji fallback visible during normal play
- One light direction across every asset on screen
- Board render holds 60fps on mid-range mobile
- Page weight stays within budget: `mars/` is currently about 289KB against the 1.5MB
  single-file ceiling, so there is substantial headroom

## 6. Effort shape

Phases 0 and 1 are engineering and are bounded. Phases 2 to 6 are an art programme:
repeated generate / review / reject cycles where the bottleneck is judgement, not
tooling. Plan them as ongoing work with a standing review loop, not as a sprint with an
end date.
