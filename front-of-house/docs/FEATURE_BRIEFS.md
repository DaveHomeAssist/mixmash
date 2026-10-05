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

### FOH-V02r1: Fathom Hall technical scene

**Scope:** Extend the explicit 3D preview to the existing20×14 Club. Author a cutaway room, exactly four blocked pillar tiles and a suspended medium house-PA representation from existing venue metadata. Keep the roof omitted for management visibility. The room uses the same provisional scale, props and material provenance as the Lot; fixed scenery does not add rentable objects, lights or capacity. A discovered pre-existing placement omission is corrected for new edits: equipment cannot overlap fixed pillar tiles. Existing saved layouts and historical evaluation remain unchanged.

**Flow and acceptance:** Open a saved Club show with the preview enabled, inspect at yaw37/135 and Wide/FOH/Stage/Plan, then return to the Lot or a classic-only room. Camera bounds, floor/grid, guests and picking must follow each room's actual extents. Opaque permanent scenery occludes selections behind it, while engine pillar rules remain authoritative. Verify exact saved-show settlement across classic/3D, blocked placement with matching ghost feedback, room-switch cleanup, fallback and desktop/phone containment. Retain the Lot's regression fixtures unchanged.

**Evidence boundary:** This is a technical preview under the delegated all-phase execution instruction. It does not replace classic art or establish human camera/art approval. Final visual review, physical calibration and public promotion remain gated separately; no archive assets or new simulation rules are introduced. Loam Shell and Split Acre remain separate slices.

### FOH-V02r2: Loam Shell technical scene

**Problem and scope:** The28×18 amphitheater still falls back to the generic classic room when the3D preview is requested. Extend the existing preview with a source-owned cutaway shell profile, the existing medium house PA and contrasting seating/lawn guides. These are management-view representations, not a calibrated seating plan:400 seats remain the engine's aggregate allocation, and guides neither reserve build tiles nor change capacity. Keep the roof absent for plan-view visibility. No borrowed art, additional dependencies, new save fields, collision rules or economic changes.

**Flow:** Choose the amphitheater, inspect its shell and seating/lawn distinction, place and inspect the same equipment, set existing seat/lawn prices and held-night count, then run and settle the show. Returning to Club/Lot must recreate the correct room without stale canvases or saves. Seating guides are pick-through floor decoration; opaque shell/rig geometry occludes selection normally.

**Acceptance and risks:** Verify all four camera presets, yaw37/135 and extreme room tiles at desktop/phone/ultrawide dimensions; existing prop footprints and editing remain authoritative. Compare the same seeded seated/lawn show, rain response and held-run settlement through classic and3D, including reload/context recovery. Test decorative guides cannot steal clicks. Keep Lot and Club regressions and manifests current. Technical preview only: final architecture/art, physical calibration, device support and human acceptance remain separate. Split Acre and minimap remain later slices.

### FOH-V02r3: Split Acre technical scene

**Problem and outcome:** The Festival books a second act but its preview still uses the generic classic yard. Give both stages a legible source-owned technical scene while preserving the existing 40×24 editable grid and simulation authority.

**Scene and flow:** Keep the main editable yard at its existing coordinates. Add a fixed, nonbuildable side-stage annex to its east, within a 52×24 presentation extent. The annex is an authored management-view convention, not additional permit capacity or physical calibration. Fit/Plan include both areas; an accessible Side stage camera control focuses the fixed deck. Fixed scenery occludes picks, while ground outside the 40×24 build grid never yields an editable tile. The roof remains absent for legibility.

**Audience and data:** Use the existing show-preview stage-accounting result when available to place representatives in the main and side areas, conserving a total limit of180 models. Never recompute admissions, demand, money or artist terms in the renderer. Unmarked older shows lack a conserved stage allocation: keep their known main crowd and label side attendance unavailable in renderer diagnostics instead of inventing a count. Booking identity may still light the existing stage representation without creating lighting capacity. No new save fields, build restrictions, dependencies, purchased assets or altered pricing.

**Acceptance:** Confirm 40×24 ground picking and 52×24 camera fit at yaw37/135, all camera views, mouse/touch/keyboard access to the side stage, cleanup and fallback across all four venues. Verify known audience totals and the180-model cap, no placement in the annex, exact classic/3D settlement and reload for versioned stage accounts and legacy saves, context recovery, responsive containment and measured native performance. Use actual stage-accounting fixtures after their separately owned integration is delivered. Final art/calibration/human acceptance and the large-site minimap disposition remain distinct gates.

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

### FOH-U01a — Zoomed Split Acre overview

**Need and decision:** The verified side-stage preset puts the annex in view while most of the main yard leaves the phone/desktop camera. At zoom2/3, arbitrary pan and yaw remove the site boundary from view. Implement the already scoped desktop overview; retain Fit and camera presets on phones. This is an autonomous implementation decision within CT-DEC-19 and FB-08, not a new simulation feature.

**Scope:** A small overview appears only for zoomed Split Acre on desktop. It rotates with the renderer's view, shows current layout blocks and a bounded crowd tint, and outlines the actual visible ground polygon. The perspective outline comes from ground-plane/frustum clipping, including low pitches and authored eye views; it is not an invented rectangle. The 3D map includes the fixed annex, while classic uses its existing yard. Click or drag pans without placing, changing zoom, advancing time or saving camera state. Arrow/Home keys and existing board controls remain available. Locate the map in a free HUD margin, never over primary controls; hide when a compact window has no safe slot. No independent animation loop.

**Acceptance:** Check classic view turns and3D yaw37/135, pitch15/85/Plan, zoom1/1.5/2/3, both stage areas, off-map drags, keyboard focus, resize, theme, renderer recovery and room changes. Verify projected footprint bounds, exact pan targets, unchanged state/receipts and no overlap at desktop sizes; hidden at Fit and on phones. Measure redraw reuse and the integrated rendering cost separately from native full-HUD60fps and human/device acceptance. No source/archive art or new dependencies.

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

### Renderer measurement implementation

FOH-P01 adds `npm run perf:front-of-house`: a renderer-only harness using the production empty/show fixtures above, all three CSS viewports at requested DPR 1, three repetitions, 10-second warm-up and 30-second sampling. The player problem is unquantified responsiveness: measure before changing quality or claiming the device targets. The harness freezes source/fixture hashes, retains raw intervals and failed runs privately, reports CPU submission separately, and rejects visibility/resize/context-loss windows. It changes no runtime rules, saves or quality defaults. `--quick` validates the harness only; `--gpu=default` observes the browser-selected backend, `--gpu=metal` requests Metal on compatible hosts, while the default explicitly requests the existing software backend. This is not full HUD, physical device, thermal or native-display acceptance. Acceptance is a reproducible complete report with all attempts retained and no inferred pass thresholds.

See [PERFORMANCE.md](PERFORMANCE.md) for the implemented Lot renderer’s subsequent 18-run Apple M4 Metal baseline. The earlier table below remains the preflight comparison of the old board and separate archive.

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

### FOH-P01b: reuse unchanged Lot shadows

The hardware baseline shows repeated render cost even for an unchanged empty scene. Reuse the directional light's shadow map while only the viewing camera, HUD overlays, lighting intensity or non-shadow rain changes. Invalidate it for layout or representative guest transforms and after WebGL context restoration. Preserve the current shadow resolution, geometry, materials and light positions; this slice adds no quality reduction or adaptive policy. A paused or hidden renderer retains pending invalidation until its next actual render.

Acceptance: backend diagnostics count actual requested shadow refreshes; repeated static frames and camera movement reuse the map; changed layout, moving guests and restored contexts refresh it; reduced motion stays static; screenshots after restoration match before. Run existing camera/picking/lifecycle and actual-client settlement parity rails. Compare the same frozen empty/crowd camera fixtures at unchanged declared quality. Diagnostics prove render work, not physical display performance or human acceptance. No engine, service, save or career rules change.

### FOH-P01c: classic static floor cache and full HUD

**Outcome:** Avoid repainting unchanged classic floor tiles, grid, parking lines, fence and sightline base layers during show animation. Retain dynamic props, crowd, lighting, rain, markers and controls. Preserve post-prop sightline overlays and sprite occlusion; flattening those layers would change readability.

**Scope and lifecycle:** One viewport-sized offscreen image per board, with explicit invalidation for room/floor, layout/pillars, sprite readiness, visibility overlays, camera transform, size and pixel ratio. Reuse post-prop overlay buckets alongside the image. Copy at matching backing resolution without additional resampling. Release the backing on disposal and retain direct drawing if cache creation fails. Preserve engine/service/save behavior and the current 6 MP pixel-ratio rule; verify its 3D counterpart separately before changing quality.

