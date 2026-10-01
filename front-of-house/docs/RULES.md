# Front of House Rules Specification

**Status:** Implemented in `front-of-house/engine.mjs` (engine version 1) · **Scope:** the first playable loop, "Lot Night" ([GDD section 4](GDD.md#4-the-first-playable-loop-lot-night))
**Decisions:** [CT-DEC-02](DECISIONS.md#ct-dec-02-engine-and-art) (deterministic engine), [CT-DEC-07](DECISIONS.md#ct-dec-07-documentation-source-of-truth) (numbers live in code)

Each rule has an ID (`R-NN`), its inputs and output, a formula, and the names of the adjustable values it uses. Tests in `front-of-house/test-engine.mjs` and comments in `front-of-house/engine.mjs` cite the rule ID.

> **Where the numbers live:** every adjustable value and content table (objects, artists, incidents) is in [`front-of-house/data.mjs`](../data.mjs). This document names values instead of repeating them. The worked example at the end is the exception; it is engine test `R-WORKED-01` and a balance simulator verdict, so it can't drift. After changing a value, run `npm run sim:front-of-house` and commit the regenerated [balance baseline](BALANCE_BASELINE.md).

## General conventions

- **Money** is whole dollars (integers). Rounding uses `Math.round` (halves round up) wherever a rule says `round`.
- **Determinism:** every random value comes from one seeded generator (mulberry32 seeded with `state.seed`). Values are drawn in a fixed order: artist draw, incident type, incident timing (`rollShow`). The same seed and the same player choices produce the same settlement, down to the dollar.
- **The engine never touches the DOM.** `applyAction(state, action)` returns `{ state, error }`; the input state is never changed.
- `clamp(v, lo, hi)` limits `v` to the range `[lo, hi]`.
- **Per-person parts:** where a rule divides a supply by `attendance`, the part is 1 when attendance is 0.

## Venue

### R-01: Capacity

`capacity = min(PERMIT_CAP, FLOOR_DENSITY × openFloorTiles, EXIT_CAPACITY × exits)`

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

## Money

### R-12: Cash timing

- **Due before the show:** all show costs except the incident response, plus the guarantee if one was chosen (`upfrontFor(state)`). The Promote phase cannot be confirmed if this is more than current cash.
- **During the show:** cash on hand is what is left after those payments. Ticket money is held by the ticketing company until settlement, so incident responses must be paid from that remainder.
- **At settlement:** ticket revenue and bar revenue arrive; the door deal payment (if chosen) goes out.

### R-13: Show costs

`showCosts = LOT_RENTAL + PERMIT + PA_RENTAL[paTier] + (lights ? LIGHTS_RENTAL : 0) + bars × BAR_SETUP + restrooms × RESTROOM_UNIT + FENCE_KIT + staff × STAFF_RATE + Σ adSpend + incidentResponseCost`

Required staff: `ceil(capacity / SECURITY_PER) + gates × DOOR_STAFF_PER_GATE + bars × BAR_STAFF_PER_BAR`.

### R-14: Artist payment

- Guarantee: `artistPay = GUARANTEE`, the artist's `ask` in `ARTISTS`.
- Door deal: `artistPay = round(DOOR_SPLIT × max(0, ticketGross − showCosts))`, where `ticketGross = attendance × price`.
- This is a simplified net door deal. Deals where the artist gets the larger of a guarantee or a share come later.

### R-15: Net result

`net = ticketGross + bar − showCosts − artistPay`

**Pass:** `net ≥ 0` and `satisfaction ≥ PASS_SATISFACTION`. **Retry:** otherwise ([GDD section 4](GDD.md#4-the-first-playable-loop-lot-night)).

## Reputation

### R-16: Venue reputation

`venueRep = clamp(venueRep + round(REP_SAT_SLOPE × (satisfaction − PASS_SATISFACTION)), 0, 100)`

### R-17: Artist relationship

`relationship[artist] = clamp(relationship[artist] + clamp(REL_BASE + round(REL_SLOPE × (artistPay / ARTIST_ASK − 1)), REL_MIN_STEP, REL_MAX_STEP), −100, 100)`, where `ARTIST_ASK` is the artist's `ask`.

## Worked example

This is a balance reference, engine test `R-WORKED-01`, and a verdict in the balance baseline. Its fixture is `WORKED_EXAMPLE` in `front-of-house/sim/reference.mjs`.

**Inputs:** draw 200 · price $20 · ads: social $300, radio $300 · venue reputation 0 · capacity 300 · PA M, lights, 1 bar, 4 restrooms, 1 gate · 50 clear-view tiles · incident: PA dropout, answered with "Wait it out".

| Step | Rule | Value |
| --- | --- | --- |
| Price factor | R-04 | 1.0 |
| Buzz | R-05 | 1 + 0.30 × 0.4512 + 0.25 × 0.4512 = **1.2482** |
| Demand | R-06 | 200 × 1.0 × 1.2482 × 1.0 = **249.63** |
| Presale / walk-up | R-07 | share 0.5241 → presale **131** · walk-up **119** |
| Attendance | R-08 | **250** |
| Sightlines | R-03 | min(1, 50 × 3 / 250) = 0.6 |
| Satisfaction | R-09 | 35 × 1 + 20 × 0.6 + 20 × 1 + 15 × 1 + 10 × 0.3 = **85** |
| Ticket revenue | R-14 | 250 × $20 = **$5,000** |
| Bar | R-10 | $6 × 0.85 × 250 (one bar serves 250) = **$1,275** |
| Staff | R-13 | 3 security + 1 door + 2 bar = 6 × $150 = $900 |
| Show costs | R-13 | 800 + 250 + 900 + 350 + 200 + 480 + 300 + 900 + 600 + 0 = **$4,780** |
| Due before the show | R-12 | guarantee: $5,780 (cash on hand $6,000, so allowed) · door deal: $4,780 |

| Deal | Artist pay (R-14) | Net (R-15) | Result | Venue reputation (R-16) | Artist relationship (R-17) |
| --- | --- | --- | --- | --- | --- |
| Guarantee | $1,000 | **+$495** | Pass | +13 | **+5** |
| Door | $154 | **+$1,341** | Pass | +13 | **−12** |
