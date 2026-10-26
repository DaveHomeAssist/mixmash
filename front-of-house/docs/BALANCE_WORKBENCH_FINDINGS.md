# Front of House balance findings

Measured October 23, 2026 on Walter, Node 22.22.1: **600 careers and 10,183 signed
shows**, using seeds 1001 to 1100 for each of six fixed policies. Seeds 1001 to 1080
are development; 1081 to 1100 are held out. Each career has a 60-show limit, earns
its unlocks normally, and stops at completion or a reported stop. No balance,
rule, save, renderer or product-version changes were made.

## What to investigate first

### Beginner recovery needs a better control before an economy change

Beginner completed 58/100 careers, including 10/20 held-out careers. However,
39 stopped because the fixed suggested-layout/usual-price/reference-ad policy
found no plan while other affordable grid plans remained. These are policy stops,
not bankruptcies. Seed 1001 stops after one show with $2,233; the engine's displayed
minimum show quote is $1,025 and reports that another show is affordable.

Two more beginner careers have no affordable plan in this workbench's bounded
grid. Seed 1093 still has $1,298 against an engine minimum quote of $1,025. This
proves the grid is not an exhaustive affordability oracle. The remaining one
beginner stop is an engine continuation refusal. Do not report all 42 noncompletions
as game bankruptcies or use them alone to raise starting cash.

Recommended next experiment: compare this unchanged baseline with an adaptive
beginner that uses the existing cheaper-layout/deal controls when its preferred
plan is unaffordable. Separately test returning to an earlier earned venue before
calling a current-room cash shortfall terminal. Keep those controls distinct from
any game balance adjustment.

Three bounded recovery probes were then played through real actions, separate
from the frozen cohort. Beginner seed 1001 can book a $1,605 alternative and sign
another show, ending at $2,082 after a $151 loss. Beginner seed 1093 can open the
engine's $1,025 cheapest layout and sign, ending at $1,078 after a $220 loss. These
prove a legal continuation, not sustainable recovery. Random seed 1001 can return
from Festival to the already-earned Shell, open for $21,100, and finish at $62,452
from $26,608, with a $35,844 net result and satisfaction 82. That is an actual
one-show recovery path excluded by the highest-venue-only cohort policy.

### Festival money has a much larger scale than earlier venues

The cautious policy's median actual cash increase per signed show is $1,784 at
the Lot, $8,613 at Club, $35,736 at Shell and $570,424 at Festival. Festival is about
16 times Shell on this measure. Median cash at career completion is $1,294,040.

Every cautious, growth, aggressive and profit career already has at least the
$80,000 Festival cash goal before its first Festival opening. All 59 beginner
careers that reach Festival do too. That cash requirement is therefore nonbinding
for these cohorts at Festival entry. It is not universally nonbinding: only 67 of
88 random careers that reach Festival enter with that much cash.

Recommended next tuning investigation, after policy controls: paired Festival
revenue/cost and completion-cash-goal experiments. Set an intended number of
Festival shows and meaningful reserve requirement before proposing new values.
An income jump alone is not proof of an accounting bug; the workbench verifies
opening, incident and signing cash through the real engine.

### Festival completion and show quality can disagree

52 of 58 completed beginner careers finish on a retry-quality show. Across all
beginner Festival shows only 16 of 151 pass, with median satisfaction 58. The
current completion rule checks attendance, cash and artist loyalty rather than
requiring that the final show pass. Eleven of 61 completed random careers also
finish on a retry-quality show. The four stronger policies have no retry-quality
completion in this cohort.

This is a design choice to review, not an implementation defect to fix silently.
Choose whether career success means financial/reputational achievement or a
passing finale before changing a threshold or completion rule.

### Stronger policies converge; some choices deserve paired tests

Cautious, growth, aggressive and profit each complete 100/100 careers and 20/20
held-out careers, with a median 16 shows to completion. Their overall signed-show
pass rates range from 99.0 to 99.7 percent. This small scripted cohort does not
establish universal safety or human difficulty, but offers little completion-rate
separation among these four heuristics.

