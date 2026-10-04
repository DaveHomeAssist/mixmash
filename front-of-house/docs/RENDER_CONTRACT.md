# Front of House Lot renderer contract

**Preflight specification, 2026-10-04.** Source baseline: [`522f3f2f49de6dcf74fa22fa51b900684dd54360`](https://github.com/DaveHomeAssist/mixmash/tree/522f3f2f49de6dcf74fa22fa51b900684dd54360/front-of-house), confirmed as the remote production branch and successful legacy Pages build before review; deployed `engine.mjs`, `data.mjs`, `board.js` and `game.js` also matched the baseline bytes. This is a proposed adapter contract, not an implemented WebGL renderer. CT-DEC-14 through CT-DEC-18 retain authority. D6–D11 were subsequently settled A under delegated authority in [CT-DEC-19](DECISIONS.md#ct-dec-19-delegated-milestone-decisions). The [prototype review](PROTOTYPE_REVIEW.md) is a separate evidence source; its geometry, simulation and storage do not define production behavior.

**Implementation update:** the [isolated Lot backend](LOT_BACKEND.md) implements camera, dimensional models, picking and resource/context ownership as a separately tested component. The explicit preview facade and gesture integration are locally tested, including complete settlement parity; full scene/art/device acceptance remains incomplete. Select/safe removal is delivered in [PR61](https://github.com/DaveHomeAssist/mixmash/pull/61); the original source map below retains its preflight baseline.

## Boundary and source map

`engine.mjs` remains the only rules authority. `game.js` owns actions, persistence, playback, focus, dialogs, tools and history. A renderer consumes a presentation snapshot and returns coordinates/hits; it never changes engine state, calculates money or chooses an incident. New methods and fields below are explicitly **proposed**. Existing names refer to the pinned source above; line numbers are for that revision.

| Existing source / entry point | Current behavior | Proposed boundary |
| --- | --- | --- |
| [`game.js`](../game.js), `draw()` lines 1103–1137 | Builds one scene and calls `board.draw(scene)` | Keep this state-to-scene ownership. Pass a read-only snapshot to either renderer. No engine imports for new business rules |
| [`board.js`](../board.js), `createBoard()` and returned API | Canvas 2D, four facings, prop sprites with code-box fallback | Retain as the fallback; new WebGL implementation behind the same required operations |
| [`engine.mjs`](../engine.mjs), `footprint`, `validateLayout`, `stageGeometry`, `sightlineTiles` | Owns occupied cells, valid placement, stage front and sight sets | Consume these results; geometry/raycast collisions cannot override them |
| [`data.mjs`](../data.mjs), `GRID`, `OBJECT_TYPES`, `VENUES` | Lot is 24 × 16; object sizes, kit flags and room metadata | Logical coordinates remain unchanged; renderer dimensions are presentation data |
| `game.js`, `act`, `placeAt`, `objectIndexAt`, `recordLayout`, `stepHistory` | Engine actions plus 50-step session history; removal uses array index | Resolve a pick against the current snapshot before dispatch. Never persist a mesh or use a stale index |
| `game.js`, `crowdNow`, `startPlayback`, `loop` | Cosmetic crowd interpolation and show clock | Render this count/time; representative guests cannot create transactions or admission |
| `game.js`, `layoutBoard`, `queueLayout` | Measures clear HUD rectangle and schedules resize/draw | Preserve HUD ownership and the clear rectangle for framing |
| `game.js`, `render_game_to_text`, `__frontOfHouse` | Existing test/state hooks | Preserve names and gameplay payloads; extend diagnostics explicitly, without claiming sprite fields describe meshes |
| [`controls.mjs`](../controls.mjs), `BINDINGS` | Existing keyboard scopes and conflict checks | Keep existing bindings and validate any new camera bindings here before implementation |
| [`SAVE_FORMAT.md`](SAVE_FORMAT.md), `game.js` load/import/persist | Validated schema 2 and namespace `front_of_house_v1` | No camera, GPU resource, selection or prototype configuration enters this save |

### Existing scene fields, exhaustively mapped

All fields are assembled in `game.js:1105–1130`; rendering consumers are `board.js:676–846`. This list is the compatibility surface, not a new serialized schema.

| Field | Owning source / meaning | Adapter rule |
| --- | --- | --- |
| `objects` | `state.venue.objects`, `{type,x,y,rot}` | Copy/read only; no persistent `id` exists today. **Proposed:** transient `{snapshotRevision, objectIndex}` handle. Invalidate on layout/load/undo; re-resolve before action |
| `grid`, `floor`, `pillars` | `state.venue.grid`, venue ID, `venueSpec(...).pillars` | `grid.w/h` define legal ground bounds; pillars are house objects and not deletable; first adapter accepts Lot only |
| `density` | `venueSpec(...).density` with `D.FLOOR_DENSITY` fallback | Existing crowd presentation input, not a renderer-generated capacity |
| `clearSet`, `blockedSet`, `showClear` | `sightlineTiles`; sets of `"x,y"`; Build overlay switch | Draw engine results exactly, without mesh-derived sight penalties |
| `cursor`, `cursorColor` | Hover/keyboard tile and bulldozer color | Logical cell outline and useful non-color feedback; no authority to place |
| `ghost` | `ghostAt`: `{type,x,y,rot,valid}` from `validateLayout` | Same footprint, facing and validity; excluded from object picking |
| `crowd` | `crowdNow()` integer | Representative count/ratio declared; no guest simulation or economy feedback |
| `incident` | Engine incident ID; non-rain marker cleared after incident | Anchor to affected logical object; never trigger an engine event from animation |
| `night`, `lightTower` | Phase and presence of `lights` | Presentation lighting toggles only; no new score/capacity effects |
| `t` | Cosmetic seconds, or zero under reduced motion/stopped playback | Never an engine clock or RNG seed; reset safely without settlement changes |

**Proposed additions:** renderer configuration `{quality, reducedMotion, assetManifestRevision}` and transient `{selection, snapshotRevision}`. Keep them outside the existing scene/save schema until implemented and tested. Asset metadata must declare logical footprint, pivot, local forward vector, visual bounds, pick proxy, height, author/source/rights, content digest and material/LOD revisions. These fields currently have no production asset loader; they are requirements for the next slice.

## Coordinates, orientation and physical scale

Logical ground coordinates are integer `x ∈ [0,24)` and `y ∈ [0,16)`; a cell center is `(x+0.5,y+0.5)`. Current `board.clientOf(x,y,z)` uses `z` as height in tile units. `footprint()` anchors the occupied rectangle at its minimum x/y, swaps type width/height for odd `rot`, and returns no cells for kit objects. `rot` is a whole number 0–3. `stageGeometry()` defines front vectors: 0 → +y, 1 → −x, 2 → −y, 3 → +x. Camera yaw never modifies `rot`.

**Proposed render transform:** use `(X,Y,Z) = (x,h,y)` in logical presentation units, Y up, at a fixed ground origin. Asset local forward is +Z; rotate about Y by `−rot × π/2`. Translate the *rotated footprint center* to `(x+wRot/2, 0, y+hRot/2)` with the authored pivot offset; do not rotate an already translated minimum corner. World-to-screen uses the active camera matrix; ground picking uses its inverse ray intersecting Y=0. Reject outside bounds before flooring coordinates. Do not clamp an outside click onto a boundary tile.

`data.mjs:16` contains a historical comment calling a tile “2 m by 2 m.” That is source evidence, **not a verified calibration of this prototype or future realistic assets**. Rules use tiles. Do not infer a 48 m × 32 m authored Lot, convert capacities, or rescale saved layouts from that comment. Record measured/reference dimensions for stage deck, bar counter, restroom door and guest height; reconcile them against logical footprints and Dave's sample review before accepting a metres-per-tile presentation scale. Until then, use logical units, label dimensions provisional, and leave physical scale calibration pending. This preflight changes neither that source comment nor any formula.

## Required operations

| Existing operation (`board.js`) | Compatibility requirement / proposed extension |
| --- | --- |
| `draw(scene)` | Render the latest complete snapshot; repeated calls cannot mutate it. Skip/release superseded work without losing current state |
| `setClear(rectOrNull)`, `resize()` | CSS-pixel rectangle relative to canvas. Recompute camera framing and actual backing size after viewport/HUD/DPR changes; preserve focus point when zoomed |
| `tileAt(clientX,clientY)` | Return `{x,y}` or null using client CSS pixels. Invert canvas offsets once; no extra DPR multiplication |
| `objectAt(clientX,clientY)` | Return the current logical object or null. Current implementation follows final paint order and sprite alpha; proposed mesh picking follows visible depth and declared pick proxies |
| `clientOf(x,y,z=0)` | Preserve `{x,y,inside,clear}` in client CSS pixels; **proposed:** add `visible` for depth/occlusion. Ground round-trip remains testable |
| `zoomTo`, `zoomBy`, `camera()` | Preserve zoom levels `[1,1.5,2,3]`, fit at 1, and anchor behavior; **proposed:** continuous zoom bounded 1–3 with legacy named stops; `camera` additionally exposes yaw/pitch/target |
| `panBy(dx,dy)`, `follow(x,y)`, `centerOn(x,y)` | CSS-pixel drag converted via ground plane; target stays within Lot. Existing centerOn uses zoom 2. HUD clear area remains the reference |
| `turnView()` | Legacy Q adds a quarter turn; return compatibility facing index. Continuous yaw is separate from an object's rotation |
| `info()`, `placeOf(x,y)` | Preserve 2D diagnostics for fallback. **Proposed:** renderer discriminator and mesh depth/pick records. Update explicit smoke expectations for 3D; never fabricate sprite rectangles to pass tests |
| `destroy()` | Current method removes a sprite-ready listener only. **Proposed WebGL requirement:** idempotent full resource/event/RAF cleanup described below |
| **Proposed** `setCamera`, `preset`, `pause`, `resume`, `status` | Public camera/lifecycle surface; consumers must not reach `_camera`, `_controls`, `_renderer` as the prototype does. `status` reports loading/ready/lost/fallback/disposed and diagnostic reason |

**Proposed camera defaults for review:** yaw wraps modulo 360°; pitch is elevation above ground, 15°–85° for orbit. Zoom 1–3 is relative to safe-area Fit, not raw world distance. Plan uses a dedicated 90° top view with a fixed up vector and no polar singularity; leaving Plan restores bounded orbit. FOH and Stage are dedicated authored views; FOH eye height depends on pending scale calibration and is not achieved by pretending the current elevated prototype preset is an eye view. Preset transitions are immediate under reduced motion. Fit considers visible prop height and clear HUD area. These numeric camera bounds are proposed presentation limits, not accepted balance or performance thresholds.

## Picking and input ownership

1. Resolve HUD/dialog input before board input. Page code owns focus and dispatch; the renderer only reports hits/camera results. Modal windows trap their intended focus; Tab and browser shortcuts retain existing behavior.
2. **Proposed:** Select is the default safe inspection tool per CT-DEC-16. Primary click/tap selects; placement requires an explicit tool and a completed non-drag gesture. Mouse camera drag uses a dedicated orbit affordance/gesture; middle drag pans, wheel zooms over the canvas. A camera drag consumes its following click. Do not silently inherit the old right-click removal gesture for camera pan.
3. **Proposed touch:** in Select, one-finger drag orbits and tap selects; two fingers pan/pinch. In Place, one-finger tap places, drag previews without committing; two fingers always own camera control and cancel pending placement. An explicit Camera control enables one-finger orbit while a placement tool is chosen. Pointer cancel/lost capture, second finger and modal open must clear pending actions. No touch gesture may remove an object merely by ending an orbit.
4. Existing arrows move the logical Build cursor; R rotates the next prop; Q turns the view; +/−/0 zoom/fit; Shift+arrows pan. Add focusable orbit/pitch/preset buttons with keyboard activation before choosing any new key combination. Escape closes a dialog/menu first, then returns placement to Select. Preserve undo/redo and their phase/load boundaries. Single removal uses undo; bulk Clear asks once with count. The Select changes are implemented separately in PR61; the camera gesture additions remain integration work.
5. Raycast only selectable opaque geometry/proxies; ignore beams, guest decoration, ghosts, cursor and transparent air. Use nearest visible depth, stable object-index tie-break for coplanar proxies; expose an accessible object list for fully occluded props. Existing logical overlaps remain invalid. Screen-space overlap between valid neighboring props must not change which visible object receives the click. A silhouette highlight must not become an invisible full-rectangle hit target.

## Resize, disposal and recovery

**Proposed WebGL lifecycle:** own a single animation schedule. Stop on hidden document/detach and while a blocking failure is shown; resume without advancing simulation from elapsed wall time. Listen for live reduced-motion preference changes. Track geometry/material/texture ownership, dispose replaced assets and FX, remove OrbitControls and DOM/resize/media/context listeners, cancel RAF and release renderer resources once. Shared resources require reference ownership; do not dispose resources still used by another instance. Test repeated mount/rebuild/destroy with bounded resource counts.

On `webglcontextlost`, prevent default where recovery is supported, stop drawing/input dispatch, retain the last logical snapshot and display status. On restoration, rebuild GPU resources from the verified manifest and redraw that snapshot and camera; no reload/import/new game. If restoration or dependency/asset initialization fails, replace the WebGL canvas with the existing Canvas 2D renderer (a context type cannot be switched in place), reconnect the same application handlers and clear area, and show the reason plus an explicit retry. Unsupported venues remain on the existing board. Fallback uses sprites when available and existing code boxes otherwise. A renderer failure cannot clear a save or restart a show.

Backing resolution is recorded, never inferred from a “quality” label. Existing Canvas 2D caps DPR at 2 and reduces it to at most 1.5 above its six-megapixel test (`board.resize`). Proposed 3D quality must be measured independently; do not copy the prototype's inverse Pixel setting into a player-facing quality promise. Check zero-size/hidden containers, reappearance, orientation change, DPR change, browser zoom and HUD resizing. Verify document width/height containment at 1440×900, 375×812 and 2560×720; bounded long panels may scroll, the page may not.

## Acceptance matrix for the implementation milestone

These are **required future cases, not passed results**. Current automated engine checks prove their existing scope only.

| Case | Fixture / action | Required evidence |
| --- | --- | --- |
| Arbitrary yaw | 37° and 135°; every rot 0–3; min/max orbit pitch 15°/85° and zoom 1/3, plus named stops | Ground-center projection/pick round-trip exact; stage front matches engine; out-of-bounds returns null; no logical or save mutation |
| Bounds and presets | Wheel/pinch beyond bounds; pan outside Lot; Wide/FOH/Stage/Plan then Fit | Clamped finite camera; no clipping through ground; Plan stable at 90°; safe-area framing; FOH unobstructed at calibrated eye height |
| Occlusion | Valid neighboring bar/restrooms and stage/PA overlapping on screen at both required yaw values | Nearest visible surface selects/removes correct current object; fully hidden object reachable by list; decorative/transparent surfaces do not intercept |
| Pointer and touch | Orbit followed by click; pinch during placement; cancel/lost capture; resize during drag | No place/remove/undo entry from camera interaction; one intentional placement equals one history step |
| Keyboard and accessibility | Board focus, all existing bindings, focusable new camera controls, dialogs and Escape precedence | No binding clashes; visible focus and useful status; no mouse-only operation; reduced motion changes no information or rules |
| Saves and determinism | Same schema-1 migrated and schema-2 normalized save in old/new renderers; same explicit actions and incident response | Deep equality of complete settlement (all money lines, attendance, satisfaction, reputation), cash, history and resulting normalized save; repeat camera paths, quality, reduced motion, reload mid-show and fallback |
| Example deterministic show | Seed 170, Sodium Arcade door deal, `STARTER_LAYOUT`, price 20, ads `{flyers:0,social:150,radio:150}`; confirm promotion then PA dropout response `wait`; accept settlement with fixed `at` | Record input/save digests and equal results for both renderers. This is a test recipe, no retune. Future 3D half remains pending |
| Lifecycle/failure | Failed CDN/asset; lost/restored context; 20 mount/dispose/rebuild cycles; hide/resume | Useful failure status, no resource growth trend, working Canvas 2D fallback, unchanged state/save and usable controls |
| Automation | Existing smoke loop and text hook; added mesh assertions at both required yaw angles | Preserve `__frontOfHouse.state/act/skip/importCode/board/boardPlace/boardZoom/boardClientOf/boardTileAt`; current public text values stable; no weakened existing checks |
| Performance and art | Frozen scenes and repeated measurements; realistic five-item sample | [Performance procedure](FEATURE_BRIEFS.md#performance-and-delivery-contract) plus [sample acceptance](ART_DIRECTION.md#realistic-lot-sample-specification). Diagnostic host results do not approve devices or art |

No engine, data, save, renderer, control or CI implementation accompanies this contract. Before shipping the adapter, implement its tests and retain the current board until technical parity, supported-device measurements and Dave's camera/art acceptance are separately recorded.

### Live service presentation extension

The application supplies optional `services` (the derived aggregate summary) and `serviceMinute` (cosmetic fractional minute while playing). The board adapter caches a layout from objects/grid and derives `serviceCrowd`: guest actors with zone/position IDs, one worker, exact zone totals, shown sample counts, a representative flag and a missing-route diagnostic. The classic and 3D renderers consume the same projection. No actor, route or display timestamp is persisted or returned to the rules engine. Bar waiting is inside admitted attendance; the gate queue is outside. At most 180 guests and one worker are drawn, with an outside sample cap of 40. Reduced motion and pause use the whole saved minute. Normal departure is not modeled by this extension.


The event-derived extension requests `liveServicesFor(state, { events: true })` only for presentation. `service-guests.mjs` reconstructs transient FIFO identities from arrival, admission, sale and expiry events. Admission expiry produces grey outside departures; bar expiry returns guests to the floor. These identities and histories never enter saved checkpoints. `serviceProgress` interpolates the previous committed minute to the current one; same-minute admission and sale traverse the gate and bar anchors. Interior routes use free cells, while outside entry crosses the actual gate. Missing routes hold the committed sample with a diagnostic and cannot modify capacity or service results.

At most 12 recorded departing samples share the existing 180-guest budget. They disappear at progress 1; pause/reduced motion immediately use that committed endpoint. Reload derives it again from replay. Representative sampling can choose different identities as zone populations change; it does not claim individual persistent guest AI. The worker retains its separately saved two-minute transfer. Normal end-of-show departure and access enforcement remain FOH-O02.


For flow-version-1 shows, event-bearing presentation summaries also include connected floor cells and usable exit routes. Sample placement is restricted to that modeled audience region. `inside` drives current bar/floor totals while `admitted` remains cumulative settlement attendance. Normal-departure events select FIFO floor guests, travel on free cells through their recorded exit, and vanish at the committed endpoint. At most 12 exit/abandonment samples share the 180-guest limit. Default numeric summaries omit route/cell data; none is persisted. Both renderers use the same projection.

### Food projection

Food demand and finance are engine-owned. Presentation consumes food request/outcome events with the same arrival-derived guest identity as bar service. Green food waiting is a subset of inside attendance; bar+food+floor equals inside. Each guest enters the normal-departure FIFO once after their bar outcome, and all food requests resolve by closing before departure begins. Camera/speed/reload never own stock or receipts. The source-owned stall is procedural in both backends; classic adds a FOOD label, and neither palette nor board requests an absent PNG. Lot sample 3 contains the stall alongside the existing samples.


### Split Acre technical preview

The logical build grid remains 40 × 24. The renderer alone uses a 52 × 24 presentation extent with a fixed side-stage annex at x40..52, y0..16. Ground picking outside the logical grid returns null; opaque annex scenery also blocks placement. Wide and Plan cover both stages, and the keyboard-accessible Side stage preset focuses the annex. These authored dimensions are provisional presentation geometry, not calibrated physical dimensions or additional sellable capacity.

When the engine supplies versioned stage sales, the renderer retains exact main and side attendance and distributes at most 180 representative guests across both presentations. It does not recalculate admission, stage allocation or settlement. Legacy saves with no authoritative stage allocation report unknown side attendance and preserve their previous accounting. Camera, renderer choice and sampling remain absent from saves. Both presentations dispose on room changes and follow the existing context-loss fallback.


### Overview projection and pan

Both backends expose presentation-only `navigation()` and `panTo(x,y)`. Navigation returns the current extent, view rotation and ground polygon clipped to the safe viewport;3D additionally supplies fixed annex rectangles. Perspective clipping uses homogeneous frustum half-planes, including the near plane and positive clip-W, so horizon-crossing views stay finite. The overview clips that polygon to actual floor regions. `panTo` preserves zoom and camera preset, clamps the target to the current extent and never changes simulation state. The adapter notifies camera/renderer changes; the overview reuses unchanged pixels and owns no animation loop.
