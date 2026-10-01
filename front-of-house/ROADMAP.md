# Front of House Roadmap

The phases from the first document to the last career tier. Each phase ships as its own pull request, merges only when CI is green, and ends at its **Done when** line. The career tiers come from [CT-DEC-09](docs/DECISIONS.md#ct-dec-09-career-tier-ladder); what each tier contains is in [GDD section 5](docs/GDD.md#5-progression).

## Shipped

| Phase | What shipped | Pull request |
| --- | --- | --- |
| 0. Pre-production | GDD, decision log, rules specification, save format | [#19](https://github.com/DaveHomeAssist/mixmash/pull/19) |
| 1. Rules engine | `engine.mjs`, `data.mjs`, engine tests, the balance simulator and its CI gate | [#20](https://github.com/DaveHomeAssist/mixmash/pull/20) |
| Rename | Concert Tycoon became Front of House at `front-of-house/` (CT-DEC-06) | [#21](https://github.com/DaveHomeAssist/mixmash/pull/21) |
| 2. First playable | Lot Night: the page, the client, the isometric board, the settlement sheet, save codes and the smoke rail | [#22](https://github.com/DaveHomeAssist/mixmash/pull/22) |

## Phase 3: tier 1, the Lot

Retune the first playable to the Lot's 50 to 150 people, and start this roadmap.

- The Oak St. Lot is permitted for 150 (`PERMIT_CAP`), and the act, renamed Sodium Arcade, draws 75 to 130. Velvet Static, the old name, belongs to a real UK indie band, which CT-DEC-03 rules out.
- Every per-person value (floor density, exit capacity, PA coverage, bar and restroom ratios, security ratio) and every money value (starting cash, rentals, staff rate, the artist's ask, incident responses, ad saturation and limits) was halved from the 300-person version. Demand, attendance and money all scale together, so the balance shape the simulator verified carries over: all six verdicts pass, and the guarantee's pass rate with free responses moved from 58.2% to 58.6%.
- The worked example halved with it: 125 attend with satisfaction 85; the guarantee nets +$248 and the door deal +$671.
- Saves move to schema version 2. Version 1 saves and save codes convert to the new scale (`docs/SAVE_FORMAT.md`).

**Done when:** the engine tests, the six balance verdicts and the smoke rail pass at the Lot scale, and a version 1 save converts through both the store and the Save and load panel.

## Phase 4: a Lot career

A run of shows on the Lot, so the first tier is a career rather than one night ([CT-DEC-10](docs/DECISIONS.md#ct-dec-10-the-lot-career), Proposed; rules R-19 to R-21).

- **Next show continues** after any settlement, with cash, venue reputation, relationships, the layout and the history carried over. Only running out of money (below the cheapest show the next acts on offer will take: $1,025 on a door deal, more when both want a guarantee) ends a run. Start over is always open and begins a new career with only the layout kept.
- **A roster of three fictional acts** ([`docs/WORLD.md`](docs/WORLD.md)): Gravel Hymnal, Sodium Arcade and Juniper Switchboard. Each show offers two.
- **Relationships change terms:** the ask and the draw follow the relationship, a soured act refuses door deals, and Juniper Switchboard only plays for a guarantee.
- **The Lot goal unlocks the Club:** a sellout, venue reputation 60, $6,000, and one act at +20. The Book screen shows each offer's terms; the Done screen shows the goal's progress.
- **Simulator coverage:** careful and careless careers on 300 seeds, with five new verdicts (careful play reaches the Club, it takes a run of shows, care matters, every act gets booked, careful careers never run out of money).

**Done when:** a player can play at least five shows in a row on the Lot with cash, reputation and relationships carried between them; relationship changes the next offer; the tier goal is reachable in the simulator but not on every seed (careless play reaches it on about 42%); and any save change keeps old saves playing (two optional fields, no version bump).

## Next: Phase 5, the Club

Tier 2, unlocked by the Lot goal: an indoor venue for 150 to 600 people with a house PA and lighting rig, regional touring acts, and ticketing platforms. Decide first how the Club's room is built (a fixed floor plan or a grid like the Lot) and whether the Lot stays playable after the unlock.

## Later phases

| Phase | Tier | Scope (from GDD section 5) | Done when |
| --- | --- | --- | --- |
| 5 | The Club (150 to 600) | An indoor venue with a house PA and lighting rig, regional touring acts, ticketing platforms | The Club plays a full show and a run of shows from the Lot goal's unlock, and the simulator verdicts pass at its scale |
| 6 | The Amphitheater (600 to 2,500) | National acts, runs of several nights, seated and general-admission zones | The same, plus multi-night runs settle correctly night by night |
| 7 | The Festival Grounds (2,500 to 25,000+) | Headliners, sponsorship deals, multi-stage festival operations, broadcast rights | The same, plus a multi-stage day settles stage by stage |

Sandbox and Scenario modes (CT-DEC-01) reuse the career systems and follow once tier 2 is playable.

## Separate tracks

- **Public release of the first playable** waits on Dave's playtest sign-off. On sign-off: a hub card on the landing page with a gameplay preview and its provenance, a sitemap entry, and `noindex` removed.
- **Art** follows `docs/ART_DIRECTION.md`: settle the open conflicts in its section 8 and write the render contract before any sprite work (art Phases 2 and 3).
- **Documents that start later:** `docs/MANUAL.md` once the loop is stable. `docs/WORLD.md` started in Phase 4.