All 1,528 Club shows from these four policies select direct ticketing. Both direct
and platform appear in the random cohort, whose 355 Club shows all pass. None of
the four stronger policies selects the optional Festival delay layout. These
selection frequencies flag trade-offs to examine; they do not prove domination.
Run identical-state direct/platform and delay/no-delay ablations before changing
fees, benefits or costs. Growth is a one-step heuristic, not a long-horizon optimal
planner; Festival ranking is gross minus opening cost, not exact future net.

## Decision for the next investigation

**Historical decision: Dave selected investigation A on October 25, 2026.**
The approved scope is adaptive beginner and earlier-venue controls on fresh
matched seeds, then pacing recommendations. Game balance and completion rules
remain unchanged. See [the recovery study](BALANCE_RECOVERY_FINDINGS.md).

- **A, recommended:** establish adaptive beginner and earlier-venue recovery controls,
  then test the Festival economy curve against explicit pacing targets.
- **B:** first prototype and compare a passing-finale completion requirement. This
  changes the meaning of career success and requires a product decision.
- **C:** retain the current economy and completion rules; investigate guidance and
  the visibility of cheaper plans only.

## Scope and reproducibility

These are scripted strategies, not observed human players. The grid uses authored
layouts, one-night bookings, three price levels, three advertising presets, eligible
Festival side acts and Club ticketing plans. It excludes arbitrary placement,
research, purchases, held-night scheduling and live services. Every policy advances
to its highest earned venue; lower-venue recovery is not included. Final cash is
measured at different stopping/completion times, so it is not a fixed-horizon return.

No strategy or balance parameter was changed after inspecting held-out outcomes.
Fourteen selected traces replay to their exact normalized final states. Source
hashes and cohort statistics are preserved in
[the compact baseline](../sim/workbench-baseline.json); the full raw report's
SHA-256 is `612bab576b2c86b17f42946b5a41daf95f95c40abca80318c5c6296566077eb2`.

Reproduce the version 1 measured cohort from commit f9731fa or its exact source
bundle. Current version 2 adds four policies and has a separate fresh cohort:

```sh
npm run test:front-of-house-workbench
npm run sim:front-of-house-workbench -- --seeds 100 --start 1001 --shows 60
npm run sim:front-of-house-workbench -- --replay front-of-house/sim/output/report.json
```

The [workbench guide](BALANCE_WORKBENCH.md) explains policies and denominators.
The generated outcome tables follow.

## Generated cohort tables

Reproducible cohort: 100 seeds per policy, 60 shows maximum, six strategies.

Ordinary one-night careers, earned venues, representative layouts, three ticket prices and three ad presets; no live services, purchases, research or held runs.

Scripted policies are hypotheses, not measured human behavior. Terminal cash compares different career lengths; use matched fixed-horizon experiments before causal tuning. Forecast scoring is approximate, especially Festival gross minus opening cost. No balance values changed.

## Strategy outcomes

| Policy | Careers | Completed | Median final cash | Cash p10 | Median completed shows | Signed shows |
| --- | --- | --- | --- | --- | --- | --- |
| beginner | 100 | 58 | 552775 | 2062 | 20 | 1322 |
| cautious | 100 | 100 | 1294040 | 716103 | 16 | 1604 |
| growth | 100 | 100 | 1294027 | 717018 | 16 | 1595 |
| aggressive | 100 | 100 | 1276611 | 718581 | 16 | 1601 |
| profit | 100 | 100 | 1290269 | 717018 | 16 | 1599 |
| random | 100 | 61 | 590794 | 1956 | 28 | 2462 |

## Held-out outcomes

| Policy | Careers | Completed | Stops |
| --- | --- | --- | --- |
| beginner | 20 | 10 | {"complete":10,"policy_no_plan":8,"no_affordable_grid_plan":2} |
| cautious | 20 | 20 | {"complete":20} |
| growth | 20 | 20 | {"complete":20} |
| aggressive | 20 | 20 | {"complete":20} |
| profit | 20 | 20 | {"complete":20} |
| random | 20 | 13 | {"complete":13,"engine_cannot_continue":3,"no_affordable_grid_plan":4} |

## Per venue