**Acceptance:** Cached/direct pixel parity and identical hit stacks across all rooms, layout/sprite readiness, pan/zoom/view turns, resize, DPR and clear/blocked overlays; static-frame reuse and correct dynamic crowd/incident behavior. Verify the actual client and both renderer settlement paths. Capture the required 1920×1080 full-HUD fixed-camera and moving-camera evidence with the same seeds before/after. Keep renderer-only Metal measurements, physical devices and human acceptance separate. No new art, economy or simulation policy is included.

### FOH-O01c: representative service movement

**Problem and outcome:** The live HUD reports real queues, but an evenly distributed crowd cannot show admission pressure, bar demand or a worker in transit. The Lot needs a shared presentation of these zones in classic and 3D views.

**Bounded slice:** Project the saved aggregate snapshot into outside admission, inside bar waiting and floor representatives. Bar waiting is a subset of admitted attendance. Cap visible samples independently of the numeric totals and identify their role with consistent colors and a compact legend. Locate services from placed footprints; use deterministic accessible adjacent cells and bounded grid paths around equipment for the worker. A missing visual path has a diagnostic and a stationary marker, never a new financial or service-rate effect. Pause and reduced motion use the current logical minute; animation interpolates only presentation.

**Rules and persistence:** No new engine rates, individual guest simulation, save fields, cash, capacity, patience or settlement effects. The same service checkpoint supplies both renderers. Numeric counts remain the source of truth. Representative limits cannot create or remove people in the engine. Normal departure, sanitation and food demand belong to FOH-O02.

**Acceptance:** Quiet, surge and busy-bar snapshots show correct zone totals with no admitted/bar double count; samples are bounded and deterministic; actor positions avoid occupied equipment; the worker has one position along the saved transfer interval and stays still when paused. Both renderer selections, camera changes, speed and reload preserve the checkpoint and settlement. Inspect phone/desktop screenshots, compare reduced motion, and retain exact numeric queue and cash readouts. Physical readability remains a separate evidence lane.

### FOH-O01d: event-derived guest transitions

**Player outcome:** Representative guests visibly arrive, move from admission to the bar, return to the floor after service or bar abandonment, and leave admission only when the service engine records abandonment.

**Implementation boundary:** Replay the existing causal service events into temporary cosmetic identities and zone histories; do not add saved guest AI, rates, transactions or a second simulation. Use deterministic samples and obstacle-respecting paths between the prior and current whole-minute projections. A minute containing admission and bar service traverses both anchors. The renderer interpolates the last committed minute while playing; pause/reduced motion show its final state, and a batched advance skips old animation rather than inventing transactions. Departing admission samples are explicitly labeled recorded abandonments and share the 180-guest drawing budget. Worker travel retains its saved interval.

**Acceptance:** Every guest transition traces to an arrival/admission/bar-service/expiry event. Stable identities never occupy two zones; bar losses return to the floor, gate losses leave outside, and finite sample limits preserve exact numeric totals. Compare quiet/surge/closing snapshots, intermediate positions around equipment, same-minute transitions, arbitrary step batches, reload, reduced motion and renderer/camera changes. Full settlement and saved checkpoints remain byte-equivalent. Missing cosmetic paths are diagnostic and do not alter service. Normal end-of-show departure remains FOH-O02.

### FOH-O02a: modeled Lot access and normal departure core

The first guest-operations slice establishes a pure, tested model before connecting controls, saves and representative exit animation in FOH-O02b. The player outcome is understandable normal departure after the set, with blocked access reducing modeled throughput and no extra occupancy entitlement.

The model identifies the largest connected free-floor region (row-major tie breaking) as the audience area. Boundary gates and exits are usable only when their interior neighbor belongs to that region. Equipment footprints block connectivity. The result names usable/blocked portals and provides a free-cell route to each usable portal. It does not reinterpret the existing permit, floor-density or exit-capacity formula. This is a game accessibility model, not emergency evacuation or certification.

After service closes, the admitted population enters a finite departure backlog. Each whole game minute removes at most five guests per usable exit; this rate is a provisional gameplay constant. A zero-exit fixture remains blocked with its people conserved. Engine integration must refuse new live shows without usable admission and exit access before charging upfront costs, preserve older live checkpoints, lock geometry during the show, and prevent settlement until departure completes. Save only a bounded versioned checkpoint and reconstruct all counts/events; speed, batching and reload cannot alter the result. Departure has no new receipt or refund.

Acceptance for the core: disconnected and partly blocked layouts, deterministic routes/ties, unchanged input/capacity authority, zero/quiet/surge demand, finite conserved backlog, exact per-minute throughput, batching/reload parity, malformed checkpoint rejection and no money fields. The core alone does not complete FB-11: pre-doors explanation, player clock/controls, paused/reduced-motion exit samples, career settlement and production delivery remain FOH-O02b.

### FOH-O02b: playable access and normal departure

New live shows opened through the client use flow version 1. Existing imported live shows without that marker retain their original closing behavior. Before upfront charges, the engine requires a usable admission gate, bar and exit connected to the modeled main floor; admission/bar service counts only connected providers. Promote explains usable versus placed portals and the normal-departure rule. This never changes legal capacity.

At minute 240 admissions and bar service close under the existing rules. The same Play/Pause, speed and +5-minute controls then drain the admitted population through usable exits. Close show stops at service closing; a separately labelled Finish departure action completes the remaining departure minutes. Settlement is unavailable until inside plus departing backlog reaches zero. Receipts and signed attendance remain the cumulative admitted totals, independent of departure. Geometry is locked throughout, so access cannot disappear mid-show.

Save the flow version and departure elapsed minutes; reconstruct admitted count, usable exits, rates and all events from authoritative layout and service replay. Invalid elapsed progress resets to zero with recovery feedback; older signed saves retain their original settlement semantics. Representative guests follow free-cell paths through usable exits and disappear only at recorded outcomes. Pause/reduced motion uses final positions; reload and clock speed conserve people and money. Tests must cover refusal before charge, partly blocked gates/exits, old saves, malformed progress, closing/settlement gates, normal exit animation, offline/reload, both renderers and phone controls. Food, sanitation, emergency evacuation and legal capacity changes remain outside this slice.

### FOH-O02c1 finite concessions core

Implement the financial and demand authority before the playable vendor integration. Reconstruct admitted guest identities from the authoritative admission/bar FIFO events, never presentation state. Each admitted guest gets one optional food request after their bar outcome, including one-way switching after bar abandonment; no new guest or repeated bar demand is created. Every third admission ordinal receives a $16 discretionary budget, the others $24. A completed bar sale spends $8 of that budget (the existing promoter bar net stays $6); food never spends more than the remainder. Every second admitted guest wants food, and every fourth accepts the premium price, making price affect demand independently of affordability.

Two locked contracts: standard $8 meal, one window at two meals/minute, 80 meals in stock; premium $12 meal, two windows at four meals/minute, 160 meals. The house receives 25% of actual vendor gross. Vendor inventory costs $3 per stocked meal; staffing costs $80 per window per show, paid by the vendor. No promoter setup fee and no artist cost-basis changes in this core. The vendor can lose money on unused stock and staff. The standard choice serves more price-sensitive demand; premium capacity and price can improve house income during a surge. These are game constants, to be checked against quiet/surge outcomes before integration.

Food opens at minute1 and closes with bar service. Access unavailable means zero service and an explicit access outcome. Requests expire after six minutes; expiry occurs before service at a minute boundary. Service events at closing can still create and fulfill requests before remaining food requests close. Stock exhaustion resolves remaining requests immediately; no hidden future sales. FIFO order uses source bar event order and admission ordinal. Each guest spends at most once at each service. Stable transaction identifiers derive from source admission and guest ordinal, and a checkpoint stores only versioned locked terms plus authoritative service checkpoint; totals, queues, remaining stock and budgets are rebuilt.

Verify finite demand/budget/stock conservation, shared guest identity, reduced price acceptance, zero stock/access, expiry/closing, deterministic checkpoint/batching, rejected malformed inputs, unchanged source events and separate house/vendor money. This slice has no client UI, new object, career receipt or renderer change; FOH-O02c2 must wire the placed stall, locked settings, animation, ledgers, save recovery and both-renderer/offline/player verification before FB-09 is delivered.

### FOH-O02c2 playable vendor integration

Expose one optional Food stall on the Lot Build palette. It occupies a visible 2×1 footprint, has vendor-supplied power/staff and no promoter setup charge. Preserve existing legal capacity math: its occupied tiles can reduce usable floor, never inflate capacity. Render a source-owned awning/counter/stall in 3D and a labeled procedural counterpart in classic view. Do not request an unprovided sprite.

