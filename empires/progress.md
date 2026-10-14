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

- Replaced the shipped WASM snapshot, which still drew the flat procedural boxes and grid tiles from before the sprite pipeline, with a fresh `aoe2-clone` web build that ships the 16 external sprite atlases as `assets/aoe2-clone.data` (Emscripten preloaded virtual file system, mounted at `/assets/sprites`).
- The atlases come from the new 2x "sourceScale" art pass in `aoe2-clone` (`tools/generate_sprite_atlases.py`): layered grass, caustic water, clumped tree canopies, faceted rocks, plaster and mossy-roof buildings with lit windows, cloth-textured units with rim light and baked contact shadows, one shared filmic grade. Sprites keep their on-screen footprint and stay sharp when zoomed.
- Verified in headless Chromium: lobby loads, Space starts the skirmish, the map renders with the new tiles and sprites, no page errors.
- Rebuild recipe is unchanged: run `tools/build_web.sh` in `aoe2-clone`, then copy `aoe2-clone.js`, `aoe2-clone.wasm` and `aoe2-clone.data` into `empires/assets/`.
