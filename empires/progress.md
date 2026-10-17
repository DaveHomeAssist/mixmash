Original prompt: Restore /empires/ as Age of Dave backed by the real aoe2-clone RTS instead of the old placeholder prototype.

## 2026-07-06

- Replaced the old EMPIRES Vite build with a static Age of Dave command-center page.
- Copied selected sprite atlases from `/Users/daverobertson/Desktop/Code/10-projects/active/aoe2-clone/assets/sprites` into `empires/assets/sprites`.
- The page exposes `window.render_game_to_text()` and `window.advanceTime(ms)` for browser verification.
- Current truth: Age of Dave is a native C++/SDL alpha; browser/WASM port is not shipped yet.
- Next suggested work: build the actual browser port from `aoe2-clone` instead of extending the launcher.

## 2026-07-07

- Built the suggested browser/WASM port: added an Emscripten CMake target to `aoe2-clone` (SDL3 vendored via FetchContent for the wasm toolchain, `net`/multiplayer excluded from the web build since raw sockets and subprocess spawning have no browser equivalent, main loop driven via `emscripten_set_main_loop_arg`).
- Replaced this launcher page with the real build: `empires/index.html` now loads `assets/aoe2-clone.js`/`.wasm` onto a full-bleed canvas; the game draws its own lobby/HUD, so the launcher's DOM status panel and sprite atlases are no longer used and were removed.
- Verified in an actual Chrome window: the civ-selection lobby renders correctly (not the old placeholder, not this launcher). Fixed one real browser-compat bug along the way — `ALLOW_MEMORY_GROWTH` backs wasm memory with a "resizable" `ArrayBuffer`, which this Chrome version's `TextDecoder.decode()` rejects outright; switched to a fixed `INITIAL_MEMORY` instead.
- Current truth: local skirmish vs AI works in the browser build; LAN/internet multiplayer remains desktop-only (SDL3 native app).

## 2026-10-14

- Published aoe2-clone `main` at `338a61b` (PRs #2–#7): shaded 2.5D sprite atlases now ship in the web build (`aoe2-clone.data`, 812 KB preloaded), primitives batched (in-match draws/frame 1,462 → 63 desktop, 438 → 39 mobile), HiDPI canvas capped at 2x, narrow-screen HUD (menu clearance, wrapped resource grid, hints hidden < 600 px).
- Shell: `locateFile` points side files at `./assets/`, `devicePixelRatio` capped at 2, F3 panel moved top-right.
- Publish = `tools/build_web.sh` in aoe2-clone, then copy `build-web/src/app/aoe2-clone.{js,wasm,data}` into `empires/assets/`.
- Later the same day: replaced the `338a61b` build with the 2x realistic sprite pass from aoe2-clone PR #13 (branch `claude/sprites-2x-realistic-1014`): atlases authored at twice the on-screen resolution (`sourceScale` 2, `aoe2-clone.data` 2.3 MB), layered grass without the per-tile repeat, caustic water, clumped canopies, faceted rocks, plaster and mossy-roof buildings with lit windows, cloth-textured units with rim light and baked contact shadows, and sprites for the shallows, hills and road tiles that still rendered as grey diamonds. Shell unchanged. Verified in headless Chromium: lobby, Space to skirmish, no page errors.
- Follow-up build from the same engine branch (`b9ac353`): unit rigs 1.3x larger (a villager is about 32 px tall on screen, the scout 40), `shallows_<mask>` shoreline autotiles so fords dry out toward their banks, and 2x UI icons with the magenta fringe removed from team regions. `aoe2-clone.data` is now 3.0 MB. Re-verified in headless Chromium with no page errors.

## 2026-10-17

- Published aoe2-clone `main` at `207a4e3` (PRs #14, #16, #10, #11 since the last build): sprite ground shadows drawn in one pre-pass before the sprites (web draws/frame 63 → 41) at #13's lighter shadow alphas, `--map-size` option, and the status naming change. Files come from main's CI `web-build` artifact (run 39035880192), which #11 now produces and smoke-tests in headless Chrome on every push. `aoe2-clone.data` is byte-identical to the previous build; `.wasm` 1,274,009 bytes. Shell unchanged.
- Verified locally in headless Chromium: lobby, Start Skirmish, no page errors or failed requests.
