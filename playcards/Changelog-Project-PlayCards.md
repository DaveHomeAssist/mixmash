# PlayCards Project Changelog

This changelog records functional changes to the PlayCards Blackjack project.

## Unreleased

### Added

- Mockup-aligned physical chip stacks for both participants and a central `Chips in Play` rail that renders the current player/dealer split directly from each `GameSnapshot`.
- Compact turn and result badges in participant headers, including `Your Turn`, `Dealer Turn`, `Winner`, and `Push` states.
- Rounded card faces and a navy diagonal-stripe treatment for every face-down card context.
- Table-button hover, disabled, primary, secondary, and keyboard-focus states implemented with dependency-free Swing painting.
- Adaptive card sizing and predictable narrow-hand wrapping, with aspect-ratio preservation and shared minimum/maximum dimensions in `TableTheme`.
- Responsive game controls that switch between one row and a labelled 2×2 action grid while retaining 44-pixel targets and visible keyboard focus.
- Completed-hand outcome panels with outcome-specific icon, color, heading, copy, winner/tie emphasis, and a primary Next Hand action.
- Active-turn participant emphasis and legal-action emphasis driven entirely from immutable `GameSnapshot` state.
- A themed, modal player-name prompt with labelled input, deterministic focus order, Enter submission, Escape cancellation, and a safe `Player` fallback.
- Accessible status change events, outcome descriptions, participant-state descriptions, card descriptions, and labelled action groups.
- A `playcards.reduceMotion` system-property mode that resolves shuffle/deal transitions immediately without starting Swing timers.
- `SwingAccessibilityLayoutTest` headless coverage for conservative 700×480 and 980×640 content areas inside the decorated target windows, card scaling/wrapping, outcome variants, hidden/revealed and contextual face-down cards, turn/winner emphasis, responsive control legality, focus order, H/S/N bindings, player-name prompt behavior, announcements, contrast, and reduced motion.
- Long-player-name layout coverage at both supported content sizes, including header bounds, retained hand-value and chip widths, unchanged short-name rendering, and complete-name metadata.
- A centralized Swing visual-token system for palette, typography, spacing, card dimensions, borders, and window sizing.
- Classic card-face rendering with top and bottom rank/suit indices, a central suit mark, and a distinct face-down card back.
- Gold chip-total badges and a dark table rail that clearly separates the main felt from dealer and player hand surfaces.
- Dependency-free Swing `Timer` animations for card-back shuffling, sequential opening deals, player hits, and dealer turns. Controls remain unavailable until each animation settles on its `GameSnapshot` state.
- Timing-safe Swing regression coverage confirming that the shuffle-and-deal sequence completes and restores the expected hidden dealer card.
- Swing regression coverage confirming the visible card hierarchy.
- A documented rules contract and build/run guide in `README.md`, plus Git ignore rules for generated Ant output and local NetBeans settings.
- `Hand`, `GamePhase`, and immutable `GameSnapshot` domain types. Every game action now returns a snapshot for console and Swing rendering.
- Focused Swing components: `CardView`, `ScorePanel`, `HandPanel`, `GameTablePanel`, `GameControls`, a visual theme, and `BlackjackController`.
- Keyboard shortcuts for Swing play: H for Hit, S for Stay, and N for Next Hand; controls now expose accessible labels and only enable legal moves.
- `GameSnapshotTest` coverage for read-only snapshots, state transitions, legal next hands, and terminal game-over state; `SwingPresentationTest` coverage for snapshot rendering and legal control enablement.
- A Java Swing desktop table with player and dealer card areas, a hidden dealer hole card, chip totals, hand status, and Hit, Stay, Next Hand, and New Game controls.
- `BlackjackGame`, the shared game-state engine for both Swing and console play, covering card dealing, player decisions, dealer turns, scoring, and completed-hand state.
- A default graphical launch path for the packaged JAR. The original terminal game remains available with the `--console` argument.
- An Ant `test` target with self-contained rule and game-state test runners. No external test dependency is required.
- Focused regression coverage for ace scoring, natural-blackjack ties, natural versus three-card 21s, blank decision input, deck indexing, all hand outcomes, five-card completion, chip changes, game-over, and invalid post-hand moves.

