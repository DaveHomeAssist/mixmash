# Front of House Decision Log

This file records Front of House decisions that affect more than one part of the game. IDs use the `CT-DEC-NN` prefix, from the working title Concert Tycoon, so they don't collide with MarsScape's `DEC-NN` series. A decision's status is one of **Open**, **Proposed**, **Accepted**, **Superseded** or **Rejected**. Only Dave moves a decision to Accepted.

| ID | Decision | Status |
| --- | --- | --- |
| [CT-DEC-01](#ct-dec-01-core-scope) | Structured tycoon with Sandbox and Scenario modes | Accepted |
| [CT-DEC-02](#ct-dec-02-engine-and-art) | Browser engine using the MarsScape split; isometric pixel art later | Accepted |
| [CT-DEC-03](#ct-dec-03-artists-and-venues) | Fictional artists and venues | Accepted |
| [CT-DEC-04](#ct-dec-04-platform) | Desktop browser first | Accepted |
| [CT-DEC-05](#ct-dec-05-multiplayer) | No multiplayer in v1 | Accepted |
| [CT-DEC-06](#ct-dec-06-name-and-route) | Named Front of House; route `front-of-house/`, save key `front_of_house_v1` | Accepted |
| [CT-DEC-07](#ct-dec-07-documentation-source-of-truth) | This folder is canonical; Notion links to it | Accepted |
| [CT-DEC-08](#ct-dec-08-standalone-game) | A standalone game, outside the MIXMASH universe | Accepted |
| [CT-DEC-09](#ct-dec-09-career-tier-ladder) | Four career tiers from the art: Lot, Club, Amphitheater, Festival Grounds | Accepted |

## CT-DEC-01: Core scope

- Date: 2026-10-01
- Status: Accepted (Dave, 2026-10-01)
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
- Status: Accepted (Dave, 2026-10-01)
- Owner: Dave Robertson
- Affects: tooling, repository location, saves, testing, art pipeline

### Context

The Notion page listed Unity, Godot and Unreal Engine 5 to evaluate. Every MixMash Studio game runs in the browser (MIXMASH, MarsScape, PITCH RIOT, and Empires through WebAssembly). MarsScape already keeps its rules in `mars/engine.mjs`, tested with `node --test`, separate from a canvas isometric client. The studio save store already exists as `src/kit/save.js`.

### Decision

1. Plain JavaScript modules in the browser, with no build step: a rules engine with no DOM access (`front-of-house/engine.mjs`), content and adjustable values (`front-of-house/data.mjs`), and a canvas client (`front-of-house/game.js`).
2. Isometric presentation. The first playable uses placeholder tiles drawn in code.
3. Commission isometric pixel art only after the loop is fun, and only once a render contract and art direction document exist (see MarsScape DEC-79).
4. Treat the crowd as density values per tile, not individual simulated people.

### Consequences

- No install is needed, and the game can share the studio's hosting, CI and save store.
- Deterministic seeded rules allow exact tests and balance simulations.
- **Revisit if:** a Steam or console release, 3D venues, or individually simulated crowds of tens of thousands become goals. In that case, evaluate Godot.

## CT-DEC-03: Artists and venues

- Date: 2026-10-01
- Status: Accepted (Dave, 2026-10-01)
- Owner: Dave Robertson
- Affects: content, marketing, legal exposure

### Context

Using real artists and venues would need licensing. A tycoon game attaches fees, cancellations and bad reviews to its artists, which is riskier than MIXMASH's real-name parody roster (MIXMASH roadmap D1).

### Decision

Use fictional artists, venues and markets built on recognizable genre types. Record every name check in `docs/WORLD.md` once that document exists.

### Consequences

- No licensing cost and no risk of portraying real people badly.
- **Settled by CT-DEC-08:** the game is standalone, so fictional artists stand and MIXMASH's real-name parody roster (MIXMASH D1) stays out of it.

## CT-DEC-04: Platform

- Date: 2026-10-01
- Status: Accepted (Dave, 2026-10-01)
- Owner: Dave Robertson

### Decision

Desktop browser first, with mouse and keyboard. Touch layouts come after v1. Console is out of scope.

### Consequences

- The isometric board and HTML panels are designed for at least 1024 pixels of width first. Screens below 680 pixels keep every control reachable but may show the board in a reduced view.

## CT-DEC-05: Multiplayer

- Date: 2026-10-01
- Status: Accepted (Dave, 2026-10-01)
- Owner: Dave Robertson

### Decision

No real-time or online multiplayer in v1. Challenge mode, when it arrives, stores best scores on the device, following MIXMASH's approach (roadmap D3: replays stored on the device, no server).

### Consequences

- No server, accounts or privacy scope in v1.
- **Revisit if:** co-promotion becomes a core pillar.

## CT-DEC-06: Name and route

- Date: 2026-10-01
- Status: Accepted (Dave, 2026-10-01)
- Owner: Dave Robertson
- Affects: the game's name, its route, its folder, the save namespace in `SAVE_FORMAT.md`, the hub card and marketing

### Context

"Concert Tycoon" was the working title, and the folder was `tycoon/` until this decision. Renaming after launch would change URLs and save keys and break existing saves, so the name had to be settled before the first public playable.

### Decision

| | |
| --- | --- |
| Name | **Front of House** (FOH is also the front-of-house mix position, which fits the production-realism pitch) |
| Route | `mixmash.games/front-of-house/` |
| Folder | `front-of-house/` |
| Save namespace | `front_of_house_v1` (`SAVE_NAMESPACE` in `data.mjs`) |

### Title check: Front of House (2026-10-01)

| Title | Platform | How close |
| --- | --- | --- |
| [Front of the House](https://cryocannon9.itch.io/front-of-the-house) | itch.io | Nearly the same name; a small bakery-serving game |
| [FRONT of HOUSE (FOH)](https://play.google.com/store/apps/datasafety?id=com.timeless.foh&hl=en_GB) | Google Play | Same words; a utility app, not a game |
| [PlateUp!](https://store.steampowered.com/app/1599600/PlateUp/) | Steam | Uses "front of house" as a restaurant term, not as a title |

No major game uses the name. No trademark search was done; do one before any paid promotion.

### Title check: Concert Tycoon (2026-10-01)

A web search found these existing titles:

| Title | Platform | How close |
| --- | --- | --- |
| [Idle Concert Tycoon](https://play.google.com/store/apps/details?id=com.idle.concert.tycoon.inc&hl=en_US) | Google Play | Almost the same name; a casual idle game about running concerts |
| [Concert Kings: Idle Music Tycoon](https://www.bigbluebubble.com/home/games/concert-kings/) | Android, iOS | Similar name; idle band and tour management |
| [Festival Tycoon](https://store.steampowered.com/app/1326270/Festival_Tycoon/) | Steam | Different name, closest concept: design festival grounds, then run the event live, with career and sandbox modes |
| [Rock God Tycoon](https://store.steampowered.com/app/410840/Rock_God_Tycoon/), [Music Band Manager](https://store.steampowered.com/app/730410/Music_Band_Manager/), [Band Tycoon](https://www.bandtycoon.io/), [OFFBEAT](https://store.steampowered.com/app/4468030/OFFBEAT/) | Steam, web | Band or studio management rather than promotion |

No trademark search was done.

The recommendation was a distinct name that points at what sets the game apart from Festival Tycoon: promoter money decisions (deal types, settlement) and production realism.

## CT-DEC-07: Documentation source of truth

- Date: 2026-10-01
- Status: Accepted (Dave asked for this document set to be created and indexed in Notion on 2026-10-01)
- Owner: Dave Robertson

### Decision

1. `front-of-house/` in this repository is the canonical home for Front of House design, rules, decisions and save format.
2. The Notion page "Concert Tycoon Ideas" (DB | Capture) remains the place ideas come in and links to these files.
3. Adjustable values move into code (`front-of-house/data.mjs`) as soon as that file exists. After that, documents use the value names, not the numbers.
4. Generated documents carry a "do not edit by hand" header and a CI check that they match the code.

### Consequences

- An idea written in Notion does not count as design until it is merged here.
- The two drafts on the Notion page were combined into `GDD.md` on 2026-10-01.

### Evidence and links

- `front-of-house/README.md`
- Notion: https://app.notion.com/p/3ec255fc8f4480a6873adfdfa2b2c53b

## CT-DEC-08: Standalone game

- Date: 2026-10-01
- Status: Accepted (Dave, 2026-10-01)
- Owner: Dave Robertson
- Affects: content, artists, cross-promotion with MIXMASH

### Decision

Front of House is a standalone game. It does not share the MIXMASH DJ and festival universe, its roster or its parody names.

### Consequences

- CT-DEC-03 (fictional artists and venues) stands without conflict.
- The game can still sit in the MixMash Studio catalog and reuse its save store and conventions.

## CT-DEC-09: Career tier ladder

- Date: 2026-10-01
- Status: Accepted (Dave, 2026-10-01)
- Owner: Dave Robertson
- Affects: progression ([GDD section 5](GDD.md#5-progression)), the future `ROADMAP.md`, art scope

### Context

The GDD had five tiers, from a 100 to 300 club up to an arena or stadium. The tier ladder image in the art direction ([`ART_DIRECTION.md`](ART_DIRECTION.md)) has four, under the line "One venue. Endless nights."

### Decision

The career uses the four tiers from the art:

| Tier | Capacity |
| --- | --- |
| 1. The Lot | 50 to 150 |
| 2. The Club | 150 to 600 |
| 3. The Amphitheater | 600 to 2,500 |
| 4. The Festival Grounds | 2,500 to 25,000+ |

### Consequences

- The arena or stadium tier is cut; the festival grounds are the end state. GDD sections 1, 3, 5, 6 and 9 follow this.
- `ROADMAP.md`, when it starts, has four career phases, and the art needs four venue looks.
- The first playable's Oak St. Lot was permitted for 300 and its artist drew 150 to 260, above the Lot's ceiling of 150. Phase 3 retuned tier 1 (2026-10-01): the permit is 150, the draw 75 to 130, and every per-person and money value was halved, so every balance verdict still passes and the worked example halved with it. Version 1 saves convert to the new scale (`SAVE_FORMAT.md`).
