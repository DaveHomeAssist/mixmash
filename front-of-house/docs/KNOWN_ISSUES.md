# Front of House Known Issues

**Status:** Active. Opened 2026-10-02 from the audit of `ddbc50e` and the open items in [`progress.md`](../progress.md). Hand-written.

One list of what is wrong, weak or unrecorded, so it isn't scattered through session logs. A design question that needs Dave's call is listed here *and* points to where the decision will be recorded. When an issue is fixed, set its status to Fixed with the change that fixed it; remove fixed rows after the next release.

**Severity:** **High** blocks the playtest sign-off or breaks a session. **Medium** weakens the game's choices or misleads the player. **Low** is polish, paperwork or tooling.

## Open

| ID | Severity | Area | Issue | Evidence | Next step |
| --- | --- | --- | --- | --- | --- |
| KI-01 | Medium | Balance | **Incident stakes need playtesting.** The incident component has only 10 of 100 satisfaction points, so a strong layout can still pass with a weak response. Responses already affect expenses, satisfaction-linked bar revenue and reputation; eligible response costs also change the door-deal payout. Neither free nor paid is universally best | Audit run: "Wait it out" finished at 93/100. The paired engine example below gives the paid PA response a $7 net advantage and two more reputation points. [BALANCE_BASELINE.md](BALANCE_BASELINE.md) section 5 compares response policies | Compare paired net and career outcomes, then have Dave playtest whether the trade is readable and meaningful before retuning. Pairs with the queue and staffing slice in [FUTURE.md](FUTURE.md#lot-live-show-experiment-proposal) |
| KI-02 | Medium | Balance | **The door deal is the answer on the Lot.** At the fair $20 price it nets the promoter more than the guarantee at every draw; the guarantee wins only at $25+ with a strong draw | [BALANCE_BASELINE.md](BALANCE_BASELINE.md) sections 2, 3 and 6 (door 88% of seeds, guarantee 59%) | Dave, after the playtest (already a gate in FUTURE.md) |
| KI-03 | Medium | Balance | **Building is solved in one click.** The suggested layout scores 98 to 100 at every draw, while careful play picks the budget layout, so the light tower and medium PA rarely pay for themselves | BALANCE_BASELINE.md section 2; `progress.md` TODO; FUTURE.md gates | Dave: should satisfaction cost more on the Lot? |
| KI-04 | Low | Copy | The settlement's incident tip says a stronger response "saves the night" even when the night scored 93 | [STRINGS.md](STRINGS.md) `TIPS.incident`; audit screenshot | Name what the incident actually cost, or skip the tip when the loss is small |
| KI-05 | Low | Copy | The top strip's **Band** meter is the booked act's relationship; the label doesn't say so | `index.html` `#meter-rel` | Rename (for example "Act") or add a tooltip |
| KI-06 | Medium | Copy | The Done screen's "needs at least" figure assumes the cheapest layout and no ads; a player carrying the suggested layout must cut rentals first | `progress.md` Phase 4 verification; FUTURE.md gates | Dave, with the playtest |
| KI-07 | Low | Assets | **Where the 40 images came from is not recorded**, and neither is their licence | [ASSETS.md](ASSETS.md) "Source" column; `sprites/manifest.mjs` | Record the tool or artist and the terms for each, before the page goes public |
| KI-08 | Low | Assets | The sprite library is 19.6 MB in the public repository and drawn by nothing. It is high-detail rendering, not the pixel art ART_DIRECTION.md specifies, and the two crowd groups are in a third, cartoon style | ASSETS.md section 2 | Decide what to keep when the render contract is written; consider moving the files out of the served branch |
| KI-09 | Low | Copy | About 170 player-facing strings are written inline in `game.js` render functions, so they can't be reviewed in one place | STRINGS.md section 4 | Move them into named tables as screens are touched; the generator picks up new tables listed in `COPY_TABLES` |
| KI-10 | Low | Tooling | The simulator's careful strategy picks incident responses by computing the settlement with the hidden draw, so its verdicts are an upper bound on informed play | `progress.md` TODO | Keep `paired.mjs` as the informed-play check, or give the simulator a screen-only policy |
| KI-11 | Low | Scope | Not built with the rooms: a ticketing platform, a hillside model, cancelling a held night, simulator verdicts for the Club and later, and four venue art looks | `progress.md` TODO; [FUTURE.md](FUTURE.md) | On the roadmap per tier |
| KI-12 | Low | Release | Public release gates are open: Dave's playtest sign-off, CT-DEC-10 and CT-DEC-11 still Proposed, `noindex`, no hub card, no sitemap entry | [RELEASE.md](RELEASE.md); [DECISIONS.md](DECISIONS.md) | Dave |
| KI-13 | Low | Copy | The Show card's heading stays "Doors are open" all night, so a PA dropout at 21:05 sits under it | `game.js` `showPanel`; screenshot after the R-11a fix | Let the heading follow the clock (doors, set, curfew) |
| KI-14 | Medium | Performance | Full native3D/HUD repeats do not establish sustained60fps:55.91–59.84Hz after removing duplicate render submissions, with shared-host variation | [Complete repeated evidence](PERFORMANCE.md#full-native-hud-batching-comparison) | Keep exact source/quality attribution; profile the supported desktop/low-power matrix and retain human readability acceptance before release |

### KI-01: paired engine example

Reproduced with `evaluateShow` using the Lot's `STARTER_LAYOUT`, Sodium Arcade, a door deal, $20 tickets, no ads, venue reputation 0, draw 125 and a PA dropout. These are controlled engine inputs, including a known draw; they are not a player policy or a claim about every show.

| Response | Satisfaction | Bar revenue | Response cost | Artist payout | Show net | Reputation change | Act relationship change |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Wait it out (`wait`) | 93 | $698 | $0 | $287 | $821 | +17 | −4 |
| Swap in the backup amp (`backup-amp`) | 98 | $735 | $100 | $217 | $828 | +19 | −6 |

The backup costs $100, earns $37 more at the bar and reduces the artist's door-deal share by $70, leaving $7 more show net. The smaller payout also worsens the act relationship by two more points. This demonstrates an existing financial and career trade-off; it does not establish the best response across draws, deals or career goals. Balance and incident weights remain unchanged.

## Fixed

| ID | Fixed in | Issue |
| --- | --- | --- |
| MXS-06 | FOH-F01 (2026-10-04) | Phone Book/Promote inherited a 580px desktop width, clipping content despite zero page overflow. The mobile phase overrides and range-input margins now fit the sheet; all visible tabs and controls are checked at 360/375/390px |
| KI-00 | This change (R-11a) | Incidents fired at a random 20% to 80% of the night whatever they were, so "PA dropout mid-set" could arrive at 20:01 with the doors still open and "Rain at doors" after the act was on. Each incident now has its own window in `INCIDENTS`, and each night of a run takes its timing from that night's seed. The balance baseline is unchanged, because timing affects no number on the sheet |
