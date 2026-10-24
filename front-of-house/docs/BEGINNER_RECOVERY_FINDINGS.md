# Beginner recovery findings

**Recommendation: improve affordable-plan guidance first; retain the current
economy and completion rules pending a separate decision.** Cheaper existing plans
improve scripted beginner completion on both historical and fresh seeds. Earlier
venue recovery has no eligible intervention in these beginner cohorts, so its
effect on beginner completion is not estimated. No balance change is authorized.

## Source and controlled design

Reviewed PR #186, its discussion, current repository decisions and newer PR/issue
searches. Publishing head remains `412d01d5e1cfe282828bc0e418441058abee8b3b`.
No newer balance implementation or FOH-BAL-01 answer was found. PR #184 concerns
settlement presentation/browser checks, not a new economy decision. FOH-BAL-01
and D12 remain open; this request authorizes the controls, not the rest of option A.

The [protocol](BEGINNER_RECOVERY_PROTOCOL.md) and experiment implementation were
frozen locally in `3733287706602a03d872e2166e7786785f81b0a3` before cohort execution.
The original workbench, game rules, data, saves, renderer and product version are
byte unchanged. Tests ran in the cloud workspace on Node 24.19.0.

Each arm uses the same seeds, normal earned unlocks, 60 signed shows maximum and
the beginner's cheapest affordable incident response. Adaptive keeps every
preferred beginner choice; only when none is affordable does it select the
cheapest original-grid plan, ordered by opening cost then stable ID. If that grid
is empty, it tries the engine-authored minimum layout, usual ticket price, zero
ads and legal deals/side acts. Required Festival support stays present.
This is a simple affordability fallback, not profit optimization.

Venue recovery tries previously earned rooms, nearest first, only in Book after
the current-room policy finds no plan. It does not bypass nextShow refusal or
change phase, cash, seed or unlocks. Combined applies both controls. The original
fixed driver is imported directly, and every career verifies exact normalized
replay plus identical outcomes before its first intervention.

## Completion and progression

Each percentage below is also a count out of 100, except the 20-seed replication.

| Policy | Historical 1001–1100 | Former holdout 1081–1100 | Fresh validation 2001–2100 |
| --- | ---: | ---: | ---: |
| Fixed beginner | 58% | 10/20 | 53% |
| Adaptive plans only | 83% | 17/20 | 84% |
| Earlier venues only | 58% | 10/20 | 53% |
| Both | 83% | 17/20 | 84% |

Adaptive adds 25 and 31 matched completions, with zero lost completions. Keeping
successful preferred choices unchanged makes zero lost baseline completions an
expected property of this intervention, not proof of universal safety. There are
200 unique experiment seeds and 800 career runs; matched arms are not independent
human observations. The fresh 100 seeds were not inspected until implementation
and protocol were frozen; no policy changed after their outcomes were observed.
The former holdout was already public and is replication only.

| Measure | Historical fixed → adaptive | Fresh fixed → adaptive |
| --- | --- | --- |
| Signed shows | 1,322 → 2,097 | 1,237 → 2,067 |
| Reach Club / Shell / Festival | 59 each → 86 each | 54 each → 85 each |
| Median unlock show: Club / Shell / Festival | 8 / 13 / 18 → 9 / 14 / 19 | 8 / 13 / 18 → 9 / 14 / 19 |
| Median shows among completed careers | 20 → 22 | 20 → 22 |
| Median final cash | $552,775 → $606,909 | $532,380 → $638,210 |
| Final cash p10 | $2,062 → $1,304 | $1,897 → $1,224 |
| Mean matched cash difference at show 10 | +$1,022.09 | +$1,482.93 |

Completed-career lengths have different survivor composition; newly rescued
careers often take longer. Terminal cash compares different stopping times.
Fixed-horizon cash carries a stopped/completed career's final cash forward, with
absorption counts in the evidence. At show 10, 41 fixed versus 12 adaptive
historical careers had already ended; fresh counts are 46 versus 14. Mean gains
do not imply everyone benefits: paired cash-difference p10 at that horizon is
negative ($669 historical, $790 fresh), while the median is zero.

## Stop reasons and actual cash recovery

| Stop | Historical fixed → adaptive | Fresh fixed → adaptive |
| --- | ---: | ---: |
| Preferred policy has no plan, other grid choices exist | 39 → 0 | 45 → 0 |
| No affordable original-grid plan | 2 → 0 | 1 → 0 |
| Engine refuses nextShow | 1 → 17 | 1 → 16 |
| Show limit | 0 → 0 | 0 → 0 |

The increase in engine refusals is not a deterioration for previously successful
careers: the fallback allows previously stopped careers to continue, and some
later fail. Historical adaptive refusals occur 14 times at the Lot and three at
Festival; fresh refusals occur 15 times at the Lot and once at Festival. These
are real refusals under the current-room continuation rule, distinct from an
exhaustive proof that every economic recovery strategy is impossible.

| Adaptive intervention measure | Historical | Fresh validation |
| --- | ---: | ---: |
| Careers using a fallback | 41 | 46 |
| Those careers eventually completing | 25 | 31 |
| Original-grid / minimum-layout fallbacks | 97 / 26 | 101 / 31 |
| Fallback shows with nonnegative cash movement | 67/123 | 83/132 |
| Losing fallback shows regaining their pre-show cash within three later shows | 20/56 | 16/49 |
| Losing fallback shows with unresolved short follow-up | 25 | 23 |

The three-show recovery counts include all losing fallback shows in their
denominator; censored cases remain explicit. Across all shows, historical
loss-recovery counts change from 149 recovered out of 156 observable losses
(67 censored) to 264/331 (39 censored). Fresh counts change from 134/142
(74 censored) to 266/332 (32 censored). Adaptive prevents some premature stops
but does not make cheap shows reliably profitable.

