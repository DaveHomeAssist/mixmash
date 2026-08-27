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
| Sprite registry | Adaptable | `sprites.mjs` contains 33 consistent pixel maps, aliases, DOM SVG output, sheet registration, and emoji fallback. The commissioned runtime now sits ahead of this registry. | Keep the maps as fallback/reference while real approved PNGs remain absent. |
| Asset-loading path | Production-ready | `commissioned-art.mjs` loads a generated index containing only valid present PNGs, fetches Blob data, decodes and caches `ImageBitmap`, and rejects contract/dimension drift. The playable board tries commissioned art before code-owned and procedural fallbacks. | Keep the generated index synchronized with `npm run art:index`; artist files remain separately gated. |
| Terrain | Adaptable | Canvas draws a shared regolith surface, 121 inset faces, NW edge light, rocks, rim, and SVG texture. | Keep fallback. Replace visual coverage with the five golden terrain assets after approval. |
| Buildings | Adaptable | All eight building IDs have code-owned and procedural models. Commissioned habitat, storage, and solar-array lookups use bottom-centre at `+18px`, resolve the five-state ladder, and retain non-color-only state markers through fallback. | Keep fallback. Add and approve the canonical commissioned state exports. |
| Resource nodes | Adaptable | Eight board outcrop maps cover current resource families; commissioned blue-crystal/common-ore lookups use bottom-centre at `+12px`, and procedural geometry remains. | Keep fallback until the two resource exports pass in-renderer review. |
| Item icons | Adaptable | 17 of 27 canonical item IDs resolve to a map through direct IDs or aliases; the rest use emoji. | Keep fallback. Replace emoji coverage after golden approval. |
| Pixel Art toggle | Production-ready | `marsscape.pixelMode.v1` persists independently; board telemetry proves pixel/procedural mode; off mode retains gameplay. | Keep and include in every regression pass. |
| Procedural fallback | Production-ready | Terrain, nodes, buildings, and astronaut draw without sprites; inventory uses emoji. Commissioned misses warn once and fall through code-owned sprites before procedural drawing. | Keep as a release-safety layer and retain its visual-regression coverage. |
| ImageBitmap caching | Production-ready | `SpriteBitmapCache` deduplicates pending work, stores decoded bitmaps, disables smoothing, and draws at fixed scale. | Preserve on slow decode and external-asset integration. |
| Anchors | Production-ready | Contract v3 gives every sprite class an executable normalized anchor and screen offset; runtime index loading rejects mismatches. | Review visible ground contact in the golden scene before human approval. |
| Footprints | Production-ready | `footprintCornersFromCenter()` drives correctly sized contact-sheet and golden-scene overlays from manifest width/depth metadata. | Any visual mismatch still blocks human approval. |
| Dimensions | Production-ready | Contract v3 owns every class canvas; both build-time PNG decoding and runtime bitmap decoding reject actual dimensions that differ. | Re-export invalid art; never scale or crop it at load. |
| Naming rules | Production-ready | The validator enforces lowercase snake_case family/id, canonical state, and two-digit one-based frame paths. | Keep the generated index as the only network-discovery surface. |
| Zoom levels | Production-ready | Board fit and user zoom compose through CSS; player zoom is clamped to 0.5 through 2.5; normal approval zoom is 1.0. | Test all three review zooms; approve only at 1.0 first. |
| Canvas / viewport performance | Production-ready | The golden scene uses the same 940 x 620 canvas and contract geometry, exposes 0.5, 1.0, and 2.5 review zooms, and checks a 60-frame warm-up plus 300-frame p95/drop benchmark at the required 1.0 approval zoom. | Repeat with the complete animated commissioned set before approval. |
| State rendering | Adaptable | The runtime consumes all five commissioned states and applies renderer-owned blueprint/disabled/damaged markers through the fallback ladder. Final state silhouettes are absent because commissioned exports are absent. | Paid art must prove non-color-only distinctions at gameplay zoom. |
| Animation playback | Production-ready | Indexed clips use contract cadence, loop/clamp rules, reduced-motion frame `01`, and broken-clip static `f01`; gameplay timing never waits on a clip. | Benchmark complete clips in the golden scene. |
| Contact-sheet review | Production-ready | The generated 26-card sheet uses each declared footprint and the class's real ground offset instead of a universal 1 x 1 centred diamond. | Regenerate after manifest or export changes. |
| Visual regression | Production-ready | Playwright captures both game modes, art spec, contact sheet, every golden beat, lighting/state evidence, and runtime telemetry; an approved image baseline does not yet exist. | Establish the baseline only after human golden approval. |
| Editable-source approval | Production-ready | Paid-test and full-golden strict scopes fail closed unless `.aseprite`, `.kra`, or `.psd` sources have valid native structure, matching class canvases, and pixel-bearing editable layers. Renamed, flattened, malformed, or unsupported files do not earn an approval digest. | Keep source approval distinct from PNG runtime readiness. |
| Approval evidence | Production-ready | Deterministic per-scope strict reports SHA-256 every valid PNG and editable source and expose a fail-closed `machineReady` result. Runtime index v2 binds every frame to its exact PNG bytes; `marsscape-runtime-assets/v2` binds the complete ordered render metadata so metadata-only drift invalidates receipts. Approval primes and requires all exact scoped frames cached with zero pending/missing/failed entries, and binds that census into the receipt. The full-golden v3 receipt additionally binds the package and deployed review-surface digest to a v3 ledger of all 24 canonical beat/zoom/lighting tuples, four 1.0x lighting profiles, 1.0x procedural fallback, 1.0x commissioned reduced motion, 300 commissioned animated 1.0x samples, and all seven immutable human checks. The paid-test v3 receipt retains its focused v2 commissioned 1.0x matrix and functional-animation ledger. | Treat the client digest as integrity evidence, not authentication. Add the exported receipt plus external Git/review identity to the canonical repo decision record before production scaling. |

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

