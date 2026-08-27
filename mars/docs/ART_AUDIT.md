# MarsScape Renderer and Asset Audit

- Audit date: 2026-08-27
- Canonical source: `DaveHomeAssist/mixmash`, branch `gh-pages`
- Start-of-run SHA: `9eba6e5cdca4aa8fba8ea4ef4328e49c3ee12658`

Classification meanings:

- **Production-ready:** safe to rely on in the current production pipeline.
- **Adaptable:** correct enough to retain or evolve, but not final commissioned-art approval.
- **Reference-only:** useful historical or visual evidence that must not drive the renderer directly.
- **Replace:** active claim or implementation should be superseded.
- **Missing:** required capability or asset is absent.

## System audit

| Scope | Classification | Evidence | Required action |
| --- | --- | --- | --- |
| Sprite registry | Adaptable | `sprites.mjs` contains 33 consistent pixel maps, aliases, DOM SVG output, sheet registration, and emoji fallback. | Keep as fallback/reference. Final PNGs need the validated commissioned-asset path. |
| Asset-loading path | Adaptable | `AssetLoader` loads `assets/manifest.json`; the manifest currently contains only `mars-terrain.svg`. Runtime maps rasterize without network files. | Validate commissioned files before registration; do not let one missing sprite fail boot. |
| Terrain | Adaptable | Canvas draws a shared regolith surface, 121 inset faces, NW edge light, rocks, rim, and SVG texture. | Keep fallback. Replace visual coverage with the five golden terrain assets after approval. |
| Buildings | Adaptable | All eight building IDs have canvas sprites and procedural models. Canvas draw uses bottom-centre at `+18px`; unbuilt uses alpha only. | Keep fallback. Add canonical five-state commissioned exports. |
| Resource nodes | Adaptable | Eight board outcrop maps cover current resource families; procedural geometry remains. Canvas draw uses bottom-centre at `+12px`. | Keep fallback. Commission blue crystal and common ore first. |
| Item icons | Adaptable | 17 of 27 canonical item IDs resolve to a map through direct IDs or aliases; the rest use emoji. | Keep fallback. Replace emoji coverage after golden approval. |
| Pixel Art toggle | Production-ready | `marsscape.pixelMode.v1` persists independently; board telemetry proves pixel/procedural mode; off mode retains gameplay. | Keep and include in every regression pass. |
| Procedural fallback | Production-ready | Terrain, nodes, buildings, and astronaut draw without sprites; inventory uses emoji. | Keep as a release-safety layer. Add warning-once evidence for missing sprites. |
| ImageBitmap caching | Production-ready | `SpriteBitmapCache` deduplicates pending work, stores decoded bitmaps, disables smoothing, and draws at fixed scale. | Preserve on slow decode and external-asset integration. |
| Anchors | Replace | v1 prose says generic tile-centre props, while shipped nodes, buildings, and actor use feet anchors at `+12`, `+18`, and `+4` offsets. | Contract v2 records the actual ground contacts. |
| Footprints | Adaptable | `footprintCorners()` projects multi-cell diamonds, but gameplay building records are all one-cell centre points and do not declare dimensions. | Validate centre-origin footprints now; require metadata before any multi-cell art. |
| Dimensions | Replace | Old docs name 16 x 16 items, 24 x 24 nodes, 24 x 32 actors, and 48 x 48 buildings; current maps are 12 x 12, 20 x 16, 12 x 18, and at most 28 x 26. | Use contract v2 class canvases. |
| Naming rules | Adaptable | v1 already has family/id/state/frame paths and two-digit frames, but its state names use built/ghost/faulted. | Keep path shape; replace states with blueprint/construction/active/disabled/damaged. |
| Zoom levels | Production-ready | Board fit and user zoom compose through CSS; player zoom is clamped to 0.5 through 2.5; normal approval zoom is 1.0. | Test all three review zooms; approve only at 1.0 first. |
| Canvas / viewport performance | Adaptable | One 940 x 620 canvas redraws on state changes, uses CSS transform zoom, `contain`, and no smoothing. No animation loop currently taxes idle frames. | Record screenshots and timing at normal zoom; benchmark final animated scene before approval. |
| State rendering | Missing | Map rendering distinguishes built/unbuilt mostly by alpha and does not draw engine fault state. No construction or damage sprite states exist. | Commission and integrate all five canonical states after the paid test. |
| Animation playback | Missing | Contract v1 and current board have no sprite clip metadata or playback path. | Validate fixed clips and static-frame fallback before runtime integration. |
| Contact-sheet review | Missing | `/mars/art-spec.html` was intended as proof, but its 220px canvas clipped most of the 33-map registry. | Expand the proof surface and generate the golden contact sheet from the manifest. |
| Visual regression | Missing | Catalog smoke checks telemetry but does not capture both render modes and the art-spec surface as an art review set. | Add deterministic Playwright screenshots and optional PNG comparison. |
| Editable-source approval | Missing | No source-file requirement is enforced. | Strict approval must fail without `.aseprite`, `.kra`, or `.psd`. |

