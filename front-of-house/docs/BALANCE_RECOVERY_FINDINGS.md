# Front of House recovery study and Festival pacing

Measured October 25, 2026 on Dominic, Node 24.17.0: **1,000 careers and
17,472 signed shows**. Ten fixed policies use fresh matched seeds 2001 through
2100, at most 60 shows. Seeds 2001 through 2080 are development; 2081 through
2100 are held out. No policy was adjusted after examining this cohort.

**Recommendation:** improve the affordable-choice control before raising beginner
cash. Preserve earned smaller-venue recovery as a real option, while treating
Festival pace and the meaning of completion as separate product choices.
Game balance, completion rules, runtime and saves remain unchanged.

## Matched outcomes

| Policy | Completed | Held out | Median shows among completed | Careers using downshift |
| --- | --- | --- | --- | --- |
| beginner | 53/100 | 11/20 | 20 | 0 |
| cautious | 100/100 | 20/20 | 16 | 0 |
| growth | 100/100 | 20/20 | 16 | 0 |
| aggressive | 100/100 | 20/20 | 16 | 0 |
| profit | 100/100 | 20/20 | 16 | 0 |
| random | 65/100 | 14/20 | 25 | 0 |
| beginner-adaptive | 83/100 | 15/20 | 22 | 0 |
| beginner-recovery | 53/100 | 11/20 | 20 | 0 |
| beginner-adaptive-recovery | 83/100 | 15/20 | 22 | 0 |
| random-recovery | 75/100 | 16/20 | 25 | 16 |

Adaptive booking gains 30 matched completions, including four held-out
completions. Random recovery gains ten, including two held-out completions.
No baseline completion is lost. These controls only diverge when the baseline
would stop, so preservation of earlier completions is largely by construction,
not evidence that every proactive use of cheaper bookings is harmless.

The original 53 completed beginner careers retain exactly their previous timing.
The adaptive completed-cohort median rises from 20 to 22 because it includes
30 newly completing careers. That is a composition change, not a two-show
slowdown of the same successful careers. At show 10, 54 original beginner
careers have either completed or signed ten shows, compared with 84 adaptive
careers. Terminal cash is not a fixed-time investment return.

## What the controls actually do

Adaptive keeps the first affordable suggested kit, usual price, reference ads and
direct Club sales. Only when that preferred plan is absent does it select the
cheapest affordable grid opening, with deterministic ID tie-break. It retains
original beginner incident responses. This is an affordability fallback, not a
profit optimizer or a calibrated model of learning.

Recovery tries the highest earned room first, then each smaller earned room
when the policy cannot select an affordable plan. Each subsequent booking tries
the highest room again. Venue changes and every show action use the actual
engine. No cash, unlock, relationship or hidden outcome is injected. Random
controls share their baseline choice seed until paths diverge.

### Beginner failures occur before venue recovery becomes available

All 46 original beginner booking stops occur at the Lot: 45 preferred-policy
stops with other affordable grid choices and one bounded-grid shortfall. The
remaining stop is a Festival Next show refusal. There is no earlier earned room
at the Lot, and no venue switch is legal from the refused done phase.

Adaptive eliminates the preferred-policy stops, but leaves 17 incomplete
careers: 14 Lot bounded-grid shortfalls, two Lot Next show refusals and one
Festival refusal. Neither beginner recovery control executes a downshift, so
adding it leaves 53/100 and 83/100 respectively unchanged. This does not show
that venue recovery is useless generally. It shows where these beginners fail.

Fourteen bounded-grid failures are not fourteen proven bankruptcies. The grid
still excludes arbitrary layouts, including the engine's distinct cheapest-kit
path. Compare that path before recommending more starting money or lower costs.

### Earlier venue recovery helps the random control

Sixteen random-policy careers execute 31 Festival-to-Shell recovery shows.
All 31 increase available cash: median **$21,329**, range **$8,400 to $30,502**.
Every episode returns to Festival within three later signed shows (31 observable,
zero censored). Ten of the sixteen careers subsequently complete. The other six
do not, so a profitable downshift is not a guarantee of career success.

Random completion rises from 65/100 to 75/100. Bounded-grid stops fall from 28
to 12, while engine continuation refusals rise from seven to thirteen because
more careers continue far enough to encounter that separate boundary. Twelve
random-recovery refusals occur at Festival and one at the Lot. The control
preserves this restriction rather than teleporting a done-phase career into Book.
Any change to recovery access at that boundary needs a separate rule decision.

## Festival remains fast and financially forgiving for competent policies

The four stronger policies complete 100/100 and 20/20 held-out careers each.
Their median overall completion is 16 shows. Each takes a median **two Festival
shows**, with a 90th percentile of three, after first Festival entry. All 400
already exceed the current **$80,000** Festival cash goal before opening there.

All 84 adaptive beginners who reach Festival also exceed that cash goal on
entry. Their median entry cash is **$164,601** (p10 $124,160, p90 $199,652).
The cautious policy enters at median **$181,620** (p10 $146,127, p90 $216,593).
This makes the cash gate nonbinding for these entrants, not for every player:
68 of 87 random-recovery Festival entrants already meet it.

