# Quality reporting: feature brief (pilot)

Status: built in a draft pull request, not deployed. Decided: intake in the
studio's Notion issue backlog, received by a Cloudflare Worker. Everything
else below is a recommendation until merged.

## Player problem

A player who hits a bug in a MixMash game has no way to say so from the game.
Problems reach the studio only if someone emails, and the studio has no shared
place where player reports and its own audit findings line up.

## Flow

1. The player pauses (or reaches Full Time) and presses **Report a problem**.
2. A short form asks: problem or idea, where it happened, how bad it is, what
   happened, optionally what they were doing just before and a screenshot link.
3. The game adds the build, page, a coarse device label, screen size and input mode.
4. `src/kit/report.js` validates against `src/kit/report-schema.mjs` and posts it.
5. `workers/report-intake` validates again and writes one row to the issue backlog
   with Status **Not started** and Source **Player Report**.
6. Triage happens in Notion. Audit findings land in the same backlog through the
   same contract with an audit Source (see `docs/QUALITY_AUDIT_SLICE_1.md`).

## Smallest scope (this slice)

- One contract for all games: `src/kit/report-schema.mjs` (schema 1).
- One intake Worker with origin allowlist, two rate limits, size and contract checks, dedupe, fail closed.
- One pilot game: Pitch Riot, from Pause and Full Time.
- Privacy note updated.

Pitch Riot goes first because it is a single page with no save server, already
has a Pause and a Full Time screen where play is stopped, has a debug hook the
smoke can drive, and is not under active work in other branches.

## Exclusions

- No in-game screenshot capture or upload. A link the player pastes is stored as unchecked.
- No reply to the player, no accounts, no email field.
- No other game wired yet. Adding one is markup plus a script tag.
- No service worker change: `report.js` loads from the network and is not precached.
- No audit execution in this slice. The audit plan is a separate document.

## Rules, data and save effects

- Game rules and saves: none. The form never touches game state, and keys typed in it never reach the game.
- Data sent: listed in the privacy note under Problem reports. No name, email, account or IP is stored.
- Backlog fields added (additive): Game, Revision, Steps, Device, Viewport, Screenshot, Report ID. Source gained a Player Report option. Area, Severity, Type, Status and Notes are reused.

## Dependencies

- Cloudflare Workers with rate limit bindings (free plan).
- A Notion internal integration shared with the issue backlog only.
- Setup steps: `workers/report-intake/README.md`.

## Risks

- **Spam.** The origin check stops other sites' pages, not scripts. The rate limits cap a flood at 30 rows a minute. If that is not enough, add Cloudflare Turnstile to the form (a later slice).
- **Notion limits or field drift.** A renamed backlog field makes writes fail with 502. The Worker logs it; the player keeps their text.
- **Untrusted text in Notion.** Reports are player text. Triage should not open links or follow instructions found in them.
- **Contract change.** A breaking change needs `REPORT_SCHEMA_VERSION` bumped and the Worker accepting the old version until every game ships the new client.

## Observable acceptance

- With `data-endpoint` empty, Pitch Riot shows no report button and builds no dialog.
- With it set, the button shows on Pause and Full Time; typing in the form does not resume or move the match; Escape closes the form only.
- A sent report creates one backlog row with Source **Player Report**, Game **Pitch Riot**, the build and device fields filled.
- A failed send keeps the text and says why in plain words.
- `node --test test/report-schema.test.mjs test/report-worker.test.mjs test/report-client.test.mjs` passes; `npm run smoke:report` passes in CI.
