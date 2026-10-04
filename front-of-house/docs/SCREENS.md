# Front of House Screen Flow

**Status:** Describes the build at 2026-10-02 (HUD steps 1 to 5 done, CT-DEC-12). Hand-written. The phases, actions and refusals it names are generated in [CATALOG.md](CATALOG.md); when the two disagree, CATALOG.md and the code win and this file is fixed.

This document covers every screen the player can reach, how they get there and how they leave, and what each control sends to the engine. Layout decisions and mockups are in [HUD.md](HUD.md); rules are in [RULES.md](RULES.md).

## 1. The flow

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Book: new game, or a save in Book
    Book --> Build: pick a deal on an offer card (chooseDeal)
    Build --> Book: Back
    Build --> Promote: Lock the layout (confirmBuild)
    Promote --> Build: Back to the build
    Promote --> Show: Open the doors (confirmPromotion, pays what is due)
    state Show {
        [*] --> DoorsCrew: only with ?night-slice=1
        [*] --> Playback
        DoorsCrew --> Playback: choose bar or gate
        Playback --> Incident: clock reaches the incident window, or Skip
        Incident --> [*]: pick a response (respond)
    }
    Show --> Settle: response chosen; wind-down plays to curfew
    Settle --> SettlementWindow: Open the settlement
    SettlementWindow --> Settle: Close (Esc)
    SettlementWindow --> Show: Sign, on a multi-night run with nights left
    SettlementWindow --> Done: Sign (acceptSettlement)
    Done --> Book: Book the next show (nextShow)
    Done --> Book: Start over (retry)
```

Windows (Deals, Lot details, Object inspection, Clear confirmation, Last settlement, Show history) and the menu open over any screen and close back to it; they never change the phase, except signing in the settlement window. The full action-by-phase grid is [CATALOG.md section 3](CATALOG.md#3-transition-grid).

## 2. What is always on screen

| Area | Contents | Notes |
| --- | --- | --- |
| Top strip | MixMash hub link and Mute All (shared studio nav), title, the five-step stepper (Book to Settle; Done has no step), camera buttons (−, Fit, +, Turn), meters (Cash, Venue rep, Band), Menu (?) | "Band" is the booked act's relationship. On phones the strip takes two rows |
| Board | The isometric room on a canvas, focusable, with an `aria-live` status line | Fills the window under the strip. Dimmed in Book, Settle and Done; night lighting in Show |
| Panel | The current phase's controls | Desktop: corner plates in Build and Show, a right-hand sheet otherwise. Phone: a bottom sheet with tabs |
| Message line | Refusals and confirmations (`#msg`) | Every refused action shows the engine's message here ([CATALOG.md section 4](CATALOG.md#4-refusal-messages)) |

## 3. Screens

### Book (`book`)

| | |
| --- | --- |
| Purpose | Choose the room, the act and the deal |
| Arrives from | A new game; Next show or Start over from Done; Back from Build; a save in Book |
| Shows | Room tabs (locked rooms greyed), nights for Loam Shell, two offer cards with the act's relationship, draw, usual price and ask, and each card's deal buttons. On a career's first show the deals are explained under the buttons; after that, in the Deals window (ⓘ) |
| Controls → engine | Room tab → `chooseVenue`. Nights → stored with the deal. Guarantee, Door deal or Sponsor (Split Acre) on a card → `chooseDeal` with that act. A refused door deal says why on the card |
| Leaves to | Build |

### Build (`build`)

| | |
| --- | --- |
| Purpose | Lay out the room until it passes R-18 |
| Arrives from | Book; Back from Promote |
| Shows | Full board with sightlines on. Top left: phase card and message. Top right: capacity, power bar, clear view, blocked tiles, staff, costs so far, the readiness line, Fence, Sightlines and Details. Bottom left: Select (the default), tools 1 to 8 with sprites and costs, Bulldoze, Rotate, Undo, Redo. Bottom right: Suggested layout, Clear, Back, **Lock the layout** |
| Controls → engine | With a placement tool, click or Enter on a tile → `place`. In Select, click/touch/Enter → inspect the current object without changing the layout; a dashed footprint marks it. Escape closes dialogs/menu first, then returns a placement tool or bulldozing to Select. Bulldoze or Delete → `remove`. Fence → `place` or `remove` the fence kit. Suggested layout → `setLayout` with the room's starter. Clear → one dialog showing the current object count; confirm → `setLayout` with nothing. Cancel preserves the layout. Details → Lot details window (remove any object by name). Undo or Redo → `setLayout` with the layout from before or after the last change (a bulldozer drag is one change; the list is kept in memory only and clears when the phase changes or a game is started or loaded). Lock the layout → `confirmBuild` (refused with the missing items until ready) |
| Phone | Peek sheet with tabs Lot, Tools, Actions |
| Leaves to | Promote, or Book |

