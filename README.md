# MixMash Studio

The studio hub at **[mixmash.games](https://mixmash.games)**, served from this repo's `gh-pages` branch (the live default branch — GitHub Pages "legacy" build, not an Actions deploy).

## What's here

| Path | What it is |
|---|---|
| `/` (`index.html`, `home.html`) | Studio homepage — brand tokens, game lineup |
| `/play/` | **MIXMASH** — a DJ-powered platform fighter (the flagship game; see `docs/PLAYER_GUIDE.md`) |
| `/mars/` | MarsScape — canvas-backed isometric client with a **server-authoritative backend** (see below). No longer a build snapshot of the [marsscape source repo](https://github.com/DaveHomeAssist/marsscape) — the two have diverged; do not overwrite one with the other. |
| `/empires/` | Age of Dave — restored RTS alpha launcher backed by the private `DaveHomeAssist/aoe2-clone` C++/SDL project; no longer the old web prototype |
| `/garden/` | Full-viewport iframe embed of the live Garden OS story mode (`davehomeassist.github.io/garden-os/story-mode/`) — never drifts |
| `ROADMAP.md` | Production roadmap **for the MIXMASH fighter specifically** — phased DoD/checkpoints/verification standards |
| `src/combat.js` | Canonical, tested knockback math for the fighter (`finite()` guard + `calcKnockback`) |
| `mars/engine.mjs`, `mars/server.mjs` | Shared MarsScape game engine + the Node authority server (SQLite locally) |
| `api/` | Vercel serverless functions — the production authority API (Blob-backed sessions) |
| `test/combat.test.js`, `mars/test-*.mjs` | Node's built-in test runner (`node --test`) — fighter combat math + MarsScape engine/API/handler tests |
| `.github/workflows/ci.yml` | CI — runs `npm test` on pushes to `gh-pages` touching `src/`, `test/`, or `package*.json` |

## Commands

```
npm install       # once
npm test          # node --test — combat math + MarsScape engine/API/handler tests
npm run smoke:play      # fighter resume/snapshot smoke test
npm run start:mars      # run the MarsScape authority server locally (SQLite) — http://localhost:8787/mars/
npm run vercel-build    # syntax-check all api/ and mars/ server files (what Vercel's build runs)
```

> **Windows note:** `mars/test-vercel-handler.mjs` can fail with `EBUSY: resource busy or locked` deleting a temp `.sqlite-shm` file — a Windows file-locking quirk in test teardown (`node:sqlite` WAL mode), not a real defect. All assertion-level tests pass; only the cleanup hook is affected.

There is no build step for the static site itself — `index.html`, `home.html`, `/play/`, and `/empires/` are served as-is by GitHub Pages. `/mars/` is a static client too, but talks to a **separate live backend**.

## MarsScape's architecture (as of 2026-07-06)

`/mars/` stopped being a build snapshot of the `marsscape` source repo — it was rebuilt in place as a server-authoritative game:

- **Client:** `mars/index.html` + `mars/game.js` (canvas isometric board) + `mars/styles.css`, reading `mars/assets/manifest.json`.
- **Authority API:** `mars/engine.mjs` (shared game rules) served two ways — `mars/server.mjs` (Node/SQLite, for local dev via `npm run start:mars`) and `api/*.mjs` (Vercel functions, for production). The client picks the API base from a `<meta name="marsscape-api-base">` tag in `mars/index.html`, currently pointed at `https://mixmash-marsscape-authority.vercel.app/api/`.
- **Trust model:** the server is authoritative — submitted client resource totals are ignored; new sessions always start from server state, and commands (`gather`, `build`, `smelt`, `craft`, `research`, `startStorm`) are applied server-side.
- **Offline fallback:** if the authority API is unreachable, the client runs a local, HMAC-signed offline mode (WebCrypto/IndexedDB) and replays queued commands once the API returns; tampered offline saves are rejected on restore.
- **Production deploy:** the Vercel project is `mixmash-marsscape-authority`, backed by a private Vercel Blob store (env: `BLOB_READ_WRITE_TOKEN`, `MARSSCAPE_SECRET`, `MARSSCAPE_ALLOW_ORIGIN`). See `mars/README.md` for full operating limits (256 KB/5s request caps, per-session write locks, in-memory rate limiting).

**This means the old redeploy recipe (`marsscape` repo → `npm run build` → copy `dist/index.html` into `mixmash/mars/`) is obsolete and would destroy this architecture if run.** The `marsscape` GitHub repo continues to exist as an independent single-file-build project; the two `/mars/` implementations have diverged and are not currently reconciled.

`/empires/` is now a truthful Age of Dave status/launcher surface using sprite atlases copied from `DaveHomeAssist/aoe2-clone`; the actual RTS remains a native C++/SDL app until a browser/WASM port is built. `/garden/` needs no redeploy — it's a live iframe.

## Conventions

- **`gh-pages` is the real default branch** and the one served at mixmash.games. A separate, older `main` branch holds an earlier, unrelated development history for the fighter and is not part of the live site — don't merge between them without checking first.
- The fighter's combat math is duplicated: `src/combat.js` (tested, canonical) and an inline copy inside `play/index.html` (the shipped game). Keep them hand-synced until the game imports the module directly (tracked in `ROADMAP.md` Phase 1).
- `mixmash_opts` in `localStorage` persists match options (volume, music, hitbox display, stage hazards, both players' control binds) — don't reset it casually.
- **Do not run the old MarsScape redeploy recipe** (copying `dist/index.html` from the `marsscape` repo into `mars/`) — see "MarsScape's architecture" above. `/mars/` is now its own multi-file app with a live backend, independent of the `marsscape` source repo.
