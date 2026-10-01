Original prompt: Create the starter documentation for the Concert Tycoon game concept (Notion capture "Concert Tycoon Ideas") so the project is in good shape from the start, and record the document locations in Notion.

## 2026-10-01: Pre-production documents

- Created `tycoon/README.md`, `docs/GDD.md`, `docs/DECISIONS.md`, `docs/RULES.md` and `docs/SAVE_FORMAT.md`. No game code, route, hub card or sitemap entry was added.
- `GDD.md` combines both drafts from the Notion page (Draft B was cut off partway through "Production Stack, Audio") with the one-page design for the first playable loop. Section 9 records each choice made where they differed.
- Decisions CT-DEC-01 to CT-DEC-05 are **Proposed**, CT-DEC-06 (name and route) is **Open**, and CT-DEC-07 (this folder is canonical; Notion links here) is **Accepted**.
- Corrections to the earlier one-page draft that was shared in chat:
  - The fail rule "cash below $0 after settlement" could never trigger, because R-12 blocks a show whose upfront costs exceed cash. It is replaced by **Retry when net is below $0 or satisfaction is below 60**.
  - The bar threshold changed from 1 bar per 150 people to `BAR_RATIO` 250, so the worked example's single bar has enough capacity, as its cost assumed.
  - The worked example is now computed from every rule instead of an assumed satisfaction of 75. Satisfaction comes out at 85, so the guarantee nets +$495 and the door deal +$1,341, against +$345 and +$1,191 in the earlier draft.
- Checked: the worked example in `RULES.md` was recomputed by a Node script from the starting values table.

## 2026-10-01: Decisions accepted

- Dave accepted CT-DEC-01 to CT-DEC-05. CT-DEC-06 (name, route and save namespace) stays open. The MIXMASH-universe question stays open; CT-DEC-03 now records what joining that universe would mean.

## 2026-10-01: Phase 1, the rules engine

- Added `tycoon/data.mjs` (every adjustable value and content table), `tycoon/engine.mjs` (rules R-01 to R-18, actions, forecast, settlement, `normalizeState`), `tycoon/test-engine.mjs` (19 tests, including `R-WORKED-01`), `tycoon/sim/` (reference fixtures and the balance simulator) and the frozen save `tycoon/test/fixtures/save-v1.json`.
- `npm test` now runs the engine tests. `npm run sim:tycoon` writes `docs/BALANCE_BASELINE.md`; CI runs it and fails on a FAIL verdict or a stale committed copy. The CI push filter now includes `tycoon/**`.
- `RULES.md` no longer lists starting values; `data.mjs` owns them (CT-DEC-07).
- Rule changes found while implementing and simulating:
  - **R-10 bar revenue had a cliff.** One person past a bar's capacity cut the takings for everyone by 40%, so net fell as attendance rose (guarantee net $720 at draw 200, $403 at draw 210). Only the overflow now buys at the reduced rate. A new simulator verdict fails if more demand ever lowers net.
  - **R-03 sightlines punished big lots.** Dividing clear tiles by all open floor meant an empty corner lowered the score. Sightlines now measure whether the crowd fits in clear-view tiles: `min(1, clearTiles × FLOOR_DENSITY / attendance)`. The worked example now states 50 clear-view tiles, which gives the same 0.6.
  - **The light tower did nothing.** It cost $350 and 8 kW with no effect on any score. Without it, the sound part is now multiplied by `NO_LIGHTS_MULT`.
  - **R-18 placement rules** were implied but unwritten: boundary-only gates and exits, a PA touching the stage, one of each rig item, and what Build needs before it can be confirmed.
- What the simulator shows (`docs/BALANCE_BASELINE.md`): at $20 tickets the door deal nets the promoter more at every draw; the guarantee only wins at high draws with tickets of $25 or more. The guarantee with free incident responses passes 58.2% of seeds and the door deal 88.4%. Every seed has at least one passing strategy.
- Worked example numbers are unchanged (250 attending, satisfaction 85, +$495 and +$1,341).

## TODO

- Dave: decide CT-DEC-06 (name, route, save namespace) and whether the game shares the MIXMASH universe. This blocks the next phase.
- Next phase, the first playable client: `tycoon/index.html` and `tycoon/game.js` (canvas board for Build and Show night, HTML panels for Book, Promote and Settle), saves through `src/kit/save.js` under the final namespace, `window.render_game_to_text()`, and `npm run smoke:tycoon` in CI.
- When the first route ships: add a row to the root `README.md`, a `CHANGELOG.md` entry, a hub card and a sitemap entry.
- Balance questions for the playable build: the door deal is the better money choice at the fair price for every draw, so the guarantee's only pull is the artist relationship until later shows reward it; and the reference layout scores satisfaction near 100 when nothing goes wrong.
