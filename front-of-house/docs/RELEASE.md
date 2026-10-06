# Front of House Release Checklist

**Status:** Active from 2026-10-02. Hand-written. Covers every change that ships to `mixmash.games/front-of-house/`, and the one-time public launch.

The site is the `gh-pages` branch served as-is by GitHub Pages; a merge into `gh-pages` is a deploy, and there is no build step. CI (`.github/workflows/ci.yml`) is the only gate before it goes live, so nothing here replaces it: this list is what CI can't check, plus the order to do things in.

## 1. Every change

### Before the pull request

- [ ] The change is on a branch, not `gh-pages`.
- [ ] Numbers changed only in `data.mjs` (CT-DEC-07), and [RULES.md](RULES.md) names any new value or rule.
- [ ] `npm test` passes (engine tests, save round trip, admin catalog).
- [ ] `npm run sim:front-of-house` was run and the regenerated [BALANCE_BASELINE.md](BALANCE_BASELINE.md) is committed. A changed baseline is explained in the PR.
- [ ] `npm run docs:front-of-house` was run and [ASSETS.md](ASSETS.md), [CATALOG.md](CATALOG.md) and [STRINGS.md](STRINGS.md) are committed.
- [ ] `npm run smoke:front-of-house` passes locally (25+ checks, no console errors).
- [ ] A file was added, removed or renamed → `npm run admin:index` and `admin/catalog.json` committed.
- [ ] An image was added or replaced → it is in `sprites/manifest.mjs` with its source.
- [ ] A save field changed → follow the [migration policy](SAVE_FORMAT.md#migration-policy). Compatible optional fields use `normalizeState` defaults, with tests for older saves and the new field, and updated schema documentation. Only a change that breaks older saves bumps `version` and `schema`; it also needs `migrateSave`, a frozen fixture in `test/fixtures/`, and migration tests. Preserve the existing namespace unless an intentional fresh start is approved.
- [ ] `game.js`, `board.js`, `engine.mjs`, `data.mjs`, `styles.css` or `index.html` changed → the service worker `VERSION` in `/sw.js` is bumped.
- [ ] A new screen, window, control or edge path → [SCREENS.md](SCREENS.md) updated.
- [ ] A design choice was made → a `CT-DEC-NN` entry in [DECISIONS.md](DECISIONS.md). Record autonomous choices authorized under CT-DEC-19 as Accepted; unapproved proposals remain Proposed. Neither status substitutes for device or human acceptance.
- [ ] A new act or room name → a name check in [WORLD.md](WORLD.md) (CT-DEC-03).
- [ ] [`progress.md`](../progress.md) has a dated entry, and the root `CHANGELOG.md` an `[Unreleased]` line.
- [ ] [KNOWN_ISSUES.md](KNOWN_ISSUES.md): fixed rows moved to Fixed, new ones added.

### Merge

- [ ] CI is green on the PR's last commit. Don't merge on a red or pending run: Pages deploys on its own and won't wait.
- [ ] Merge into `gh-pages`.

### After the deploy

- [ ] The Pages deployment for the merge commit succeeded.
- [ ] Live smoke: `FRONT_OF_HOUSE_BASE_URL=https://mixmash.games/front-of-house/ npm run smoke:front-of-house`.
- [ ] One hand-played show on a desktop browser and one on a phone, from Book to Done, with a reload partway through.
- [ ] An existing save from before the change still loads (open the page in a browser that has one).
- [ ] Status recorded with the run name format in `AGENTS.md`.

## 2. Rollback

1. **Check save compatibility before preparing a revert.** Identify the deployed commit, the target revision and the save formats written by each. `normalizeState` treats an unknown schema as no save and starts a new game, which overwrites the old save on the player's next step. If the change raised the schema, ship a forward fix instead. Even when the schema is unchanged, verify that the target can load saves from the deployed version without losing progress; if it cannot, use a forward fix.
2. Prepare the correction on a branch and open a PR into `gh-pages`. Scope the revert to Front of House and its required supporting changes; preserve unrelated routes, `api/` and hosting configuration. Do not blindly revert a merge that also contains unrelated work.
3. **Before CI and merge**, bump `/sw.js` `VERSION` beyond the deployed value so cached clients pick up the corrected runtime. Add a [KNOWN_ISSUES.md](KNOWN_ISSUES.md) row, a `progress.md` entry and a CHANGELOG entry explaining the rollback. Regenerate the references and balance baseline, and regenerate the admin index if tracked files changed. Complete the local checks in section 1, including save compatibility checks against the prepared correction.
4. Wait for green CI on the PR's final commit, then merge into `gh-pages`. Do not amend the release after its checks without rerunning the affected checks.
5. Verify the remote merge commit and its successful Pages deployment, then run the live smoke and remaining after-deploy checks in section 1. Record the deployed revision and any checks that still require human or device acceptance.

## 3. Public launch (one time)

Dave approved the **Early playable** homepage listing on2026-10-05; the hub card is deployed. The game remains `noindex` and excluded from the sitemap. That limited sign-off does not close final art, performance, device or career acceptance. Before full launch and search promotion:

- [x] Dave signed off the first playable for the Early playable homepage listing on2026-10-05 ([record](DECISIONS.md#homepage-visibility-sign-off-2026-10-05)); final acceptance for later revisions remains separate.
- [ ] CT-DEC-10 (the Lot career) and CT-DEC-11 (rooms after the Lot) are accepted or changed.
- [ ] The Medium issues in KNOWN_ISSUES.md are fixed, or Dave has accepted them for launch.
- [ ] Every image in ASSETS.md has a recorded source and licence (KI-07).
- [ ] Every act and room name has a current name check in WORLD.md.

Then, in one PR:

- [ ] Remove `noindex` from `front-of-house/index.html`.
- [ ] Add the sitemap entry.
- [ ] Review the existing approved hub card and its gameplay preview against the accepted launch scope; keep preview provenance in `assets/previews/README.md`.
- [ ] Update the README status line and the CHANGELOG.
- [ ] Follow sections 1 and 2.

## 4. Current revision acceptance

Prepared on 2026-10-05 for model15 at deployed revision `b746258d74278269eb047537294165d1d1e3e0bd`. Its runtime is unchanged from PR122; PR126 records delivery evidence. Earlier model12 measurements and pictures retain their original source attribution. This checklist is prepared for review, with every acceptance item below still open.

A private current-source review packet was completed on 2026-10-05 (capture timestamps 2026-10-06 UTC) at records revision `87f8300aac86506179b45c8024b539295a4cc375`, with model15/runtime unchanged from `b746258`. Walter used Microsoft Edge154.0.4258.53, NVIDIA RTX3070Laptop/ANGLE Direct3D11, native1000×676/DPR1. Eight actual game/HUD captures cover Wide, FOH, Stage and Plan in daylight Build and paused Show at service minute65. Eight separate controlled-renderer references use ten static guests and reduced motion; they are reference art, not gameplay. Natural Build contains no guests.

Independent review verifies114canonical source digests,43served-file digests,16PNG hashes/native guards and exact engine-action replay of both game fixtures. All16images were inspected. Report SHA256: `2fc3260e82f5e56b12df4170ee29ca7c231bf13738fb7f75721be45621b669fc`. Private captures are retained for human review; no private paths or unverified image assets are published here.

Observed limits remain part of review: HUD panels cover parts of close views and the bottom of Plan; paused FOH guests obscure the stage; Wide makes fine anatomy small and unlit props have limited night contrast. Authored FOH/Stage eye references remain provisional. Static views do not establish walking/queues, orbit/zoom/pitch extremes, physical displays, performance targets or approval. No performance samples were added, earlier valid/lower/failed windows remain intact, Walter is released, and every acceptance item below remains open.

### Protect the existing career

1. Open [Front of House](https://mixmash.games/front-of-house/) in the browser containing the existing career.
2. Open **Menu → Save and load → Show my save code** and copy the entire code somewhere safe.
3. Use a separate browser profile for a new review career. Do not clear the original browser's data or overwrite its career for a test.
4. Record the deployed revision, date, reviewer, device, browser/version, viewport, pixel ratio and actual graphics backend. Record an unavailable field as unknown.

### Final realistic sample and camera review

- [ ] Review the current stage, PA, bar, restroom and representative guest in **Wide**, **FOH**, **Stage** and **Plan**, both in daylight Build and Show lighting. Capture eight views tied to the exact runtime/asset digests.
- [ ] Open **Menu → Camera → Try 3D preview**. In **Select**, tap/click to inspect and drag to orbit. Review yaw 37° and 135°, practical zoom extremes and both pitch bounds. Confirm orbiting changes neither equipment orientation nor saved placement.
- [ ] Check close and management views, walking and queues, detail transitions, silhouette/ground contact, material readability, shadows and overlap. Record objectionable views rather than accepting unseen conditions.
- [ ] Repeat controls with reduced motion and both light/dark controls. On a real phone, verify tap selection, pinch/pan and **Drag camera while placing** without unintended placement/removal.
- [ ] Review operator-eye FOH visibility. Keep the provisional 2 m/tile authoring reference distinct from measured physical venue calibration.
- [ ] Record an explicit dated visual/camera decision for the exact revision, including requested changes. Screenshots, automated passes and silence do not count as approval.

### Real desktop and phone gameplay

1. On a desktop browser, play **Book → Build → Promote → Show → Done**. Reload partway through Show and finish the same career.
2. Compare cash, attendance, costs and signed history before/after reload. Confirm the next booking retains the expected career state.
3. Repeat on a physical phone; record its actual model, OS/browser, orientation and any unreachable control or page overflow.
4. Open **Save and load**, paste the preserved code into **Save code**, and choose **Load this code** in the separate profile. Check the recovered booking, layout and history without altering the original profile.
5. Review Club, Amphitheater and Festival progression, then record the human career/balance result and any unresolved issue. Automated replay is separate evidence.

### Device performance and physical calibration

- [ ] Capture the current source on every supported device using the established warm-up, duration and repeated measurement protocol; retain invalid windows and failures.
- [ ] Identify the actual GPU/backend and separate isolated-renderer, full-HUD, emulated viewport and physical-device evidence. The accepted 60 fps desktop/30 fps low-power targets remain unchanged.
- [ ] Establish the supported phone/low-power roster before claiming qualification. Walter's SSH desktop or NVIDIA renderer evidence cannot qualify a phone or a physical display by proxy.
- [ ] Record agreed measured scale references and operator-eye placement; do not treat the authoring convention as a venue measurement.

### Rights and final launch

- [ ] Establish author/tool/source/license and redistribution permission for every used image, mesh, material, texture and animation. Preserve the unresolved legacy-image inventory; do not delete it or infer rights from its presence.
- [ ] Reconcile the existing release issues, name screening and scoped career decisions with actual acceptance evidence.
- [ ] Keep the current Early playable listing, noindex and sitemap exclusion until all required final launch gates are fulfilled. Do not promote automatically from CI or device diagnostics alone.

Outcome: pending. This checklist prepares review; it grants no human, physical-device, calibration, rights or full-launch acceptance.
