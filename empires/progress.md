Original prompt: Restore /empires/ as Age of Dave backed by the real aoe2-clone RTS instead of the old placeholder prototype.

## 2026-07-06

- Replaced the old EMPIRES Vite build with a static Age of Dave command-center page.
- Copied selected sprite atlases from `/Users/daverobertson/Desktop/Code/10-projects/active/aoe2-clone/assets/sprites` into `empires/assets/sprites`.
- The page exposes `window.render_game_to_text()` and `window.advanceTime(ms)` for browser verification.
- Current truth: Age of Dave is a native C++/SDL alpha; browser/WASM port is not shipped yet.
- Next suggested work: build the actual browser port from `aoe2-clone` instead of extending the launcher.
