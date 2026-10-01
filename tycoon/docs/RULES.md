# Concert Tycoon Rules Specification

**Status:** Draft · **Scope:** the first playable loop, "Lot Night" ([GDD section 4](GDD.md#4-the-first-playable-loop-lot-night))
**Decisions:** [CT-DEC-02](DECISIONS.md#ct-dec-02-engine-and-art) (deterministic engine), [CT-DEC-07](DECISIONS.md#ct-dec-07-documentation-source-of-truth) (numbers live in code)

Each rule has an ID (`R-NN`), its inputs and output, a formula, and the names of the adjustable values it uses. Tests and code comments cite the rule ID.

> **Where the numbers live:** until `tycoon/data.mjs` exists, the starting values in the [Starting values](#starting-values) table are canonical. Once `data.mjs` lands, that table is deleted and `data.mjs` wins; this document then keeps only the value names. The worked example stays, because it becomes an engine test.

## General conventions

- **Money** is whole dollars (integers). Round half up only where a rule says so.
- **Determinism:** every random value comes from one seeded generator (`RNG`, mulberry32 seeded with `state.seed`). Values are drawn in a fixed order: artist draw, incident type, incident timing. The same seed and the same player choices produce the same settlement, down to the dollar.
- **The engine never touches the DOM.** It takes state and an action and returns new state.
- `clamp(v, lo, hi)` limits `v` to the range `[lo, hi]`.

## Venue

### R-01: Capacity

`capacity = min(PERMIT_CAP, FLOOR_DENSITY × openFloorTiles, EXIT_CAPACITY × exits)`

- `openFloorTiles`: tiles inside the fence that hold no object and are not the stage.
- Output: the most people allowed in. The Build screen always shows which of the three limits applies.

### R-02: Power budget

The total power drawn by placed objects must not exceed `GENERATOR_WATTS`. Placing an object that would go over the limit is blocked, and the screen says which object it was.

### R-03: Sightlines

`sightlines = clearTiles / openFloorTiles`, a value from 0 to 1.

- A tile is clear if it lies within `SIGHT_RANGE` tiles of the stage front, inside a 90 degree cone, and the straight line from it to the stage center crosses no blocking object (bar, restroom, lights tower, generator).

## Demand and attendance

### R-04: Price factor

`priceFactor = clamp(PRICE_BASE − PRICE_SLOPE × price / fairPrice, PRICE_FLOOR, PRICE_CEIL)`

- This gives 1.0 at the fair price, 1.25 (the cap) at half the fair price, and 0.5 at double it.

### R-05: Buzz

`buzz = 1 + Σ over channels c of AD_REACH[c] × (1 − e^(−spend[c] / AD_SATURATION))`

- Channels: flyers, social, radio. Each additional dollar on a channel adds less buzz than the last. The maximum is `1 + Σ AD_REACH`.

### R-06: Demand

`demand = draw × priceFactor × buzz × (1 + venueRep / REP_DIVISOR)`

- `draw` is drawn once per show from `[DRAW_MIN, DRAW_MAX]` by the seeded generator. It is a whole number and is hidden from the player; the Promote screen shows a range.

### R-07: Presale and walk-up

```
presaleShare = min(PRESALE_MAX, PRESALE_BASE + PRESALE_PER_BUZZ × (buzz − 1))
presale      = min(capacity, round(demand × presaleShare))
walkup       = round(demand) − presale
```

- Rain at doors multiplies walk-up by the chosen response's `walkupMult` ([R-11](#r-11-incidents)). Presales are never reduced.

### R-08: Attendance

`attendance = min(capacity, presale + walkupAfterIncident)`

## Show night

### R-09: Satisfaction

`satisfaction = round(W_SOUND × sound + W_SIGHT × sightlines + W_AMENITY × amenities + W_FLOW × flow + W_INCIDENT × incident)`, from 0 to 100.

| Part | Formula (each is 0 to 1) |
| --- | --- |
| `sound` | `min(1, PA_COVERAGE[paTier] / attendance)` |
| `sightlines` | R-03 |
| `amenities` | the average of `min(1, bars × BAR_RATIO / attendance)` and `min(1, restrooms × RESTROOM_RATIO / attendance)` |
| `flow` | `min(1, gates × GATE_RATE × DOORS_MINUTES / attendance) × flowMult`, where `flowMult` comes from the incident response and is 1 otherwise |
| `incident` | the chosen response's `score`, or 1 if nothing went wrong |

The weights sum to 100.

### R-10: Bar revenue

`bar = round(attendance × BAR_NET_PER_HEAD × satisfaction / 100 × (bars × BAR_RATIO ≥ attendance ? 1 : BAR_SHORTFALL))`

### R-11: Incidents

Each show has exactly one incident, chosen by the seeded generator from the incident table. A response costs money (added to show costs, [R-13](#r-13-show-costs)), sets the incident score, and may change walk-up (`walkupMult`) or entry flow (`flowMult`). A response the player cannot afford with current cash is disabled ([R-12](#r-12-cash-timing)).

## Money

### R-12: Cash timing

- **Due before the show:** all show costs except incident responses, plus the guarantee if one was chosen. The Promote phase cannot be confirmed if this is more than current cash.
- **During the show:** cash on hand is what is left after those payments. Ticket money is held by the ticketing company until settlement, so incident responses must be paid from that remainder.
- **At settlement:** ticket revenue and bar revenue arrive; the door deal payment (if chosen) goes out.

### R-13: Show costs

`showCosts = LOT_RENTAL + PERMIT + PA_RENTAL[paTier] + (lights ? LIGHTS_RENTAL : 0) + bars × BAR_SETUP + restrooms × RESTROOM_UNIT + FENCE_KIT + staff × STAFF_RATE + Σ adSpend + incidentResponseCost`

Required staff: `ceil(capacity / SECURITY_PER) + gates × DOOR_STAFF_PER_GATE + bars × BAR_STAFF_PER_BAR`.

### R-14: Artist payment

- Guarantee: `artistPay = GUARANTEE`.
- Door deal: `artistPay = round(DOOR_SPLIT × max(0, ticketGross − showCosts))`, where `ticketGross = attendance × price`.
- This is a simplified net door deal. Deals where the artist gets the larger of a guarantee or a share come later.

### R-15: Net result

`net = ticketGross + bar − showCosts − artistPay`

**Pass:** `net ≥ 0` and `satisfaction ≥ PASS_SATISFACTION`. **Retry:** otherwise ([GDD section 4](GDD.md#4-the-first-playable-loop-lot-night)).

## Reputation

### R-16: Venue reputation

`venueRep = clamp(venueRep + round(REP_SAT_SLOPE × (satisfaction − PASS_SATISFACTION)), 0, 100)`

### R-17: Artist relationship

`relationship[artist] = clamp(relationship[artist] + clamp(REL_BASE + round(REL_SLOPE × (artistPay / ARTIST_ASK − 1)), REL_MIN_STEP, REL_MAX_STEP), −100, 100)`

## Starting values

All of these can be adjusted and will move into `tycoon/data.mjs` ([CT-DEC-07](DECISIONS.md#ct-dec-07-documentation-source-of-truth)).

| Name | Value | Unit or note |
| --- | --- | --- |
| `START_CASH` | 6000 | $ |
| `GRID` | 24 by 16 | tiles (a tile is 2 m by 2 m) |
| `PERMIT_CAP` | 300 | people, parking lot tier |
| `FLOOR_DENSITY` | 3 | people per open tile |
| `EXIT_CAPACITY` | 100 | people per exit |
| `GENERATOR_WATTS` | 20000 | W; included in the lot rental with a basic stage |
| Power draw | PA S 3000, PA M 6000, lights 8000, bar 1500 | W |
| `SIGHT_RANGE` | 12 | tiles |
| `PRICE_BASE`, `PRICE_SLOPE`, `PRICE_FLOOR`, `PRICE_CEIL` | 1.5, 0.5, 0.25, 1.25 | |
| `AD_REACH` | flyers 0.15, social 0.30, radio 0.25 | |
| `AD_SATURATION` | 500 | $ |
| `REP_DIVISOR` | 200 | |
| `DRAW_MIN`, `DRAW_MAX` | 150, 260 | Velvet Static |
| `fairPrice`, `ARTIST_ASK` | 20, 1000 | $, Velvet Static |
| `PRESALE_BASE`, `PRESALE_PER_BUZZ`, `PRESALE_MAX` | 0.40, 0.50, 0.80 | |
| `W_SOUND`, `W_SIGHT`, `W_AMENITY`, `W_FLOW`, `W_INCIDENT` | 35, 20, 20, 15, 10 | |
| `PA_COVERAGE` | S 200, M 500 | people |
| `BAR_RATIO` | 250 | people per bar |
| `RESTROOM_RATIO` | 75 | people per restroom unit |
| `GATE_RATE`, `DOORS_MINUTES` | 5, 60 | people per minute, minutes |
| `BAR_NET_PER_HEAD`, `BAR_SHORTFALL` | 6, 0.6 | $, multiplier |
| `LOT_RENTAL`, `PERMIT`, `FENCE_KIT` | 800, 250, 300 | $ |
| `PA_RENTAL` | S 400, M 900 | $ |
| `LIGHTS_RENTAL`, `BAR_SETUP`, `RESTROOM_UNIT` | 350, 200, 120 | $ |
| `STAFF_RATE` | 150 | $ per person |
| `SECURITY_PER`, `DOOR_STAFF_PER_GATE`, `BAR_STAFF_PER_BAR` | 100, 1, 2 | |
| `GUARANTEE`, `DOOR_SPLIT` | 1000, 0.70 | $, share |
| `PASS_SATISFACTION` | 60 | |
| `REP_SAT_SLOPE` | 0.5 | |
| `REL_BASE`, `REL_SLOPE`, `REL_MIN_STEP`, `REL_MAX_STEP` | 5, 20, −20, 10 | |

### Incident table

| Incident | Response | Cost | `score` | Effect |
| --- | --- | --- | --- | --- |
| Rain at doors | Ride it out | $0 | 0.3 | `walkupMult` 0.6 |
| | Hand out ponchos | $250 | 0.7 | `walkupMult` 0.8 |
| | Rent a canopy | $500 | 0.9 | `walkupMult` 0.9 |
| PA dropout mid-set | Wait it out | $0 | 0.3 | none |
| | Swap in the backup amp | $200 | 0.8 | none |
| Gate jam at doors | Ride it out | $0 | 0.3 | `flowMult` 0.6 |
| | Open a second lane | $150 | 0.9 | none |

## Worked example

This is a balance reference and becomes engine test `R-WORKED-01`. It was checked by script on 2026-10-01.

**Inputs:** draw 200 · price $20 · ads: social $300, radio $300 · venue reputation 0 · PA M, lights, 1 bar, 4 restrooms, 1 gate, 3 exits, fence · at least 120 open floor tiles · sightlines 0.6 · incident: PA dropout, answered with "Wait it out".

| Step | Rule | Value |
| --- | --- | --- |
| Capacity | R-01 | min(300, 360 or more, 300) = **300** |
| Price factor | R-04 | 1.0 |
| Buzz | R-05 | 1 + 0.30 × 0.4512 + 0.25 × 0.4512 = **1.2482** |
| Demand | R-06 | 200 × 1.0 × 1.2482 × 1.0 = **249.63** |
| Presale / walk-up | R-07 | share 0.5241 → presale **131** · walk-up **119** |
| Attendance | R-08 | **250** |
| Satisfaction | R-09 | 35 × 1 + 20 × 0.6 + 20 × 1 + 15 × 1 + 10 × 0.3 = **85** |
| Ticket revenue | R-14 | 250 × $20 = **$5,000** |
| Bar | R-10 | 250 × $6 × 0.85 = **$1,275** |
| Staff | R-13 | 3 security + 1 door + 2 bar = 6 × $150 = $900 |
| Show costs | R-13 | 800 + 250 + 900 + 350 + 200 + 480 + 300 + 900 + 600 + 0 = **$4,780** |
| Due before the show | R-12 | guarantee: $5,780 (cash on hand $6,000, so allowed) · door deal: $4,780 |

| Deal | Artist pay (R-14) | Net (R-15) | Result | Venue reputation (R-16) | Artist relationship (R-17) |
| --- | --- | --- | --- | --- | --- |
| Guarantee | $1,000 | **+$495** | Pass | +13 | **+5** |
| Door | $154 | **+$1,341** | Pass | +13 | **−12** |
