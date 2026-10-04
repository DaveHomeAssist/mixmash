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

Version 2 has the same shape as version 1; the numbers are on the Lot scale. The Lot career (Phase 4) added two optional fields without a version bump, as the migration policy allows: `booking.terms` (null for a booking made before it, which then settles on the act's base ask and draw, exactly as it was sold) and `unlocks` (defaults to `{ club: false }`). The later tiers (CT-DEC-11) added more optional fields, still on schema 2: `mode` (`career`, `sandbox` or `scenario`), `scenario`, `forcedIncident`, `layouts` (one object list per room), `booking.nights`, `booking.secondId`, `booking.secondTerms`, `promotion.seatPrice`, `show.night`, `show.repHold`, `show.relHold`, and `history[].venueId` plus `history[].night`. `unlocks` also gains `amphitheater`, `festival` and `complete`, each defaulting to false. A save that omits them plays as a Lot career. Ticket price clamps to the room's `priceMax` (40 on the Lot, higher in later rooms). Object `type` values allowed: `stage`, `pa-s`, `pa-m`, `lights`, `bar`, `restroom`, `gate`, `exit`, `fence`.

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

## Proposed next save and economy transition

**Status: proposal only.** These rules describe how to evaluate owned equipment, an append-only ledger and a dated show model from software spec v0.1. None of them is implemented or an accepted change to schema 2. Do not increase `SCHEMA_VERSION`, create a ledger from historical totals, or charge for existing layouts in order to satisfy this draft. [ROADMAP.md](../ROADMAP.md#software-spec-v01-reconciliation-proposal) tracks the design status.

### Ownership and existing layouts

- Keep venue tenure, placed layout and equipment ownership separate. The current `venue.objects` and `layouts` are positions, not a purchase record. A placed PA, lights, bar, restroom or fence remains rented for each new show under the existing rules until the player explicitly buys it under a new rule. A house rig remains included with its venue, never player inventory.
- Proposed purchased inventory uses a stable asset ID and definition ID, paid-once purchase amount, current venue and condition only if condition has gameplay. A placed instance refers to that asset ID; a hired instance refers to a show hire. Moving a purchased asset changes location without a second purchase or a second copy. Selling removes its ownership once and records a single cash movement. The player can still hire gear.
- Migrate every old layout, including saved alternate rooms, without granting or billing ownership. Preserve placement and current show rentals at their agreed amounts. No asset purchase is inferred from earlier rental payments. Any per-show rental exclusion for owned gear starts after an explicit purchase and must be visible before the next show.

### Ledger and contract arithmetic

- For a proposed schema 3, represent new cash entries as integer cents with unique event IDs, show and venue references, and separate commitment records for unpaid obligations. A committed amount is never counted as paid cash. An action with an already recorded event ID has no second cash effect. Define one explicit cash-opening entry equal to the migrated schema 2 `cash * 100`; keep old `history` as archived settled results, not fabricated itemized transactions.
- For each new action, `cash in cents = the opening-balance entry + sum of later posted cash entries`. The opening entry is counted once, never included again in the later-entry sum. Show operating result excludes asset purchases and recoverable deposits; show expenses are attributed to that show even when paid earlier. Settlement discloses the bridge from operating result to cash movement. Preserve frozen historical sheets and signed contract snapshots.
- The current door contract pays `round(DOOR_SPLIT * max(0, ticketGross - current eligible show costs))` in whole dollars. Proposed cents, deposits, refunds, resale and a different percentage base require an explicit decision about included costs and rounding before any new contract is signed. Do not reinterpret an existing guarantee or door deal. A new model must test both offered deal types and multi-night settlement against the existing baseline.

### Transition and replay

- Only a breaking model change gets a new schema version. Keep the `front_of_house_v1` namespace, a pure one-step migration from version 2, frozen fixtures for versions 1, 2 and the new version, and the original save available until the converted one validates and writes successfully. Export/import and corrupt data follow the same validation path.
- Map the old `book`, `build` and `promote` phases into planning without inventing an earlier game date, expiring an unrecorded hold, or charging for an unsigned commitment. Map an active `show` or `settle` into an in-progress signed show using the saved seed, booking terms, cash already deducted and night number. Map `done` to closed history. Preserve old response and settlement once; no automatic retry of a paid command.
- Any new date advance, hold expiry, payment, show incident and settlement needs a stable event ID and an idempotent transition. Persist enough random state or independent stream positions to replay the exact next event. Do not enable mid-show checkpoints until a reload after each possible prompt, cancellation and multi-night boundary yields the same show and balance without repeating an event.
- Before implementation, exercise saves in all six old phases, both deal types, a multi-night show, purchased and hired layouts after the new purchase action exists, old version 1 imports, duplicate button actions and failed/quota-limited writes. Assert unchanged old history, no loss of cash or placement, and no double charge. This is a proposed compatibility checklist, not a claim that schema 3 exists.

### Opt-in Lot show experiment on schema 2

The small doors staffing experiment in [FUTURE.md](FUTURE.md#lot-live-show-experiment-proposal) uses an optional `show.pilotCrew` value: absent for ordinary shows, `null` while the extra choice is pending, `'bar'` or `'gate'` once chosen. It is only created when starting a Lot show with `?night-slice=1`; normalizing an old save leaves it absent. Validate and preserve a pilot choice on import and reload. It does not change the save namespace, currency or existing incident draw order. When the choice is pending, the engine rejects incident response; the show can resume from that decision without guessing a default.

## Test checklist (before saves ship)

- [ ] Save, reload and resume in every phase
- [ ] Reset clears the save and starts a new game
- [ ] Export, then import into a clean browser, gives the same state
- [ ] A tampered or invalid save code is rejected, or normalized without crashing
- [ ] Every fixture migrates to the current version
- [ ] Same seed and same choices give the same settlement after reload

## Experimental service checkpoint (FOH-O01a)

`services.mjs` has a separate version 1 checkpoint for its deterministic tests and future adapter: `{version, spec, minute, commands}`. `spec` contains the run ID, finite arrival cohorts, integer service rates, travel/patience/closing minutes and whole-dollar ticket/bar values; commands contain ordered `{minute, station}` reassignment records. `loadServices` validates bounds and replays the initial state to recover cohorts, worker travel, residual demand, queue age, totals and causal events. Serialized derived money/queues are ignored. There are no random draws in this model. A checkpoint is at most 240 arrival rows, 240 worker commands, 240 minutes and 6,000 total guests.

This checkpoint is **not yet part of a career save**. Schema 2 and its existing pilot normalization remain unchanged. FOH-O01b must persist this checkpoint in the show, reconcile live outcomes with artist terms and issue a stable once-only career settlement transaction. Calling a service summary never credits career cash. The module's closing boundary and tests prove a service ledger, not career integration or a complete live-show feature.
