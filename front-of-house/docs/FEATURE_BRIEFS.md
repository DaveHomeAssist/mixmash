# Front of House feature briefs

**Status:** Feature slices remain proposed scope; D1 and D3–D5 are accepted design choices (CT-DEC-14 through CT-DEC-17), 2026-10-04; no new feature is implemented by this document. Choices are in [DECISION_PACKET.md](DECISION_PACKET.md). Existing [decisions](DECISIONS.md), [rules](RULES.md), [saves](SAVE_FORMAT.md), [HUD](HUD.md) and [research design](RESEARCH.md) retain authority. Each brief names a smallest playable slice, exclusions and proof before expansion.

## FB-01 Continuous orbit and camera presets

**Problem / outcome:** The fixed illustrated angle makes placement and occlusion awkward. Players can inspect the site from any yaw and return quickly to useful working views.

**Player flow:** Enter Build or Show → drag the camera with a dedicated gesture → zoom/pan → choose Wide, FOH, Stage or Plan → select an object without accidental placement during orbit. Fit uses the space remaining around the HUD. FOH sits at the operator's eye position rather than behind a tent roof.

**First slice:** Oak St. Lot only, dimensional placeholder props, continuous yaw, bounded pitch, Fit/reset and four presets. Specify separate touch gestures for camera and object actions. Keep logical tile positions and orientation independent of camera. Use an adapter that consumes current engine state; the renderer does not calculate attendance, money or service outcomes. Retain the playable renderer until parity is verified.

**Data and saves:** Render transforms derive from existing layout IDs/footprints. Camera preferences are presentation state, never simulation input. Preserve saves and the automation hooks. Document context-loss/recovery and fallback behavior.

**Out of scope:** All four venue models in one pass, first-person walking, new placement physics, changed capacity, economy, final art and individual crowd AI.

**Acceptance:** Picking works at arbitrary yaw including 37°/135°, across zoom and pitch bounds; camera drag never places/deletes; world orientation survives save/reload and view changes; keyboard equivalents and reduced motion work; no page/panel overflow under the accepted HUD; functional parity and device performance pass. Compare the same saved show across renderers to identical settlement values.

**Dependencies / risks:** D1, D2, D5; the supplied prototype source is now statically reviewed in [PROTOTYPE_REVIEW.md](PROTOTYPE_REVIEW.md); validate runtime, provenance and engine parity before reuse. Occlusion, touch conflict, WebGL failure and device cost are the main risks. **Relative effort:** large. **Expansion:** other venues only after Lot parity and human camera acceptance.

## FB-02 Distinct venue scenes

**Problem / outcome:** Four career rooms currently share stand-in art. Each should communicate its actual capacity, services and operational constraints.

**Player flow:** Change venue → see the existing layout in its room → inspect house equipment and blocked areas → build within the same rules. A later amphitheater can visibly distinguish seats and lawn; a festival can show both active stage areas.

**First slice:** After FB-01, one Fathom Hall scene with its existing four pillars and house rig. Continue with Loam Shell and Split Acre as separate reviewed slices. Use stable prop IDs, units, origins, footprint bounds, collision/picking shapes and level-of-detail rules in an asset manifest.

**Data and saves:** Art consumes venue metadata. Visual terrain must not silently introduce slope penalties, new capacity or changed routes. Permanent works and owned objects require FB-05. Record each asset's author/tool, source, usage terms, generated/edited status, dimensions and runtime use; mark unknowns explicitly.

**Out of scope:** Redesigning room goals, ticketing, construction purchases, realistic rig engineering, new festival scheduling and bulk art replacement before a render contract.

**Acceptance:** Every placed prop has the correct footprint, orientation and pick target; stage/amenity occlusion is correct; capacities and house-rig costs match the engine; near/far views remain legible; every shipped asset has documented provenance; device and save parity checks pass per venue.

**Dependencies / risks:** FB-01, D8, D10. Screenshot geometry is not proof of production readiness. **Relative effort:** large per venue. **Expansion:** never treat art acceptance as gameplay balance acceptance.

## FB-03 Crowd service behavior

