# MixMash Studio

The studio hub at **[mixmash.games](https://mixmash.games)**, served from this repo's `gh-pages` branch (the live default branch — GitHub Pages "legacy" build, not an Actions deploy).

## What's here

| Path | What it is |
|---|---|
| `/` (`index.html`, `home.html`) | Studio homepage — brand tokens, game lineup |
| `/play/` | **MIXMASH** — a DJ-powered platform fighter (the flagship game; see `docs/PLAYER_GUIDE.md`) |
| `/mars/` | MarsScape — single-file build snapshot ([source repo](https://github.com/DaveHomeAssist/marsscape)). Manual snapshot; drifts until re-copied. |
| `/empires/` | EMPIRES — RTS prototype (Vite build, `--base=./`) |
| `/garden/` | Full-viewport iframe embed of the live Garden OS story mode (`davehomeassist.github.io/garden-os/story-mode/`) — never drifts |
| `ROADMAP.md` | Production roadmap **for the MIXMASH fighter specifically** — phased DoD/checkpoints/verification standards |
| `src/combat.js` | Canonical, tested knockback math for the fighter (`finite()` guard + `calcKnockback`) |
| `test/combat.test.js` | Vitest suite for `src/combat.js` — 17 tests, 10 covering degenerate/NaN inputs |
| `.github/workflows/ci.yml` | CI — runs `npm test` on pushes to `gh-pages` touching `src/`, `test/`, or `package*.json` |

## Commands

```
npm install   # once
npm test      # vitest run — validates src/combat.js
```

There is no build step for the site itself — `index.html`, `home.html`, and the sub-game folders are served as-is by GitHub Pages. `/mars/` and `/empires/` are pre-built artifacts copied in from their own repos.

## Deploying a sub-game snapshot

`/mars/` and `/empires/` are **manual build snapshots**, not live embeds:

```
# MarsScape example
cd ../marsscape && npm run build
cp dist/index.html ../mixmash/mars/index.html
cd ../mixmash && git pull --ff-only   # gh-pages auto-commits CNAME churn
git add mars/index.html && git commit -m "Refresh MarsScape to vX.Y.Z" && git push
```

`/garden/` needs no redeploy — it's a live iframe.

## Conventions

- **`gh-pages` is the real default branch** and the one served at mixmash.games. A separate, older `main` branch holds an earlier, unrelated development history for the fighter and is not part of the live site — don't merge between them without checking first.
- The fighter's combat math is duplicated: `src/combat.js` (tested, canonical) and an inline copy inside `play/index.html` (the shipped game). Keep them hand-synced until the game imports the module directly (tracked in `ROADMAP.md` Phase 1).
- `mixmash_opts` in `localStorage` persists match options (volume, music, hitbox display, stage hazards, both players' control binds) — don't reset it casually.
