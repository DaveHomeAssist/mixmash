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
