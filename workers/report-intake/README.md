# MixMash report intake Worker

Receives problem reports from the games on mixmash.games and writes each one
as a row in the studio issue backlog in Notion. The Notion token lives only in
this Worker as a secret, so the static site never holds a key.

```
game (src/kit/report.js)  ->  POST /v1/reports  ->  this Worker  ->  Notion issue backlog
```

The contract both ends share is `src/kit/report-schema.mjs`. The Worker
accepts `source: "player"` only. Audit findings use the same contract and
mapping through audit tooling, not this endpoint.

## What it checks, in order

1. Path and method: `POST /v1/reports`, `OPTIONS` for CORS, `GET /health`.
2. Origin: only `ALLOWED_ORIGINS` (default `https://mixmash.games` and `https://www.mixmash.games`).
3. Configuration: without both secrets and both rate limit bindings it answers 503 and writes nothing.
4. Rate limits: 5 reports a minute per client, 30 a minute for the whole endpoint.
5. JSON only, 8 KB at most, then the contract.
6. Duplicate report ids are answered 200 and not written twice.
7. Notion errors are logged in Cloudflare and answered 502 without detail.

No name, email, account or IP address is stored. The client IP is only the
rate limit key inside Cloudflare.

## Setup (one time)

You need: the Notion workspace that holds the studio issue backlog, a
Cloudflare account, and a terminal with Node 20 or newer on your computer.
Nothing here costs money on the free plans. If any screen asks you to pick a
paid plan, stop there.

### 1. Make a Notion integration for the Worker

1. Open https://www.notion.so/profile/integrations and sign in.
2. Click **New integration**.
3. Name it `MixMash report intake`. For **Associated workspace**, pick the workspace that holds the issue backlog. For **Type**, leave **Internal**.
4. Click **Save**, then **Configure integration settings**.
5. Under **Capabilities**, tick **Read content** and **Insert content**. Untick **Update content**. Under **User capabilities**, pick **No user information**. Click **Save**.
6. Under **Internal Integration Secret**, click **Show**, then **Copy**. Keep this tab open. You paste it once in step 3.4 and nowhere else.

### 2. Give the integration the issue backlog, and only that

1. Open the studio issue backlog database in Notion as a full page (the link is in the hand-off note for this change, not in this public repo).
2. Click the **•••** menu at the top right of the page.
3. Click **Connections**, then **Connect to**, search for `MixMash report intake`, pick it and confirm.
4. Copy the database id: in the address bar, the 32 character run of letters and digits just before `?v=` (or at the end, if there is no `?v=`). You paste it in step 3.5.

### 3. Deploy the Worker

1. Open https://dash.cloudflare.com and sign in. In the left menu open **Compute (Workers)**, then **Workers & Pages**. If it asks you to choose a `workers.dev` subdomain, pick one (for example your name) and confirm. That subdomain becomes part of the Worker's address.
2. In a terminal, from a checkout of this branch:

   ```sh
   cd workers/report-intake
   npx wrangler@latest login
   ```

   `npx` downloads Wrangler, Cloudflare's command line tool, the first time. A browser tab opens: click **Allow**, then come back to the terminal.
3. Deploy:

   ```sh
   npx wrangler@latest deploy
   ```

   It prints the Worker's address, like `https://mixmash-report-intake.YOURSUBDOMAIN.workers.dev`. Copy it. Until the secrets below are set, the Worker answers every report with 503 and writes nothing.
4. Add the Notion secret. Paste the secret from step 1.6 when asked, then press Enter:

   ```sh
   npx wrangler@latest secret put NOTION_TOKEN
   ```
5. Add the database id from step 2.4 the same way:

   ```sh
   npx wrangler@latest secret put NOTION_DATABASE_ID
   ```
6. Check it. Open `https://mixmash-report-intake.YOURSUBDOMAIN.workers.dev/health` in a browser. It should show `{"ok":true,"configured":true}`. If `configured` is `false`, repeat steps 4 and 5.

### 4. Send one test report

Replace the address, then run:

```sh
curl -i -X POST https://mixmash-report-intake.YOURSUBDOMAIN.workers.dev/v1/reports \
  -H 'Origin: https://mixmash.games' \
  -H 'Content-Type: application/json' \
  --data '{"schema":1,"reportId":"0b6f3a52-7c1d-4e8a-9f20-5d4c3b2a1e00","source":"player","game":"pitch","revision":"setup test","kind":"problem","category":"other","impact":"minor","summary":"Setup test report, safe to delete","context":{"page":"/pitch/","device":"curl","viewport":"","inputMode":""}}'
```

Expect `HTTP/2 201`. Open the issue backlog: a row named **Setup test report, safe to delete** should be there with Source **Player Report** and Game **Pitch Riot**. Delete that row. Running the same command again answers 200 with `"duplicate":true` while the row exists, and 201 again once you deleted it.

If you get 502, the Worker reached Notion and Notion refused. In the Cloudflare dashboard open the Worker, then **Observability** (or **Logs**), and look for `notion create` or `notion query` with a status: 401 means the secret is wrong (step 3.4), 404 means the database is not shared with the integration or the id is wrong (steps 2.3 and 3.5), 400 means a backlog field changed name or type.

### 5. Switch reporting on in Pitch Riot

In `pitch/index.html`, set the report script's `data-endpoint` to the Worker's
address plus `/v1/reports`:

```html
<script type="module" src="../src/kit/report.js" data-mixkit-report data-game="pitch"
        data-endpoint="https://mixmash-report-intake.YOURSUBDOMAIN.workers.dev/v1/reports"></script>
```

Merge and let GitHub Pages deploy. The **Report a problem** button then shows
on Pitch Riot's Pause and Full Time screens. To switch reporting off again,
empty `data-endpoint`; the button hides and nothing is sent.

## Changing things later

- **Limits:** edit `[[ratelimits]]` in `wrangler.toml`, then `npx wrangler@latest deploy`.
- **Another origin** (a preview host, say): edit `ALLOWED_ORIGINS` in `wrangler.toml` and deploy.
- **Rotate the Notion secret:** in Notion, open the integration and refresh the secret, then run step 3.4 again.
- **A new game:** add the button markup and script tag with that game's `data-game` id from `GAMES` in `src/kit/report-schema.mjs`.

## Tests

`node --test test/report-worker.test.mjs` runs the handler with Notion and
the rate limit bindings faked. Nothing reaches Notion or Cloudflare.
