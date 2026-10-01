# AGENTS.md

## Status naming

Name work with one string everywhere (chat status title, session title, Notion
Status Check Runs "Human Name"):

`Project | 🚦 | Phase | Title → state, reason | MM-DD`

- 🚦: 🟢 complete and verified · 🟡 partial · 🔴 not started, blocked or failed · ⚪ unverifiable.
  Add ⏳ scheduled, 🙋 awaiting Dave or 🚧 blocked to 🟡/🔴/⚪, never to 🟢.
- Phase: Research, Design, Build, Audit or Scheduled. MM-DD: date of the latest light change.
- Every light change gets a new name: a `RENAME:` line in chat and the Notion row updated.
- Canonical source: https://github.com/DaveHomeAssist/skills/blob/master/status-naming.md

## Admin index

- Adding, removing or renaming a tracked file? Run `npm run admin:index` and commit
  `admin/catalog.json`. `npm test` fails until the index matches the tree.
- A file that does not describe itself (no heading, title or leading comment) needs a
  note in `admin/catalog-sources.mjs`.
- `/admin/` is public (noindex). Never add local paths, Notion links or links to
  private source; record where status lives, not the status itself.
