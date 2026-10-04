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

Version 2 has the same shape as version 1; the numbers are on the Lot scale. The Lot career (Phase 4) added two optional fields without a version bump, as the migration policy allows: `booking.terms` (null for a booking made before it, which then settles on the act's base ask and draw, exactly as it was sold) and `unlocks` (defaults to `{ club: false }`). The later tiers (CT-DEC-11) added more optional fields, still on schema 2: `mode` (`career`, `sandbox` or `scenario`), `scenario`, `forcedIncident`, `layouts` (one object list per room), `booking.nights`, `booking.secondId`, `booking.secondTerms`, `promotion.seatPrice`, `show.night`, `show.repHold`, `show.relHold`, and `history[].venueId` plus `history[].night`. `unlocks` also gains `amphitheater`, `festival` and `complete`, each defaulting to false. A save that omits them plays as a Lot career. Ticket price clamps to the room's `priceMax` (40 on the Lot, higher in later rooms). Object `type` values allowed: `stage`, `pa-s`, `pa-m`, `lights`, `bar`, `food` and `trailer` (Lot only, maximum one each), `restroom`, `gate`, `exit`, `fence`.

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

The standalone prerequisite originally kept this checkpoint outside career saves. FOH-O01b now persists it as an optional show field, as specified below. Calling a service summary never credits career cash; the existing phase-guarded signing action owns that mutation. The model alone does not establish player-facing or renderer acceptance.

## Live pilot integration (FOH-O01b)

Schema 2 now accepts an optional `promotion.liveServices` boolean and `show.services` checkpoint. Old saves omit both and keep the old rules. The checkpoint still uses service version 1; ordered worker commands may now be joined by one `{kind:"response", minute, response}` command. Its derived schedule tracks cancelled future walk-ups and prospective gate capacity. The original specification remains immutable; missing `gateWorkerRate` in an older model checkpoint derives from that checkpoint's worker rate, not a new balance default.

Career normalization re-derives prices, populations and rates from the booked show and replays only validated commands. A response's ID and multipliers come from the stored, validated incident choice rather than trusting checkpoint parameters. The incident, service close and phase prerequisites prevent early settlement. The normal phase transition still prevents a signed show from paying twice. A corrupt checkpoint recovers the service timeline while retaining career cash and already-paid response costs, marks `serviceRecovered`, and visibly reports recovery; a previously signed show remains signed. This recovery is not claimed to reconstruct invalid or missing staffing choices.

**Downgrade boundary:** older clients do not understand the live checkpoint or its prospective incident effects. After a career opts in, use a forward fix; do not roll it back to a client that strips this field. Preserve the existing storage namespace and cash/history. The pilot's ledger is held income until signing, so reload/clock ticks cannot credit it to available cash.


### Optional normal departure marker

New live Lot shows opened by the client include `show.flow: { version: 1, minute: 0 }`. `minute` is elapsed whole departure minutes after service closes; `show.services.minute` retains the original 0–240 service clock. The engine derives admitted population, connected exit count, duration, rates, routes and departure events from the normalized venue and service replay. Imported balances, rates and event arrays are not trusted or stored.

Without this marker, existing live shows keep their original closing and settlement behavior. Unsupported marker versions or invalid elapsed progress reset departure to zero and set existing recovery feedback, preserving paid response costs and career cash. A valid already-signed history entry remains signed if its departure progress is damaged; its derived departure endpoint is restored without another payment. Normalization cannot advance an unsigned show beyond its validated departure duration.

## Concessions core checkpoint (not yet a career field)

The isolated version 1 concessions checkpoint stores `{ version: 1, terms: { version: 1, plan, accessible }, services }`. `plan` is `standard` or `premium`; rates, stock, prices and shares derive from the versioned code. `services` is the existing authoritative service checkpoint. Replay reconstructs guest budgets, requests, stock, sales and both ledgers; saved derived values are ignored. The caller must supply engine-validated service specification and access. This core does not change career saves, artist costs, cash or settlement; the playable integration must lock its contract and validate placement before doors.

## Playable food contract

`promotion.foodPlan` is an optional `standard`, `premium` or null choice. New food-enabled shows require the live flow marker and a connected stall before any payment. Doors copy the selection into `show.food: { version: 1, plan }`. Later promotion changes cannot alter this contract. `liveServicesFor` derives access from the normalized venue and replays the authoritative service checkpoint; no saved guest balance, queue, stock, vendor gross or house total is trusted. Invalid optional contract version/plan is removed with `serviceRecovered` feedback; already-paid cash and signed history remain retained. Old saves omit these fields and retain previous settlement behavior.

The settlement adds only the computed house share to promoter net and one-time payout. Vendor expenses/gross never enter artist cost basis or career receipts. The complete isolated concessions checkpoint remains a core test interface; career saves persist the existing service checkpoint once and the locked food contract, not a duplicate copy.

## Sanitation core checkpoint (not yet a career field)

The version1 checkpoint stores `{ version, spec, food, services }`. `spec` contains bounded portable count, trailer choice, access/utility availability and dedicated cleaner assignment; `food` is optional locked food terms; `services` is the authoritative service checkpoint. Replay reconstructs each admitted identity, delayed demand, queue, in-progress stall visits, condition and exclusive cleaning work. Derived balances/work are never loaded directly. Client integration must derive facility access and utilities from the venue before supplying this core. No career save, cash or satisfaction changes are enabled by this module alone.

### Optional sanitation contract

New live flow-version1 Lot shows can lock `show.sanitation = {version:1, cleaner:boolean, utilities:boolean, preference:boolean, trailer:boolean}`. The promotion form uses the same three choices without `trailer`; opening doors derives and locks that quoted rental from the placed layout. Version1 prices are trailer $240, cleaner $80 and utilities $60. They are promoter production costs deducted once before doors and included in the door artist deal basis. A lost trailer in an imported layout retains the valid quoted charge but cannot supply visits or fulfill the optional changing-area preference.

Only source services, food terms and normalized connected geometry rebuild visit queues, stall condition and cleaner progress. Unknown version/type recovers by dropping the optional contract, preserving cash and reporting service recovery. Supplied derived costs, visits and fulfillment are ignored. Old shows without a contract have no new cost/result fields. Accepted Sodium Arcade changing-area preference adds up to two relationship points only when a connected powered trailer and cleaner actually fulfill it; declining has no penalty. Settlement and signing retain the normal-departure and one-time receipt gates.

### Research authority checkpoint (not yet a career field)

The pure three-project pilot stores `{version:1, mode, commands}`. Commands contain only project actions or distinct settled-night IDs with four department-eligibility booleans. Replay derives active/paused/completed status, cumulative experience, paid/refunded development ledger and learned IDs. Imported progress, money, prices and other derived fields are ignored. A career adapter must apply only a newly accepted command’s `cashDelta`; loading never pays historical refunds or charges again. All prior night IDs are retained for deduplication. At2,048 commands new work is refused, rather than discarding history and allowing duplicate awards. Version1 economics are fixed by the project table; later balance changes require a version/migration decision. Existing careers have no research field in this prerequisite.

### Optional career development adapter

`state.research` is the version1 source-only checkpoint described above, matching the career mode. It is opt-in after the first signed show (immediate and all knowledge free in Sandbox). `booking.research = {version:1, at:N}` freezes the first N source commands; learned knowledge is replayed from that prefix, so a held booking cannot gain later completions. Optional supplied effects, experience, balances and learned lists are ignored. Invalid checkpoint/mode resets development with a notice while retaining career cash; invalid booking prefix is removed. Loading never applies ledger payments again.

Only between-booking project commands apply cash deltas. Each signed show submits one stable seed/night ID with observed eligible department flags; duplicates cannot progress twice. Next Show retains development; a reset/retry starts fresh. A full2048-command history refuses additional development and reports its limit without preventing show income/signing. Development remains separate from show costs and artist deductions. The adapter is engine-only until its player controls are delivered.

### Ownership authority prerequisite

The pure small-PA inventory checkpoint is `{version:1, commands}` with at most512 canonical buy/sell commands. Buy stores transaction ID and family; sale stores transaction ID and owned asset ID. Replay derives sequential asset identities, ownership and capital ledger using the versioned price table, ignoring supplied prices or totals. Duplicate records and impossible sequences are invalid. Applying an identical already-recorded command returns no new cash delta, while reusing its ID for another command is refused. At the bound, new capital commands are refused; the later career adapter must preserve show availability. This prerequisite has no career save field, rental discount, general cash journal or player controls yet.

### Career cash journal prerequisite

The isolated journal checkpoint stores `{version:1, openingCash, archived:{through,totals}, entries}`. Up to128 recent rows retain consecutive numeric sequence, one of seven cash categories, signed whole-dollar movement and a bounded game reference. Compaction folds the oldest row into exact category totals and advances the archive sequence; an archive requires a full128-row recent window. Opening plus archived and recent movements reconstructs balance. Derived balance, totals and next sequence are ignored on import. Signs, safe integers, continuity and canonical bounds are validated. An identical retained retry pays nothing, changed retries fail and archived events cannot replay. A separate capital command source retains inventory provenance. There is no career journal field or runtime cash-path integration in this prerequisite.

## Optional equipment and reconciled career cash (FOH-E01b1)

Schema2 adds optional `equipment: {version:1, commands}` and `cashJournal` checkpoints after explicit enablement between bookings, following the first settled show (or immediately in Sandbox). Old careers keep both absent. Enablement opens the journal at current cash; it never fabricates transactions for earlier shows. The one small PA costs1200, sells for600, and incurs20 per deployed night. Stable purchase/sale command identities prevent duplicate cash movements. No layout or historical rental grants ownership.

`booking.equipment = {version:1, at, assetId}` records a validated ownership-command prefix. An explicit Build assignment requires a placed small PA and excludes house/medium systems. `assetId:null` retains rental. Doors validate eligibility and copy assigned terms to `show.equipment`; held nights copy those terms. A later sale cannot rewrite a signed sheet because the prefix still proves the original assignment. A damaged imported layout keeps the agreed operating cost but cannot receive small-PA eligibility. Capital movements stay outside show costs and artist deductions; deployed operating cost is an ordinary production cost.

Every subsequent cash-changing action posts the actual movement: acquisition, disposal, development, developmentRefund, showOpening, incident or settlement. Held runs record settlement income and next-night opening separately. The journal retains128 sequential rows plus exact older category totals; balance must equal available cash. Loading/reloading never pays a transaction. Invalid optional provenance or a mismatched journal preserves current cash/history and reports incomplete recovery; journal recovery starts a new opening at preserved cash without reconstructing lost rows. Next show carries both sources; explicit retry resets them. Older clients strip these optional fields, so enabled careers require a forward fix rather than downgrade.

Nine adapter checks cover both offered deals, paid incidents, sponsor opening, held nights, research refunds, duplicate capital commands, sale after signing, reload/recovery and bounded history. Player controls and browser/offline evidence remain a separate delivery slice.

New signed history rows also retain optional `cashAfter`, the exact cash immediately after signing and before a held run's next opening payment. It is display evidence only and never credits cash. Valid safe-integer values survive normalization; older rows show current cash and explicitly state that historical cash was not recorded. The signed settlement uses this snapshot so later equipment or development spending cannot change its historical cash bridge.

## Optional Club ticketing contract (FOH-V02a2)

Schema2 accepts `promotion.ticketing` as null or `{version:1,plan:"direct"|"platform"}` only in Fathom Hall. Doors copy recognized terms to `show.ticketing`. Active and signed shows read that frozen source; saved fee amounts and rates are ignored. An absent marker retains the original split and output shape. The platform's4% presale collection fee is withheld once from settlement receipts, outside artist-deductible production costs and show opening. Net, payout and the optional journal use the same derived amount.

Room changes and Next Show clear the optional selection. Invalid/wrong-room optional terms are removed with `ticketingNotice`, preserving career cash and signed history; reloading never replays payment. Such recovery does not claim to reconstruct missing contract terms. Five adapter checks cover all six old phases, exact legacy/Direct parity, quiet/loss pairs, both artist deals, one-time settlement/journal reconciliation, locked terms and source recovery. Controls and hosted acceptance remain separate work.

## Optional held-run cancellation

New multi-night Amphitheater bookings can opt into `chooseDeal.runPolicy:1`. `booking.run = {version:1,nights,ask}` freezes the two/three-night count and nightly quoted artist ask; doors copy it into `show.run`, retained across subsequent nights. Cancellation uses25% of ask rounded once per remaining night. `acceptSettlement.cancelRemaining:true` signs the completed night and pays that separate fee once, with no next opening. `show.cancelled:true` marks the final receipt; signed history retains `runCancellation:{terms,completed}` and its actual `cashAfter`. Derived imported penalties are ignored. Loading never charges/refunds. Invalid optional terms are dropped with a recovery notice, preserving cash and signed history.

The journal adds `cancellation` as a negative category. An older version1 journal with no archived cancellation total reads it as zero; all prior categories and sequence/compaction rules remain exact. An old application that cannot read the new category must use its existing incomplete-history recovery at preserved cash. The updated worker precaches the new held-run module. A negative cancellation balance is retained and uses the existing next-show affordability/start-over rules. Older unmarked runs keep their previous automatic continuation/end behavior; loading never invents a cancellation contract.

## Optional independent seat sales

`chooseDeal.seatingPolicy:1` is allowed only at the Amphitheater and stores `booking.seating:{version:1}`. New player bookings disclose separate sales and select it. Doors store `show.seating:{version:1,lawnPrice,seatPrice}`; those exact prices survive held-night transitions and take precedence over later imported promotion fields. Derived demand, sold counts, grosses and scores are never accepted from the checkpoint. Every result replays the source contract, room capacity, booked act and current nightly incident. Unknown versions, wrong rooms or frozen prices outside the room's allowed range are removed with a recovery notice, preserving paid cash/history. Old unmarked saves use their previous first-filled-seat rule.

Marked held runs also use the existing playback draw seed (`seed XOR night` after night1) in the rules engine, so each night has matching displayed and settled demand. Legacy unmarked runs keep their prior draw. Public range forecasts remain independent of the hidden seed. No extra cash journal category is needed: combined zone gross enters the one ordinary settlement movement. The worker precaches the seating module.

### Optional Festival stage accounts (version1)

`chooseDeal.stagePolicy:1` adds `booking.stages:{version:1}` only in the Festival with distinct valid main/side acts, frozen quoted terms for both, and a side act currently eligible for a door deal. The existing Festival headliners require guarantees; the generic door accounting path is also covered using a controlled imported contract for a door-eligible act, not claimed as a currently offered player deal.

Doors add `show.stages:{version:1,price,ads}`. Only these source choices are stored; stage counts, costs, artist bases, payouts and net are recomputed. Signed replay uses the frozen price, ads and venue reputation plus booked asks/draw multipliers. Later promotion edits do not rewrite the receipt. Loading rejects wrong-room/duplicate/missing-act policy and unsafe locked price/ad fields with a Festival recovery notice. Derived imported totals are ignored, and paid cash and signed history are preserved. No loading action pays or refunds money.

The site history row records combined attendance, net and total pay for both artists. Immediate incident payment keeps its existing journal category; signing does not deduct it again. Both act relationships change once on signing. New-show/room transitions clear the opt-in marker. Unmarked saves retain the original second-stage arithmetic. The ordinary namespace/schema remain unchanged; version49 precaches the required accounting module. Player booking disclosure and detailed stage receipt controls follow this engine adapter.

### Festival side-act selection

`chooseSideAct` is a Book-only Festival command. It stores the eligible prior-tier `booking.secondId` without payment and clears previously unconfirmed side terms/stage policy. `chooseDeal` then freezes the quoted side ask/draw multiplier and selects version1 stage accounting for new player bookings. A current signed show's bill cannot be edited. Changing venues and new-show initialization retain their existing reset behavior. Imported legacy Festival shows remain unmarked and use their original settlement.
