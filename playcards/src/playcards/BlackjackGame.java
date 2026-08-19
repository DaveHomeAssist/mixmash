package playcards;

/**
 * The single state engine for every PlayCards blackjack hand.
 */
public final class BlackjackGame
{
    private final Deck deck;
    private final Player human;
    private final Player dealer;
    private GamePhase phase;
    private HandOutcome outcome;

    public BlackjackGame(String humanName)
    {
        this(humanName, new Deck(), true);
    }

    BlackjackGame(String humanName, Deck deck)
    {
        this(humanName, deck, false);
    }

    private BlackjackGame(String humanName, Deck deck, boolean shuffle)
    {
        if (deck == null)
            throw new IllegalArgumentException("Deck is required");

        this.deck = deck;
        human = new Player(normalizeName(humanName));
        dealer = new Player("Dealer");

        if (shuffle)
            deck.shuffle();

        beginHand();
    }

    /**
     * Starts the next hand only after the prior hand is complete.
     */
    public GameSnapshot startHand()
    {
        if (phase == GamePhase.GAME_OVER)
            throw new IllegalStateException("Start a new game after a player runs out of chips");
        if (phase != GamePhase.HAND_COMPLETE)
            throw new IllegalStateException("Complete the current hand before starting another one");
        return beginHand();
    }

    /**
     * Applies a player hit and returns the resulting immutable state.
     */
    public GameSnapshot hit()
    {
        requirePlayerTurn();
        human.acceptACard(deck.draw());

        if (human.checkBust())
            completeHand();
        else if (human.getCardCount() == Hand.MAX_CARDS)
            return stay();

        return getSnapshot();
    }

    /**
     * Resolves the dealer turn and returns the completed hand state.
     */
    public GameSnapshot stay()
    {
        requirePlayerTurn();
        phase = GamePhase.DEALER_TURN;

        while (dealer.handValue() < 17 && dealer.getCardCount() < Hand.MAX_CARDS)
            dealer.acceptACard(deck.draw());

        completeHand();
        return getSnapshot();
    }

    public GameSnapshot getSnapshot()
    {
        return new GameSnapshot(human.getName(), human.getCards(), dealer.getCards(),
                human.handValue(), dealer.handValue(), human.getPoints(), dealer.getPoints(),
                phase, outcome);
    }

    private GameSnapshot beginHand()
    {
        human.clearHand();
        dealer.clearHand();
        phase = GamePhase.PLAYER_TURN;
        outcome = null;

        human.acceptACard(deck.draw());
        dealer.acceptACard(deck.draw());
        human.acceptACard(deck.draw());
        dealer.acceptACard(deck.draw());

        if (human.hasBlackjack() || dealer.hasBlackjack())
            completeHand();

        return getSnapshot();
    }

    private void completeHand()
    {
        outcome = determineHandOutcome(human, dealer);

        switch (outcome)
        {
            case HUMAN_BLACKJACK:
            case DEALER_BUST:
            case HUMAN_WIN:
                dealer.transferOneChipTo(human);
                break;
            case DEALER_BLACKJACK:
            case HUMAN_BUST:
            case DEALER_WIN:
                human.transferOneChipTo(dealer);
                break;
            case PUSH:
                break;
            default:
                throw new IllegalStateException("Unknown hand outcome: " + outcome);
        }

        phase = human.getPoints() == 0 || dealer.getPoints() == 0
                ? GamePhase.GAME_OVER
                : GamePhase.HAND_COMPLETE;
    }

    private void requirePlayerTurn()
    {
        if (phase != GamePhase.PLAYER_TURN)
            throw new IllegalStateException("Hit and stay are only available during the player turn");
    }

    private static String normalizeName(String humanName)
    {
        if (humanName == null || humanName.trim().length() == 0)
            return "Player";
        return humanName.trim();
    }

    static HandOutcome determineHandOutcome(Player human, Player dealer)
    {
        boolean humanBlackjack = human.hasBlackjack();
        boolean dealerBlackjack = dealer.hasBlackjack();

        if (humanBlackjack && dealerBlackjack)
            return HandOutcome.PUSH;
        if (humanBlackjack)
            return HandOutcome.HUMAN_BLACKJACK;
        if (dealerBlackjack)
            return HandOutcome.DEALER_BLACKJACK;
        if (human.checkBust())
            return HandOutcome.HUMAN_BUST;
        if (dealer.checkBust())
            return HandOutcome.DEALER_BUST;
        if (human.handValue() > dealer.handValue())
            return HandOutcome.HUMAN_WIN;
        if (dealer.handValue() > human.handValue())
            return HandOutcome.DEALER_WIN;
        return HandOutcome.PUSH;
    }

    public enum HandOutcome
    {
        HUMAN_BLACKJACK,
        DEALER_BLACKJACK,
        HUMAN_BUST,
        DEALER_BUST,
        HUMAN_WIN,
        DEALER_WIN,
        PUSH
    }
}
