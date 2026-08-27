# Changelog

All notable changes to the MixMash Studio site (`gh-pages` branch, served at mixmash.games).

## [Unreleased]

- **MarsScape DEC-79 art contract:** locked renderer-native isometric pixel art, elevated procedural fallback, paid artist test, golden scene, and approval-before-scale production order.
- **Renderer-derived art bible:** render contract v3 now owns sprite-class canvases and offsets, four executable lighting profiles, palette, five states, 600ms-derived animation timing, export/source requirements, zoom range, accessibility thresholds, and a 300-frame performance gate.
- **Commissioned-art runtime:** added generated valid-assets-only index v2 and a fetch/Blob/`ImageBitmap` cache with exact served-PNG SHA-256 verification before decode, independently recomputed browser-side manifest/runtime identity, dimension defense, state ladders, reduced motion, broken-clip frame-01 safety, per-index-generation persistent-failure suppression, warning-once telemetry, and commissioned → code-owned → procedural fallback on the playable board. Approval primes every exact scoped indexed frame and requires a receipt-bound census with zero pending, missing, or failed frames, so a hidden animation-frame failure cannot earn coverage.
- **Golden-scene review:** added the deterministic eight-beat mission sequence and responsive in-renderer review surface for every golden asset, state, effect, lighting profile, anchor, footprint, zoom, render mode, and performance condition. The package- and ten-file-review-surface-bound v3 ledger requires all 24 canonical beat/zoom/lighting tuples, all four lighting profiles, procedural fallback, reduced motion, and 300 commissioned 1.0x performance samples before 1.0x human checks can unlock an exportable v3 receipt; current approval remains blocked until real deliverables exist.
- **Approval accessibility hardening:** eliminated per-frame live-region churn, exposed every blocking requirement, bound human attestations to the exact commissioned 1.0x package/view context and seven immutable checklist IDs, made paid-test controls and labels scope-aware, restored logical skip-link/navigation focus order, and raised interactive boundaries to the art bible's 3:1 contrast floor. Temporary synthetic packages now browser-test byte-integrity rejection, DOM tamper rejection, review-surface invalidation, client integrity-digest verification, and reload behavior without creating production-art evidence. Canonical approval still requires the exported receipt plus external Git/review identity.
- **Asset validation pipeline:** added filename, PNG dimension/alpha/chunk integrity, anchor, footprint, animation, missing-asset, symlink containment, structurally validated layered Aseprite/Krita/PSD sources, bounded per-file and cumulative decoding, full render-metadata and frame-byte runtime identity, deterministic byte-bound strict reports, contact-sheet, and Playwright visual-regression checks. Malformed, corrupt, escaped, or renamed files fail closed and cannot contribute an approval digest, while metadata-only runtime drift invalidates prior receipts. Paid-test approval is correctly scoped to four assets/eight exports; full-golden approval remains a separate 108-export gate.
- **Art proof corrections:** the boot cache count now derives from the 33-map registry, and `/mars/art-spec.html` displays all 33 cached maps instead of clipping after two rows.

## 2026-07-07 — EMPIRES replaced with the real aoe2-clone build
- **`/empires/` replaced entirely**: the page was serving `aoe2-clone`'s very first prototype (a bare TypeScript/Canvas villager-auto-gather demo from April 2026). It's now a WebAssembly build of the actual current game — 7 civilizations, combat, AI opponent, sprite-capable rendering — compiled via a new Emscripten target added to the `aoe2-clone` CMake project.
- **Local skirmish only in the browser.** `aoe2-clone`'s LAN/internet multiplayer (raw TCP/UDP sockets, a subprocess-spawned headless-runner) has no browser equivalent; the web build compiles `NetworkSession` down to a stub that reports unavailable. Multiplayer still works in the native SDL3 desktop build.
- Page chrome simplified to match the hub's `/garden/`-style embed pattern (a `back-pill` link, full-bleed canvas) since the game now draws its own HUD/menus on the canvas — the old page's HTML-side resource bar and build buttons belonged to the retired prototype.
- **Fixed same day — load feedback and engagement:** the ~1.2MB wasm download had no real progress indicator (Emscripten's default hooks only report dependency counts, not bytes), so it looked hung. `assets/shell.js` now fetches the wasm itself via `Module.instantiateWasm` with a byte-level reader, driving a real progress bar. Separately, the lobby's "START GAME" bar is drawn on the canvas by the game itself and was never a real clickable element — only the SPACE key works, which isn't discoverable on the web. Added a real DOM "Click or press SPACE to start" button that dispatches a synthetic Space `KeyboardEvent` (SDL's Emscripten backend listens on `window`, not the canvas, so this reaches it fine); it hides itself once the player has engaged by any means.

