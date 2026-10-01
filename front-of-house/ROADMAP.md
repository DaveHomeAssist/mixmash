# Front of House Roadmap

The phases from the first document to the last career tier. Each phase ships as its own pull request, merges only when CI is green, and ends at its **Done when** line. The career tiers come from [CT-DEC-09](docs/DECISIONS.md#ct-dec-09-career-tier-ladder); what each tier contains is in [GDD section 5](docs/GDD.md#5-progression).

## Shipped

| Phase | What shipped | Pull request |
| --- | --- | --- |
| 0. Pre-production | GDD, decision log, rules specification, save format | [#19](https://github.com/DaveHomeAssist/mixmash/pull/19) |
| 1. Rules engine | `engine.mjs`, `data.mjs`, engine tests, the balance simulator and its CI gate | [#20](https://github.com/DaveHomeAssist/mixmash/pull/20) |
| Rename | Concert Tycoon became Front of House at `front-of-house/` (CT-DEC-06) | [#21](https://github.com/DaveHomeAssist/mixmash/pull/21) |
| 2. First playable | Lot Night: the page, the client, the isometric board, the settlement sheet, save codes and the smoke rail | [#22](https://github.com/DaveHomeAssist/mixmash/pull/22) |

## Phase 3: tier 1, the Lot (this phase)

Retune the first playable to the Lot's 50 to 150 people, and start this roadmap.

- The Oak St. Lot is permitted for 150 (`PERMIT_CAP`), and Velvet Static draws 75 to 130.
- Every per-person value (floor density, exit capacity, PA coverage, bar and restroom ratios, security ratio) and every money value (starting cash, rentals, staff rate, the artist's ask, incident responses, ad saturation and limits) was halved from the 300-person version. Demand, attendance and money all scale together, so the balance shape the simulator verified carries over: all six verdicts pass, and the guarantee's pass rate with free responses moved from 58.2% to 58.6%.
- The worked example halved with it: 125 attend with satisfaction 85; the guarantee nets +$248 and the door deal +$671.
- Saves move to schema version 2. Version 1 saves and save codes convert to the new scale (`docs/SAVE_FORMAT.md`).

**Done when:** the engine tests, the six balance verdicts and the smoke rail pass at the Lot scale, and a version 1 save converts through both the store and the Save and load panel.

## Next: Phase 4, a Lot career

A run of shows on the Lot, so the first tier is a career rather than one night.

- **Next show continues.** After a pass, the player books another show on the same lot, with cash, venue reputation, relationships and the layout carried over (the engine's `nextShow` already does this).
- **A small roster.** Two or three more fictional acts (CT-DEC-03) inside the Lot's draw range, each with its own genre, fair price and ask.
- **Relationships change terms.** An artist the player treated well returns with a lower ask or a bigger draw; one who was underpaid asks for more or turns the offer down. This is what makes the guarantee worth choosing over a run of shows, which answers the open balance question that the door deal pays more on any single night.
- **A tier goal.** A clear target that unlocks the Club, for example selling out the Lot and reaching a venue reputation threshold. The exact goal is a decision to record before building.
- **Simulator coverage for a run.** The simulator plays several shows in a row and adds verdicts for the career: the goal is reachable, not trivial, and both deals have a place in a winning run.

**Done when:** a player can play at least five shows in a row on the Lot with cash, reputation and relationships carried between them; relationship changes the next offer; the tier goal is reachable in the simulator but not on every seed; and any save schema change has a migration and a frozen fixture.

## Later phases

| Phase | Tier | Scope (from GDD section 5) | Done when |
| --- | --- | --- | --- |
| 5 | The Club (150 to 600) | An indoor venue with a house PA and lighting rig, regional touring acts, ticketing platforms | The Club unlocks from the Lot goal, plays a full show and a run of shows, and the simulator verdicts pass at its scale |
| 6 | The Amphitheater (600 to 2,500) | National acts, runs of several nights, seated and general-admission zones | The same, plus multi-night runs settle correctly night by night |
| 7 | The Festival Grounds (2,500 to 25,000+) | Headliners, sponsorship deals, multi-stage festival operations, broadcast rights | The same, plus a multi-stage day settles stage by stage |

Sandbox and Scenario modes (CT-DEC-01) reuse the career systems and follow once tier 2 is playable.

## Separate tracks

- **Public release of the first playable** waits on Dave's playtest sign-off. On sign-off: a hub card on the landing page with a gameplay preview and its provenance, a sitemap entry, and `noindex` removed.
- **Art** follows `docs/ART_DIRECTION.md`: settle the open conflicts in its section 8 and write the render contract before any sprite work (art Phases 2 and 3).
- **Documents that start later:** `docs/MANUAL.md` once the loop is stable, and `docs/WORLD.md` once there is more than one artist (Phase 4).