Promote offers Off, Standard ($8 / 80 meals / one window) and Premium ($12 / 160 meals / two windows) in a dedicated vendor settings window, with the 25% house share and vendor-paid expenses stated before doors. Selecting food requires the live Lot clock and connected vendor access. Lock a versioned contract on opening doors. Older saves omit the contract and retain their exact finances. Validate plan/version on import, derive access from the venue, and rebuild sales from validated services; damaged optional terms recover with feedback rather than trusting supplied balances.

Use a dedicated Food window from live Services and settlement Revenue to fit phone layouts; the receipt provides a return to settlement. Show demand, queue, served/lost, stock and vendor gross separately from promoter income; include only the latter in career receipts/net, once at settlement. Artist costs/pay remain unchanged for the same layout and service outcomes. Add a distinct food queue to the shared renderer projection, conserve inside totals and stable guest identities, and return guests to the floor once after food resolution. Normal departure must still drain everyone.

Verify actual settings/placement, refusal before charge, fixed terms, both artist deal types, reload/import/repeated signing, quiet/surge choices, both-renderer guest/queue movement, phone containment, warmed offline and action-client input. No food-dependent satisfaction bonus, multiple stalls, sanitation, research or ownership in this slice.

### FOH-O02d1 sanitation and servicing core

Build a bounded engine model before the player integration. Each admitted guest makes one restroom request after their bar/food outcome plus a deterministic delay. This is an independent facility visit, not a second guest, purchase, show departure or ticket refund. Stable arrival identities connect outcomes to the same audience. Guests still in a food queue cannot join the restroom queue simultaneously. Requests due after service closing are resolved as unserved closing demand; they never keep a signed show open indefinitely.

Portable units use their placed count, one stall each. A single later rental trailer package provides two stalls plus an accessible stall and requires a connected utility supply. Baseline portable provision and accessibility remain available without research. Access and utility flags are explicit inputs; unusable facilities contribute zero service. Every stall serves one guest over two minutes, starts clean, and loses one cleanliness use per completed visit. After twelve uses it closes for cleaning. One dedicated service worker cleans one dirty stall at a time for three minutes; no service occurs in that stall while cleaning, and cleaning cannot overlap on the same worker. Without assigned servicing, dirty stalls remain unavailable. Guest patience is eight minutes before starting service. Already-started visits finish normally by closing; no new visit starts if it cannot finish before closing. One FIFO queue prevents duplicate visits.

Persist only versioned facility specification, locked servicing choice and source checkpoint; replay derives condition, in-progress visits, cleaning, queues and outcomes. This core has no money or satisfaction side effects. The later integration must expose costs, usable stalls/utilities, waits/condition and servicing choice; derive sanitation satisfaction from completed requests; and add one explicitly priced, accepted/declined artist preference that is never treated as a mandatory rider or cancellation condition. Verify conservation, missing access/utilities, no duplicate visits, staff/cleaning timing, pressure differences, closing and replay before enabling the client.

### FOH-O02d2 sanitation contract and career integration

Under the delegated autonomous decisions in CT-DEC-19, add an optional sanitation trial to new flow-version1 Lot shows. Existing saves without its marker retain their exact results. The trailer occupies 3×2 tiles, draws 1,500W and costs $240 per show; it supplies three guest stalls (including accessible provision) plus a separate quiet changing area. A dedicated cleaner costs $80 and the trailer utility package costs $60. These are game balance values, not real venue quotes. Connected portable units remain available without research or utilities. Only connected facilities serve; trailer service additionally requires paid utilities and sufficient modeled generator capacity. A placed trailer requires the trial before doors, preventing a free functional package. Refuse no usable sanitation before charging. Do not change the existing legal capacity formula.

Lock enabled cleaner/utilities/preference choices and the priced trailer count when doors open. Add the explicit production costs to upfront payment and the existing door-deal deduction basis. Guarantee artist pay stays fixed. Replay visits from normalized geometry and service/food checkpoints; never import queue, condition, money or satisfaction totals. Damaged optional terms recover to a disabled trial with recovery feedback and cash preserved. A valid contract keeps its quoted costs even if imported geometry has lost a trailer, while actual service/preference fulfillment is derived from that geometry. Optional fields absent means no new cost keys or result fields.

Replace only the restroom half of amenity scoring with completed requests divided by requested visits. Lost visits do not remove attendees or refund tickets. Sodium Arcade can optionally accept a quiet changing area before doors when a connected powered trailer and cleaner are available. Declining changes no relationship or cash. An accepted, actually fulfilled preference adds two relationship points after the ordinary pay calculation, subject to existing relationship bounds; artist ask and pay are unchanged by preference acceptance. Lost facilities in a damaged import cannot earn fulfillment. This is one negotiated preference, not a mandatory rider or cancellation rule.

This bounded slice verifies authority, costs, locking, old saves, corruption, access/utility refusal, food timing, both deals, satisfaction and one-time signing. The trailer has source-owned 3D geometry and a labeled classic fallback so valid imported layouts render safely. Playable facilities controls, guest routes, phone/offline interaction and live production journeys remain the next integration slice and are required before sanitation is delivered as a player feature.

### FOH-O02d3 playable facilities

Add the trailer to the existing Lot palette with keyT (key0 retains Fit), source-owned visual and stated rental/power. Consolidate food and sanitation settings behind the existing Promote Facilities button; use separate Food, Sanitation and Artist pages so phone and short desktop windows fit. Preserve the food selectors and behavior. Sanitation starts Off; enabling it presents cleaner/utilities choices, placed/usable supply and the exact upfront production quote. Artist page offers explicit optional acceptance/decline and explains prerequisites, relationship benefit and no artist cash change. No unpriced setting or new decision prompt is required.

The live Facilities receipt exposes waiting, in-use, served/lost, cleanings, dirty stalls, worker progress and cost. Settlement provides the same receipt and a return to the unsigned or signed sheet. Purple guests represent sanitation waiting/in-use; all zones share the same finite identities and 180-person presentation budget. Food ends before the same guest enters sanitation. Routes stay on the connected floor; normal departure contains each person once. A cleaner progress readout is authoritative; no animated cleaner is claimed in this slice.

Verify actual placement/settings, costs and accepted terms, busy visits/cleaning, paused/reload parity, full closure/signing, both renderers, desktop/phone/short desktop containment, dark theme, keyboard operation and warmed offline continuity. Reuse the supplied action client for ordinary controls without treating its known native-select limitation as enabled-contract proof. Only required CI, merge, Pages/source parity and production player journeys close this feature; physical device and human art/comprehension evidence remain separate.

### FOH-R01a three-project research authority

Implement the accepted D6 A pilot’s pure authority before its career/UI adapter. One active development slot creates a real choice. Patch standards costs $120, requires no prior Production experience and completes after one eligible Production night. Service training and Admission lanes each cost $180, require one point in their respective Guest services/Admissions track, and take two eligible nights. Experience is cumulative and unspent; one distinct settled night adds at most one point per department that actually operated. Venue operations is recorded for future use without unlocking a fourth project. These are provisional game values in data.mjs. No attendance multiplier, historical back-award or real-time wait is allowed.

Starting pays once and requires sufficient current cash. Pausing retains work and frees the slot; resuming costs nothing and requires a free slot. Cancelling refunds floor(original project cost × uncompleted nights / required nights); completed work is not refunded, and restarting begins at zero progress. Completed projects cannot be cancelled or purchased again. Sandbox exposes all knowledge without spending, while physical deployment requirements remain the adapter’s responsibility. Career and scenario cores start with zero experience/knowledge. The later client offers opt-in development between shows after the first settlement; the XP0 foundation remains available without reconstructing past history.

Persist a version1 ordered, bounded command checkpoint: project start/pause/resume/cancel and a distinct settled-night ID plus four explicit department-eligibility flags. Replay derives experience, progress, status, learned IDs, development debits/refunds and a stable ledger. Validate each command and all prior night IDs, not merely the last. Duplicate night submission is a no-op; checkpoint loading must never apply its historical cash deltas to career cash. Bound the log at2,048 commands and refuse further new work with a clear error instead of silently dropping deduplication history. This bounds imported work while comfortably covering the three-project pilot.

Acceptance: no cyclic/self-required unlock, one slot, affordable foundation, exact debit/refund, no cancel/restart profit, eligible-night progress and cumulative experience, duplicate-night idempotence, pause/resume, sandbox, pure inputs, deterministic checkpoint replay, rejected malformed/oversized commands and ignored derived save fields. The core does not change career cash, artist deductions, existing bookings or current gameplay. The next adapter must freeze deployed knowledge per booking, keep multi-night benefits delayed until the next booking, and test the proposed paid PA response, staffed-bar and admission effects against actual quiet/surge outcomes before player delivery.

### FOH-R01b1 career research adapter

