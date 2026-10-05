# Lot renderer performance evidence

Measured 2026-10-04. **Available-host diagnostic, not completed FOH-P01 or device acceptance.** All 18 measurement windows were valid. Mean cadence ranged 59.77–60.00 fps; 3 frame intervals exceeded 50 ms and are retained below. No statistical threshold has been adopted from these results.

## Reproduce

Run `npm run perf:front-of-house -- --gpu=metal` on a compatible Metal host. Set `FRONT_OF_HOUSE_PERF_OUTPUT` to a private output directory; omission creates a temporary directory. The default command requests SwiftShader explicitly, matching the existing browser test backend. `--gpu=default` records the browser-selected backend. Always inspect the recorded WebGL renderer. `--quick` uses 1 s warm-up / 2 s sampling / one repeat and is **harness validation only**.

Close this task's other test browsers and stop local tests/builds before timing. The harness uses isolated loopback pages, fresh contexts and blocked service workers; it does not load production storage. It refuses a nonempty output directory and bounds the timed browser operation with a wall-clock deadline. An incomplete window records its failure and the absence of a complete raw sample. It records every attempted run, including failures, and exits unsuccessfully if a window loses visibility, resizes, loses context, mutates the scene or raises a browser error. Raw arrays, fixtures and review screenshots stay private. The [public summary](../performance/2026-10-04-metal.json) preserves all timing statistics, source/fixture hashes and raw artifact digests.

## Scope and environment

