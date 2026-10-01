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

## 2026-10-01: Phase 3, tier 1 (the Lot)

- Retuned the first playable to the Lot's 50 to 150 people (CT-DEC-09). `PERMIT_CAP` is 150 and the act draws 75 to 130. Every per-person value (`FLOOR_DENSITY`, `EXIT_CAPACITY`, `PA_COVERAGE`, `BAR_RATIO`, `RESTROOM_RATIO`, `SECURITY_PER`) and every money value (`START_CASH`, rentals, `STAFF_RATE`, the artist's ask, incident responses, `AD_SATURATION` and the ad limits) was halved, so demand, attendance and money scale together.
- Why halve everything rather than retune piece by piece: the six balance verdicts were verified at the old scale, and a uniform halving keeps that shape. All six still pass; the guarantee's pass rate with free responses moved from 58.2% to 58.6%. The worked example halved with it: 125 attend, satisfaction 85, guarantee +$248, door +$671.
- `FLOOR_DENSITY` is now 1.5 people per tile, so capacity rounds down (R-01). The ad slider's step and range come from `AD_STEP` and `AD_SLIDER_MAX`, and the tips quote `BAR_RATIO`, `RESTROOM_RATIO` and `PA_COVERAGE` instead of fixed numbers.
- Saves move to schema version 2. `migrateSave` converts version 1: cash, ad spend and history money and attendance halve; a show in progress converts exactly; a finished show is closed with Next show or Retry so an old sheet is never replayed. The client migrates on load and accepts version 1 save codes. New frozen fixture `test/fixtures/save-v2.json`; version 1 stays frozen.
- **Renamed the artist.** A name check while planning Phase 4 found that Velvet Static is a real four-piece indie band from Nottinghamshire, UK, with releases on Apple Music and Bandcamp. CT-DEC-03 requires fictional artists, so the act is now Sodium Arcade (id `sodium-arcade`); a search found no act by that name. The version 1 migration moves the id and its relationship. The checks are recorded under CT-DEC-03.
- Started `ROADMAP.md`. Service worker v5.
- Checked: the same seed 42 show on both scales gives 270 and 135 attending, +$945 and +$472 net, so the conversion is exact apart from rounding.

## 2026-10-01: Phase 4, a Lot career

- The Lot is now a run of shows (CT-DEC-10, Proposed; R-19 to R-21). Two new fictional acts join Sodium Arcade: Gravel Hymnal (folk, draws 55 to 100, $15, asks $300) and Juniper Switchboard (funk and soul, draws 95 to 150, $25, asks $800, guarantee only). Name checks are in the new `docs/WORLD.md`.
- Engine: `offersFor`, `termsFor`, `cheapestShowCost`, `careerProgress`; `chooseDeal` takes an `artistId`, checks the offer and the door rule, and stores the quoted terms; `evaluateShow` takes `ask` and `drawMult`; `nextShow` is open after any settlement unless cash is below the cheapest show; the Club unlock is recorded at settlement and stays.
- Tuning, from a career prototype run before the simulator verdicts were written: with a goal of a sellout, reputation 50 and $5,000, every strategy reached the Club on every seed and the door-only habit was fastest (median 3 shows against 6). Making Juniper Switchboard guarantee-only, raising the goal to reputation 60 and $6,000, and adding an act at +20 gives careful play 100% in a median of 7 shows (never fewer than 5) and careless play about 42%.
- Client: the Book screen shows two offer cards with each act's relationship, terms and door rule; the Done screen shows the goal's progress and keeps Book the next show open after a rough night. `render_game_to_text()` reports the booked act, the offers and career progress. Service worker v6.
- Tests: 27 engine tests (5 new for R-19 to R-21), 11 balance verdicts (5 new), and a smoke check that the next show offers two acts and carries the cash.
- Review fixes (Codex, three findings, each reproduced on the old engine first):
  - **A pasted save with a quoted ask of $0** reached settlement and set the act's relationship to `NaN` (R-17 divides the pay by the ask). `normalizeState` now drops terms whose ask is below $1, and `evaluateShow` ignores such an ask.
  - **Start over kept the old career's history,** so an earlier sellout counted toward the new goal and the first show's offer was skipped. Start over now keeps only the layout. Because of that, a finished version 1 save is now closed with Next show after any night (as R-21 allows) and with Start over only when the next show is unaffordable, so the migration keeps its history.
  - **The next-show check assumed a door deal.** When both acts on the next show's offer want a guarantee (Juniper Switchboard and an act soured past the door rule), a player with between $1,025 and the cheapest guarantee could book nothing. `nextShowCost(state)` prices the next show's actual offers; the Done screen and the simulator use it. The balance baseline is unchanged.