Seed 1001 illustrates the distinction: fixed stops after one show at $2,233;
adaptive signs six shows before an engine refusal at $941. Seed 1093 signs
four instead of two shows, ending at $975. Its first minimum-layout opening
really costs $1,025, but that continuation loses $167. These are different
deterministic fallback choices from the old one-show probes; they are not
replacements for those frozen observations.

## Earlier-venue recovery: legal route, no beginner opportunity measured

Both venue-enabled arms recorded zero lower-room attempts and zero venue changes.
There is no lower room at the Lot. At later-room terminal failures, nextShow
refuses while the game is Done, and chooseVenue explicitly requires Book.
The four adaptive Festival refusals were replayed and both actions tested:

| Seed | Cash | Current-room next-show quote | Shell earned | Choose Shell from Done |
| --- | ---: | ---: | --- | --- |
| 1032 | $11,637 | $37,650 | Yes | Refused |
| 1039 | $5,725 | $14,050 | Yes | Refused |
| 1057 | $12,481 | $14,270 | Yes | Refused |
| 2040 | $28,248 | $37,650 | Yes | Refused |

This is an observed action-path limitation, not authorization to weaken the
continuation rule. A proactive venue/reserve strategy before this gate is a
different experiment and needs a fresh validation range.

A separate positive control restores the published random seed 1001 stopped
at Festival in Book with $26,608. The fixed beginner's preferred plan at earned
Shell opens for $21,400, signs show 23 with a $27,876 cash gain, ends at $54,484
and legally returns to Book. Its complete action trace replays exactly. This is
one legal profitable continuation, not a beginner cohort result or a sustainable
career estimate. The old $35,844 recovery probe used a different plan and remains
valid; the two should not be conflated.

## Recommendation and unresolved questions

1. **Prioritize guidance for existing affordable alternatives.** Explain that the
   suggested plan being unaffordable does not mean the career is over. Show the
   opening cost and remaining cash for cheaper layouts, lower advertising and
   available deal choices; warn that cheapest does not mean profitable.
2. **Retain balance values for now.** The large replicated completion improvement
   comes entirely from policy choice. Remaining Lot refusals justify reserve-aware
   policy and human-play investigation before attributing difficulty to starting
   cash, prices or costs. This study does not establish a target human completion rate.
3. **Investigate venue recovery timing separately.** Test proactive reserve/venue
   guidance at Book on fresh matched seeds. Any change that allows venue selection
   after a refused nextShow is a product/rule decision, not a harness correction.
4. **Keep Festival pacing and finale quality open.** Adaptive still completes on
   retry-quality finales in 76/83 historical and 79/84 fresh completions. The
   completion-quality mismatch and published Festival cash scale are unresolved;
   neither is fixed or accepted by this test.

No player-facing guidance, balance, rule, save, version, release or deployment
change is included. This is a tested investigation on an unmerged branch. Existing
human desktop/physical-phone review, rights and D12 gates remain separate.

## Reproduction and verification

```sh
npm run test:front-of-house-recovery
npm run sim:front-of-house-workbench -- --seeds 100 --start 1001 --shows 60 --out front-of-house/sim/output/baseline
npm run sim:front-of-house-recovery -- --seeds 100 --start 1001 --shows 60 --out front-of-house/sim/output/recovery-historical
npm run sim:front-of-house-recovery -- --seeds 100 --start 2001 --shows 60 --out front-of-house/sim/output/recovery-validation
node front-of-house/sim/recovery-evidence.mjs
npm run sim:front-of-house-recovery -- --replay front-of-house/sim/output/recovery-validation/recovery-report.json
```

The [retained evidence](../sim/beginner-recovery-evidence.json) includes source
digests, raw-report hashes, all 800 compact career outcomes, intervention events,
cash distributions and horizons, 24 selected traces plus the positive control,
and the four refusal probes. Full per-show reports regenerate in ignored output
directories. The evidence generator recomputes summaries from all career rows,
checks matched prefixes, compares every historical fixed result to the original,
and replays retained examples. All 800 full experiment careers were replayed
during measurement, not just the selected examples. The experiments contain
13,446 signed shows; the separate baseline contains 600 careers and 10,183 shows.

| Verification | Result |
| --- | --- |
| Original six-policy baseline | Byte-identical full report and source digests; all 14 retained replays pass |
| Original report SHA-256 | `612bab576b2c86b17f42946b5a41daf95f95c40abca80318c5c6296566077eb2` |
| Historical experiment SHA-256 | `44533b26dd31b46a97bbe93b9bc770950abbdd4d5f12b88a140030154b9725ef` |
| Fresh validation SHA-256 | `ebbed97c22fdf6cc3119cdc812c462cec24bd838399f6b202ee3c157aa99fe7c` |
| Repository unit tests | 508 passed, including original workbench and five new recovery tests |
| Build/syntax checks | Passed |
| Lot and tier regression gates | Passed, generated baselines unchanged |
| Full-career regression | 30/30 complete, 515 signed shows, 30 exact reload pairs; baseline unchanged |
| Generated game documentation | Regenerated without drift |
| Accounting/save checks | Exact opening, incident and signing cash; legal actions, integer cash, ledger balance, normalization/reload coverage |
| Physical devices / human difficulty | Not measured; no new UI or runtime changes |

An initial integrity test rejected a Festival minimum fixture missing required
touring-support objects. The harness was corrected and all five tests passed
before freeze and either cohort execution. No measured cohort was retuned or
discarded. Private board and communications-log synchronization are unavailable
from this workspace and are not claimed.
