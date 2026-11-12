# Gritty's Hockey Havoc

An early arcade hockey platformer in a single HTML file (canvas and vanilla JavaScript). Tailwind, Font Awesome and Google Fonts load from CDNs, so the page needs a network connection.

**Route:** `/hockey-havoc/`. It is unlisted: `noindex`, no hub card, and not in the sitemap or the service-worker precache.

## Play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Skate | A / D or ◄ ► | arrow buttons |
| Jump (double jump in the air) | W, Space or ▲ | JUMP |
| Slapshot | F, X or click | SLAP |
| Power slide (body-checks enemies) | Shift or S | SLIDE |

Skate three periods. Collect hot dogs (every fifth restores a heart) and puck crates. Slapshot or slide-check Zambonis and rival goalies, then put a puck in the net to reach the next faceoff.

## Status

The game is early playable and unlisted. Slice 1 (2026-11-11) is a bug-fix and jump-feel pass. Nobody has played it as an acceptance test yet, and it hasn't been run on a real phone or a real 120 Hz display.

## Brief: slice 1

**Player problem.**
- The power slide dropped Gritty through the ice, cost a heart and sent him back to the start.
- The game ran about twice as fast on 120 Hz screens.
- On short or landscape screens the floor was off-screen, and touch controls vanished at 640 px and wider.
- Dying or restarting during the goal celebration corrupted the period.
- Running out of pucks after the crates were gone left a run with no way to finish.
- Keys stuck after switching apps.
- Space could toggle mute.
- At portrait phone widths the HUD pushed the mute button off-screen.

**Outcome.** The game plays the same on every refresh rate and screen shape, the slide is a low, fast body-check, every run can be finished, and jumps forgive near-misses.

**Flow.** The game's flow doesn't change: start, three periods, a puck in the net each period, then a win or a loss.

**Slice.**
- The slide keeps the skates planted, and Gritty stays crouched while a platform is overhead.
- Fixed 60 Hz simulation steps, with each frame capped at 250 ms.
- A virtual view that scales the fixed world (floor at y=520) into short or narrow canvases.
- Touch controls appear on any touch device.
- The page uses dynamic viewport height.
- On narrow screens the HUD drops the wordmark, and below 360 px it also drops the logo tile.
- A tracked period-change timer, and no damage while celebrating.
- The nearest crate restocks when you have no pucks and every crate is taken.
- Held controls are released on window blur, tab hide and `touchcancel`.
- While playing, game keys can't click a focused button.
- Coyote time of 6 steps and a jump buffer of 8 steps.
- Releasing jump early multiplies the upward speed by 0.7, once per jump. At that value a 67 ms press still clears the 90 px first platform.
- The MixKit nav for the hub link and Mute All.

**Excluded.** These are not part of this slice:
- Mascot patrol overhang.
- Pucks embedding in platform sides.
- Knockback direction and hitbox offset.
- Ice-spray direction.
- Toast timers.
- Parallax wrap.
- Camera reset between periods.
- A right-hand wall.
- Retina scaling.
- Removing the CDN dependencies.
- The rest of MixKit (stage, lifecycle, input).
- A hub card.
- New mechanics.

**Rules, data and saves.**
- Walking off a ledge leaves only the double jump; it used to give two air jumps.
- A short tap gives a lower hop.
- The slide can pass under the low platform in period 3.
- Crates can restock.
- No saves or network calls of its own.

**Risks.**
- Quick tappers may find the first platforms harder.
- Without render interpolation, 120 Hz screens show each step for two frames.
- In phone landscape the rink renders at about 0.4 scale.

**Acceptance.** `test/hockey-havoc-physics.test.mjs` loads the player code from `index.html` and asserts:
- Feet stay on the ice through a slide and its release.
- The slide passes under a low platform.
- Coyote, buffer and short-hop jumps behave as described.
- The distance per second is the same at 60, 120 and 144 Hz.
- Hits are ignored while celebrating.

Headless Chromium runs also covered:
- Desktop, an emulated 120 Hz display, phone landscape and portrait, and tablet.
- The HUD fitting at 14 widths from 320 px to 1440 px.

## Open choices

| ID | Choice | Options | Recommended |
| --- | --- | --- | --- |
| HH-D1 | Hub listing | (a) keep unlisted, (b) "Early playable" hub card that stays `noindex` (as Front of House did), (c) full listing and sitemap | (a) until HH-D2 is settled |
| HH-D2 | Naming | Gritty, the Flyers colors and the Stanley Cup belong to third parties. (a) keep them for an unlisted fan build, (b) rename to an original mascot before any listing | (b) before any listing |
| HH-D3 | Rendering style | crisp vector with Retina scaling, or low-res pixel art | crisp vector |
| HH-D4 | A 3D version | keep 2D, or rebuild in 3D | keep 2D for now (later milestone) |
