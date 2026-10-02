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
- [ ] A save field changed → schema version, `migrateSave`, a frozen fixture in `test/fixtures/` and [SAVE_FORMAT.md](SAVE_FORMAT.md) all move together.
- [ ] `game.js`, `board.js`, `engine.mjs`, `data.mjs`, `styles.css` or `index.html` changed → the service worker `VERSION` in `/sw.js` is bumped.
- [ ] A new screen, window, control or edge path → [SCREENS.md](SCREENS.md) updated.
- [ ] A design choice was made → a `CT-DEC-NN` entry in [DECISIONS.md](DECISIONS.md), Proposed until Dave accepts it.
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

1. Open a revert PR of the merge commit into `gh-pages`. Revert only Front of House files; don't touch other routes, `api/` or hosting config.
2. Wait for CI, merge, and run the live smoke against the reverted build.
3. **Saves:** a revert past a schema change loses saves written by the newer version. `normalizeState` treats a schema it doesn't know as no save and starts a new game, which overwrites the old save on the player's next step. If the reverted change raised the schema, ship a forward fix instead of a revert.
4. Bump the service worker `VERSION` in the revert too, so cached clients pick it up.
5. Add a KNOWN_ISSUES.md row and a `progress.md` entry for what went wrong.

## 3. Public launch (one time)

The page is live but `noindex`, with no hub card and no sitemap entry ([FUTURE.md](FUTURE.md#release)). All of these first:

- [ ] Dave has played the Lot and signed off the first playable, or listed what to change.
- [ ] CT-DEC-10 (the Lot career) and CT-DEC-11 (rooms after the Lot) are accepted or changed.
- [ ] The Medium issues in KNOWN_ISSUES.md are fixed, or Dave has accepted them for launch.
- [ ] Every image in ASSETS.md has a recorded source and licence (KI-07).
- [ ] Every act and room name has a current name check in WORLD.md.

Then, in one PR:

- [ ] Remove `noindex` from `front-of-house/index.html`.
- [ ] Add the sitemap entry.
- [ ] Add the hub card with a gameplay preview and where the preview came from (`assets/previews/README.md`).
- [ ] Update the README status line and the CHANGELOG.
- [ ] Follow sections 1 and 2.
