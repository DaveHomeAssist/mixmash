# Front of House: Game Design Document

*Working title: Concert Tycoon.* **Status:** Draft; every decision in the log is accepted · **Last updated:** 2026-10-01 · **Owner:** Dave Robertson
**Decisions:** [DECISIONS.md](DECISIONS.md) · **Formulas:** [RULES.md](RULES.md) · **Saves:** [SAVE_FORMAT.md](SAVE_FORMAT.md)

This document is the canonical design. It combines both drafts from the Notion capture page "Concert Tycoon Ideas" (2026-10-01) with the one-page design for the first playable loop. Where they differed, the choice made is noted in the "Reconciled from the Notion drafts" section.

## 1. Concept

| | |
| --- | --- |
| **Genre** | Tycoon / management simulation |
| **Setting** | Concert promotion, live production and venue operations |
| **Tone** | Accessible and nostalgic, in the spirit of RollerCoaster Tycoon and Zoo Tycoon, with modern depth |
| **Core fantasy** | Start with a rented parking lot and a PA. End running your own festival grounds. |
| **Player role** | Promoter, production manager, talent buyer and venue operator at once. Every decision, from stage size to sound system to artist, affects ticket sales, crowd satisfaction and cash flow. |

## 2. Pillars (proposed)

1. **Real promoter decisions.** Every choice is one a real promoter makes: the deal type, the ticket price, ad spend, rentals. Money follows real settlement logic.
2. **Build it, then live it.** The player lays out the venue, then watches the show play out in that layout.
3. **Mistakes become stories.** Incidents are recoverable decisions with trade-offs, not random punishment.
4. **Short sessions, long arc.** One show takes 10 to 15 minutes; a career is many shows.

## 3. Scope and modes

