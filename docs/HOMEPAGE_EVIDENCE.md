# Homepage catalog evidence

Reviewed 2026-10-05 against source baseline `bb44ccb245e6d89bc2f6e7cfaf9b65f6a8be5acd`
and live routes. Every player/control/save statement in the
[catalog](../src/hub/catalog.mjs) has a game-specific basis below. Only the
narrower verified control sets are advertised, not universal gamepad/touch support.

## mixmash

- Players: [player guide](PLAYER_GUIDE.md), character-selection CPU toggles and
  state output in [the game](../play/index.html) distinguish local versus and
  solo CPU. No real-time online multiplayer claim.
- Controls: keyboard bindings and Quick Fight in the game. Live pointer click
  on the visible audio prompt unlocked audio; Q started Quick Fight; holding D
  moved the human from x=-100 to x=28 as frame advanced from 0 to 27. Audio was
  running, prompt hidden, state playing. No forced click, direct start function,
  save import or injected state launched the game.
- Saving: [snapshot definitions](../play/snapshot-data.js), saveOptions, profile
  persistence and saveActiveMatchSnapshot use local storage. Supported snapshots
  are not a promise that every mode resumes.
- Physical gamepad/two-person device acceptance was not performed; the documented
  local versus mode is described without implying that hardware check.

## front-of-house

- Players/controls: single-player career and keyboard board shortcuts in
  [Manual](../front-of-house/docs/MANUAL.md#keyboard-and-display), backed by
  [game.js](../front-of-house/game.js) board event handlers.
- Live Door deal then Starter layout reaches Build, 13 objects, ready venue and
  $3,000 cash. Reload preserves phase, objects and cash.
- Saving: [Save format](../front-of-house/docs/SAVE_FORMAT.md), automatic local
  persistence under front_of_house_v1 and portable export/import codes.
- Publication: Dave's HOME-02 A sign-off approves the homepage listing only.
  Noindex and sitemap exclusion remain.

## pitch

- Players: [source](../pitch/index.html) creates a human, CPU and auto keepers.
  Live Kick Off reaches match state 1.
- Controls: keyboard handler. ArrowRight moved the player from x=288 to about
  x=424 in active play.
- Saving: loadAudioPrefs/saveAudioPrefs persist audio only; match state initializes
  on load. No resumable match claim.

## mars

- Players/controls: single colony state in [engine](../mars/engine.mjs), native
  resource buttons and keyboard tabs in [client](../mars/game.js).
- Live: wait for Authority online, Start Expedition, Gather North Iron Seam.
  Its charge label changes from 5/5 to 4/5 after the processed command. An earlier
  attempt clicked before asynchronous boot attached handlers; it was inconclusive.
- Saving: [README architecture](../README.md), LocalEnvelopeSigner, export/import
  and authority session persistence in client. Server sessions and local offline
  envelopes are distinct. Clearing browser session access is not account recovery.

## garden

- The [wrapper](../garden/index.html) embeds independent
  [Garden OS Story Mode](https://davehomeassist.github.io/garden-os/story-mode/).
- Live New Game and Start Story enter chapter-one planning. Escape clears the
  opening dialogue; a normal pointer click on Plant opens Select Crop with six
  selectable crops. Native setup/garden
  controls support mouse and keyboard. No multiplayer/gamepad claim is made.
- Live title/menu explicitly states three persistent Story Mode slots,
  export/import backup, and session-only Free Play and Planner. Save ownership
  is the embedded Garden OS origin. Backup controls were inspected; destructive
  save import/deletion was not exercised.

## empires

- [Shell](../empires/assets/shell.js) and live Command Basics identify mouse
  selection, right-click orders, keyboard lobby navigation and Space to start.
- Live Start skirmish dismisses the guide and renders the WebAssembly match.
  The [repository description](../README.md) identifies local solo AI skirmishes.
- No resumable campaign is promised. Treat a browser skirmish as a new session.

## Exclusions and boundaries

[PlayCards](../playcards/README.md) is Java/Swing/console and its browser route
returns 404. [Zelda2Mario](../zelda2mario/index.html) is a status dashboard with no
playable browser release. Neither is counted or selected. Full Cover Ops is an
explicitly external related link.

[Preview provenance](../assets/previews/README.md) records actual live screenshots.
These checks are not a complete game, physical-device or controller audit.
