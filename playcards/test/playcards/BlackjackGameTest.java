package playcards;

public final class BlackjackGameTest
{
    private BlackjackGameTest()
    {
    }

    public static void main(String[] args)
    {
        shouldDealTwoCardsToEachPlayer();
        shouldResolvePlayerBustAndAwardDealerAChip();
        shouldResolveDealerBustAndAwardPlayerAChip();
        shouldResolveStandardHumanWin();
        shouldResolveStandardDealerWin();
        shouldResolvePushWithoutChangingChips();
        shouldResolveNaturalBlackjacks();
        shouldAutomaticallyResolveTheFifthCard();
        shouldEndTheGameWhenAPlayerRunsOutOfChips();
        shouldRejectMovesAfterHandCompletion();
        System.out.println("BlackjackGameTest: all tests passed");
    }

    private static void shouldDealTwoCardsToEachPlayer()
    {
        BlackjackGame game = gameWith(2, 3, 4, 5);

        GameSnapshot snapshot = game.getSnapshot();
        assertEquals(2, snapshot.getHumanCards().size(), "Player should receive two cards");
        assertEquals(2, snapshot.getDealerCards().size(), "Dealer should receive two cards");
        assertFalse(snapshot.isHandComplete(), "Opening hand should remain active without blackjack");
    }

    private static void shouldResolvePlayerBustAndAwardDealerAChip()
    {
        BlackjackGame game = gameWith(10, 5, 9, 6, 5);

        game.hit();

        assertOutcomeAndChips(game, BlackjackGame.HandOutcome.HUMAN_BUST, 4, 6);
    }

    private static void shouldResolveDealerBustAndAwardPlayerAChip()
    {
        BlackjackGame game = gameWith(2, 3, 4, 5, 6, 7, 8);

        game.hit();
        game.stay();

        assertOutcomeAndChips(game, BlackjackGame.HandOutcome.DEALER_BUST, 6, 4);
    }

    private static void shouldResolveStandardHumanWin()
    {
        BlackjackGame game = gameWith(10, 8, 8, 9);

        game.stay();

        assertOutcomeAndChips(game, BlackjackGame.HandOutcome.HUMAN_WIN, 6, 4);
    }

    private static void shouldResolveStandardDealerWin()
    {
        BlackjackGame game = gameWith(10, 10, 6, 8);

        game.stay();

        assertOutcomeAndChips(game, BlackjackGame.HandOutcome.DEALER_WIN, 4, 6);
    }

    private static void shouldResolvePushWithoutChangingChips()
    {
        BlackjackGame game = gameWith(10, 10, 8, 8);

        game.stay();

        assertOutcomeAndChips(game, BlackjackGame.HandOutcome.PUSH, 5, 5);
    }

    private static void shouldResolveNaturalBlackjacks()
    {
        BlackjackGame humanBlackjack = gameWith(14, 9, 13, 7);
        assertOutcomeAndChips(humanBlackjack, BlackjackGame.HandOutcome.HUMAN_BLACKJACK, 6, 4);

        BlackjackGame dealerBlackjack = gameWith(9, 14, 7, 13);
        assertOutcomeAndChips(dealerBlackjack, BlackjackGame.HandOutcome.DEALER_BLACKJACK, 4, 6);

        BlackjackGame tiedBlackjacks = gameWith(14, 14, 13, 12);
        assertOutcomeAndChips(tiedBlackjacks, BlackjackGame.HandOutcome.PUSH, 5, 5);
    }

    private static void shouldAutomaticallyResolveTheFifthCard()
    {
        BlackjackGame game = gameWith(2, 10, 3, 9, 4, 5, 6);

        game.hit();
        game.hit();
        game.hit();

        assertEquals(5, game.getSnapshot().getHumanCards().size(), "Player should hold five cards");
        assertOutcomeAndChips(game, BlackjackGame.HandOutcome.HUMAN_WIN, 6, 4);
    }

    private static void shouldEndTheGameWhenAPlayerRunsOutOfChips()
    {
        BlackjackGame game = new BlackjackGame("Casey", new Deck(repeatedDealerWins(5)));

        for (int hand = 0; hand < 5; hand++)
        {
            game.stay();
            if (hand < 4)
                game.startHand();
        }

        GameSnapshot snapshot = game.getSnapshot();
        assertTrue(snapshot.isGameOver(), "Game should end when a player has no chips");
        assertEquals(0, snapshot.getHumanPoints(), "Player should have no chips remaining");
        assertEquals(10, snapshot.getDealerPoints(), "Dealer should hold every transferred chip");
        assertThrowsIllegalState(new Runnable()
        {
            @Override
            public void run()
            {
                game.startHand();
            }
        }, "Game should not start another hand after game over");
    }

    private static void shouldRejectMovesAfterHandCompletion()
    {
        BlackjackGame game = gameWith(10, 10, 6, 8);
        game.stay();

        assertThrowsIllegalState(new Runnable()
        {
            @Override
            public void run()
            {
                game.hit();
            }
        }, "Completed hands should reject hits");
        assertThrowsIllegalState(new Runnable()
        {
            @Override
            public void run()
            {
                game.stay();
            }
        }, "Completed hands should reject stays");
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

    private static void assertOutcomeAndChips(BlackjackGame game, BlackjackGame.HandOutcome expectedOutcome,
            int expectedHumanPoints, int expectedDealerPoints)
    {
        GameSnapshot snapshot = game.getSnapshot();
        assertTrue(snapshot.isHandComplete(), "Hand should be complete");
        assertEquals(expectedOutcome, snapshot.getOutcome(), "Hand outcome should match");
        assertEquals(expectedHumanPoints, snapshot.getHumanPoints(), "Player chips should match");
        assertEquals(expectedDealerPoints, snapshot.getDealerPoints(), "Dealer chips should match");
    }

    private static void assertEquals(Object expected, Object actual, String message)
    {
        if (!expected.equals(actual))
            throw new AssertionError(message + ": expected " + expected + ", got " + actual);
    }

    private static void assertFalse(boolean condition, String message)
    {
        if (condition)
            throw new AssertionError(message);
    }

    private static void assertTrue(boolean condition, String message)
    {
        if (!condition)
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
