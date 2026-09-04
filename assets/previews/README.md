# Landing gameplay previews

Captured from the public games on September 4, 2026, at 1000 × 650 CSS pixels,
device scale 1. These are real browser screenshots, encoded directly as JPEG at
quality 76. No generated artwork or game-state modifications are used.

| File | Source | Capture state |
| --- | --- | --- |
| `mixmash.jpg` | https://mixmash.games/play/ | Flume versus Zomboy, Electric Forest, CPU match |
| `mars.jpg` | https://mixmash.games/mars/ | Start Expedition, first colony view |
| `garden.jpg` | https://mixmash.games/garden/ | New Game → Start Story, opening raised-bed scene |
| `empires.jpg` | https://mixmash.games/empires/ | Start skirmish, initial settlement |
| `pitch.jpg` | https://mixmash.games/pitch/ | Kick Off, first half |

To refresh, open each source in a fresh temporary browser context, enter the
listed state through its controls, and capture at the same viewport and JPEG
settings. The shared `.mixnav` hub overlay was hidden only during capture;
in-game interfaces remain visible. Garden OS is the live story-mode iframe
served through the catalog route. Select an unobscured frame for the fighter
after activating its audio prompt.

Keep each preview below 160 KB and the combined set below 500 KB. The landing
reserves image dimensions, prioritizes the headliner, and lazy-loads supporting
previews. Run `npm run smoke:landing` after replacing an image; inspect the
resulting screenshots as well as the automated layout and asset-budget checks.
