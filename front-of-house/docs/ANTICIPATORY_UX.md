# Front of House: anticipatory UX spec

- Date: 2026-10-17 · Status: **Implemented in 0.3.2** (cache `v81`), approved by Dave on 2026-10-17 · Written against `gh-pages` @ `6db8334`, FOH v0.3.1, save schema 2
- Code: [`prefs.mjs`](../prefs.mjs) (the stored record), [`anticipate.mjs`](../anticipate.mjs) (pure suggestion readers), `game.js` (presentation), `board.js` and `lot-renderer.mjs` (the legal-tile outline). Tests: `test-prefs.mjs`, `test-anticipate.mjs`, `test/front-of-house-suggestions-smoke.mjs`.
- Scope: presentation only. No change to rules, numbers, the save schema or the `front_of_house_v1` namespace.
- Bounds: CT-DEC-12 / HUD.md (no page or panel scrolling at 1024 × 700 and up, Build/Show HUD ≤ 2% of the lot, phone bottom-sheet tabs), CT-DEC-16 (Select by default, Escape, undo), CT-DEC-19 D9 (Lot numbers are still experimental, so no "optimal" advice), and ART_DIRECTION §5 (44 px targets, words as well as colour).

**Ground rule.** Predict what *this player* wants from what they just did and what they did last time. Never solve the game for them. A suggestion may **highlight**, **pre-fill on tap** or **move focus**. It never dispatches a money-changing or choice-committing action (`chooseDeal`, `place`, `setLayout`, `confirmBuild`, `confirmPromotion`, `respond`, `acceptSettlement`, `nextShow`). Every suggestion draws only on public state (forecast ranges, asks, relationships, signed history), so it never reveals the hidden draw or the seeded incident.

## What already anticipates (keep it, don't duplicate it)

| Existing behaviour | Where |
| --- | --- |
| Room, layout and venue carry into the next show; ticket price defaults to the act's `fairPrice` | `applyAction` `nextShow` and `chooseDeal` (engine.mjs:1620, 1261) |
| Suggested layout button and the first-show teaching copy | `buildPanel()`, `onAct` `starter` (game.js:509, 2363), `bookPanel()` `teach` |
| Exit or floor capacity cap named in the readout, the readiness line and Promote (PR 129) | `capacityCap()`, `updateBuild()`, `updatePromote()` (game.js:536, 557, 808) |
| Refused placements always explained; the tool card says where a gate, exit or PA can go | `refusalText()`, `toolWhere()`, `placeAt()` (game.js:678, 445, 685) |
| A ghost turns green or red under the cursor | `ghostAt()` → `validatePlacement`, drawn by board.js:914 and lot-renderer.mjs:111 |
| Advisory desk picks a priority category | `advisoryFor()` (advisory.mjs) |
| The incident card focuses the first affordable response; Locate centres the affected kit | `reachIncident()`, `locateIncident()` (game.js:1157, 1215) |
| 3D/2D choice and Dark controls already persist | `front_of_house_renderer`, `front_of_house_theme` (game.js:31, 95–106, 2893–2899) |

PR 129 already fixed the playtest's silent capacity caps, silent refusals, cash confusion, toast bleed, pan help and the 3D home/zoom reset, and it put the 3D/2D switch in the desktop strip. Still open: the short show after the incident (`AFTER_SECONDS = 3`), the placeholder 3D art, panning that is discoverable only through the menu, and the phone 3D switch, which is still at Menu → Camera.

## 1) Prediction opportunities

