# Front of House QA Audit — 2026-10-07

**Status:** Engineering audit of production `ad03910` (release 0.1.1), with fixes shipped as release 0.1.2. Hand-written. Automated evidence only: the human playtest review, real Safari and physical devices remain open (section 6).

The audit tried to make the game lie, lose state, miscalculate, trap the player or pay twice, against one invariant: **a booking keeps its act, room, contract, costs, layout, prices, attendance, results, cash, reputation, relationships and history from Book through Settle and into the next booking.** Defects were classified against current behavior and accepted design ([DECISIONS.md](DECISIONS.md)); proposals in [FEATURE_BRIEFS.md](FEATURE_BRIEFS.md) were not treated as requirements.

## 1. What ran

| Campaign | Method | Result |
| --- | --- | --- |
| One Real Show (plan section 29) | 20 fixed-seed Lot shows (door and guarantee, cheapest and dearest affordable response) driven through `applyAction`, with attendance, ticket gross, cost sheet, artist pay, net, reputation and relationship recomputed from `data.mjs` constants. Cash after signing compared with cash before doors plus net; next show checked for cash, layout, relationship and ask | Exact on every variant |
| Reload torture | After every accepted action in seeded careers, the saved state reloaded through `migrateSave` and `normalizeState` must equal the state in play. Also reload at 8 UI checkpoints (empty build, valid build, priced promote, show before and during the incident, settle before signing, done, next booking) | 11 reload-difference classes found, all fixed; 0 remain over 600 careers |
| Adversarial fuzz | 600 careers, 240,000 actions (70% refused), 2,002 signed shows; valid moves mixed with NaN, ±Infinity, negatives, fractions, huge numbers, strings, `constructor` and `__proto__`. Invariants: refused actions change nothing, prior state is never mutated, cash moves only on paying actions and equals the quote, phases move only along allowed edges, unlocks and history never regress, other rooms' layouts are untouched, journal equals cash | Clean after fixes |
| Exact cash | Doors at upfront −1/±0/+1; every response at $0 and at cost −1/±0; next show at `nextShowCost` −1/±0 and whether that cash can actually open a show (60 seeds) | Boundaries exact; no soft-lock |
| Rooms and layouts | Four-room layout rotation with reloads; three-night Loam Shell run with reloads between nights; geometry edges (every type, rotations 0–3 plus invalid, edges ±1, fractional and NaN positions) | Exact; invalid geometry refused |
| Saves | Malformed save corpus (prototype ids, string/NaN/huge/fractional cash, missing and null sections, wrong shapes, future schema, version 1) loaded in Node and in the browser | Two boot failures found, fixed |
| Long career | 230-show Sandbox career: save size and history numbering | 0.2 KB per show, capped at 43 KB after 200 shows |
| Browser loop | Book → Next show through the real interface in Chromium 149, Firefox 151 and WebKit 26.5, double-clicking every phase button, reloading at each checkpoint | No double charge, payout, booking or skipped phase in any engine |
| Navigation and tabs | Back/Forward away from and into the game; two tabs at Settle, one signing and booking on, the stale one signing | Back/Forward safe; stale tab fixed |
| Storage | Site storage blocked; storage full; corrupt and future-version saves | Fixed (FOH-QA-005, 006, 008) |
| Layout | 6 phases × 15 viewports (1920×1080 down to 680×700 and 375×812, plus 125/150/200% zoom emulated by CSS viewport), light and dark | Pass at 1024×700 and larger; zoom finding open |
| Keyboard | Tab order and focus rings on Book, Enter to book, accessible names in Build | Pass |

Runs used a Linux runner in the Playwright 1.61.1 container. The engine harness and browser campaign are kept out of the served tree; the durable regressions are in [`test-qa-integrity.mjs`](../test-qa-integrity.mjs), which fails on 0.1.1 and passes on 0.1.2.

## 2. Defects

Severity follows the audit plan: P0 career or data integrity, P1 critical gameplay, P2 major system defect, P3 UX or presentation, P4 polish. Anything touching cash, contract, room, progression or saves starts at P1 unless its reach is limited to hand-made data.

