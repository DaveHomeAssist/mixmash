package playcards;

/** Text shared by the Swing status and outcome surfaces. */
final class GamePresentation
{
    private GamePresentation()
    {
    }

    static String statusMessage(GameSnapshot snapshot)
    {
        switch (snapshot.getPhase())
        {
            case PLAYER_TURN:
                return snapshot.getHumanName() + ", your turn: Hit or Stay.";
            case DEALER_TURN:
                return "Dealer is playing.";
            case GAME_OVER:
                return snapshot.getHumanPoints() > snapshot.getDealerPoints()
                        ? snapshot.getHumanName() + " wins the game. Start a new game to play again."
                        : "Dealer wins the game. Start a new game to play again.";
            case HAND_COMPLETE:
                return outcomeMessage(snapshot.getOutcome());
            default:
                throw new IllegalStateException("Unknown game phase: " + snapshot.getPhase());
        }
    }

    static String outcomeMessage(BlackjackGame.HandOutcome outcome)
    {
        switch (outcome)
        {
            case HUMAN_BLACKJACK:
                return "Blackjack! You take the hand.";
            case DEALER_BLACKJACK:
                return "Dealer blackjack.";
            case HUMAN_BUST:
                return "Bust. Dealer takes the hand.";
            case DEALER_BUST:
                return "Dealer busts. You take the hand.";
            case HUMAN_WIN:
                return "You take the hand.";
            case DEALER_WIN:
                return "Dealer takes the hand.";
            case PUSH:
                return "Push. No chips change hands.";
            default:
                throw new IllegalStateException("Unknown hand outcome: " + outcome);
        }
    }
}