Enable the optional pilot between bookings after one settled show; Sandbox can enable immediately and starts with all three projects learned. Existing careers remain unchanged until enabled. Scenario begins with no experience and retry resets its development. Start, pause, resume and cancel only between bookings. Apply each command's exact cash delta once and keep development in a separate career ledger, outside production costs and artist deductions. Imported checkpoints replay without paying again; malformed or mismatched modes recover to empty development with feedback and preserve cash.

Freeze a versioned command-prefix index when booking. Derive learned projects from that prefix for every held night; later completion applies to the next booking. Patch standards adds 0.15 (capped at1) to the paid backup-amp response with a PA, retaining its $100 cost and the incident. Service training adds one guest/minute to the transferable worker only while serving the bar. Admission lanes adds one guest/minute per connected gate in the live flow-version1 Lot. Staff, paid equipment, access, finite demand and legal capacity remain prerequisites. Imported effect numbers or learned lists are never trusted.

On each signed night award at most one experience per eligible department: production requires attendance and a PA; guest services requires actual live bar service; admissions requires actual live admission; venue operations requires attendance. No historical backfill or audience-size multiplier. The active project's department must qualify that night to advance. Stable seed/night IDs prevent repeated awards, and a full bounded development history must never block signing or income. Preserve checkpoints across next-show transitions. Test old saves, exact cash/refunds, phase gates, replay/recovery, frozen booking/held nights, actual benefits, and full-history settlement. This adapter slice does not claim player-facing research until its subsequent controls and browser journeys are delivered.

### FOH-P01d: 3D backing resolution and live DPR changes

**Problem and outcome:** The classic board follows HUD section 6, but the optional 3D Lot currently allocates DPR2 at every viewport and captures display density only on creation. Apply the existing rule to the 3D backing: clamp requested DPR to 1–2, then limit it to 1.5 when CSS width × height × clamped DPR² exceeds 6,000,000. This is a threshold for a resolution reduction, not a strict six-million-pixel backing ceiling. Keep explicit DPR1 benchmark overrides stable.

**Smallest slice:** Recompute on resize and browser density changes, rearm one resolution media listener and remove it on disposal. Also detect changed density before an actual render for browsers or emulation that update media matches without dispatching the event. Invalid/nonfinite density falls back to 1. Expose requested density, effective density and actual backing dimensions in existing diagnostics. Keep camera/picking in CSS coordinates and redraw after density changes and context restoration. At 1920×1080/requested2, expect 2880×1620; at 375×812/requested2, expect 750×1624. Large-screen sharpness intentionally follows the already documented quality rule.

**Acceptance and exclusions:** Real browser backing dimensions, threshold boundaries, phone/desktop/ultrawide resize, explicit overrides, same-CSS-size density changes, listener cleanup, CSS-coordinate picking, context restoration and unchanged saved-show settlement. Density emulation proves browser behavior, not movement between physical monitors. Do not relabel earlier DPR1 or classic HUD measurements, change shadows/models, or alter simulation, services, saves, careers or adaptive quality policy. Physical display readability and supported low-power devices remain separate acceptance work.

### FOH-R01b2 playable development controls

Add a Development entry to the existing game menu and a discoverable link after the first settled show. Present Patch, Service, Admission and Ledger as four contained pages, with available cash, active slot, experience requirement, eligible-night progress, exact start/refund amount and the current booking's knowledge. Start/pause/resume/cancel remain between bookings; a show in progress offers a read-only view. A fresh career explains first-show eligibility, Sandbox enables all knowledge for free, and a full checkpoint shows its limit. The ledger separates net development spending from show/artist costs. Display the actual paid Patch response improvement at the incident. No hidden expense, calendar delay, free equipment, fourth project or research recommendation prompt.

Verify ordinary player clicks to opt in, start/pause/resume/cancel, distinct-night completion, reload, next-booking activation and exact cash; exercise each page with keyboard and touch on phone, desktop and short dark desktop, plus classic/3D and warmed offline. Keep research source values and authority in the engine. Preserve older careers and renderers; only source/CI/production proof closes this pilot, never device or human acceptance by inference.

### FOH-E01a small PA inventory authority

Under D7 A and delegated routine decisions, start ownership with one small PA. Purchase costs $1,200, sale returns $600, and the later deployment adapter will charge $20 per operated night instead of the current $200 rental. These are provisional game values. One owned unit is enough for this family; no inferred ownership from layouts, house rigs or prior rentals. Acquiring, deploying and operating remain distinct. No condition, loans, deposits, pending purchase order or automatic placement is introduced: closing a quote cancels without spending; accepting it pays immediately.

This pure prerequisite records version1 buy/sell commands with caller-issued stable transaction IDs. Derive one stable asset identity, capital debits/disposal receipts and inventory from the source commands. Repeat identical transaction IDs have zero new cash effect; reusing an ID for a different action is refused. Sale removes exactly the currently owned asset once. Rebuy creates a new identity and cannot mint cash. Ignore supplied prices, derived assets and totals on load; reject unknown family, malformed commands, duplicates or impossible sequences. A bounded512-command capital log rejects new capital activity when full, but the later adapter must keep show operations available. Loading never applies historical money again.

Before career integration, verify affordability, idempotency, one-unit ownership, stable identities, no duplication or cash-creation loops, strict checkpoint replay and limit behavior. This slice does not waive rentals, change artist costs, add a career ledger or expose buying controls. The follow-up must freeze eligible asset use/costs before doors, keep signed settlements unchanged after sale, and reconcile opening cash plus every subsequent capital, research and show movement in a bounded career journal. The old schema3/cents proposal remains separate; additive versioned state can retain schema2 whole-dollar compatibility.

### FOH-P01e: CI runner calibration before regression limits

**Problem and outcome:** Correctness checks and the available Mac measurements do not establish a CI timing budget. Capture the same production empty/crowd fixtures on a declared GitHub runner image before choosing measured regression limits under CT-DEC-17 and the delegated phase-execution authority.

**Smallest slice:** Add an explicit calibration option to the existing manual CI dispatch. Run the full renderer protocol in a separate Ubuntu 24.04 job, requested DPR1 and SwiftShader, with three repeats for all three standard viewports, 10s warm-up and 30s measurement. Keep ordinary PR correctness gates unchanged. Record the runner image, architecture, run/attempt, source/fixture digests, actual software backend and all failed windows. The full calibration takes at least twelve minutes; it is separate from normal PR execution. No schedule or new host installation.

**Evidence and privacy:** Upload only JSON generated from public synthetic fixtures and an allowlist of non-secret CI metadata; do not read user profiles, credentials or private available-host artifacts. Retain the artifact on failure when the runner can finish its final step. Download and verify every raw/source/fixture digest before publishing a reviewed summary. Local raw measurements remain private. A successful calibration proves valid samples, not a frame-rate target or a regression budget.

**Acceptance and next gate:** Dispatch the exact pushed branch, observe the live job, retrieve its artifact, validate all eighteen windows and name the actual runner/browser. Choose explicit limits only after comparing repeat variation; run an intentional slowdown to prove the later gate rejects a regression. No simulation/save changes, quality reduction, weakening of existing checks, or physical-device acceptance in this calibration slice.

### FOH-P01f: Native desktop reproduction and evidence publication

**Problem and outcome:** Headless dimensions cannot establish behavior on attached displays. Preserve the completed CI calibration and native desktop measurements as separate evidence, and make the native checks reproducible with installed Chrome and isolated storage.

**Smallest slice:** Add a native-window mode to the existing renderer harness, recording actual content size, density, focus and visibility. Retain the same fixtures, camera path, warm-up, sampling and three repeats; reject emulated-density/viewport flags in this mode. Add a manual full-client check that moves its own temporary browser window between attached DPR1 and DPR2 displays at fixed CSS size, then returns. Permission for screen enumeration belongs only to the temporary context and loopback origin. No system display settings or user profiles change.

**Acceptance and exclusions:** Preserve exact game state, picking at yaw37/135, backing sizes and viewport containment through actual display moves. Keep raw screenshots/display coordinates private; publish sanitized summaries with source and artifact digests. A missing browser/display produces a retained failure and closes the local server. Normal headless behavior remains covered separately. These checks do not establish touch, thermal/battery, low-power or human readability acceptance, and change no game, save, career or quality policy. CI timing limits and intentional-slowdown proof remain the next performance slice.

### FOH-P01g: Paired CI regression gate

**Problem and outcome:** The measured GitHub software backend is slow and runner hardware varies. Detect material renderer regressions by comparing a pinned calibrated revision and the candidate sequentially on the same runner/browser, preserving all18 windows per revision. Keep the60fps desktop/30fps low-power targets separate.

**Smallest slice:** A dedicated performance workflow runs for renderer, fixture, dependency or measurement changes and on manual dispatch. Check out calibrated6ed7b7c and the candidate into separate clean directories, use identical SwiftShader/DPR1 quality, validate synthetic fixture scenes and all raw digests/statistics, then compare the median of three repeats per scene/viewport. Fail invalid/incomparable evidence. Keep normal CI unchanged.