| # | Phase | Signal (already available) | Predicted intent | Treatment |
| --- | --- | --- | --- | --- |
| P1 | Book | `prefs.acts[id].deal`, `state.reputation.artists`, `termsFor()` | Rebook the act you trust, on the deal you used last time | A "Last time: Guarantee" badge on that deal button, and initial focus on it. Enter still needs the player's press. |
| P2 | Book | `upfrontFor()`-style check: `ask + cheapest rentals` > `state.cash` (`cheapestShowCost`, engine.mjs:179) | Avoid a booking that can't open doors | Mark a Guarantee that leaves you short "Short $X at doors", and highlight Door deal if `doorOk`. Nothing is disabled that isn't disabled today. |
| P3 | Build entry | `history.at(-1).weakest` (already saved, engine.mjs:1572) | Fix what hurt last night | A one-line chip in the phase card, e.g. "Last night's weakest: Bars and restrooms. Bar (5) / Toilet (6)". Tapping it picks the tool (`pickTool`). It places nothing. |
| P4 | Build | `capacityCap()` returns `{limit:'exits', add}` | Add exits | A **Pick Exit** button on the readiness line, which selects the tool and lights up the legal edge tiles (P5) |
| P5 | Build | Tool is `gate`, `exit` (edge) or `pa-*` (touch the stage) | Find a tile that will be accepted | A legal-tile overlay: tiles where `ghostAt()` would be valid, tinted and outlined. This ends trial-and-error on the edge-only rule. |
| P6 | Build | `prefs.rooms[id].lastTool`, `ui.placeTool` | Resume the tool you were using | A ring on that tool tile. **Select stays the default** (CT-DEC-16), so a stray click never rents gear. |
| P7 | Promote | `prefs.acts[id].price/ads` from the last show you opened with this act | Repeat the last mix | A "Same as last time: $18 · ads $150" chip. One tap sends one `setPromotion`, which costs nothing until Open doors. Hidden when that mix would push `upfrontFor` over cash. Datalist tick marks show the remembered values on the sliders. |
| P8 | Promote | `capacityCap()` while the forecast is clipped | You want to sell more | The existing message gains a **Back to Build** shortcut that opens with Exit picked (P4). |
| P9 | Show | `prefs.incidents[incidentId]` | The response you chose before | A "Your last choice" badge. Focus stays where `reachIncident()` puts it today. No "best" label, because D9 tuning is unaccepted. |
| P10 | Show (first runs) | `prefs.hints.pan < 3` and zoom > fit | Move a zoomed view | A one-time toast: "Hold Space and drag, or right-drag, to move." Counted, so it stops after 3 views. |
| P11 | Done | A pure dry run: `applyAction(state,{type:'nextShow'})` on the current state (the engine never mutates its input) | See what's next before committing | A one-line preview under **Book the next show**: "Next: Sodium Arcade asks $490 (relationship +4)". It reads only offers that Book shows one click later. |
| P12 | Phone | `prefs.phone.tabs[phase]` | Return to the tab you use | Reopen the last tab per phase. An incident still forces **Problem** (`syncTabs(el.panel,'show','Problem')`). |

Deliberately out: an auto-priced "optimal" ticket or ad level, ranked incident answers, auto-selecting a placing tool, and auto-skipping show night. Each either solves the game, risks an accidental cost, or hides the payoff the playtest already found too short.

## 2) UI changes

All the copy goes through the existing `say()` / `#msg` line and the plates. No new plates, so the 2% Build/Show coverage and the no-scroll rule hold.

1. **`anticipate.mjs` (new, pure, about 120 lines)**, modelled on `advisory.mjs`. It exports `suggestionsFor(state, prefs) → [{ id, phase, slot, text, kind: 'highlight'|'prefill'|'focus'|'tool', target }]`. It imports only engine readers (`termsFor`, `upfrontFor`, `forecast`, `evaluateVenue`, `validatePlacement`, `cheapestShowCost`, `offersFor`). It never calls `applyAction` except the P11 dry run, and it returns at most one suggestion per slot.
2. **Book (`bookPanel()`):** add a `<span class="hint-badge">Last time</span>` inside the remembered deal's `.choice-head`, and a `.short` cost note when the doors would be short. Focus goes to the highlighted button after `focusHeading()`. The `data-act="deal"` and `data-deal` selectors don't change (smoke rail).
3. **Build (`buildPanel()` / `updateBuild()`):** the P3 chip shares `#msg` and is replaced by any refusal or placement message. Add a `data-act="pick-tool" data-tool="exit"` button to the `#venue-check` warn line (P4). Add `ring` to the remembered tool `.tile` (P6).
4. **Legal-tile overlay (P5):** in `draw()` (game.js:1850), add `scene.legal: Set<"x,y">` when the tool is edge-only or a PA. Compute it with `validatePlacement` over the 24 × 16 grid (384 checks), cached by the same key pattern as `sight()`. board.js tints it next to the `clearSet` overlay (board.js:769). lot-renderer.mjs adds the set to `nextOverlay` and draws `cell(...)` (lot-renderer.mjs:103–111). Both renderers get it, so 3D stays usable.
5. **Promote (`promotePanel()` / `updatePromote()`):** a chip row under the lede. `data-act="promo-repeat"` dispatches one `setPromotion { price, ads }`, and the message reads "Applied last show's price and ads. Nothing is paid until Open doors." Add a `<datalist>` with the remembered value to each range input. The chip is hidden under a sponsor price (`festivalPolicyFor`) and when it would make `short` true.
6. **Show (`reachIncident()`):** a badge on the remembered response. `respond()` writes `prefs.incidents[id]` after a successful `act`.
7. **Done (`donePanel()`):** a `.result-line`-styled preview under the primary button (P11).
8. **Menu:** a **Suggestions: On/Off** toggle beside Dark controls, and a **Forget suggestions & view settings** button in *Save and load*. Both are plain buttons with no inline handlers.
9. **Probes:** add `suggestions` to `render_game_to_text` and `window.__frontOfHouse` so the smoke rail can assert that nothing auto-commits.

