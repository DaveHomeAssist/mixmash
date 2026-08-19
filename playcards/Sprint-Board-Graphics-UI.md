# PlayCards Graphics and UI Sprint Board

**Goal:** Turn the functional Swing table into a clearer, more polished Blackjack experience while preserving the shared `BlackjackGame` engine and dependency-free Java 8/Ant build.

**Current baseline:** `PlayCardsFrame` composes `GameTablePanel`, `HandPanel`, `CardView`, `ScorePanel`, `ChipCountView`, `ChipRail`, and `GameControls`. The classic-felt table now follows the supplied table mockup with physical chip stacks, a shared chip rail, compact value/state hierarchy, striped card backs, one primary action, and H/S/N shortcuts.

**Sprint 1 progress:** P0 visual tokens/card hierarchy and P1 chip/table-surface work are complete. `TableTheme` owns Swing visual measurements and typography, `CardView` renders rounded faces plus striped backs, participant chip totals render as physical stacks, and `ChipRail` exposes the live ten-chip split between the two hand surfaces.

**Sprint 3 progress:** P0 shuffle and deal feedback is complete. Opening a game or starting a new game runs a short card-back shuffle followed by a sequential opening deal; Hit and Stay animate their card transitions while controls remain locked.

**Sprint 2 progress:** Complete. Cards scale before wrapping at narrow sizes, controls switch to a 2×2 action grid, completed hands receive an outcome-first state, and the player-name entry now shares the table theme.

**Sprint 3 progress update:** Outcome-specific language, icons, colors, active-turn highlighting, legal-action emphasis, and an instant reduced-motion path are complete.

**Sprint 4 progress:** P0 headless release QA is complete. The suite reserves space for native window decorations with conservative 700×480 and 980×640 content areas and covers long player names, card visibility/context, action legality, focus order, keyboard bindings, accessible announcements/descriptions, contrast, and reduced motion.

## Sprint 1 — Visual Foundation

| Priority | Work item | Current evidence | Definition of done |
|---|---|---|---|
| P0 | Establish visual tokens | Complete: `TableTheme` centralizes palette, typography, spacing, borders, animation timing, window dimensions, responsive card sizes, and the control breakpoint. | Centralize color, spacing, border, font, and responsive card-size tokens in `TableTheme`; remove duplicate visual literals from Swing components. |
| P0 | Improve card hierarchy | Complete: `CardView` renders two corner indices, a centered suit, a card back, and contextual accessible descriptions. | Add corner rank/suit indicators and a centered suit mark; preserve face-down card rendering and accessible labels. |
| P1 | Make chip totals scannable | Complete: `ScorePanel` combines participant, compact hand value/state, physical chip stack, and numeric total; `ChipRail` shows the ten-chip split, and long names shorten before game state can be displaced. | Add a compact chip badge or count treatment that remains readable at the minimum 700×520 window size. |
| P1 | Refine table surface | Complete: the dark rail, panel borders, active/winner states, felt, and card zones provide distinct table hierarchy. | Add subtle hierarchy between table felt, hand zones, borders, and card area without image assets or external libraries. |

## Sprint 2 — Layout and Responsiveness

| Priority | Work item | Current evidence | Definition of done |
|---|---|---|---|
| P0 | Adaptive card layout | Complete: `HandPanel` sizes cards from available width/height, wraps after the readable minimum, and keeps value in the header; conservative decorated-window content checks are clip-free. | Cards scale or wrap predictably at 700×520 and 980×680; no clipping or horizontal overflow. |
| P0 | Responsive controls | Complete: `GameControls` switches between 1×4 and 2×2 action layouts at the shared breakpoint. | At narrow widths, controls retain visible labels and status without overlap; use a secondary row or adaptive layout if required. |
| P1 | Outcome-first completed state | Complete: `OutcomePanel` supplies outcome icon/color/copy, hand emphasis identifies the winner, and Next Hand becomes primary. | Give completed hands a clear visual state: outcome banner, winning-side emphasis, and an obvious Next Hand call to action. |
| P2 | Improve new-game entry | Complete: `PlayerNameDialog` and `PlayerNamePanel` use `TableTheme`, labelled input, and explicit keyboard order. | Replace or restyle the name prompt only if it can share the table visual language without delaying game launch. |

## Sprint 3 — Game Feel and Feedback

| Priority | Work item | Current evidence | Definition of done |
|---|---|---|---|
| P0 | Action feedback | Complete: non-blocking timers animate shuffle/deal/hit/stay and `playcards.reduceMotion=true` resolves them instantly. | Add short, non-blocking Swing `Timer` transitions for a dealt card and dealer reveal; reduced-motion mode remains instant. |
| P1 | Outcome language and emphasis | Complete: every engine outcome maps to a specific heading, icon, color, and concise text announcement. | Use outcome-specific iconography, color, and concise copy while retaining text as the source of truth. |
| P1 | Strengthen turn guidance | Complete: snapshot phase highlights the active hand and legal actions; completed outcomes highlight the winner or both tied hands. | Highlight the active participant and visually reinforce the legal next action without disabling keyboard shortcuts. |
| P2 | Lightweight session progress | Chip totals reset only through New Game; no visual history exists. | Evaluate a compact hand-result trail that is local to the current session and does not add persistence. |

## Sprint 4 — Polish and Release QA

| Priority | Work item | Current evidence | Definition of done |
|---|---|---|---|
| P0 | Visual regression checks | Headless checks complete at conservative 700×480 and 980×640 content sizes, including long-name header resilience, scaling, wrapping, clipping, hidden/revealed cards, outcomes, and controls. Manual screen inspection remains a release smoke activity. | Add headless tests for card counts, hidden/revealed state, enabled controls, and minimum-size layout; manually inspect both target window sizes. |
| P0 | Accessibility pass | Complete for the current release scope: automated checks cover focus sequence, H/S/N actions, focus painting, control targets, contrast, contextual face-down labels, descriptions, announcements, and complete-name metadata. Manual screen-reader verification is outside the current release scope. | Verify focus order, keyboard-only flow, readable contrast, descriptive card labels, and outcome announcements. |
| P1 | Package smoke test | JAR and console launch are verified; the Swing window has not been visually inspected from a persistent desktop session. | Launch `java -jar dist/PlayCards.jar` from a local Terminal, play Hit/Stay/Next Hand/New Game, and capture the verified result in the changelog. |
| P1 | Release cleanup | README and changelog describe the responsive layout, accessibility contexts, controls, build, and remaining manual verification boundary. | Update README screenshots or UI notes after the final visual direction is implemented; run `ant clean test jar`. |

## Recommended execution order

1. Sprint 1 P0 items — establish the visual system before changing layouts.
2. Sprint 2 P0 items — guarantee usable window behavior before animation or polish.
3. Sprint 3 P0 items — add feedback without altering game rules or state ownership.
4. Sprint 4 P0 items — validate the final surface, then close P1 polish items.

## Guardrails

- Do not duplicate scoring, dealing, chip updates, or outcomes in Swing components; render `GameSnapshot` only.
- Keep the five-card rule, dealer-below-17 rule, chip-transfer rule, and all current snapshot tests intact unless rules change intentionally.
- Keep the Java 8 bytecode target, Ant build, and dependency-free project model.
- Prefer native Swing painting and `Timer` animation over adding a graphics framework.
