# MixMash Sprint Boards

Backlog tickets for the UX, mobile, performance, and gameplay polish pass across
the MixMash catalog. Reconciled against the repo on 2026-08-16 — the `Status`
column is what is true in this tree, not what the original board assumed.

`ROADMAP.md` remains the product roadmap for the `/play/` fighter specifically.
This file is the cross-catalog polish backlog and is narrower in scope.

## Status legend

| Status | Meaning |
|---|---|
| **Shipped** | Implemented in this repo and verified. |
| **Already shipped** | Was already implemented before this pass; no work needed. |
| **Out of repo** | The code lives in another repository — cannot be done here. |
| **Infra** | Requires host/DNS configuration, not a code change in this repo. |

---

## MIXMASH Platform Fighter (`/play/`)

Everything here lands in `play/index.html`, and every new piece of state is
exposed through `render_game_to_text()` so the Playwright rail can assert on it.

| Ticket | Priority | Task & Scope | Acceptance Criteria | Pts | Status |
|---|---|---|---|---|---|
| MM-101 | P0 | Gamepad connection toast | `gamepadconnected` / `gamepaddisconnected` raise an overlay toast reading `Controller Connected: Player 1`. | 2 | **Shipped** |
| MM-102 | P1 | Copy match link toast | Copying the match link shows a transient green `Copied!` badge; the menu status line also turns green. Clipboard failure falls back to showing the raw URL. | 1 | **Shipped** |
| MM-103 | P1 | Touch virtual pad fallback | On coarse-pointer viewports ≤1024px a D-pad plus a 3-button cluster overlays the canvas during a match and merges into `getPlayerInput()` for P1. | 5 | **Shipped** |
| MM-104 | P1 | Audio context prompt state | While the WebAudio context is missing or suspended, a pulsing "Tap to start audio" prompt appears; clicking it calls `initAudio()`. | 2 | **Shipped** |
| MM-105 | P3 | Encyclopedia search filter | A search input filters the Mechanics Encyclopedia tiles by title, body, and a `data-terms` keyword index (DI, shield, armor…), with an explicit empty state. | 3 | **Shipped** |

**Notes.** MM-104's ticket referenced a "Click to Start" overlay; `/play/` has no
such overlay — the title screen is canvas-rendered — so the prompt is a
standalone pulsing DOM affordance instead. The pad in MM-103 drives player 1
only; player 2 stays keyboard/gamepad/CPU.

New `render_game_to_text()` keys: `toasts`, `touchControls`, `audioPrompt`,
`mechanicsFilter`.

---

## MarsScape (`/mars/`)

| Ticket | Priority | Task & Scope | Acceptance Criteria | Pts | Status |
|---|---|---|---|---|---|
| MS-101 | P0 | Mobile responsive breakpoints | Below 768px the three topbar stat cards stack full-width, controls keep ≥44px targets, and no control is clipped off the viewport. | 5 | **Shipped** |
| MS-102 | P1 | Visual resource depletion bars | The `■■■■■` glyph run is replaced by a fill bar driven by remaining/max charges, with a colour ramp and a `n/max` readout. | 3 | **Shipped** |
| MS-103 | P1 | Skill XP gain tooltips | Hovering a skill shows current XP, the next level's XP target, and applicable gear modifiers; tapping expands the same detail inline. | 2 | **Shipped** |
| MS-104 | P2 | Save import validation | `validateSaveCode()` checks base64 shape → decode → JSON → envelope → signature in stages, each with its own error message, before any state is applied. | 2 | **Shipped** |
| MS-105 | P3 | Isometric canvas drag/zoom | The Landing Basin map supports drag-pan, pinch-zoom, and wheel-zoom, with a Reset View control and double-tap reset. | 5 | **Shipped** |

**Notes.**

- MS-101 also fixes an unrelated layout bug found while working on it: the tab
  strip used a 5-column grid for six tabs, orphaning "Travel" onto its own row
  at 1/5 width. It is now two even rows of three.
- MS-103 deliberately advertises only gear modifiers the engine actually
  applies. `boots.speed` and `scanner.geode` are declared in `EQUIP_STATS` and
  have display labels, but **no engine rule consumes either value** — see
  `mars/engine.mjs`. They are not surfaced as active effects. Wiring them up (or
  removing them) is worth its own ticket.
- MS-105 composes with the existing responsive scale via CSS custom properties
  (`--base-scale` × `--user-scale`) so JS never fights the media query.
- Drag gestures suppress the click that would otherwise fire a gather command on
  whatever map piece the pointer released over.

---

## Garden OS: Story Mode (`/garden/`)

**All Garden tickets are out of scope for this repository.**

`garden/index.html` is a 1.9 KB shell whose only job is to iframe
`https://davehomeassist.github.io/garden-os/story-mode/`. Every mechanic these
tickets describe — the locked-mode badges, the Danger Zone modal, the planning
bed grid, the bug reporter, the OS window chrome — lives in the `garden-os`
repository. None of it is reachable from here, and cross-origin iframe content
cannot be modified by the host page.

