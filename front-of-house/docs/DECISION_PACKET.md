# Front of House decision packet

**Reviewed:** 2026-10-04 against `ab27c99` (PR #49 merged). **Status:** D1 accepted; D2–D11 open. Recommendations are not approvals. Owner: Dave. This packet summarizes choices; accepted rulings belong in [DECISIONS.md](DECISIONS.md), with the date and Dave's actual answer. Feature scope is in [FEATURE_BRIEFS.md](FEATURE_BRIEFS.md). Current next steps are exported in [NEXT_STEPS.json](NEXT_STEPS.json).

## Already settled or not a product decision

- Continuous 360° camera movement is Dave's requested direction. The remaining choices concern art, scope and sequencing, not whether to offer orbit.
- Keep the Book → Build → Promote → Show → Settle loop and four-tier career. Existing HUD decisions remain accepted until explicitly revised.
- Keyboard bindings, conflict checks and 50-step Build undo/redo shipped in [PR #49](https://github.com/DaveHomeAssist/mixmash/pull/49). Do not ask to build them again.
- The phone Book/Promote width defect (MXS-06) needs a fix and regression check; it does not need a design vote. Its 580px rule still exists at this source revision. Live reproduction remains separate.
- Asset provenance, save integrity, accurate labels, reachable controls and source-based status updates are ordinary completion requirements.
- The supplied 3D archive is now statically inspected in [PROTOTYPE_REVIEW.md](PROTOTYPE_REVIEW.md). Orbit, venues and service previews exist in source; runtime behavior, usage rights and integration are not verified.

## Choose now: scope and interaction

Reply with IDs and letters, such as `D1 A, D2 A`. An omitted answer stays Open. Effort describes relative implementation scope, not a delivery estimate.

| ID | Decision and what it unlocks | A | B | C | Recommendation / confidence |
| --- | --- | --- | --- | --- | --- |
| D1 | Which expansion leads? Sets the first feature milestone, after routine defects | **3D Lot prototype → live operations → research**. Addresses the requested view first; delays deeper gameplay slightly | Live operations → 3D → research. Proves choices first; awkward view remains longer | Research first. Earlier progression; service benefits are harder to validate | **A / medium**. Revisit if the 3D source cannot be reused or the Lot prototype exceeds the device budget. [FB-01](FEATURE_BRIEFS.md#fb-01-continuous-orbit-and-camera-presets), [FB-04](FEATURE_BRIEFS.md#fb-04-live-arrivals-and-temporary-staffing) |
| D2 | What art supports orbit? Unlocks the renderer and asset contract | **Stylized dimensional 3D**, following the supplied venue references. Medium art scope; readable forms and free yaw | More realistic 3D. High art, lighting and device cost; greater visual detail | Illustrated directional sprites. More paintings and limited tilt; continuous movement can expose mismatched facings | **A / high**. Keep the current renderer usable until the prototype passes. Revisit visual detail after device testing. [FB-01](FEATURE_BRIEFS.md#fb-01-continuous-orbit-and-camera-presets), [FB-02](FEATURE_BRIEFS.md#fb-02-distinct-venue-scenes) |
| D3 | How deep should the crowd simulation go? Defines CPU, save and gameplay scope | **Aggregate queues/services, animated representative people**. Medium effort; visible behavior explains real totals | Every attendee simulated and routed. High effort; individual stories, larger determinism/performance burden | Decorative crowd only. Low effort; stronger atmosphere but no service explanation | **A / high**. Add individual simulation only if aggregate rules cannot deliver a specific player decision. [FB-03](FEATURE_BRIEFS.md#fb-03-crowd-service-behavior) |
| D4 | How should Select and deletion behave? Unlocks the remaining Build interaction change | **Select tool; Escape cancels placement; single removal uses undo; bulk Clear asks once**. Medium UI work; few interruptions | Confirm every removal, including single objects. More interruption; fewer immediate mistakes | Keep current tools and undo only. No new interaction scope; accidental placement remains possible | **A / high**. Revisit confirmation frequency after observed mistakes. Escape closes an open dialog before changing tools. [FB-07](FEATURE_BRIEFS.md#fb-07-select-mode-and-safe-removal) |
| D5 | How is performance accepted? Replaces the ambiguous headless 16ms target only if selected | **Stable CI regression scenes plus real-device targets**: proposed 60fps desktop / 30fps low-power tier. Thresholds fixed after baselines | Require 60fps on every supported device. High optimization cost and stricter hardware scope | Keep current absolute headless p95 <16ms gate. Lowest specification effort; unreliable across software-rendered runners | **A / high**. No pass claim until device list, sample method and thresholds are recorded. [Performance contract](FEATURE_BRIEFS.md#performance-and-delivery-contract) |

## Choose before the dependent milestone

These do not prevent documenting or fixing existing behavior.

| ID | Decision and what it unlocks | A | B | C | Recommendation / confidence |
| --- | --- | --- | --- | --- | --- |
| D6 | Research scope, CT-DEC-13 | **Three-project Lot pilot after live services are measurable**: Patch standards, Service training, Admission lanes | Implement the same pilot before live services, against current outcomes; more rework risk | Defer all research; leave CT-DEC-13 Proposed | **A / high**. Approves scope only; costs, durations and compatibility still need explicit rules. [FB-06](FEATURE_BRIEFS.md#fb-06-research-and-operational-development) |
| D7 | Ownership and economy scope | **Keep rentals for the first live-show slice; add ownership afterward** | Ownership and ledger first. More persistent business depth, larger save and accounting work | Rentals only for this release; no ownership milestone | **A / high**. Revisit once show-level consequences are understandable. [FB-05](FEATURE_BRIEFS.md#fb-05-owned-equipment-and-career-ledger) |
| D8 | Existing sprite library | **Inventory provenance now; retain during prototype; archive unused art once replacements are accepted** | Keep every asset as a permanent library. Lowest transition risk, ongoing size/style debt | Commission or regenerate all art immediately. Highest cost before renderer dimensions are proven | **A / high**. No deletion, purchase or license assumption follows from this recommendation. [FB-02](FEATURE_BRIEFS.md#fb-02-distinct-venue-scenes) |
| D9 | CT-DEC-10 Lot economy and progression | **Keep current numbers experimental; conduct paired strategy tests and a human career before accepting** | Accept the present Lot goals and deal/relationship rules now; fun still needs testing | Prioritize retuning first: make PA/lights situationally worthwhile and compare door/guarantee strategies before expansion | **A / medium**. A keeps CT-DEC-10 Proposed. B accepts design only, not playtest completion. [CT-DEC-10](DECISIONS.md#ct-dec-10-the-lot-career) |
| D10 | CT-DEC-11 later rooms | **Keep implemented room behavior experimental while venue art and tier-specific tests develop** | Accept current behavior: grid Club, returnable Lot, house rigs, seated multi-night shell, two-stage grounds | Reopen room mechanics before art: specify fixed-room versus grid behavior and future stage scheduling first | **A / medium**. A keeps CT-DEC-11 Proposed; B does not claim later-tier balance acceptance. [FB-02](FEATURE_BRIEFS.md#fb-02-distinct-venue-scenes) |
| D11 | When may the game be promoted publicly? | **Wait for the 3D Lot and live-operations pilot plus existing release gates** | Promote the current playable once existing provenance, design and human acceptance gates pass; label it early access | Keep it unlisted without a launch milestone for now | **A / medium**. More coherent first impression, later discovery. Neither answer is a release command or a playtest sign-off. [Release checklist](RELEASE.md) |

## Recorded answers

- **D1 = A, accepted 2026-10-04:** Dave selected “3D Lot prototype first, then live operations.” This settles sequence. Art, crowd implementation, performance thresholds and public release remain open; this answer is not a blanket instruction to implement all briefs. Recorded in [CT-DEC-14](DECISIONS.md#ct-dec-14-expansion-sequence).

## Remaining recommendations, not yet selected

D1 is selected A. D2–D11 are recommended **A**, still Open. First prove the dimensional Lot and its controls, then put meaningful arrivals and crew trade-offs into that space. Research follows measurable service constraints; ownership follows explicit accounting. The minimap remains deferred under CT-DEC-12 and is not a new decision request.

## Recording an answer

Record the selected letter, actual wording, date, affected brief and remaining gates in the decision log. Update this packet and NEXT_STEPS.json in the same change. An answer may authorize a named prototype while leaving tuning, public release and human acceptance open. Never infer an answer from silence, a screenshot, a recommendation or a green CI result.
