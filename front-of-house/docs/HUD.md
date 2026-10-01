# Front of House HUD layout (spec)

- Date: 2026-10-01
- Status: **Accepted by Dave on 2026-10-01** ([CT-DEC-12](DECISIONS.md#ct-dec-12-hud-layout)), with every recommendation in section 9. The minimap is deferred to step 7 of the build order and is on the [roadmap](../ROADMAP.md#hud-layout-ct-dec-12). Steps 1 and 2 are built (the camera, and the full-window board that never scrolls); steps 3 to 7 are not.
- Owner: Dave Robertson
- Asked for: "a redesign of the UI before we get too far... more HUD like, with the map expanded to take up a much larger percentage of the screen real estate."

The map is the game. Today it is a column beside a long panel. This spec makes the board fill the window in every phase and floats the controls over it as a heads-up display (HUD). The rules, the engine, saves and the art do not change.

## 1. Where the layout is today

Measured on 2026-10-01 in Chromium on the live build (`1bf48e1`), with the suggested layout on the Oak St. Lot.

| Window | Board canvas | Lot (the playable diamond) as a share of the window | Tile width | Page height in Build |
| --- | --- | --- | --- | --- |
| 1024 × 768 | 558 × 325 | 8.6% | 26 px | 1,594 px |
| 1280 × 800 | 814 × 488 | 14.9% | 39 px | 1,594 px |
| 1440 × 900 | 974 × 588 | 17.0% | 47 px | 1,594 px |
| 1920 × 1080 | 1,454 × 888 | 24.3% | 71 px | 1,594 px |
| 390 × 844 (phone) | 356 × 200 | 7.8% | 16 px | 2,460 px |

What causes it:

- The board is sized from its column's width only (`resize()` in `board.js`), so it can never use the window's height.
- The header (brand, stepper, meters) and the shared MixMash nav take 156 px above the board.
- The side panel is 320 to 560 px wide and 550 to 1,440 px tall, so every phase except Show scrolls the page.
- The settlement widens the panel, so the board shrinks to 31% of the window at 1280 × 800 and 16% at 1024 × 768.

## 2. Goals and non-goals

**Goals**

1. The board fills the window in every phase. The canvas is the page.
2. At the default zoom the lot is fit to the window. It covers at least 30% of the window at every desktop size, and at least 35% at 1280 × 800 and 1440 × 900: 1.4 to 3.5 times today.
3. In Build and Show, the HUD covers no more than 2% of the lot at the default zoom.
4. No page scrolling at 1024 × 700 and up. A panel that needs more room scrolls inside itself.
5. Every control stays reachable by keyboard, and every rule from `ART_DIRECTION.md` section 5 holds: 44 px targets, visible focus, words as well as colour, no inline handlers.

**Non-goals**

- No rule, number or save change. Selectors the smoke rail uses (`data-act`, `data-deal`, the element ids) and the `window.__frontOfHouse` hooks stay.
- No new art. The stand-in sprites stay until the render contract (`FUTURE.md`).
- No touch gestures in v1. Pinch and drag wait for touch support ([CT-DEC-04](DECISIONS.md#ct-dec-04-platform)). Buttons for zoom and turn work on every device.
- No minimap in the first pass. It is step 7 of the build order (section 10), and it is on the roadmap so it isn't lost.

## 3. The idea: the HUD lives in the lot's empty corners

An isometric lot is a diamond. A diamond fills exactly half of the rectangle around it, and the other half is four corner triangles. When the lot is fit to the window, those triangles are about a third of the screen, and almost nothing of the game is drawn in them. The HUD goes there.

| Region | What it holds |
| --- | --- |
| Top strip | The shared MixMash nav (hub and mute), the name, the phase stepper, the meters (cash, venue rep, band) and a menu button |
| Top-left corner | The phase card: where you are, what to do, and the message line (`#msg`) |
| Top-right corner | Status: the lot's readouts in Build, the incident card in Show |
| Bottom-left corner | Tools in Build, the event feed in Show |
| Bottom-right corner | The phase's actions (Lock the layout, Open the doors, Sign the settlement) or the live crowd count |
| Bottom centre, under the lot's front tip | Camera: zoom out, fit, zoom in, turn the view |

Phases where the map is the work (Build, Show) keep the whole lot clear. Phases where the work is a form or a document (Book, Promote, Settle) open a **sheet** on the right, dim the map, and re-fit the lot into the space that is left.

### Mockups

Composites made for this spec: the board underneath is a real capture of the full-window board on seed 170 (a PA dropout), and every number is from that same run. The panels are layout direction, not final styling.

**Build, 1440 × 900.** The lot covers about 36% of the window (17% today); the HUD covers 0.2% of the lot. Yellow dashed labels name the regions.

![Build with the corner HUD](hud/hud-build.jpg)

**Show night, 1440 × 900.** The incident card sits in the top-right corner, next to the stage and its marker. The HUD covers none of the lot.

![Show night with the incident card](hud/hud-show.jpg)

**Settle, 1440 × 900.** The settlement is a sheet over the dimmed map, with the stamp and Sign the settlement in its footer. The night's outcomes sit bottom-left.

![Settlement sheet over the map](hud/hud-settle.jpg)

**Build on a phone, 390 × 844.** The board takes the top half, zoomed in. Phase controls sit in a bottom sheet.

![Phone build with a bottom sheet](hud/hud-phone.jpg)

## 4. Phase by phase

| Phase | Map | Top-left | Top-right | Bottom-left | Bottom-right | Sheet |
| --- | --- | --- | --- | --- | --- | --- |
| Book | The chosen room, dimmed | | | | | Rooms, nights, the two offer cards, the mode buttons (first show only) |
| Build | Full, sightlines on | Phase card and message | Readouts (capacity, power with a bar, clear view, blocked, staff, costs) and the readiness line | Tools 1 to 8 with sprite thumbnails and costs; Bulldoze, Rotate, Fence, Sightlines | Suggested, Clear, Back, **Lock the layout** | |
| Promote | Full, static | Phase card | | | | Price, ads, forecast, presale chart, **Open the doors** |
| Show | Full, night lighting | Clock and "Doors are open" | The incident card with its responses (first response focused, as now) | Event feed, last 3 to 4 lines | Crowd in the lot, Skip to the problem | |
| Settle | Dimmed | | | The night: satisfaction, rep, band, cash | | The settlement sheet, stamp and **Sign the settlement** in a sticky footer |
| Done | Dimmed | | | | | Career progress, the goal checklist, Start over, **Book the next show** |

Notes:

- **Tools get number keys 1 to 8**, in palette order. They are new; every other key stays (arrows, Enter, R, B, Q, Delete).
- **Placed objects** (today a list under the stats) moves into the Build readouts as a disclosure, so keyboard users can still remove an object by name.
- **The view turn** moves into the camera group. Its status line ("View quarter 1 of 4") becomes a short toast under the top strip, still `aria-live`.

## 5. The camera (`board.js`)

Today `resize()` fits the lot to the canvas width and grows the canvas downward. The HUD needs a camera.

- **Safe rectangle.** The window minus the top strip, minus an open sheet. Fit and centring use this rectangle, so opening a sheet slides the lot left instead of hiding it.
- **Fit.** The tile width is the largest that fits the lot's diamond, plus headroom for the tallest prop, inside the safe rectangle, by width and by height. That is about 61 px at 1280 × 800 and 69 px at 1440 × 900, against 39 and 47 today. Wide 16:9 windows are limited by height: about 84 px and 34% of a 1920 × 1080 window.
- **Zoom.** Fit, then ×1.5, ×2 and ×3. Buttons in the camera group; `=` and `-` and `0` (fit) on the keyboard; the mouse wheel zooms about the pointer. Since step 2 the page never scrolls, so the plain wheel zooms; Ctrl or Cmd with the wheel, and a trackpad pinch, do the same.
- **Pan.** Drag with the middle button anywhere, or a plain drag outside Build. Space can't be the pan key, because Space places an object in Build. Shift with the arrow keys pans. In Build, the arrow keys still move the build cursor, and the camera follows when the cursor nears an edge. The lot can't be panned out of the window.
- **Turning the view** keeps the zoom and re-centres on what was at the centre.
- **Contained change.** Every screen position goes through `iso()` and `tileAt()`, so the camera is three fields on `view` (zoom, pan x, pan y). Hit-testing, placement order, markers, beams and the ghost all use `iso()` and follow it.
- **Rooms.** Split Acre (40 × 24) fits at 44 px a tile on 1440 × 900. Zoom matters most there.

## 6. Performance

A full-window canvas draws more pixels: 1440 × 900 at a device pixel ratio of 2 is 5.2 megapixels, against 2.3 today, and 1920 × 1080 is 8.3. Show night redraws every frame.

- Cache the floor, the grid, the parking stalls, the fence line and the sightline overlay in an offscreen canvas. Redraw that cache only when the room, the layout, the view, the zoom or the pan changes.
- Props, the crowd, lights, rain, markers, the cursor and the ghost still draw each frame. Crowd dots are interleaved with the props they stand between, so props can't join the cached floor.
- Keep the pixel-ratio cap at 2. Drop to 1.5 when the canvas would pass 6 megapixels.
- Budget: show night at 1920 × 1080 holds 60 frames a second on a mid-range laptop. The smoke rail records frame times in headless Chromium as a proxy and fails over 16 ms at the 95th percentile.

## 7. Accessibility and HUD rules

- **The HUD is HTML over the canvas,** never drawn on it. Text stays selectable, translatable and readable by screen readers.
- **Clicks reach the board between panels.** The HUD layer has `pointer-events: none`; each panel turns them back on.
- **One controls landmark.** The phase panels stay inside `#panel` ("Controls") in reading order (phase card, tools or status, actions) and are placed with CSS. The skip link, `focusHeading()` and the smoke selectors keep working.
- **Backplates.** Every panel sits on a near-opaque backplate (about 86% of the desk colour), so small text keeps 4.5:1 over any part of the board. The contrast check in the smoke rail covers the HUD's text.
- **Live regions stay as they are:** `#msg`, the feed and the board status are polite. The meters are not live; their changes are announced through the message line when they matter.
- **Keys** are listed in a help panel from the menu (`?`), which replaces the board's help paragraph.
- **Reduced motion:** sheets appear without sliding, and camera moves jump instead of easing.

## 8. Narrow screens and phones (under 680 px)

[CT-DEC-04](DECISIONS.md#ct-dec-04-platform) puts the desktop first and lets phones show the board in a reduced view, with every control reachable.

- The top strip shrinks to the menu, the phase ("2/5 · Build") and cash. The MixMash nav and the other meters move into the menu.
- The board takes the top half of the window, zoomed in on the stage by default, with zoom and turn buttons. Fit shows the whole lot.
- Phase controls sit in a bottom sheet at two heights: a peek height (the mockup) and full height for Book, Promote and Settle.
- No horizontal scrolling, as the smoke rail checks now.

## 9. Decisions (settled 2026-10-01)

Dave accepted every recommendation on 2026-10-01, and asked for the minimap to stay on the canonical roadmap.

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| 1 | Corner HUD, or one docked drawer down the right side? | Corner HUD | The drawer is simpler, but it always covers the lot's right corner; the corners cover 0.2% of it |
| 2 | Which side do sheets open on? | Right | The stepper and meters read left to right; the lot slides left and stays visible |
| 3 | Mouse wheel zooms? | Yes | The page no longer scrolls, so the wheel is free |
| 4 | The MixMash nav pills in the top strip | Keep hub and mute; move fullscreen and the GitHub link into the menu | They are the site's shared nav (`src/kit/nav.js`); this changes how Front of House styles them, not the kit |
| 5 | Phones: bottom sheet, or ask for landscape? | Bottom sheet | It keeps everything reachable in portrait, as CT-DEC-04 asks |
| 6 | A minimap? | Deferred to step 7, and on the roadmap | The Lot and Fathom Hall fit at a good tile size; Split Acre needs it once players zoom in |
| 7 | Translucent backplates over the board | Accept, as an addition to the production-desk look | Dark panels, 1 px borders and mono numbers stay; only the panels float |

## 10. Build order

Each step is its own pull request with its smoke updates and a service worker bump. The same steps are in [`ROADMAP.md`](../ROADMAP.md#hud-layout-ct-dec-12).

1. **Camera.** Safe rectangle, fit, zoom and pan in `board.js`, behind today's layout. Tests: `tileAt(iso(x, y))` round-trips at every zoom and view turn; clicks still hit the right prop. **Done 2026-10-01.** The safe rectangle is the whole canvas until step 2 gives the board the window.
2. **Full-window board and top strip.** The canvas fills the window; the header becomes the strip; the save bar, help and credit move into the menu. **Done 2026-10-01.** The page never scrolls at any size, phones included: the canvas covers the window, and the panel and the menu scroll inside themselves. Until steps 3 and 4 split it up, the phase panel stays whole: docked on the right, with the lot fit into the space left of it and below the strip, and a bottom sheet on phones. The camera group sits in the lot's empty bottom-left corner. Full screen and the source link moved from the MixMash nav into the menu (`?`), with the keys and save and load. The lot's share of the window in Build is 15% at 1024 × 700, 18% at 1280 × 800, 19% at 1440 × 900 and 26% at 1920 × 1080; the 30% and 35% targets need step 3, when the panel leaves the right side.
3. **Build and Show HUD.** Corner panels, the tool keys, the camera group, the incident card.
4. **Sheets.** Book, Promote, Settle and Done.
5. **Phone.** The bottom sheet and the compact strip.
6. **Performance.** The floor cache, the pixel-ratio rule, and the frame-time check.
7. **Minimap (deferred).** Starts once step 1 has shipped and Split Acre is being played zoomed in. See below.

### Step 7: the minimap

- **What it shows:** the whole room at a small scale (floor, props as blocks, the crowd as a heat tint on show night) and a rectangle for what the camera shows now.
- **What it does:** a click or drag moves the camera there. It turns with the view. Fit, the zoom buttons and the pan keys stay the keyboard path, so the minimap is a shortcut, not the only way.
- **Where:** a small corner panel, about 180 × 110 px, shown only when the camera is zoomed in past fit; at fit, the whole room is already on screen. Hidden on phones, where Fit does the same job.
- **Done when:** it shows the whole room and the view rectangle at every zoom and view turn in every room; a click centres the camera on that spot; it is hidden at fit; show night still meets the frame budget in section 6.

## 11. Done when

The smoke rail measures each of these and fails when one slips.

- The canvas covers the window in every phase at 1024 × 768, 1280 × 800, 1440 × 900 and 1920 × 1080.
- At the default zoom the lot covers at least 30% of the window at every desktop size, and at least 35% at 1280 × 800 and 1440 × 900 (today 8.6% to 24.3%).
- In Build and Show the HUD covers no more than 2% of the lot at the default zoom.
- The document never scrolls at 1024 × 700 and up.
- At 390 × 844 there is no horizontal scroll, every phase control is reachable, and the board takes at least 45% of the window's height.
- Every existing smoke check passes, and the contrast check covers the HUD.
- Show night meets the frame budget in section 6.

The minimap (step 7) has its own done line, above.