- Runtime source: `15a576a12810d489732a497168ffd8509d591ea7`; dependency lock and individual source digests are in the summary. The exact measured harness is frozen in [19f9de3](https://github.com/DaveHomeAssist/mixmash/tree/19f9de331e86e51921d4bd465ec4334df5b1b21f). It was uncommitted during measurement, so the recorded worktree is dirty; all measured source bytes are identified by SHA-256. The later deadline and output-preservation guards do not change the camera path or reporting math.
- Host: Mac16,12, Apple M4, 10 CPU cores, 16 GiB, macOS 27.0.1 (26A434), arm64; AC power, observed low-power mode 0. Chromium 149.0.7827.55, headless, explicit `--use-angle=metal`; WebGL reports `ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)`.
- This uses the host's Apple GPU. Physical display refresh, native viewport, thermal behavior, sustained battery use, supported low-power devices and human input/readability remain unmeasured. Other host load was uncontrolled; load averages are recorded per run. No concurrent local build/test/browser work was launched during these windows.
- Renderer-only scene submission, excluding the application HUD, browser UI and show action processing. There is one final render per frame: existing pause/setCamera/draw/resume operations batch camera and scene updates. CPU submission includes that work and does not measure GPU completion. GPU timestamp samples were not collected; extension support is recorded separately in the private raw diagnostics. `coldLoadMs` covers navigation/import/first synchronous draw, not time to a visible frame.
- 10 s warm-up, at least 30 s sampling, three runs for each scene at 1440×900, 375×812 and 2560×720. Requested and effective DPR 1; backing sizes equal those CSS dimensions. Shadows: 1024 PCFSoft; antialiasing on, motion on, no adaptive quality.
- Frozen production seed 170 / Sodium Arcade / door fixtures: E is empty Build; C uses STARTER_LAYOUT, price 20, social/radio 150 each, 150 logical and rendered guests, medium PA, lights and PA dropout. Only cosmetic time advances. Engine state and scene inputs stay unchanged. See the [full protocol](FEATURE_BRIEFS.md#reproducible-measurement-procedure).
- Camera: 0–10 s full yaw at pitch45/zoom1; 10–20 s yaw37 and zoom1→3→1; 20–30 s yaw135 and pitch15→85→15. Target remains (12,8). Named views, reduced motion and context recovery are covered separately by browser smoke, outside timed windows.

## Every run

All timings are milliseconds. Percentiles use nearest rank. Cadence is 1000 / mean RAF interval; it is not GPU render FPS. Stall columns retain count / full interval sum / excess over 50 ms. Reporting bins above16.7, above33.3 and above50 are descriptive, not pass limits. CPU `elapsedMs` in the JSON is accumulated submission time, not wall time.

| Run | Samples / seconds | Mean cadence fps | RAF p50 / p95 / p99 / max | CPU p50 / p95 / p99 | Stalls count / full / excess | Long tasks |
| --- | --- | --- | --- | --- | --- | --- |
| 1440x900-empty-1 | 1800 / 30.00 | 60.00 | 16.70 / 17.60 / 17.60 / 17.70 | 0.40 / 0.60 / 0.80 | 0 / 0.00 / 0.00 | 0 |
| 1440x900-empty-2 | 1800 / 30.00 | 60.00 | 16.70 / 17.60 / 17.60 / 18.10 | 0.40 / 0.60 / 0.90 | 0 / 0.00 / 0.00 | 0 |
| 1440x900-empty-3 | 1793 / 30.00 | 59.77 | 16.70 / 17.50 / 17.70 / 66.80 | 0.40 / 0.70 / 1.20 | 2 / 133.50 / 33.50 | 0 |
| 1440x900-crowd-1 | 1801 / 30.02 | 60.00 | 16.70 / 17.40 / 17.70 / 17.80 | 1.30 / 2.50 / 3.20 | 0 / 0.00 / 0.00 | 0 |
| 1440x900-crowd-2 | 1801 / 30.02 | 60.00 | 16.70 / 17.70 / 17.70 / 17.80 | 1.00 / 1.80 / 2.30 | 0 / 0.00 / 0.00 | 0 |
| 1440x900-crowd-3 | 1801 / 30.02 | 60.00 | 16.70 / 17.70 / 17.70 / 17.80 | 1.20 / 2.00 / 2.50 | 0 / 0.00 / 0.00 | 0 |
| 375x812-empty-1 | 1801 / 30.02 | 60.00 | 16.70 / 17.70 / 17.70 / 17.80 | 0.30 / 0.60 / 0.70 | 0 / 0.00 / 0.00 | 0 |
| 375x812-empty-2 | 1798 / 30.02 | 59.90 | 16.70 / 17.60 / 17.70 / 34.30 | 0.40 / 1.00 / 2.00 | 0 / 0.00 / 0.00 | 0 |
| 375x812-empty-3 | 1794 / 30.00 | 59.80 | 16.70 / 17.60 / 17.70 / 67.10 | 0.40 / 0.60 / 1.00 | 1 / 67.10 / 17.10 | 0 |
| 375x812-crowd-1 | 1801 / 30.02 | 60.00 | 16.70 / 17.60 / 17.70 / 17.80 | 1.00 / 1.90 / 2.40 | 0 / 0.00 / 0.00 | 0 |
| 375x812-crowd-2 | 1801 / 30.02 | 60.00 | 16.70 / 17.60 / 17.70 / 17.80 | 1.10 / 2.20 / 2.70 | 0 / 0.00 / 0.00 | 0 |
| 375x812-crowd-3 | 1801 / 30.02 | 60.00 | 16.70 / 17.60 / 17.70 / 17.70 | 1.60 / 2.40 / 2.90 | 0 / 0.00 / 0.00 | 0 |
| 2560x720-empty-1 | 1799 / 30.02 | 59.93 | 16.70 / 17.60 / 17.70 / 50.00 | 0.30 / 0.50 / 0.70 | 0 / 0.00 / 0.00 | 0 |
| 2560x720-empty-2 | 1801 / 30.02 | 60.00 | 16.70 / 17.60 / 17.70 / 17.80 | 0.30 / 0.60 / 0.80 | 0 / 0.00 / 0.00 | 0 |
| 2560x720-empty-3 | 1801 / 30.02 | 60.00 | 16.70 / 17.60 / 17.70 / 17.70 | 0.40 / 0.70 / 1.20 | 0 / 0.00 / 0.00 | 0 |
| 2560x720-crowd-1 | 1801 / 30.02 | 60.00 | 16.70 / 17.60 / 17.70 / 17.70 | 1.30 / 2.10 / 2.70 | 0 / 0.00 / 0.00 | 0 |
| 2560x720-crowd-2 | 1799 / 30.00 | 59.97 | 16.70 / 17.60 / 17.70 / 34.10 | 1.20 / 2.50 / 3.50 | 0 / 0.00 / 0.00 | 0 |
| 2560x720-crowd-3 | 1801 / 30.02 | 60.00 | 16.70 / 17.60 / 17.70 / 17.70 | 1.40 / 2.30 / 2.80 | 0 / 0.00 / 0.00 | 0 |

## Interpretation and remaining work

The same six **short harness-validation** scenes under SwiftShader showed severe crowd slowdown (roughly 0.8–1.4 fps during those short camera segments), while CPU submission stayed in single-digit milliseconds. Those short samples are not comparable full baselines, but they establish why a software backend cannot stand in for hardware acceptance. No quality setting or acceptance gate was weakened to improve these numbers.

At the end of the populated Metal runs the renderer reports 165 draw calls and 290,610 triangles, including the render passes. Guests are instanced; render cost is still a target for optimization. Required next evidence: full HUD/game measurements, CI runner baselines and explicit regression limits, reduced-cost/fallback behavior, requested DPR2/native resolutions, and physical desktop/low-power/human acceptance. The accepted targets remain 60fps desktop and 30fps low-power.

## Static shadow reuse

The next renderer revision retains the 1024 PCFSoft shadow map while the camera moves around an unchanged scene. Layout or guest-pose changes invalidate it; pause/hidden states retain pending work and context restoration rebuilds it. Rain and overlays do not cast shadows. Geometry, materials, resolution and motion are unchanged.

Backend diagnostics expose cumulative renderedFrames and shadowUpdates. They count completed renderer calls and requested shadow refreshes respectively; they are not frame-time or GPU timestamp measurements. Per-frame draw calls can now differ between a reused-map frame and a refreshed-map frame, so compare scenes and shadow-refresh status explicitly. The 18-run table above remains the original uncached revision; it must not be relabeled as optimized measurements.

The candidate comparison at a6b1767 was interrupted after seven valid windows (six desktop, one phone empty); the eighth window did not finish. Its output and interruption record are retained separately. It is a partial diagnostic, not a completed optimized baseline. The subsequent queue integration tracks actual instanced transform-buffer versions, so paused queue changes and a worker moving with zero guests also invalidate shadows. Its backend, full-game and service-crowd rails pass without changing numeric outcomes.

## Integrated shadow reuse: complete comparison

All 18 windows at source `daebe36edd24fe09106286778bdcd16949dfb555` completed with unchanged fixture hashes, DPR 1 and the same Metal protocol. [Every candidate run](../performance/2026-10-04-shadow.json) is retained with raw/source digests. Mean frame cadence ranged 60.00–60.00 Hz; 0 intervals exceeded 50 ms. These are available-host renderer diagnostics, excluding full HUD, physical display and low-power acceptance.

| Scene | Original CPU p95 range across three runs (ms) | Candidate CPU p95 range (ms) | Shadow refreshes / rendered frames, whole context |
| --- | --- | --- | --- |
| 1440x900 empty | 0.60–0.70 | 0.40–0.40 | 2/2407, 2/2408, 2/2408 |
| 1440x900 crowd | 1.80–2.50 | 1.90–3.30 | 2406/2408, 2406/2408, 2406/2408 |
| 375x812 empty | 0.60–1.00 | 0.40–0.50 | 2/2407, 2/2407, 2/2407 |
| 375x812 crowd | 1.90–2.40 | 0.70–2.90 | 2405/2407, 2405/2407, 2405/2407 |
| 2560x720 empty | 0.50–0.70 | 0.40–0.50 | 2/2406, 2/2406, 2/2406 |
| 2560x720 crowd | 2.10–2.50 | 3.00–3.60 | 2406/2408, 2405/2407, 2405/2407 |

Counters include initial draws and warm-up; timing percentiles cover the separate 30-second sample. The static scene reuses its shadow map; moving crowd poses still refresh it. The two implementations ran at different times on a shared host with uncontrolled background load, so CPU variation is descriptive and cannot be assigned solely to caching. The empty fixture has no rented props; populated static-frame render-work reduction is independently covered by the backend regression test. The interrupted a6b1767 attempt remains a separate partial record, not a discarded failure or a completed baseline. The original table is unchanged.

## Classic floor cache and full HUD protocol

The classic board retains one backing-sized floor image plus the post-prop sightline buckets. Room, floor, layout, pillars, decoded sprites, sight sets, camera transform and backing size invalidate it; crowd, lights, incidents and controls remain dynamic. Failure to obtain the offscreen context falls back to direct drawing, and disposal releases the backing. The six-megapixel DPR rule is unchanged.

`npm run smoke:front-of-house-floor` checks exact cached/direct pixels in Chromium and WebKit across all rooms, rotations, overlays, camera changes, dynamic effects and responsive backing dimensions. Chromium uses a constant software raster path for repeated pixel readback, because its automatic GPU-to-CPU switch otherwise changes antialiasing midway. Normal application rails separately use their usual contexts and verify picking, saves and settlement. This is pixel and behavior evidence, not GPU or device acceptance.

`npm run perf:front-of-house-hud` measures the actual classic client, full HUD and real running service clock at 1920×1080, requested DPR 2 (effective 1.5 under the existing rule). Seed 170 uses the current client’s flow-version-1 show and starts at minute 25, safely before its minute-112 incident. It compares fixed zoom 2 with a continuous ten-second middle-drag cycle, direct versus cached floors, with 10 seconds warm-up, 30 seconds sampling and three repeats per combination. Repeat order alternates to reduce systematic order bias; shared-host load remains uncontrolled. A browser-only module response sets the direct control's supported `cacheFloor` default false; both source hashes are recorded. Saves, module source files and deployed configuration are not modified by the harness.

A new empty private output directory is required through `FRONT_OF_HOUSE_HUD_OUTPUT`. Each run preserves raw frame intervals, source/fixture hashes, real minute progression, before/after screenshots, errors, long tasks, canvas dimensions and cache counters. Hidden/resized pages, a stopped show or script errors invalidate a run. `--quick` uses one-second warm-up and two-second samples for harness validation only; its four completed windows are not the full comparison. RAF cadence is not GPU completion or total client CPU duration. The full measurement and delivery results will be recorded separately.

The first full-HUD attempt at d080da8 was stopped during counter review: unsupported continuous zoom values returned the classic camera to Fit, so its moving-labeled windows cannot support motion claims. Original samples are retained privately as an invalid comparison. The corrected harness drives the real middle-drag handler and requires camera coordinates to change on over 95% of measured frames (zero in the fixed control). This is a harness validity assertion, not a performance acceptance threshold.

## Full HUD floor comparison: completed windows

All 12 windows at source `2a00f7a444503bbadeda3939f4b7b46d9b8bafc3` are valid. [Every repeated result](../performance/2026-10-04-floor.json) records the original report, fixture, source and raw digests. These are the real classic client and HUD at 1920×1080, browser DPR 2 and effective DPR 1.5, running the seed-170 service show from minute 25. Initial setup/screenshots and final inspection are outside timing. Each fresh context uses 10 seconds warm-up and 30 seconds measurement; direct/cached order alternates between repeats.

| Camera / floor | Observed cadence range (Hz) | Frame interval p95 range (ms) | Intervals >50 ms, all three runs | Floor builds / reuses, after setup including warm-up |
| --- | --- | --- | --- | --- |
| fixed / direct | 60.00–60.00 | 18.30–18.60 | 0 | 0/0, 0/0, 0/0 |
| fixed / cached | 60.00–60.00 | 18.50–18.50 | 0 | 0/2442, 0/2442, 0/2442 |
| moving / direct | 60.00–60.00 | 18.50–18.50 | 0 | 0/0, 0/0, 0/0 |
| moving / cached | 59.80–60.00 | 18.50–18.50 | 0 | 2403/2446, 2404/2447, 2397/2442 |

RAF cadence measures callback scheduling, not completed GPU frames or display smoothness on a physical device. No total client CPU duration was inferred. Cache counters describe work across warm-up plus measurement; frame statistics describe only the timed sample. The fixed camera can reuse its floor, while camera movement rebuilds it. The direct control paints the floor on every draw and therefore has no cache builds or reuses. Similar cadence at the host ceiling does not prove a frame-rate improvement; there are no new device or CI timing acceptance limits. Shared-host load is uncontrolled and recorded.

Camera-change counters include the initial sampling callback; frame intervals begin at the following callback. This one-callback difference does not replace the continuous-motion validity check.

The 2a00f7a comparison predates the food-control merge ffcd59f. Later integration preserves the cache and is tested separately, including a placed food stall in pixel/picking parity. The original measurements are not relabeled as a later source revision.

## 3D backing resolution rule

FOH-P01d applies the existing HUD section 6 rule to the optional 3D backend: clamp density to 1–2, then limit it to 1.5 if CSS width × height × clamped density² exceeds 6,000,000. A 1920×1080 canvas at requested DPR2 now allocates 2880×1620; a 375×812 canvas retains 750×1624. This reduces large-screen rendering resolution intentionally. It is not a strict six-megapixel ceiling: 5120×1440 at effective1.5 still allocates 7680×2160.

`npm run smoke:front-of-house-resolution` checks actual canvas and WebGL buffer dimensions, threshold boundaries, phone/desktop/ultrawide resize, explicit DPR1, invalid overrides, CSS-coordinate tile/object picking, context restoration and disposal. Browser density changes rearm one media listener; an actual render also detects changed density. Chromium CDP updates density/media matches without reliably delivering the media event, so the test separately uses real density emulation with redraw detection and explicit media-event dispatch. This is not a physical monitor transition test. The complete application test uses requested DPR2, asserts the desktop backing size and compares classic/3D settlement after controls, recovery and reload.

Earlier DPR1 renderer measurements and the classic full-HUD comparison retain their original source, quality and timing attribution. These new correctness checks are not a fresh performance baseline, supported-device qualification or human readability acceptance. Geometry, shadow quality, service/engine rules and saves remain unchanged. PR78 passed CI 37203818090 and merged at `36bbbf3977cfdb035f86d3268d246ab92726d25d`; Pages built 2026-10-04T13:13:51Z. Eight deployed source files match. Hosted resolution/lifecycle and complete DPR2 client gesture/reload/settlement checks pass. Physical display acceptance remains separate.

## Completed high-density Metal diagnostic

All 18 windows at frozen clean source `5532852dc66c50606c1e76ff74c4ea89dba12574` are valid. [Every repeated result](../performance/2026-10-04-density.json) retains source, fixture, original-report and raw-sample digests. Same available Mac16,12 / Apple M4 / 16 GiB / macOS 27.0.1 (26A434), Chromium 149.0.7827.55 with verified Apple Metal rendering, requested DPR2. Effective density is 1.5 at 1920×1080 and 5120×1440, and 2 at 375×812; actual backings are 2880×1620, 7680×2160 and 750×1624 respectively.

This is the isolated renderer with unchanged empty/150-guest fixtures, camera path, 10s warm-up, 30s sampling, three repeats and 1024 PCFSoft shadows. The private harness copy changes the original procedure only to requested DPR2, these three viewports and local import/source-hash locations; its exact digest is retained. The public harness now exposes the same settings as `npm run perf:front-of-house -- --gpu=metal --dpr=2 --large-viewports`. That reproduction interface was added after measurement; the measured source and private harness remain attributed separately. `--quick` only validates the harness.

| Window | Effective DPR | Cadence (Hz) | RAF p95 / p99 / max (ms) | CPU submission p95 (ms) | Intervals >50 ms |
| --- | --- | --- | --- | --- | --- |
| 1920x1080-empty-1 | 1.5 | 60.00 | 18.60 / 18.70 / 18.80 | 0.50 | 0 |
| 1920x1080-empty-2 | 1.5 | 60.00 | 18.60 / 18.70 / 18.70 | 0.40 | 0 |
| 1920x1080-empty-3 | 1.5 | 60.00 | 18.60 / 18.70 / 18.70 | 0.50 | 0 |
| 1920x1080-crowd-1 | 1.5 | 60.00 | 18.60 / 18.70 / 18.70 | 2.20 | 0 |
| 1920x1080-crowd-2 | 1.5 | 60.00 | 18.60 / 18.70 / 18.70 | 2.60 | 0 |
| 1920x1080-crowd-3 | 1.5 | 60.00 | 18.60 / 18.70 / 18.70 | 2.20 | 0 |
| 375x812-empty-1 | 2 | 60.00 | 18.50 / 18.70 / 18.70 | 0.50 | 0 |
| 375x812-empty-2 | 2 | 60.00 | 18.50 / 18.60 / 18.70 | 0.40 | 0 |
| 375x812-empty-3 | 2 | 60.00 | 18.50 / 18.60 / 18.70 | 0.50 | 0 |
| 375x812-crowd-1 | 2 | 60.00 | 18.50 / 18.60 / 19.60 | 2.20 | 0 |
| 375x812-crowd-2 | 2 | 60.00 | 18.50 / 18.60 / 18.70 | 1.90 | 0 |
| 375x812-crowd-3 | 2 | 60.00 | 18.50 / 18.60 / 18.70 | 2.00 | 0 |
| 5120x1440-empty-1 | 1.5 | 60.00 | 18.50 / 18.60 / 19.00 | 0.50 | 0 |
| 5120x1440-empty-2 | 1.5 | 60.00 | 18.50 / 18.60 / 18.70 | 0.50 | 0 |
| 5120x1440-empty-3 | 1.5 | 60.00 | 18.50 / 18.60 / 18.70 | 0.50 | 0 |
| 5120x1440-crowd-1 | 1.5 | 59.30 | 18.50 / 32.20 / 35.20 | 3.00 | 0 |
| 5120x1440-crowd-2 | 1.5 | 59.37 | 18.50 / 32.00 / 35.10 | 3.00 | 0 |
| 5120x1440-crowd-3 | 1.5 | 59.20 | 18.50 / 33.20 / 35.10 | 3.00 | 0 |

Cadence ranges 59.20–60.00 Hz; no interval exceeds 50 ms. The populated ultrawide repeats are about 59.2–59.4 Hz and are retained without rounding away their deviation. RAF cadence is scheduling evidence, not completed GPU frames, physical display smoothness or a performance guarantee. CPU submission excludes GPU completion. Other host load remains uncontrolled and recorded; no other local tests/builds/browser checks from this task ran during timing. Full-HUD evidence remains the separate classic comparison; low-power hardware, thermal/battery behavior, physical monitor transitions, human readability and declared CI timing limits remain open.

## CI calibration

The existing CI workflow exposes an explicit `foh_performance` manual input. Its separate `foh-performance` job uses Ubuntu 24.04, Node22 and Playwright's Chromium/SwiftShader to run the complete standard DPR1 renderer protocol. Invoke the existing workflow with `gh workflow run ci.yml --ref codex/foh-ci-calibration -f foh_performance=true` for the original calibration; subsequent calibration uses `--ref gh-pages`. Ordinary PR correctness jobs remain unchanged, and this adds no schedule.

Expect at least twelve minutes of sampling plus setup, with a 35-minute job timeout. The JSON report records an allowlist of runner class/OS/architecture/image version and run/attempt IDs. An always-run artifact step retains the report, public synthetic fixtures and returned raw JSON samples for thirty days, including failed-window evidence when available. It uploads no private local measurement directory or browser profile. Whole-job interruption can prevent the final artifact step; the run's logs remain the source for that failure.

Download the named artifact, verify its source and raw/fixture digests and inspect every repeat before adopting limits. The calibration job currently rejects invalid measurement windows; it does not impose a speed threshold or prove the 60fps/30fps physical-device targets. A subsequent regression gate must name the calibrated runner/browser/scene class and demonstrate failure with an intentional slowdown. The completed calibration is recorded below; timing limits remain a separate gate.

## Completed GitHub runner calibration

All 18 full windows at clean source `6ed7b7c2991ef0d8ccc71fe167444f5422cd7483` are valid. [Run 37205343575](https://github.com/DaveHomeAssist/mixmash/actions/runs/37205343575) passed both calibration and normal correctness jobs. The downloaded JSON artifact (ID11305185297, thirty-day retention) was audited against every source/fixture/raw digest and recomputed statistics. [Every repeat](../performance/2026-10-04-ci.json) is retained in the public summary.

Runner: Ubuntu24.04 image20260927.320.1, Linux x64, four logical AMD EPYC7763 CPUs, approximately16GiB; Chromium149.0.7827.55, verified SwiftShader. Standard three viewports, requested DPR1, empty/150-guest scenes, three repeats,10s warm-up/30s sampling. Empty cadence ranges10.68–54.74Hz and crowd cadence1.91–3.06Hz. Large software-rendered frame intervals are retained, not treated as hardware performance. Valid measurements do not mean the software backend meets60fps.

[PR82](https://github.com/DaveHomeAssist/mixmash/pull/82) passed required CI37205357305 and merged at `431cec064f4219c09abbfd25e0557920df59ef5c`; Pages built13:41:30Z. Deployed harness, procedure and brief match. [PR81](https://github.com/DaveHomeAssist/mixmash/pull/81) separately delivered the high-density evidence after CI37205050774, mergebc5ed37 and Pages13:35:36Z, with four live files verified.

## Native visible desktop measurement

Six complete renderer windows at the same clean6ed7b7c source use installed Chrome154.0.8037.97 in a visible, focused, isolated window on the available Apple M4 host. Actual content size5120×1286, DPR1 and equal backing dimensions; three empty and three crowd repeats, same full protocol. Cadence59.9764–59.9812Hz, zero intervals over50ms. [All six results](../performance/2026-10-04-native.json) retain source/private-harness/fixture/raw/report digests. No other local test or build from this task ran during timing.

The original private report inherited an incorrect “headless” suffix in its graphics label. The actual launch and protocol were headed; the public summary preserves that original label and explicitly corrects the classification. Original evidence bytes remain unchanged. Chrome154 results are not a same-browser comparison with earlier Chromium149 measurements. This measures the isolated renderer on an actual desktop, excluding full HUD timing, physical touch, human readability and low-power/battery qualification.

Reproduce with `npm run perf:front-of-house -- --native-chrome --gpu=metal`. It requires installed Chrome, uses a fresh profile, fills the actual available display area and records the content geometry. It does not emulate density; combining it with `--dpr=2` or `--large-viewports` fails. Loss of focus invalidates a native timing window. The public command was added after the recorded full run and separately checked with two short validation windows.

## Actual attached-display transitions

The full isolated client passed DPR1 → DPR2 → DPR1 by moving its own Chrome window between actual attached displays. CSS viewport stayed1000×613; backing changed1000×613 →2000×1226 →1000×613. Exact game state, yaw37/135 picking, active3D rendering, focus/visibility and page containment passed. No device-metrics emulation or direct renderer resize was used. [Sanitized evidence](../performance/2026-10-04-displays.json) retains the source6ed7b7c, harness/report hashes and state digest; private display coordinates and screenshots remain local.

Reproduce with `npm run smoke:front-of-house-displays` on a Metal host with installed Chrome and attached DPR1/DPR2 displays. Optional `FRONT_OF_HOUSE_DISPLAY_OUTPUT` must name an empty private directory; the default is temporary. Screen enumeration permission is granted only inside the isolated context for its loopback origin. This is a manual hardware check, excluded from ordinary CI. Both the initial public command and its cleanup refactor passed actual display moves. Native and headless short validation, plus a deliberate missing-browser launch, verify the reproduction tool; the launch failure is recorded and exits without leaving its server running.

Remaining FOH-P01 work includes declared CI regression limits with actual slowdown rejection, reduced-cost/fallback policy and supported low-power/phone measurements. Human art, camera and readability acceptance remains separate. The accepted device targets remain60fps desktop and30fps low-power.

## Paired regression policy under verification

FOH-P01g implements a same-runner comparison against calibrated `6ed7b7c2991ef0d8ccc71fe167444f5422cd7483`. Normal PR correctness checks remain; the additional job measures changes to Front of House modules/vendor files, measurement tools, dependency lock or workflow. Unrelated changes skip timing. Manual dispatch uses `foh_performance_gate=true`; `foh_performance_fault=true` additionally runs the deliberate slowdown.

Each baseline/candidate has all18 full windows. The gate audits source/fixture/raw digests, recomputes statistics, requires identical rendered scenes/browser/runner/backing/motion/guest count and compares median-of-three timing per scene/viewport. Whole fixture state may differ when unrelated career fields evolve, but the exact rendered scene must match. Invalid/quick/missing/duplicate evidence fails before budget evaluation.

Initial delegated engineering limits: frame mean and p95 may increase by the larger of25% or8ms; CPU submission p95 by the larger of50% or1ms. These exceed the repeat variation in the recorded calibration and are conservative regression alarms, not new60fps/30fps device acceptance limits. The baseline is pinned and never updated automatically. Sequential paired runs reduce runner-class variance but retain time-dependent host noise.

The optional `--fault-cpu=20` inserts real CPU work only inside the isolated measurement harness, recorded in protocol metadata. The fault-proof step requires valid full samples and an actual numeric budget failure; a fault flag, invalid report or quick-mode rejection cannot pass that proof. Ordinary comparison rejects injected runs. All JSON is retained30days, including invalid windows. Full pair sampling takes about26minutes; adding fault evidence takes about40minutes. Live paired/fault acceptance remains pending until linked to a completed run.

## Full native 3D client and HUD baseline

[All six native HUD windows](../performance/2026-10-04-native-hud.json) at clean `aa5f6a3339cb666ec5729403afb9dffc00786cfb` are valid. Installed Chrome154.0.8037.97, Apple M4 Metal, actual5120×1286 content/backing at DPR1; full client/HUD and seed170 live flow-version1 show. Each uses10s warm-up and30s sampling, starting at minute25 and reaching65. Fixed and actual middle-drag cameras alternate across three repeats at zoom2. Focus/visibility, containment, real motion and exact engine-state replay all pass. Original report/source/fixture/raw hashes verify.

| Repeat | Fixed cadence Hz / intervals >50ms | Moving cadence Hz / intervals >50ms | Fixed / moving render calls across warm-up and measurement |
| --- | --- | --- | --- |
| 1 | 59.98 /0 | 59.97 /0 | 2441 /4843 |
| 2 | 59.44 /0 | 47.58 /2 | 2421 /3918 |
| 3 | 52.91 /1 | 49.32 /0 | 2110 /3999 |

These below-target runs are retained. Shared-host load varies; no concurrent local tests/builds/other browser checks from this task ran during timing. The evidence does not establish sustained60fps, thermal causality, GPU completion or human readability. Camera events and the running-show loop both call the renderer; their duplicate submissions are independently observable and motivate application-only deferred rendering. The standalone benchmark stays synchronous. Candidate comparison and delivery remain pending.

Reproduce with `npm run perf:front-of-house-native-hud` using installed Chrome on a Metal host; `FRONT_OF_HOUSE_HUD_OUTPUT` names an empty private output directory. The command uses native geometry/density, isolated storage and six complete windows; `--quick` is only tool validation. It was published after the frozen private-harness baseline; both source attributions remain explicit. Screenshots and raw state stay private.

## Full native HUD batching comparison

Delivery CI37208943333 caught a stale renderer digest in the generated Lot manifest. Regeneration changes only that digest; vendor and asset checks pass afterward. The frozen candidate below also contained the old manifest entry, while its independently recorded renderer source hash is correct. Original measurement bytes and hashes are retained; this metadata correction does not alter the measured geometry or runtime.

[All six candidate windows](../performance/2026-10-04-batched-hud.json) at clean `5f47c4ae370f87caab60123090bd961b7f22181a` pass the full audit. The fixture hash, installed Chrome154, native5120×1286/DPR1 window, private harness, timing/camera protocol and exact final game states match the baseline. Only the adapter and renderer runtime source digests differ. Geometry, materials, backing, attendance, model resources and provenance match; the application now opts into deferred rendering.

| Repeat | Fixed cadence Hz / intervals >50ms | Moving cadence Hz / intervals >50ms | Fixed / moving render calls across warm-up and measurement |
| --- | --- | --- | --- |
| 1 | 59.68 /0 | 59.08 /1 | 2322 /2343 |
| 2 | 56.64 /0 | 55.91 /0 | 2293 /2211 |
| 3 | 57.78 /1 | 59.84 /0 | 2320 /2381 |

Moving-camera submissions fall from3918–4843 to2211–2381 over each warm-up-plus-measurement span. The deterministic browser test independently verifies coalescing many updates into one frame, immediate picking, pause, real context recovery and disposal. Fixed-camera counts vary with host cadence; their third repeat has more calls than the slower baseline, which is retained. Timing ranges55.91–59.84Hz with two intervals over50ms; these measurements occurred later on the shared host and do not isolate all causes or prove sustained60fps. Renderer work reduction is verified separately from frame-rate acceptance.

The comparison predates integration of the newer career source193c54c. Its original revisions are not relabeled; integrated player/CI/hosted checks follow separately. The source-only reproduction command passed two short native windows before this full comparison. All28 legacy checks, four live-control journeys, eight crowd/movement journeys and six vendor journeys pass with batching, alongside the full3D/recovery/settlement and backend/resolution checks.

## Completed CI regression validation

[Paired evidence and measured negative control](../performance/2026-10-04-ci-paired.json) records two successful comparisons and a valid deliberate20ms CPU slowdown. CI37207123068 measured the actual generated PR merge42c1e0f; manual37207121746 measured branchaa5f6a3, both against pinned6ed7b7c. Independent audits verify all90 full windows, exact source/fixture/raw digests, recalculated statistics and comparison results. The fault run fails CPU p95 in every scene/viewport group:20.9–27.4ms medians against1.3–10.35ms limits. Invalid evidence was not used as a substitute for numeric rejection. These software-runner results establish regression detection, not device frame-rate acceptance; later integrated delivery still requires its own CI.

## Club renderer diagnostic

`npm run perf:front-of-house -- --venue=club --native-chrome --gpu=metal` repeats the full empty/crowd protocol on the actual visible desktop window, with isolated storage. The frozen seed170 Sandbox Club fixture uses existing medium house PA, starter layout,360 actual attendees and180 representative models. Fixed pillars remain present in the empty room. `--quick` validates the harness only. The default Lot fixture, cadence path and CI gate remain unchanged; Club reports are separate diagnostics and cannot substitute for a comparable Lot regression pair or full-client/human acceptance.

[All six Club windows](../performance/2026-10-04-club-native.json) retain every repeat and report/source/fixture/raw digests. Six full native Club renderer windows at clean5330eb3 pass independent source/fixture/raw digest and timing audits. Apple M4 Metal, Chrome154.0.8037.97, actual5120×1286/DPR1; cadence59.9734–59.9788Hz, 0 intervals over50ms. Existing360-person fixture/180 representatives, fixed scenery and quality unchanged across three empty/three crowd repeats. Renderer-only evidence excludes HUD and human/low-power acceptance. No other browser test or build from this task ran during timing; other host load remains uncontrolled. The canonical camera path is retained literally (including its Lot center), so this is a reproducible diagnostic rather than a room-specific operator camera study.

## Amphitheater renderer diagnostic

`npm run perf:front-of-house -- --venue=amphitheater --native-chrome --gpu=metal` uses a separate seed3 Sandbox fixture with the existing starter,700 attendees/180 representatives and rain. The full protocol is three empty/three crowd windows at10s warm-up plus30s measurement. `--quick` is harness validation only. The canonical camera path, including its original center, is retained; this is a renderer diagnostic, not an operator-camera study or a replacement for the comparable Lot CI gate. Native measurement and full-game/device acceptance are recorded separately.

[All six Shell windows](../performance/2026-10-04-shell-native.json) retain every repeat with source/fixture/raw/report digests. Six full native Shell renderer windows at clean47f680e pass independent source/fixture/raw digest, exact fixture replay and timing audits. Apple M4 Metal, Chrome154.0.8037.97, actual5120×1286/DPR1; cadence59.9734–59.9798Hz, 0 intervals over50ms. Three empty/three700-person rain repeats preserve scene quality and180 representatives. Renderer-only; full game, human and low-power acceptance remain separate.


## Festival renderer diagnostic

`npm run perf:front-of-house -- --venue=festival --native-chrome --gpu=metal` uses a separate seed8 Sandbox fixture: Paper Voltage guarantee, Hollow Census side bill, versioned stage policy, starter layout and actual engine allocation of5500 main/500 side attendees. The gate-jam incident is retained. At most180 representatives are shared across both stages. The full protocol retains three empty/three crowd windows,10s warm-up and30s measurement; `--quick` validates the harness only. The standard camera path is unchanged, including its original center. This is a renderer diagnostic, not a venue navigation study or the full game/HUD acceptance gate. Stage-accounting source is included in the fixture digests. Native results and human/low-power acceptance remain separately recorded.

[All six Festival windows](../performance/2026-10-04-festival-native.json) retain every repeat with source/fixture/raw/report digests. Six full native Festival renderer windows at cleanbdfd5ea pass independent source/fixture/raw digest, exact fixture replay and timing audits. Apple M4 Metal, Chrome154.0.8037.97, actual5120×1286/DPR1; cadence59.9746–59.9812Hz, 0 intervals over50ms. Three empty/three6000-person two-stage repeats preserve scene quality and180 representatives. Renderer-only; full game, human and low-power acceptance remain separate.

## Site overview full-client comparison

Run `npm run perf:front-of-house-native-hud -- --festival` and a separate `--festival --overview-hidden` run in fresh output directories. Both use the same seed8 Sandbox Festival, versioned two-stage policy, Paper Voltage/Hollow Census bill, starter layout,20-price promotion and gate incident. The engine holds6000 total attendance; playback is paused at its actual incident progress0.095, so the client shows1267 arrivals and180 representatives (165 main/15 side). Each mode records three fixed/three actual-middle-drag native windows at10s warm-up and30s measurement. The hidden comparison only hides the overview element; source, geometry, quality, HUD and immutable saved fixture are identical.

The harness checks actual camera motion, unchanged game state, full attendance/model values and map redraw counts: a fixed or hidden map must reuse its pixels, while a visible moving map must update throughout the window. `--quick` validates setup only. An initial setup check incorrectly expected all6000 attendees to be visible at the early gate pause; it was corrected to the existing playback interpolation, without changing the game. The full-client evidence is separate from renderer-only timing, the live-Lot KI-14 investigation and human/physical-device acceptance. Full measured comparison remains pending until recorded below.

### Native overview comparison, 2026-10-04

[All twelve full-client windows](../performance/2026-10-04-navigation-native.json) retain each repeat and frozen-source digests. Twelve full native overview windows at clean ca1f1a7 pass independent source/raw/fixture digests, exact fixture replay and timing audits. Apple M4 Metal, Chrome154.0.8037.97, actual5120×1286/DPR1: visible 59.44–59.98 Hz, hidden 59.51–59.98 Hz, zero intervals over50ms. Each mode has three fixed/three actual pointer-pan repeats with10s warmup/30s measurement. All preserve6000 total attendance,1267 displayed arrivals and180 representatives. Visible moving windows repaint; fixed and hidden windows reuse the image. Sequential descriptive results overlap; no causal improvement, running-Lot KI-14 closure, phone/low-power or human acceptance inferred.

The measurements predate the integrated sponsor and Shell profile rules; they qualify only the recorded frozen source. The combined release receives its own source and browser regression checks.

### Native camera fit comparison

[All twelve running-show windows](../performance/2026-10-04-camera-fit-native.json) retain every fixed/moving repeat. Twelve native full-client running-Lot windows compare clean388d4c8 and3ce752c on Apple M4/Metal/Chrome154, actual5120×1286/DPR1. Independent audit verifies all source/raw hashes, recreated fixtures, exact final-state replay and identical initial scene quality. Baseline57.57–59.98Hz with11 intervals over50ms; camera-fit reuse58.28–59.65Hz withnone. Only camera source and its generated asset digest differ. Shared-host ranges overlap; no causal frame-rate improvement, sustained60fps, low-power or human acceptance inferred. KI-14 remains open.

Each source uses three fixed and three actual middle-drag repeats with10s warmup and30s measurement. Every show advances from minute25 to65 and matches engine replay exactly. This task ran no concurrent local tests, builds or browser checks during the native windows. Other shared-host load remains uncontrolled. These frozen measurements predate later Festival profile/delay integration; the current release has separate source, CI and hosted checks.

A separate Node22.22.1 helper diagnostic on the same Apple M4 compared five alternating repetitions of20000 pans:1870.64–2362.12ms before,84.80–119.53ms after.3852 exact camera pose, matrix, projection, picking and overview comparisons passed. This isolates camera CPU work, not browser frame-rate or GPU improvement.


## Refined sample full-client native measurement

[All six full native windows](../performance/2026-10-05-sample-native.json) use clean source `b8bfe08fe110121c51dafb75eb8efda837e3353a`, including model12 faces, hair, material maps and walking/queue poses. Apple M4/Metal, Chrome154.0.8037.97, actual5120×1286 at DPR1; three fixed and three moving-camera repeats, each with10s warmup and30s measurement. Every running Lot advances from minute25 to65 and matches exact engine replay. Source, fixture and raw hashes and recomputed statistics pass the independent audit. All six remain visible/focused with no resize or context violations.

Observed cadence is59.9439–59.9772Hz, with zero intervals over50ms. This is current evidence near the available display's60Hz cadence, not a promise of all-device sustained60fps, causal improvement over prior shared-host runs or human smoothness/readability acceptance. No other local tests, builds or browser checks from this task ran during the windows; other host load remains uncontrolled. The existing untracked dependency symlink was excluded only from measurement-process Git metadata; tracked source was unchanged. Physical low-power/phone qualification remains open.


## Model12 release regression and retained rejection, 2026-10-05

[PR120](https://github.com/DaveHomeAssist/mixmash/pull/120) delivered model12 at `51a8b9678b08670ccb8fbb4c64adbb8d6fb928bf`. [Final-head CI 37263372266](https://github.com/DaveHomeAssist/mixmash/actions/runs/37263372266) retains both attempts at `bab8f0e4a1f19311d2d6df98e67bf4c43c32048e`; general job 111615017900 passed before the renderer retry.

| Pair | Runner CPU | Valid windows | Numeric result |
| --- | --- | --- | --- |
| Initial runtime CI 37261347354 | AMD EPYC 9V45 |36| All six scene/viewport groups pass |
| Final head attempt1 | Intel Xeon Platinum 8573C |36|2560×720 empty CPU p95:2.0ms exceeds1.7ms; crowd frame p95:1000ms exceeds958.25ms |
| One diagnostic repeat, attempt2 job 111622152804 | AMD EPYC 7763 |36| All six scene/viewport groups pass |

All 108 raw windows were independently audited against source/fixture/raw digests, recomputed statistics and exact numeric comparisons. The tested synthetic merge `440419227bd6afc4f3fae9b02bf30a24f476b6a7` matches the PR candidate tree; measured runtime files match the original source. No source, protocol, quality or threshold changed for the retry. Hardware differs between runs, but that difference does not establish the cause of the rejection. Keep the failed result as an unresolved variability finding under KI-14. No further retry was used. The optional deliberate CPU-fault workflow was not selected on this PR; earlier fault evidence above is separate.

Pages built the exact merge at 2026-10-05T05:28:24Z. All 42 hosted source files match before and after the complete player suite, pose/reduced-motion captures and 3D offline signing/reload. The six native Mac windows above retain their frozen `b8bfe08` attribution. Neither CI software-renderer comparisons nor native Mac cadence establishes supported phone, low-power or human acceptance.


## Model13 geometry qualification

The anatomy candidate changes shared torso and limb vertex geometry while retaining sixteen instance batches and four textures. The preceding model12 native report remains frozen evidence for its recorded source. Current-source browser lifecycle, full-client and paired CI checks are required; supported physical devices and final human acceptance remain open.


## Model13 crowd regression retained — 2026-10-05

PR122 source412bb00, CI37271315330 attempt1, failed the unchanged paired gate on AMD EPYC9V74. Independent audit validates all36 windows, source/fixture/raw hashes and recomputed statistics. Empty scenes and CPU submission metrics pass; crowd mean and p95 frame intervals fail at all three sizes. These are software-renderer change limits, not device frame-rate targets. General CI and the complete independent Dominic player suite pass; they do not override this rejection.

| Crowd viewport | Mean baseline / candidate / limit ms | p95 baseline / candidate / limit ms |
| --- | --- | --- |
|1440×900|350.955 /641.464 /438.693|633.3 /1199.9 /791.625|
|375×812|237.392 /486.810 /296.740|466.6 /983.3 /583.25|
|2560×720|334.617 /617.661 /418.271|649.9 /1183.2 /812.375|

Model14 replaces redundant uniform longitudinal subdivisions with the exact authored contour rings and indexed cap centers, retaining radial resolution, closed surfaces, clothing maps, instance counts and motion. Its performance remains unqualified until new full paired measurements pass. Short remote before/after diagnostics are exploratory only; no threshold or test timeout is relaxed.


## Model14 retained crowd rejection and projected detail correction, 2026-10-05

PR122 head74da757 ran CI37274607801. General tests and complete player checks passed. The paired renderer job failed on AMD EPYC7763. Independent audit verified all36 windows, source/raw/fixture hashes and recomputed statistics against the provider artifact11330961233. Empty-scene and CPU-submission limits passed; five crowd-frame metrics failed:

| Viewport | Mean baseline / candidate / limit (ms) | P95 baseline / candidate / limit (ms) |
| --- | --- | --- |
| 1440×900 | 493.9705 /690.8795 /617.4631 — fail | 1150 /1283.3 /1437.5 — pass |
| 375×812 | 328.6109 /509.8661 /410.7636 — fail | 650 /1016.6 /812.5 — fail |
| 2560×720 | 476.9046 /655.6489 /596.1308 — fail | 900 /1266.6 /1125 — fail |

The recorded crowd has506610 rendered triangles versus290610 in the baseline, with the same165 draw calls. This supports investigating geometry cost; it does not prove a sole causal bottleneck. No unchanged retry or limit relaxation follows. Model15 introduces deterministic projected-size guest detail under CT-DEC-31, retaining the full anatomy near the camera and each authored body contour at distance. Screen-size detail is independent of measured frame rate; the protocol still disables time-based adaptive quality. Existing sample duration, repetitions, fixtures, DPR, shadows, antialiasing, baseline and limits remain unchanged. Full current-source qualification is required before delivery.

Dominic's isolated existing-driver probes rendered correctly but reported SwiftShader, including the read-only Intel Vulkan configuration. These are software capability results, not native Intel, supported phone or low-power qualification. No driver or service changes were made.


## Model15 paired results and redundant buffer work, 2026-10-05

[CI37278816549](https://github.com/DaveHomeAssist/mixmash/actions/runs/37278816549)
at9ef6e4d passed the renderer gate on AMD EPYC7763. All36 windows, fixture/raw/source
hashes and recomputed statistics matched artifact11332291985. Its general job
failed the homepage budget assertion, subsequently corrected against the approved
initial-load requirement. Desktop crowd CPU P95 was8.5ms against8.55ms.

The finalbc89 revision retained identical renderer bytes but
[CI37280046410](https://github.com/DaveHomeAssist/mixmash/actions/runs/37280046410)
ran on Intel Xeon Platinum8370C. General tests passed. The independently audited
artifact11333051862 contains36 valid windows; all frame-time and empty-scene
limits pass, but ultrawide crowd CPU P95 is8.8ms versus baseline5.7ms and limit8.55ms.
The earlier AMD pass does not override this rejection. Both complete records are
retained; no unchanged retry, runner selection, baseline or limit relaxation.

A bounded probe on Dominic found that each camera-only move with all150 guests
remaining distant rewrote2400 matrices and2400 colors, although no shadow update
was needed. Pose updates also rewrote unchanged colors. The correction separates
per-guest detail selection from buffer packing: camera-only moves reuse buffers
when membership stays unchanged, poses refresh matrices, and actor or detail
changes refresh colors. Geometry, hysteresis, animation, materials, representative
counts, shadows and gameplay remain unchanged; cache69 carries the correction.

All20 geometry/camera tests pass, and768 exact prior/corrected snapshots match
active matrices/colors/counts/visibility/buffer versions across paused/moving
actors, workers, camera/detail transitions and a translated Festival-style group.
The same bounded probe records zero camera-only buffer writes and2400 pose matrix
writes with zero redundant color writes. Warm-tail median submission times were
3.45 to1.55ms for camera updates and4.25 to2.60ms for draws on Dominic. These short
instrumented observations diagnose work removed; they are not a qualified paired
performance pass. New final-source CI and hosted validation remain required.

The corrected source also passes439 repository tests/build and targeted backend,
actual3D, camera-only batching, DPR/resolution and full Festival geometry/replay
checks on Dominic. The FOH show capture was inspected; no visual change is
expected from identical guest matrices, colors and geometry.

## Final buffer-reuse qualification, 2026-10-05

The first corrected-source run [CI37283959269](https://github.com/DaveHomeAssist/mixmash/actions/runs/37283959269)
stopped before measurement because the manifest still named the previous presentation
digest. Commit e019f12 corrected that metadata without another runtime change.
[CI37284130070](https://github.com/DaveHomeAssist/mixmash/actions/runs/37284130070)
then passed both required jobs. Independent audit validates its36 windows and18
metrics, including exact source, fixture and raw hashes and recomputed statistics.

The final PR122 head9ce8a9e integrates the concurrent homepage changes while retaining
the exact e019f12 Front of House runtime, geometry, saves and performance protocol.
[CI37359157706](https://github.com/DaveHomeAssist/mixmash/actions/runs/37359157706)
passes both required general and renderer jobs. Independently downloaded artifact
11366478578 (`foh-pair-37359157706-1`,108801 ZIP bytes) matches the provider SHA-256
`022b759d441f73463b562c6428bdde2ee2dc2ad51ff7e697f31b4c5414fe6404`.
Independent audit verifies all36 windows and18 metrics against the unchanged
baseline6ed7b7c and limits. The CI host reports AMD EPYC7763.

| Crowd viewport | CPU P95 | Limit | Verdict |
| --- | --- | --- | --- |
| 1440×900 | 6.3ms | 7.95ms | Pass |
| 375×812 | 4.4ms | 6.15ms | Pass |
| 2560×720 | 7.4ms | 8.25ms | Pass |

These are paired software-renderer regression results, not sustained native60fps
or supported-phone30fps qualification. Earlier model13/model14 failures and the
bc89 Intel8.8ms rejection remain valid historical results; the correction is an
actual buffer-work change, not an unchanged retry or relaxed gate.

[PR122](https://github.com/DaveHomeAssist/mixmash/pull/122) merged8e723ed.
The final head, CI synthetic merge and delivered merge have identical source trees.
Pages built that merge at2026-10-05T19:27:12Z; postmerge
[CI37362776702](https://github.com/DaveHomeAssist/mixmash/actions/runs/37362776702)
also passes. On Dominic all42 hosted files match before and after the complete
twelve-script player suite,3D offline signing/reload, gestures/context/module
recovery, Festival geometry/eight exact settlement comparisons, four navigation
journeys and the supplied action/state captures. Screenshots and state were
inspected; no captured action-client errors. Four controlled motion scenarios
are local fixtures, separate from the hosted client journeys. Offline seed3786835978
preserves1500 touring rent,1350 delay costs,225251 net and1225251 signed/journal cash.
Native model12 sample evidence keeps its original frozen source attribution;
model15 native-device, final visual/camera, physical calibration and human career
acceptance remain open.
