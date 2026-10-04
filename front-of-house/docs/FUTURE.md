# Front of House: the feature plan

**Status:** The rooms in Phases 5 to 7, plus Sandbox and the wet-lot scenario, are in the tree as of 2026-10-01 ([CT-DEC-11](DECISIONS.md#ct-dec-11-rooms-after-the-lot), Proposed). The public-release gates below still stand: `noindex` stays, and there is no hub card, until Dave signs off the first playable. CT-DEC-10 is still Proposed. The Lot was retuned for 50 to 150 people in Phase 3. The phase text below predates the playable rooms and remains historical scope, not fresh implementation authority.

**Current sequence:** [CT-DEC-14](DECISIONS.md#ct-dec-14-expansion-sequence), accepted 2026-10-04, places the 3D Lot prototype before live operations. The [decision packet](DECISION_PACKET.md) owns unresolved choices and the [feature briefs](FEATURE_BRIEFS.md) define proposed slices. The original build order below is superseded as scheduling guidance and retained as history. This notice changes neither accepted mechanics nor release gates.

This document preserves the original expansion order and later-system proposals. The design of each system stays in [`GDD.md`](GDD.md). The accepted choices stay in [`DECISIONS.md`](DECISIONS.md). What already shipped is in [`progress.md`](../progress.md).

## Where the game is

| In the tree | What the player can do |
| --- | --- |
| Phases 0 to 2 | The rules, the page, Lot Night from Book to Settle |
| Phase 3 | The Oak St. Lot, permitted for 150 |
| Phase 4 | A run of shows, three acts, terms that follow the relationship, a goal that unlocks the Club ([CT-DEC-10](DECISIONS.md#ct-dec-10-the-lot-career), still Proposed) |
| Art, provisional | Prop sprites on the board (`sprites/`, drawn from `board.js`). Colored boxes remain the fallback. These are not the pixel sheets in [`ART_DIRECTION.md`](ART_DIRECTION.md) section 6 |

The page is live at `mixmash.games/front-of-house/` and still `noindex`, with no hub card, until Dave signs off the first playable.

## What stays decided

- Four tiers, and no arena ([CT-DEC-09](DECISIONS.md#ct-dec-09-career-tier-ladder)): the Lot, the Club, the Amphitheater, the Festival Grounds.
- A structured career. Sandbox and Scenario are modes on the same systems, not a separate game ([CT-DEC-01](DECISIONS.md#ct-dec-01-core-scope)).
- Browser, canvas, deterministic engine. No install, no server, no accounts in v1 ([CT-DEC-02](DECISIONS.md#ct-dec-02-engine-and-art), [CT-DEC-04](DECISIONS.md#ct-dec-04-platform), [CT-DEC-05](DECISIONS.md#ct-dec-05-multiplayer)).
- Fictional acts and venues only ([CT-DEC-03](DECISIONS.md#ct-dec-03-artists-and-venues)). New names are checked into [`WORLD.md`](WORLD.md) before a phase merges.
- The crowd stays a density field, not individual people ([CT-DEC-02](DECISIONS.md#ct-dec-02-engine-and-art)).
- Old saves keep playing. A phase that cannot be expressed as optional fields bumps the schema and writes the migration in [`SAVE_FORMAT.md`](SAVE_FORMAT.md) first.

## Lot live-show experiment (proposal)

The imported software spec v0.1 remains a proposal. Its M2 target is a *next gameplay test*, not the Lot Night first playable that already shipped. The initial experiment uses the existing 24 × 16 Lot, existing show length, seeded incident and accepted corner HUD. It is opt-in with `?night-slice=1`; normal careers and saved shows keep the present behavior. It asks one additional, reversible staffing question at doors: keep a bar worker serving or move that worker to admission for the rush. The gate choice should shorten the modeled initial queue and reduce bar throughput. Both outcomes must be shown on the settlement and use the same seed, other costs, and contract terms. A saved choice resumes with the same outcome. This experiment does not introduce purchased gear, deposits, calendar time, new venues or a long show.

**Checks before asking for a larger simulation:**

1. Compare at least three repeated Lot nights in normal and opt-in play, including the same seed and layout with each staff choice. Count interruptions and when the player acts. Check whether players can describe the queue-versus-bar trade-off before seeing the sheet.
2. Ask players whether each night had idle stretches, whether either prompt interrupted something enjoyable, and whether they would choose differently next time. Record reasons and confusing text, not only an average rating. The present 12-second playback cannot validate the draft's proposed 6 to 10 minutes.
3. Run deterministic engine cases that show the two choices change queue pressure and bar capacity without changing total hired staff or charging twice. Browser smoke must cover reload during the new question, the two answers, keyboard focus, and no scrolling on desktop and phone. Preserve the existing first playable and balance baselines when the experiment is off.
4. If the second prompt adds only busywork or produces an obvious best answer, revise it or remove it. Choose any third interaction only after this result. A staged queue and representative crowd are enough for this question; pathfinding, 64 × 64 maps and a new clock do not follow from it.

## Economy and world proposals from spec v0.1

Purchasing equipment, a ledger, a booking calendar, power zones, travel, charts, rivals and holidays remain separately proposed. [SAVE_FORMAT.md](SAVE_FORMAT.md#proposed-next-save-and-economy-transition) records the compatibility contract for evaluating ownership and accounting. The original milestone order does not replace the shipped roadmap. Resolve the deal basis, asset tenure, calendar pacing and each release gate before their affected system is implemented; keep CT-DEC-10 and CT-DEC-11 Proposed until Dave changes them.

## Research and upgrade progression (proposal)

[RESEARCH.md](RESEARCH.md) now owns the proposed development tree and gameplay dynamics ([CT-DEC-13](DECISIONS.md#ct-dec-13-research-and-upgrade-progression)). Eight branches cover production, bars, sanitation, vendors, admissions, security and venue infrastructure. Research unlocks organizational capabilities; deployment still consumes equipment, staffing, space and cash. The existing four career tiers remain the progression bands.

The next research experiment is a small Lot choice between Patch standards, Service training and Admission lanes, with one development slot and progress over eligible settled nights. Validate the research economy and interaction alongside the doors experiment before extending it to permanent infrastructure or later-tier projects. The existing baseline stays unchanged when the experiment is off. This is a documentation proposal, not a commitment to build the whole tree or accept the proposed economy.

Organizational research and individual employee skill trees are separate. The original crew-skills row below still limits its first pass to one skill affecting one outcome; it does not prohibit this newly proposed organizational tree. Existing room access, house equipment and the second stage must not become retroactively locked. The acceptance criteria and dependencies are in [RESEARCH.md](RESEARCH.md#10-acceptance-and-balancing).

## Gates for public sign-off and further Club work

These gates were written before Phase 5 shipped. They still matter for public sign-off and the missing Club mechanics, but they do not mean the playable Club has yet to be built.

| Gate | Why it blocks |
| --- | --- |
| Dave plays the Lot and signs the first playable off, or lists what changes | Public release waits on this. A new tier on an unplayed loop hides whether the deal choice is fun |
| Accept or change CT-DEC-10 | The Club's unlock is that decision: a sellout, venue reputation 60, $6,000, and one act at +20 |
| Say whether the light tower and the medium PA should be worth buying on the Lot | Careful play already skips both. Leaving that in place is a decision, not an oversight |
| Say what the Done screen should claim when the carried layout costs more than the cheapest show | The "needs at least" figure assumes the cheapest layout and no ads |

## Phase 5: the Club

Tier 2. Indoor, 150 to 600 people. Unlocked by the Lot goal. This section records the original scope; the playable room exists, while its ticketing and tier-specific balance verification are still missing.

**Resolve before adding the missing Club mechanics:**

1. **The room.** A fixed floor plan the player dresses, or a grid like the Lot. A fixed room makes the house rig readable and cuts placement bugs. A grid keeps the builder the player already learned. Pick one. Do not ship both.
2. **The Lot after the unlock.** The career moves to the Club and the Lot becomes a memory, or the player can still book a Lot show. If the Lot stays, the offers, the permit and the goal must not reset.

**Features in this phase:**

- One indoor venue with a house PA and a house lighting rig. Renting a PA is a Lot problem. The Club's production choice is how the house rig is used, and what is still hired on top.
- A new permit and a new capacity, inside the 150 to 600 band. Retune per-person and money values the way Phase 3 did for the Lot: scale them together, then re-run the simulator. Do not copy the Lot's numbers up.
- Regional fictional acts, with draw, ask, genre and a door rule. Name-check each one. Relationships carry from the Lot when the same act could play both rooms. Most Club acts are new.
- One ticketing choice on the Promote screen: the existing walk-up and flyer mix, or a platform that takes a cut and changes the presale. One platform is enough. A marketplace of platforms is later.
- The same five beats: Book, Build, Promote, Show, Settle. Show night stays one seeded incident.
- A Club goal that unlocks the Amphitheater. Write the goal in a decision before tuning it. Do not invent the cash target in the client.

**Not in this phase:** seats, a slope, a second stage, sponsorship, owning gear, a calendar of weeks, crew skills, Sandbox, Scenario.

**Done when:** a career can reach the Club from the Lot goal, play at least five Club shows with cash, reputation and relationships carried, and settle one of them; the simulator passes at the Club's scale, including a verdict that careless play does not unlock the next tier on every seed; a Lot save from before this phase still plays.

## Phase 6: the Amphitheater

Tier 3. Outdoor, 600 to 2,500. National fictional acts. A run of nights, not one night.

- The room is a sloped lawn, an acoustic shell and a concourse. Sightlines have to know the slope. A flat grid with a new backdrop is not this tier.
- Two capacity zones: general admission on the lawn, and seats. They sell, price and satisfy separately, and they share one settlement.
- A hold of two or three nights. Each night has its own attendance, incident and sheet. The run's reputation moves once, after the last night. Cancelling a remaining night is a money decision with a penalty, not a hidden failure.
- A noise curfew that can end the set early. This is the first rule that takes time of day seriously.
- The goal that unlocks the Festival Grounds is a decision of its own, written before the simulator verdicts.

**Done when:** a two-night run settles night by night and the career can move on; a one-night hold still works; the simulator covers a careful run and a careless one.

## Phase 7: the Festival Grounds

Tier 4. 2,500 to 25,000 and up. This is the end of the career ([CT-DEC-09](DECISIONS.md#ct-dec-09-career-tier-ladder)).

- Two stages on one site. Each stage has a bill, a crowd and a production cost. The day settles stage by stage, then as one site.
- Delay coverage for the far lawn, a VIP deck, and a compound for the buses. These are placeable or fixed by the same rule chosen for the Club's room. Do not switch builders at the last tier.
- Sponsorship as a deal type next to the guarantee and the door: money up front, a constraint on the bill or the site.
- Broadcast as a second payer. It pays from the show the player already built. It does not add a camera minigame.
- Headliners are fictional acts with festival-scale draws. An act from an earlier tier can open. It cannot silently become a headliner without a relationship gate.

**Done when:** one festival day with two stages settles stage by stage; a sponsor deal and a broadcast line appear on the sheet; the career can be finished, and a finished career can still book another day on the grounds.

## Systems, and the first tier that needs them

GDD section 6 lists these as "later". This is the order. A system does not jump ahead of its tier.

| System | Arrives | What "done" means at that tier |
| --- | --- | --- |
| House rig instead of a rented PA | Club | The Club show can be powered and heard without a Lot PA rental |
| Ticketing platform | Club | One platform, one fee, visible on the settlement sheet |
| Indoor sightlines | Club | A pillar or a wall can block a tile, using the same overlay as the Lot |
| Capacity zones | Amphitheater | GA and seats have separate prices and one sheet |
| Multi-night runs | Amphitheater | Each night settles, the run does not |
| Noise curfew | Amphitheater | An early end changes attendance and the deal |
| Second stage | Festival | Two bills, one site, stage-by-stage settlement |
| Sponsorship and broadcast | Festival | Both are lines on the sheet, not new screens |
| Crew skills | After the Club plays | Staff stop being only a headcount. One skill changes one show outcome. No skill tree in the first pass |
| Owning gear | Amphitheater | Buy, use, and wear out. Renting stays available. Depreciation is one number a season, not an inventory game |
| Merch split | Club, if the bar is not enough | One merch line on the sheet. No merch booth builder until the Festival |
| Calendar and season | Amphitheater | Weeks between holds. Slow months and festival season change demand. The Lot and the Club stay "book the next show" |
| FOH mix position | When a tier's sightline rule needs it | A placeable tent with a coverage effect. Not a mixer simulation |
| Terrain, cable, generator as objects | Festival, and only if the site is built on a grid | The Lot's generator stays a power budget until then |
| Pro-mode paperwork (input lists, stage plots, power plans) | Not scheduled | Open question 3 in the GDD. It needs its own decision. It is not required for any tier above |

## Modes

| Mode | When | Rule |
| --- | --- | --- |
| Career | Now, through the Festival | The default |
| Sandbox | After the Club plays | The same builder and the same show, with the money gates removed. No separate art |
| Scenario | After the Club plays | One scenario first: a wet outdoor show, or a room that is already in trouble. Preset state, same engine |
| Challenge | After v1 | Best score on the device. No server ([CT-DEC-05](DECISIONS.md#ct-dec-05-multiplayer)) |
| Endless | After v1 | A generated run of offers. Survive while the next show can be paid for |

## Art

The painted props on the lot are a stand-in so the board is readable. They are not art Phase 2. The original pixel-sheet plan below is historical: [CT-DEC-18](DECISIONS.md#ct-dec-18-realistic-3d-art-direction) now selects more realistic 3D for the new renderer. Existing assets remain until a validated replacement; D8 disposition is still open.

| Step | What changes | Blocked by |
| --- | --- | --- |
| Stand-in (landed 2026-10-01) | Eight prop sprites, sized to the widest 2× draw. Boxes if a file fails | Nothing. It is in `board.js` |
| Render contract | Tile size, anchors, footprints, frames, timing, palette, in a module the renderer and the sheets both follow | The open conflicts in [`ART_DIRECTION.md`](ART_DIRECTION.md) section 8 |
| Style anchor | Replace the stand-ins with the pixel sheets: stage, both PAs, barricade, FOH tent, generator, restrooms, crowd stamps, one crew walk | The contract, and Dave saying the Lot loop is fun ([CT-DEC-02](DECISIONS.md#ct-dec-02-engine-and-art)) |
| Four venue looks | Lot, Club, Amphitheater, Festival. A new tier does not ship on the Lot's asphalt with a tint | That tier's phase |
| Showtime FX | Sweeps, strobes, haze, on top of the style anchor | The style anchor. The code-drawn beams stay until then |

Palette swatches in the Build panel can stay flat color until the style anchor. They are labels, not the board.

## Release

On Dave's sign-off of the Lot, and not before: a hub card with a gameplay image and where it came from, a sitemap entry, and `noindex` removed. `docs/MANUAL.md` starts when the Lot loop stops moving. Until then the in-game tips are the manual.

Original platform scope deferred touch-first work until after v1 ([CT-DEC-04](DECISIONS.md#ct-dec-04-platform)). Phone tabs and touch sheet controls have since shipped under [CT-DEC-12](DECISIONS.md#ct-dec-12-hud-layout); physical-device acceptance remains outstanding. Do not read the original deferral as a claim that no phone layout exists.

## Build order

**Historical, superseded for scheduling by [CT-DEC-14](DECISIONS.md#ct-dec-14-expansion-sequence).** The numbered list records the 2026-10-01 plan; it is not the next implementation queue.

1. The four gates in the table above.
2. The two Club decisions (room, and whether the Lot stays).
3. Phase 5, then its simulator verdicts.
4. Sandbox and one scenario, on the Club's systems.
5. The render contract, then the style anchor, once the Lot is fun to play.
6. Phase 6, including zones, multi-night runs and the curfew.
7. Phase 7, including the second stage, sponsorship and broadcast.
8. Challenge and Endless, after v1.
9. Hub card and index, whenever sign-off happens. It does not wait for the Festival.

## Open on purpose

| Question | Where it is answered |
| --- | --- |
| Is the Lot career the one Dave wants? | CT-DEC-10, still Proposed |
| Fixed Club plan, or a grid? Lot stays bookable? | Grid Club and returnable Lot are implemented under CT-DEC-11, still Proposed. D10 in [DECISION_PACKET.md](DECISION_PACKET.md) asks whether to accept or reopen them |
| Should the Lot's tower and medium PA pay for themselves? | Playtest, then `data.mjs` if the answer is yes |
| Are the painted sprites the look, or a stand-in? | This file treats them as a stand-in. Say if that is wrong |
| Pro-mode AV paperwork? | GDD open question 3. Unscheduled |
| Co-promotion with another player? | Out of v1 ([CT-DEC-05](DECISIONS.md#ct-dec-05-multiplayer)) |