**Initial regression policy:** Frame mean and p95 medians may increase by at most the larger of25% or8ms; CPU submission p95 medians by the larger of50% or1ms. The observed calibration repeat variation was below these tolerances (frame metrics about10%, CPU p95 up to25%); paired execution reduces runner variation but does not eliminate host noise. These conservative change-detection limits are delegated engineering decisions, not device guarantees. No automatic baseline update. Material fixture/backend/protocol changes require explicit recorded recalibration.

**Failure proof:** A manual diagnostic option inserts20ms of real CPU work in the isolated harness on every draw, without changing production code or scene quality. Run the full protocol, require valid samples and demonstrate that the same budget evaluator rejects those measured results for numeric regression. Invalid evidence or a quick-mode rejection cannot substitute for this proof.

**Acceptance and exclusions:** Unit checks exercise boundaries, incomplete/duplicate/mismatched evidence and preserved quality; live CI must first pass the normal candidate and then reject the deliberate slowdown, retaining all artifacts. Never weaken existing checks or merge a failing regression job. Total sampling is approximately26minutes for a pair or40minutes including the optional fault run; no scheduled task, user data, runtime/save changes or physical-device claim.

### FOH-P01h: Coalesce application 3D rendering

**Observed problem:** Six full native3D/HUD windows at aa5f6a3 are valid but range47.58–59.98Hz. Moving-camera windows submit roughly twice as many renderer calls as the running-show animation alone. Shared-host load remains uncontrolled; duplicate work is confirmed, but it does not explain every cadence variation.

**Smallest slice:** Opt the application adapter into deferred 3D rendering. Camera and scene state update immediately; one pending animation-frame render consumes the latest state. Keep the standalone backend synchronous by default so existing integrations and measurement CPU semantics remain stable. Cancel pending work on pause, context loss and disposal; resume/recovery requests one current frame. Preserve dimensions, shadows, geometry, guest state, picking and all save/settlement rules.

**Acceptance:** A browser test proves one render for many same-task updates, latest-camera picking, cancellation on pause/disposal and recovery. Existing backend and full-client controls/settlement rails must pass. Retain all six original native HUD windows, then repeat the identical fixed/moving protocol after the change, auditing raw/source/fixture hashes and exact engine replay. Reduced render count is independent evidence from cadence or human/device acceptance; do not promise60fps merely from fewer calls.

### FOH-E01a2 bounded career cash journal

A capital-only list cannot reconcile the career: future research, show opening, incident responses and settlement must share one cash journal. Implement its pure authority before the adapter. Start with one explicit opening balance equal to current cash when enabled; do not reconstruct itemized history. Keep seven categories distinct: acquisition, disposal, development, development refund, show opening, incident and settlement. Show opening may be a credit when a sponsor exceeds costs; acquisition/development/incident are nonpositive and disposal/refund/settlement nonnegative. All amounts are whole-dollar safe integers, preserving schema2 units.

Use strictly consecutive numeric transaction sequence IDs and a stable game reference. Identical retained retries return zero new cash movement; changed retries or out-of-order requests fail without mutation. Retain the latest128 itemized rows. When another row arrives, roll the oldest into category totals and an archived-through sequence; opening balance plus archived totals plus retained rows must equal current cash. Do not discard asset provenance: the separate bounded capital-command checkpoint retains purchases and sales. An archived event cannot be replayed or paid again, even though its itemized payload is no longer retained. The UI must label compacted history honestly.

Validate sequence continuity, bounded rows, category signs, source integers and no archive totals before the first archived entry. Derive current balance, category totals and next sequence rather than trusting their imported copies. Loading applies no cash. Compaction keeps show recording available indefinitely within safe-integer arithmetic; it does not turn a full visible list into a settlement blocker. Test compaction across categories, exact reconciliation, retained/archived retry refusal, corrupted sources, isolated copies and mixed capital/research/show cash flows. Career enablement/recovery, every engine cash path and the player journal remain the next adapter slice.

### FOH-E01b1 owned PA and career accounting adapter

Enable Equipment between bookings after the first signed show (immediate in Sandbox). Initialize empty ownership and a journal opening at current cash; do not infer old purchases or fabricate past transactions. Buy/sell only between bookings with stable caller transaction IDs. Buying is immediate, paid capital; cancellation before accepting a quote costs nothing. Build explicitly assigns the owned unit to a placed small PA, or returns to rental. House rigs, medium PA and missing hardware cannot use the small asset. Power, staff and placement requirements still apply.

Freeze the ownership command prefix and assigned asset when opening doors, and retain it across a held run. Replace only the eligible small PA rental200 with operation20; never deduct purchase1200 as a show expense. A later sale must not rewrite signed receipts. Preserve paid operation costs when damaged imported geometry makes the asset unusable; invalid optional provenance recovers with an explicit notice and preserves career cash. Old unmarked saves keep their exact costs. Next Show retains ownership and journal; explicit career reset clears them.

Every enabled career cash path feeds the journal: acquisition/disposal, development/refund, show opening, paid incident and settlement. Signing a held night records payout and next-night opening separately, including sponsor credits. Their sum must equal the actual cash change. Import and repeated capital commands never pay twice. A valid journal must reconcile to saved cash; invalid/mismatched journals recover to a new explicit opening at preserved cash with an incomplete-history notice. Recording errors cannot silently falsify history or block show income. Keep the capital source distinct from compacted journal rows.

Verify exact cash and refunds, every cash action, source recovery, old careers, explicit assignment and invalid hardware, both artist deals, fixed receipts after sale, held nights, sponsor credit, compaction, next-show carry and resets. Update generated action/cost documentation. This engine slice precedes Equipment controls, ledger presentation and real browser/offline purchase/rent/deploy/sell journeys; those remain required before player ownership is complete.

### FOH-E01b2 playable Equipment window

Expose Equipment from the existing menu in every phase. Use four contained pages: Asset with the exact buy/resale quote and between-booking controls; Deploy with explicit Build-only assignment, current rental/owned state and hardware eligibility; Cash with the opening and seven category totals; History with three retained transactions per page and honest archived-row totals. No browser prompt or automatic purchase. Disabled actions state eligibility/affordability; closing any quote costs nothing. Keep the nightly operating line visible in signed receipts, separate from capital. Persist commands through the ordinary save path and expose inventory/deployment/journal summaries in the existing text probe.

Verify actual enable/buy/duplicate protection/rent/deploy/open/sign/sell/reload and offline continuity across Chromium classic/3D and WebKit desktop/phone. Include both themes, keyboard tabs, target sizes, short/ultrawide viewport fit and legacy checks. Use a banked career fixture only to reach the equipment test, labeling it as controlled evidence; complete real future bookings through player controls. Inspect screenshots and the supplied action client. No physical-device or human art acceptance is inferred.

### FOH-V02a Club ticketing authority

The Club is missing its original ticketing choice. Under CT-DEC-19's autonomous implementation authority, select a bounded optional pilot: Direct keeps the existing presale split with no fee; Ticket platform raises the presale share by20 percentage points, with the uplift capped at90% (an already higher source share is preserved), and retains4% of paid presale gross, rounded once to whole dollars per show. These are explicit fictional gameplay values, not an external ticketing service. The same demand, capacity and ticket price apply to both choices. More prepaid guests can reduce exposure to a later walk-up loss, while the fee makes direct sales preferable when that protection is unused. No unconditional profit claim.

Implement the pure version1 terms, split and receipt first. Validate finite nonnegative demand, bounded capacity/share, safe whole-dollar prices and conservative arithmetic. Guests are never created: integer demand splits into capped presale and remaining walk-up demand; capacity stays authoritative. Presale gross equals presale tickets times price; receipt decomposes into fee and remitted cash exactly. Zero price/demand/capacity produce no fee. Replay/load derives fee rates and limits from the validated plan rather than trusting imported values. Unknown versions/plans and malformed/unsafe numeric input fail explicitly.

The later career adapter will offer this only in Club Promote, freeze terms at doors and keep legacy/unmarked shows unchanged. The fee is withheld once from settlement receipts, never charged before doors or counted as artist-deductible production cost. Show net and payout must bridge exactly to career cash and journal; a signed receipt remains fixed on reload. It does not promise refunds for unavailable cancellation mechanics, seats/lawn rules, platform APIs, advertising uplift or an attendance bonus. Those remain separate scoped venue work.

Acceptance: hand-checkable direct/platform quiet and walk-up-loss pairs, share/capacity bounds, zero and rounding cases, strict source replay, immutable inputs, cash conservation and later both-deal/reload/browser checks. Required CI and hosted proof precede delivery; the core alone is not a playable ticketing choice or a complete venue phase.

