package playcards;

import java.awt.Component;
import java.awt.Container;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.SwingUtilities;

public final class SwingPresentationTest
{
    private SwingPresentationTest()
    {
    }

    public static void main(String[] args) throws Exception
    {
        SwingUtilities.invokeAndWait(new Runnable()
        {
            @Override
            public void run()
            {
                shouldRenderTheTableFromASnapshot();
                shouldRenderClassicCardFaces();
                shouldEnableOnlyLegalSnapshotActions();
                shouldElideOnlyTheDisplayedPlayerName();
                shouldStartNewGameWithUpdatedPlayerName();
            }
        });
        shouldCompleteShuffleAndDealAnimation();
        System.out.println("SwingPresentationTest: all tests passed");
    }

    private static void shouldRenderTheTableFromASnapshot()
    {
        GameSnapshot opening = gameWith(2, 3, 4, 5).getSnapshot();
        GameTablePanel table = new GameTablePanel();
        table.render(opening);

        assertEquals(3, table.getComponentCount(),
                "Table should contain dealer and player panels plus the chip rail");
        assertTrue(table.isOpaque(), "Table rail should be a visible surface");
        assertEquals(TableTheme.TABLE_GREEN_DARK, table.getBackground(),
                "Table rail should contrast with the hand panels");
        HandPanel dealer = table.getDealerHand();
        ScorePanel dealerScore = dealer.getScorePanel();
        JLabel handValue = dealerScore.getHandValueLabel();
        ChipCountView chipStack = dealerScore.getChipCountView();
        assertEquals("—", handValue.getText(),
                "Hidden dealer value should use the compact table marker");
        assertEquals(5, chipStack.getPoints(), "Chip stack should retain the dealer total");
        assertTrue(chipStack.isDealerStack(), "Dealer chips should use their own stack treatment");
        assertEquals(5, table.getChipRail().getHumanPoints(),
                "Chip rail should render the player's share");
        assertEquals(5, table.getChipRail().getDealerPoints(),
                "Chip rail should render the dealer's share");
        Container dealerCards = dealer.getCardArea();
        assertEquals("Face-down card", dealerCards.getComponent(0).getAccessibleContext().getAccessibleName(),
                "Dealer hole card should remain hidden during the player turn");
    }

    private static void shouldEnableOnlyLegalSnapshotActions()
    {
        GameControls controls = new GameControls(noop(), noop(), noop(), noop());
        BlackjackGame game = gameWith(10, 10, 8, 8);

        controls.render(game.getSnapshot(), "Player turn");
        assertTrue(requireButton(controls, "Hit").isEnabled(), "Hit should be available during player turn");
        assertTrue(requireButton(controls, "Stay").isEnabled(), "Stay should be available during player turn");
        assertFalse(requireButton(controls, "Next Hand").isEnabled(), "Next Hand should wait for completion");
        assertEquals(TableTheme.GOLD, requireButton(controls, "Hit").getBackground(),
                "Hit should be the single primary action during the player turn");
        assertEquals(TableTheme.PANEL_GREEN, requireButton(controls, "Stay").getBackground(),
                "Stay should remain a legal secondary action");

        controls.render(game.stay(), "Hand complete");
        assertFalse(requireButton(controls, "Hit").isEnabled(), "Hit should disable after completion");
        assertFalse(requireButton(controls, "Stay").isEnabled(), "Stay should disable after completion");
        assertTrue(requireButton(controls, "Next Hand").isEnabled(), "Next Hand should enable after completion");
    }

    private static void shouldRenderClassicCardFaces()
    {
        CardView card = new CardView(new Card(Card.Rank.ACE, Card.Suit.HEARTS), false);

        assertEquals(3, card.getComponentCount(), "A visible card should have two corners and a central suit");
        assertEquals("A♥", ((JLabel) card.getComponent(0)).getText(), "Top corner should show rank and suit");
        assertEquals("♥", ((JLabel) card.getComponent(1)).getText(), "Center should show the suit mark");
        assertEquals("A♥", ((JLabel) card.getComponent(2)).getText(), "Bottom corner should show rank and suit");
    }

