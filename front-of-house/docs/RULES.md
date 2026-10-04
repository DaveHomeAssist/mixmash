# Front of House Rules Specification

**Status:** Implemented in `front-of-house/engine.mjs` (engine version 1) · **Scope:** the first playable loop, "Lot Night" ([GDD section 4](GDD.md#4-the-first-playable-loop-lot-night)), and the Lot career (R-19 to R-21, [CT-DEC-10](DECISIONS.md#ct-dec-10-the-lot-career))
**Decisions:** [CT-DEC-02](DECISIONS.md#ct-dec-02-engine-and-art) (deterministic engine), [CT-DEC-07](DECISIONS.md#ct-dec-07-documentation-source-of-truth) (numbers live in code)

Each rule has an ID (`R-NN`), its inputs and output, a formula, and the names of the adjustable values it uses. Tests in `front-of-house/test-engine.mjs` and comments in `front-of-house/engine.mjs` cite the rule ID.

> **Where the numbers live:** every adjustable value and content table (objects, artists, incidents) is in [`front-of-house/data.mjs`](../data.mjs). This document names values instead of repeating them. The worked example at the end is the exception; it is engine test `R-WORKED-01` and a balance simulator verdict, so it can't drift. After changing a value, run `npm run sim:front-of-house` and commit the regenerated [balance baseline](BALANCE_BASELINE.md).

## General conventions

- **Money** is whole dollars (integers). Rounding uses `Math.round` (halves round up) wherever a rule says `round`.
- **Determinism:** every random value comes from one seeded generator (mulberry32 seeded with `state.seed`). Values are drawn in a fixed order: artist draw, incident type, incident timing (`rollShow`; the timing roll is placed in the incident's window by [R-11a](#r-11a-incident-timing)). The offers (R-19) come from a second generator seeded with `seed XOR 0x5bd1e995`, so they never shift the show's own rolls. The same seed and the same player choices produce the same settlement, down to the dollar.
- **The engine never touches the DOM.** `applyAction(state, action)` returns `{ state, error }`; the input state is never changed.
- `clamp(v, lo, hi)` limits `v` to the range `[lo, hi]`.
- **Per-person parts:** where a rule divides a supply by `attendance`, the part is 1 when attendance is 0.

## Venue

### R-01: Capacity

`capacity = min(PERMIT_CAP, floor(FLOOR_DENSITY × openFloorTiles), EXIT_CAPACITY × exits)`

- `openFloorTiles`: grid tiles not covered by any placed object.
- Output: the most people allowed in. `evaluateVenue` also reports which limit applies (`permit`, `floor` or `exits`).

### R-02: Power budget

The total power drawn by placed objects (`OBJECT_TYPES[type].watts`) must not exceed `GENERATOR_WATTS`. A placement that would go over is refused, with a message naming the object and the total. The generator comes with the lot rental and is not placed on the grid.

### R-03: Sightlines

`clearTiles` counts open tiles that lie within `SIGHT_RANGE` tiles of the middle of the stage front, inside a cone of `SIGHT_CONE_DEGREES` around the direction the stage faces, with a straight line to the middle of the stage front that crosses no object marked `blocksSight` (bar, restroom, light tower).

`sightlines = min(1, clearTiles × FLOOR_DENSITY / attendance)`, a value from 0 to 1: the share of the crowd that can stand somewhere with a clear view.

### R-18: Placement and build requirements

- Objects must lie fully inside the grid, must not overlap, and use a rotation from 0 to 3 (rotations 1 and 3 swap width and height). The stage faces down the grid at rotation 0 and turns a quarter clockwise per step.
- Gates and exits (`edge`) must sit on the lot boundary.
- The PA (`nextToStage`) must touch the stage along a tile edge.
- At most one stage, one PA (small or medium), one light tower and one fence kit (`max` per `group`).
- **To confirm Build:** a stage, a PA, the fence kit, at least one gate, at least one exit, no invalid objects, and a capacity above 0.

## Demand and attendance

### R-04: Price factor

`priceFactor = clamp(PRICE_BASE − PRICE_SLOPE × price / fairPrice, PRICE_FLOOR, PRICE_CEIL)`

- This gives 1.0 at the fair price, `PRICE_CEIL` at half the fair price or less, and 0.5 at double it. Ticket prices run from `PRICE_MIN` to `PRICE_MAX`.

### R-05: Buzz

`buzz = 1 + Σ over channels c of AD_REACH[c] × (1 − e^(−spend[c] / AD_SATURATION))`

- Channels are listed in `AD_CHANNELS`. Each additional dollar on a channel adds less buzz than the last. The maximum is `1 + Σ AD_REACH`; spend per channel is capped at `AD_MAX_PER_CHANNEL`.

### R-06: Demand

`demand = draw × priceFactor × buzz × (1 + venueRep / REP_DIVISOR)`

- `draw` is drawn once per show from the artist's `[drawMin, drawMax]` by the seeded generator. It is hidden from the player; `forecast(state)` gives the Promote screen an attendance range from the lowest and highest possible draw.

### R-07: Presale and walk-up

```
presaleShare = min(PRESALE_MAX, PRESALE_BASE + PRESALE_PER_BUZZ × (buzz − 1))
presale      = min(capacity, round(demand × presaleShare))
walkup       = round(demand) − presale
```

- Rain at doors multiplies walk-up by the chosen response's `walkupMult` ([R-11](#r-11-incidents)), rounded. Presales are never reduced.

### R-08: Attendance

`attendance = min(capacity, presale + walkupAfterIncident)`

## Show night

### R-09: Satisfaction

`satisfaction = round(W_SOUND × sound + W_SIGHT × sightlines + W_AMENITY × amenities + W_FLOW × flow + W_INCIDENT × incident)`, from 0 to 100.

| Part | Formula (each is 0 to 1) |
| --- | --- |
| `sound` | `min(1, PA_COVERAGE[paTier] / attendance)`, × `NO_LIGHTS_MULT` without a light tower; 0 with no PA |
| `sightlines` | R-03 |
| `amenities` | the average of `min(1, bars × BAR_RATIO / attendance)` and `min(1, restrooms × RESTROOM_RATIO / attendance)` |
| `flow` | `min(1, gates × GATE_RATE × DOORS_MINUTES / attendance) × flowMult`, where `flowMult` comes from the incident response and is 1 otherwise |
| `incident` | the chosen response's `score`; 1 if nothing went wrong |

The weights sum to 100. The settlement sheet names the **weakest** part (the largest `weight × (1 − part)`), which is the retry tip.

### R-10: Bar revenue

```
served = min(attendance, bars × BAR_RATIO)
bar    = round(BAR_NET_PER_HEAD × satisfaction / 100 × (served + (attendance − served) × BAR_SHORTFALL))
```

People beyond the bars' capacity still buy, at the reduced `BAR_SHORTFALL` rate, so one person too many never drops the takings.

### R-11: Incidents

Each show has exactly one incident from `INCIDENTS`, chosen by the seeded generator. A response costs money (added to show costs, [R-13](#r-13-show-costs)), sets the incident score, and may change walk-up (`walkupMult`) or entry flow (`flowMult`). A response the player cannot afford with current cash is refused ([R-12](#r-12-cash-timing)).

#### R-11a: Incident timing

Show night runs from doors (19:00) to curfew (23:00). Each incident has a `window` in `INCIDENTS`, a share of that night, and happens at `incidentAt = from + timing × (to − from)`, rounded to three decimals, where `timing` is `rollShow`'s third draw (`incidentAtFor`). Doors incidents (rain, gate jam) end before `ACT_ON_STAGE_AT`; set incidents (PA dropout, curfew) start after it. Timing changes when the night pauses, not any number on the sheet, so the balance baseline does not depend on it. Rooms that pick their incident with `incidentFor` place the same `timing` roll in that incident's window, and each night of a run rolls from the same seed as its incident (`seed XOR night` after the first night).

## Opt-in Lot doors experiment (trial only)

The additional prompt under `?night-slice=1` uses the current Lot, show seed, venue layout and contract. It is a test of whether a second decision is interesting, not an accepted new show rule. Ordinary shows continue to use R-09 to R-11 and the unchanged balance baseline. See [FUTURE.md](FUTURE.md#lot-live-show-experiment-proposal) for the playtest questions.

- The player chooses `bar` or `gate` once before the usual seeded incident. `gate` temporarily assigns one bar worker to the existing admission gate. No extra employee is hired, no new gate appears, and staffing cost remains unchanged. A pending choice blocks the incident response. The optional choice is saved as described in [SAVE_FORMAT.md](SAVE_FORMAT.md#opt-in-lot-show-experiment-on-schema-2).
- For this trial only, `rushCapacity = gates * GATE_RATE * LOT_PILOT_RUSH_MINUTES * (gate choice ? LOT_PILOT_GATE_MULT : 1)`; `waiting = max(0, plannedAttendance - rushCapacity)`. Only walk-ups can leave: `lostWalkups = min(max(0, plannedAttendance - presale), floor(waiting * LOT_PILOT_WALKUP_LOSS))`. Actual attendance is `plannedAttendance - lostWalkups`. Ticket holders wait but retain their tickets.
- The `gate` choice lowers one bar's service capacity by `ceil(BAR_RATIO * LOT_PILOT_BAR_CAPACITY_LOSS)`. Otherwise capacity remains `bars * BAR_RATIO`. R-09's amenities part and R-10's bar sales use this adjusted capacity; its entry flow part uses `rushAdmitted / rushArrivals`, multiplied by any existing incident flow effect. At zero arrivals, flow is 1. Everything else uses the existing show math, including pay, rent, artist compensation and settlement.
- The card displays a forecast before the incident. The signed sheet shows the actual queue and sales after the incident. The aggregate rush is a snapshot, not a pathfinding or per-person simulation. Balance tuning and the 12-second playback are unchanged for normal shows.

## Money

### R-12: Cash timing

- **Due before the show:** all show costs except the incident response, plus the guarantee if one was chosen (`upfrontFor(state)`). The Promote phase cannot be confirmed if this is more than current cash.
- **During the show:** cash on hand is what is left after those payments. Ticket money is held by the ticketing company until settlement, so incident responses must be paid from that remainder.
- **At settlement:** ticket revenue and bar revenue arrive; the door deal payment (if chosen) goes out.

### R-13: Show costs

`showCosts = LOT_RENTAL + PERMIT + PA_RENTAL[paTier] + (lights ? LIGHTS_RENTAL : 0) + bars × BAR_SETUP + restrooms × RESTROOM_UNIT + FENCE_KIT + staff × STAFF_RATE + Σ adSpend + incidentResponseCost`

Required staff: `ceil(capacity / SECURITY_PER) + gates × DOOR_STAFF_PER_GATE + bars × BAR_STAFF_PER_BAR`.

### R-14: Artist payment

- Guarantee: `artistPay = GUARANTEE`, the ask quoted when the act was booked (R-19; the base `ask` in `ARTISTS` for a booking made before the Lot career).
- Door deal: `artistPay = round(DOOR_SPLIT × max(0, ticketGross − showCosts))`, where `ticketGross = attendance × price`.
- This is a simplified net door deal. Deals where the artist gets the larger of a guarantee or a share come later.

### R-15: Net result

`net = ticketGross + bar − showCosts − artistPay`

**Pass:** `net ≥ 0` and `satisfaction ≥ PASS_SATISFACTION`. **Retry:** otherwise ([GDD section 4](GDD.md#4-the-first-playable-loop-lot-night)). In the Lot career the result labels the night; a retry no longer ends the run (R-21).

## Reputation

### R-16: Venue reputation

`venueRep = clamp(venueRep + round(REP_SAT_SLOPE × (satisfaction − PASS_SATISFACTION)), 0, 100)`

### R-17: Artist relationship

`relationship[artist] = clamp(relationship[artist] + clamp(REL_BASE + round(REL_SLOPE × (artistPay / ARTIST_ASK − 1)), REL_MIN_STEP, REL_MAX_STEP), −100, 100)`, where `ARTIST_ASK` is the ask quoted at booking (R-19). Paying the quoted guarantee in full counts as fair (`REL_BASE`).

The step depends only on what the act was paid against its ask, not on the deal type. A guarantee pays exactly the ask, so it always gives `REL_BASE`. A door deal pays `DOOR_SPLIT` of what is left after costs, which can be below, at or above the ask:

- below 72.5% of the ask the relationship falls (the worked example's door deal pays $77 against a $500 ask: −12);
- from 72.5% to just under 77.5% the step is 0, and from 77.5% it is positive, so a share a little below the ask can still build trust (86% of the ask gives +2);
- at the ask it gives `REL_BASE`, as a guarantee does;
- above the ask it gives more than a guarantee, up to `REL_MAX_STEP` at 125% or more.

Pay is never negative, so the lowest step a show can give is `REL_BASE − REL_SLOPE` (−15 with the current values); `REL_MIN_STEP` does not bind. `front-of-house/test-engine.mjs` checks each of these cases.

## The Lot career

### R-19: Offers and terms

- **Offers:** the first show of a career offers `DEFAULT_ARTIST` and one more act. Every later show offers `OFFERS_PER_SHOW` different acts from `ROSTER`, shuffled by the offer generator (`offersFor(state)`).
- **Terms** depend on the act's relationship `rel` with the promoter (`termsFor(artistId, rel)`):
  - `ask = round(ARTISTS[id].ask × (1 − rel × REL_ASK_SLOPE) / ASK_ROUNDING) × ASK_ROUNDING`
  - `drawMult = 1 + rel × REL_DRAW_SLOPE`; the show's draw (R-06) is multiplied by it, because an act that likes the promoter promotes the show.
  - A door deal is refused when `rel ≤ REL_DOOR_FLOOR`, or always for an act marked `guaranteeOnly`.
- The booking stores `{ ask, drawMult }` (`booking.terms`), so a replayed settlement uses the terms the show was sold on.

### R-20: The Lot goal

The Club (tier 2, [CT-DEC-09](DECISIONS.md#ct-dec-09-career-tier-ladder)) unlocks at a settlement after which all of these hold:

- at least `LOT_GOAL.sellouts` shows sold out the Lot (`attendance ≥ PERMIT_CAP`),
- venue reputation ≥ `LOT_GOAL.venueRep`,
- cash ≥ `LOT_GOAL.cash`,
- one act's relationship ≥ `LOT_GOAL.loyalAct`.

The unlock is stored (`unlocks.club`) and stays, even if cash or reputation falls later. `careerProgress(state)` reports each part.

### R-21: Carrying on

After any settlement the player may book the next show, keeping cash, venue reputation, relationships, the layout and the history. The next show is refused only when cash is below the cheapest show its offer allows (`nextShowCost(state)`): for each act on the next show's offer, the upfront cost of `CHEAPEST_LAYOUT` with no ads (`cheapestShowCost()`) on a door deal if the act's terms allow one, otherwise on a guarantee of its quoted ask; the cheapest act sets the figure. When both acts on offer want a guarantee (Juniper Switchboard, or an act soured past `REL_DOOR_FLOOR`), it is higher than the door-deal floor. Start over (`retry`) is always available and begins a new career: it resets cash, reputation, relationships, the unlock and the history, and keeps only the layout, so earlier shows count toward neither the new goal nor the first show's offer.

### Rooms after the Lot (CT-DEC-11)

The Lot rules above are unchanged. Later rooms are rows in `VENUES`. Each has its own grid, permit, power budget, rental, roster and price ceiling. `nextShowCost` uses that room's cheapest layout, not the Lot's, once the player has changed rooms.

- **House PA.** A room with `housePa` is heard without a rented PA. Placing a PA is still allowed and then costs the usual rental.
- **Seats.** When `seats` is above 0, that many of the attendance pay `seatPrice` and the rest pay the lawn price. Seats are 0 on the Lot, so the worked example is unchanged.
- **Nights.** A hold longer than one night settles each night, charges upfront again, and applies reputation and relationship once, on the last night.
- **Sponsor.** Allowed only where `sponsor` is true. `SPONSOR_PAY` arrives before doors (it reduces upfront). The ask is still paid. It is not added a second time at settlement.
- **Broadcast.** Where `broadcast` is true, settlement adds `attendance × BROADCAST_PER_HEAD`.
- **Second stage.** Where `secondStage` is true, an opener plays a door deal capped at `secondCap`. Site costs are not charged again. The opener's cash is a line on the headliner's sheet.
- **Sandbox** skips the cash gate. **Wet lot** forces the rain incident and starts from the suggested layout.

## Worked example

This is a balance reference, engine test `R-WORKED-01`, and a verdict in the balance baseline. Its fixture is `WORKED_EXAMPLE` in `front-of-house/sim/reference.mjs`.

**Inputs:** draw 100 · price $20 · ads: social $150, radio $150 · venue reputation 0 · capacity 150 · PA M, lights, 1 bar, 4 restrooms, 1 gate · 50 clear-view tiles · incident: PA dropout, answered with "Wait it out".

| Step | Rule | Value |
| --- | --- | --- |
| Price factor | R-04 | 1.0 |
| Buzz | R-05 | 1 + 0.30 × 0.4512 + 0.25 × 0.4512 = **1.2482** |
| Demand | R-06 | 100 × 1.0 × 1.2482 × 1.0 = **124.82** |
| Presale / walk-up | R-07 | share 0.5241 → presale **65** · walk-up **60** |
| Attendance | R-08 | **125** |
| Sightlines | R-03 | min(1, 50 × 1.5 / 125) = 0.6 |
| Satisfaction | R-09 | 35 × 1 + 20 × 0.6 + 20 × 1 + 15 × 1 + 10 × 0.3 = **85** |
| Ticket revenue | R-14 | 125 × $20 = **$2,500** |
| Bar | R-10 | $6 × 0.85 × 125 (one bar serves 125) = **$638** |
| Staff | R-13 | 3 security + 1 door + 2 bar = 6 × $75 = $450 |
| Show costs | R-13 | 400 + 125 + 450 + 175 + 100 + 240 + 150 + 450 + 300 + 0 = **$2,390** |
| Due before the show | R-12 | guarantee: $2,890 (cash on hand $3,000, so allowed) · door deal: $2,390 |

| Deal | Artist pay (R-14) | Net (R-15) | Result | Venue reputation (R-16) | Artist relationship (R-17) |
| --- | --- | --- | --- | --- | --- |
| Guarantee | $500 | **+$248** | Pass | +13 | **+5** |
| Door | $77 | **+$671** | Pass | +13 | **−12** |

## R-LIVE-01 Optional live Lot services

CT-DEC-20 enables this experiment only when selected on Promote (or opened with `?live-services=1` and confirmed). It is separate from `?night-slice=1`; other venues and existing unselected careers retain their rules. Adjustable values live in `LIVE_SERVICES` in `data.mjs`.

- The show advances through integer minutes 0–240 (19:00–23:00). The clock starts paused. Play, Pause, 1×/4×/12×, +5 min and Next event/Close show all issue the same engine action. An unanswered incident clamps advance at its seeded minute; after response, the remaining night continues. Neither frame rate nor camera changes calculate money.
- Planned presales and walk-ups come from the booked show's existing draw/price/ad rules before incidents. Every third seed uses a six-minute concentrated rush; other shows spread arrivals over 36 minutes. Promote discloses the arrival pattern without revealing the hidden draw. Cumulative integer splitting conserves each population.
- Each gate serves 5/minute. Bar base service is 1/minute plus 3/minute per additional bar. One worker initially adds 2/minute at the bar or 5/minute at admission. Transfer takes two minutes with neither station receiving that worker's capacity. Reassignment in transit is refused; returning is a new transfer. Gate and bar patience are 12 minutes, expiring before service at the boundary. The first request of a given minute is prepaid, then walk-up; older cohorts retain FIFO priority.
- A guest makes one bar request on admission. A completed request earns `BAR_NET_PER_HEAD` ($6); lost requests earn nothing. Service closes at minute 240 and drains remaining demand as lost. No individual pathfinding, extra purchases or normal departures are modeled in this slice.
- Presale money is a held receipt until career settlement. Unadmitted prepaid guests receive full refunds; walk-ups pay once on admission. Ticket gross is held presales + admitted walk-up receipts − refunds. Bar income is actual completed service. Artist pay retains the existing booked terms and cost basis. Available career cash is credited only by the existing one-time `acceptSettlement` phase transition.
- Rain/curfew walk-up multipliers apply only to future scheduled walk-ups, using cumulative rounding. Existing queues and admitted people are conserved. Gate-flow penalties apply prospectively to processing capacity, rounded down per minute; they are not applied again to settlement's flow score. A response is charged and recorded once, at or after its incident minute. Incident satisfaction scores otherwise retain their existing meaning.
- Pilot satisfaction substitutes actual bar service for the old bar-capacity estimate and actual admissions/arrivals for the old entrance estimate. Other satisfaction components are unchanged. Incident effects never retrospectively erase a served guest or receipt.

Actual Lot paired fixtures at $20 and $300 ads: seed 1, worker stays at bar, earns $831 versus $819 for an immediate transfer returned at minute 6 (same 129 admitted, two lost bar sales). Seed 3's surge earns −$186 with 85 admitted when the worker stays at the bar versus $230 with 110 admitted after the same transfer/return, despite 40 lost bar requests. These are deterministic experimental fixtures, not a claim of universal optimal play or accepted career balance. The legacy Lot balance baseline remains unchanged when the pilot is disabled.


### R-LIVE-02 — Modeled access and normal departure

Client-opened live Lot shows record flow version 1. The largest connected free-floor region is the audience area, with row-major tie breaking. Admission gates, bars and exits must connect to it; doors refuse before any charge if one service type has no connected provider. Only connected gates/bars contribute service throughput. Permit, density and placed-exit occupancy limits remain the existing R-02 authority.

Service closes at minute 240 with the existing queue expiry/refund rules. Admitted guests then depart at `GUEST_FLOW.exitRate` per usable exit per whole game minute. Inside plus departed equals cumulative admitted attendance; departure neither earns nor refunds cash. Play/Pause, speed and +5 minutes continue the same logical clock. Close show reaches service closing, while Finish departure reaches the last departure minute. Settlement remains unavailable until all admitted guests have left. Geometry remains locked throughout the show.

The engine reconstructs counts, routes and departure events; only the flow version and elapsed departure minute are saved. Older live shows without the marker retain their historical closing behavior. This is normal game flow, not an emergency evacuation prediction or a grant of additional occupancy.

## R-FOOD-01 Optional Lot vendor

One connected 2×1 stall is required for an enabled pre-doors contract. It uses occupied floor tiles under existing capacity rules and vendor-supplied power/staff; it creates no new promoter setup or artist-basis cost. The version 1 standard/premium prices, rates, stock and vendor expenses are defined in `concessions.mjs` and locked by plan at doors. Discretionary budgets exclude tickets. Every third admitted ordinal starts with $16, the others $24; a completed bar purchase spends $8. Even ordinals request food; every fourth accepts the premium price. Requests follow bar resolution, including one-way alternatives after bar abandonment, and spend only remaining money. FIFO expiry precedes service at six minutes; closing and exhausted stock resolve all remaining requests.

Food gross splits 25% to the house and 75% to the vendor. Vendor profit deducts all stocked inventory and fixed window wages, including unsold stock. Only house income enters promoter net and settlement payout. Existing guarantee/door artist calculations are unchanged. Pure replay and career tests cover conservation, locked terms, useful quiet/surge choices, malformed saves and one-time signing.