## 3) Local stored data model

**Key:** `front_of_house_prefs`, separate from the save key `front_of_house_v1`. **Version:** `v: 1`. **Size bound:** 2 KB serialized. Writes that exceed it drop the oldest `acts` entries first. A hard cap of 4 KB discards the store entirely.

```json
{
  "v": 1,
  "suggest": true,
  "view": { "renderer": "3d", "theme": "light" },
  "hints": { "legalTiles": 1, "rendererSwitch": 0 },
  "phone": { "tabs": { "book": "Sodium Arcade", "build": "Tools", "promote": "Price and ads" } },
  "rooms": { "lot": { "lastTool": "exit", "sightlines": true } },
  "acts": {
    "sodium-arcade": { "deal": "guarantee", "price": 18, "ads": { "flyers": 100, "social": 50, "radio": 0 } }
  },
  "incidents": { "rain": "ponchos", "pa-dropout": "backup-amp" }
}
```

**Validation (`normalizePrefs`, in a new `prefs.mjs`):** read inside a guarded `try { JSON.parse }`, following the warning in PROTOTYPE_REVIEW.md §5. Use only own keys that the content tables define (`D.ARTISTS`, `D.VENUES`, `D.OBJECT_TYPES`, `D.INCIDENTS[id].responses`, `D.AD_CHANNELS`), with `Object.hasOwn` and no inherited names. `price` must be a whole number from `PRICE_MIN` to 200, and is clamped again to the room's `priceMax` when applied. Ads must be multiples of `AD_STEP` from 0 to `AD_SLIDER_MAX`. Hint counters run 0 to 3. `acts` holds at most 16 entries in recency order, and `incidents` at most 8. An unknown `v`, or any parse error, leaves you with the defaults. No timestamps, seeds, cash or history are stored.

**Legacy keys:** on first load, fold `front_of_house_renderer` and `front_of_house_theme` into `view`. Keep writing the legacy keys for one release so a rollback keeps your choice, then retire them. `?renderer=2d|3d` still wins (`rendererPreference()`).

**Why this sits outside the save:** (a) the save holds career state and is rebuilt by `normalizeState`, and it travels in save codes, which people share; preferences are per-device habits. (b) *Start a new game* and *Start over* reset the career, but your habits and view choices should survive them. (c) No schema bump, fixture or migration is needed (SAVE_FORMAT.md migration policy). (d) Per-act memory has to be stored somewhere, because `history[]` doesn't record price or ads. Everything that is career-derived (last night's weakest, relationships) is read from the save, never copied into preferences.

**Reset and clear:** *Menu → Save and load → Forget suggestions & view settings* calls `localStorage.removeItem('front_of_house_prefs')` and the two legacy keys, then re-renders. Turning *Suggestions* off stops writing `acts`, `incidents` and `rooms`, and clears them; the view choices and hint counters stay. A failed write is ignored silently (same as `rememberRendererPreference`), and the game plays without suggestions.

**Privacy note:** the data stays on this browser's `localStorage` and is never sent anywhere: no network calls, analytics or fingerprinting. It isn't included in save codes. It contains only game-content ids and slider values: no names, times or free text. On a shared machine, one button in the menu removes all of it.

## 4) Mobile readiness (under 680 px, CT-DEC-04 / HUD §8)

