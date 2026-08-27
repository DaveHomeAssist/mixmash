Original prompt: Audit targets MarsScape (mixmash.games/mars) with client authority, localStorage persistence, race condition, render performance, input gating, asset loading, and accessibility findings.

2026-07-06:
- Located the live source at `/Users/daverobertson/Desktop/Code/10-projects/active/mixmash/mars` on the `gh-pages` branch, then replaced the generated single-file page with a clean multi-file app: `index.html`, `styles.css`, `game.js`, shared `engine.mjs`, `server.mjs`, assets, and tests.
- Added SQLite-backed local server-authoritative sessions and command endpoints. The Vercel deployment uses private Blob storage with per-session command locks. The client sends commands when online and queues offline commands for replay.
- Changed session creation so submitted client resource totals are ignored; new canonical sessions always start from server-created state.
- Added local save-envelope HMAC verification through WebCrypto/IndexedDB so manual offline `localStorage` edits are rejected before restore.
- Rebuilt the presentation as a canvas-backed isometric MMO-style Mars colony board with semantic overlay buttons for accessible interaction.
- Added an asset preload manifest and preload gate for the terrain and settlement assets.
- Wired root `npm test` to run existing fighter Vitest coverage plus MarsScape engine/API tests.
- Added the `mixmash-marsscape-authority` Vercel project and private `marsscape-authority-prod2` Blob store for the production API.
- Replaced the hanging local Vercel Blob SDK import path with direct authenticated Blob HTTP calls and removed the runtime package dependency.
- Converted the existing combat Vitest coverage to Node's built-in test runner after Vitest stalled locally before executing the pure test file.
- Verified `npm test`, `npm run vercel-build`, `git diff --check`, local SQLite API smoke, local Blob API smoke, web-game Playwright screenshot/state capture, desktop/mobile gather smokes, keyboard tab navigation, and tampered offline save rejection before the Vercel deploy pass.

TODO:
- Deploy the Vercel authority API, point the live GitHub Pages client at it, and rerun live end-to-end QA.

2026-08-24 (port wave 0 — preservation):
- Cloned the standalone `marsscape` gameplay repo and measured the real gap: the engine
  holds 73 of 144 MarsScape data features and 0 of 23 behavioural systems.
- Froze `marsscape@ab073bc` `src/data.js` as `mars/parity/baseline/data.js` with a
  checksum and both known-good SHAs, so parity stays reproducible without that repo.
- Added `mars/parity/mapping.json`: explicit id correspondence (the two codebases use
  different id conventions) plus a disposition for all 71 unported features.
- Added `mars/parity/build-ledger.mjs` + generated `LEDGER.md`, and `parity.test.mjs`
  wired into `npm test` (57 pass; the 50 pre-existing tests stay green).
- Recorded the save-migration field map and the 97-test MarsScape contract as cutover gates.
- Largest single divergence found: the engine reaches level 99 at 240,100 xp against
  MarsScape's 13,034,431 — a 54x compression of the whole progression arc (wave 1).

TODO:
- Wave 1 (Foundations): RuneScape XP curve, 600 ms tick, 60-second sols, balance simulator.

2026-08-24 (port waves 1-8 — complete):
- Ported every remaining MarsScape feature into the server-authoritative engine.
  Data parity 144/144, behaviour parity 23/23, zero retirements.
- Engine v4: RuneScape XP curve (99 = 13,034,431), 600 ms tick, 100-tick sols,
  27 items, 10 skills, 17 nodes, 8 buildings, 6 smelt + 37 craft recipes,
  20 research projects in 3 gated tiers, 5 crops on plots, 14 objectives.
- Colony Depot, slot-based pack, drones, building tiers I-III, overclock + faults,
  crop blight, Great Storm parity, victory into New Expedition+, expedition treks.
- Added the balance simulator (5/5 verdicts PASS, Mining 99 in 31.6 focused hours —
  the same figure the source recorded), the sprite module with emoji fallback, the
  player manual, and the legacy `marsscape_v1` save importer with a preview step,
  quarantine reporting and rollback.
- Authority now paces actions (gatherTicks/smeltTicks): before this, gather was
  limited only by node charges, so a client could spam it.
- npm test 71 pass; npm run sim exits 0; both wired into CI.

TODO:
- None outstanding for the port. `marsscape` may now be marked legacy.

