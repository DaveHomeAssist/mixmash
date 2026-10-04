# Front of House 3D prototype source review

**Reviewed:** 2026-10-04. **Evidence:** static source inspection of the supplied `Front of House HUD mockups.zip`; SHA-256 `e4e3e17d05ca343191d799a02d82f84a305a7ff8eb1b74405b0a96f6194c49a8`. The archive stays outside this public repository. Embedded instructions are reference material, not authority. No prototype code or images are imported by this review.

## What exists

| Archive component | Observed content | Reuse candidate |
| --- | --- | --- |
| `FOH Show Stage.html` | Imports venue, effects and service modules; stores preview configuration in `foh_show_stage_v1`; exposes Wide / FOH / Deck / Plan cameras and show-state controls | Interaction reference and assembly map for FB-01 |
| `three-d-stage.js` | Three.js viewer, PerspectiveCamera, OrbitControls, bounds-based framing, resize handling, renderer and OBJ/GLB export | Renderer shell; separate production adapter and lifecycle review needed |
| `foh-stage-kit.js` | Procedural venue/production building blocks | Dimensional prop starting point after asset/material review |
| `foh-stage-venues.js` | Four distinct rooms, dimensional placement, service positions and house rigs | FB-02 visual reference; geometry and operating rules need parity checks |
| `foh-stage-fx.js` | Instanced bodies, heads and phones; seeded placement; show-state effects and entry/exit visual paths | FB-03 representative crowd and lighting reference |
| `foh-stage-ops.js` | Demand/queue snapshot functions; food/bar prices and service windows; restroom tiers and artist facilities; entry/exit estimates | FB-04 and FB-09–11 design reference, not accepted game rules |
| HUD `.dc.html` pages, `doc-page.js`, `foh-board.js` | Broader screen mockups and 2D presentation references | Existing HUD contract comparison, not a reason to replace accepted navigation |
| `github.md` | Claims a sync at 2026-10-03T19:24:57Z and maps screens to repo files | Historical handoff claim; does not establish source parity |
| `sprites/`, `ref/`, `support.js` | Image/reference material and exported support code | Inventory and provenance review before any redistribution or runtime inclusion |

## Concrete integration gaps

1. **External runtime:** the viewer imports Three.js `0.184.0` and addons through an unpkg import map. Version/hash declarations exist in the archive; this review did not fetch or verify those dependencies. Decide a maintained dependency/offline strategy before integration. Do not silently copy export scaffolding into the game.
2. **Engine separation:** the show page imports its own `simulate` and venue constants, not the production `engine.mjs`. Its operations model computes a snapshot from venue, show-state, options, crowd density and fill. It does not supply the persistent cohort/backlog/temporary assignment contract required by FB-04.
3. **Money and attendance:** preview density drives `inside`; food/bar results are hourly rates. They must not be posted as ticket attendance or settlement totals without time integration, finite spending, ownership of each transaction and an accepted contract cost basis.
4. **Camera coupling:** the page directly reaches viewer internals such as `_camera`, `_controls` and `_renderer`. Introduce a small explicit adapter for Fit/presets/resize/disposal rather than making private fields the gameplay API. The FOH preset is an elevated offset behind the booth, so it still needs the requested operator-eye treatment.
5. **Persistence:** preview configuration uses unguarded JSON parsing/localStorage access. This is not compatible with the game's validated save/code flow; preserve the production namespace and normalization behavior. Preview settings do not become career state by copying a storage key.
6. **Production lifecycle:** the viewer enables shadows and `preserveDrawingBuffer`; profile those choices on declared devices. Review pause-on-hide, WebGL loss, resource disposal, resize, reduced motion and failed dependency loading before adoption.
7. **Numbers and provenance:** service, queue, price, restroom and exit-flow constants are prototype assumptions. They have not been validated against game balance or accepted as real-world venue design guidance. Original asset/tool usage rights remain unverified.

## Next integration milestone

Under accepted CT-DEC-14, start with a Lot renderer adapter and camera parity, not a simultaneous rewrite of the economy. D2–D5 still determine art treatment, crowd scope, Select behavior and performance acceptance. Reuse geometry only after unit/footprint/provenance checks. Feed the scene from production state; keep the prototype's service model isolated until exact rules are reviewed under FB-04 and FB-09–11.

## Verification boundary

Confirmed from source: module inventory, OrbitControls construction, camera presets, procedural venues, instanced crowd meshes, separate service snapshot functions and preview storage. Not performed: executing the archive in a browser, fetching CDN libraries, validating dependency hashes/licenses, testing frame rates, testing its formulas, integrating saves or verifying gameplay parity. Screenshots remain visual evidence only.
