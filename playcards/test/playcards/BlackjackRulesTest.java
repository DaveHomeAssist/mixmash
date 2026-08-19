package playcards;

public final class BlackjackRulesTest
{
    private BlackjackRulesTest()
    {
    }

    public static void main(String[] args)
    {
        shouldScoreThreeAcesAndNineAsTwelve();
        shouldTreatTwoNaturalBlackjacksAsPush();
        shouldPreferANaturalBlackjackOverThreeCardTwentyOne();
        shouldPreferADealerNaturalBlackjackOverThreeCardTwentyOne();
        shouldRejectEmptyDecisionInput();
        shouldUseOneBasedDeckIndexes();
        shouldRejectInvalidDeckIndexes();
        shouldRejectASixthCardExplicitly();
        shouldExposeImmutableCardIdentity();
        shouldReportScriptedDeckExhaustion();
        shouldReshuffleAStandardDeckAfterItIsDrawn();
        System.out.println("BlackjackRulesTest: all tests passed");
    }

    private static void shouldScoreThreeAcesAndNineAsTwelve()
    {
        Player player = playerWith(
                card(14, Card.Suit.HEARTS),
                card(14, Card.Suit.SPADES),
                card(14, Card.Suit.CLUBS),
                card(9, Card.Suit.DIAMONDS));

        assertEquals(12, player.handValue(), "Three aces and a nine should score as twelve");
    }

    private static void shouldTreatTwoNaturalBlackjacksAsPush()
    {
        Player human = playerWith(card(14, Card.Suit.HEARTS), card(13, Card.Suit.SPADES));
        Player dealer = playerWith(card(14, Card.Suit.CLUBS), card(12, Card.Suit.DIAMONDS));

        assertEquals(BlackjackGame.HandOutcome.PUSH, BlackjackGame.determineHandOutcome(human, dealer),
                "Two natural blackjacks should push");
    }

    private static void shouldPreferANaturalBlackjackOverThreeCardTwentyOne()
    {
        Player human = playerWith(card(14, Card.Suit.HEARTS), card(13, Card.Suit.SPADES));
        Player dealer = playerWith(
                card(10, Card.Suit.CLUBS),
                card(5, Card.Suit.DIAMONDS),
                card(6, Card.Suit.HEARTS));

        assertEquals(BlackjackGame.HandOutcome.HUMAN_BLACKJACK, BlackjackGame.determineHandOutcome(human, dealer),
                "A natural blackjack should beat a three-card twenty-one");
    }

    private static void shouldPreferADealerNaturalBlackjackOverThreeCardTwentyOne()
    {
        Player human = playerWith(
                card(10, Card.Suit.CLUBS),
                card(5, Card.Suit.DIAMONDS),
                card(6, Card.Suit.HEARTS));
        Player dealer = playerWith(card(14, Card.Suit.HEARTS), card(13, Card.Suit.SPADES));

        assertEquals(BlackjackGame.HandOutcome.DEALER_BLACKJACK, BlackjackGame.determineHandOutcome(human, dealer),
                "A dealer natural blackjack should beat a three-card twenty-one");
    }

    private static void shouldRejectEmptyDecisionInput()
    {
        assertEquals('\0', Blackjack.parseDecision(""), "Empty input should not be a decision");
        assertEquals('\0', Blackjack.parseDecision("   "), "Whitespace should not be a decision");
        assertEquals('H', Blackjack.parseDecision("h"), "Hit should be case insensitive");
        assertEquals('S', Blackjack.parseDecision(" S "), "Stay should allow surrounding whitespace");
    }

    private static void shouldUseOneBasedDeckIndexes()
    {
        Deck deck = new Deck();

        assertEquals(2, deck.pickACard(1).getValue(), "First card should be selectable with index one");
        assertEquals(14, deck.pickACard(52).getValue(), "Last card should be selectable with index fifty-two");
    }

    private static void shouldRejectInvalidDeckIndexes()
    {
        Deck deck = new Deck();

        assertThrowsIllegalArgument(new Runnable()
        {
            @Override
            public void run()
            {
                deck.pickACard(0);
            }
        }, "Zero should not be a valid card index");

        assertThrowsIllegalArgument(new Runnable()
        {
            @Override
            public void run()
            {
                deck.pickACard(53);
            }
        }, "Fifty-three should not be a valid card index");
    }

    private static void shouldRejectASixthCardExplicitly()
    {
        final Hand hand = new Hand();
        for (int value = 2; value <= 6; value++)
            hand.addCard(card(value, Card.Suit.CLUBS));

        assertTrue(hand.isAtLimit(), "Five cards should reach the configured hand limit");
        assertThrowsIllegalState(new Runnable()
        {
            @Override
            public void run()
            {
                hand.addCard(card(7, Card.Suit.CLUBS));
            }
        }, "A sixth card should be rejected rather than ignored");
    }

    private static void shouldExposeImmutableCardIdentity()
    {
        Card queenOfHearts = new Card(Card.Rank.QUEEN, Card.Suit.HEARTS);

        assertEquals(new Card(12, Card.Suit.HEARTS), queenOfHearts,
                "Cards with the same rank and suit should compare equally");
        assertEquals("Q♥", queenOfHearts.toString(), "Card output should not include terminal formatting");
        assertEquals(Card.Color.RED, queenOfHearts.getColor(), "Hearts should be red");
    }

    private static void shouldReportScriptedDeckExhaustion()
    {
        final Deck deck = new Deck(card(2, Card.Suit.CLUBS));
        assertEquals(1, deck.getRemainingCardCount(), "A scripted deck should expose its remaining count");
        assertEquals(card(2, Card.Suit.CLUBS), deck.draw(), "The scripted card should draw first");

        assertThrowsIllegalState(new Runnable()
        {
            @Override
            public void run()
            {
                deck.draw();
            }
        }, "An exhausted scripted deck should fail deterministically");
    }

    private static void shouldReshuffleAStandardDeckAfterItIsDrawn()
    {
        Deck deck = new Deck();
        for (int index = 0; index < Deck.SIZE; index++)
            deck.draw();

        assertEquals(0, deck.getRemainingCardCount(), "All standard cards should be drawable once");
        deck.draw();
        assertEquals(Deck.SIZE - 1, deck.getRemainingCardCount(),
                "The next draw should reshuffle and consume one card");
    }

    private static Player playerWith(Card... cards)
    {
        Player player = new Player();
        for (Card card : cards)
            player.acceptACard(card);
        return player;
    }

    private static Card card(int value, Card.Suit suit)
    {
        return new Card(value, suit);
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

    private static void assertThrowsIllegalArgument(Runnable action, String message)
    {
        try
        {
            action.run();
        }
        catch (IllegalArgumentException expected)
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
