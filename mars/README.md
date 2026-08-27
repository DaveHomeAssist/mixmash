# MarsScape

MarsScape is a browser colony skiller with a shared JavaScript engine, a Node authority API, signed local fallback saves, and a canvas-backed isometric client.

## Gameplay Parity with MarsScape

The port from the standalone `marsscape` repository is **complete**: 144/144 data
features and 23/23 behavioural systems, with zero retirements. `mixmash/mars` is now
canonical for gameplay as well as production.

`mars/parity/` holds the frozen baseline, the id mapping, and the generated ledger that
proves it. `npm test` re-checks the mapping in both directions and fails on a stale
ledger; `npm run sim` re-runs the balance verdicts. See `mars/docs/MANUAL.md` to play and
`mars/docs/BALANCE_BASELINE.md` for the numbers.

The simulator compares gathering rates with the committed machine baseline and fails
on a loss greater than 10%, a removed rate band, or missing baseline evidence. For an
intentional rebalance, review the new rates and run `npm run sim -- --accept`.

## Local Run

```bash
npm run start:mars
```

Open <http://localhost:8787/mars/>. Use `MARSSCAPE_PORT=8788 npm run start:mars` if 8787 is busy.

## Verification

```bash
npm test
```

## Art production

DEC-79 locks full isometric pixel art for the playable board while preserving the procedural renderer as a failure-safe fallback. Renderer measurements live in `render-contract.mjs`; the production contract, audit, decisions, and golden-slice gates live in:

- `docs/ART_DIRECTION.md`
- `docs/ART_ROADMAP.md`
- `docs/ART_AUDIT.md`
- `docs/DECISIONS.md`
- `art/golden-slice.json`
- `art/golden-scene.json`
- `commissioned-art.mjs`
- `golden-scene.html`

Validate a candidate package and generate its review surfaces with:

```bash
npm run art:index
npm run art:validate
npm run art:report
npm run art:contact-sheet
npm run art:visual
npm run art:approve
npm run art:approve:golden
```

`art:index` regenerates network-safe runtime index v2 from valid present frames and binds each frame path to the exact exported PNG SHA-256. `art:report` refreshes the normal report plus fail-closed paid-test and full-golden reports; `art:validate` reports planned missing art and rejects index or report drift. `art:approve` is the deliberately small paid-test gate (four assets, eight PNG exports, four structurally valid layered sources); `art:approve:golden` is the full 26-asset/108-export machine gate. Neither command records human approval. `/mars/golden-scene.html` consumes their `machineReady` evidence. The full-golden v3 receipt additionally requires the v3 condition ledger: all 24 canonical beat/zoom/lighting tuples, four commissioned 1.0x lighting profiles, 1.0x fallback and reduced-motion reviews, 300 commissioned animated 1.0x performance samples, and the final human attestations in a commissioned 1.0x view. Its client integrity digest detects drift but is not authentication; canonical approval requires the exported receipt plus an external Git/review identity linked from `docs/DECISIONS.md`.

## API

- `GET /api/health` returns authority health.
- `POST /api/sessions` creates or resumes a canonical session.
- `GET /api/sessions/:sessionId` reads canonical state.
- `POST /api/sessions/:sessionId/commands` applies one command and returns the new state.

The browser sends commands such as `gather`, `build`, `smelt`, `craft`, `research`, and `startStorm`; it does not send trusted resource totals when the API is online.

## Production Deployment

The public game page is static on GitHub Pages at `https://mixmash.games/mars/`. The authority API is deployed separately on Vercel at `https://mixmash-marsscape-authority.vercel.app/api/` because GitHub Pages cannot run a Node server.

Required Vercel environment:

- `BLOB_READ_WRITE_TOKEN`: private Vercel Blob store token, supplied by the linked store.
- `MARSSCAPE_SECRET`: stable HMAC secret for server session signatures.
- `MARSSCAPE_ALLOW_ORIGIN`: `https://mixmash.games` in production.

The local server defaults to SQLite through `node:sqlite`. Vercel uses private Blob storage automatically when `VERCEL` is present. Blob writes use direct authenticated HTTP calls and are guarded by a short per-session lock so concurrent command requests serialize instead of overwriting the latest canonical state.

## Operating Limits

- Request bodies are JSON-only, capped at 256 KB, and time out after 5 seconds.
- API rate limiting is in-memory per function instance; it protects accidental bursts but is not a global abuse-control system.
- Private Blob storage is durable but not a relational database. The session lock keeps normal gameplay commands consistent; very high write volume should move to Redis or Postgres.
- Static GitHub Pages can still load the offline fallback if the Vercel API is unavailable. Offline commands are signed locally and replayed when authority returns.