**Decision:** D3 A accepted in [CT-DEC-15](DECISIONS.md#ct-dec-15-crowd-model). Service rates, timing and balance remain to be specified.

**Problem / outcome:** Static crowd dots cannot explain why guests queue, spend, wait or leave. Visible movement should help players understand real service pressure.

**Player flow:** Observe arrivals → inspect admission/bar/restroom pressure → act through staffing or layout → watch representative guests move → see actual served/lost demand at settlement.

**First slice:** Arrival and bar zones driven by FB-04's aggregate counts, with animated representatives. Show the representative-to-guest ratio at large capacities. Restroom visits, vendors, sanitation and dancing/phone animations follow once their underlying state exists.

**Data and saves:** Simulation owns counts, cohorts, backlog, patience and outcomes. Animation interpolates those values with separate cosmetic randomness. Rendered population is derived from attendance, never a revenue multiplier. No development crowd-density slider in the player economy.

**Out of scope:** A saved AI mind/path for every attendee, arbitrary crowd purchases, unmodeled money transfers and simultaneous modeling of every facility.

**Acceptance:** Visual departures correspond to recorded outcomes; no double-counted guests or sales; changing camera, animation quality or playback speed cannot change money; overlays expose real counts; reduced motion communicates the same state. Crowd composition follows actual admission and departure totals.

**Dependencies / risks:** D3, FB-04, rendering budget. An attractive animation can imply causal precision the model lacks; representative agents must be labeled. **Relative effort:** medium after services. **Expansion:** sanitation and vendors need finite demand, stock/utility limits and separate briefs before implementation.

## FB-04 Live arrivals and temporary staffing

**Problem / outcome:** A show needs understandable choices whose costs last over time. Moving a worker to admission can clear arrivals while reducing bar sales.

**Player flow:** See queue length, oldest wait, estimated wait and bar backlog → send an eligible bar worker to admissions → monitor travel/setup → return them → settle ticket receipts, service sales and consequences separately.

**First slice:** One Lot entrance, one bar, one transferable worker and a bounded arrival period. Separate prepaid ticket holders from walk-ups. Support reassignment, transfer, active duty and return states, with capacity changing at the correct departure/arrival times. State cancellation rules explicitly. Show cost/benefit forecasts based on visible information.

**Rules and saves:** Fixed simulation step independent of rendering; deterministic ordering for simultaneous events and event-keyed random draws. Save cohorts, residual demand, queue age, staff assignment, transfer progress, event sequence and RNG state as required by the selected model. Ledger outcomes distinguish prepaid cash, on-site ticket sales, abandonment, refunds and foregone bar sales. Causal records use stable event IDs, game time, cause, entity, action and result; settlement is idempotent.

**Worked-test specification to write before implementation:** Quiet arrivals, sharp arrival surge and busy-bar surge with explicit arrivals per game minute, service rates, travel time, patience/abandonment and refund policy. Small round numbers must be checkable by hand. These are test fixtures, not accepted balance values.

**Out of scope:** Incident redesign, whole-night labor scheduling, individual employee skills, act riders, full calendar, ownership and all eight research branches.

**Acceptance:** Quiet shows make reassignment unnecessary; surges can justify a temporary transfer; busy-bar costs make it situational. No worker serves both stations; returning restores capacity without undoing prior losses. Reload during transfer/queue/settlement and alternate playback speeds produce identical outcomes. Causal summaries reconcile to money, counts and dissatisfaction without claiming unmeasured counterfactual sales.

**Dependencies / risks:** D1, D3, approved queue/financial rules and compatibility plan. Existing optional doors experiment remains the baseline, not silently replaced. **Relative effort:** large. **Expansion:** services and longer show scheduling only after the trade-off is readable in human playtests.

## FB-05 Owned equipment and career ledger

**Problem / outcome:** A promoter should eventually decide whether repeated rentals justify buying gear, with honest available cash and long-term costs.

**Player flow:** Compare rental and purchase → reserve/commit funds → acquire an identified asset → deploy it to a show → see per-show costs separately from career cash movement.

**First slice:** One purchasable equipment family and a transaction ledger. Distinguish available cash, commitments, deposits, acquisition, rental, placement and disposal. Define cancellation and sale behavior before enabling them. Purchased does not mean placed, powered, staffed or free to operate.

**Rules and saves:** Extend the existing [economy transition proposal](SAVE_FORMAT.md#proposed-next-save-and-economy-transition). Specify whether schema 3 is necessary after field compatibility is decided; do not equate every additive field with a breaking version. Use stable asset and transaction IDs, idempotent debits and deterministic migration. Preserve cash, booked contract terms, existing rentals and unlocked rooms. Ownership must not retroactively create assets or alter the artist's cost basis.

**Out of scope:** Calendar, loans, depreciation accounting, warehouses, touring logistics, all gear categories and permanent building works.

**Acceptance:** Purchase cannot charge twice; deployment does not duplicate assets; rental/purchase policy comparisons use the same shows; insufficient funds and reload are safe; cancel/sell/rebuy cannot mint money. Settlement profit reconciles separately from capital cash movement.

**Dependencies / risks:** D7, exact ledger and migration specification, new balance fixtures. **Relative effort:** large. **Expansion:** owned infrastructure and multi-venue allocation get explicit accounting rules first.

## FB-06 Research and operational development

**Problem / outcome:** Players need choices about capabilities to develop between shows, beyond reaching the next room.

**Player flow:** Settle → review a measured bottleneck → choose a project → progress over qualifying settled nights → deploy the capability → compare the next night's outcome.

**First slice:** CT-DEC-13's Patch standards, Service training and Admission lanes; one slot; cash and department experience; explicit pause/cancel/progress behavior. Knowledge, equipment ownership and show deployment remain distinct.

**Rules and saves:** Follow [RESEARCH.md](RESEARCH.md), rather than inventing another tree. Specify costs, durations, effects, qualifying nights, refund policy and compatibility before implementation. Development spend is not silently artist-deductible show expense. Keep existing facilities and previously unlocked rooms available. Normal careers remain unchanged when the pilot is disabled.

**Out of scope:** Full tree, employee skill trees, incident prevention, locked baseline sanitation/security, compulsory research to earn income and permanent venue works.

**Acceptance:** No prerequisite cycles; every project has an affordable entry path; progress and spending happen once; save/reload and multi-night settlement are deterministic. Different projects help in different conditions and sometimes saving cash wins. Players can explain learned versus deployed status and the observed benefit.

**Dependencies / risks:** D6 and measurable production/bar/admission outcomes; FB-04 recommended before service research. **Relative effort:** medium/large. **Expansion:** new branches only after service capacity, resource and accounting models exist.

## FB-07 Select mode and safe removal

**Decision:** D4 A accepted in [CT-DEC-16](DECISIONS.md#ct-dec-16-select-and-safe-removal). This brief describes target behavior, not shipped controls.

**Problem / outcome:** Placement tools can turn an inspection click into a layout change. Players should inspect safely and recover without repeated confirmation dialogs.

**Player flow:** Choose Select → inspect one prop → choose a placement tool → Escape returns to Select → delete a selected object → Undo restores it. Confirm a bulk Clear with an object count; cancel returns to the unchanged layout.

**First slice:** Explicit tool state, selection outline, inspector parity for mouse/touch/keyboard, Escape precedence and bulk Clear confirmation. Reuse existing controls.mjs and 50-step history. A bulldozer gesture remains one undo operation.

**Data and saves:** Selection/tool state is transient. Preserve current layout IDs and validation. Clear/reset/phase/load boundaries must retain current history rules, documented for the player. Do not implement a second undo stack.

**Out of scope:** Multi-select, lasso, clipboard, multi-object transforms and a new action engine.

**Acceptance:** Select never places; Escape closes dialogs first, then cancels tools; inputs retain browser editing shortcuts; single removal/drag/clear undo correctly; focus survives object deletion and dialog cancel. Test touch and keyboard, including interaction with shared nav Escape handling.

**Dependencies / risks:** D4; accidental shortcut conflicts and mismatched selection after undo. **Relative effort:** medium. **Expansion:** multi-selection only when the renderer and placement semantics are stable.

## FB-08 Contextual minimap

**Problem / outcome:** A zoomed festival may be difficult to navigate; players need a view of where the camera is looking.

**Player flow:** Zoom past Fit → inspect small site map → choose a location → return to Fit to hide it.

**First slice:** One desktop minimap for Split Acre using current world extents and camera footprint; keep hidden on phones and at Fit under CT-DEC-12. Re-evaluate the existing rectangular viewport outline when a perspective camera lands; derive the ground intersection correctly.

**Data and saves:** Presentation only, sourced from layout and camera, without a second simulation or new save requirements.

**Out of scope:** Fog of war, minimap-only commands, phone chrome and additional gameplay overlays.

**Acceptance:** Correct camera location and picking at arbitrary yaw/pitch/zoom; keyboard navigation equivalent; no extra obscured primary controls; rendering stays within the selected performance budget.

**Dependencies / risks:** Existing deferred decision remains in force. Start only when larger-site play demonstrates need after FB-01. **Relative effort:** medium. **Expansion:** none without a concrete navigation problem.

## Performance and delivery contract

D5 A is accepted in [CT-DEC-17](DECISIONS.md#ct-dec-17-performance-acceptance): stable CI regression scenes plus 60fps desktop / 30fps low-power device targets. For this model, record hardware/browser, scene/save/seed, crowd size, resolution, device pixel ratio, warm-up, sample length and foreground state. Track p50/p95 frame time and stalls on the same CI runner class; review a runner change before resetting a baseline. Propose a 20% regression alert initially, then fix the accepted limit from repeated samples. A relative pass is not a real-device frame-rate pass. A proposed statistical translation of those targets is p95 <=16.7ms on the declared desktop tier and <=33.3ms on the declared low-power tier; the exact sampling and statistical limits still require baselines; name and test the actual supported devices before claiming acceptance.

Before any feature implementation, its accepted choices, exact rule/data changes and test scenarios must be ready. For each delivery: update the relevant brief and decisions; record tests, source revision, CI, deployment and human acceptance separately; refresh NEXT_STEPS.json and the workspace board. A docs deployment never marks a feature implemented. Existing release gates remain unchanged.

## FB-09 Concessions and vendor operations

**Source:** The supplied prototype includes food trucks/stalls, bar windows, prices, queue switching and a house share; see [source review](PROTOTYPE_REVIEW.md). These are proposed follow-on mechanics, not accepted numbers.

**Problem / outcome:** Guests should encounter believable food/bar trade-offs while the promoter chooses capacity, pricing and commercial terms.

**Player flow:** Place or contract one vendor → set staffed windows and a price band before doors → inspect served demand, waits and stock → compare vendor gross sales and promoter share at settlement.

**First slice:** One food vendor beside the existing bar, after FB-04. Guests have finite demand and spending budgets. Switching queues preserves the guest/job; it never creates additional demand. Staffing, stock, access and operating hours constrain service. Lock commercial terms at the defined booking boundary.

**Rules and saves:** Own demand and service events in the engine. Persist queues, stock, agreed share, staffed capacity and stable transactions. Distinguish hourly forecasts, actual sales, gross vendor revenue and promoter income. Avoid counting vendor costs against the artist contract unless explicitly included in accepted terms.

**Out of scope:** Multiple vendor districts, dynamic negotiations, real-world tax/accounting and global price optimization.

**Acceptance:** Customers cannot spend the same budget twice; queue switching conserves demand; stockouts stop sales; increasing price can reduce demand; provider and promoter ledgers reconcile after reload. At least two price/capacity choices are useful under different conditions.

**Dependencies / risks:** FB-04, D3, finite guest budget rules. The prototype curve is illustrative. **Relative effort:** medium/large. **Expansion:** separate approval after live staffing works; no immediate implementation decision required.

## FB-10 Sanitation and artist facilities

**Source:** The prototype offers portable restrooms, trailers, permanent facilities and backstage options. Source inspection confirms those controls; their costs and rider conditions are proposals.

**Problem / outcome:** Restroom demand and servicing should affect guest experience, while act requirements distinguish mandatory conditions from preferences.

**Player flow:** Forecast guest demand → choose a supported facility package → assign servicing → inspect waits and condition → address an artist's stated backstage requirement before committing the show.

**First slice:** Portable restrooms and one rental trailer package with explicit stalls, service time, cleaning/utility availability and queue demand. Baseline sanitary and accessible provision stays available without research. Add one clearly displayed negotiable artist preference; defer mandatory rider logic until its failure/cancellation policy is defined.

**Rules and saves:** Persist facility condition, queue state, servicing assignments and accepted requirements. No generic mood bonus without a measured reason. Separate guest queue abandonment from leaving the show, ticket refunds and artist penalties; each needs its own rule and record. Permanent construction depends on FB-05.

**Out of scope:** Regulatory compliance certification, medical simulation, detailed plumbing, every rider type and unlocking minimum safe provision through research.

**Acceptance:** More stalls do not bypass missing access/utilities; cleaning consumes time and staff; no duplicate queue visits or unexplained departures; a declared artist preference has visible cost and outcome. Reload preserves condition, work in progress and booked terms.

**Dependencies / risks:** FB-04 service model and FB-06 only for optional improvements. Prototype facility constants are unvalidated. **Relative effort:** medium/large. **Expansion:** detailed requirements and permanent works need their own decision when scheduled.

## FB-11 Arrival and departure flow

**Source:** The prototype draws entry/exit paths and estimates clearance from attendance and exit width. This is a design visualization, not verified crowd-safety engineering.

**Problem / outcome:** Players should see arrivals become admitted guests and guests leave through usable routes, with congestion explained by the site's modeled constraints.

**Player flow:** Inspect entrance/exit zones in Build → open doors → observe FB-04 queues → monitor normal departure after the set → review congestion and staffing decisions.

**First slice:** One admission path and normal end-of-show departure for the Lot, using aggregate zones and representative animation. Existing occupancy and exit rules remain authoritative. Security checks can affect service time only after an explicit, bounded rule is specified; faster flow must never grant extra legal capacity.

**Rules and saves:** Conserve people across outside, admitted, service, departure and departed states. Save backlog and blocked-route state. Model throughput separately from queue storage and occupancy. Do not treat a preview density knob or animated path length as attendance or safety proof.

**Out of scope:** Emergency evacuation prediction, certification, individually routed crowds, transport scheduling and a replacement incident engine.

**Acceptance:** No teleporting or double counting between zones; blocked modeled routes visibly reduce service; admission and exit controls cannot create capacity; alternate speed/reload produce identical counts. Compare quiet and surge conditions and retain existing engine limits.

**Dependencies / risks:** FB-04, D3, usable geometry from FB-01. Real-world rates must not be presented as certified outcomes. **Relative effort:** medium. **Expansion:** multi-gate circulation only after the Lot model is understandable and tested.