### Changed

- Reworked participant headers around the table mockup hierarchy: participant name, compact `Hand` label, large value, state badge, and physical chips now read as one unit.
- Limited gold primary-action emphasis to one trustworthy next action while keeping other legal actions visibly available as secondary controls.
- Restyled the player-name prompt with the chip-transfer rule, gold-labelled input, and `Deal Me In` primary action.
- Made `New Game` return to the player-name prompt before resetting both chip stacks, matching the table mockup's new-session flow.
- Explicitly hides the ordinary status label while a completed-hand outcome banner is visible, preventing native Aqua from ghosting both messages into the same region.
- Rebalanced the central chip rail and card spacing so the revised interface remains clip-free at conservative 700×480 and 980×640 content sizes.
- Made `ScorePanel` dynamically shorten only the displayed player name when the participant header is constrained, preserving the complete name in game state, metadata, and a tooltip while reserving space for hand value and chips.
- Removed manual screen-reader verification from the active release requirements; the existing automated keyboard, focus, labeling, announcement, and contrast checks remain part of the regression suite.
- Moved hand-value text into the participant header so the documented 700×520 outer window remains clip-free after accounting for native frame decorations.
- Made face-down accessibility descriptions distinguish the dealer hole card, shuffle feedback, and a pending player Hit card.
- Tightened headless layout regression dimensions to conservative 700×480 and 980×640 content areas for the decorated target windows.
- Rebalanced root, hand, and card spacing so both hand zones and all controls remain clip-free at the supported minimum window size.
- Moved Swing status and outcome wording into `GamePresentation` so the frame, banner, and tests share one presentation contract.
- Restored native focus painting on game controls and dynamically promotes the legal Hit/Stay, Next Hand, or terminal New Game action.
- Replaced mutable card fields and numeric face-card branching with immutable `Card.Rank` and `Card.Suit` values. Cards now have value-based equality and terminal-neutral text output.
- Added a dedicated `Hand` structure that owns card storage, ace-aware scoring, blackjack/bust state, and the established five-card rule. A sixth card now fails explicitly instead of being silently ignored.
- Reworked `Deck` around a queue-based draw pile with `draw()` and remaining-card visibility; scripted test decks now fail deterministically when exhausted.
- Made `BlackjackGame` enforce explicit player, dealer, completed, and terminal phases. It now rejects starting a new hand mid-turn and exposes state through immutable snapshots.
- Updated the console and Swing adapters to render snapshots rather than inspect or mutate player/deck state. The Swing layout is now composed from independently testable/resizable panels.
- Corrected multi-ace scoring so aces are first counted as one, with one ace promoted to eleven only when the hand stays at or below 21.
- Resolved natural blackjack outcomes before ordinary score comparisons. Two natural blackjacks now push, and a natural blackjack beats a three-card 21.
- Replaced per-turn scanner construction with shared input handling and safe blank-input validation in the console game.
- Refactored the console controller into an input/output adapter over `BlackjackGame`, removing its duplicate dealing, dealer, scoring, and chip-transfer logic.
- Removed the full-deck display that exposed the remaining card order at the beginning of each hand.
- Corrected `Deck.pickACard` to use its documented one-based card index and reject invalid values with `IllegalArgumentException`.
- Added card and card-count accessors needed by the desktop interface without changing the existing console display methods.

### Build and Verification

- Installed OpenJDK 21 and Apache Ant 1.10.17 for local builds while retaining Java 8 bytecode compatibility.
- `ant clean test jar` completes successfully.
- `BlackjackRulesTest`, `BlackjackGameTest`, `GameSnapshotTest`, `SwingPresentationTest`, and `SwingAccessibilityLayoutTest` pass.
- All five compiled test runners and the packaged console flow pass on the installed Java 8 JRE.
- The packaged JAR declares `playcards.PlayCards` as its main class and includes the Swing interface.
- The compiled classes use major version 52, which is Java 8 compatible.

## Original Project

### 2019

- Created as a CSC-122 console Blackjack project using Java, NetBeans project metadata, and Apache Ant.
- Established the original `Card`, `Deck`, `Player`, `Blackjack`, and `PlayCards` class structure.
