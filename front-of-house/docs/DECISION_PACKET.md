# Front of House decision packet

**Reviewed:** 2026-10-04 against `c9b64c2` (PR #58 merged). **Status:** D1 and D3–D11 accepted A; D2 accepted B. Codex selected D6–D11 under Dave’s explicit delegation to decide autonomously, recorded in [CT-DEC-19](DECISIONS.md#ct-dec-19-delegated-milestone-decisions). Owner: Dave; delegated decider: Codex. This packet summarizes choices; accepted rulings belong in [DECISIONS.md](DECISIONS.md), with the date, decider and authority. Feature scope is in [FEATURE_BRIEFS.md](FEATURE_BRIEFS.md). Current next steps are exported in [NEXT_STEPS.json](NEXT_STEPS.json).

## Already settled or not a product decision

- Continuous 360° camera movement is Dave's requested direction. The remaining choices concern art, scope and sequencing, not whether to offer orbit.
- Keep the Book → Build → Promote → Show → Settle loop and four-tier career. Existing HUD decisions remain accepted until explicitly revised.
- Keyboard bindings, conflict checks and 50-step Build undo/redo shipped in [PR #49](https://github.com/DaveHomeAssist/mixmash/pull/49). Do not ask to build them again.
- The phone Book/Promote width defect (MXS-06) needs a fix and regression check; it does not need a design vote. Its 580px rule still exists at this source revision. Live reproduction remains separate.
- Asset provenance, save integrity, accurate labels, reachable controls and source-based status updates are ordinary completion requirements.
- The supplied 3D archive has source, dependency-integrity and isolated runtime evidence in [PROTOTYPE_REVIEW.md](PROTOTYPE_REVIEW.md). Usage rights and production integration remain unverified.

## Settled prototype choices: scope and interaction

D1–D5 are settled: D1 A, D2 B, D3 A, D4 A, D5 A. The original alternatives and recommendations are retained below for provenance; selected answers override recommendations. D6–D11 are also settled A by delegated decision, below. Effort describes relative implementation scope, not a delivery estimate.

| ID | Decision and what it unlocks | A | B | C | Recommendation / confidence |
| --- | --- | --- | --- | --- | --- |
| D1 | Which expansion leads? Sets the first feature milestone, after routine defects | **3D Lot prototype → live operations → research**. Addresses the requested view first; delays deeper gameplay slightly | Live operations → 3D → research. Proves choices first; awkward view remains longer | Research first. Earlier progression; service benefits are harder to validate | **A / medium**. Revisit if the 3D source cannot be reused or the Lot prototype exceeds the device budget. [FB-01](FEATURE_BRIEFS.md#fb-01-continuous-orbit-and-camera-presets), [FB-04](FEATURE_BRIEFS.md#fb-04-live-arrivals-and-temporary-staffing) |
| D2 | What art supports orbit? Unlocks the renderer and asset contract | **Stylized dimensional 3D**, following the supplied venue references. Medium art scope; readable forms and free yaw | More realistic 3D. High art, lighting and device cost; greater visual detail | Illustrated directional sprites. More paintings and limited tilt; continuous movement can expose mismatched facings | **A / high**. Keep the current renderer usable until the prototype passes. Revisit visual detail after device testing. [FB-01](FEATURE_BRIEFS.md#fb-01-continuous-orbit-and-camera-presets), [FB-02](FEATURE_BRIEFS.md#fb-02-distinct-venue-scenes) |
| D3 | How deep should the crowd simulation go? Defines CPU, save and gameplay scope | **Aggregate queues/services, animated representative people**. Medium effort; visible behavior explains real totals | Every attendee simulated and routed. High effort; individual stories, larger determinism/performance burden | Decorative crowd only. Low effort; stronger atmosphere but no service explanation | **A / high**. Add individual simulation only if aggregate rules cannot deliver a specific player decision. [FB-03](FEATURE_BRIEFS.md#fb-03-crowd-service-behavior) |
| D4 | How should Select and deletion behave? Unlocks the remaining Build interaction change | **Select tool; Escape cancels placement; single removal uses undo; bulk Clear asks once**. Medium UI work; few interruptions | Confirm every removal, including single objects. More interruption; fewer immediate mistakes | Keep current tools and undo only. No new interaction scope; accidental placement remains possible | **A / high**. Revisit confirmation frequency after observed mistakes. Escape closes an open dialog before changing tools. [FB-07](FEATURE_BRIEFS.md#fb-07-select-mode-and-safe-removal) |
| D5 | How is performance accepted? Replaces the ambiguous headless 16ms target only if selected | **Stable CI regression scenes plus real-device targets**: proposed 60fps desktop / 30fps low-power tier. Thresholds fixed after baselines | Require 60fps on every supported device. High optimization cost and stricter hardware scope | Keep current absolute headless p95 <16ms gate. Lowest specification effort; unreliable across software-rendered runners | **A / high**. No pass claim until device list, sample method and thresholds are recorded. [Performance contract](FEATURE_BRIEFS.md#performance-and-delivery-contract) |

### D2: A versus B

Both options use actual 3D geometry and support the requested continuous 360° camera. This is an art-direction choice, not a choice between a flat renderer and a dimensional one.

| Aspect | A — stylized dimensional 3D | B — more realistic 3D |
| --- | --- | --- |
| Visual target | A polished miniature concert site: clear shapes, authored colors and convincing show lighting | A closer-to-life venue: detailed materials, proportions, people and lighting |
| Equipment | Recognizable truss, speaker arrays, barriers and consoles; prioritize details visible at management zoom | More surface, hardware and wear detail intended to hold up in close views |
| People | Simplified, coherent figures whose motion and destination read clearly | More detailed anatomy, clothing and animation; the accepted aggregate simulation still applies |
| Production trade-off | Spend art effort on silhouettes, consistent scale, composition and useful state changes | Spend more effort on material/detail consistency and close-view fidelity; profile the resulting scene |
| Reference fit | The supplied dimensional mockups are a starting direction, not a final quality bar or a requirement to retain block crowds | Needs an additional realistic style sample; the supplied mockups do not establish that target |

Original recommendation was A; **Dave selected B — more realistic 3D** on 2026-10-04, recorded in [CT-DEC-18](DECISIONS.md#ct-dec-18-realistic-3d-art-direction). The expected art/performance trade-offs are design estimates, not measured budgets or guarantees. Realistic art must still meet accepted D5; the supplied mockups are references, not final quality acceptance.

## Settled dependent milestone choices

**D6–D11 = A**, selected by Codex on 2026-10-04 under Dave’s explicit instruction to make decisions autonomously. Alternatives remain here for provenance; they are no longer questions for Dave.

| ID | Decision and what it unlocks | A | B | C | Recommendation / confidence |
| --- | --- | --- | --- | --- | --- |
| D6 | Research scope, CT-DEC-13 | **Three-project Lot pilot after live services are measurable**: Patch standards, Service training, Admission lanes | Implement the same pilot before live services, against current outcomes; more rework risk | Defer all research; leave CT-DEC-13 Proposed | **A / high**. Approves scope only; costs, durations and compatibility still need explicit rules. [FB-06](FEATURE_BRIEFS.md#fb-06-research-and-operational-development) |
| D7 | Ownership and economy scope | **Keep rentals for the first live-show slice; add ownership afterward** | Ownership and ledger first. More persistent business depth, larger save and accounting work | Rentals only for this release; no ownership milestone | **A / high**. Revisit once show-level consequences are understandable. [FB-05](FEATURE_BRIEFS.md#fb-05-owned-equipment-and-career-ledger) |
| D8 | Existing sprite library | **Inventory provenance now; retain during prototype; archive unused art once replacements are accepted** | Keep every asset as a permanent library. Lowest transition risk, ongoing size/style debt | Commission or regenerate all art immediately. Highest cost before renderer dimensions are proven | **A / high**. No deletion, purchase or license assumption follows from this recommendation. [FB-02](FEATURE_BRIEFS.md#fb-02-distinct-venue-scenes) |
| D9 | CT-DEC-10 Lot economy and progression | **Keep current numbers experimental; conduct paired strategy tests and a human career before accepting** | Accept the present Lot goals and deal/relationship rules now; fun still needs testing | Prioritize retuning first: make PA/lights situationally worthwhile and compare door/guarantee strategies before expansion | **A / medium**. A keeps CT-DEC-10 Proposed. B accepts design only, not playtest completion. [CT-DEC-10](DECISIONS.md#ct-dec-10-the-lot-career) |
| D10 | CT-DEC-11 later rooms | **Keep implemented room behavior experimental while venue art and tier-specific tests develop** | Accept current behavior: grid Club, returnable Lot, house rigs, seated multi-night shell, two-stage grounds | Reopen room mechanics before art: specify fixed-room versus grid behavior and future stage scheduling first | **A / medium**. A keeps CT-DEC-11 Proposed; B does not claim later-tier balance acceptance. [FB-02](FEATURE_BRIEFS.md#fb-02-distinct-venue-scenes) |
| D11 | When may the game be promoted publicly? | **Wait for the 3D Lot and live-operations pilot plus existing release gates** | Promote the current playable once existing provenance, design and human acceptance gates pass; label it early access | Keep it unlisted without a launch milestone for now | **A / medium**. More coherent first impression, later discovery. Neither answer is a release command or a playtest sign-off. [Release checklist](RELEASE.md) |

## Open question from the 2026-10-07 QA audit

Nothing waits on this answer; 0.1.2 ships either way.

| ID | Decision and what it unlocks | A | B | C | Recommendation / confidence |
| --- | --- | --- | --- | --- | --- |
| D12 | Save-and-replay of a seeded night ([FOH-QA-013](QA_AUDIT.md)). A save code or second tab taken before doors shows how the night goes, so the player can replay it with a different response. No cash is duplicated | **Accept it as single-player freedom**; keep nights seeded and reproducible, and say in the manual that a save code restores a night exactly | Reseed a night that is reloaded or imported between Open doors and Settle, so its draw and incident change. Ends informed replays; breaks the exact replay that tests and save repair rely on | Lock the career after doors: refuse imports and tab switches until the night is signed. Strongest integrity, most friction, still bypassable by editing storage | **A / medium**. The game has no scores or competition to protect, the career already carries on after a bad night (R-21), and B and C cost reproducibility or convenience for little gain |

## Recorded answers

- **D1 = A, accepted 2026-10-04:** Dave selected “3D Lot prototype first, then live operations.” This settles sequence. Art, crowd implementation, performance thresholds and public release remain open; this answer is not a blanket instruction to implement all briefs. Recorded in [CT-DEC-14](DECISIONS.md#ct-dec-14-expansion-sequence).

- **D3 = A, accepted 2026-10-04:** Aggregate queues/services with representative animated people. Recorded in [CT-DEC-15](DECISIONS.md#ct-dec-15-crowd-model).
- **D4 = A, accepted 2026-10-04:** Select tool, Escape cancellation, existing undo for single removals, and one bulk Clear confirmation. Recorded in [CT-DEC-16](DECISIONS.md#ct-dec-16-select-and-safe-removal).
- **D5 = A, accepted 2026-10-04:** Stable CI regression scenes plus 60fps desktop / 30fps low-power real-device targets, with measurement thresholds fixed after baselines. Recorded in [CT-DEC-17](DECISIONS.md#ct-dec-17-performance-acceptance). Device roster, measurement details and proof remain outstanding.
- Dave initially requested “d2, explain a vs b, accept A for d3 d4 d5”, then explicitly answered “Choose B — more realistic 3D”. **D2 = B, accepted 2026-10-04**, recorded in [CT-DEC-18](DECISIONS.md#ct-dec-18-realistic-3d-art-direction).

- **D6–D11 = A, accepted 2026-10-04:** Codex selected all six under Dave’s explicit delegation to decide autonomously. These are delegated selections, not six literal letter answers from Dave. Scope and rationale are recorded in [CT-DEC-19](DECISIONS.md#ct-dec-19-delegated-milestone-decisions).

## Execution sequence

First prove the realistic Lot and its controls, then meaningful arrivals and crew trade-offs using rentals. Research follows measurable service constraints; ownership follows explicit accounting. Inventory art provenance now, retain current assets through prototype work, and archive unused art after replacement acceptance. Keep Lot tuning and later-room behavior experimental while collecting the specified evidence. Public promotion follows the Lot and operations pilots plus release gates. The minimap remains deferred under CT-DEC-12. No D1–D11 selection remains outstanding; D12 is open and blocks nothing.

## Recording an answer

Record the selected letter, date, decider, authority, affected brief and remaining gates in the decision log. Preserve Dave’s actual wording for direct answers; identify agent choices as delegated decisions. Make routine product and implementation choices autonomously within the accepted direction, document the rationale, and do not re-ask D1–D11. Update this packet and NEXT_STEPS.json in the same change. An answer may authorize a named prototype while leaving tuning, public release and human acceptance open. Never infer an answer from silence, a screenshot, a recommendation or a green CI result.