## 2026-07-06 — MarsScape rebuilt as a server-authoritative app
- **`/mars/` replaced entirely**: the generated single-file page is gone. New: canvas-backed isometric client (`mars/game.js`, `mars/styles.css`), shared engine (`mars/engine.mjs`), a Node/SQLite authority server for local dev (`mars/server.mjs`), and a production authority API on Vercel (`api/*.mjs`, project `mixmash-marsscape-authority`, private Blob storage).
- **Trust model changed:** the server is now authoritative for game state — submitted client resource totals are ignored, sessions always start from server-created state, and gameplay actions are applied as signed commands (`gather`, `build`, `smelt`, `craft`, `research`, `startStorm`).
- **Added:** HMAC-signed local offline-mode saves (WebCrypto/IndexedDB) with tamper rejection, replayed once the authority API returns; an asset preload manifest/gate for terrain and settlement art.
- **Added:** `mars/test-engine.mjs`, `mars/test-api.mjs`, `mars/test-vercel-handler.mjs`; root `npm test` migrated from Vitest to Node's built-in test runner and now covers both the fighter's combat math and the new MarsScape engine/API.
- **Hardened same day:** fighter resume/snapshot logic in `play/index.html` (`test/play-resume-smoke.mjs` added), MarsScape's asset-manifest paths, and the GitHub Pages artifact (moved `mars/.gitignore` rules to the repo root so build output isn't accidentally excluded from Pages).
- This diverges `/mars/` from the `marsscape` GitHub repo, which remains an independent single-file-build project. The two are **not currently reconciled** — see the README's "MarsScape's architecture" section before touching either.

## 2026-07-03 — MarsScape refreshed to v0.4.0
- `/mars/` snapshot updated to "Beyond the Basin": region framework, world map, Piloting skill, Dune Sea. See [marsscape's own changelog](https://github.com/DaveHomeAssist/marsscape/blob/main/CHANGELOG.md) for detail.

## 2026-07-03 — MIXMASH Phase 1: stability, tests, SEO
- **Fixed:** NaN knockback bug — `src/combat.js` extracted as the canonical, hardened `calcKnockback`/`finite()` module; guarded at both hit sites in `play/index.html` (`checkHits`, `executeThrow`), plus screen-shake and a camera self-heal so a stray NaN can't stick in the entity pool. Formula unchanged for valid inputs.
- **Added:** first-ever test harness for the repo — `test/combat.test.js` (17 tests, 10 degenerate/NaN cases) and `.github/workflows/ci.yml`, path-filtered to `src/`/`test/`/`package*.json` so content-only pushes don't trigger it.
- **Added:** SEO layer — `assets/og-card.png` (1200×630 brand card), `og:image`/`twitter:card` meta on the homepage/`/play/`/`home.html`, `robots.txt`, `sitemap.xml` (6 URLs).
- **Added:** `ROADMAP.md` — production roadmap for the MIXMASH fighter (3 phases, DoD/checkpoints/verification standards per phase), including a "reality check" section correcting the original draft against the actual `play/index.html` build.
- CNAME cycled during the mixmash.games domain-binding process (see the DNS/cert incident in the studio's ops history) — `git pull --ff-only` before local work on `gh-pages`.

## 2026-07-03 — MixMash Studio hub consolidation
- Restructured the repo from a single-game Pages site into the studio hub: new homepage (`index.html`/`home.html`, Mainstage Neons brand tokens), `/play/` (the fighter, moved from repo root), `/mars/` (MarsScape snapshot), `/empires/` (now Age of Dave), `/garden/` (Garden OS story-mode iframe).
- Replaced the old `/empires/` Vite RTS prototype with the Age of Dave route: a static launcher/status surface backed by the real private `DaveHomeAssist/aoe2-clone` C++/SDL alpha and its verified sprite atlases.
- Custom domain `mixmash.games` bound; HTTPS enforced once the cert issued.
- Favicon added (`favicon.svg`) as part of a favicon audit remediation pass (2026-06-20, prior to the hub restructure).

## 2026-04-04 — BPM Delay Calculator moved out
- Removed from this Pages site; relocated to its own repo (`bpm-delay-calculator`).

## 2026-04-02 — Initial GitHub Pages site
- First publish of the site (single game, pre-studio-hub).
