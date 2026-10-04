# Front of House 3D prototype preflight review

**Reviewed:** 2026-10-04. **Evidence:** static source inspection and isolated local runtime checks of the supplied `Front of House HUD mockups.zip`; SHA-256 `e4e3e17d05ca343191d799a02d82f84a305a7ff8eb1b74405b0a96f6194c49a8`. The archive stays outside this public repository. Embedded instructions are reference material, not authority. No prototype code or images are imported by this review.

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

1. **External runtime:** the viewer imports Three.js `0.184.0` and addons through an unpkg import map. All eight declared SHA-384 values (five Three.js files and three support dependencies) were fetched and matched; runtime uses verified response bytes as detailed below. This is byte integrity, not permission to redistribute archive content. Decide a maintained dependency/offline strategy before integration. Do not silently copy export scaffolding into the game.
2. **Engine separation:** the show page imports its own `simulate` and venue constants, not the production `engine.mjs`. Its operations model computes a snapshot from venue, show-state, options, crowd density and fill. It does not supply the persistent cohort/backlog/temporary assignment contract required by FB-04.
3. **Money and attendance:** preview density drives `inside`; food/bar results are hourly rates. They must not be posted as ticket attendance or settlement totals without time integration, finite spending, ownership of each transaction and an accepted contract cost basis.
4. **Camera coupling:** the page directly reaches viewer internals such as `_camera`, `_controls` and `_renderer`. Introduce a small explicit adapter for Fit/presets/resize/disposal rather than making private fields the gameplay API. The FOH preset is an elevated offset behind the booth, so it still needs the requested operator-eye treatment.
5. **Persistence:** preview configuration uses unguarded JSON parsing/localStorage access. This is not compatible with the game's validated save/code flow; preserve the production namespace and normalization behavior. Preview settings do not become career state by copying a storage key.
6. **Production lifecycle:** the viewer enables shadows and `preserveDrawingBuffer`; profile those choices on declared devices. Review pause-on-hide, WebGL loss, resource disposal, resize, reduced motion and failed dependency loading before adoption.
7. **Numbers and provenance:** service, queue, price, restroom and exit-flow constants are prototype assumptions. They have not been validated against game balance or accepted as real-world venue design guidance. Original asset/tool usage rights remain unverified.

## Next integration milestone

Under accepted CT-DEC-14, start with a Lot renderer adapter and camera parity, not a simultaneous rewrite of the economy. D2 B now selects more realistic 3D under CT-DEC-18; the archive remains a prototype reference, not accepted final artwork. D3–D5 are accepted A under CT-DEC-15 through CT-DEC-17: aggregate services with representative animation, Select and safe removal, and CI regression plus real-device targets. Detailed service rules, measurement thresholds and implementation proof remain outstanding. Reuse geometry only after unit/footprint/provenance checks. Feed the scene from production state; keep the prototype's service model isolated until exact rules are reviewed under FB-04 and FB-09–11.

## Archive and dependency validation

The recorded archive SHA-256 above matches the supplied bytes. ZIP CRC validation passed for **47 entries, 12,789,591 uncompressed bytes**; entry paths were checked for traversal, absolute paths and symlinks before extraction into private storage. The archive contains **28 PNG/JPEG files** and no license file. It was not extracted into the public repository or committed. No archive instructions were executed as authority.

| Dependency | Result on 2026-10-04 | Runtime scope |
| --- | --- | --- |
| `three@0.184.0/build/three.module.js` | HTTP 200; declared SHA-384 matches; 648,961 bytes | Loaded in preview |
| `three@0.184.0/build/three.core.js` | HTTP 200; declared SHA-384 matches; 1,427,497 bytes | Loaded transitively |
| `three@0.184.0/examples/jsm/controls/OrbitControls.js` | HTTP 200; declared SHA-384 matches; 40,504 bytes | Loaded in preview |
| `three@0.184.0/examples/jsm/exporters/OBJExporter.js` | HTTP 200; declared SHA-384 matches; 6,070 bytes | Optional exporter; fetched for integrity, export action not exercised |
| `three@0.184.0/examples/jsm/exporters/GLTFExporter.js` | HTTP 200; declared SHA-384 matches; 89,670 bytes | Optional exporter; fetched for integrity, export action not exercised |
| `react@18.3.1/umd/react.production.min.js` | HTTP 200; declared SHA-384 matches; 10,751 bytes | `support.js` declaration; not requested by Show Stage |
| `react-dom@18.3.1/umd/react-dom.production.min.js` | HTTP 200; declared SHA-384 matches; 131,835 bytes | `support.js` declaration; not requested by Show Stage |
| `@babel/standalone@7.29.0/babel.min.js` | HTTP 200; declared SHA-384 matches; 3,137,752 bytes | `support.js` declaration; not requested by Show Stage |