Cautious median available-cash gain per signed show is **$35,736 at Shell** and
**$570,424 at Festival**, about 16 times as much. Its median Festival cash gain
is 7.61 times the quoted opening cost, among shows with a positive opening quote.
These are real charged/signed cash movements, not forecast profit. The jump is
an economy design signal, not an accounting defect established by this study.

Adaptive beginners complete Festival in a median two Festival shows, but only
19 of their 198 Festival shows pass. **78 of 83 completed adaptive careers end
on a retry-quality show.** Existing completion checks attendance, cash and artist
loyalty. This study does not add a passing-finale condition or interpret financial
completion as proof of good show production.

## Proposed pacing targets, not implemented values

Use these as an initial product target for a later isolated experiment. They
are design recommendations informed by the current two-show finish and large
income jump, not targets already proved achievable or accepted by Dave.

| Measure | Proposed target | Why |
| --- | --- | --- |
| Competent Festival phase | Median 4 to 6 signed shows; p90 no more than 8, measured among entrants that complete | Give bill, price and recovery choices time to matter without a long grind |
| Adaptive beginner Festival phase | Median 6 to 10; p90 no more than 15 among completing entrants | Preserve a skill difference and room to recover |
| Festival cash goal on entry | At most 25% of competent entrants already satisfy it | Make the existing money gate relevant after entering the final tier |
| Routine Festival cash gain | Median positive cash delta 2 to 4 times matched Shell positive-show median, with both all-show loss rates reported | Retain a larger-venue payoff while reducing the current approximate 16-fold jump |
| Competent downside protection | At least 90% of competent entrants complete within the 60-show career horizon; separately report entry-conditioned and all-start rates | Avoid turning longer pacing into widespread failure |
| Practical recovery | At least 80% of fully observed eligible downshift episodes return to the highest earned venue within three signed shows; report censored episodes separately | Keep a bad night recoverable without assuming every cheaper booking works |

Count all signed shows after first Festival entry in the pacing clock, including
lower-venue recovery. Also report actual Festival nights separately. Conditioning
on completion can hide failures, so publish the completion rates and stop causes
beside timing percentiles. Do not impose an 80% floor on random overall completion:
random is a stress control, not the intended competent-player experience.

Do not choose a replacement cash goal by multiplying $80,000 or copy a new dollar
cost from these ranges. Current careers stop at completion, so their truncated
traces cannot establish outcomes under a higher goal. A subsequent isolated
experiment must play beyond the old endpoint under an explicitly approved
hypothesis, use fresh seed ranges, and retain unchanged-rule controls. Changing
completion thresholds or requiring a passing finale is outside this approval.

## Recommended sequence

1. Retain adaptive affordable-choice and smaller-venue controls in the workbench.
   Compare the true cheapest-kit path for the 14 residual Lot grid failures.
2. Review the pacing ranges above. If approved, vary one Festival income/cost
   lever at a time in an isolated experiment with fresh matched seeds. Keep
   completion rules fixed for that economy comparison.
3. Inspect the cash goal and quality/completion mismatch as separate product
   decisions. Do not silently add a passing-finale rule while tuning money.

FOH-BAL-01 investigation A is accepted and measured. **FOH-BAL-02**, pacing target
choice, remains open: A (recommended) test the gradual ranges above; B retain the
current fast finale and focus on guidance; C scope a separate quality-led finale
experiment. None changes the live game without later explicit authorization.

## Verification and reproducibility

Eleven integrity tests pass, including public-information independence in all
four rooms, quote parity, legal actions, exact cash/ledger invariants, deterministic
policies, reload and recovery replay. Eighteen previously inspected careers
(three seeds across the original six policies) retain identical actions, receipts,
cash and final state hashes versus version 1. All 26 selected fresh-cohort traces
replay exactly. The legacy unit suite, build, three balance simulators and generated
document drift checks pass on Dominic. Game runtime/economic sources are unchanged.

The [compact recovery baseline](../sim/recovery-baseline.json) contains matched
transitions, development/held-out summaries, per-episode diagnostics, source
hashes and replay fingerprints. Full raw report SHA-256:
`d62b752ea2860131eb415eb380690df21cbf4151cf902bf30dbc08d1e1852861`.
The private evidence bundle retains the raw report, exact source, analysis script
and validation logs. The original [version 1 findings](BALANCE_WORKBENCH_FINDINGS.md)
and [baseline](../sim/workbench-baseline.json) remain intact historical evidence.

```sh
npm run test:front-of-house-workbench
npm run sim:front-of-house-workbench -- --seeds 100 --start 2001 --shows 60
npm run sim:front-of-house-workbench -- --replay front-of-house/sim/output/report.json
```

These scripted cohorts are not observed human players. Held-out samples contain
20 seeds per policy; the small differences are directional evidence, not precise
population estimates. Policies and the bounded grid omit arbitrary placement,
live services, purchases, research and held-night schedules. Matched seeds align
initial conditions, not identical later shocks after different decisions. This
held-out range has now been inspected and must not be reused as fresh validation
for choosing future parameters. Product pacing, physical-device experience and
human acceptance remain unverified by headless simulations.
