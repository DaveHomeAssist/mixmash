Original prompt: Implement the verified MixMash count correction on gh-pages. Update every stale public count string identified in this report to the 14-fighter, 11-arena shipped truth; preserve the already-correct /play/ metadata and body copy; and label the six fighter cards and four stage cards in home.html and brand.html as featured subsets rather than complete rosters. Make no unrelated design changes and perform no Notion writes. Run the existing play and catalog smoke tests, review the diff, commit, push, verify origin/gh-pages, and live-read back every corrected location.

## Progress

- Confirmed the canonical clean checkout is `DaveHomeAssist/mixmash` on `gh-pages`, matching `origin/gh-pages` at `9eb99a6` before editing.
- Confirmed the shipped `/play/` source and live selectors expose 14 fighters and 11 arenas.
- Corrected stale public totals in `index.html`, `home.html`, and `brand.html`; preserved the already-correct `/play/` copy.
- Labeled the six fighter cards and four arena cards in `home.html` and `brand.html` as featured subsets.
- Passed `npm run smoke:play` and all 35 checks in `npm run smoke:catalog`.
- Verified the changed local surfaces with Playwright and visually inspected the landing, home, brand, and character-select screenshots.

## TODOs

- No implementation TODOs remain for this scoped correction.

## Landing polish — September 4, 2026

- Preserved the neon tokens, typefaces, static hosting, and 14-fighter / 11-arena truth.
- Added a full-width MIXMASH feature, a balanced four-game grid, and optimized real gameplay previews with capture provenance.
- Reworked mobile navigation into two unclipped rows with 44px targets; stretched native Play links across card primary areas while preserving secondary links.
- Standardized release labels and Play actions, marked external destinations, rewrote Age of Dave for players, and added a closing play/feedback section.
- Raised muted-text contrast and authored focus-visible states; retained interaction-only decorative motion and disabled it for reduced-motion users.
- Added `smoke:landing` to CI and documented local/live execution. The rail passed at 320, 390, 768, 1024, and 1440px with pointer/touch hit testing, keyboard order and activation, focus visibility, reduced motion, image budgets, and contrast checks.
- Inspected local fold/full-page screenshots. `npm test` passed 160/160; `npm run vercel-build`, `npm run smoke:play`, and all 35 `npm run smoke:catalog` checks passed.
- No gameplay runtime files, home/brand roster copy, dependencies, or Notion records changed.

## Admin index — October 1, 2026

- Added `/admin/`, a `noindex` index of every tracked file and reference for all nine projects (eight games plus the studio hub), destination mixmash.games/admin.
- `admin/build-catalog.mjs` generates `admin/catalog.json` from `git ls-files` plus `admin/catalog-sources.mjs`; titles and summaries come from each file's heading, title or leading comment, with notes for files that do not describe themselves.
- Status is not copied into the page; each game lists the files where its status is recorded.
- Added `test/admin-catalog.test.mjs` to `npm test` (coverage, classification, references, privacy) and `smoke:admin` to CI (six widths, no page scroll, themes, keyboard tabs, filters, deep links, search, copy, contrast).

## Front of House Advisory desk · 2026-10-09

Dave authorized the existing FOH-U05 brief through the project controller. Base ad039109; additive presentation-only read model and explicit Overview/Ticketing/Talent/Operations window implemented. Independent PR141 engine/save QA ownership is preserved. Duncan is the isolated command/browser runner; no sustained Dominic load or heavy Mac fallback. Verification and delivery are in progress; initial unit pass found a missing-result Talent row that was corrected before rerun.

## PA equipment presentation — 2026-10-17

User request: Implement the PA rig and equipment menu cards using equipment models; keep game rules and saves intact and provide screenshots. Scoped brief added; isolated from concurrent work. Verification pending.

- Dominic: targeted PA/ownership/integration tests (16), seven existing equipment journeys and eight light/dark viewport cases passed. Preview framing corrected after visual inspection. Rules/data/save files unchanged. CI and deployment pending.