- **No new rows.** Every chip replaces text in an existing line (`#msg`, `#venue-check`, the Promote lede), so no tab in the peek or full sheet starts to scroll. Add the 390 × 844, 375 × 812 and 360 px checks for the longest chip text to the smoke rail.
- **Tabs:** P12 restores the last tab per phase. Show's Problem override and the "a new incident restores the peek sheet" rule stay first. Sheet height isn't persisted, so a reload never opens with hidden (inert) controls.
- **Touch targets:** chips and the Pick Exit button are at least 44 px high. Badges are text ("Last time", "Your last choice"), not colour alone, and the legal-tile overlay uses tint plus an outline so it reads in the light palette and the night palette.
- **No hover dependence:** nothing is disclosed only by `title` tooltips. Phones already hide tool key badges, and the P6 ring still shows there.
- **3D on phones:** the switch stays in Menu → Camera (HUD 2026-10-05). P10's counted hint names that path the first time a phone player opens the Camera window. The legal-tile overlay is the main help for edge placement on a small 3D board.
- **Low-power:** the legal set is computed once per tool change or layout change, not per frame. It joins the static overlay cache that step 6 plans (HUD §6) and stays inside CT-DEC-17 frame budgets.
- **Reduced motion:** chips and badges appear without animation, and focus moves are unchanged.

## Implementation order

| # | Item | Effort | Files |
| --- | --- | --- | --- |
| 1 | `prefs.mjs`: load, normalize, save, clear, legacy fold; menu toggle and Forget button; unit test `test-prefs.mjs` | S | new prefs.mjs, game.js (95–106, 2893), index.html menu |
| 2 | P4 Pick Exit and P5 legal-tile overlay (2D and 3D) | M | game.js `updateBuild`/`draw`, board.js, lot-renderer.mjs |
| 3 | `anticipate.mjs` and P3 last-weakest chip, P6 tool ring | S | new anticipate.mjs, game.js `buildPanel` |
| 4 | P7 "Same as last time" chip, datalist ticks, P8 shortcut | S | game.js `promotePanel`/`updatePromote` |
| 5 | P1/P2 Book badges and short-at-doors note | S | game.js `bookPanel` |
| 6 | P9 incident badge, P11 next-show preview | S | game.js `reachIncident`/`respond`/`donePanel` |
| 7 | P12 phone tab memory and P10 counted hints | S | game.js `syncTabs`, zoom toast |
| 8 | Release: add both modules to `sw.js` precache and bump cache v79 → v80; smoke asserts (no auto-commit: `cash`, `phase` and `booking.deal` unchanged after every suggestion render; no scroll; ≤ 2% HUD) | S | ../sw.js, version.mjs, smoke rail |

Altogether that is about one M and seven S. Ship 1 and 2 first: 2 removes the biggest friction the playtest hit, and 1 is the foundation for the rest.

## As built (0.3.2)

Everything above shipped in one release, in the order listed. Where the HUD rules forced a change from the plan, the HUD rules won:

- **P3 (last night's weakest) has no buttons.** A line with buttons in the phase card measured 6.7% of the lot at 1024 × 700. Instead the text replaces the Select hint (`#tool-info`), and the tools that answer the weakest part get a ring in the tool palette. Pressing a ringed tile is the ordinary tool choice. When there is no weakest-part line, the ring marks the last tool used in this room (P6). Phones hide that hint line, as they did before, so on a phone only the rings show.
- **P1 keeps focus on the heading.** After booking or Next show, focus still goes to the panel heading so screen readers announce the phase (HUD §7). The remembered deal is marked with a **Last time** badge and an outline. A guarantee that would leave the doors short says **short $X at doors** in its cost, and a door deal that fits gets **Fits your cash**.
- **P8 is the Back button.** When exits cap the forecast, Promote's Back reads **Back to Build: add exits** and opens Build with Exit picked. There is no extra row.
- **P10 was already covered.** The zoom toast already explained panning every time (PR 129). The counted hints now cover the legal-tile outline (`legalTiles`) and, on phones, where to find the 3D/2D switch (`rendererSwitch`). The `pan` counter was dropped from the schema.
- **P11 shares the result line** on Done, as `Next: Sodium Arcade $490 · …`. Relationships are in its tooltip, and the Done sheet gains no row.
- **P7** replaces the Promote lede with **Same as last time: $18 · ads $150 [Apply]**. Datalist tick marks show the remembered values on the sliders. The act's deal, price and ads are remembered only when the doors open, so a plan the player abandoned is never suggested.
- **Phone tabs** are remembered for Book, Build, Promote and Done. Show is never restored, because an incident always brings Problem forward.
- **Pre-existing finding:** with the booking confirmation from PR 129 in the message line, the Build phase card covers 4.3% of the lot at 1024 × 700 (suggestions off). The suggestion line itself adds nothing; with it on, the same view measures 2.9%. Tracked in KNOWN_ISSUES.md.