### Promote (`promote`)

| | |
| --- | --- |
| Purpose | Set the price and ads, and see the likely crowd before paying |
| Arrives from | Build |
| Shows | Ticket price, three ad channels (flyers, social, radio), seat price in Loam Shell; forecast crowd range, buzz, ticket money range, ad spend, **due before doors**, and the presale chart |
| Controls → engine | Sliders → `setPromotion`. Back to the build → `back`. **Open the doors** → `confirmPromotion` (refused if what is due is more than cash) |
| Phone | Tabs: Price and ads, Forecast, Presales |
| Leaves to | Show, or Build |

### Show (`show`)

| | |
| --- | --- |
| Purpose | Play the night and answer one incident |
| Arrives from | Promote; signing a night of a multi-night run with nights left |
| Shows | Night board with beams and crowd. Top left: "Doors are open", the clock (19:00 to 23:00) and the status line. Bottom left: the feed (last four lines). Bottom right: crowd in the room, Skip to the problem. Top right, when the incident arrives: its card with every response, its cost and its consequence, and Locate (centres the PA, gate or stage) |
| Controls → engine | A response → `respond` (refused if it costs more than cash). Doors crew card (opt-in trial) → `chooseDoorCrew`. Skip and Locate change only the view |
| Timing | See section 5. Reduced motion jumps straight to the incident |
| Phone | Peek sheet with tabs Problem and Night; the incident brings Problem forward |
| Leaves to | Settle |

### Settle (`settle`)

| | |
| --- | --- |
| Purpose | Read the night's money and sign it |
| Arrives from | Show |
| Shows | A one-line summary (people and promoter net) and **Open the settlement**. The settlement window: header (act, room, deal, attendance, satisfaction), Section A gross revenue, Section B costs, Section C the deal, artist payout, promoter net, the satisfaction parts, reputation and relationship changes, cash on hand, the stamp, the "For next time" tip and **Sign the settlement** |
| Controls → engine | Sign → `acceptSettlement`. Close returns to the summary without signing |
| Phone | Settlement window tabs: Revenue, Costs, Payout, Crowd |
| Leaves to | Done, or Show for the next night of a run |

### Done (`done`)

| | |
| --- | --- |
| Purpose | See where the career stands and start the next show |
| Arrives from | Settle |
| Shows | A good or rough night heading, the tier goal checklist with progress, one line on the last show, Last settlement and Show history buttons |
| Controls → engine | **Book the next show** → `nextShow` (disabled, with the amount needed, when no offer is affordable). Start over → `retry` |
| Leaves to | Book |

## 4. Windows and the menu

| Window | Opened from | Contents | Notes |
| --- | --- | --- | --- |
| Settlement | Settle: Open the settlement | The sheet with Sign in its footer | Signing is the only phase change a window makes |
| Last settlement | Done | The signed sheet, read-only | Nothing to sign |
| Show history | Done | Every settled show, newest first | The only window allowed to scroll |
| How the deals work | Book: Deals (ⓘ) | Guarantee, door deal, and sponsor in Split Acre | |
| Lot details | Build: Details | Every placed object with a remove button | Keyboard route to removing by name |
| Object inspection | Build: Select, then click/touch/Enter on an object | Name, coordinates, footprint, rental cost and Remove | Never places; removal uses existing Undo and returns focus to the canvas. Selection is transient and clears after layout/phase/load/history changes |
| Clear confirmation | Build: Clear | Object count, Cancel and Clear all objects | One confirmation, one undo step; cancel returns focus to Clear |
| Menu | Menu button or ? | Dark controls, full screen, source link, New game (Career, Sandbox, Wet lot), keys help, Save and load | New game asks for a second press when a game is under way |

All windows are modal dialogs: focus moves in, Tab stays inside, Escape or Close returns focus to the button that opened them.

## 5. Show night timeline