### FOH-V02a2 Club ticketing career adapter

Add an optional validated `promotion.ticketing` choice only for Fathom Hall, copied to `show.ticketing` at doors. Absent terms retain the exact original arithmetic and save shape. Direct uses the original split; Platform uses the new pure split at unchanged draw/demand/capacity. Charge4% only on the resulting paid presale gross, withheld from signing income; show opening and eligible artist production costs never include that collection fee. Preview, final net, settlement payout and the optional career journal must reconcile under both offered deals. Active/signed shows read only their frozen terms; later promotion edits cannot change them.

Normalize recognized optional terms and ignore imported derived rates/fees. Invalid or wrong-room terms recover with explicit ticketing feedback while preserving cash and signed history; loading never credits or charges. Changing room or starting another show does not carry a stale platform selection. No external booking API, seats, live Club guest queues, refunds or held-night cancellation are introduced here. Verify exact legacy/direct parity, both-deal quiet/loss pairs, terms locking, one-time payout/journal, every old phase, source recovery and next-show/room isolation before adding controls.

### FOH-V02a3 playable Club ticketing

Expose Ticketing in Club Promote and the Club menu. Use contained Plan, Forecast and Receipt pages: Direct remains the free default; Platform explicitly shows20-point presale uplift and4% of presale gross. Selection costs nothing now and is editable only before doors. Forecast uses public artist draw bounds, booked draw multiplier, current ads/reputation and capacity, never the hidden seed. Show presale and fee ranges; keep actual receipts hidden until the show ends. The Promote presale chart must reflect the selected plan.

After the show, show actual presale gross, fee, remitted presales and total ticket cash after collection. Put a distinct collection deduction beside gross revenue on settlement, outside production costs and artist deductions, with the promoter net/cash bridge already reconciled by the adapter. Explain recovered or missing terms explicitly. Use the existing small-window content pager so all settings and receipts stay reachable without ordinary form scrolling. Preserve Equipment behavior when sharing it.

Verify real Club player selection/reload, both artist deals, immutable terms after doors, settlement fee/net/cash and journal, signed reopen, next-show defaults, offline choice and receipt persistence. Exercise Chromium/WebKit, phone/desktop, dark/light and short/ultrawide windows, inspect screenshots and the supplied action runner, and retain legacy/Equipment checks. This does not add live Club guest queues or physical-device/human acceptance.

### FOH-V02b1 held-run cancellation authority

The Amphitheater currently opens the next held night immediately when a player signs, and silently ends a run if the next opening is unaffordable. Add an explicit money decision under CT-DEC-19: new two/three-night bookings quote a cancellation fee of25% of the booked nightly artist ask, rounded once per cancelled night. Freeze version1 source terms (night count and quoted ask). After a completed night, the player may sign and continue or sign and cancel every remaining night. Completed-night revenue, artist pay and reputation remain earned; unplayed nights earn no tickets, attendance, experience or reputation. No next-night production charge applies after cancellation. The fee is a separate promoter career expense, never a deduction from the completed artist deal.

First implement the pure validated terms and remaining-night quote. Derived fee/rate fields on import are ignored; invalid versions, nights, asks and completed counts fail explicitly. Whole-dollar safe arithmetic and immutable inputs are required. A completed hold has zero remaining nights/fee. There is no cancellation of the active unfinished show in this scope.

The later adapter and controls must disclose terms at booking, freeze them at doors, show both exact signing cash outcomes, retain a cancellation receipt through reload, and post the fee once separately in the career journal. If the next opening is unaffordable, continuing must be refused with a clear quote; cancellation remains explicit and can leave negative cash, consistent with the existing debt/start-over career boundary. No hidden free cancellation or automatic debt charge. Older unmarked runs preserve their existing behavior. No loan, partial one-night cancellation, calendar, current-night refund or new audience simulation. Seats/lawn, separate stage accounts and source-owned venue scenes remain distinct venue slices.

Acceptance: zero/one/two remaining-night quotes, rounding and bounds, strict source replay, duplicate signing refusal in the adapter, completed-show/payout/cancellation cash conservation under both deals, reputation once at run end, no fabricated unplayed history/research, reload and player journeys including unaffordable continuation. Core-only delivery cannot close the held-run feature.

### FOH-V02b2 held-run career and controls

New multi-night Amphitheater player bookings opt into version1 only after the Book offer displays the25%-of-ask cancellation charge per unplayed night. The optional engine `runPolicy:1` freezes those terms; absent markers retain legacy behavior. At settlement, Choose next night opens Terms/Continue/Cancel/Receipt pages. Continue quotes signing cash, next opening and remaining cash. Cancel quotes remaining nights, fee and cash afterward, then the explicit Sign and cancel action ends the hold. Both actions sign the completed show once. A refused continuation displays the reason without signing or charging anything. The Menu and signed settlement can reopen the source-derived receipt.

The existing journal gains a cancellation category, with missing old archived totals interpreted as zero. History retains source cancellation terms and the completed-night count beside its frozen cash snapshot. Imported derived penalties are ignored. Cash can be negative after explicit cancellation; ordinary next-show affordability/start-over rules apply. Recovery preserves paid cash and gives a notice; it never fabricates a refund. The held-run module is precached. Short windows share the contained Equipment/Ticketing pager. Verify both deals, full continuation, one/two cancelled nights, debt, legacy saves/journals, frozen terms, reload/offline, both browser engines and phone/short layouts. No seating, stage-cost or room-scene completion is inferred.

### FOH-V02b3 independent seat and lawn sales

Current Amphitheater math fills seats first from lawn-price demand and charges seatPrice afterward. Raising the seat price therefore adds money without changing seat demand or value satisfaction. Under CT-DEC-19, replace that behavior for new marked bookings with a version1 two-zone policy: divide the act's common potential audience in proportion to seat/lawn capacity, conserving that potential at fair prices; each zone applies the existing price elasticity to its own price and fair value. Seats use act fair price plus10, lawn uses act fair price. There is no automatic transfer of unsold demand between zones. Each zone caps its own presales and later incident-affected walkups. Zone capacities add exactly to the room capacity, and ticket receipts add exactly to one show gross.

Zone satisfaction starts with the actual shared venue/service/incident score, then loses up to20 points for price above that zone's fair value (10 points per additional fair-price multiple). Prices below fair do not grant satisfaction points. The combined score is attendance-weighted; an empty zone does not depress the other zone. This is an explicit game balance rule. It neither invents zone-specific equipment nor claims slope-aware geometry: lawn slope, sightline geometry and source-owned room scenes remain mandatory later venue work.

Implement the pure strict policy, sales split and weighted satisfaction first, then a marked Amphitheater career adapter with frozen show terms, public per-zone forecasts and visible settlement receipts. New player bookings select the policy after Book discloses separate sales; absent markers preserve legacy saves/results. Both prices remain whole-dollar inputs and lock at doors. Both artist deals, held-night continuation/cancellation, journal reconciliation and repeat signing must retain exact cash. Do not silently add a separate ticket company fee, paid-seat upgrade, extra presale income or second attendance count. No guessed hidden draw in forecasts.

Acceptance: common-potential conservation at fair prices, independent price sensitivity, capped sold counts, no transfer/overselling, zero seats/lawn/attendance, presale protection under walkup loss, rounded whole-dollar gross, distinct zone satisfaction and attendance-weighted show result, strict malformed/source/overflow handling; later both-deal/public-forecast/reload/player/offline checks. The pure prerequisite cannot close the seating feature or full venue phase.

### FOH-V02b4 seating career adapter

`chooseDeal.seatingPolicy:1` marks a new Amphitheater booking. Doors freeze both prices in `show.seating`; subsequent held nights retain that contract. Only marked shows use the pure zone split and separate value scores, with common venue service quality measured from their combined actual attendance. Their weighted satisfaction drives ordinary show outcome, reputation and bar performance. One gross feeds the existing artist basis and one signing payout; the seat zone does not receive a second settlement payment. Public forecasts evaluate only the published draw range. Old unmarked careers remain numerically identical. Normalize only valid room/source terms and valid frozen prices; discard malformed optional terms with notice while preserving cash/history. A room change clears unpaid seating terms. Pilot UI and source-owned slope geometry remain separate acceptance work.

The night-accounting inspection also found a renderer/engine mismatch: playback varies the hidden draw by held-night index, but settlement reused the first draw. New marked held runs will evaluate `seed XOR night` after night1, matching the existing playback rule. Legacy unmarked runs retain prior arithmetic. Each new night still uses its own incident and a single receipt; test independent draws, fixed contract prices and replay through signing.

### FOH-V02b5 playable seating forecasts and receipts