| ID | Sev | Cluster | Defect | Reproduction | Impact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FOH-QA-001 | P1 | ECON, SAVE | Back twice from Promote and rebooking the same act sets the Loam Shell seat price to lawn + 10, above the $80 ceiling. The slider shows $80, the panel shows $90, doors open at $90, and a reload then removes the paid seat-sales contract | Sandbox → Loam Shell → book with seat sales → Suggested layout → lawn and seat price to the maximum → Back, Back → same act → Lock → Open doors → reload | The same night settled at net $45,152 without a reload and $41,340 after one | Fixed 0.1.2: rebooking and room switches clamp both prices; doors refuse prices outside the room's range |
| FOH-QA-002 | P1 | EXP, STATE | Start over after a Fathom Hall (or later) show begins the new $3,000 career inside that locked room, offering its acts; the deal buttons work and the show can be played, skipping the Lot | Any later-room show → Done → Start over → book | Progression bypass; a fresh career plays club shows | Fixed 0.1.2: a restarted career begins on the Lot and keeps the layouts; booking and doors refuse a locked room |
| FOH-QA-003 | P1 | STATE, UI | A Lot food plan survives Back → room switch. At Fathom Hall, Open doors is refused with "Food needs live services and one connected stall before doors" and no control there can clear it | Lot → Promote → Facilities: food → Back, Back → Fathom Hall → book → Lock → Open doors | Player stuck at Promote until a reload or a return to the Lot | Fixed 0.1.2: Lot-only settings stay on the Lot |
| FOH-QA-004 | P2 | SAVE, BUILD | Removing the stage leaves its PA (as Build intends), but a reload silently deletes the PA | Build → Suggested layout → Details → remove the stage → reload | The layout the player left is not the one that loads | Fixed 0.1.2: loading keeps objects that fail only the touch-the-stage rule |
| FOH-QA-005 | P2 | SAVE | With site storage blocked the page throws before the game starts | Block site data → open the game | Game unusable in that browser | Fixed 0.1.2: the save store treats unreadable storage as none |
| FOH-QA-006 | P2 | SAVE | A save whose room id is an inherited name (`constructor`, `toString`) stops the game from starting; inherited act ids load as acts with no numbers, and inherited object types can be placed | Edited save code or stored save | Boot failure on damaged data; impossible state | Fixed 0.1.2: ids must be the table's own entries |
| FOH-QA-007 | P2 | SAVE | Two tabs: a stale tab signing an already-signed sheet silently overwrites newer progress (last writer wins). Cash is not paid twice | Tab A signs and books on; stale tab B signs | The newer booking is lost without warning | Fixed 0.1.2: a tab follows saves made in another tab, and a page restored by Back reloads the save |
| FOH-QA-008 | P3 | SAVE | Failed saves are silent, and Copy code says "Nothing saved yet" when storage is unavailable | Storage full or blocked | Player believes progress is kept | Fixed 0.1.2: one warning; codes come from the game in memory |
| FOH-QA-009 | P3 | SAVE | Room-specific settings (Lot facilities, Festival side act, held nights, sponsor deal, out-of-range prices) persisted in play after a room switch but were dropped on reload, so a reload could change the booking screen | Set them, switch rooms in Book, reload | Root of FOH-QA-001 and 003 | Fixed 0.1.2: `chooseVenue` drops them exactly as loading does |
| FOH-QA-010 | P3 | SAVE | After 200 shows, play kept every entry but a reload kept 200 and renumbered them from Show 1 | 201-show career, reload | History numbers change on reload | Fixed 0.1.2: the same 200-show window in play and saves, numbers kept |
| FOH-QA-011 | P3 | STATE | `chooseVenue` with an inherited name throws in Sandbox (developer hook only) | `__frontOfHouse.act({type:'chooseVenue', venueId:'toString'})` | Uncaught exception | Fixed with FOH-QA-006 |
| FOH-QA-012 | P3 | RESP | At 150% browser zoom on 1440×900 or 1366×768 (about 960×600 CSS px), Promote's Open doors sits below the panel's visible area and is reachable only by scrolling the panel; at 200% the Book deal buttons do the same | Zoom 150% → Promote | Primary action hidden below the fold; below the 1024×700 hard gate | Open |
| FOH-QA-013 | P3 | EXP | Nights are seeded, so a save code or second tab taken before doors shows the night's result and lets the player replay a different response | Copy code before doors → play → import → choose again | Informed retries; no cash duplication | Open: design choice for Dave (decision packet) |
| FOH-QA-014 | P3 | SAVE | A hand-made save can still load a career in Build or Promote in a locked room. Booking and doors are refused there, so it cannot be played; the player must choose the Lot | Edited save code | Confusing state from edited data only | Open, low |

No P0 defect was found: no duplicate payout, double charge, skipped phase, lost settlement or cash that disagreed with a signed sheet, in any engine or across any reload.

## 3. Release gate (plan section 27)

| Gate | Status |
| --- | --- |
| Golden playthrough | Pass in Chromium, Firefox and WebKit |
| Four venue tiers | Engine: pass (fuzz, rotation, held run, existing tier and career baselines unchanged). Browser: existing Club, Shell and Festival smokes |
| Guarantee and door deals | Pass, reconciled exactly |
| Save/reload each phase | Pass after fixes |
| Settlement reconciliation | Exact |
| Duplicate-action attacks | Pass |
| Browser navigation attacks | Pass |
| Cross-phase booking identity | Exact |
| Venue layout isolation | Pass |
| 1024×700 rule and regression widths | Pass; FOH-QA-012 below the gate |
| Light and dark | Light pass; dark measured in the rerun recorded in [progress.md](../progress.md) |
| Long-career test | Pass (230 shows) |
| Economy exploit pass | FOH-QA-002 fixed; FOH-QA-013 open as a design choice |
| Console | No unexplained errors |
| P0 / P1 open | 0 / 0 |

## 4. Balance observations (not defects)

The seeded runs repeat known baseline findings rather than new ones: the door deal dominates on the Lot (KI-02), the Suggested layout solves Build (KI-03) and incident weight is small (KI-01). `nextShowCost` matched the cheapest openable show on every tested seed, so a career is never told it can continue when it cannot.

## 5. What changed in 0.1.2

Engine (`engine.mjs`): own-key lookups for rooms, acts and object types; `chooseVenue` normalizes room-specific settings; `chooseDeal` clamps prices and refuses a locked room; `confirmPromotion` refuses a locked room and out-of-range prices; Start over begins on the Lot when the room is locked; loading keeps detached stage objects; a 200-show history window with stable numbers. Client (`game.js`, `src/kit/save.js`): boot without storage, one save-failure warning, save codes from memory, and tab and back-forward-cache synchronisation. No balance, rule number, schema or migration changed; the balance, tier and career baselines are byte-identical.

## 6. Not covered

Human playtest scoring and the strategy question (plan section 26); real Safari, Firefox and Chrome on macOS and Windows; phones and tablets in the hand; trackpad gestures; screen readers; real browser zoom (emulated here by viewport size); throttled networks; 3D camera manipulation while dragging or blocked (campaign L, beyond the existing 3D smokes); frame-rate soak (campaign N, beyond save growth); the eight prototype show conditions, which are not yet connected gameplay.
