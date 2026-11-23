# Landing gameplay previews

Refreshed from the live browser games on October 5, 2026 at 1000×650 CSS pixels,
device scale 1. These are actual gameplay captures; no generated art or injected
game state. Shared hub navigation is omitted where noted.

| File | Live route | Capture state |
| --- | --- | --- |
| mixmash.webp | https://mixmash.games/play/ | Pointer unlocks audio, Q starts Quick Fight, D moves deadmau5 against the CPU |
| foh.webp | https://mixmash.games/front-of-house/ | Door deal, starter layout, reload into Build with 13 objects |
| pitch.webp | https://mixmash.games/pitch/ | Kick Off and ArrowRight movement against CPU |
| mars.webp | https://mixmash.games/mars/ | Expedition after confirmed iron gather, 5 to 4 charges; game navigation remains visible |
| garden.webp | https://mixmash.games/garden/ | New Game, Start Story, chapter-one garden |
| empires.webp | https://mixmash.games/empires/ | Start skirmish, initial settlement |
| hockey-havoc.webp | https://mixmash.games/hockey-havoc/ | 2026-11-23: HIT THE ICE!, held ArrowRight, Space jump, F slapshot; Gritty mid-jump, full health, puck in flight |

## Format

All previews are WebP, so the seven-game homepage stays well inside its 500 KB
initial-transfer budget.

The six October 5 captures were stored as JPEG quality 76 until 2026-11-23. That
day they were re-encoded to WebP from those JPEGs, with no new capture and no
change to the frames: Chromium's encoder (`canvas.toDataURL('image/webp', 0.8)`
in the Playwright v1.61.1 image), drawn at the same 1000×650. Quality 80 was
chosen after a sweep from 60 to 90. Against the source JPEGs, the lowest scores
were 38.3 dB PSNR and 0.984 luma SSIM (8×8 blocks), both on empires. Every image
was inspected side by side at 1:1 and 2×. The JPEG originals remain in Git
history before that change.

| File | JPEG q76 bytes | WebP q80 bytes |
| --- | ---: | ---: |
| mixmash | 26,329 | 14,274 |
| foh | 98,239 | 74,770 |
| pitch | 27,655 | 12,024 |
| mars | 71,450 | 46,934 |
| garden | 50,891 | 29,490 |
| empires | 97,690 | 69,168 |
| **Total** | **372,254** | **246,660** |

hockey-havoc.webp was captured losslessly at 1000×650 and stored as WebP at
800×520 (same aspect), Chromium quality 75, 11.6 KB.

## Share cards

The per-game share cards in `assets/og/` (`npm run hub:og`) and the studio card
`assets/og-card.png` (`npm run hub:social`) were built from the earlier JPEG
previews. Hockey Havoc's card came from a quality-76 1000×650 JPEG encode of its
frame. They were not regenerated for the WebP change. A later rebuild reads these
WebP files; check its output before committing it.

## Refreshing

Other captures omit only the shared MixKit hub control bar. Keep images below
160 KB each and measure total delivered homepage transfer below 500 KB. To refresh,
use fresh browser contexts and actual pointer/keyboard controls through these
journeys; inspect each image. Preserve meaningful game UI. Encode new captures as
WebP from a lossless source. Run smoke:landing.
