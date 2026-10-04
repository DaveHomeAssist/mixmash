Original prompt: Create the starter documentation for the Concert Tycoon game concept (Notion capture "Concert Tycoon Ideas") so the project is in good shape from the start, and record the document locations in Notion.

## 2026-10-04: Knowledge reconciliation and planning delivery

- [PR #53](https://github.com/DaveHomeAssist/mixmash/pull/53) delivered the decision packet, eleven proposed feature briefs, prototype source review and next-steps projection. CT-DEC-14 records Dave's accepted 3D Lot first, then live operations sequence; D2–D11 remain open.
- Reconciled the document index, roadmap and feature plan with that accepted sequence. Preserved the original build order as historical, distinguished shipped phone layouts from physical-device acceptance, and linked the art specification to the pending replacement decisions.
- Source review uses production revision `bcc773b`; it does not treat prototype screenshots, archive code or older session claims as proof of deployed 3D. No gameplay, saves, art, decision statuses or launch gates changed. Delivery checks are recorded on the reconciliation PR.

## 2026-10-03: One key table, and undo in Build

- Every key binding now lives in `controls.mjs`. Both key handlers in `game.js` read it, the menu's key list is one row per binding, and `test-engine.mjs` fails when two bindings could fire on one key press, when a binding takes a key the browser owns, or when the menu list and the table differ. No existing key changed what it does.
- Build has Undo and Redo: tiles after Rotate, Ctrl+Z or ⌘Z, and Ctrl+Shift+Z, Ctrl+Y or ⌘⇧Z. Each place, remove, Suggested layout or Clear is one step, a bulldozer drag is one step, and undo applies the earlier copy through the engine's `setLayout`. The list is kept in memory only (50 steps) and clears when the phase changes or a game is started or loaded; saves and balance are unchanged.
- The tool grid is six columns so the new tiles fit without a new row; the corner HUD measured 1.40% of the lot at 1024 × 700 against the 2% limit. Service worker v26.

## 2026-10-02: Split view and prop occlusion

- Dave's screenshots showed Build controls extending beyond the status card and restrooms appearing on top of the bar. The status row now uses bounded grid columns; split-view meters wrap to a second header row. The occlusion repaint is restricted to PAs hidden by the stage, so amenities follow normal draw order.
- Added browser regressions for status controls and header containment at 760, 900 and 1024 px, plus a bar with two restrooms immediately behind it. Existing PA visibility and removal checks remain in place. Service worker v22.
- Recorded the requested continuous 360° camera direction in HUD.md, including dimensional props, tilt, picking and control separation. The art treatment remains an open choice; this patch does not ship a new renderer or claim to provide continuous orbit.
- Local and deployment verification results are recorded on the delivery PR. Human camera/art acceptance remains separate from automated checks.

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

## 2026-10-01: HUD step 2, the page never scrolls

- Dave, on the live camera build: "absolutely no full frame scroll". The page no longer scrolls at any size. The board's canvas covers the window; the header is a fixed top strip (the MixMash hub and mute pills, the name, the phase stepper, the meters and a Menu button); the phase panel docks on the right and scrolls inside itself; on phones it is a bottom sheet under the board.
- The lot is fit, by width and by height, into the part of the window the strip and the panel leave clear (`setClear()` in `board.js`), and the zoom, pan and cursor follow centre on that part. A canvas over 6 megapixels at 2x drops to 1.5x.
- The menu (`?` or the Menu button) holds full screen and the source link (moved from the MixMash nav), the keys, save and load, and the credit. Escape or a click outside closes it, and loading a save or starting a new game closes it.
- The plain mouse wheel zooms now that the page doesn't scroll. The camera buttons float in the lot's empty bottom-left corner with the board's status line.
- Interim size: the lot covers 15% to 26% of the window in Build (it was 9% to 24%, and needed a scroll). The 30% and 35% targets need step 3, when the panel splits into the corners.
- New smoke checks: in every phase at 1024 × 700, 1024 × 768, 1280 × 800, 1440 × 900 and 1920 × 1080 the document has nothing to scroll, the canvas fills the window, the panel fits on screen and the whole lot is clear of the strip and the panel; the phone has no scroll either way, a bottom sheet that scrolls inside itself, and a board at least 45% of the height; the menu opens and closes; the plain wheel zooms without scrolling. Service worker v15.

## 2026-10-02: HUD step 3, the Build and Show corner HUD

- Dave agreed that no panel scrolls at 1024 × 700 and up (five decisions, recorded in `docs/HUD.md` section 9 and CT-DEC-12).
- Build: the phase card top left, the readouts top right, ten tool tiles bottom left (eight objects with their sprites and keys 1 to 8, Bulldoze and Rotate), the actions bottom right. Details opens a window with the full readiness list and every placed object, each removable by name.
- Show: the clock top left, the incident card top right, the last four feed lines bottom left, the crowd count and Skip bottom right.
- The lot is fit to the whole window below the strip, with 3 tile heights above it and half of one below. The camera buttons moved into the strip; the game's name hides below 1440 px wide so the strip fits.
- Measured: the lot covers 31.8% to 37.8% of the window at the fit (36.3% at 1280 × 800, 37.8% at 1440 × 900), and the plates cover at most 1.31% of it. No plate scrolls.
- New smoke checks: lot share, HUD coverage, no plate scrolls or leaves the window, and the strip fits, in Build and Show at five desktop sizes; keys 1 to 8; the Details window removes an object and keeps focus. The zoomed-stage check now zooms about the stage, as a player would, so the corner plates don't catch the click. Service worker v16.
- Next: step 4, the sheets and windows for Book, Promote, Settle and Done.

## 2026-10-02: HUD step 4, the sheets and windows

- Book: the two offer cards side by side, the rooms in one row, the nights below. Deal explanations show under the buttons on a career's first show (and the wet lot) only; the Deals window (ⓘ) has them after that. Career, Sandbox and Wet lot moved into the menu's New game section, and on a game under way the first press asks before erasing it.
- Promote: two columns, price and ads beside the forecast and the presale chart. Cash left the forecast; it is in the strip.
- Settle: a short summary, and the settlement in its own window in three columns with the stamp, the tip and the signature in the footer. Done: the career card, one line on the last show, and windows for the last settlement and the show history (the only window allowed to scroll).
- The map dims behind Book, Settle and Done.
- Measured: nothing scrolls in any phase at five desktop sizes, nor in any room's Book sheet or Promote with seats or a sponsor at 1024 × 700. The worst settlement there needs 490 of 510 px.
- New smoke checks: no panel or window scrolls in every phase at five sizes; every room's Book and Promote at 1024 × 700 in Sandbox; the settlement opens in a window; Last settlement and Show history open as windows; the Deals window; the mode buttons in the menu and their second press. Service worker v17.
- Next: step 5, tabs in the phone's bottom sheet.

## 2026-10-02: HUD step 5, phone tabs

- On a phone the sheet and the settlement window never scroll (decision 12). Groups marked `data-tab` share one space a tab at a time: Lot, Tools and Actions in Build; Problem and Night in Show (the incident brings its tab forward); a tab per act on Book; Price and ads, Forecast and Presales on Promote; Revenue, Costs, Payout and Crowd in the settlement. Arrow keys move between tabs, and a wider window drops them.
- Build and Show keep a peek sheet with the phase card as its header; Book, Promote and Done take the height under the strip.
- Measured at 390 × 844: every tab fits (the rain incident fills the Problem tab exactly), and the board takes 46% of the height in Build and Show.
- The strip keeps two rows (nav, phase and menu; then the meters) instead of moving the meters into the menu; HUD.md section 8 says so.
- New smoke check: a whole show on a phone, every tab of every phase and of the settlement window, the incident's tab, the 45% board, and the tabs dropping at a wider window. Service worker v18.
- Next: step 6, performance.

## 2026-10-02: Mockup review refinement

- Applied Dave's accepted review to the already built HUD steps 1 to 5. Show distinguishes its pre-incident crowd outlook from paused decisions; response copy explains consequences rather than the handling score. Locate centres the affected PA, gate or stage without answering the incident.
- Phone Build and Show sheets can expand, reduce, hide and restore through 44 px buttons or an optional swipe on the controls. Collapsed content is inert; new decisions restore the sheet. Phone tabs use 44 px targets and tool shortcut badges hide.
- Added light controls by default and a persistent dark toggle, preserving the map palette. Idle navigation remains visible. Service worker v20.
- Extended the real-browser smoke rail for sheet controls, touch gestures, theme persistence, 375 px and ultrawide layouts, and equipment location. The optional doors crew flow remains covered. Verification results belong to the PR and deployment receipt; human/device acceptance is still outstanding.
- Next: HUD step 6, performance. The minimap is deferred, and public promotion still waits on Dave's playtest sign-off.

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

## 2026-10-02: Incident timing and the reference documents

- Audit of `ddbc50e` (engine tests, simulator, smoke rail and a scripted playthrough at 1440 × 900 and 390 × 844; the live domain was not reachable from the audit sandbox, so the same commit was served locally). Findings are now rows in [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md).
- **Fixed: incidents ignored their own timing.** `rollShow` placed every incident at a random 20% to 80% of the night, so "PA dropout mid-set" fired at 20:01 with the doors still open. Each incident now has a `window` in `INCIDENTS` ([R-11a](docs/RULES.md#r-11a-incident-timing)): rain 19:12 to 19:36, gate jam 19:12 to 19:48, PA dropout 20:36 to 22:12, curfew 22:31 to 22:48. `ACT_ON_STAGE_AT` moved into `data.mjs`. The client times the incident it actually shows (`incidentAtFor`), and each night of a run rolls its timing from that night's seed, as `incidentFor` already did. The draw order is unchanged and timing affects no number, so the balance baseline is unchanged. One new engine test (39).
- **Added the reference documents** that back the design: generated [`ASSETS.md`](docs/ASSETS.md) (asset manifest, from the new register `sprites/manifest.mjs`), [`CATALOG.md`](docs/CATALOG.md) (phases, actions, refusals, a transition grid played through the engine, rooms, incidents, objects, acts, saved state) and [`STRINGS.md`](docs/STRINGS.md) (copy tables and labels), written by `npm run docs:front-of-house` and checked in CI like the balance baseline; hand-written [`SCREENS.md`](docs/SCREENS.md), [`KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md), [`RELEASE.md`](docs/RELEASE.md) and [`GLOSSARY.md`](docs/GLOSSARY.md). `board.js` exports `SPRITE_FIT` for the manifest. Service worker v21.
- Not changed: balance, incident weights, copy, the Band label. Those are KI-01 to KI-06, waiting on Dave's playtest.

## 2026-10-02: Reference pack review corrections

- Corrected the rollback runbook: check save compatibility before preparing a revert; update the service worker and records before final CI and merge; verify the actual Pages revision afterward.
- Aligned the release checklist with SAVE_FORMAT.md: optional fields use normalization defaults and compatibility tests; only breaking changes require a schema bump and migration.
- Replaced KI-01's claim that a free PA response always wins with a scoped balance question and a paired engine example. At draw 125 with the suggested layout and a $20 door deal, the backup amp produces $828 net versus $821 for waiting, and +19 reputation versus +17. These are controlled inputs, not a universal strategy.
- No additional gameplay, balance or save changes. Verification and deployment evidence will be recorded on the PR; human playtest and device acceptance remain outstanding.

## 2026-10-03: Research and upgrade dynamics proposal

- Added [RESEARCH.md](docs/RESEARCH.md): eight development branches within the four career tiers, prerequisites, cash and experience, research timing, rental/ownership boundaries, department interactions, venue infrastructure, modes, interface and acceptance criteria.
- Recorded [CT-DEC-13](docs/DECISIONS.md#ct-dec-13-research-and-upgrade-progression) as Proposed and linked the design from the GDD, future plan, roadmap and README. Corrected the GDD header's claim that every logged decision was accepted.
- Proposed a first Lot experiment with Patch standards, Service training and Admission lanes. No research mechanic, economy, balance, save or renderer changes are implemented in this documentation update.
- Delivery checks and deployment evidence are recorded on the associated pull request. Human acceptance of the design and existing public-launch gates remain open.
