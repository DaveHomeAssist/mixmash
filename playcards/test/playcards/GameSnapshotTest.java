package playcards;

import java.util.List;

public final class GameSnapshotTest
{
    private GameSnapshotTest()
    {
    }

    public static void main(String[] args)
    {
        shouldExposeAnImmutableOpeningSnapshot();
        shouldReturnStateAfterEachPlayerAction();
        shouldExposeHandCompletionAndNextHandAvailability();
        shouldExposeGameOverAndRejectFurtherMoves();
        System.out.println("GameSnapshotTest: all tests passed");
    }

    private static void shouldExposeAnImmutableOpeningSnapshot()
    {
        BlackjackGame game = gameWith(2, 3, 4, 5, 6);
        GameSnapshot opening = game.getSnapshot();

        assertEquals(GamePhase.PLAYER_TURN, opening.getPhase(), "Opening hand should be a player turn");
        assertTrue(opening.canHit(), "Opening snapshot should allow a hit");
        assertTrue(opening.canStay(), "Opening snapshot should allow stay");
        assertFalse(opening.isHandComplete(), "Opening snapshot should not be complete");
        assertThrowsUnsupported(new Runnable()
        {
            @Override
            public void run()
            {
                opening.getHumanCards().add(new Card(7, Card.Suit.CLUBS));
            }
        }, "Snapshot card lists must be read only");

        GameSnapshot afterHit = game.hit();
        assertEquals(2, opening.getHumanCards().size(), "Opening snapshot must not mutate after a hit");
        assertEquals(3, afterHit.getHumanCards().size(), "Action snapshot should contain the new card");
    }

    private static void shouldReturnStateAfterEachPlayerAction()
    {
        BlackjackGame game = gameWith(10, 8, 8, 9);
        GameSnapshot result = game.stay();

        assertEquals(GamePhase.HAND_COMPLETE, result.getPhase(), "Stay should finish the hand");
        assertEquals(BlackjackGame.HandOutcome.HUMAN_WIN, result.getOutcome(), "Player should win the hand");
        assertTrue(result.isHandComplete(), "Completed result should report hand completion");
    }

    private static void shouldExposeHandCompletionAndNextHandAvailability()
    {
        BlackjackGame game = gameWith(10, 10, 8, 8, 2, 3, 4, 5);
        GameSnapshot completed = game.stay();

        assertTrue(completed.canStartNextHand(), "A non-terminal completed hand should allow the next hand");
        GameSnapshot next = game.startHand();
        assertEquals(GamePhase.PLAYER_TURN, next.getPhase(), "Next hand should return to player turn");
        assertEquals(2, next.getHumanCards().size(), "Next hand should deal two player cards");
    }

    private static void shouldExposeGameOverAndRejectFurtherMoves()
    {
        BlackjackGame game = new BlackjackGame("Casey", new Deck(repeatedDealerWins(5)));
        GameSnapshot result = null;

        for (int hand = 0; hand < 5; hand++)
        {
            result = game.stay();
            if (hand < 4)
                game.startHand();
        }

        assertEquals(GamePhase.GAME_OVER, result.getPhase(), "Last chip loss should enter game-over phase");
        assertTrue(result.isGameOver(), "Game-over snapshot should report game over");
        assertFalse(result.canHit(), "Game-over snapshot should not allow a hit");
        assertFalse(result.canStay(), "Game-over snapshot should not allow stay");
        assertFalse(result.canStartNextHand(), "Game-over snapshot should not allow another hand");
        assertThrowsIllegalState(new Runnable()
        {
            @Override
            public void run()
            {
                game.startHand();
            }
        }, "Game over should reject a new hand");
    }

    private static BlackjackGame gameWith(int... values)
    {
        Card[] cards = new Card[values.length];
        for (int index = 0; index < values.length; index++)
            cards[index] = new Card(values[index], Card.Suit.DIAMONDS);
        return new BlackjackGame("Casey", new Deck(cards));
    }

    private static Card[] repeatedDealerWins(int handCount)
    {
        Card[] cards = new Card[handCount * 4];
        for (int hand = 0; hand < handCount; hand++)
        {
            int offset = hand * 4;
            cards[offset] = new Card(10, Card.Suit.DIAMONDS);
            cards[offset + 1] = new Card(10, Card.Suit.CLUBS);
            cards[offset + 2] = new Card(6, Card.Suit.HEARTS);
            cards[offset + 3] = new Card(8, Card.Suit.SPADES);
        }
        return cards;
    }

    private static void assertEquals(Object expected, Object actual, String message)
    {
        if (!expected.equals(actual))
            throw new AssertionError(message + ": expected " + expected + ", got " + actual);
    }

    private static void assertTrue(boolean condition, String message)
    {
        if (!condition)
            throw new AssertionError(message);
    }

    private static void assertFalse(boolean condition, String message)
    {
        if (condition)
            throw new AssertionError(message);
    }

    private static void assertThrowsUnsupported(Runnable action, String message)
    {
        try
        {
            action.run();
        }
        catch (UnsupportedOperationException expected)
        {
            return;
        }
        throw new AssertionError(message);
    }

    private static void assertThrowsIllegalState(Runnable action, String message)
    {
        try
        {
            action.run();
        }
        catch (IllegalStateException expected)
        {
            return;
        }
        throw new AssertionError(message);
    }
}