Scope: a structured tycoon with Sandbox as a mode, not an open-world sim ([CT-DEC-01](DECISIONS.md#ct-dec-01-core-scope)).

| Mode | Description | When |
| --- | --- | --- |
| **Career** | Guided progression from a rented lot to the festival grounds, with objectives and milestones | First playable, then v1 |
| **Sandbox** | Unlimited budget and open building, with no win or lose conditions | v1 (the same systems with limits removed) |
| **Scenario** | Preset challenges: save a failing venue, survive a rainy outdoor festival, rebuild after a cancellation, work a muddy field or a city noise curfew | v1 |
| **Challenge** | Time-limited or budget-capped runs with best scores stored on the device ([CT-DEC-05](DECISIONS.md#ct-dec-05-multiplayer)) | After v1 |
| **Endless** | A randomly generated event calendar; survive as long as possible | After v1 |

## 4. The first playable loop: "Lot Night"

One venue, one artist, one show, from booking to settlement. The target session is 10 to 15 minutes.

**Starting state:** $3,000 cash, a rented parking lot (24 by 16 tiles) permitted for 150 people (tier 1, the Lot), venue reputation 0, and one artist offer.
**Artist:** *Velvet Static*, a fictional indie rock act ([CT-DEC-03](DECISIONS.md#ct-dec-03-artists-and-venues)). Draw is seeded between 75 and 130; fair ticket price is $20; the artist's ask is a $500 guarantee.

| Phase | Player does | Systems | Result |
| --- | --- | --- | --- |
| 1. Book | Chooses a **$500 guarantee** or a **door deal** (artist takes 70% of ticket revenue left after show costs) | Booking, Finance | The deal is locked, which sets how much risk the player carries |
| 2. Build | Places a stage, rents a PA (S or M), and adds lights, bars, restrooms, fence and gate, and exits; a generator sets the power budget | Venue, Production | Capacity, sightlines, sound coverage and amenity ratios |
| 3. Promote | Sets the ticket price ($10 to $40) and splits ad spend across flyers, social and radio; 14 in-game days play out in about 60 seconds against a presale chart | Promotion, Finance | Presales and a walk-up forecast |
| 4. Show night | Doors, the set and curfew play out in about 2 minutes (12 seconds in the first playable); one seeded incident (rain, PA dropout or gate jam) offers 2 or 3 responses | Production, Reputation | Attendance, satisfaction and the incident outcome |
| 5. Settle | Reads the settlement sheet and accepts it | Finance, Reputation | Net result, change in reputation, change in the artist relationship |

**Pass:** net at least $0 **and** satisfaction at least 60. This unlocks "Book your next show", which ends the first playable.
**Retry:** net below $0 **or** satisfaction below 60. The player starts again from Book with a tip naming the weakest part of the satisfaction score.
**Cannot start:** the Promote phase cannot be confirmed if the money due before the show is more than the cash on hand ([R-12](RULES.md#r-12-cash-timing)).

The deal choice is the central tension. A door deal pays the promoter more when attendance is strong but upsets the artist; a guarantee keeps the artist happy but hurts when attendance is weak. The worked example in [RULES.md](RULES.md#worked-example) shows both outcomes. The first playable exists to prove this choice is fun.

## 5. Progression

Four tiers, from the tier ladder in the art direction ([CT-DEC-09](DECISIONS.md#ct-dec-09-career-tier-ladder)):

| Tier | Capacity | Content |
| --- | --- | --- |
| 1. The Lot | 50 to 150 | Local acts, mostly walk-up sales, rented PA. A backyard show can serve as tutorial flavor. |
| 2. The Club | 150 to 600 | Regional touring acts, ticketing platforms |
| 3. The Amphitheater | 600 to 2,500 | National acts, runs of several nights |
| 4. The Festival Grounds | 2,500 to 25,000+ | Headliner bookings, sponsorship deals, multi-stage festival operations, broadcast rights |

Phase 3 retuned the first playable to tier 1: the Oak St. Lot is permitted for 150, and every per-person and money value was halved from the 300-person version, so the balance checks carried over ([ROADMAP.md](../ROADMAP.md)).

**Career milestones (examples):** sell out a 500-capacity show; book an artist on a $10,000 guarantee; run a three-day festival without a major incident; reach a net worth that unlocks the Festival Grounds.
**Scenario fail states:** the venue loses its operating license; cash reaches zero with debts still owed; reputation falls below a minimum.

## 6. Systems: first playable versus later

| System | In the first playable | Later |
| --- | --- | --- |
| **Venue building** | Grid placement, about 8 object types, power budget, capacity from floor area and exits, sightline check | Indoor venues (club, theater); outdoor types (festival field, amphitheater, rooftop); stage upgrades (black-box room, club, amphitheater, festival grounds); FOH and monitor positions; capacity zones (GA floor, seated, VIP, backstage); terrain editing (slopes, power runs, tents); load-in access; green room quality; acoustic ratings |
| **Booking and talent** | One artist; guarantee or door deal | Artist roster with genre tags, draw radius, riders and fee tiers; availability windows; tour routing conflicts; exclusivity zones; relationships that improve terms over time |
| **Production and logistics** | PA rental (S or M), optional lights, staff numbers by role | Hiring crew and building their skills (stage manager, sound engineer, lighting tech, security, bar staff); renting or owning gear with depreciation; audio depth (subwoofer arrays, wedges or in-ear monitors, patch and input list); load-in scheduling, curfews, union rules; video walls |
| **Promotion and marketing** | Ticket price, 3 ad channels, presale chart | Comp lists, ticketing platforms, on-sale timing, press, social buzz and word of mouth |
| **Finance** | One settlement sheet | Cash flow across a calendar, merch splits, sponsorships, insurance, permits and compliance as recurring costs |
| **Reputation** | Venue reputation and one artist relationship score | Market reputation (draw radius, press attention), reviews, fan loyalty, vendor and agent relationships |

### Resources (full game)

| Resource | Role |
| --- | --- |
| Cash | The currency for all spending |
| Crew points / staff experience | Unlock skilled hires and better crew outcomes |
| Gear inventory | Owned equipment versus rentals; depreciation and upgrades |
| Venue reputation | Affects artist interest and ticket demand |
| Market reputation | Sets draw radius and press attention |
| Permits and licenses | Required to operate; tiered by venue size and event type |
| Relationships | Loyalty scores for artists, agents and vendors |

## 7. Atmosphere and differentiation

- Live audio simulation: crowd noise and mix quality tied to gear and crew skill.
- Dynamic lighting that responds to show programming decisions.
- Artists and fans with personalities, not just numbers on a ledger.
- A seasonal calendar: festival season, holiday runs, slow winter months.
- Unplanned events: surprise openers, viral moments, union disputes, noise complaints.
- **Against Festival Tycoon,** the closest existing game, the edge is the promoter's money decisions (deal types, a real settlement sheet) and production realism.
- **Pro-mode realism (open question):** production depth could follow real AV paperwork (input lists, stage plots, power plans), drawing on the System by Dave AV tools.

## 8. Platform and technology

Decided: built for the browser inside MixMash Studio, using MarsScape's split between a separate rules engine and a canvas client; desktop browser first ([CT-DEC-02](DECISIONS.md#ct-dec-02-engine-and-art), [CT-DEC-04](DECISIONS.md#ct-dec-04-platform)). The planned file layout is in [`../README.md`](../README.md#architecture-ct-dec-02).

The Notion page originally listed Unity, Godot and Unreal Engine 5, with FMOD or Wwise for audio. CT-DEC-02 records why those were not chosen and when Godot would come back into consideration.

## 9. Reconciled from the Notion drafts

| Topic | Draft A | Draft B (cut off) | Chosen here |
| --- | --- | --- | --- |
| Opening fantasy | Rented parking lot and a PA | Single-stage backyard show | Parking lot for the first playable; backyard as tutorial flavor |
| Fourth mode | Challenge (leaderboard) | Endless (random calendar) | Both kept and both deferred; Challenge uses scores stored on the device |
| End state | Arena or stadium | Multi-stage festival operation | Festival grounds, as tier 4; the arena or stadium tier is cut (CT-DEC-09) |
| Venue builder | Objects, capacity, sightlines, acoustics | Adds terrain, FOH and monitor positions, capacity zones | All merged into "Venue building, later" |
| Production | Crew, gear, logistics | Audio depth (cut off mid-list) | Merged into "Production, later" |

## 10. Open questions

1. ~~Name and route~~: settled. The game is **Front of House** at `mixmash.games/front-of-house/` ([CT-DEC-06](DECISIONS.md#ct-dec-06-name-and-route)).
2. ~~Universe~~: settled. A standalone game outside the MIXMASH universe ([CT-DEC-08](DECISIONS.md#ct-dec-08-standalone-game)).
3. **Pro-mode realism:** should production depth follow real AV paperwork (section 7)?
4. **Multiplayer:** co-promotion with other players suits the theme but adds a lot of complexity, so it is deferred by CT-DEC-05.
