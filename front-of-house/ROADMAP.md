# Front of House Roadmap

**Status:** The accepted execution plan contains ten active phases. Foundation, live/guest operations, research, ownership and navigation are delivered; Lot visuals, performance and venues retain final acceptance gates, and release remains acceptance-open. Model15 engineering delivery is qualified through PR122; native evidence records are deployed through PR126/127. PR128 camera-review documentation is merged/deployed at ef47093 with40exact checked paths. The classic crowd correction and PR129 HUD changes are delivered through PR130. The settlement-only FOH-U02 presentation redesign is delivered through PR132 at cachev72 with final-head/post-merge CI, Pages, exact hosted source parity and a complete hosted player matrix; it changes no engine, save or balance rule. Dominic Intel/Mesa EGL now has18 valid renderer-only diagnostic windows under the established procedure; full-HUD, native/physical-device and human acceptance are not inferred. Final art/camera/career, supported physical-device/current-Mac/sustained performance, measured venue calibration and original-image rights remain open. The active table below owns completion; historical milestone sections retain their original context.

The phases from the first document to the last career tier. Each phase ships as its own pull request, merges only when CI is green, and ends at its **Done when** line. The career tiers come from [CT-DEC-09](docs/DECISIONS.md#ct-dec-09-career-tier-ladder); what each tier contains is in [GDD section 5](docs/GDD.md#5-progression).

## Current planning choices

The [decision packet](docs/DECISION_PACKET.md) separates shipped controls from remaining choices. [Feature briefs](docs/FEATURE_BRIEFS.md) scope the continuous camera, dimensional venues, crowd services, live staffing, ownership, research, Select mode and the subsequently accepted site overview. The expansion sequence is accepted in [CT-DEC-14](docs/DECISIONS.md#ct-dec-14-expansion-sequence): 3D Lot prototype first, then live operations. D3–D5 are also accepted A in CT-DEC-15 through CT-DEC-17. D2 B (more realistic 3D) is accepted in CT-DEC-18. D6–D11 are settled A under CT-DEC-19. Dave subsequently authorized execution of every remaining phase; the table below is the active execution sequence. Earlier shipped milestones retain their evidence and release gates.

## Active phase execution, 2026-10-04

Dave authorized continuing execution until no Front of House phases remain. Codex owns routine decisions under CT-DEC-19; do not reopen D1–D11. This sequence reconciles the existing briefs, remaining original-tier work and release criteria. Historical shipped sections below remain source history. Implementation, delivery and human/device acceptance are separate states in [NEXT_STEPS.json](docs/NEXT_STEPS.json).

| ID | Phase / scope | Source | Depends on | Completion check |
| --- | --- | --- | --- | --- |
| FOH-F01 | Foundation: Phone Book/Promote containment | MXS-06 | None | All visible tabs and controls fit at 360, 375 and 390 CSS px; desktop layout and full show smoke remain valid. |
| FOH-V01 | Lot renderer: Continuous 3D Lot, realistic sample, Select and safe removal | FB-01, FB-07 | FOH-F01 | Source-owned stage/PA/bar/restroom/guest sample, four presets, picking and engine/save parity, safe gestures and context fallback; visual review recorded separately. |
| FOH-P01 | Performance: Cached/adaptive rendering and stable measurement | HUD step 6, CT-DEC-17 | FOH-V01 | Deterministic CI scenes and documented measured limits; available hardware measurements and unavailable device evidence reported separately. |
| FOH-O01 | Live operations: Aggregate services, staffing and representative crowd | FB-03, FB-04 | FOH-V01 | Quiet/surge/busy-bar choices, deterministic speed/reload, finite conserved demand and one-time settlement accounting. |
| FOH-O02 | Guest operations: Food vendor, sanitation, admission and normal departure | FB-09, FB-10, FB-11 | FOH-O01 | Finite budgets/stock, serviced stalls, negotiated artist preference and conserved guest flow with no capacity inflation. |
| FOH-R01 | Research: Three-project Lot research pilot | FB-06, D6 A | FOH-O01 | Patch standards, Service training and Admission lanes have deterministic cost/progress/save rules and useful paired outcomes. |
| FOH-E01 | Ownership: Owned equipment family and reconciled career ledger | FB-05, D7 A | FOH-O01 | Purchase/rent/deploy/sell policy conserves cash and inventory through reload, cancellation and settlement. |
| FOH-V02 | Venues: Distinct rooms and remaining tier mechanics | FB-02, original phases 5–7, KI-11 | FOH-P01, FOH-O02, FOH-E01 | Club, shell and festival scenes, ticketing, held-night cancellation and stage/night accounting have tier-specific tests and playable careers. |
| FOH-U01 | Navigation: Large-site navigation and minimap disposition | FB-08, HUD step 7 | FOH-V02 | Evaluate zoomed Split Acre navigation; implement minimap if needed or record evidence-backed deferral, without claiming unbuilt work shipped. |
| FOH-L01 | Release: Acceptance evidence, manual and public promotion | RELEASE.md, D8–D11 A | FOH-V02, FOH-R01, FOH-U01 | Provenance, recovery, career, art/camera and device evidence meet release checks; promotion only after those gates are satisfied. |

Imported M4/M5 wish lists, Challenge/Endless and the broader eight-branch research proposal are not additional release phases. The scoped briefs and explicit remaining tier requirements above define this execution; do not turn an unbounded future idea list into a completion claim. Preserve deliberate exclusions and record a new scoped decision before expansion. Missing human or physical-device evidence cannot be replaced with automated results.

FOH-F01 is merged and live-verified in [PR60](https://github.com/DaveHomeAssist/mixmash/pull/60). FOH-V01a Select controls are merged and live-verified in [PR61](https://github.com/DaveHomeAssist/mixmash/pull/61). FOH-V01b has a deployed [Lot backend and preview](docs/LOT_BACKEND.md), live-verified through [PR65](https://github.com/DaveHomeAssist/mixmash/pull/65). The [18-run Metal baseline](docs/PERFORMANCE.md) establishes available-host renderer evidence at DPR 1; later exact-source full-HUD native measurements and display-transition checks are recorded in PERFORMANCE.md. Supported low-power/phone qualification, final realistic art and human acceptance remain required.

## Shipped

| Phase | What shipped | Pull request |
| --- | --- | --- |
| 0. Pre-production | GDD, decision log, rules specification, save format | [#19](https://github.com/DaveHomeAssist/mixmash/pull/19) |
| 1. Rules engine | `engine.mjs`, `data.mjs`, engine tests, the balance simulator and its CI gate | [#20](https://github.com/DaveHomeAssist/mixmash/pull/20) |
| Rename | Concert Tycoon became Front of House at `front-of-house/` (CT-DEC-06) | [#21](https://github.com/DaveHomeAssist/mixmash/pull/21) |
| 2. First playable | Lot Night: the page, the client, the isometric board, the settlement sheet, save codes and the smoke rail | [#22](https://github.com/DaveHomeAssist/mixmash/pull/22) |
| 3. The Lot | Retuned to 50 to 150 people, schema version 2, Sodium Arcade | [#24](https://github.com/DaveHomeAssist/mixmash/pull/24) |
| 4. A Lot career | Three acts, relationships, the Club unlock | [#25](https://github.com/DaveHomeAssist/mixmash/pull/25) |
| 5 to 7, plus modes | Fathom Hall, Loam Shell, Split Acre, Sandbox, wet lot. One pass, schema stays 2 | Pushed to `gh-pages` directly (`40da936`) |

## Software spec v0.1 reconciliation (proposal)

`Front-of-House-Software-Spec-v0.1.md` is an imported design proposal, not a new release plan or an accepted decision. This repository and [DECISIONS.md](docs/DECISIONS.md) remain authoritative. Its phrase "first playable = M1 + M2" means a proposed *expanded live-show slice*: the existing Lot Night first playable shipped in [#22](https://github.com/DaveHomeAssist/mixmash/pull/22). Public release still waits on Dave's playtest sign-off.

| Draft milestone | Repository reconciliation | Status |
| --- | --- | --- |
| M0 baseline | The rules, current save version, renderer, venues and HUD are documented here and in `SAVE_FORMAT.md`. | Existing; review again before any new engine work |
| M1 owned assets, ledger, calendar | Layouts carry across shows but gear is rented each night; cash is whole dollars and no transaction ledger or calendar exists. [Proposed transition rules](docs/SAVE_FORMAT.md#proposed-next-save-and-economy-transition) do not authorize a change. | Proposal, pending economy and ownership decisions |
| M2 complete playable night | The current show has one seeded incident. Try the opt-in Lot doors staffing slice described in [FUTURE.md](docs/FUTURE.md#lot-live-show-experiment-proposal), then collect player feedback. | Experiment; not a new first playable release |
| M3 venue workspace and growth | HUD steps 1 to 5 and four venue rooms are built. HUD performance is step 6 and the minimap is deferred step 7; land purchases, 64 × 64 maps and power zones are unapproved. | Partly shipped, partly proposed |
| M4 careers and competition | Artist tiers, travel, charts, rentals, rivals and holidays need separate scope and rules after the small show and economy tests. | Proposal |
| M5 broader campaign | The room ladder, Sandbox and the wet-lot scenario are playable; multi-city and larger maps are not. CT-DEC-10 and CT-DEC-11 remain Proposed despite their code. | Partly shipped, partly proposed |

The accepted HUD is [CT-DEC-12](docs/DECISIONS.md#ct-dec-12-hud-layout): Build tools in the bottom-left corner, forms in right-side sheets, settlement in its own window, no page or panel scrolling at 1024 × 700 and up except the history window, and phone tabs in a bottom sheet. The draft's bottom build tray does not supersede this layout. New show controls must fit the existing corner card and phone tab without scrolling. First test whether another meaningful choice improves a Lot night. Only then decide on a full clock, venue purchases, or a larger crowd simulation.

## Research and upgrades (proposed development track)

The design is [RESEARCH.md](docs/RESEARCH.md), recorded as [CT-DEC-13](docs/DECISIONS.md#ct-dec-13-research-and-upgrade-progression), Proposed. This track adds investment choices within the four existing tiers; it does not replace the shipped room goals or authorize a full implementation.

| Slice | Proposed scope | Done when |
| --- | --- | --- |
| Lot experiment | Patch standards, Service training, Admission lanes; one project slot; cash, department experience and progress across settled nights | Deterministic accounting and save tests pass; player-visible paired comparisons show different useful choices; players understand unlock versus deployment; normal careers remain unchanged when disabled |
| Guest services and staffed operations | Restroom servicing, vendor agreements, ticketing, supervisors and coordination | Their service constraints, finite demand and recurring costs exist; baseline provisions remain available; trade-offs survive playtesting |
| Venue and production networks | Installed infrastructure, distributed sound and services, event control and expanded multi-stage operations | Asset tenure and ledger rules are accepted; venue and tier dependencies have no circular gates; older saves keep their room access and booked terms |

These rows describe the original research proposal. The three-project pilot, live guest services and equipment ledger now have bounded implementations; current scope and evidence are maintained in [NEXT_STEPS.json](docs/NEXT_STEPS.json). Further venue networks remain open. Follow the [acceptance gates](docs/RESEARCH.md#10-acceptance-and-balancing), retain public-release gates, and update the rules and save specification before each implementation slice.

## Phase 5: the Club (original scope, partly outstanding)

Shipped in the same pass as Phases 6 and 7. See CT-DEC-11. The Club is a grid with a house PA. The Lot stays bookable. What that pass does not include (a ticketing platform, a real slope, new simulator verdicts, four venue art looks) is listed in the decision.

## Later phases

The table below is the original scope. The playable slice is the decision, not this table.

| Phase | Tier | Scope (from GDD section 5) | Done when |
| --- | --- | --- | --- |
| 5 | The Club (150 to 600) | An indoor venue with a house PA and lighting rig, regional touring acts, ticketing platforms | The Club plays a full show and a run of shows from the Lot goal's unlock, and the simulator verdicts pass at its scale |
| 6 | The Amphitheater (600 to 2,500) | National acts, runs of several nights, seated and general-admission zones | The same, plus multi-night runs settle correctly night by night |
| 7 | The Festival Grounds (2,500 to 25,000+) | Headliners, sponsorship deals, multi-stage festival operations, broadcast rights | The same, plus a multi-stage day settles stage by stage |

Sandbox and the wet-lot scenario are in the same pass. Challenge and Endless are still after v1.

Historical checkpoint (2026-10-04, superseded by PR117/119/120 delivery): Club ticketing, independent Amphitheater seat/lawn prices, held-night cancellation, Festival stage/site and sponsor/headliner rules, outdoor room profiles, spatial delay coverage and the three technical room previews are delivered. The delay-tower preview correction is in CI. A separate thirty-seed full career verifier passes locally under FOH-V02d, including515signed shows and exact save/reload pairs; CI and delivery remain pending. The existing Lot baseline is unchanged. VIP/bus infrastructure, balance, final art and physical/human acceptance remain open. See [NEXT_STEPS.json](docs/NEXT_STEPS.json) for distinct source, local, CI and hosted proof.

## HUD layout (CT-DEC-12)

Accepted by Dave on 2026-10-01. The board fills the window and the controls float in the corners the lot's diamond leaves empty. The spec, mockups and numbers are in [`docs/HUD.md`](docs/HUD.md). Each step is its own pull request and leaves the game playable.

| Step | Scope | Done when | Status |
| --- | --- | --- | --- |
| 1. Camera | Fit, zoom and pan in `board.js`, behind today's layout | `tileAt` and `iso` round-trip at every zoom and view turn, and clicks still hit the right prop | Done 2026-10-01 |
| 2. Full-window board | The canvas fills the window; the header becomes a top strip; save, help and the credit move into a menu | The canvas covers the window and the page never scrolls at 1024 × 700 and up | Done 2026-10-01 |
| 3. Build and Show HUD | Corner panels, tool keys 1 to 8, the camera buttons, the incident card | The HUD covers no more than 2% of the lot at fit, and the lot covers at least 30% of the window (35% at 1280 × 800 and 1440 × 900) | Done 2026-10-02 |
| 4. Sheets | Book, Promote and Done in a sheet on the right; the settlement and show history in their own windows; deal explanations on the first show only | The lot re-fits beside an open sheet, and no sheet or window scrolls at 1024 × 700 and up apart from show history | Done 2026-10-02 |
| 5. Phone | The compact strip and the bottom sheet, with tabs so nothing scrolls (decision 12) | At 390 × 844: no horizontal scroll, every control reachable, the board takes at least 45% of the height, and no tab scrolls | Done 2026-10-02 |
| 6. Performance | The floor cache, the pixel-ratio rule, a frame-time check | Stable CI regression scenes plus declared 60fps desktop / 30fps low-power device targets; measurement thresholds fixed after baselines (CT-DEC-17) | Delivered: floor cache, density handling, render batching and measured paired CI limits (CT-DEC-21); physical low-power qualification remains open. |
| 7. Minimap | The whole room in a small corner panel with the camera's view rectangle; a click moves the camera. Shown only when zoomed in past fit; hidden on phones | Correct at every zoom, view turn and room; a click centres the camera; hidden at fit; the frame budget still holds | Earlier deferral superseded by CT-DEC-23: bounded site overview delivered through PR107, with hosted desktop/tablet navigation and phone containment checks. |

## Phase 3: tier 1, the Lot (shipped)

Retune the first playable to the Lot's 50 to 150 people, and start this roadmap.

- The Oak St. Lot is permitted for 150 (`PERMIT_CAP`), and the act, renamed Sodium Arcade, draws 75 to 130. Velvet Static, the old name, belongs to a real UK indie band, which CT-DEC-03 rules out.
- Every per-person value (floor density, exit capacity, PA coverage, bar and restroom ratios, security ratio) and every money value (starting cash, rentals, staff rate, the artist's ask, incident responses, ad saturation and limits) was halved from the 300-person version. Demand, attendance and money all scale together, so the balance shape the simulator verified carries over: all six verdicts pass, and the guarantee's pass rate with free responses moved from 58.2% to 58.6%.
- The worked example halved with it: 125 attend with satisfaction 85; the guarantee nets +$248 and the door deal +$671.
- Saves move to schema version 2. Version 1 saves and save codes convert to the new scale (`docs/SAVE_FORMAT.md`).

**Done when:** the engine tests, the six balance verdicts and the smoke rail pass at the Lot scale, and a version 1 save converts through both the store and the Save and load panel.

## Phase 4: a Lot career (shipped)

A run of shows on the Lot, so the first tier is a career rather than one night ([CT-DEC-10](docs/DECISIONS.md#ct-dec-10-the-lot-career), Proposed; rules R-19 to R-21).

- **Next show continues** after any settlement, with cash, venue reputation, relationships, the layout and the history carried over. Only running out of money (below the cheapest show the next acts on offer will take: $1,025 on a door deal, more when both want a guarantee) ends a run. Start over is always open and begins a new career with only the layout kept.
- **A roster of three fictional acts** ([`docs/WORLD.md`](docs/WORLD.md)): Gravel Hymnal, Sodium Arcade and Juniper Switchboard. Each show offers two.
- **Relationships change terms:** the ask and the draw follow the relationship, a soured act refuses door deals, and Juniper Switchboard only plays for a guarantee.
- **The Lot goal unlocks the Club:** a sellout, venue reputation 60, $6,000, and one act at +20. The Book screen shows each offer's terms; the Done screen shows the goal's progress.
- **Simulator coverage:** careful and careless careers on 300 seeds, with five new verdicts (careful play reaches the Club, it takes a run of shows, care matters, every act gets booked, careful careers never run out of money).

**Done when:** a player can play at least five shows in a row on the Lot with cash, reputation and relationships carried between them; relationship changes the next offer; the tier goal is reachable in the simulator but not on every seed (careless play reaches it on about 42%); and any save change keeps old saves playing (two optional fields, no version bump).

## Review refinement (2026-10-02)

The accepted mockup review is applied to the existing steps 1 to 5: honest Show status, consequence-based incident copy, equipment location, phone sheet controls and light/dark controls. See [HUD.md](docs/HUD.md#review-refinement-2026-10-02). Engine rules, saves and the optional Lot doors experiment are unchanged.

Current follow-up: model15 guest anatomy, projected detail and buffer reuse are delivered through [PR122](https://github.com/DaveHomeAssist/mixmash/pull/122), with final paired CI, independent raw audit and complete hosted/offline/recovery proof. Complete final realistic art/physical calibration, current native and supported phone/low-power qualification, human camera/art and career acceptance; retain all prior renderer failures alongside the corrected final-source pass. Performance infrastructure and the site overview are delivered; older roadmap proposals remain historical rather than additional authorized phases.

## Separate tracks

- **Public release of the first playable** waits on Dave's playtest sign-off. On sign-off: a hub card on the landing page with a gameplay preview and its provenance, a sitemap entry, and `noindex` removed.
- **Art.** Classic raster props remain provisional. The source-authored model12 sample and render contract are delivered; final realistic style, physical calibration and image provenance remain open in [ART_DIRECTION.md](docs/ART_DIRECTION.md) and [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).
- **HUD layout.** Accepted 2026-10-01 (CT-DEC-12). All seven technical steps, including the subsequently accepted site overview, have delivery evidence in [HUD layout](#hud-layout-ct-dec-12) above.
- **Documentation.** The [player manual](docs/MANUAL.md) is delivered. [WORLD.md](docs/WORLD.md) retains historical checks and current screening for all fifteen act/room names.

### 2026-10-04 execution checkpoint

Festival profiles and spatial delays are delivered through PR106/PR108 and verified on combined production137db3a. Outdoor set timing CT-DEC-24 is implemented and locally verified; its release gates remain. Included Club lighting now passes local accounting, browser and offline acceptance; its CI/deployment proof follows. Continue Festival VIP/bus infrastructure, whole-tier simulator/career acceptance and remaining release gates. The current production source includes the parallel technical venue scenes and site overview; preserve and verify those instead of duplicating them.


### Festival touring support checkpoint

Version1 Festival touring-support core passes432 repository tests, five dedicated integration cases, build/docs/catalog/assets and unchanged Lot simulator. Both fixtures use normal placement, consume30 tiles and8kW, require readiness on marked bookings and add exactly1500 once to shared-site opening costs. All legal deal paths, stage/site/journal/signing/reload, malformed-marker recovery and960 unmarked transitions/120 receipts pass. Player controls and detailed models follow; core CI/Pages/hosted acceptance remains pending.

PR110 passed CI37251718667, merged4dee773b11fca9a201206798b6cd9cb3d3692097; Pages built2026-10-05T02:00:26Z. Nine affected hosted files match. Eight Chromium/WebKit player journeys pass both outdoor rooms, deals/responses, compact sizes/themes and signed replay. Offline appeal preserves148 played minutes,20 lost,400 fee,27752 net and1027752 cash/journal. Actual hosted Set time capture inspected.


### Touring controls under verification

Festival touring controls and source-authored deck/coach models are implemented.432 repository tests,77 final targeted checks, build/docs/assets and the100-seed earned tier cohort pass; careful completion remains99/100 with every completed career settling another day. Both browsers select both3D props at37/135 degrees on desktop and touch phone. Actual full orbit/zoom, screenshots, supplied action runner and offline1500 touring rental/stage/journal replay pass. Chromium player journeys pass; final both-browser, full regression, CI and hosted acceptance are still running or pending.
