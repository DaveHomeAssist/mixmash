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
| [CT-DEC-10](#ct-dec-10-the-lot-career) | The Lot career: a roster, terms that follow the relationship, a four-part goal, and carrying on after a bad night | Proposed |
| [CT-DEC-11](#ct-dec-11-rooms-after-the-lot) | Rooms after the Lot: Fathom Hall, Loam Shell, Split Acre, Sandbox and a wet-lot scenario | Proposed |
| [CT-DEC-12](#ct-dec-12-hud-layout) | HUD layout: the board fills the window and the controls float in the lot's empty corners | Accepted |

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

*Note, 2026-10-01 (a record, not a change to this decision):* item 2 said the first playable draws placeholder tiles in code. Since commit `252833b` the board also draws eight provisional stand-in sprites from `front-of-house/sprites/`, with the code-drawn boxes as the fallback. They are not the commissioned pixel art item 3 governs (`ART_DIRECTION.md` section 7 calls them stand-ins). Their geometry lives in one table, `PROPS` in `board.js`, which serves as the interim render contract until the contract item 3 requires is written; markers, beams and click hit-testing read from it. Whether the stand-ins stay before that contract is Dave's call.

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

### Name checks (2026-10-01)

Moved to [`WORLD.md`](WORLD.md#name-checks), which now holds every name check. The first round, for reference: a web search for each name in quotes, with "band".

| Name | Result | Outcome |
| --- | --- | --- |
| Velvet Static | A real four-piece indie band from Nottinghamshire, UK, with releases on [Apple Music](https://music.apple.com/us/artist/velvet-static/1773921533) and [Bandcamp](https://velvetstatic2.bandcamp.com/) | Not usable; the first playable's act is renamed |
| Sodium Arcade | No act by that name (bands named Sodium and Arcade exist separately) | Used for the first playable's indie rock act (`sodium-arcade`) |
| Copper Wren | A real acoustic band from Tucson, Arizona ([site](https://copperwrenband.wixsite.com/copperwren)) | Not usable |
| Brasswick | A real annual brass band festival in Brooklyn run by the L Train Brass Band ([site](https://ltrainbrassband.com/brasswick)) | Not usable |
| Cobalt Porchlight, Tin Lantern Choir | No act by either name (Porch Light and Tin Bird Choir exist) | Held for the Phase 4 roster after a closer check |

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

## CT-DEC-10: The Lot career

- Date: 2026-10-01
- Status: Proposed (built in Phase 4 so it can be played; every value is in `data.mjs`, and Dave may change any of them)
- Owner: Dave Robertson
- Affects: booking, relationships, progression, the balance simulator ([RULES.md](RULES.md#the-lot-career) R-19 to R-21)

### Context

Tier 1 was one night. The GDD's career needs a run of shows on the Lot with a reason to care about each act, and an open balance question needed an answer: the door deal pays more than the guarantee on almost any single night at the fair price. Prototyping in the simulator showed that with only a sellout, reputation and cash goal, the door-only habit reached the Club fastest (median 3 shows against 6), so relationships did nothing.

### Decision

1. **A roster of three fictional acts** (`ROSTER`): Gravel Hymnal (folk, small and cheap), Sodium Arcade (indie rock, the first playable's act) and Juniper Switchboard (funk and soul, the biggest draw). The first show always offers Sodium Arcade and one more; later shows offer two of the three, chosen by the seed.
2. **Terms follow the relationship.** Each point takes 0.5% off the ask and adds 0.5% to the draw. At a relationship of −20 or below an act only plays for a guarantee. Juniper Switchboard is guarantee-only: an established act that never plays for the door, which also means a promoter needs cash before booking the act most likely to sell out the Lot.
3. **The Lot goal unlocks the Club:** one sellout of the Lot, venue reputation 60, $6,000 in the bank, and one act at a relationship of +20. A guarantee builds it by +5 a show. A door deal builds it faster when the act's share beats its ask and wears it down when the share falls well short (R-17): on the suggested layout the share never reached the ask in the paired comparisons, and on the budget layout it did on about 38% of door shows. The unlock stays once earned.

   *Correction, 2026-10-01 (after the Phase 4 merge):* this item said the +20 relationship is one "which only fair guarantees build". That was wrong. R-17 scores what the act is paid against its quoted ask whatever the deal, so a door deal that pays above the ask builds more than a guarantee. The rule is unchanged; only this description was corrected. The decision stays Proposed.
4. **A bad night does not end the career.** Next show is open after any settlement unless cash is below the cheapest show the next acts on offer will take ($1,025 on a door deal; more when both want a guarantee). Start over is always open and begins a new career with only the layout kept.

### Consequences

- In the simulator (300 seeds, up to 12 shows), careful play reaches the Club on 100% of seeds in a median of 7 shows (never fewer than 5), and careless play (first offer, door when allowed, suggested layout, free responses) on about 42%. Every act gets booked, and no careful career runs out of money. These are verdicts in the balance baseline, so a tuning change that breaks them fails CI.
- The relationship now matters across a run, which answers the single-night door-deal question without changing the single-show rules or the worked example.
- No save version bump: `booking.terms` and `unlocks` are optional fields with defaults, so a version 2 save from Phase 3 keeps playing exactly as it was booked.
- The careful strategy always prefers the budget layout at the Lot's scale, which suggests the light tower and the medium PA are rarely worth their cost on the Lot. Left as is for now; it is a balance question for Dave.

## CT-DEC-11: Rooms after the Lot

- Date: 2026-10-01
- Status: Proposed (built so it can be played; every value is in `data.mjs`, and Dave may change any of them)
- Owner: Dave Robertson
- Affects: the Club, the Amphitheater, the Festival Grounds, Sandbox, one scenario ([FUTURE.md](FUTURE.md), [WORLD.md](WORLD.md))

### Context

[FUTURE.md](FUTURE.md) listed gates before Phase 5, including a playtest sign-off and accepting CT-DEC-10. Those gates are still open for a public release. The build on 2026-10-01 was an explicit request to implement the planned phases anyway, keep `noindex`, and leave the hub card off. This decision records the calls that file left open, so the code is not an unspoken change.

### Decision

1. **The Club is a grid**, the same builder as the Lot. Not a fixed floor plan, and not both.
2. **The Lot stays bookable** after the unlock. Each room keeps its own layout. Offers, the permit and the goal do not reset when the player changes rooms.
3. **House PA.** Fathom Hall, Loam Shell and Split Acre have a house rig (`housePa: 'M'`). A rented PA is optional there and costs nothing when it is not placed. The Lot still rents one.
4. **Pillars.** Fathom Hall has four pillars. They occupy tiles and block sightlines with the same overlay as a restroom.
5. **Loam Shell.** 400 seats sell first, at their own price, then the lawn. A hold is 1, 2 or 3 nights. Each night has its own attendance, incident and sheet. Reputation and the relationship move once, on the last night. Each night charges its upfront cost again. A curfew is an incident on the shell and on the grounds, not on the Lot.
6. **Split Acre.** A second stage is a door-deal opener capped at `secondCap` (500). The site is not charged twice. A sponsor deal pays `SPONSOR_PAY` before doors and the ask is still paid to the act. Broadcast pays `BROADCAST_PER_HEAD` per head at settlement. The career is complete when the festival goal is met, and another day can still be booked.
7. **Goals** are `CLUB_GOAL`, `AMP_GOAL` and `FEST_GOAL` in `data.mjs`. They are not invented in the client.
8. **Modes.** Sandbox starts with `SANDBOX_CASH`, every room open, and no cash gate. The one scenario is a wet Lot: the suggested layout, `SCENARIO_CASH`, and rain forced.
9. **Saves stay on schema 2.** The new fields are optional. A Lot save from before this phase still plays. `normalizeState` fills the defaults.

### Not in this pass

A ticketing platform, a real slope (the shell is a grid with seats, not a hillside model), cancelling a remaining night, owning gear, a calendar, crew skills, Challenge and Endless. The Lot's numbers and the balance baseline are unchanged. The new tiers have engine tests and no simulator verdicts in CI yet. Art is a floor tint on the same prop sprites, not four venue looks. `noindex` stays, and there is no hub card, until Dave signs off the first playable.

### Consequences

- Name checks for the new acts and rooms are in [WORLD.md](WORLD.md). Cinder Meridian is a real act and is not used. Relay Hall was too close to Relay Town Hall. Marrow Shell was too close to the band Marrow.
- The cheapest Lot show is still $1,025. Careful Lot careers in the baseline are unchanged.

## CT-DEC-12: HUD layout

- Date: 2026-10-01
- Status: Accepted (Dave, 2026-10-01: every recommendation in [HUD.md](HUD.md) section 9, with the minimap deferred and kept on the roadmap)
- Owner: Dave Robertson
- Affects: the client layout (`index.html`, `styles.css`, `game.js`) and the board camera (`board.js`); not the rules, the engine or saves

### Context

The board is a column beside a long panel. The lot covers 8.6% to 24.3% of the window at desktop sizes and 7.8% on a phone, and most phases scroll the page ([HUD.md](HUD.md) section 1).

### Decision

1. **The board fills the window** in every phase, and a camera fits the lot to the space the HUD leaves, with zoom and pan.
2. **A corner HUD.** Panels anchor in the four corner triangles the lot's diamond leaves empty, under a slim top strip. In Build and Show they cover no more than 2% of the lot at the default zoom.
3. **Sheets for forms and documents.** Book, Promote, Settle and Done open a sheet on the right over the dimmed map, and the lot re-fits beside it.
4. **Phones** get a compact strip, the board on top and a bottom sheet, within [CT-DEC-04](#ct-dec-04-platform).
5. **Kept:** every rule, the engine, saves, the smoke rail's selectors and hooks, the production-desk look, and the interaction rules in `ART_DIRECTION.md` section 5.

### Settled on 2026-10-01

Dave accepted all seven recommendations in [HUD.md](HUD.md) section 9:

1. A corner HUD, not a docked drawer.
2. Sheets open on the right.
3. The mouse wheel zooms.
4. The MixMash nav keeps hub and mute in the top strip; fullscreen and the GitHub link move into the menu.
5. Phones get a bottom sheet.
6. **The minimap is deferred**, and it stays on the canonical roadmap as step 7 of the HUD build order ([ROADMAP.md](../ROADMAP.md#hud-layout-ct-dec-12)).
7. Near-opaque floating backplates join the production-desk look.

### Settled on 2026-10-02: panels never scroll

After step 2 shipped, Dave asked that the panels not scroll either. He agreed to all five recommendations ("I agree with your assessment"), recorded in [HUD.md](HUD.md) section 9:

8. No panel scrolls at 1024 × 700 and up; the smoke rail enforces it.
9. The settlement opens in its own wide window.
10. Deal explanations and introductions show on the first show only, then behind an info button.
11. Show history gets its own window, the only one allowed to scroll.
12. Phones get tabs in the bottom sheet.
13. This is built inside steps 3 and 4.

### Consequences

- The build order is in [HUD.md](HUD.md) section 10 and [ROADMAP.md](../ROADMAP.md#hud-layout-ct-dec-12). Step 1, the board camera, is next.
- The done criteria in [HUD.md](HUD.md) section 11 are checked by the smoke rail as each step lands.

### Evidence and links

- [HUD.md](HUD.md), with four mockups in `docs/hud/` laid over real board captures
