Original prompt: Create the starter documentation for the Concert Tycoon game concept (Notion capture "Concert Tycoon Ideas") so the project is in good shape from the start, and record the document locations in Notion.

## 2026-10-01: Pre-production documents

- Created `front-of-house/README.md`, `docs/GDD.md`, `docs/DECISIONS.md`, `docs/RULES.md` and `docs/SAVE_FORMAT.md`. No game code, route, hub card or sitemap entry was added.
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

- Added `front-of-house/data.mjs` (every adjustable value and content table), `front-of-house/engine.mjs` (rules R-01 to R-18, actions, forecast, settlement, `normalizeState`), `front-of-house/test-engine.mjs` (19 tests, including `R-WORKED-01`), `front-of-house/sim/` (reference fixtures and the balance simulator) and the frozen save `front-of-house/test/fixtures/save-v1.json`.
- `npm test` now runs the engine tests. `npm run sim:front-of-house` writes `docs/BALANCE_BASELINE.md`; CI runs it and fails on a FAIL verdict or a stale committed copy. The CI push filter now includes `front-of-house/**`.
- `RULES.md` no longer lists starting values; `data.mjs` owns them (CT-DEC-07).
- Rule changes found while implementing and simulating:
  - **R-10 bar revenue had a cliff.** One person past a bar's capacity cut the takings for everyone by 40%, so net fell as attendance rose (guarantee net $720 at draw 200, $403 at draw 210). Only the overflow now buys at the reduced rate. A new simulator verdict fails if more demand ever lowers net.
  - **R-03 sightlines punished big lots.** Dividing clear tiles by all open floor meant an empty corner lowered the score. Sightlines now measure whether the crowd fits in clear-view tiles: `min(1, clearTiles × FLOOR_DENSITY / attendance)`. The worked example now states 50 clear-view tiles, which gives the same 0.6.
  - **The light tower did nothing.** It cost $350 and 8 kW with no effect on any score. Without it, the sound part is now multiplied by `NO_LIGHTS_MULT`.
  - **R-18 placement rules** were implied but unwritten: boundary-only gates and exits, a PA touching the stage, one of each rig item, and what Build needs before it can be confirmed.
- What the simulator shows (`docs/BALANCE_BASELINE.md`): at $20 tickets the door deal nets the promoter more at every draw; the guarantee only wins at high draws with tickets of $25 or more. The guarantee with free incident responses passes 58.2% of seeds and the door deal 88.4%. Every seed has at least one passing strategy.
- Worked example numbers are unchanged (250 attending, satisfaction 85, +$495 and +$1,341).

## 2026-10-01: Named Front of House

- Dave named the game **Front of House** and made it a standalone game (CT-DEC-06 and the new CT-DEC-08, both accepted). A title check found no major game with the name; the nearest are a small itch.io bakery game called "Front of the House" and a utility app called "FRONT of HOUSE (FOH)".
- Renamed the folder `tycoon/` to `front-of-house/`, the script `sim:tycoon` to `sim:front-of-house`, and the save namespace to `front_of_house_v1` (`SAVE_NAMESPACE` in `data.mjs`). CI paths follow. Decision IDs keep the `CT-` prefix.

## 2026-10-01: Phase 2, the first playable

- Added the page (`index.html`, `styles.css`), the client (`game.js`) and the canvas board (`board.js`); the route is `mixmash.games/front-of-house/`, `noindex`, with no hub card yet. The studio README, CHANGELOG and service worker (v4 precache) list it.
- Added `docs/ART_DIRECTION.md` from Dave's art direction and concept sheets (drafted with Gemini), with corrections: figures from the superseded draft replaced by engine values, real company names removed, CSP-safe fonts and handlers, and a lighter small-text colour for contrast. Conflicts between the sheets are listed there for settling before Phase 2 art.
- Added `test/front-of-house-smoke.mjs` (`npm run smoke:front-of-house`, now in CI) and `node --check` for `game.js` and `board.js` in `vercel-build`.
- Engine additions: `STARTER_LAYOUT` in `data.mjs` (the suggested layout, also the simulator's reference layout, so the baseline is unchanged), a `setLayout` action, `showPreview`, `sightlineTiles` (clear and blocked tiles) and `blockedTiles` in `evaluateVenue` for the sightline occlusion overlay.
- **Bug found by the smoke test:** after signing, the finished-show sheet was recomputed with the reputation the show had just earned, so it showed a different crowd and net than the night actually had (the cash was right). The show now records the venue reputation it was sold with (`show.venueRep`), and an engine test checks that the signed sheet replays exactly. The version 1 save fixture was regenerated to include it; no version 1 saves existed outside tests.
- Deliberate differences from the GDD for the first playable: show night plays for 12 seconds to curfew instead of about two minutes, and the presale chart is drawn at once instead of playing 14 days over a minute.
- Review fix (Codex): signing the sheet during the three-second wind-down after the incident froze the board's crowd partway between the preview and the signed attendance. Leaving show night now finishes the transition, and a smoke check pins a rain seed (where the two numbers differ) to cover it.
- Dave chose the art's four-tier career ladder: the Lot, the Club, the Amphitheater and the Festival Grounds (CT-DEC-09). The GDD's arena or stadium tier is cut.

## TODO

- Dave: play Lot Night and sign off the first playable (or list what to change). On sign-off: hub card on the landing page (with a gameplay preview and its provenance), sitemap entry, and remove `noindex`.
- Before career work: retune tier 1 to the Lot's 50 to 150 (permit cap, the first artist's draw, the reference layout) and re-run the balance simulator (CT-DEC-09).
- Balance questions for the playable build: the door deal is the better money choice at the fair price for every draw, so the guarantee's only pull is the artist relationship until later shows reward it; and the reference layout scores satisfaction near 100 when nothing goes wrong.