## 2026-10-01: Phase 4 post-merge verification

- PR #25 merged at 08:24 UTC (reviewed head `fec8a37`, merge `a6dab5f`; PR CI run #76 passed). This pass works on a follow-up branch; nothing here is merged or deployed, and CT-DEC-10 stays Proposed.
- **Correction:** the Phase 4 entry above, CT-DEC-10 and the PR said the +20 relationship is one "only fair guarantees build". R-17 scores what the act is paid against its quoted ask whatever the deal: a guarantee always gives +5, and a door deal gives less, nothing or more (up to +10) as its share falls below or rises above the ask. The rule is unchanged; CT-DEC-10, `RULES.md` R-17, `WORLD.md` and the Done screen's hint ("door deals ... sour an act") now say what it does. New engine tests pin door payouts below, at and above the ask.
- **Rechecked the three review fixes** and added tests where coverage was missing: a negative ask through `evaluateShow`; Start over resetting cash, venue reputation, relationships and the Club unlock while keeping the layout; `careerProgress().canAffordAShow` agreeing with `nextShow` on 160 states; a broke version 1 save starting over without its history; and the frozen version 2 save carrying on or starting over. 32 engine tests.
- **New defect, fixed:** when neither act on offer takes a door deal, the Promote screen still advised "go back and offer a door deal". It now suggests that only when the booked act takes one. A new smoke check covers the out-of-money stop and this message, and fails on the merged build.
- **Browser walkthrough** (scripted Chromium 141 at 1280 × 900 and 390 × 844 on `a6dab5f`, not a human playthrough): a show on the door deal, the next show from an offer card, a reload mid-show, a losing night carried on, Start over, the out-of-money stop, version 1 and 2 save codes; no console or page errors. It also showed that the Done screen's "needs at least" figure assumes the cheapest layout with no ads: a player who carries the suggested layout ($2,640 against $1,575 in the walkthrough) has to cut rentals before the show can be booked.
- **Paired comparisons** (`front-of-house/sim/paired.mjs`, scripted policies on 300 seeds, up to 12 shows; not in CI): from a baseline of the suggested layout, door deal when allowed and free responses (42.3% reach the Club), the budget layout raises the rate to 80.7% (no seed unlocks with the suggested layout but not the budget one) at about 12 points of satisfaction a show; always taking the guarantee gives 37.3% on the suggested layout but 94.0% against 80.7% on the budget layout; paid responses add 0.3 to 4.4 points. No run went bankrupt; runs on the suggested layout often stopped because no offer was affordable with that layout. Door shares never reached the ask on the suggested layout and did on 38% of door shows on the budget layout. Nothing was retuned.

## 2026-10-01: Sprite review fixes

