# Front of House Roadmap

**Status:** Phases 0 to 7 are in the tree (see [`progress.md`](progress.md)). Phases 5 to 7 shipped in one pass ([CT-DEC-11](docs/DECISIONS.md#ct-dec-11-rooms-after-the-lot), Proposed), not as separate pull requests. The public release still waits on Dave's sign-off. The [HUD layout](#hud-layout-ct-dec-12) is under way: steps 1 to 3 are done (the board camera, the full-window board that never scrolls, and the Build and Show corner HUD), and step 4, the sheets and windows for Book, Promote, Settle and Done, is next. Since 2026-10-02 no panel scrolls either ([HUD.md](docs/HUD.md) section 9).

The phases from the first document to the last career tier. Each phase ships as its own pull request, merges only when CI is green, and ends at its **Done when** line. The career tiers come from [CT-DEC-09](docs/DECISIONS.md#ct-dec-09-career-tier-ladder); what each tier contains is in [GDD section 5](docs/GDD.md#5-progression).

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

## Next: Phase 5, the Club

Shipped in the same pass as Phases 6 and 7. See CT-DEC-11. The Club is a grid with a house PA. The Lot stays bookable. What that pass does not include (a ticketing platform, a real slope, new simulator verdicts, four venue art looks) is listed in the decision.

## Later phases

The table below is the original scope. The playable slice is the decision, not this table.

| Phase | Tier | Scope (from GDD section 5) | Done when |
| --- | --- | --- | --- |
| 5 | The Club (150 to 600) | An indoor venue with a house PA and lighting rig, regional touring acts, ticketing platforms | The Club plays a full show and a run of shows from the Lot goal's unlock, and the simulator verdicts pass at its scale |
| 6 | The Amphitheater (600 to 2,500) | National acts, runs of several nights, seated and general-admission zones | The same, plus multi-night runs settle correctly night by night |
| 7 | The Festival Grounds (2,500 to 25,000+) | Headliners, sponsorship deals, multi-stage festival operations, broadcast rights | The same, plus a multi-stage day settles stage by stage |

Sandbox and the wet-lot scenario are in the same pass. Challenge and Endless are still after v1.

A ticketing platform was in the Phase 5 list and is not built. The shell is a grid with seats, not a hillside. Simulator verdicts for the new tiers are not in CI. The Lot baseline is unchanged (all 11 verdicts still pass).

## HUD layout (CT-DEC-12)

Accepted by Dave on 2026-10-01. The board fills the window and the controls float in the corners the lot's diamond leaves empty. The spec, mockups and numbers are in [`docs/HUD.md`](docs/HUD.md). Each step is its own pull request and leaves the game playable.

| Step | Scope | Done when | Status |
| --- | --- | --- | --- |
| 1. Camera | Fit, zoom and pan in `board.js`, behind today's layout | `tileAt` and `iso` round-trip at every zoom and view turn, and clicks still hit the right prop | Done 2026-10-01 |
| 2. Full-window board | The canvas fills the window; the header becomes a top strip; save, help and the credit move into a menu | The canvas covers the window and the page never scrolls at 1024 × 700 and up | Done 2026-10-01 |
| 3. Build and Show HUD | Corner panels, tool keys 1 to 8, the camera buttons, the incident card | The HUD covers no more than 2% of the lot at fit, and the lot covers at least 30% of the window (35% at 1280 × 800 and 1440 × 900) | Done 2026-10-02 |
| 4. Sheets | Book, Promote and Done in a sheet on the right; the settlement and show history in their own windows; deal explanations on the first show only | The lot re-fits beside an open sheet, and no sheet or window scrolls at 1024 × 700 and up apart from show history | Next |
| 5. Phone | The compact strip and the bottom sheet | At 390 × 844: no horizontal scroll, every control reachable, and the board takes at least 45% of the height | Not started |
| 6. Performance | The floor cache, the pixel-ratio rule, a frame-time check | Show night at 1920 × 1080 keeps the 95th-percentile frame under 16 ms in the smoke rail | Not started |
| 7. Minimap | The whole room in a small corner panel with the camera's view rectangle; a click moves the camera. Shown only when zoomed in past fit; hidden on phones | Correct at every zoom, view turn and room; a click centres the camera; hidden at fit; the frame budget still holds | **Deferred** by Dave on 2026-10-01. Starts after step 1 ships and Split Acre is being played zoomed in |

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

## Separate tracks

- **Public release of the first playable** waits on Dave's playtest sign-off. On sign-off: a hub card on the landing page with a gameplay preview and its provenance, a sitemap entry, and `noindex` removed.
- **Art.** Provisional prop sprites are on the board as of 2026-10-01. They are a stand-in. The style anchor still waits on the render contract and the open conflicts in `docs/ART_DIRECTION.md` section 8. The order is in `docs/FUTURE.md`.
- **HUD layout.** Accepted 2026-10-01 (CT-DEC-12). Its seven steps, the deferred minimap included, are in [HUD layout](#hud-layout-ct-dec-12) above.
- **Documents that start later:** `docs/MANUAL.md` once the loop is stable. `docs/WORLD.md` started in Phase 4.
