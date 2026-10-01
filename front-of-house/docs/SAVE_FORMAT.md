# Front of House Save Format

**Status:** Draft · **Schema version:** 2 (since 2026-10-01; version 1 saves convert, see [Migrations](#migrations)) · **Namespace:** `front_of_house_v1` (fixed by [CT-DEC-06](DECISIONS.md#ct-dec-06-name-and-route); `SAVE_NAMESPACE` in `data.mjs`)

> The namespace is the `localStorage` key. Renaming it means migrating every existing save, so it stays fixed.

## Storage

Saves use the shared studio store in `src/kit/save.js`:

```js
const store = MixKitSave.createSaveStore('front_of_house_v1', { version: 2, migrate: (state) => migrateSave(state) });
```

The store wraps game state in an envelope:

```json
{ "ns": "front_of_house_v1", "v": 2, "savedAt": "2026-10-01T00:00:00.000Z", "state": { } }
```

- `exportCode()` and `importCode(code)` give portable base64 save codes, the same format MarsScape used when it moved sites. The game does not call `importCode` directly: it decodes the code first and only writes it if `ns` is `front_of_house_v1` and `state.schema` is a known version (1 or 2), because `importCode` saves whatever it parses. An older version is converted with `migrateSave` before `normalizeState` checks it.
- `clear()` resets the save.
- The namespace follows the studio pattern (`marsscape_v1`, `empires_v1`).

## State, version 2

The save stores the **player's choices and the seed**, not computed results. Capacity, demand, satisfaction and money are recomputed by the engine from the choices every time a save loads. The only exception is the settlement history, which keeps final numbers as a permanent record.

```js
{
  schema: 2,
  seed: 0,                    // uint32; feeds the RNG (RULES.md, General conventions)
  phase: 'book',              // 'book' | 'build' | 'promote' | 'show' | 'settle' | 'done'
  cash: 3000,                 // whole dollars
  venue: {
    id: 'lot',
    grid: { w: 24, h: 16 },
    objects: [                // placement order is kept
      { type: 'stage', x: 10, y: 0, rot: 0 }
    ]
  },
  booking: { artistId: 'sodium-arcade', deal: null, terms: null },  // deal: 'guarantee' | 'door' | null;
                              // terms: { ask, drawMult } quoted at booking (R-19), or null
  promotion: { price: 20, ads: { flyers: 0, social: 0, radio: 0 }, confirmed: false },
  show: null,                 // { incidentId, responseId, venueRep } once the doors open; venueRep is the
                              // reputation the show was sold with (settlement changes the live one)
  reputation: { venue: 0, artists: { 'sodium-arcade': 0 } },
  history: [],                // settlement records: { showId, seed, deal, attendance, satisfaction, net, artistPay, result, weakest, settledAt }
  unlocks: { club: false }    // set at the settlement that meets the Lot goal (R-20); never cleared except by Start over
}
```

Version 2 has the same shape as version 1; the numbers are on the Lot scale. The Lot career (Phase 4) added two optional fields without a version bump, as the migration policy allows: `booking.terms` (null for a booking made before it, which then settles on the act's base ask and draw, exactly as it was sold) and `unlocks` (defaults to `{ club: false }`). Object `type` values allowed: `stage`, `pa-s`, `pa-m`, `lights`, `bar`, `restroom`, `gate`, `exit`, `fence`.

## Validation (required on every load and import)

`src/kit/save.js` treats any object without `ns` and `state` fields as an old raw save and passes it straight through. That means a pasted save code can hand the game any JSON at all. Every value returned by `load()` or `importCode()` must therefore go through `normalizeState(state, fallbackSeed)` from `front-of-house/engine.mjs` before use. It does the following, and `front-of-house/test-engine.mjs` tests each step:

1. Reject anything that is not an object, or whose `schema` is unknown, and start a new game instead.
2. Clamp numbers to their valid ranges: cash as a whole number, `price` from 10 to 40, ad spend at 0 or more, reputation from 0 to 100, relationships from −100 to 100. Booking terms need a whole-number ask of at least $1 (settlement divides by it); terms without one are dropped, and the booking settles on the act's base ask.
3. Drop objects with an unknown `type`, objects outside the grid, and overlapping objects.
4. Reset `phase` to the last phase the remaining state can support. For example, `promote` without a chosen deal goes back to `book`. A save rolled back to before the show loses its show and its confirmed promotion; the cash it already paid is not refunded, which only matters for damaged or edited saves.
5. Never read computed values from the save; recompute them. The incident comes from the seed, not from `show.incidentId`.

## Migration policy

- Bump `version` (and `schema`) only for changes that would break older saves. Adding an optional field is handled by `normalizeState` defaults.
- Each version step gets a pure migration function, called through the store's `migrate(state, fromVersion)` hook, applied one version at a time.
- Each version keeps a frozen example save in `front-of-house/test/fixtures/save-vN.json` (versions 1 and 2 exist). Tests load every fixture, migrate it to the current version and check the result with `normalizeState`.
- A new namespace (for example `front_of_house_v2`) is only used for an intentional fresh start. In that case, an import screen accepts save codes from the old namespace.

## Migrations

`migrateSave(state)` in `front-of-house/engine.mjs` is pure and applies one version step at a time. The store calls it through its `migrate` hook, and the game also calls it on every load and import before `normalizeState`.

| From | To | Why | What changes |
| --- | --- | --- | --- |
| 1 | 2 | Phase 3 retuned tier 1 to the Lot (CT-DEC-09): the permit went from 300 to 150, and every per-person and money value in `data.mjs` was halved. The artist Velvet Static was renamed Sodium Arcade (CT-DEC-03 name checks) | The artist id `velvet-static` becomes `sodium-arcade` in the booking and the relationships. Cash, ad spend, and each history record's attendance, net and artist pay are halved (rounded to the nearest whole number). A show in progress continues on the new scale; because every cost halved and the ad slider moved from steps of 50 to steps of 25, the money it already spent converts exactly. A finished show (`done`) is closed with Next show, which the Lot career opens after any night (R-21), or with Start over when the next show is unaffordable (which, like any Start over, keeps only the layout and starts a new history), so a sheet signed at the old scale is never replayed at the new one. |

Tests: the frozen version 1 fixture migrates to the expected state; a version 1 save in the middle of a show converts back to exactly the same version 2 state; a version 1 save code imports through the store and through the game's Save and load panel.

## Save points

- Autosave when each phase ends, and after each settlement.
- No autosave during the 2-minute show night playback. Reloading during a show resumes at the start of show night, with the same seed and the same incident.

## Test checklist (before saves ship)

- [ ] Save, reload and resume in every phase
- [ ] Reset clears the save and starts a new game
- [ ] Export, then import into a clean browser, gives the same state
- [ ] A tampered or invalid save code is rejected, or normalized without crashing
- [ ] Every fixture migrates to the current version
- [ ] Same seed and same choices give the same settlement after reload