Amphitheater Book discloses that seats and lawn sell separately; new player bookings select seatingPolicy1. Promote retains its two price controls and adds Seats and lawn. The same window is available from Menu and the settlement ticket line. Seats/Lawn/Rules pages show public draw-range forecasts before doors and each zone's actual tickets, gross and value-adjusted satisfaction only after the night. Explain common service quality, the price penalty and attendance weighting. The total Promote forecast and presale chart must use the same zone calculation. The signed sheet uses frozen prices even when an imported promotion field differs. Use the existing contained compact-window pager; test both deals, high-seat/low-lawn quotes, held nights, reload, offline and browser/viewport regression. No physical/human acceptance or slope geometry is inferred from this UI.

### FOH-V02b4 Festival stage and site accounting

The current second-stage receipt omits its production charges from cash and can add an audience beyond the site limit. Under CT-DEC-19, choose one site admission and one ticket price. Headliner demand determines the site's admissions; the opener changes the division of the admitted audience between simultaneous stages, not the number of tickets sold. Divide by the two booked acts' draw weights, bound the side stage by its declared capacity, and redistribute overflow to the other stage. Every admitted guest and prepaid ticket belongs to exactly one stage in this aggregate snapshot. This is an explicit fictional allocation, not individual migration or measured audience overlap.

First implement a pure version1 authority: validated source terms, conserved admissions/presales/receipts, stage production budgets and a combined settlement. Main production contains its rented PA (zero for a house rig), lights when selected, and two dedicated production crew at the existing staff rate. The side stage uses a medium PA, lights and two production crew: $775 at current rates. Existing site security/doors/bar staff, rental, permit, fence, amenities, ads and incident response remain shared site expenses charged once. Dedicated stage crew do not replace security or bar workers. Allocate shared eligible expenses proportionally to each stage's attendance, round the side share once and give the remainder to main; use stage capacity shares when attendance is zero. Each door act receives70% of its own positive ticket balance after its production and allocated site costs. Main guarantee/sponsor deals retain the quoted main ask; the side act takes a door deal only if eligible. No invented guaranteed ask payment to a door act.

Bar, sponsor and broadcast income remain site-only lines, outside either artist's ticket basis. Sponsor income is paid once before doors. Opening cash pays all production and shared expenses except incident response, plus any main guarantee, minus sponsorship. Signing pays gross tickets, bar and broadcast less unpaid door artists and incident response. Opening outflow plus signing income must equal final site net exactly, even for a loss. Main and side stage receipts plus site-only income must reconcile independently to that same net.

The later career adapter and player controls will opt new Festival bookings into the policy, freeze source terms at doors, show stage/main/site receipts, and reconcile signing to the career journal. Legacy unmarked saves retain their prior arithmetic. Invalid source terms recover explicitly without changing paid cash or signed history. Public forecasts use published ranges; hidden draws stay hidden before doors. Existing geometry, artist booking gates, sponsor constraints and career simulator verdicts remain separate slices; this core alone is not a playable or completed Festival phase.

Acceptance: hand-calculated receipts for both main deals and sponsorship, side-stage capacity/overflow, zero demand/capacity, prepaid conservation through walk-up loss, zero-price shows, cost allocation/rounding, exact opening/signing/net bridge, immutable inputs and strict malformed/unsafe source rejection. Repository tests/build, required CI and exact hosted module proof precede core delivery; adapter/UI/browser/offline acceptance follows separately.

### FOH-V02b5 Festival career adapter

Opt in through `chooseDeal.stagePolicy:1` only in the Festival with two distinct valid acts and a side act currently eligible for a door deal. Store optional version1 booking terms; freeze ticket price and ad spend at doors. Keep unmarked existing careers and receipts unchanged. Derive stage crowd weights from the two booked draws and terms, but derive paid site demand only from the main act, single ticket price and shared promotion. Combined attendance, services, satisfaction and broadcast remain under the existing site-quality model; per-stage sound/sightline simulation is not claimed by an accounting adapter.

Include both stages' production in the opening quote and affordability gate. Keep the existing incident response payment when the player chooses it. The pure settlement's payout subtracts incident expense; the career signing payout adds that already-paid expense back, so opening plus response plus signing reconcile to net without charging response twice. Both artist relationships change once when the site is signed; the main act uses its own pay and the side act uses its own quoted ask/pay. One site history row records combined attendance/net and total artist pay. Frozen show terms and valid booking sources reproduce the signed receipt after reload; malformed optional policy recovers with an explicit notice while preserving cash/history. A fresh booking drops the marker until explicitly selected.

Public stage forecasts evaluate all published main/side draw-range corners and expose stage min/max attendance without reading the seed. Source policy validation rejects wrong room, duplicate/missing act and unsafe price/ad input, ignores derived totals and never applies a charge while loading. Verify all three main deals, legacy parity, opening affordability, immediate incident cash, one-time signing/journal, both relationships, source recovery, frozen promotion, next-show/room isolation and seed-independent public ranges. The following player-control slice will disclose the policy at booking and present separate stage/site receipts; this adapter does not silently opt existing players in.

### FOH-V02b6 Playable Festival bill and receipts

New Festival player bookings use version1 stage accounting after Book discloses a single site ticket and separate production. Stage bill opens the existing contained window. Its Bill page lets the player select an eligible prior-tier door act before booking; default to the eligible act with the largest published draw. Never silently put a guarantee-only or soured act on a door deal. If none qualify, explain the constraint and leave venue changes available. Main offers and their guarantee/sponsor rules remain visible. Changing the side act costs nothing, persists and freezes its quoted terms only when the main booking is made.

Main and Side pages show the booked act and public attendance ranges in Promote, then actual audience, ticket allocation, own production, allocated site costs, artist basis/pay and stage balance after the show. Site shows the single ticket total, shared bar/sponsor/broadcast income and the exact opening/response/signing cash bridge. Rules explain that an opener redistributes site audience without creating extra admissions; stage ranges are independent bounds, not simultaneously promised outcomes. Bill choices lock after booking; reopening a receipt cannot charge or alter the contract.

The ordinary settlement must also reconcile: include main production crew and side production costs, frozen ticket price, total pay for both artists, main door basis from its own stage, and a link to the detailed stage/site accounts. Avoid a second ticket-income line. Update the next Festival's minimum opening quote for the two extra stage budgets now used by player bookings. Extend the existing compact content pager and text probe. Use the same tabs, focus, keyboard, theme and no-scroll behavior as Equipment and Seats and lawn.

Verify fresh player booking/side choice, both legal main deals, public forecasts and seed independence, prices/ads frozen at doors, paid incidents, exact receipts/cash/journal, signed reopen, next-show reset and warmed-cache offline continuation. Run Chromium/WebKit desktop/phone/short layouts, both themes and five viewport sizes; inspect real full-page screenshots and the supplied action client. Retain prior venue/browser regressions. Per-stage sound/sightline simulation, sponsor constraints, headliner relationship gates, terrain and physical/human acceptance remain separate phase work.

### FOH-V02b7 Festival booking constraints

Phase7 requires a sponsor condition and an earned path for earlier-tier headliners. Under CT-DEC-19, choose a visible fixed-price sponsor contract: new player Festival sponsor bookings keep the main act's usual ticket price. Sponsorship still pays the existing amount once before doors. Store an optional version1 Festival booking policy and freeze it with the show; older unmarked sponsor shows retain their earlier price freedom. Reject conflicting price edits and opening until the contract is satisfied. The price control is locked and labeled; Book, Promote and the accepted Bill explain the condition. Guarantee and door prices remain adjustable.

Paper Voltage and North Kettle are the native Festival headliners. Earlier-tier acts become eligible for a main-stage offer only at relationship20, the game's established loyal-act level; their draw and ask do not become Festival-scale automatically. Eligible offers and next-show affordability use the same roster. Earlier acts may still open when their door terms permit. If the selected side act is also a main offer, disable that main booking with a clear instruction to choose another side act; never silently replace the selected bill. Already-booked shows keep their terms even if a relationship subsequently falls. With no willing side act, return to venue selection free even below the Festival opening minimum; opening elsewhere still checks its real cost.

Policy source is validated and frozen separately from derived money. Invalid optional source produces recovery feedback without changing paid cash or signed history. No new sponsor brand, external money, multiple sponsor packages or artificial audience bonus. Verify threshold below/at/above, native headliners, unchanged draws, deterministic offers, same-act refusal, quoted next-show minimum, fixed sponsor price before/after reload, one-time sponsorship/journal and legacy unmarked compatibility. Exercise actual sponsor and guarantee controls and repeat Festival/seating/browser regressions. Venue geometry, quality capacity and career simulator acceptance remain separate work.

### FOH-V02b8 Amphitheater sound and slope

