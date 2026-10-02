# Front of House Known Issues

**Status:** Active. Opened 2026-10-02 from the audit of `ddbc50e` and the open items in [`progress.md`](../progress.md). Hand-written.

One list of what is wrong, weak or unrecorded, so it isn't scattered through session logs. A design question that needs Dave's call is listed here *and* points to where the decision will be recorded. When an issue is fixed, set its status to Fixed with the change that fixed it; remove fixed rows after the next release.

**Severity:** **High** blocks the playtest sign-off or breaks a session. **Medium** weakens the game's choices or misleads the player. **Low** is polish, paperwork or tooling.

## Open

| ID | Severity | Area | Issue | Evidence | Next step |
| --- | --- | --- | --- | --- | --- |
| KI-01 | Medium | Balance | **Incident choice barely matters.** `W_INCIDENT` is 10 of 100 satisfaction points and the pass mark is 60, so ignoring an incident costs at most 7 points. PA dropout's paid response changes only the score, so free is always right; rain and curfew at least move walk-up money | Audit run: PA dropout answered "Wait it out", satisfaction 93/100. [BALANCE_BASELINE.md](BALANCE_BASELINE.md) section 5; `paired.mjs` shows paid responses add 0.3 to 4.4 points | Dave: decide whether incidents should cost money or time as well as score. Pairs with the queue and staffing slice in [FUTURE.md](FUTURE.md#lot-live-show-experiment-proposal) |
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

## Fixed

| ID | Fixed in | Issue |
| --- | --- | --- |
| KI-00 | This change (R-11a) | Incidents fired at a random 20% to 80% of the night whatever they were, so "PA dropout mid-set" could arrive at 20:01 with the doors still open and "Rain at doors" after the act was on. Each incident now has its own window in `INCIDENTS`, and each night of a run takes its timing from that night's seed. The balance baseline is unchanged, because timing affects no number on the sheet |