- A review of the sprite push (`252833b`) and the feature plan (`264b63c`) found `gh-pages` CI red: the catalog was not regenerated, so `npm test` failed and nothing after it ran. The catalog and admin fixes went in first (PR #29).
- Board fixes, all in `board.js`: sprites follow rotation (a quarter turn the other way draws mirrored; a stage facing away keeps the code-drawn box and its arrow); the build ghost fills its footprint; a sprite mostly hidden behind a later, taller one is drawn again at 60% right after the last of those sprites (the suggested layout's PA behind the stage); the PAs are sized by height, so the medium PA draws taller (the small PA's art is the taller image); markers and the wash beam anchor to the drawn sprite (the lamp head at 10% of the tower image); right-click and Shift+click remove the prop under the pointer by the sprite's opaque pixels; each crowd dot and sightline tile is drawn right after the last prop covering it on screen that it stands in front of, so a dot in front of the PA but behind the stage lands between the two (behind wins when the order cannot honour both); the eight images switch on together after decoding, with one redraw and no lingering listener. `FIT` and the box heights became one `PROPS` table.
- The view turn (`cb6555`, Q and the Turn the view button) landed while this was in review. The fixes follow it: what decides mirrored, as drawn or box is the prop's rotation on screen (its own rotation less the view's quarter turns), sprites sit on their footprint's screen corners in every view, and the in-front test runs in view coordinates.
- The sprites left the service worker's precache (v11, after the rooms' v10) and are cached on first use. CT-DEC-02 has a dated note that the stand-ins exist and that `PROPS` is the interim render contract; whether they stay before the real contract is Dave's call.
- New smoke check: one redraw on load, mirrored and box stages by rotation and by view turn, the PA swap visibly changes the board, the medium PA draws taller, the PA-dropout marker sits above the drawn PA, the wash starts at the lamp head, and a right-click on the stage roof removes the stage.
- Merged with the rooms after the Lot (`40da936`): the board keeps each room's size, floor tint and pillars. Pillars are code-drawn boxes in the same paint order, so crowd dots and sightline tiles are placed against them and a click on a pillar finds the pillar, not a prop behind it.

## 2026-10-01: Mode button fix

- The Career, Sandbox and Wet lot buttons called an undefined `save()` (from the rooms push, `40da936`), which threw before the redraw, so the page kept showing the old game until the next action. They now call `persist()` and redraw at once. A smoke check clicks each button and checks the cash meter right away and after a reload. Service worker v12.

## 2026-10-01: Room choice fix

- Choosing a room or the nights on the Book screen changed the state but not the panel, which is rebuilt only on a phase change. The panel kept the previous room's acts, and booking one failed with "That act is not on offer for this show". The fix in #31 exposed it in Sandbox; before that, the mode buttons' crash happened to force a rebuild. The panel is now rebuilt on those choices, with focus back on the button pressed. A smoke check switches rooms and nights in Sandbox and books a deal. Service worker v13.

## 2026-10-01: HUD layout spec

- Dave asked to spec a HUD-like interface with a much larger map before more features land. Measured the live layout first: the lot covers 8.6% to 24.3% of the window at desktop sizes and 7.8% on a phone, the header takes 156 px, and every phase but Show scrolls.
- Drafted [`docs/HUD.md`](docs/HUD.md) and proposed CT-DEC-12. The board fills the window, a camera fits the lot (fit, zoom, pan), and the HUD sits in the four corner triangles the lot's diamond leaves empty. Book, Promote and Settle use a sheet on the right. Phones get a bottom sheet.
- Four mockups in `docs/hud/`, laid over real full-window board captures from seed 170. In Build the lot covers about 36% of a 1440 × 900 window (17% today), and the HUD covers 0.2% of it. Seven open questions for Dave, each with a recommendation. Nothing is built.

## 2026-10-01: HUD layout accepted

- Dave accepted every recommendation in `docs/HUD.md` section 9: a corner HUD, sheets on the right, wheel zoom, hub and mute kept in the top strip, a phone bottom sheet, and near-opaque backplates. CT-DEC-12 is Accepted.
- The minimap is deferred, and at Dave's request it is on the canonical roadmap: step 7 of the HUD build order in `ROADMAP.md`, with what it shows, where it sits, when it starts (after the camera ships and Split Acre is played zoomed in) and its done line.
- Next: step 1, the board camera.

## 2026-10-01: HUD step 1, the board camera

