# Concert Tycoon Decision Log

This file records Concert Tycoon decisions that affect more than one part of the game. IDs use the `CT-DEC-NN` prefix so they don't collide with MarsScape's `DEC-NN` series. A decision's status is one of **Open**, **Proposed**, **Accepted**, **Superseded** or **Rejected**. Only Dave moves a decision to Accepted.

| ID | Decision | Status |
| --- | --- | --- |
| [CT-DEC-01](#ct-dec-01-core-scope) | Structured tycoon with Sandbox and Scenario modes | Proposed |
| [CT-DEC-02](#ct-dec-02-engine-and-art) | Browser engine using the MarsScape split; isometric pixel art later | Proposed |
| [CT-DEC-03](#ct-dec-03-artists-and-venues) | Fictional artists and venues | Proposed |
| [CT-DEC-04](#ct-dec-04-platform) | Desktop browser first | Proposed |
| [CT-DEC-05](#ct-dec-05-multiplayer) | No multiplayer in v1 | Proposed |
| [CT-DEC-06](#ct-dec-06-name-and-route) | Final name and route | Open |
| [CT-DEC-07](#ct-dec-07-documentation-source-of-truth) | This folder is canonical; Notion links to it | Accepted |

## CT-DEC-01: Core scope

- Date: 2026-10-01
- Status: Proposed
- Owner: Dave Robertson
- Affects: game modes, the first playable, the systems list in the design doc

### Context

The Notion capture listed this as the blocking question: an open-world sandbox sim, or a structured tycoon with a Sandbox mode. Its own mode list (Career, Sandbox, Scenario) already describes a structured tycoon.

### Decision

Build a structured tycoon: a Career with objectives, plus Sandbox and Scenario as modes running on the same systems.

### Consequences

- Sandbox is the Career systems with the budget limits removed, so it adds little cost.
- No world streaming or world simulation is needed.
- **Risk:** in this genre, building is what people share. If the venue builder isn't fun, the management layer won't make up for it, so the first playable has to make building enjoyable as well as the money decisions.
- **Revisit if:** the main goal becomes a creative building toy rather than a management game.

## CT-DEC-02: Engine and art

- Date: 2026-10-01
- Status: Proposed
- Owner: Dave Robertson
- Affects: tooling, repository location, saves, testing, art pipeline

### Context

The Notion page listed Unity, Godot and Unreal Engine 5 to evaluate. Every MixMash Studio game runs in the browser (MIXMASH, MarsScape, PITCH RIOT, and Empires through WebAssembly). MarsScape already keeps its rules in `mars/engine.mjs`, tested with `node --test`, separate from a canvas isometric client. The studio save store already exists as `src/kit/save.js`.

### Decision

1. Plain JavaScript modules in the browser, with no build step: a rules engine with no DOM access (`tycoon/engine.mjs`), content and adjustable values (`tycoon/data.mjs`), and a canvas client (`tycoon/game.js`).
2. Isometric presentation. The first playable uses placeholder tiles drawn in code.
3. Commission isometric pixel art only after the loop is fun, and only once a render contract and art direction document exist (see MarsScape DEC-79).
4. Treat the crowd as density values per tile, not individual simulated people.

### Consequences

- No install is needed, and the game can share the studio's hosting, CI and save store.
- Deterministic seeded rules allow exact tests and balance simulations.
- **Revisit if:** a Steam or console release, 3D venues, or individually simulated crowds of tens of thousands become goals. In that case, evaluate Godot.

## CT-DEC-03: Artists and venues

- Date: 2026-10-01
- Status: Proposed
- Owner: Dave Robertson
- Affects: content, marketing, legal exposure

### Context

Using real artists and venues would need licensing. A tycoon game attaches fees, cancellations and bad reviews to its artists, which is riskier than MIXMASH's real-name parody roster (MIXMASH roadmap D1).

### Decision

Use fictional artists, venues and markets built on recognizable genre types. Record every name check in `docs/WORLD.md` once that document exists.

### Consequences

- No licensing cost and no risk of portraying real people badly.
- **Conflict to settle:** if Concert Tycoon shares the MIXMASH universe, this decision conflicts with MIXMASH D1. That question is open (design doc section 10, question 2).

## CT-DEC-04: Platform

- Date: 2026-10-01
- Status: Proposed
- Owner: Dave Robertson

### Decision

Desktop browser first, with mouse and keyboard. Touch layouts come after v1. Console is out of scope.

### Consequences

- The isometric board and HTML panels are designed for at least 1024 pixels of width first. Screens below 680 pixels keep every control reachable but may show the board in a reduced view.

## CT-DEC-05: Multiplayer

- Date: 2026-10-01
- Status: Proposed
- Owner: Dave Robertson

### Decision

No real-time or online multiplayer in v1. Challenge mode, when it arrives, stores best scores on the device, following MIXMASH's approach (roadmap D3: replays stored on the device, no server).

### Consequences

- No server, accounts or privacy scope in v1.
- **Revisit if:** co-promotion becomes a core pillar.

## CT-DEC-06: Name and route

- Date: 2026-10-01
- Status: Open
- Owner: Dave Robertson
- Blocks: the final save namespace in `SAVE_FORMAT.md`, any public route or hub card, and marketing

### Context

"Concert Tycoon" is a working title and has not been checked against existing titles or trademarks. `tycoon/` is a placeholder folder. Renaming after launch would change URLs and save keys and break existing saves, so this has to be settled before the first public playable.

### Options

Keep "Concert Tycoon" after a title check, or pick a distinct name. Choose the route and save namespace at the same time.

## CT-DEC-07: Documentation source of truth

- Date: 2026-10-01
- Status: Accepted (Dave asked for this document set to be created and indexed in Notion on 2026-10-01)
- Owner: Dave Robertson

### Decision

1. `tycoon/` in this repository is the canonical home for Concert Tycoon design, rules, decisions and save format.
2. The Notion page "Concert Tycoon Ideas" (DB | Capture) remains the place ideas come in and links to these files.
3. Adjustable values move into code (`tycoon/data.mjs`) as soon as that file exists. After that, documents use the value names, not the numbers.
4. Generated documents carry a "do not edit by hand" header and a CI check that they match the code.

### Consequences

- An idea written in Notion does not count as design until it is merged here.
- The two drafts on the Notion page were combined into `GDD.md` on 2026-10-01.

### Evidence and links

- `tycoon/README.md`
- Notion: https://app.notion.com/p/3ec255fc8f4480a6873adfdfa2b2c53b