## Asset inventory

No existing runtime map is classified Production-ready as paid final art. They are code-owned fallback/reference pixels and have not passed the DEC-79 artist and golden-scene gates.

| Runtime asset | Source canvas | Classification | Golden-slice relationship |
| --- | ---: | --- | --- |
| `astro` | 12 x 18 | Adaptable | Fallback/reference for astronaut. |
| `iron_ore` | 12 x 10 | Adaptable | Item fallback for common ore. |
| `copper_ore` | 12 x 10 | Adaptable | Later item coverage. |
| `ice` | 12 x 12 | Adaptable | Palette/cluster reference for blue crystal. |
| `iron_bar` | 12 x 8 | Adaptable | Later item coverage. |
| `frame` | 12 x 12 | Adaptable | Infrastructure material reference. |
| `titanium_ore` | 12 x 10 | Adaptable | Later item coverage. |
| `copper_bar` | 12 x 8 | Adaptable | Later item coverage. |
| `titanium_bar` | 12 x 8 | Adaptable | Later item coverage. |
| `part` | 12 x 9 | Adaptable | Alias target for components. |
| `water` | 12 x 10 | Adaptable | Later item coverage. |
| `food` | 12 x 9 | Adaptable | Later item coverage. |
| `fuel` | 12 x 9 | Adaptable | Rover/infrastructure material reference. |
| `bld_habitat` | 26 x 20 | Adaptable | Paid-test building reference. |
| `bld_depot` | 26 x 18 | Adaptable | Storage fallback/reference. |
| `bld_solar` | 28 x 18 | Adaptable | Golden solar fallback/reference. |
| `bld_water` | 18 x 24 | Adaptable | Later core building. |
| `bld_machine` | 26 x 21 | Adaptable | Extractor/fabrication reference. |
| `bld_greenhouse` | 26 x 17 | Adaptable | Later core building. |
| `bld_lab` | 24 x 20 | Adaptable | Later core building. |
| `bld_reactor` | 20 x 26 | Adaptable | Establishes 26px building height envelope. |
| `node_iron_ore` | 20 x 15 | Adaptable | Common-ore fallback/reference. |
| `node_copper_ore` | 20 x 15 | Adaptable | Later resource coverage. |
| `node_titanium_ore` | 20 x 15 | Adaptable | Later resource coverage. |
| `node_iridium_ore` | 20 x 15 | Adaptable | Later resource coverage. |
| `node_ice` | 20 x 16 | Adaptable | Blue-crystal silhouette reference. |
| `node_silicate_ore` | 20 x 16 | Adaptable | Later resource coverage. |
| `node_rare_ore` | 20 x 16 | Adaptable | Later resource coverage. |
| `node_component` | 20 x 14 | Adaptable | Salvage/prop reference. |
| `silicate_ore` | 12 x 10 | Adaptable | Later item coverage. |
| `rare_ore` | 12 x 10 | Adaptable | Later item coverage. |
| `iridium_ore` | 12 x 10 | Adaptable | Later item coverage. |
| `geode` | 12 x 10 | Adaptable | Later item coverage. |
| `mars-terrain.svg` | 192 x 192 | Reference-only | Low-alpha background texture, not a tile export. |

## Missing golden-slice art

All paid production exports and editable sources in `mars/art/golden-slice.json` are currently Missing. This is expected before the artist test. Normal validation warns and demonstrates fallback; strict approval blocks.

Missing categories:

- Five terrain assets.
- Four buildings across required states.
- Astronaut and rover state/animation coverage.
- Four infrastructure assets.
- Blue crystal and common ore production nodes.
- Four props.
- Five effects.
- Four renderer lighting profiles still need golden-scene tuning evidence.

## PR #8 disposition

PR #8 is open, conflicting, and based on `925ef78bcbd2305d1e8b663c91514edf1b6f1a48`. Canonical `gh-pages` started this run at `9eba6e5cdca4aa8fba8ea4ef4328e49c3ee12658` and already contains the Phase 0/1 implementation plus the 33-map board overhaul. Its historical explanation is retained in `ART_ROADMAP.md`; its stale documents must not replace canonical files. Close it as superseded after the DEC-79 commit lands.
