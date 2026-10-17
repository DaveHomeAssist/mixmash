# Front of House Release Notes

Front of House uses its own early-playable `0.x` version line. Patch releases
carry compatible fixes. Minor releases add player-facing capability. Save schema
versions are a separate compatibility contract and change only when saved data
requires migration.

## 0.3.3 — 2026-10-17

- Fixes FOH-QA-015. The booking confirmation is now a toast over the board that fades, instead of a line in Build's card. At 1024 × 700 the HUD again covers no more than 2% of the lot right after booking. "Nothing is paid until you open the doors" stays on Build's Back button and in Promote beside **Open doors**. Uses cache v82.

## 0.3.2 — 2026-10-17

- Adds anticipatory suggestions that never act for the player. Build outlines the tiles where a gate, exit or PA can go (in 2D and 3D), offers **Pick Exit** when exits cap capacity, names last night's weakest part and rings the tools that help. Book marks the deal used last time and warns about a short guarantee. Promote offers **Same as last time** for price and ads, applied only on a press. Show marks the last response to the same incident, and Done previews the next offers.
- Adds the device preferences key `front_of_house_prefs` (version 1, at most 2 KB), which absorbs the 3D/2D and Dark controls choices. Adds **Suggestions: On/Off** and **Forget suggestions & view settings** to the menu. Phones remember the last tab per phase.
- Game rules, economics, balance baselines and save schema 2 are unchanged; preferences are outside the save. Uses cache v81.

## 0.3.1 — 2026-10-12

- Adds original illustrated band lineups for all eleven acts, venue artwork in booking, and matching illustrations in Promote and Menu.
- Keeps compact artist headers on shorter desktop screens and preserves accessible deal controls in both themes.
- Corrects the catalog detail image: Front of House gameplay replaces the mislabeled MixMash fighter poster, using the canonical PR145 cover and uncropped presentation.
- Uses cache v79. Existing game rules, economics, 3D world and save schema 2 remain unchanged; 0.3.0 venue-scale amenities are retained.

## 0.3.0 — 2026-10-12

- Adds a Bar tent (3×2, serves 1,000) and Restroom block (2×2, serves 500) at Loam Shell and Split Acre, keys A and W. They add to the existing bar and restroom service, so a full house at either venue can now meet its amenity guideline without losing tickets.
- Suggested layouts above the Lot now provide that service at permit capacity: Fathom Hall 94% (its floor limit), Loam Shell and Split Acre 100%.
- Build tools show how many guests each bar or restroom serves. The settlement names the gap and how many of the room's largest unit would close it, instead of quoting Lot rates at every venue.
- Small-unit rates, every Lot result and every layout without the new objects are unchanged. Save schema 2 is unchanged. Uses cache v78, reserved separately from the open v77 candidate.

## 0.2.0 — 2026-10-09

- Adds an explicit Advisory desk check-in with Overview, Ticketing, Talent and Operations pages.
- Explains one current priority using existing evidence, phase/room availability and existing decision or receipt routes. Forecasts, current observations and signed results remain distinct.
- Preserves engine, economics, RNG, save schema 2 and settlement signing. No employees, payroll, autonomous actions or new simulation.
- Uses cache v76, reserved separately from the independent QA candidate v75. Delivery verification is recorded in the maintained project record.

## 0.1.2 — 2026-10-07

Fixes from the 2026-10-07 [QA audit](QA_AUDIT.md). Save schema 2 is unchanged and
existing saves load as before.

- Going Back from Promote and rebooking keeps both Loam Shell ticket prices inside
  the room's range, so a reload no longer drops a paid seat-sales contract.
- Lot-only Promote settings (live services, food, facilities) stay on the Lot, so
  they cannot block Open doors in another room.
- Start over begins the new career on the Lot even when the last show was in a
  later room; a locked room cannot be booked.
- A reload keeps every placed object, including a PA left behind when its stage
  was removed, and the 200-show history keeps its show numbers.
- The game starts when the browser blocks site storage, says once when progress
  is not being saved, and still offers a save code.
- A second tab follows the latest save instead of overwriting newer progress.

## 0.1.1 — 2026-10-07

- Makes the running Build expense easier to understand as **Show cost so far**,
  with its venue-and-equipment scope stated directly in the readout.
- Hides placement tiles outside Build in both the classic and 3D views so Show
  reads as an event rather than an editor.
- Guides the first booking toward the complete Suggested layout while keeping
  Build available for learning and changes.
- Keeps engine rules, balance, accounting and save schema 2 unchanged.

## 0.1.0 — 2026-10-07

This is the first explicitly numbered Front of House release, not the first
playable build or a 1.0 acceptance claim.

- Opens fresh sessions in the existing 3D venue view. A player who explicitly
  chooses 2D or 3D keeps that choice on later visits; 2D remains available.
- Preserves the application-owned classic fallback when WebGL, the renderer
  module or a supported 3D room is unavailable.
- Includes the delivered four-room career, live services, equipment, research,
  venue operations and the Summary/Ledger settlement design.
- Keeps save schema 2. No engine, balance, career, accounting or saved-game
  migration changes are part of this release.

Earlier deployments remain dated, unnumbered project history in
[`progress.md`](../progress.md) and the root [`CHANGELOG.md`](../../CHANGELOG.md).
Human art/camera/career acceptance, supported physical devices, venue
calibration and original-image rights remain open release gates.