| Ticket | Priority | Task & Scope | Pts | Status |
|---|---|---|---|---|
| GD-101 | P1 | Locked mode info modals (Daily Challenge / Speedrun) | 2 | **Out of repo** |
| GD-102 | P1 | Save file backup / export in the Danger Zone modal | 2 | **Out of repo** |
| GD-103 | P2 | Grid drag-and-drop for touch in the Planning bed | 5 | **Out of repo** |
| GD-104 | P2 | Bug reporter webhook sync / Markdown export | 3 | **Out of repo** |
| GD-105 | P3 | Sound effects for OS windows | 2 | **Out of repo** |

**Action:** re-file GD-101…GD-105 against `DaveHomeAssist/garden-os`.

The one Garden-adjacent change in this pass is platform-level: the page now
carries the shared global nav (HUB-102) instead of its own back pill.

---

## Pitch Riot (`/pitch/`)

| Ticket | Priority | Task & Scope | Acceptance Criteria | Pts | Status |
|---|---|---|---|---|---|
| PR-101 | P0 | Virtual touch controls layout | Pad geometry is driven by safe-area insets and viewport height; the stick zone is height-capped and the Sprint/Shoot cluster hugs the bottom rail, so neither reaches the canvas scoreboard in portrait or landscape. | 5 | **Shipped** |
| PR-102 | P1 | Pre-match audio preview toggle | A master volume slider and mute button on the difficulty screen, persisted to `localStorage`, governing a real SFX layer. | 2 | **Shipped** (expanded) |
| PR-103 | P2 | Halftime minigame visual guide | A 3-second animated diagram plays before the show: a demo crew sweeping six lanes, a roaming sprinkler, and a hype bar. The show clock, sprinklers, and coverage are all frozen while it runs. | 3 | **Shipped** |
| PR-104 | P2 | Scoreboard animation on goal | Screen shake and a goal banner on the canvas when the ball crosses the line. | 3 | **Already shipped** |
| PR-105 | P3 | Gamepad remap for soccer | Standard mapping: A = shoot, RT (or B) = sprint, left stick + D-pad = move, Start = pause/resume/kick off. | 3 | **Shipped** |

**Notes.**

- **PR-102 required more than the ticket described.** Pitch Riot had *no audio at
  all* — no `AudioContext`, no sound calls. A volume slider over silence would
  be a control that does nothing, so the ticket was expanded to include a small
  WebAudio SFX layer (kick, tackle, goal, conceded, whistle, lane-cover) that
  the slider actually governs. The context is created lazily on the Kick Off
  click, which is the gesture browser autoplay policy requires. Actual effort was
  closer to 5 points than 2.
- **PR-104 was already done** before this pass: `scoreGoal()` already set
  `game.shake = 16` and `showBanner()` already drove `drawGoalBanner()`. No
  change was made. The board's P2 estimate should be reclaimed.
- PR-103 shortens the existing "HALFTIME!" title flourish from 110 to 60 frames
  since the diagram now carries the explanation.

---

## EMPIRES / Age of Dave (`/empires/`)

The game itself is a compiled C++/SDL WASM binary. Everything here is
shell-level work in `empires/index.html` and `empires/assets/shell.js`; the
binary is not rebuilt.

| Ticket | Priority | Task & Scope | Acceptance Criteria | Pts | Status |
|---|---|---|---|---|---|
| EM-101 | P0 | Wasm asset loading progress bar | Byte-percentage loader for the `.wasm` download. | 3 | **Already shipped** |
| EM-102 | P1 | Pre-match shortcut guide | A modal of RTS bindings shown on first visit, reachable afterwards from a "? Controls" pill. | 2 | **Shipped** (corrected) |
| EM-103 | P2 | Performance telemetry overlay | `F3` toggles an overlay with FPS, average/peak frame time, renderer, and SIMD status. | 2 | **Shipped** |
| EM-104 | P2 | Mobile WebGL fallback notice | A dismissible advisory when WebAssembly, WebGL, or WASM SIMD is missing or degraded. | 2 | **Shipped** |
| EM-105 | P3 | Audio focus pause handling | Audio contexts suspend when the tab is backgrounded and resume on refocus. | 2 | **Shipped** |

**Notes.**

- **EM-101 was already done** in commit `a546920`: `shell.js` already replaced
  Emscripten's default loader with a `fetch` + byte-counter that drives
  `#loadbar-fill`. No change was made.
- **EM-102's stated bindings were wrong.** The ticket specified
  `Ctrl+# Groups`, but no control-group binding exists in this build — a string
  scan of `aoe2-clone.wasm` turns up box-drag selection, `Shift` add/toggle,
  right-click command, action panel, build hotkeys, `Esc` cancel, and `H` help,
  and nothing for numbered groups. The guide documents the bindings the binary
  actually implements. Adding real control groups is an engine change and needs
  its own ticket against the `aoe2-clone` source.
