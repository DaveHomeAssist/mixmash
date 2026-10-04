# Front of House feature briefs

**Status:** D1 and D3–D11 A, plus D2 B, are accepted design choices (CT-DEC-14 through CT-DEC-19), 2026-10-04. Codex selected D6–D11 under Dave’s delegated authority. Briefs specify the scoped work and remaining proof; no new feature is implemented by this document. Choices are in [DECISION_PACKET.md](DECISION_PACKET.md). Existing [decisions](DECISIONS.md), [rules](RULES.md), [saves](SAVE_FORMAT.md), [HUD](HUD.md) and [research design](RESEARCH.md) retain authority. Each brief names a smallest playable slice, exclusions and proof before expansion.

## FB-01 Continuous orbit and camera presets

**Art decision:** D2 B accepted in [CT-DEC-18](DECISIONS.md#ct-dec-18-realistic-3d-art-direction): more realistic 3D. Review a representative sample of equipment, material, lighting and guest detail at management and close views. Placeholder geometry proves integration only; it does not satisfy final visual acceptance. Preserve D3 aggregate simulation and D5 device targets.

**Problem / outcome:** The fixed illustrated angle makes placement and occlusion awkward. Players can inspect the site from any yaw and return quickly to useful working views.

**Player flow:** Enter Build or Show → drag the camera with a dedicated gesture → zoom/pan → choose Wide, FOH, Stage or Plan → select an object without accidental placement during orbit. Fit uses the space remaining around the HUD. FOH sits at the operator's eye position rather than behind a tent roof.

**First slice:** Oak St. Lot only, dimensional placeholder props, continuous yaw, bounded pitch, Fit/reset and four presets. Specify separate touch gestures for camera and object actions. Keep logical tile positions and orientation independent of camera. Use an adapter that consumes current engine state; the renderer does not calculate attendance, money or service outcomes. Retain the playable renderer until parity is verified.

**Data and saves:** Render transforms derive from existing layout entries and engine footprints; objects currently have no persisted IDs. Renderer handles are transient and snapshot-scoped. Camera preferences are presentation state, never simulation input. Preserve saves and the automation hooks. Document context-loss/recovery and fallback behavior.

**Out of scope:** All four venue models in one pass, first-person walking, new placement physics, changed capacity, economy, bulk final-art production and individual crowd AI.

**Acceptance:** Picking works at arbitrary yaw including 37°/135°, across zoom and pitch bounds; camera drag never places/deletes; world orientation survives save/reload and view changes; keyboard equivalents and reduced motion work; no page/panel overflow under the accepted HUD; functional parity and device performance pass. Compare the same saved show across renderers to identical settlement values.

**Sample and contract:** Use the five-subject [realistic Lot sample specification](ART_DIRECTION.md#realistic-lot-sample-specification): stage, PA, bar, restroom and one representative guest; Wide, FOH, Stage and Plan in daylight and show lighting. The [source-traced renderer contract](RENDER_CONTRACT.md) specifies existing interfaces, proposed operations, coordinate/scale boundaries and acceptance cases. These documents make the first slice reviewable; they do not implement it. Technical placeholders and final visual acceptance are separate gates.

**Dependencies / risks:** D1, D2, D5; the supplied prototype now has an isolated [runtime and dependency review](PROTOTYPE_REVIEW.md). Fix/reimplement its lifecycle, camera bounds and reduced-motion gaps before reuse; source/asset rights and engine parity remain gates. Occlusion, touch conflict, WebGL failure and device cost are the main risks. **Relative effort:** large. **Expansion:** other venues only after Lot parity and human camera acceptance.

### FOH-V01b implementation boundary

The first backend slice adds a self-hosted, pinned Three.js renderer module, a camera/picking contract and independently authored dimensional props. It accepts the existing scene snapshot without importing economy rules. Camera tests cover arbitrary yaw, pitch/zoom limits, Plan and ground round trips; runtime tests cover object depth, immutable inputs, loss/restoration and repeated disposal. The game keeps its current renderer until the following integration slice connects gestures, accessible presets and fallback. Technical sample geometry is explicitly provisional and does not establish realistic-art or physical-device acceptance. No Unreal migration or save change is included.

### FOH-V01b application integration

Connect the backend through a facade that retains the existing board and latest scene. An explicit 3D preview toggle enables the Lot only; unsupported rooms and initialization/context failures use Canvas 2D, with status and retry. Add focusable camera presets and orbit/pitch controls. In Select, one-pointer drag orbits and tap inspects; two pointers pan/pinch and cancel placement. Placement remains an explicit tap; camera drag, cancellation, lost capture and modal opening never dispatch an object action. Keep the save namespace and engine unchanged. Verify identical saved-show outcomes, fallback continuity, mouse/touch/keyboard, viewport containment and recovery before merging. The preview does not certify final art or physical devices.

### FOH-V01b scene and authored scale

Complete the Lot presentation with the actual fence kit, grid, incident markers and bounded cosmetic guest motion. Author a consistent dimensional reference using the existing two-metres-per-tile comment as a **provisional authoring convention**, not a physical calibration claim: 1.8 m reference guest, 1.66 m operator eye, 1.1 m stage deck and bar counter, and 2.3 m portable toilet. Record source dimensions and digests. FOH and Stage use explicit eye positions; orbit bounds still apply when leaving those views. Preserve logical footprints, costs, saves, crowd totals and incident authority. Reduced motion keeps every cue while stopping cosmetic movement. Review actual captures and keep final visual/physical acceptance open; do not call a self-authored reference physically calibrated.

## FB-02 Distinct venue scenes

**Art decision:** Follow CT-DEC-18's more realistic 3D target after the Lot style sample and renderer pass; the existing simplified archive scenes are references, not approved final assets.

**Problem / outcome:** Four career rooms currently share stand-in art. Each should communicate its actual capacity, services and operational constraints.

**Player flow:** Change venue → see the existing layout in its room → inspect house equipment and blocked areas → build within the same rules. A later amphitheater can visibly distinguish seats and lawn; a festival can show both active stage areas.

**First slice:** After FB-01, one Fathom Hall scene with its existing four pillars and house rig. Continue with Loam Shell and Split Acre as separate reviewed slices. Use stable prop IDs, units, origins, footprint bounds, collision/picking shapes and level-of-detail rules in an asset manifest.

**Data and saves:** Art consumes venue metadata. Visual terrain must not silently introduce slope penalties, new capacity or changed routes. Permanent works and owned objects require FB-05. Record each asset's author/tool, source, usage terms, generated/edited status, dimensions and runtime use; mark unknowns explicitly.

**Out of scope:** Redesigning room goals, ticketing, construction purchases, realistic rig engineering, new festival scheduling and bulk art replacement before a render contract.

**Acceptance:** Every placed prop has the correct footprint, orientation and pick target; stage/amenity occlusion is correct; capacities and house-rig costs match the engine; near/far views remain legible; every shipped asset has documented provenance; device and save parity checks pass per venue.

**Dependencies / risks:** FB-01; selected D8 A retains current art until replacement acceptance, and D10 A keeps later-room mechanics experimental while art and tier-specific tests develop. Screenshot geometry is not proof of production readiness. **Relative effort:** large per venue. **Expansion:** never treat art acceptance as gameplay balance acceptance.

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

**Dependencies / risks:** Selected D7 A puts rentals in the first live-show slice and ownership afterward; exact ledger and migration specification, new balance fixtures. **Relative effort:** large. **Expansion:** owned infrastructure and multi-venue allocation get explicit accounting rules first.

## FB-06 Research and operational development

**Problem / outcome:** Players need choices about capabilities to develop between shows, beyond reaching the next room.

**Player flow:** Settle → review a measured bottleneck → choose a project → progress over qualifying settled nights → deploy the capability → compare the next night's outcome.

**First slice:** CT-DEC-13's Patch standards, Service training and Admission lanes; one slot; cash and department experience; explicit pause/cancel/progress behavior. Knowledge, equipment ownership and show deployment remain distinct.

**Rules and saves:** Follow [RESEARCH.md](RESEARCH.md), rather than inventing another tree. Specify costs, durations, effects, qualifying nights, refund policy and compatibility before implementation. Development spend is not silently artist-deductible show expense. Keep existing facilities and previously unlocked rooms available. Normal careers remain unchanged when the pilot is disabled.

**Out of scope:** Full tree, employee skill trees, incident prevention, locked baseline sanitation/security, compulsory research to earn income and permanent venue works.

**Acceptance:** No prerequisite cycles; every project has an affordable entry path; progress and spending happen once; save/reload and multi-night settlement are deterministic. Different projects help in different conditions and sometimes saving cash wins. Players can explain learned versus deployed status and the observed benefit.

**Dependencies / risks:** Selected D6 A requires measurable production/bar/admission outcomes; FB-04 precedes the three-project service research pilot. Codex specifies costs, durations and compatibility within the accepted pilot scope. **Relative effort:** medium/large. **Expansion:** new branches only after service capacity, resource and accounting models exist.

## FB-07 Select mode and safe removal

**Decision:** D4 A accepted in [CT-DEC-16](DECISIONS.md#ct-dec-16-select-and-safe-removal). Implementation slice FOH-V01a: default to Select on entering Build; pointer/touch/Enter inspect a current object in a named dialog; selection outline follows its logical footprint; Escape first closes a dialog/menu, then returns placement or bulldozing to Select. Single removal uses the existing undo stack; Clear shows the current object count and one confirmation. Selection is cleared on every layout/phase/load/history mutation and is never saved. Verify pointer, touch, keyboard, undo, modal focus and HUD fit before delivery.

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

D5 A is accepted in [CT-DEC-17](DECISIONS.md#ct-dec-17-performance-acceptance): stable CI regression scenes plus **60fps desktop / 30fps low-power** device targets. The supported device/browser roster, percentile pass limits, tolerated stalls and relative regression alert remain **pending acceptance**. The previously suggested 20% alert and p95 ≤16.7/33.3 ms translations are proposals only; this procedure does not approve them or replace an existing CI gate. No workflow or runtime code changes accompany this preflight.

### Reproducible measurement procedure

1. Pin source revision, dependency lock/digests, asset manifest and harness revision. Record host model/CPU/RAM, OS version/build, browser/version, GPU/backend and hardware versus software rendering, launch flags, headless/headed mode, power/low-power state, display/refresh, thermal/load observations and foreground visibility. Unknown values stay Unknown. Close other test browsers; do not run build/test loads concurrently. Retain raw samples and all failed runs privately, with a public-safe summary and digests.
2. Use fresh browser contexts, isolated loopback origins and blocked service workers. Never read or import a production browser profile. Freeze each fixture/save and action sequence; record SHA-256 of exact serialized bytes. Do not change balances to reach a desired crowd. Distinguish renderer-only diagnostics from full game/HUD measurements and from prototype scenes.
3. **Empty Lot E:** `createGame(170)` → `chooseDeal` with default artist Sodium Arcade and `door`; Build, empty objects, grid 24×16, crowd 0, day, no incident, no cursor/ghost/overlay. Derive floor, pillars, density and sight sets from production functions. Keep this empty fixture even though it is not ready to open doors.
4. **Show crowd C:** same initial seed/deal → `setLayout(STARTER_LAYOUT)` → `confirmBuild` → `setPromotion` price 20, ads `{flyers:0,social:150,radio:150}` → `confirmPromotion`. Freeze the resulting Show state; at the reviewed revision `showPreview` reports 150 attendees, medium PA, lights and PA-dropout incident. Drive visual time only, with crowd fixed at that recorded peak; the engine state does not advance. Save complete fixture/action bytes and report actual rendered population. This is a diagnostic peak scene, not a new gameplay timing rule.
5. Record CSS viewport, browser DPR, renderer effective DPR and actual backing dimensions for every run. Required future device comparisons: 1440×900 desktop, 375×812 phone and 2560×720 ultrawide, plus each device's native viewport. The host diagnostic below covers 1440×900 at requested DPR 1; it does not substitute for the full matrix.
6. Decode all assets/compile initial shaders before a **10-second warm-up**; discard warm-up samples. Then record **30 seconds** in foreground. Reset camera before each of **three runs per scene**, report each run separately, and record cold-load time/failures separately. Never silently discard the slowest run. Repeat a changed environment as a new baseline candidate, not as a replacement for a failed result.
7. **Existing-board diagnostic path:** six five-second segments `(facing,zoom)` = `(0,1),(1,1),(1,2),(2,3),(3,1.5),(0,1)`; ground target stays at Fit center. Call the existing board with the frozen scene on each RAF; include camera-change redraws in submission time. Existing 2D board cannot orbit at arbitrary yaw or pitch. **Proposed 3D regression path:** 0–10 s yaw 0→360° at pitch 45°, zoom 1; 10–20 s yaw 37° while zoom 1→3→1; 20–30 s yaw 135° while pitch 15°→85°→15°. Use deterministic piecewise-linear camera time, fixed target and identical paths across devices; test four presets separately. No engine action runs on a frame callback.
8. Record consecutive RAF intervals and synchronous draw/submission duration separately. Use nearest-rank p50/p95/p99, arithmetic mean, maximum, count and elapsed duration; derive cadence only as `1000 / mean interval`. Submission CPU time excludes deferred GPU/compositor work and is not “fps.” Log long tasks where supported. For diagnostic reporting, count intervals **>50 ms**, sum their full duration and excess above 50 ms, and report >16.7/>33.3 ms counts. These are reporting bins, **not accepted failure thresholds**. GPU timestamp timings are a separate optional capability; unsupported/disjoint readings stay unavailable.
9. Capture correctness screenshots and state/save/settlement parity outside timed windows. Record visual quality, shadows, AA, reduced motion, crowd/triangle/draw-call counts and any quality adaptation. A lower backing resolution cannot be compared as the same quality setting. Repeat reduced motion and context recovery separately; record whether resize/hide invalidated a run.
10. Before real-device acceptance, Dave selects the actual desktop and low-power roster and approves statistical limits from repeated baselines. Run on those physical devices, report thermal/power behavior, and retain human readability/control review. CI tracks stable scenes on a named runner class; runner changes need review. A green relative regression alone never proves the accepted frame-rate target.

### Available-host diagnostics

See the measured results below and [prototype runtime evidence](PROTOTYPE_REVIEW.md). These characterize the available host only; the proposed WebGL adapter and realistic sample do not exist yet. Full game/HUD performance, hardware-GPU devices, supported roster and statistical acceptance remain pending.

Measured 2026-10-04 against production `522f3f2` and the independently hashed archive. Host: **Mac16,12, Apple M4, 10 CPU cores, 16 GiB, macOS 27.0.1 (26A434), arm64**; Chromium **149.0.7827.55**, Playwright 1.61.1, headless, Node 25.8.1. WebGL reports **ANGLE Vulkan / SwiftShader (LLVM 10.0.0)**. AC power observed; display refresh, low-power setting, thermal state and unrelated host load unmeasured. No custom browser launch flags were supplied beyond Playwright defaults; the observed backend is software. Repository delivery checks use Node 22 separately.

All runs: 1440×900 CSS px, browser DPR 1, document visible, 10 s warm-up then at least 30 s recording; no screenshot or repository test/build ran in a timed window. E/C use the unchanged Canvas 2D board at effective DPR 1 (1440×900 backing), with decoded existing sprites and the six-segment camera path above. This isolates board submission and excludes the full HUD/game event loop. C receives 150 logical attendees but the existing board reports 200 drawn crowd points: its per-tile loop draws two dots for each 1.5-person allocation (`crowdPoints` in `board.js`). This diagnostic exposes a presentation-count mismatch; it does not change attendance or settlement, and no runtime correction is included. P is the **separate archive Lot**: Set state, medium PA, lights on, density 0.8, 120 rendered crowd instances, default inverse Pixel 2 → effective DPR 0.5 (720×450 backing), antialiasing/shadows and preserveDrawingBuffer enabled. Its native scene animation remains active; the harness disables damping and performs one continuous 360° orbit over 30 s at the initial Wide radius/polar angle. P is not an empty Lot, the production fixture, or the future realistic sample.

| Scene / run | Samples / elapsed s | RAF p50 / p95 / p99 / max ms | Mean cadence fps | >50 ms intervals | Full stall time / excess over 50 ms (ms) | Long tasks |
| --- | --- | --- | --- | --- | --- | --- |
| empty / 1 | 1800 / 30.017 | 16.70 / 17.60 / 17.70 / 34.00 | 59.97 | 0 | 0.00 / 0.00 | 0 |
| empty / 2 | 1801 / 30.016 | 16.70 / 17.50 / 17.70 / 17.80 | 60.00 | 0 | 0.00 / 0.00 | 0 |
| empty / 3 | 1801 / 30.016 | 16.70 / 17.40 / 17.60 / 17.80 | 60.00 | 0 | 0.00 / 0.00 | 0 |
| crowd / 1 | 1801 / 30.016 | 16.70 / 17.00 / 17.60 / 17.70 | 60.00 | 0 | 0.00 / 0.00 | 0 |
| crowd / 2 | 1800 / 30.000 | 16.70 / 17.40 / 17.60 / 17.80 | 60.00 | 0 | 0.00 / 0.00 | 0 |
| crowd / 3 | 1800 / 30.016 | 16.70 / 17.40 / 17.60 / 33.30 | 59.97 | 0 | 0.00 / 0.00 | 0 |
| prototype / 1 | 387 / 30.000 | 82.80 / 100.00 / 133.40 / 150.00 | 12.90 | 387 | 30000.10 / 10650.10 | 387 |
| prototype / 2 | 372 / 30.017 | 82.50 / 100.00 / 133.40 / 1216.20 | 12.39 | 371 | 29967.10 / 11417.10 | 372 |
| prototype / 3 | 350 / 30.033 | 83.30 / 117.30 / 216.70 / 333.40 | 11.65 | 349 | 29983.10 / 12533.10 | 350 |

Synchronous **production board draw/camera submission** p50/p95 ms by run: empty 1: 0.40/0.70; empty 2: 0.30/0.50; empty 3: 0.30/0.50; crowd 1: 0.50/0.80; crowd 2: 0.80/1.60; crowd 3: 0.70/1.30. These CPU timings exclude deferred raster/GPU/compositing and are not frame-rate measurements. For P, its own animation loop submits rendering; the harness only times its camera update, so that CPU number is deliberately not reported as renderer cost. GPU timestamp timing was not captured.

No page exceptions occurred in any measured run. Preserve the prototype’s long stall(s) and slowest run; do not normalize them away. The software-rendered prototype is substantially slower in this environment even at half backing resolution. This is a useful optimization warning, not a measured hardware-GPU result, an equivalent-scene comparison, or an approved statistical pass/fail decision. Existing-board near-60 Hz headless cadence likewise does not establish supported-device acceptance.

Private reproducibility evidence uses compact JSON fixture key order `name, seed, actions, state, crowd, incident`, with complete action lists and normalized engine state. Fixture SHA-256: empty `3033830e2db10a7a7c9686eedef94376c18479580f6be6d02bcce2ae4e990d04`; show crowd `21b588a302927a47b2930ac2bac285742db7641b96556f6af71dd28aa1f2a598`. Retained raw RAF/CPU arrays, long-task records and diagnostics SHA-256: `957244e413b67ed47529c824178e559d93a4552e4944c466e29ee77edf5cd848`. The private measurement harness digest is `dde6cb17283317f56022759c5d16fc88cd3c072bc4f88f2d1987a7d5a13faf78`; the production fixture page digest is `9a5552349f10efd6b2e968f52388b6366c8449dd49c23dd47c50bf14a7424427`. These hashes identify retained evidence; no private paths, prototype files or images are published.

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

### FOH-O01a: deterministic service core

The engine-only prerequisite to FB-03/04 can be built independently of the renderer. It does not enable a new player mode or replace the optional doors snapshot. The later integration slice must connect the authoritative clock, controls, saves, crowd and settlement before live operations can be marked complete.

The first model uses integer game minutes, finite prepaid/walk-up cohorts and one transferable bar worker. At each minute: finish transfers, enqueue arrivals, expire cohorts whose patience has elapsed, admit FIFO, enqueue one bar request per admitted guest, then serve the bar FIFO. Ties admit prepaid holders first. Moving takes two minutes; a worker contributes to neither station in transit, cannot redirect mid-transfer, and can return after arrival. Already served demand and lost sales never return. A service run ends at its declared closing minute; remaining admission demand abandons and remaining bar requests expire. Prepaid arrivals pay once before doors and receive a full ticket refund if never admitted; walk-ups pay only on admission. Bar requests pay once on service. No normal departures are modeled in this prerequisite.

Round-number fixtures (model tests, not production balance): base admission 2 guests/minute, transferable worker +2; base bar 0 requests/minute, transferable worker +2; ticket $20, bar net $5, transfer 2 minutes, admission patience 3 minutes, bar patience 6 minutes, closing minute 12. Quiet arrivals are one walk-up each minute 1–4. Admission surge is 12 walk-ups at minute 1. Busy bar is 12 prepaid arrivals at minute 1 with base admission 12/minute. Keeping the worker at the bar should win quiet/busy-bar income; transferring should admit more surge guests, with visible bar losses. These fixtures deliberately expose opportunity costs rather than assert a universal optimal policy.

All input counts, bounds and monetary units are validated. Rates, timing and prices are required inputs, with no balance defaults in the service module; production values belong in data.mjs when integrated. A versioned checkpoint stores the original bounded specification, ordered reassignment commands and current minute; reload reconstructs derived queues, worker position, counters and causal events by replay. It never trusts serialized balances. Event IDs use an explicit caller-owned run ID plus sequence. Repeated advance/summary calls cannot charge again; summary money is a projection and must be applied once by the later career settlement adapter. Existing career saves, incident rules, artist deductions and balance baseline remain unchanged.

Acceptance for this prerequisite: hand-calculated quiet/surge/busy-bar outcomes; cohort conservation after every minute; no dual-duty worker; transfer refusal/return; reload during travel and backlog; batched versus minute-by-minute parity; prepaid refunds, finite bar demand, stable unique events; malformed/unknown/oversized checkpoint rejection; pure inputs. Player-facing forecasts, game save integration, artist-cost reconciliation and representative movement remain FOH-O01b.

### FOH-O01b: live pilot integration boundary

The next slice connects the service core to an explicitly selected Lot experiment, keeping the existing doors snapshot available. The engine owns the minute clock, arrival schedule, worker commands, incident effects, checkpoint and settlement. Browser speed/camera settings only choose when to request the next integer minute. Existing careers without the optional service field retain their current rules.

Incident policy for the live pilot: a rain/curfew response reduces only walk-ups still scheduled to arrive after the response minute; it cannot erase people already admitted or waiting. Gate-flow penalties change future processing capacity. Queue patience still governs guests already waiting. The response cost is charged once, the chosen response is immutable, and settlement waits for both a response and service close. Presales are held receipts accounted for at settlement, matching the current cash boundary. Refunds reduce ticket receipts; actual bar service replaces the old capacity estimate only for the pilot. Artist costs retain the booked terms and existing cost basis. No retroactive service sales or incident refunds are invented.

Before enabling this pilot in the UI, verify replay across incident/transfer order, migration of old careers, one-time response and settlement, conservation including cancelled future demand, and useful staffing policies against the actual Lot values. The UI must display real queues and current-rate estimates, worker travel, explicit clock controls and a reconciliation of prepaid receipts, walk-up sales, refunds and served/lost bar demand. Representative crowd counts follow admitted population, with no dependence on display quality. Record the pilot's concrete values in data.mjs and RULES.md.

### FOH-O01c: representative service movement

**Problem and outcome:** The live HUD reports real queues, but an evenly distributed crowd cannot show admission pressure, bar demand or a worker in transit. The Lot needs a shared presentation of these zones in classic and 3D views.

**Bounded slice:** Project the saved aggregate snapshot into outside admission, inside bar waiting and floor representatives. Bar waiting is a subset of admitted attendance. Cap visible samples independently of the numeric totals and identify their role with consistent colors and a compact legend. Locate services from placed footprints; use deterministic accessible adjacent cells and bounded grid paths around equipment for the worker. A missing visual path has a diagnostic and a stationary marker, never a new financial or service-rate effect. Pause and reduced motion use the current logical minute; animation interpolates only presentation.

**Rules and persistence:** No new engine rates, individual guest simulation, save fields, cash, capacity, patience or settlement effects. The same service checkpoint supplies both renderers. Numeric counts remain the source of truth. Representative limits cannot create or remove people in the engine. Normal departure, sanitation and food demand belong to FOH-O02.

**Acceptance:** Quiet, surge and busy-bar snapshots show correct zone totals with no admitted/bar double count; samples are bounded and deterministic; actor positions avoid occupied equipment; the worker has one position along the saved transfer interval and stays still when paused. Both renderer selections, camera changes, speed and reload preserve the checkpoint and settlement. Inspect phone/desktop screenshots, compare reduced motion, and retain exact numeric queue and cash readouts. Physical readability remains a separate evidence lane.

### FOH-O01d: event-derived guest transitions

**Player outcome:** Representative guests visibly arrive, move from admission to the bar, return to the floor after service or bar abandonment, and leave admission only when the service engine records abandonment.

**Implementation boundary:** Replay the existing causal service events into temporary cosmetic identities and zone histories; do not add saved guest AI, rates, transactions or a second simulation. Use deterministic samples and obstacle-respecting paths between the prior and current whole-minute projections. A minute containing admission and bar service traverses both anchors. The renderer interpolates the last committed minute while playing; pause/reduced motion show its final state, and a batched advance skips old animation rather than inventing transactions. Departing admission samples are explicitly labeled recorded abandonments and share the 180-guest drawing budget. Worker travel retains its saved interval.

**Acceptance:** Every guest transition traces to an arrival/admission/bar-service/expiry event. Stable identities never occupy two zones; bar losses return to the floor, gate losses leave outside, and finite sample limits preserve exact numeric totals. Compare quiet/surge/closing snapshots, intermediate positions around equipment, same-minute transitions, arbitrary step batches, reload, reduced motion and renderer/camera changes. Full settlement and saved checkpoints remain byte-equivalent. Missing cosmetic paths are diagnostic and do not alter service. Normal end-of-show departure remains FOH-O02.