- Full runner suite: 471 passed; one admin test-file failure was Docker Git ownership, with all six admin tests passing on rerun as the checkout owner. Build and manifest passed. Warmed-cache offline reload preserves exact owned/assigned save and loads 3D/cards. Short landscape PA inspection now compacts; optional illustration yields below 300px height. PR168 opened; release checks pending.

- CI19dc1f9 found a Lot picking probe using the former PA artwork height. Added a non-rendering rig envelope so the central gap remains selectable, and derived the roof probe from measured asset bounds. Dedicated raycast unit and Lot backend smoke now pass; complete 3D/venue checks and refreshed CI follow. No engine or save changes.

## 2026-10-17 PA equipment release closure

PR168 final4945433 passed required CI39057828540 and merged8b5ae09. Pages built the merge at18:59:06Z. Thirteen hosted files match; Dominic passed eight live light/dark card cases with unchanged state/reload and inspection sizes down320x256. PA models/cards are presentation-only; rules and saves unchanged. Concurrent PR169 ECP guidance preserved and reconciled. Private board unavailable; human/device/calibration acceptance remains open.

## 2026-10-17 lighting equipment slice

User requested lighting rigs and equipment cards with unchanged rules/saves and screenshots. Added source-derived J-Six/Vertigo exteriors and shared Lighting preview/page. Verification and delivery pending. No engine/data/save/ownership changes.

Lighting review follow-up: combined house+tower status and visible Menu focus restored. CI exposed Lighting tab text clipping at320px; scoped narrow Equipment tab typography/padding now fits with44px targets. Expanded browser regression covers compact pages and button bounds; release checks rerunning.

Linux CI retained a60px Lighting label in a54px button at320px. Shortened the equipment tab to Lights (same Build vocabulary), preserving card title and44px targets; Windows browser pass alone was insufficient for Linux font fit.

## 2026-10-17 lighting release closure

- PR171 source3990130 merged1bcc10a after general CI39075354548 and paired CI39073920410 attempt2. Both paired raw36-window artifacts independently audited; first CPU rejection8.7ms/8.1ms retained, unchanged retry passes. WebKit ticketing timeout retained; full unchanged general retry passes.
- Pages built23:08:44Z; Walter verifies15 live byte matches, eight light/dark lighting cases, exact reload, keyboard/focus, compact/ultrawide paging and screenshot captures. Final source also passes warmed-cache offline state/model/preview.
- Rules, engine, economy, save schema2 and shared service worker/cachev83 unchanged. Public next-steps record reconciled; existing private board refreshed separately. Human/physical/calibration acceptance remains open.

## 2026-10-17 stage and site cards

- User requested stages and remaining equipment cards using equipment models, with rules/saves intact and screenshots. Reuse twelve existing FOH equipment models; producer catalog has no separate stage/site assets. Runtime geometry unchanged. Added inert single-card catalog, matching Build and inspection previews.
- Dominic cached Playwright1.61.1 selected after1.64 image lacked pinned browser. Short-screen hidden-atom rules extended to the new catalog; initial desktop/phone state and receipt checks passed. Full final matrix/CI/live delivery pending.
- PR172 review found the new static module missing from the hub precache. Cache v84 now includes the module and all remaining card imagery; a cold hub-only install test verifies first FOH visit, twelve decoded previews and exact reload while offline.
- Final source d1f3eae passed required CI39090667953 and merged 7bc9ed3. Pages and 26 live source matches verified. Dominic passed 18 hosted catalog cases, first-visit cold offline preview/state/reload and captured screenshots; source rules/schema/geometry unchanged. Existing human/device/calibration gates remain open.

## 2026-10-18 Band and performer visuals
- Direct user request: add performers while preserving rules and saves; screenshots required.
- Added a presentation-only stage ensemble using existing menu artwork identities and source-authored instruments. Desktop and mobile verification pending on Dominic.
