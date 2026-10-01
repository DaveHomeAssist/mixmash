# Concert Tycoon (working title)

**Status:** pre-production. There is no playable build yet; this folder holds design and planning documents only.
The `tycoon/` folder name is a placeholder until the name decision ([CT-DEC-06](docs/DECISIONS.md#ct-dec-06-name-and-route)) is made.

Concert Tycoon is a management game in the tradition of RollerCoaster Tycoon and Zoo Tycoon, set in concert promotion and live production. The player builds a venue, books an artist, sells the show, gets through show night and settles the money. A career starts with a rented parking lot and a PA, and ends with the player's name on an arena.

## Documents

| File | Owns | Status |
| --- | --- | --- |
| [`docs/GDD.md`](docs/GDD.md) | The design: pillars, modes, the first playable loop, progression, and what each system includes now versus later | Draft |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decision log, CT-DEC-01 to CT-DEC-07 | 5 proposed, 1 open, 1 accepted |
| [`docs/RULES.md`](docs/RULES.md) | Rules specification: every formula with its inputs, outputs, units and adjustable value names, plus a worked example | Draft |
| [`docs/SAVE_FORMAT.md`](docs/SAVE_FORMAT.md) | Save schema version 1, the save namespace, validation and migration policy | Draft; the namespace is provisional |
| [`progress.md`](progress.md) | Log of each work session | Active |

### Documents that start later

| File | Starts when |
| --- | --- |
| `docs/BALANCE_BASELINE.md` | The engine exists. It is written by a simulation script, never by hand, and CI checks it against the code. |
| `docs/MANUAL.md` | The first playable loop is stable. Until then, the in-game tutorial is the manual. |
| `docs/WORLD.md` | There is more than one artist. It covers fictional artists, venues and genres, plus a record of name checks. |
| `docs/ART_DIRECTION.md` and a render contract module | Before any art is commissioned. The MarsScape DEC-79 history shows why. |
| `ROADMAP.md` | After the first playable. Career tiers 1 to 5 become phases, each with its own done criteria. |

## Source-of-truth rules

1. **Numbers live in code.** Once `tycoon/data.mjs` exists, it owns every adjustable value. The documents use the value's name (for example `DOOR_SPLIT`), not the number, apart from worked examples, which are labeled as such. Until then, the starting values are listed in `docs/RULES.md`.
2. **Generated documents say so.** Any generated file starts with a "do not edit by hand" header, and CI fails if it doesn't match the code.
3. **This folder is canonical.** The Notion page "Concert Tycoon Ideas" (DB | Capture) is where ideas come in, and it links here. If the two disagree, this folder wins.
4. **The design points to decisions.** Design text cites decision IDs (`CT-DEC-NN`), so changing a decision shows which parts of the design need another look.

## Planned architecture (pending CT-DEC-02)

This follows the MarsScape split in `mars/`:

- `tycoon/engine.mjs`: the game rules, with no DOM access. All randomness comes from a seeded generator, so the same seed and the same choices always produce the same result. Tested with `node --test`.
- `tycoon/data.mjs`: adjustable values and content tables (artists, objects, incidents).
- `tycoon/game.js`: a canvas isometric board for the Build and Show night phases, and HTML panels for Book, Promote and Settle so those screens stay accessible.
- Saves go through the shared `src/kit/save.js` store (see `docs/SAVE_FORMAT.md`).
- A `window.render_game_to_text()` hook, the MIXMASH and MarsScape convention, lets a Playwright smoke test play the loop.
- Art starts as placeholder tiles drawn in code. MarsScape keeps a code-drawn renderer as its fallback in the same way.

## Verification (planned; none of these exist yet)

| Command | Checks |
| --- | --- |
| `npm test` (adding `tycoon/test-engine.mjs`) | Every formula in `docs/RULES.md`, including the worked example to the dollar |
| `npm run sim:tycoon` | Regenerates `docs/BALANCE_BASELINE.md`; CI fails if it changes |
| `npm run smoke:tycoon` | Plays Book through Settle in a browser, then saves, reloads and resumes |

## Publication note

This repository is public, and `gh-pages` is served as it is (`.nojekyll`), so once merged these files can be read at `mixmash.games/tycoon/...`. There is no `index.html` here, so there is no game route, hub card or sitemap entry until the first playable ships.
