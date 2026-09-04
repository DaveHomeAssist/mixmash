Original prompt: Implement the verified MixMash count correction on gh-pages. Update every stale public count string identified in this report to the 14-fighter, 11-arena shipped truth; preserve the already-correct /play/ metadata and body copy; and label the six fighter cards and four stage cards in home.html and brand.html as featured subsets rather than complete rosters. Make no unrelated design changes and perform no Notion writes. Run the existing play and catalog smoke tests, review the diff, commit, push, verify origin/gh-pages, and live-read back every corrected location.

## Progress

- Confirmed the canonical clean checkout is `DaveHomeAssist/mixmash` on `gh-pages`, matching `origin/gh-pages` at `9eb99a6` before editing.
- Confirmed the shipped `/play/` source and live selectors expose 14 fighters and 11 arenas.
- Corrected stale public totals in `index.html`, `home.html`, and `brand.html`; preserved the already-correct `/play/` copy.
- Labeled the six fighter cards and four arena cards in `home.html` and `brand.html` as featured subsets.
- Passed `npm run smoke:play` and all 35 checks in `npm run smoke:catalog`.
- Verified the changed local surfaces with Playwright and visually inspected the landing, home, brand, and character-select screenshots.

## TODOs

- No implementation TODOs remain for this scoped correction.

## Landing polish — September 4, 2026

- Preserved the neon tokens, typefaces, static hosting, and 14-fighter / 11-arena truth.
- Added a full-width MIXMASH feature, a balanced four-game grid, and optimized real gameplay previews with capture provenance.
- Reworked mobile navigation into two unclipped rows with 44px targets; stretched native Play links across card primary areas while preserving secondary links.
- Standardized release labels and Play actions, marked external destinations, rewrote Age of Dave for players, and added a closing play/feedback section.
- Raised muted-text contrast and authored focus-visible states; retained interaction-only decorative motion and disabled it for reduced-motion users.
- Added `smoke:landing` to CI and documented local/live execution. The rail passed at 320, 390, 768, 1024, and 1440px with pointer/touch hit testing, keyboard order and activation, focus visibility, reduced motion, image budgets, and contrast checks.
- Inspected local fold/full-page screenshots. `npm test` passed 160/160; `npm run vercel-build`, `npm run smoke:play`, and all 35 `npm run smoke:catalog` checks passed.
- No gameplay runtime files, home/brand roster copy, dependencies, or Notion records changed.
