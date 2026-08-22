# PlayCards

PlayCards is a dependency-free Java card game project. Its Blackjack game has
two adapters over one shared `BlackjackGame` state engine:

- a Swing desktop table, launched by default;
- a terminal interface, launched with `--console`.

It also ships a console Texas Hold'em simulation (`playcards.holdem`),
launched with `--holdem [seed]` — see below.

## Rules contract

- A new hand deals two cards to the player and dealer.
- The player chooses **Hit** or **Stay**. A fifth player card automatically
  resolves the dealer turn; PlayCards does not allow a sixth card.
- The dealer draws while below 17, up to the same five-card limit.
- A two-card natural blackjack beats a non-natural 21; two naturals push.
- A winning hand transfers one chip from the loser to the winner. Both begin
  with five chips, and the game ends when either participant has zero.
- Production decks contain 52 immutable cards and reshuffle when exhausted.
  Scripted test decks deliberately fail on exhaustion to make tests deterministic.

## Architecture

```text
Card / Hand / Deck / Player       immutable card values and domain state
              |
        BlackjackGame             rules, phases, chip transfers
              |
         GameSnapshot             read-only adapter contract
          /           \
  Blackjack console     Swing controller and components
```

`GamePhase` makes legal progression explicit: `PLAYER_TURN`, `DEALER_TURN`,
`HAND_COMPLETE`, and `GAME_OVER`. Neither UI path owns card dealing, score
calculation, or chip movement.

## Texas Hold'em simulation

`playcards.holdem` is a self-contained console simulation: 2-10 heuristic AI
seats play no-limit-style hands at fixed $5/$10 blinds until one player holds
every chip. It reuses the shared immutable `Card` but owns its own table
state (`TexasHoldemGame`), seats (`HoldemPlayer`), per-hand deck
(`HoldemDeck`), and 5-of-7 `HandEvaluator` with full kicker tiebreaks.

Engine guarantees (all enforced by `TexasHoldemTest`):

- a fresh 52-card deck is built and shuffled every hand from the game's
  seeded generator, so a given seed replays the same game;
- blinds act pre-flop (the big blind keeps his option), a full raise reopens
  action, and betting state resets per street;
- chips are conserved: posts are capped at the stack, uncalled bets are
  refunded, and side pots are layered from per-hand contributions so all-ins
  settle correctly;
- ties split the pot, with odd chips going to the earliest eligible seat.

## Build and run

Requirements: JDK 8 or later and Apache Ant. The project is compiled as Java
8 bytecode and has no external dependencies.

```sh
ant clean test jar
java -jar dist/PlayCards.jar
java -jar dist/PlayCards.jar --console
java -jar dist/PlayCards.jar --holdem        # Texas Hold'em, random seed
java -jar dist/PlayCards.jar --holdem 42     # Texas Hold'em, reproducible game
```

If several JDKs are installed, set `JAVA_HOME` and place its `bin` directory
before Ant on `PATH` before running the commands.

## Tests

`ant test` runs six dependency-free test executables:

- `BlackjackRulesTest`: ace scoring, naturals, input validation, card/deck
  behavior, exhaustion, reshuffling, and the five-card limit.
- `BlackjackGameTest`: dealing, all outcomes, chip movement, automatic
  five-card resolution, game over, and invalid completed-hand moves.
- `GameSnapshotTest`: phase transitions, immutable snapshots, next-hand state,
  and terminal game-over behavior.
- `SwingPresentationTest`: headless rendering of table snapshots and legal
  Swing control enablement.
- `SwingAccessibilityLayoutTest`: adaptive card layout within conservative
  700×480 and 980×640 content areas for the decorated 700×520 and 980×680
  windows, long-player-name resilience, narrow card wrapping, responsive
  controls, all outcome banners, contextual face-down cards, active/winner
  emphasis, focus order, keyboard bindings, accessible announcements, contrast,
  and reduced-motion behavior.
- `TexasHoldemTest`: hand-evaluator ranking (royal/straight flush, the wheel,
  the flush-plus-offsuit-straight trap, two trips as a full house, kickers,
  exact board-plays ties) and engine invariants across 20 seeded full games
  plus a heads-up game (chip conservation every hand, pots fully distributed,
  termination with a single winner).

## Swing interface

Cards preserve their aspect ratio and shrink before wrapping, so five-card
hands remain inside the table at the supported 700×520 outer-window minimum
and the default 980×680 size. Each participant header combines a compact hand
value, turn/outcome badge, physical chip stack, and numeric total. A central
**Chips in Play** rail makes the ten-chip split visible as chips move between
hands. Long player names shorten visually to keep those game-state indicators
visible, while the complete name remains in the game snapshot, metadata, and
tooltip. Face-down cards use the navy striped back from the table design.

Controls use one row at wider sizes and a labelled 2×2 action grid at narrow
sizes. Legal actions remain enabled, but only the recommended next action is
gold: **Hit** during a player turn, **Next Hand** after a completed hand, and
**New Game** at game over. Completed hands show a color- and icon-coded text
banner and highlight the winner. The player-name dialog shares the table theme,
explains the five-chip rule, and places keyboard focus in the labelled field.
Choosing **New Game** returns to that prompt so a new player name can be entered
before both chip stacks reset to five.

### Controls

- **H** — Hit
- **S** — Stay
- **N** — Next Hand, after the hand is complete
- **Enter** — Start the game from the player-name dialog
- **Escape** — Close the player-name dialog and use `Player`

The controls are also labelled, keyboard accessible, and remain disabled when
their action is not legal in the current game snapshot. Status changes and
completed-hand outcomes expose accessible descriptions for assistive
technology, and focus indicators remain visible.
Dealer hole cards, shuffle frames, and newly dealt player placeholders retain
the same visible face-down treatment while exposing distinct descriptions to
assistive technology.

To skip the short deal animations, enable reduced-motion mode:

```sh
java -Dplaycards.reduceMotion=true -jar dist/PlayCards.jar
```