| Policy | Venue | Reached / total | Shows | Median cash change per show | Median satisfaction |
| --- | --- | --- | --- | --- | --- |
| beginner | Oak St. Lot | 100/100 | 585 | 552 | 91 |
| beginner | Fathom Hall | 59/100 | 299 | 5923 | 66 |
| beginner | Loam Shell | 59/100 | 287 | 23476 | 78 |
| beginner | Split Acre | 59/100 | 151 | 420240 | 58 |
| cautious | Oak St. Lot | 100/100 | 632 | 1784 | 81 |
| cautious | Fathom Hall | 100/100 | 386 | 8613 | 72 |
| cautious | Loam Shell | 100/100 | 391 | 35736 | 82 |
| cautious | Split Acre | 100/100 | 195 | 570424 | 63 |
| growth | Oak St. Lot | 100/100 | 617 | 1822 | 80 |
| growth | Fathom Hall | 100/100 | 393 | 8517 | 72 |
| growth | Loam Shell | 100/100 | 391 | 35736 | 82 |
| growth | Split Acre | 100/100 | 194 | 570424 | 63 |
| aggressive | Oak St. Lot | 100/100 | 634 | 1528 | 82 |
| aggressive | Fathom Hall | 100/100 | 356 | 8774 | 72 |
| aggressive | Loam Shell | 100/100 | 401 | 35736 | 82 |
| aggressive | Split Acre | 100/100 | 210 | 561251 | 63 |
| profit | Oak St. Lot | 100/100 | 620 | 1805 | 80 |
| profit | Fathom Hall | 100/100 | 393 | 8545 | 72 |
| profit | Loam Shell | 100/100 | 392 | 35736 | 82 |
| profit | Split Acre | 100/100 | 194 | 570424 | 63 |
| random | Oak St. Lot | 100/100 | 1498 | 407 | 86 |
| random | Fathom Hall | 88/100 | 355 | 3871 | 71 |
| random | Loam Shell | 88/100 | 358 | 21918 | 80 |
| random | Split Acre | 88/100 | 251 | 31819 | 81 |

## Loss recovery

A loss is negative actual cash movement across a signed show. Recovery means regaining the cash held before that loss within the next three signed shows. Losses with fewer than three later shows and no observed recovery are censored, not silently removed.

| Policy | Losses | Recovery observed or full horizon | Horizon censored | Recovered within three |
| --- | --- | --- | --- | --- |
| beginner | 223 | 156 | 67 | 149 |
| cautious | 5 | 5 | 0 | 5 |
| growth | 11 | 11 | 0 | 11 |
| aggressive | 16 | 16 | 0 | 16 |
| profit | 12 | 12 | 0 | 12 |
| random | 612 | 537 | 75 | 427 |

## Replay examples

Examples include the first failure, lowest final cash and first completion for each policy, deduplicated. JSON retains every accepted engine action, full receipts, source hashes and final normalized-state digest. Replay validates the exact final state.

- beginner, seed 1001: policy_no_plan, 1 shows, cash 2233, 9 actions.
- beginner, seed 1093: no_affordable_grid_plan, 2 shows, cash 1298, 17 actions.
- beginner, seed 1003: complete, 31 shows, cash 1320598, 251 actions.
- cautious, seed 1012: complete, 14 shows, cash 647975, 115 actions.
- cautious, seed 1001: complete, 20 shows, cash 1787372, 163 actions.
- growth, seed 1012: complete, 14 shows, cash 654326, 115 actions.
- growth, seed 1001: complete, 18 shows, cash 1782244, 147 actions.
- aggressive, seed 1091: complete, 14 shows, cash 573995, 115 actions.
- aggressive, seed 1001: complete, 18 shows, cash 1764178, 147 actions.
- profit, seed 1012: complete, 14 shows, cash 654326, 115 actions.
- profit, seed 1001: complete, 18 shows, cash 1782244, 147 actions.
- random, seed 1001: no_affordable_grid_plan, 22 shows, cash 26608, 180 actions.
- random, seed 1009: engine_cannot_continue, 3 shows, cash 1171, 24 actions.
- random, seed 1003: complete, 34 shows, cash 822304, 275 actions.
