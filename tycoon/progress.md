Original prompt: Create the starter documentation for the Concert Tycoon game concept (Notion capture "Concert Tycoon Ideas") so the project is in good shape from the start, and record the document locations in Notion.

## 2026-10-01: Pre-production documents

- Created `tycoon/README.md`, `docs/GDD.md`, `docs/DECISIONS.md`, `docs/RULES.md` and `docs/SAVE_FORMAT.md`. No game code, route, hub card or sitemap entry was added.
- `GDD.md` combines both drafts from the Notion page (Draft B was cut off partway through "Production Stack, Audio") with the one-page design for the first playable loop. Section 9 records each choice made where they differed.
- Decisions CT-DEC-01 to CT-DEC-05 are **Proposed**, CT-DEC-06 (name and route) is **Open**, and CT-DEC-07 (this folder is canonical; Notion links here) is **Accepted**.
- Corrections to the earlier one-page draft that was shared in chat:
  - The fail rule "cash below $0 after settlement" could never trigger, because R-12 blocks a show whose upfront costs exceed cash. It is replaced by **Retry when net is below $0 or satisfaction is below 60**.
  - The bar threshold changed from 1 bar per 150 people to `BAR_RATIO` 250, so the worked example's single bar has enough capacity, as its cost assumed.
  - The worked example is now computed from every rule instead of an assumed satisfaction of 75. Satisfaction comes out at 85, so the guarantee nets +$495 and the door deal +$1,341, against +$345 and +$1,191 in the earlier draft.
- Checked: the worked example in `RULES.md` was recomputed by a Node script from the starting values table.

## 2026-10-01: Decisions accepted

- Dave accepted CT-DEC-01 to CT-DEC-05. CT-DEC-06 (name, route and save namespace) stays open. The MIXMASH-universe question stays open; CT-DEC-03 now records what joining that universe would mean.

## TODO

- Dave: decide CT-DEC-06 (name, route, save namespace) and whether the game shares the MIXMASH universe.
- When the engine starts: `tycoon/data.mjs` takes over the starting values table, `tycoon/test-engine.mjs` adds the worked example as test `R-WORKED-01`, and a simulation script begins generating `docs/BALANCE_BASELINE.md`.
- When the first route ships: add a row to the root `README.md`, a `CHANGELOG.md` entry, a hub card and a sitemap entry.
