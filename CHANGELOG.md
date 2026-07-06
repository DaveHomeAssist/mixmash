# Changelog

All notable changes to the MixMash Studio site (`gh-pages` branch, served at mixmash.games).

## [Unreleased]

## 2026-07-03 — MarsScape refreshed to v0.4.0
- `/mars/` snapshot updated to "Beyond the Basin": region framework, world map, Piloting skill, Dune Sea. See [marsscape's own changelog](https://github.com/DaveHomeAssist/marsscape/blob/main/CHANGELOG.md) for detail.

## 2026-07-03 — MIXMASH Phase 1: stability, tests, SEO
- **Fixed:** NaN knockback bug — `src/combat.js` extracted as the canonical, hardened `calcKnockback`/`finite()` module; guarded at both hit sites in `play/index.html` (`checkHits`, `executeThrow`), plus screen-shake and a camera self-heal so a stray NaN can't stick in the entity pool. Formula unchanged for valid inputs.
- **Added:** first-ever test harness for the repo — `test/combat.test.js` (17 tests, 10 degenerate/NaN cases) and `.github/workflows/ci.yml`, path-filtered to `src/`/`test/`/`package*.json` so content-only pushes don't trigger it.
- **Added:** SEO layer — `assets/og-card.png` (1200×630 brand card), `og:image`/`twitter:card` meta on the homepage/`/play/`/`home.html`, `robots.txt`, `sitemap.xml` (6 URLs).
- **Added:** `ROADMAP.md` — production roadmap for the MIXMASH fighter (3 phases, DoD/checkpoints/verification standards per phase), including a "reality check" section correcting the original draft against the actual `play/index.html` build.
- CNAME cycled during the mixmash.games domain-binding process (see the DNS/cert incident in the studio's ops history) — `git pull --ff-only` before local work on `gh-pages`.

## 2026-07-03 — MixMash Studio hub consolidation
- Restructured the repo from a single-game Pages site into the studio hub: new homepage (`index.html`/`home.html`, Mainstage Neons brand tokens), `/play/` (the fighter, moved from repo root), `/mars/` (MarsScape snapshot), `/empires/` (aoe2-clone Vite build), `/garden/` (Garden OS story-mode iframe).
- Custom domain `mixmash.games` bound; HTTPS enforced once the cert issued.
- Favicon added (`favicon.svg`) as part of a favicon audit remediation pass (2026-06-20, prior to the hub restructure).

## 2026-04-04 — BPM Delay Calculator moved out
- Removed from this Pages site; relocated to its own repo (`bpm-delay-calculator`).

## 2026-04-02 — Initial GitHub Pages site
- First publish of the site (single game, pre-studio-hub).
