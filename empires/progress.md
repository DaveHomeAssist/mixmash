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