2026-08-24 (render contract and canvas sprite pipeline):
- Authorized prompt: implement the engineering-only art roadmap phases 0 and 1 before generating new art.
- Locked the shipped 2:1 dimetric projection: 42×21 axis steps, 84×42 logical tile, 66×34 drawn terrain face, northwest light, tile-centre prop anchors, and feet actor anchors.
- Added the measured `/mars/art-spec.html` handoff page, canonical render-contract module, updated art-direction document, and versioned art roadmap.
- Added a 13-sprite ImageBitmap cache and `drawSprite()` seam for the canvas board. Supported node and actor sprites use it; missing or disabled sprites retain the procedural renderer.
- Added the persisted Pixel Art control and kept emoji item fallback. Removed the unused `settlement-atlas.svg` preload and manifest entry.
- Fixed the documented local authority server so it serves the shared MixMash navigation, PWA script, manifest, worker, and offline shell with correct MIME types instead of returning the Mars HTML fallback.

TODO:
- Phase 2 remains intentionally blocked on Dave's visual acceptance of the six final anchor sprites.

2026-08-25 (board art overhaul):
- Dave asked for the board to stop looking hand-scribbled, which authorized visual work.
- Authored 20 new pixel maps in the locked palette (extended with greenhouse green, gold,
  rare-earth purple, panel teal, window glass, iridium violet, suit shadow): all 8 buildings
  (`bld_*` namespace — building id `water` collided with the water item sprite), 8 node
  outcrops (`node_*`), 4 late-ore item icons, and a redrawn astronaut. 33 sprites total.
- Root cause of the old look: the DOM `.map-piece` buttons painted their own CSS clip-path
  and gradient models OVER the canvas, and `.player-marker` drew a CSS capsule over the
  astro sprite. The DOM overlay is now interaction-only (hit target, label, charge bar);
  the canvas is the single art surface, procedural fallback intact (Pixel Art off:
  23 procedural, 0 sprites; on: 23 sprites, 0 procedural).
- Terrain: close-toned tile fills with a NW edge light replace the checkerboard fills and
  random bright strokes; a base regolith surface polygon under the inset tile faces kills
  the black seam lattice; backdrop pattern alpha 0.14 -> 0.07; `image-rendering: pixelated`
  on the board canvas so player zoom stays crisp; map-piece inset-sheen box-shadow removed.
- Tests updated for the 33-sprite registry and the 12x18 astronaut; all suites pass.

TODO:
- Dave to accept or reject the new set as the Phase 2 style bar on the live board.

2026-08-27 (DEC-79 art contract and validation pipeline):
- Recorded canonical start-of-run SHA `9eba6e5cdca4aa8fba8ea4ef4328e49c3ee12658`; remote default branch and local authority both confirmed as `DaveHomeAssist/mixmash:gh-pages` before the first write.
- Audited the renderer, all 33 runtime pixel maps, terrain texture, loading path, Pixel Art toggle, procedural/emoji fallback, ImageBitmap cache, anchors, footprints, dimensions, naming, zoom, and canvas/viewport behavior in `docs/ART_AUDIT.md`.
- Accepted DEC-79 in the repo decision log: isometric pixel art on the board, procedural safety fallback, renderer-native golden slice, paid artist test, and no bulk production before in-game approval.
- Bumped the render contract to v2 with measured class canvases, ground-contact offsets, five canonical states, 600ms-derived animation timing, export/source rules, and accessibility thresholds.
- Replaced stale art docs with the renderer-derived art bible and golden-slice/artist-test gates; preserved useful PR #8 rationale without copying its obsolete 13-sprite and missing-pipeline claims.
- Added the machine-readable golden slice and validators for filenames, PNG dimensions/alpha, anchors, footprints, clips, missing exports, editable sources, contact sheets, screenshot capture, and optional visual baseline comparison.
- Corrected two stale production surfaces: the boot cache total now derives from the registry, and the art-spec proof canvas displays all 33 maps instead of clipping after two rows.
- Verified 104 unit/contract tests, the production build, balance simulation, play and 27-check catalog browser smokes, normal-mode art validation, and renderer screenshots at normal gameplay zoom.
- Generated and inspected the 26-asset contact sheet with 108 expected exports, anchor marks, footprint overlays, state coverage, and procedural fallbacks.
- Confirmed the strict approval gate fails closed with 108 missing commissioned exports and zero editable sources; no paid-art or golden-scene approval is claimed.

TODO:
- Commission the paid artist test package, add renderer-ready exports plus editable sources, and run `npm run art:approve`.
- Review the complete golden scene inside MarsScape at normal gameplay zoom; approve or revise DEC-79 before production scaling.