A controlled source diagnostic at the starter layout, usual prices and best incident response produced satisfaction37–43 across30 Amphitheater seeds: the room's700-person capacity inherits a250-person medium-PA allowance and flat Lot sightlines. This is not a career verdict. Under CT-DEC-19, make new Amphitheater bookings use an explicit version1 room profile: the rental includes a shell system covering700 guests; a placed small/medium portable PA deliberately replaces that system with its existing100/250 coverage. Costs and venue capacity do not change. Explain the replacement in Build and the room profile; never disguise a portable rig as the house system.

The same marked profile gives the lawn an authored rise between rows10 and16 (0.18 logical height units per tile), a120-degree viewing cone and a40-tile range. Sightlines run in three dimensions between the performer's head above the stage and each guest's eye on the terrain. A prop blocks only where its top intersects that line. The shell's front apron and rear concourse remain level. Coordinates are logical game units under the existing provisional authoring convention, not calibrated venue measurements. The permanent slope stays in venue coordinates when the stage rotates; moving the stage does not move the hill. The board's clear/blocked overlay must use exactly the settlement calculation. Dimensional scene artwork follows as separate required work; this slice must not call a flat backdrop a finished Amphitheater.

Flow: Book discloses the included shell rig and sloped sightlines → Build shows the current sound capacity and links from Details to the Room tab, with house/portable status, viewing counts and slope rules → Promote and signed settlement reopen it through Seats and lawn. New player bookings opt in through `chooseDeal.roomPolicy:1`; store only `venue.profile:{version:1}`. It remains frozen through a held run because layout changes are already locked at doors. Existing unmarked bookings and saves retain their earlier numeric rules. Invalid optional profile source is removed with visible recovery feedback, preserving paid cash/history. No terrain editor, engineering calculation, PA purchase, new capacity, extra setup fee, final art claim or Festival rig substitution.

Verify an exact terrain/obstacle visibility fixture, four stage rotations, flat-versus-rising obstruction, invalid profile handling, bounds, no input mutation, house versus portable/owned sound coverage, identical money deductions, marked/unmarked reload, two/three-night settlement/reputation, clear-view overlay parity and honest pre-show/paid receipts. Run player journeys in both browsers, both themes and compact viewports, existing seating/held controls, offline replay, all tests/build/docs and the unchanged Lot baseline. Then extend the larger-venue diagnostic without claiming full career-balance acceptance.

### FOH-P01j — Reuse camera fit while panning

**Problem:** Orbit-camera pan, target and zoom operations rerun the24-step volume-fit search although the projection's yaw, pitch, viewport and free HUD area have not changed. This adds avoidable synchronous work to camera input.

**Bounded fix:** Cache only the last unzoomed fit distance, keyed by all fit inputs. Recompute after yaw, pitch, viewport, free-area or camera-lens changes. Apply the existing pose after every input; authored FOH/Stage views retain their existing path. No render-quality, layout, save, simulation or interaction change.

**Acceptance:** Compare exact poses, projections, picking and navigation against the prior source across all venues, resizing, presets, low pitch, zoom and pan. Exercise actual camera gestures, recovery and complete-show parity. Report repeated camera CPU measurements separately from native full-HUD fixed/moving windows; a faster helper alone cannot close KI-14 or establish low-power/human acceptance.

### FOH-V02b9 Festival sound and sightlines

The Festival currently inherits a 250-person house PA and Lot viewing range despite its 6,000-person permit. Under CT-DEC-19, extend the version1 room profile to Split Acre: an included Main system covers3,000, with the existing light requirement,120-degree viewing cone,60-tile range and a2.38-unit performer height above a flat site. Heights are authored game units, not physical engineering. Existing portable S/M rigs replace the house rig at their established coverage and charges. Rent, permit, admission capacity, stage accounting and artist terms stay unchanged. This deliberate half-permit base leaves useful headroom for a later spatial delay-tower slice; it does not certify whole-site sound or career balance.

New player Festival bookings select `roomPolicy:1` alongside their stage and sponsor policies. Store only `venue.profile:{version:1}`; the venue ID resolves immutable source terms. Existing unmarked saves keep earlier math. Reject unsupported venues/versions and recover malformed optional markers with a notice while preserving paid cash/history. Layout remains frozen after doors; camera, page and theme cannot change receipts. Stage accounts continue their explicit shared-site quality model; this slice does not claim independently simulated stage coverage.

Book discloses the included rig; Build exposes its current capacity and a Sound and views report. The existing Stage accounts window gains a Room page with system, sound/room capacities, clear/blocked tiles and the same source-backed rules. Promote, Show and settlement reopen the same report. Use the existing compact pager and text probe; fix venue-specific wording and menu labels so the Festival never describes its flat site as a shell or seating lawn.

Acceptance: hand-checked flat-height obstruction and stage orientation, included versus portable sound/cost, unchanged capacity/admissions/costs across matched profile and legacy inputs, stage/site cash and journal conservation, sponsor/guarantee/door settlement and checkpoint replay, derived imported-field rejection, old unmarked receipt parity, profile removal on room change, actual Room controls in both browsers/themes/compact viewports, exact overlay counts, paid receipt reload and warmed-cache offline continuation. Delay towers, VIP deck, bus compound, separate side-stage geometry, dimensional art and full career acceptance follow as independent bounded work.

### FOH-V02b10 Spatial Festival delays

A3,000-person Main system cannot cover a full6,000-person day. Add at most two Festival-only delay towers, each with a1×1 footprint,8kW draw,4-unit viewing obstruction and a12-tile omnidirectional game coverage radius. Each show pays600 rental plus75 operator per tower as main-stage production. No purchase, extra admissions, free staff, physical acoustics calculation or independent side-stage mix is implied.

Use the version1 Festival room profile. Allocate the existing base capacity to the nearest open floor cells to the stage front, with deterministic distance/row/column ordering. A tower adds coverage only for open cells outside that base set and within its radius; union both towers' cells so overlaps count once. Extra supply is newly covered tiles times site density, with extra supply stopping at actual venue capacity while preserving the included base allowance. Placed portable PA disables all delay benefit; towers still occupy space, block sightlines, draw power and incur their quoted show cost. Baseline shows without towers retain exactly the preceding sound-capacity values. Layout rotation moves tower footprints but does not change an omnidirectional radius.

Build adds an accessible Delay tool (D), code-owned provisional tower geometry and quoted cost; normal select/remove/undo remain available. Room reporting adds a Delay page exposing tower count, additional covered tiles, total sound capacity and full recurring delay charge. The same report is available from Stage accounts; the main production receipt and ordinary settlement itemize the cost exactly once. Save only ordinary layout entries; normalized source reconstructs coverage and money. Festival layout caches may retain towers across room switches; new player bookings select the room profile before Build. Unmarked legacy layouts without towers remain unchanged; imported towers without a valid profile get no coverage bonus, with the inactive state disclosed. Existing paid layouts remain locked.

Acceptance: hand-checked coverage edges, deterministic base allocation, overlap union, occupied-cell exclusion, capacity cap, rotations, portable disablement and unchanged zero-tower fixtures; invalid counts/placements/other rooms; exact opening/main-production/site-net/journal reconciliation for guarantee/sponsor/door, paid reload and frozen layouts; actual tool/placement/undo, readable inactive state, two themes/desktop/phone/compact pages and offline receipt parity. Document code-art origin and provisional status. VIP deck, bus compound, source-owned venue scenes and full career simulation remain the next work.

### FOH-L01a — Player guide and acceptance evidence

The stable playable loop now has enough verified controls for a concise player guide. Document booking through signing, room-specific controls, representative crowds, optional preview navigation, save export/import and warmed-cache offline limits against current source and observed journeys. Publish the complete frozen native camera comparison and retain its limitations. This slice adds no runtime, save or simulation behavior. Acceptance requires accurate labels and links, a current-source review, generated references/catalog parity and normal repository delivery; human art/device acceptance and public promotion remain separate.

### FOH-V02r4 — Delay tower preview correction

The Festival Delay tool currently appears as a generic gate in the optional 3D preview. Add an independently authored mast and speaker cluster within the existing one-cell footprint, matching the four-logical-unit obstacle height. Record it separately from Lot-only samples in the asset manifest. Preserve placement, rotation, selection, undo, saves, coverage and charges. Acceptance: measured rotated bounds, picking the elevated speaker instead of the floor behind it, desktop/phone views, context recovery and unchanged saved-show settlement. This is technical geometry; physical scale and final art acceptance remain separate.

The picking journey also reproduces a touch click retargeted onto the inspection dialog opened during pointerup. Its backdrop can close it immediately, or the click can reach a newly exposed control. Consume that gesture's compatibility click at document capture; a new pointer press resets suppression before ordinary UI interaction. Verify a persistent inspection window, exact selected coordinates, a working subsequent Close tap and unchanged placement/orbit gestures. Keyboard activation remains independent.
