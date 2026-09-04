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