Playback would run from doors to curfew in 12 seconds (`PLAY_SECONDS` in `game.js`); it pauses when it reaches the incident. The clock maps the night to 19:00 to 23:00 (`clock()`). Incident windows come from `INCIDENTS[].window` in `data.mjs` ([R-11a](RULES.md#r-11a-incident-timing), [CATALOG.md section 7](CATALOG.md#7-incidents)).

| Share of night | Clock | What happens |
| --- | --- | --- |
| 0 | 19:00 | Doors open; feed: how many already hold tickets. With `?night-slice=1`, the doors crew card pauses here |
| 0.05 to 0.15 | 19:12 to 19:36 | Rain at doors can arrive |
| 0.05 to 0.2 | 19:12 to 19:48 | Gate jam at doors can arrive |
| 0.15 | 19:36 | Feed: walk-up is buying at the gate |
| 0.3 (`ACT_ON_STAGE_AT`) | 20:12 | Feed: the act takes the stage |
| 0.4 to 0.8 | 20:36 to 22:12 | PA dropout can arrive |
| 0.88 to 0.95 | 22:31 to 22:48 | Noise curfew can arrive (Loam Shell and Split Acre) |
| After the response | to 23:00 | A 3-second wind-down to curfew; the phase is already Settle. Signing during it finishes it |

## 6. Edge paths

| Situation | What happens |
| --- | --- |
| Reload or return later | The save is migrated and validated (`migrateSave`, `normalizeState`) and the game reopens in the last phase its contents support. A reload in Show restarts that night's playback; the incident is re-derived from the seed, so it is the same one |
| Save code | Menu → Save and load. A code from another game or a damaged code is refused and changes nothing; a version 1 code converts |
| New game while one is under way | Career, Sandbox or Wet lot asks for a second press before erasing |
| Out of money | Done disables Book the next show and names the amount needed; Start over stays open |
| Multi-night run (Loam Shell) | Each night settles on its own. If the next night is unaffordable, the run ends at Done |
| A refused action | The engine's message appears in the message line; nothing changes |
| Reduced motion | Show skips the playback to the incident |
| Phone (under 680 px) | Board on top, the panel in a bottom sheet with tabs; no page or sheet scrolls |

## 7. Keys and mouse

| Input | Where | Does |
| --- | --- | --- |
| ? | Anywhere outside a text field | Opens or closes the menu |
| Escape | Window/menu first, otherwise Build | Closes the dialog/menu; otherwise cancels placement or bulldozing and returns to Select |
| 1 to 8 | Build | Picks Stage, PA S, PA M, Lights, Bar, Restroom, Gate, Exit |
| Arrows | Board, Build | Moves the build cursor |
| Enter or Space | Board, Build | Places with a placement tool, or inspects the object in Select |
| Delete or Backspace | Board, Build | Removes at the cursor |
| R | Board, Build | Rotates the next object |
| B | Board, Build | Bulldoze on or off |
| Ctrl+Z or ⌘Z | Build, outside a text field | Undoes the last change to the layout |
| Ctrl+Shift+Z, Ctrl+Y or ⌘⇧Z | Build, outside a text field | Redoes a change that was undone |
| Q | Board | Turns the view a quarter |
| + / − / 0 | Board | Zoom in, out, fit |
| Shift + arrows | Board, zoomed | Pans |
| Mouse wheel | Board | Zooms |
| Middle drag (any drag outside Build) | Board, zoomed | Pans |

Every key above comes from one table, `front-of-house/controls.mjs`, which both key handlers in `game.js` read. The menu's key list must match it word for word, and `test-engine.mjs` fails on two bindings that one key press could trigger together, or on a key the browser owns (Tab, F1 to F12, Ctrl or Cmd with W, T, N or L).

## 8. Keeping this current

Update this file in the same change as any new screen, window, tab, control or edge path. A new phase or action also needs a line in `tools/docs.mjs`, which fails the build until it has one.

## Live Lot services trial (FOH-O01b)

Promote gains a Live services settings button on the Lot, showing On/Off. Its window contains the opt-in checkbox. It explains the effect on settlement, the required bar, the known arrival pattern and paused starting clock. It is saved with the promotion and show; the existing doors snapshot remains a separate experiment.

Show keeps the corner HUD. Services displays admission/bar queue counts, oldest waits, current processing rates, current-rate wait estimates, actual bar service/loss and held receipts. Controls provides the worker's current station or travel ETA, Help admission / Return to bar, Play/Pause, +5 min, Next event / Close show and a 1×/4×/12× clock selector. Touch controls are at least 44px high. Worker buttons disable during travel or at the current station. Clock controls disable at an unanswered incident; the Problem tab receives focus. After responding, the clock remains paused and focus returns to Play. Reload restores logical time, queues and travel, with playback paused.

The pilot's board draws the actual admitted population, with integer allocation fixing fractional crowd overdraw for this mode. Distinct admission/bar movement remains FOH-O01c; the current markers are not individual agents. Camera and theme changes cannot advance or settle services. Reduced motion retains the same controls and counts.

Settlement retains its existing window. The live pilot splits Revenue and Deal into separate phone tabs to keep both reachable without scrolling. The Crowd tab reconciles presales, walk-up cash, refunds, cancelled future demand and abandonment; the Bar row reports served/lost requests. Signing pays the existing career transition once. Invalid checkpoint recovery is explicitly reported on Show; cash and already-paid response costs are retained.

The live Services view separates blue outside admission samples, gold inside bar samples, ordinary floor guests and an orange worker. The Live services settings explain the colors and representative limit; exact queues and receipts remain in the HUD. Controls keep their position while staffing status and counts change.
