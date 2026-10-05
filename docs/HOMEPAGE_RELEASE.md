# Homepage acceptance snapshot

The approved [brief](HOMEPAGE_BRIEF.md) is implemented. This is the local
acceptance record from October 5, 2026. Delivery is independently established
by the commit on `gh-pages`, its [CI run](https://github.com/DaveHomeAssist/mixmash/actions/workflows/ci.yml),
GitHub Pages deployment and [live homepage](https://mixmash.games/).

## Implemented

Six directly playable entries, including Front of House as Early playable;
one catalog generates the HTML and installed-app metadata. Festival tickets use genuine gameplay captures,
with the same lineup in the social card. Game details document players,
controls and saving from [game-specific evidence](HOMEPAGE_EVIDENCE.md).
Light default, remembered dark choice, Games/Studio navigation, bounded layouts,
short-screen pagination, a useful ultrawide preview and Pick for me are included.
The dark-mode wordmark restores the studio gradient. Larger desktop headlines
use the existing introduction space, preserving the six-card layout.
Native links and detail navigation work without JavaScript. New homepage storage
is namespaced and never writes game save keys. First visits defer the game
worker until a game launches; existing worker clients retain offline access.

## Local verification

- `npm test`: 436 passing tests after adding the homepage catalog integrity checks.
- `npm run smoke:catalog`: 35 passing catalog checks.
- `SMOKE_GAMES=hub npm run smoke:mobile`: 36 passing checks across 12
  phone/tablet configurations, including 44px controls and bounded root layout.
- `npm run vercel-build` and `npm run hub:check`: syntax and generated HTML pass.
- `npm run smoke:landing`: Chromium and WebKit at 1440×900, 375×812,
  844×390, 320×256, 3840×1080, 768×900 and 320×812. Six reachable launch links,
  details, history, focus return, themes, disabled scripts/storage and transfer
  budget are checked. The short stress view is not a claim of browser zoom.
- A separate actual Chromium tab zoom of 200% yields 720×450 CSS pixels from
  1440×900; all six titles remain reachable through pagination without root overflow.
- axe-core 4.10.3: zero violations across 96 browser/theme/view combinations.
  Print shows all eight sections and all six cards. Reduced motion suppresses
  transitions and there is no idle looping animation.
- `test/hub-offline-smoke.mjs`: offline homepage and detail links work after worker
  activation, the prior cache is removed, and seeded game storage remains intact.
  This does not certify offline external embeds or uncached game binaries.
- MIXMASH was launched through its audio prompt using a real pointer action,
  then keyboard Quick Fight and movement. Other game-specific checks and
  limitations are recorded in the evidence document.

## Delivery and remaining proof

No pull request is used. The candidate must pass the required CI before it is
advanced directly to `gh-pages`; Pages and live bytes/behavior are checked after
that advance. The private board combines this source snapshot with provider
and live evidence without publishing private audit material.

Physical phones, tablets, controllers and two-person local play are not certified
by browser emulation. Front of House retains noindex and sitemap exclusion;
search promotion remains a separate decision. This update does not fix or
re-audit every game mechanic or older cross-project audit finding.

## Maintenance

Edit `src/hub/catalog.mjs` and `src/hub/template.html`, then run `npm run hub:build`.
Refresh real gameplay captures before `npm run hub:social`. Stage new files
before `npm run admin:index`; the catalog drift check must remain clean.