    private static void shouldElideOnlyTheDisplayedPlayerName()
    {
        String longName = "Alexandria-Cassandra Montgomery the Third With An Extremely Long Name";
        ScorePanel score = new ScorePanel();
        score.render(longName, 5, "Hand value: 20");
        score.setSize(320, score.getPreferredSize().height);
        score.doLayout();

        JLabel name = score.getNameLabel();
        JLabel handValue = score.getHandValueLabel();
        ChipCountView chips = score.getChipCountView();
        assertTrue(name.getText().endsWith("…"), "A constrained long name should be visually elided");
        assertEquals(longName, name.getToolTipText(), "The full player name should remain available as a tooltip");
        assertEquals(longName, name.getAccessibleContext().getAccessibleName(),
                "The full player name should remain available in metadata");
        assertWithin(score, name, "Elided player name should remain inside the header");
        assertWithin(score, handValue, "Hand value should remain inside the header");
        assertWithin(score, chips, "Chip badge should remain inside the header");

        score.setSize(1200, score.getPreferredSize().height);
        score.doLayout();
        assertEquals(longName, name.getText(),
                "The complete displayed name should return when sufficient width is available");

        score.render("Casey", 5, "Hand value: 20");
        score.setSize(590, score.getPreferredSize().height);
        score.doLayout();
        assertEquals("Casey", name.getText(), "A short player name should remain unchanged");
    }

    private static void shouldStartNewGameWithUpdatedPlayerName()
    {
        BlackjackController controller = new BlackjackController("Casey");
        GameSnapshot restarted = controller.startNewGame("Ada");

        assertEquals("Ada", restarted.getHumanName(),
                "New Game should use the name returned by the player-name prompt");
        assertEquals(5, restarted.getHumanPoints(),
                "New Game should reset the player's chip stack");
        assertEquals(5, restarted.getDealerPoints(),
                "New Game should reset the dealer's chip stack");
    }

    private static void shouldCompleteShuffleAndDealAnimation() throws Exception
    {
        final CountDownLatch completed = new CountDownLatch(1);
        final GameTablePanel[] tableHolder = new GameTablePanel[1];
        final GameSnapshot opening = gameWith(2, 3, 4, 5).getSnapshot();

        SwingUtilities.invokeAndWait(new Runnable()
        {
            @Override
            public void run()
            {
                tableHolder[0] = new GameTablePanel();
                tableHolder[0].animateOpeningHand(opening, true, new Runnable()
                {
                    @Override
                    public void run()
                    {
                        completed.countDown();
                    }
                });
                assertTrue(tableHolder[0].isAnimating(), "Shuffle animation should lock the table while it runs");
            }
        });

        if (!completed.await(3, TimeUnit.SECONDS))
            throw new AssertionError("Shuffle and deal animation did not finish");

        SwingUtilities.invokeAndWait(new Runnable()
        {
            @Override
            public void run()
            {
                assertFalse(tableHolder[0].isAnimating(), "Table should unlock after the opening deal");
                HandPanel dealer = tableHolder[0].getDealerHand();
                Container dealerCards = dealer.getCardArea();
                assertEquals(2, dealerCards.getComponentCount(), "Opening deal should leave two dealer cards");
                assertEquals("Face-down card", dealerCards.getComponent(0).getAccessibleContext().getAccessibleName(),
                        "Opening deal should restore the hidden dealer hole card");
            }
        });
    }

    private static Runnable noop()
    {
        return new Runnable()
        {
            @Override
            public void run()
            {
            }
        };
    }

    private static BlackjackGame gameWith(int... values)
    {
        Card[] cards = new Card[values.length];
        for (int index = 0; index < values.length; index++)
            cards[index] = new Card(values[index], Card.Suit.DIAMONDS);
        return new BlackjackGame("Casey", new Deck(cards));
    }

    private static JButton findButton(Container parent, String text)
    {
        for (Component child : parent.getComponents())
        {
            if (child instanceof JButton && text.equals(((JButton) child).getText()))
                return (JButton) child;
            if (child instanceof Container)
            {
                JButton nested = findButton((Container) child, text);
                if (nested != null)
                    return nested;
            }
        }
        return null;
    }

    private static JButton requireButton(Container parent, String text)
    {
        JButton button = findButton(parent, text);
        if (button == null)
            throw new AssertionError("Button not found: " + text);
        return button;
    }

    private static void assertWithin(Container parent, Component child, String message)
    {
        assertTrue(child.getWidth() >= 0 && child.getHeight() >= 0
                        && child.getX() >= 0 && child.getY() >= 0
                        && child.getX() + child.getWidth() <= parent.getWidth()
                        && child.getY() + child.getHeight() <= parent.getHeight(),
                message + " (parent " + parent.getWidth() + "x" + parent.getHeight()
                        + ", child " + child.getBounds() + ")");
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
}