All paid production exports and editable sources in `mars/art/golden-slice.json` are currently **Missing**. This is expected before the artist test. Normal validation warns and demonstrates fallback; strict approval blocks. Every asset below is individually classified with one of this audit's five allowed labels; grouped rows do not imply partial availability.

| Commissioned asset family | Assets | Classification | Current evidence |
| --- | --- | --- | --- |
| Terrain | `base_soil`, `rocky_soil`, `edge`, `cliff_slope`, `disturbed_ground` | Missing | 0 of 5 source files and all declared PNG exports are absent. |
| Buildings | `habitat`, `solar_array`, `extractor`, `storage` | Missing | 0 of 4 source files and every required state export are absent. |
| Units | `astronaut`, `rover` | Missing | 0 of 2 source files and every state/animation export are absent. |
| Infrastructure | `pipe`, `power_cable`, `junction`, `path_light` | Missing | 0 of 4 source files and every required state export are absent. |
| Resources | `blue_crystal`, `common_ore` | Missing | 0 of 2 source files and every declared export are absent. |
| Props | `crate`, `beacon`, `antenna`, `debris` | Missing | 0 of 4 source files and every declared export are absent. |
| Effects | `dust`, `selection`, `power_glow`, `warning`, `repair` | Missing | 0 of 5 source files and every animation export are absent. |

The four renderer-owned lighting profiles are **Production-ready** as executable profiles. Their final interaction with commissioned silhouettes is unverified until the missing art exists, so human golden-scene approval remains blocked.

## PR #8 disposition

PR #8 was closed without merge as superseded. It was conflicting and based on `925ef78bcbd2305d1e8b663c91514edf1b6f1a48`; canonical `gh-pages` started this run at `9eba6e5cdca4aa8fba8ea4ef4328e49c3ee12658` and already contained the Phase 0/1 implementation plus the 33-map board overhaul. Its useful historical explanation is retained in `ART_ROADMAP.md`; its stale documents were not copied over canonical files.