- `board.js` has a camera: zoom steps of fit, 1.5, 2 and 3, a centre kept in world tiles (so a view turn or a resize keeps what the player looked at), zoom about the pointer, panning clamped to the lot, and a follow that keeps the build cursor on screen. Every screen position still goes through `iso()` and `tileAt()`, so hit-testing, placement order, markers, beams and the ghost follow it unchanged.
- Controls, behind today's layout: minus, Fit and plus buttons beside Turn the view; `=`, `-` and `0` on the focused board; Shift with the arrow keys and a middle-button drag pan (a plain drag pans outside Build); Ctrl or Cmd with the wheel zooms, because the page still scrolls until step 2. Space can't pan, since it places in Build; `HUD.md` says so now.
- New smoke check: buttons and keys, every on-screen tile maps back to itself at every zoom and view turn (4,192 tiles in the probe), Shift-arrow and middle-drag panning, the clamp, a turn that keeps the zoom, the cursor follow, Ctrl and the wheel keeping the tile under the pointer, and a right-click on the zoomed stage. Service worker v14.

## TODO

- Dave: play Lot Night and sign off the first playable (or list what to change). On sign-off: hub card on the landing page (with a gameplay preview and its provenance), sitemap entry, and remove `noindex`.
- Dave: accept or change CT-DEC-10 (the Lot career) and CT-DEC-11 (the rooms after the Lot).
- Not built with the rooms: a ticketing platform, a hillside model, cancelling a held night, simulator verdicts for the Club and later, and four venue art looks.
- Balance: careful play always picks the budget layout on the Lot, so the light tower and the medium PA rarely pay for themselves at this scale. The paired comparisons confirm it across every pairing; the question for Dave, after a playtest, is whether satisfaction should cost more on the Lot. No retune until then.
- The Done screen's out-of-money figure assumes the cheapest layout with no ads. Consider saying so there, or pointing to Cut ads or rentals (Dave, with the playtest).
- The simulator's careful strategy picks each incident response by computing its settlement, which uses the seed's hidden draw, so its verdicts are an upper bound on informed play; `paired.mjs` uses only what the screen shows.
- Balance questions for the playable build: the door deal is the better money choice at the fair price for every draw, so the guarantee's only pull is the artist relationship until later shows reward it; and the reference layout scores satisfaction near 100 when nothing goes wrong.

## 2026-10-01: Phases 5 to 7, Sandbox, and one scenario

- Built the rooms after the Lot in one pass, on an explicit request to implement the planned phases through testing and deploy. The public-release gates were not cleared: `noindex` stays, there is no hub card, and CT-DEC-10 stays Proposed. The calls that [FUTURE.md](docs/FUTURE.md) left open are now [CT-DEC-11](docs/DECISIONS.md#ct-dec-11-rooms-after-the-lot) (Proposed).
- **Fathom Hall** (Club, permit 360, house PA, four pillars). **Loam Shell** (permit 700, 400 seats, holds of 1 to 3 nights, curfew). **Split Acre** (permit 6,000, sponsor, broadcast, a second stage capped at 500). The Lot stays bookable. Layouts are stored per room. Schema stays 2.
- **Sandbox** starts with $1,000,000 and no cash gate. **Wet lot** starts on the suggested layout with $2,600 and rain forced.
- Name checks are in [WORLD.md](docs/WORLD.md). Cinder Meridian is a real act and was not used. Relay Hall and Marrow Shell were too close to a real hall and a real band.
- The Lot balance baseline was regenerated and is unchanged: cheapest show $1,025, all 11 verdicts pass. 36 engine tests. Not in this pass: a ticketing platform, a hillside model, cancelling a held night, new-tier simulator verdicts, and four venue art looks (the board tints the floor).
- Service worker cache is v10. The strategy is still network-first, so an online refresh picks this up; a hard refresh covers a stuck worker.

## 2026-10-01: Feature plan

- Added `docs/FUTURE.md`. It orders the work after the Lot: four gates, then the Club (two decisions first), then the Amphitheater, then the Festival Grounds, with each later system assigned to the first tier that needs it. Sandbox and one scenario wait until the Club plays. The painted prop sprites stay a stand-in until a render contract and the style anchor replace them.
- `ROADMAP.md` now marks Phases 0 to 4 shipped and points the next phase at that plan. `ART_DIRECTION.md` records the stand-in sprites so they are not mistaken for art Phase 2.
- No rules, numbers, or saves changed.
