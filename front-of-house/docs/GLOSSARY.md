# Front of House Glossary

**Status:** Active from 2026-10-02. Hand-written.

One meaning per term, used the same way in the code, the documents and on screen. The rule that computes each number is linked; values live in `data.mjs`.

## Game terms

| Term | Meaning | Where |
| --- | --- | --- |
| **Act** | The artist booked for a show. Fictional, with a name check in WORLD.md | `ARTISTS`; [CATALOG.md](CATALOG.md#9-acts) |
| **Ask** | What an act expects to be paid; the guarantee's amount. Moves with the relationship | [R-19](RULES.md#r-19-offers-and-terms) |
| **Attendance** | People who came: presales plus walk-up, capped by capacity | [R-08](RULES.md#r-08-attendance) |
| **Band** (meter) | On-screen label for the booked act's relationship | KNOWN_ISSUES.md KI-05 |
| **Buzz** | The multiplier ads give demand | [R-05](RULES.md#r-05-buzz) |
| **Capacity** | The fewest of: the permit, people the clear floor holds, and what the exits allow | [R-01](RULES.md#r-01-capacity) |
| **Career** | The default mode: a run of shows from the Lot up through the rooms | [CATALOG.md](CATALOG.md#5-modes) |
| **Clear view** | Floor tiles inside the stage's sight cone with nothing blocking them | [R-03](RULES.md#r-03-sightlines) |
| **Door deal** | The act takes `DOOR_SPLIT` of ticket money after show costs, paid at settlement | [R-14](RULES.md#r-14-artist-payment) |
| **Doors** | 19:00 on show night, when the gate opens | [SCREENS.md](SCREENS.md#5-show-night-timeline) |
| **Doors crew** | The opt-in trial (`?night-slice=1`) that moves a bar worker to the gate | [RULES.md](RULES.md#opt-in-lot-doors-experiment-trial-only) |
| **Draw** | How many people an act would bring at the fair price with no ads; rolled per show | [R-06](RULES.md#r-06-demand) |
| **Due before doors** | All show costs except the incident response, plus a guarantee | [R-12](RULES.md#r-12-cash-timing) |
| **Fair price** | The ticket price an act's fans expect | `ARTISTS[].fairPrice` |
| **Guarantee** | A fixed payment to the act before doors; the promoter keeps the rest | [R-14](RULES.md#r-14-artist-payment) |
| **Handling score** | The share of the incident part of satisfaction a response earns | [R-11](RULES.md#r-11-incidents) |
| **Incident** | The one thing that goes wrong each show, with a choice of responses | [R-11](RULES.md#r-11-incidents) |
| **Incident window** | The part of show night an incident can happen in | [R-11a](RULES.md#r-11a-incident-timing) |
| **Lot** | Oak St. Lot, tier 1: a rented parking lot for up to 150 people | [CATALOG.md](CATALOG.md#6-rooms) |
| **Net** | The promoter's result: ticket money plus bar takings, minus show costs and the act's pay | [R-15](RULES.md#r-15-net-result) |
| **Offer** | One of the two acts that want the next date | [R-19](RULES.md#r-19-offers-and-terms) |
| **Pass** | A show that made money and scored at least `PASS_SATISFACTION` | [R-15](RULES.md#r-15-net-result) |
| **Permit** | The legal headcount for a room | `VENUES[].permit` |
| **Presale** | Tickets sold before show day; never lost to incidents | [R-07](RULES.md#r-07-presale-and-walk-up) |
| **Relationship** | How an act feels about the promoter, −100 to 100; changes the ask, the draw and whether it takes a door deal | [R-17](RULES.md#r-17-artist-relationship) |
| **Room** | A venue: the Lot, Fathom Hall, Loam Shell or Split Acre. Code calls it `venue` | `VENUES` |
| **Run** | A booking of more than one night at Loam Shell; each night settles on its own | [Rooms after the Lot](RULES.md#rooms-after-the-lot-ct-dec-11) |
| **Satisfaction** | The crowd's score out of 100 from sound, sightlines, amenities, entry flow and the incident | [R-09](RULES.md#r-09-satisfaction) |
| **Sellout** | A show whose attendance reached the room's permit | [R-20](RULES.md#r-20-the-lot-goal) |
| **Settlement** | The end-of-night sheet that splits the money; signing it applies cash and reputation | [R-12 to R-17](RULES.md#money) |
| **Show costs** | Rent, permit, fence, rentals, bars, restrooms, staff, ads and the incident response | [R-13](RULES.md#r-13-show-costs) |
| **Suggested layout** | The room's starter layout, placed in one click | `STARTER_LAYOUT`, `VENUES[].starter` |
| **Tier** | A step of the career ladder; each room is one tier | CT-DEC-09 |
| **Venue reputation** | The promoter's standing with audiences, 0 to 100; adds demand | [R-16](RULES.md#r-16-venue-reputation) |
| **Walk-up** | Tickets bought at the gate on the night; rain and curfew can cut it | [R-07](RULES.md#r-07-presale-and-walk-up) |

## Project terms

| Term | Meaning |
| --- | --- |
| **Asset register** | `sprites/manifest.mjs`: the hand-kept record of each image's subject, status and source. ASSETS.md is generated from it |
| **Balance baseline** | BALANCE_BASELINE.md: simulator tables and pass/fail verdicts, generated and checked in CI |
| **CT-DEC-NN** | A decision in DECISIONS.md. Proposed until Dave accepts it |
| **Generated document** | A file written by a script and checked in CI: BALANCE_BASELINE.md, ASSETS.md, CATALOG.md, STRINGS.md. Never edited by hand |
| **R-NN** | A rule in RULES.md, implemented in `engine.mjs` and tested in `test-engine.mjs` |
| **Reference layout** | The layout the tests and simulator use; the same as the Lot's suggested layout |
| **Smoke rail** | `npm run smoke:front-of-house`: the real-browser checks in `test/front-of-house-smoke.mjs` |
| **Stand-in** | Provisional art that will be replaced; the current board sprites |
| **Style anchor** | The first approved pixel-art set that replaces the stand-ins (ART_DIRECTION.md) |
