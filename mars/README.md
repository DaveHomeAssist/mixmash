# MarsScape

MarsScape is a browser colony skiller with a shared JavaScript engine and an optional Node authority server.

## Local Run

```bash
npm run start:mars
```

Open <http://localhost:8787/mars/>. Use `MARSSCAPE_PORT=8788 npm run start:mars` if 8787 is busy.

## Verification

```bash
npm test
```

## API

- `GET /api/health` returns authority health.
- `POST /api/sessions` creates or resumes a canonical session.
- `GET /api/sessions/:sessionId` reads canonical state.
- `POST /api/sessions/:sessionId/commands` applies one command and returns the new state.

The browser sends commands such as `gather`, `build`, `smelt`, `craft`, `research`, and `startStorm`; it does not send trusted resource totals when the API is online.

## Production Requirements

Full roadmap compliance requires a Node runtime for `mars/server.mjs`, not static GitHub Pages alone.

- Route `/mars/` to the static client served by `mars/server.mjs`.
- Route `/api/*` and `/mars/api/*` to the same server.
- Set `MARSSCAPE_SECRET` so response signatures are stable across restarts.
- Use Node 22.5+ so `node:sqlite` is available for the canonical session database.
- Set `MARSSCAPE_DB_FILE` if the host needs a durable volume path.

If `mixmash.games/mars` is served as a static-only GitHub Pages page, the client will run in offline fallback mode and the server-authoritative architecture is not fully deployed.