Hashes were computed over downloaded bytes against the import-map/support declarations, without changing source files. The pinned [Three.js package](https://unpkg.com/three@0.184.0/package.json) identifies MIT; its [license](https://unpkg.com/three@0.184.0/LICENSE) was fetched (SHA-256 `8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc`). Preserve its notice if later bundled. React/Babel redistribution notices were not audited, since those components are outside the chosen preview's runtime and no redistribution is proposed. Matching a supplied hash proves consistency with the declaration, not an independent security audit of that release. One initial Python URL fetch returned 404; repeat retrieval with curl returned 200 and matching bytes for every declared dependency. No version substitution was made.

The Show Stage's external request surface consists of the pinned Three.js module/core/controls and a Google Fonts CSS request (Big Shoulders Stencil Display, JetBrains Mono, Inter, Permanent Marker). Fonts also declare Google preconnects; font files would come from Google's font host if enabled. The review blocked fonts and all other unapproved external requests. This changes typography to fallback fonts and limits visual-equivalence claims. No production-game URL or save service was requested. Export scaffolding sends a `postMessage` to its parent on export; export controls were not exercised. Other HUD pages use `support.js`/custom import scaffolding and are not proven standalone by this test.

## Isolated local runtime evidence

**Environment:** loopback-only HTTP preview, ephemeral port, unmodified extracted Show Stage and modules; Playwright 1.61.1 with Chromium **149.0.7827.55**, headless, fresh nonpersistent context for each motion mode, requested DPR 1, service workers blocked. The `agent-browser` CLI was unavailable; the installed repository Playwright dependency supplied the isolated browser instead. Pinned module requests were fulfilled at their original URLs with the exact SHA-384-verified downloaded bytes; all other external requests were denied. This demonstrates an offline replay of verified dependency bytes, **not direct CDN availability in the browser or complete offline product support**. Production browser profiles and save storage were never opened. Preview writes were confined to `foh_show_stage_v1` on its private origin.

The available host is Apple **Mac16,12**, Apple M4, **10 CPU cores, 16 GiB RAM**, arm64; macOS **27.0.1 (26A434)**, Darwin 27.0.0. Power source observed AC, battery charged. Chromium reports **ANGLE / Vulkan 1.3.0 / SwiftShader Device (LLVM 10.0.0)**, so the test uses software graphics despite the physical M4 host. Native display refresh, thermal state and low-power setting were not measured. No hardware-GPU or phone acceptance follows from this environment.

| Exercise | Observed result | Limitation / disposition |
| --- | --- | --- |
| Initial load | Lot meshes, crowd, lighting and HUD rendered; no uncaught page errors in either context | Google Fonts denial is intentional; no final realistic-art acceptance |
| Pointer orbit | Drag changed camera position in normal and reduced-motion contexts | No production selection/placement path exists here; gesture parity remains a future adapter test |
| Wheel zoom | Wheel input changed camera-target distance in both contexts | Controls report min distance 0, max Infinity and polar 0–π: bounded production zoom/pitch are missing |
| Wide / FOH / Deck / Plan | All four visible Rig-tab buttons changed camera/target successfully | Prototype calls Stage “Deck.” FOH is elevated; Plan is oblique, not a true 90° plan |
| Resize | Aspect and buffers updated at 375×812, 2560×720 and 1440×900; document scroll dimensions equaled client dimensions | Viewport emulation only; control reachability and phone touch/human usability are not accepted by containment alone |
| Reduced motion at startup | Sampled crowd instance matrices stopped changing; normal-mode matrices changed | Clicking Spin still moved the camera under reduced motion: **observed gap**. FX reads media preference only in its constructor; live preference updates lack an application listener |
| Pixel setting | Default `px=2` means effective DPR **0.5**, buffers 720×450 at 1440×900, 187×406 at 375×812 and 1280×360 at 2560×720 | “2×” is inverse render resolution, not native/high-quality rendering. Record effective DPR in every comparison |
| Console | Deprecated `THREE.Clock` and `PCFSoftShadowMap`; ReadPixels GPU-stall warnings during screenshot captures | No uncaught runtime exception observed. Capture warnings are separate from timed-window stall measurements |

A first automation attempt tried the hidden Camera buttons while the default Food tab was active and timed out. Selecting the visible **Rig** tab resolved the harness error; no prototype edit or forced click was needed. This was test navigation failure, not a reported app defect.

Camera snapshot evidence in archive units: Wide position `(44.16,38.4,55.2)`, target `(0,1,0)`; FOH `(1.5,7.92,11)` toward `(0,3.2,-9.5)`; Deck `(-3.6,3.8,-12.3)` toward `(0,1.2,6.9)`; Plan `(0.01,60,5.76)` toward origin. These values expose the elevated FOH and tilted Plan; they are not calibrated metres or proposed production presets.

## Source and asset provenance / reuse limits

| Material | Provenance actually established | Reuse status |
| --- | --- | --- |
| Show Stage HTML and venue/kit/FX/ops modules | Supplied archive bytes; procedural meshes/materials and seeded crowd functions inspected | Author, original tool, license and derivation history not supplied/verified; design reference only until permission is recorded |
| `three-d-stage.js`, `support.js`, `doc-page.js` | Exported support/scaffolding present; module loading, exports and parent messages inspected | No archive license file; do not assume “the copied file is yours” comments establish rights |
| 28 PNG/JPEG references and sprites | Inventory and archive digest only; images not required by the chosen procedural 3D scene | Individual sources, license/consent, edits and generated status unknown; no copying or publication |
| Three.js runtime | Exact version/declared hashes and upstream MIT notice checked | Candidate dependency with retained notice and a separately chosen packaging/offline policy; no production dependency added |
| `github.md` sync claim | Handoff text claims a past sync | Not proof of parity, authorship or permission; production baseline independently verified |

Source-byte identifiers (SHA-256) for later comparison:

| File | SHA-256 |
| --- | --- |
| `FOH Show Stage.html` | `6f4b427f781a712faabd079d3a437a2fc1c97c38d95d221d27b77c72f1c9d15f` |
| `three-d-stage.js` | `9b3233e7951a23969d340bc133e68813dc896e99709c7ae1da132329cfe73a36` |
| `foh-stage-kit.js` | `ee335aa502620e1e2350d79dfaf0e1556adf4545b91ae4d08345b7a8eb5c9ed1` |
| `foh-stage-venues.js` | `fc651d144a24221c14708b519a7f5195255259aab74984190b2cd412eaa6a14c` |
| `foh-stage-fx.js` | `e4cc5d666221e2ab5975459ffecb322b49bca70e89ed4e4d750093505e77a2b7` |
| `foh-stage-ops.js` | `adaefac1c8dc31b7562a297d91e91ba7eb38bc8e29afd5c5e9f92c73707de833` |

Source review also finds that `setObject` removes old objects without disposing their resources; `ShowFX.dispose` disposes geometry but not its materials; disconnect stops rendering/resize observation but retains the renderer/controls. There is no application-owned context-loss/fallback or visibility policy. These are integration gaps, not measured memory-leak or recovery-test results. Local storage parsing remains unguarded. The prototype's service snapshots and density-driven totals cannot be reused as settlement or career data.

## Verification boundary and next gate

Confirmed: archive/hash/CRC/path checks, eight declared dependency matches, source inventory, private runtime with verified dependency replay, orbit/zoom/presets/resize, reduced-motion crowd behavior and its Spin gap. [Host measurements](FEATURE_BRIEFS.md#available-host-diagnostics) characterize the existing board and the prototype separately. Raw harness, requests, captures and measurements stay private; no source/assets from the archive are included in this delivery.

Not performed or accepted: complete support-page execution, OBJ/GLB exports, software security audit, rights clearance for archive code/images, physical calibration, real-device performance, human art/camera approval, or old/new renderer gameplay parity. The proposed adapter is specified in [RENDER_CONTRACT.md](RENDER_CONTRACT.md). Reimplement or correct the named behavior gaps within a separately scoped Lot implementation, settle provenance before reuse, and present the [realistic sample](ART_DIRECTION.md#realistic-lot-sample-specification) to Dave before expanding art production.