- EM-103 reports the simulation as "local — no network". This build has no
  networked lockstep (multiplayer is desktop-only, per `empires/progress.md`),
  so there is no latency figure to display and none is invented.
- EM-105 wraps the `AudioContext` constructor rather than reaching into SDL's
  glue, and only resumes contexts it suspended — a deliberately muted context
  stays muted.

---

## Cross-Site Platform & Hub (`/` and global)

| Ticket | Priority | Task & Scope | Acceptance Criteria | Pts | Status |
|---|---|---|---|---|---|
| HUB-101 | P0 | SSL & www canonical redirect | `www.mixmash.games/*` 301s to `mixmash.games/*`. | 1 | **Infra** (partial) |
| HUB-102 | P1 | Global nav top-bar component | One shared component (`src/kit/nav.js`) on every subpath: ← MixMash Hub, Mute All, Fullscreen, GitHub. | 3 | **Shipped** |
| HUB-103 | P2 | Animated card hover previews | Homepage game cards run a CSS micro-loop on hover or keyboard focus, paused at rest and disabled under reduced-motion. | 3 | **Shipped** |
| HUB-104 | P3 | Offline service worker / PWA | A network-first service worker precaches each game shell, plus a web app manifest and an offline fallback page. | 5 | **Shipped** |

**Notes.**

- **HUB-101 cannot be fully closed from this repo.** The canonical host is
  GitHub Pages (`CNAME` + `.nojekyll`), where apex/www handling is DNS and
  repository-settings configuration, not a file in the tree. What *was* done:
  a `redirects` rule in `vercel.json` covers the Vercel deployment. The GitHub
  Pages side still needs, outside this repo:
  1. a DNS `CNAME` record for `www.mixmash.games` → `davehomeassist.github.io`;
  2. `mixmash.games` set as the custom domain in repo Settings → Pages, with
     **Enforce HTTPS** enabled.
  GitHub Pages then issues the certificate and serves the apex redirect.
- HUB-102's "Mute All" is a real global control, not a per-game flag: the
  component wraps the `AudioContext` constructor (so it must load *before* game
  scripts), suspends every context the page creates, mutes `<audio>`/`<video>`
  elements, and fires a `mixmash:mute` event for games that manage their own
  gain graph. The nav replaced the per-page back pills in `/garden/`,
  `/empires/`, and `/pitch/`, which are now removed.
- HUB-103 uses the CSS path of "CSS/WebM micro-loop"; no video assets were
  added, so there is no extra payload.
- HUB-104 is deliberately **network-first, not cache-first**. On a static host a
  cache-first worker is how a site gets stuck serving a build nobody can flush.
  Fresh content always wins while online; the cache is only an offline fallback.
  `/api/*` and all cross-origin requests are never cached.

---

## Summary

| Board | Shipped | Already shipped | Out of repo | Infra |
|---|---|---|---|---|
| MIXMASH (`/play/`) | 5 | — | — | — |
| MarsScape (`/mars/`) | 5 | — | — | — |
| Garden OS (`/garden/`) | — | — | 5 | — |
| Pitch Riot (`/pitch/`) | 4 | 1 | — | — |
| EMPIRES (`/empires/`) | 4 | 1 | — | — |
| Hub & platform | 3 | — | — | 1 |
| **Total** | **21** | **2** | **5** | **1** |

## Follow-up tickets this pass surfaced

1. **MarsScape:** `boots.speed` and `scanner.geode` are inert — no engine rule
   reads them. Either wire them into travel duration and gather rolls, or drop
   them from `EQUIP_STATS` and the equipment copy.
2. **EMPIRES:** no control-group bindings exist. If they are wanted, they are an
   engine change in the `aoe2-clone` C++ source, not a shell change.
3. **Garden OS:** re-file GD-101…GD-105 against `DaveHomeAssist/garden-os`.
4. **Pitch Riot:** the new SFX layer has no music bed, and the volume slider is
   master-only. A music/SFX split would match the `/play/` audio matrix.
5. **CI:** `npm run smoke:play` only covers `/play/`. `/pitch/`, `/mars/`, and
   the `/empires/` shell now have testable hooks (`window.__pitch`,
   `window.validateSaveCode`, `window.__empiresTelemetry`) and could get
   equivalent smoke rails.

## Verification

- `npm test` — 48 passing.
- `npm run vercel-build` — clean.
- `npm run smoke:play` — the pinned Playwright Chromium revision was unavailable
  in the authoring sandbox, so this ran in CI rather than locally. A 52-check
  browser harness covering every ticket above (including mobile viewports for
  MM-103, MS-101, and PR-101) was run against the local Chromium and passed in
  full.
