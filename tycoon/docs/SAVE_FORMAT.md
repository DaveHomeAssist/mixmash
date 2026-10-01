# Concert Tycoon Save Format

**Status:** Draft · **Schema version:** 1 · **Namespace:** `tycoon_v1` (**provisional**, blocked by [CT-DEC-06](DECISIONS.md#ct-dec-06-name-and-route))

> Do not ship a public build that writes saves until CT-DEC-06 fixes the name. The namespace is the `localStorage` key, so renaming it later means migrating every existing save.

## Storage

Saves use the shared studio store in `src/kit/save.js`:

```js
const store = MixKitSave.createSaveStore('tycoon_v1', { version: 1, migrate });
```

The store wraps game state in an envelope:

```json
{ "ns": "tycoon_v1", "v": 1, "savedAt": "2026-10-01T00:00:00.000Z", "state": { } }
```

- `exportCode()` and `importCode(code)` give portable base64 save codes, the same format MarsScape used when it moved sites.
- `clear()` resets the save.
- The namespace follows the studio pattern (`marsscape_v1`, `empires_v1`).

## State, version 1

The save stores the **player's choices and the seed**, not computed results. Capacity, demand, satisfaction and money are recomputed by the engine from the choices every time a save loads. The only exception is the settlement history, which keeps final numbers as a permanent record.

```js
{
  schema: 1,
  seed: 0,                    // uint32; feeds the RNG (RULES.md, General conventions)
  phase: 'book',              // 'book' | 'build' | 'promote' | 'show' | 'settle' | 'done'
  cash: 6000,                 // whole dollars
  venue: {
    id: 'lot',
    grid: { w: 24, h: 16 },
    objects: [                // placement order is kept
      { type: 'stage', x: 10, y: 0, rot: 0 }
    ]
  },
  booking: { artistId: 'velvet-static', deal: null },      // deal: 'guarantee' | 'door' | null
  promotion: { price: 20, ads: { flyers: 0, social: 0, radio: 0 }, confirmed: false },
  show: null,                 // { incidentId, responseId } once show night starts
  reputation: { venue: 0, artists: { 'velvet-static': 0 } },
  history: []                 // settlement records: { showId, seed, deal, attendance, satisfaction, net, artistPay, result, weakest, settledAt }
}
```

Object `type` values allowed in version 1: `stage`, `pa-s`, `pa-m`, `lights`, `bar`, `restroom`, `gate`, `exit`, `fence`.

## Validation (required on every load and import)

`src/kit/save.js` treats any object without `ns` and `state` fields as an old raw save and passes it straight through. That means a pasted save code can hand the game any JSON at all. Every value returned by `load()` or `importCode()` must therefore go through `normalizeState(state, fallbackSeed)` from `tycoon/engine.mjs` before use. It does the following, and `tycoon/test-engine.mjs` tests each step:

1. Reject anything that is not an object, or whose `schema` is unknown, and start a new game instead.
2. Clamp numbers to their valid ranges: cash as a whole number, `price` from 10 to 40, ad spend at 0 or more, reputation from 0 to 100, relationships from −100 to 100.
3. Drop objects with an unknown `type`, objects outside the grid, and overlapping objects.
4. Reset `phase` to the last phase the remaining state can support. For example, `promote` without a chosen deal goes back to `book`. A save rolled back to before the show loses its show and its confirmed promotion; the cash it already paid is not refunded, which only matters for damaged or edited saves.
5. Never read computed values from the save; recompute them. The incident comes from the seed, not from `show.incidentId`.

## Migration policy

- Bump `version` (and `schema`) only for changes that would break older saves. Adding an optional field is handled by `normalizeState` defaults.
- Each version step gets a pure migration function, called through the store's `migrate(state, fromVersion)` hook, applied one version at a time.
- Each version keeps a frozen example save in `tycoon/test/fixtures/save-vN.json` (version 1 exists). Tests load every fixture, migrate it to the current version and check the result with `normalizeState`.
- A new namespace (for example `tycoon_v2`) is only used for an intentional fresh start. In that case, an import screen accepts save codes from the old namespace.

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
