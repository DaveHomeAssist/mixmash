package playcards;

import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.FocusTraversalPolicy;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import javax.swing.Action;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JRootPane;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;

/** Dependency-free headless regression checks for responsive and accessible Swing presentation. */
public final class SwingAccessibilityLayoutTest
{
    private SwingAccessibilityLayoutTest()
    {
    }

    public static void main(String[] args) throws Exception
    {
        SwingUtilities.invokeAndWait(new Runnable()
        {
            @Override
            public void run()
            {
                shouldLayOutWithinDecoratedWindowContent();
                shouldKeepLongPlayerNamesWithinHeader();
                shouldWrapCardsWithoutOverflow();
                shouldDescribeFaceDownCardsByContext();
                shouldRenderEveryOutcomeVariant();
                shouldRenderTerminalGameAction();
                shouldExposeTurnWinnerAndCardVisibilityStates();
                shouldKeepControlsLegalResponsiveAndFocusable();
                shouldInstallKeyboardActions();
                shouldThemeAndOrderThePlayerNamePrompt();
                shouldExposeStatusAnnouncementsAndReadableContrast();
                shouldHonorReducedMotion();
            }
        });
        System.out.println("SwingAccessibilityLayoutTest: all tests passed");
    }

    private static void shouldLayOutWithinDecoratedWindowContent()
    {
        assertSupportedLayout(700, 480, 2);
        assertSupportedLayout(980, 640, 1);
    }

    private static void assertSupportedLayout(int width, int height, int expectedControlRows)
    {
        GameSnapshot snapshot = snapshot(GamePhase.PLAYER_TURN, null,
                cards(2, 3, 4, 5, 6), cards(8, 9), 20, 17, 5, 5);
        GameTablePanel table = new GameTablePanel();
        GameControls controls = new GameControls(noop(), noop(), noop(), noop());
        table.render(snapshot);
        controls.render(snapshot, GamePresentation.statusMessage(snapshot));
        JPanel surface = PlayCardsFrame.createInterface(table, controls);
        surface.setSize(width, height);
        layoutTree(surface);
        layoutTree(surface);

        assertEquals(expectedControlRows, controls.getControlRows(),
                width + " pixel surface should use the expected control rows");
        assertWithin(surface, table, "Table should remain within the supported surface");
        assertWithin(surface, controls, "Controls should remain within the supported surface");
        assertWithin(table, table.getChipRail(), "Chip rail should remain inside the table");

        HandPanel[] hands = new HandPanel[] {table.getDealerHand(), table.getPlayerHand()};
        for (HandPanel hand : hands)
        {
            Container cardArea = hand.getCardArea();
            for (Component card : cardArea.getComponents())
            {
                assertTrue(card.getWidth() >= TableTheme.CARD_MIN_WIDTH,
                        "Cards should not shrink below the readable minimum");
                assertTrue(card.getWidth() <= TableTheme.CARD_WIDTH,
                        "Cards should not grow beyond the visual token");
                assertWithin(cardArea, card, "Cards should not clip or overflow");
            }
        }
    }

    private static void shouldKeepLongPlayerNamesWithinHeader()
    {
        assertLongNameLayout(700, 480);
        assertLongNameLayout(980, 640);
    }

    private static void assertLongNameLayout(int width, int height)
    {
        String longName = "Alexandria-Cassandra Montgomery the Third With An Extremely Long Name";
        GameSnapshot snapshot = snapshot(longName, GamePhase.PLAYER_TURN, null,
                cards(10, 10), cards(9, 7), 20, 16, 5, 5);
        GameTablePanel table = new GameTablePanel();
        GameControls controls = new GameControls(noop(), noop(), noop(), noop());
        table.render(snapshot);
        controls.render(snapshot, GamePresentation.statusMessage(snapshot));
        JPanel surface = PlayCardsFrame.createInterface(table, controls);
        surface.setSize(width, height);
        layoutTree(surface);
        layoutTree(surface);

        HandPanel player = table.getPlayerHand();
        ScorePanel score = player.getScorePanel();
        JLabel name = score.getNameLabel();
        JLabel handValue = score.getHandValueLabel();
        ChipCountView chips = score.getChipCountView();

        assertEquals(longName, snapshot.getHumanName(), "Snapshot should retain the complete player name");
        assertEquals(longName, name.getAccessibleContext().getAccessibleName(),
                "Header metadata should retain the complete player name");
        assertEquals(longName, name.getToolTipText(), "Header tooltip should retain the complete player name");
        assertTrue(name.getText().endsWith("…"), "Long player name should be visually elided at " + width);
        assertEquals("20", handValue.getText(), "Hand value should remain visible at " + width);
        assertEquals(5, chips.getPoints(), "Chip stack should retain its value at " + width);
        assertTrue(handValue.getWidth() >= handValue.getPreferredSize().width,
                "Hand value should retain its required width at " + width);
        assertTrue(chips.getWidth() >= chips.getPreferredSize().width,
                "Chip badge should retain its required width at " + width);
        assertWithin(score, name, "Player name should remain inside the header at " + width);
        assertWithin(score, handValue, "Hand value should remain inside the header at " + width);
        assertWithin(score, chips, "Chip badge should remain inside the header at " + width);
    }

    private static void shouldWrapCardsWithoutOverflow()
    {
        HandPanel hand = new HandPanel();
        hand.render("Casey", 5, cards(2, 3, 4, 5, 6), 20, false, true);
        hand.setSize(260, 240);
        layoutTree(hand);
        layoutTree(hand);

        Container cardArea = hand.getCardArea();
        int firstRowY = cardArea.getComponent(0).getY();
        boolean wrapped = false;
        for (Component card : cardArea.getComponents())
        {
            assertWithin(cardArea, card, "Wrapped cards should remain inside their card area");
            if (card.getY() != firstRowY)
                wrapped = true;
        }
        assertTrue(wrapped, "Five cards should wrap predictably when the hand becomes narrow");
    }

    private static void shouldDescribeFaceDownCardsByContext()
    {
        GameTablePanel table = new GameTablePanel();
        GameSnapshot playerTurn = snapshot(GamePhase.PLAYER_TURN, null,
                cards(10, 8), cards(9, 7), 18, 16, 5, 5);
        table.render(playerTurn);
        HandPanel dealer = table.getDealerHand();
        Container dealerCards = dealer.getCardArea();
        assertEquals("Dealer hole card, face down",
                dealerCards.getComponent(0).getAccessibleContext().getAccessibleDescription(),
                "Dealer hole card should identify its owner");

        HandPanel shuffle = new HandPanel();
        shuffle.renderCardBacks("Casey", 5, 2, "Hand value: shuffling",
                CardView.FaceDownPurpose.SHUFFLE);
        Container shuffleCards = (Container) shuffle.getComponent(1);
        assertEquals("Shuffling card, face down",
                shuffleCards.getComponent(0).getAccessibleContext().getAccessibleDescription(),
                "Shuffle cards should describe their temporary purpose");

        HandPanel hit = new HandPanel();
        hit.renderWithTrailingCardBack("Casey", 5, cards(10, 8), 18, false, true);
        Container hitCards = (Container) hit.getComponent(1);
        Component placeholder = hitCards.getComponent(hitCards.getComponentCount() - 1);
        assertEquals("New player card, face down",
                placeholder.getAccessibleContext().getAccessibleDescription(),
                "Player hit placeholder should identify the pending player card");
        assertEquals("Face-down card", placeholder.getAccessibleContext().getAccessibleName(),
                "Every face-down context should retain one stable visible name");
    }

    private static void shouldRenderEveryOutcomeVariant()
    {
        Object[][] variants = new Object[][]
        {
            {BlackjackGame.HandOutcome.HUMAN_BLACKJACK, "BLACKJACK", "★", TableTheme.WIN_BACKGROUND},
            {BlackjackGame.HandOutcome.DEALER_BLACKJACK, "DEALER BLACKJACK", "♠", TableTheme.LOSS_BACKGROUND},
            {BlackjackGame.HandOutcome.HUMAN_BUST, "BUST", "!", TableTheme.LOSS_BACKGROUND},
            {BlackjackGame.HandOutcome.DEALER_BUST, "DEALER BUST", "↗", TableTheme.WIN_BACKGROUND},
            {BlackjackGame.HandOutcome.HUMAN_WIN, "HAND WON", "✓", TableTheme.WIN_BACKGROUND},
            {BlackjackGame.HandOutcome.DEALER_WIN, "DEALER WINS", "✕", TableTheme.LOSS_BACKGROUND},
            {BlackjackGame.HandOutcome.PUSH, "PUSH", "↔", TableTheme.PUSH_BACKGROUND}
        };

        for (Object[] variant : variants)
        {
            BlackjackGame.HandOutcome handOutcome = (BlackjackGame.HandOutcome) variant[0];
            GameSnapshot completed = snapshot(GamePhase.HAND_COMPLETE, handOutcome,
                    cards(10, 10), cards(10, 7), 20, 17, 6, 4);
            GameControls controls = new GameControls(noop(), noop(), noop(), noop());
            controls.render(completed, GamePresentation.statusMessage(completed));
            OutcomePanel panel = findComponent(controls, OutcomePanel.class);
            JLabel status = (JLabel) findAccessible(controls, "Game status");

            assertTrue(panel != null && panel.isVisible(), "Completed hand should show an outcome panel");
            assertTrue(!status.isVisible(),
                    "Completed hand should hide the underlying status label");
            assertTrue(findLabel(panel, (String) variant[1]) != null,
                    "Outcome should show its specific title");
            assertTrue(findLabel(panel, (String) variant[2]) != null,
                    "Outcome should show its specific icon");
            assertEquals(variant[3], panel.getBackground(), "Outcome should show its specific color");
            assertTrue(panel.getAccessibleContext().getAccessibleName().startsWith("Hand outcome:"),
                    "Outcome should expose an announcement");
            JButton nextHand = requireButton(controls, "Next Hand");
            assertTrue(nextHand.isEnabled(), "Completed hand should enable Next Hand");
            assertEquals(TableTheme.GOLD, nextHand.getBackground(),
                    "Next Hand should become the visually primary action");
        }
    }

    private static void shouldExposeTurnWinnerAndCardVisibilityStates()
    {
        GameTablePanel table = new GameTablePanel();
        GameSnapshot playerTurn = snapshot(GamePhase.PLAYER_TURN, null,
                cards(10, 8), cards(9, 7), 18, 16, 5, 5);
        table.render(playerTurn);
        HandPanel dealer = table.getDealerHand();
        HandPanel player = table.getPlayerHand();
        Container dealerCards = dealer.getCardArea();
        assertEquals(HandPanel.Emphasis.DEFAULT, dealer.getEmphasis(),
                "Dealer should not be active during the player turn");
        assertEquals(HandPanel.Emphasis.ACTIVE, player.getEmphasis(),
                "Player should be highlighted during the player turn");
        assertEquals("YOUR TURN", player.getScorePanel().getStateBadge().getText(),
                "Active player header should name the turn state");
        assertEquals("Face-down card",
                dealerCards.getComponent(0).getAccessibleContext().getAccessibleName(),
                "Dealer hole card should stay hidden during the player turn");

        GameSnapshot humanWin = snapshot(GamePhase.HAND_COMPLETE, BlackjackGame.HandOutcome.HUMAN_WIN,
                cards(10, 10), cards(10, 7), 20, 17, 6, 4);
        table.render(humanWin);
        dealerCards = dealer.getCardArea();
        assertEquals(HandPanel.Emphasis.LOSER, dealer.getEmphasis(),
                "Dealer should lose emphasis after a player win");
        assertEquals(HandPanel.Emphasis.WINNER, player.getEmphasis(),
                "Winning player should receive winner emphasis");
        assertEquals("WINNER", player.getScorePanel().getStateBadge().getText(),
                "Winning player header should name the result state");
        assertEquals(6, table.getChipRail().getHumanPoints(),
                "Completed hand should update the player share on the chip rail");
        assertEquals(4, table.getChipRail().getDealerPoints(),
                "Completed hand should update the dealer share on the chip rail");
        assertTrue(!"Face-down card".equals(
                dealerCards.getComponent(0).getAccessibleContext().getAccessibleName()),
                "Dealer cards should be revealed after completion");

        table.render(snapshot(GamePhase.HAND_COMPLETE, BlackjackGame.HandOutcome.DEALER_WIN,
                cards(10, 7), cards(10, 9), 17, 19, 4, 6));
        assertEquals(HandPanel.Emphasis.WINNER, dealer.getEmphasis(),
                "Winning dealer should receive winner emphasis");
        assertEquals(HandPanel.Emphasis.LOSER, player.getEmphasis(),
                "Player should lose emphasis after a dealer win");

        table.render(snapshot(GamePhase.HAND_COMPLETE, BlackjackGame.HandOutcome.PUSH,
                cards(10, 8), cards(10, 8), 18, 18, 5, 5));
        assertEquals(HandPanel.Emphasis.PUSH, dealer.getEmphasis(),
                "Dealer should show tied emphasis for a push");
        assertEquals(HandPanel.Emphasis.PUSH, player.getEmphasis(),
                "Player should show tied emphasis for a push");
    }

    private static void shouldRenderTerminalGameAction()
    {
        GameSnapshot gameOver = snapshot(GamePhase.GAME_OVER, BlackjackGame.HandOutcome.HUMAN_WIN,
                cards(10, 10), cards(10, 7), 20, 17, 10, 0);
        GameControls controls = new GameControls(noop(), noop(), noop(), noop());
        controls.render(gameOver, GamePresentation.statusMessage(gameOver));
        OutcomePanel panel = findComponent(controls, OutcomePanel.class);

        assertTrue(findLabel(panel, "GAME OVER") != null,
                "Terminal state should replace the hand title with Game Over");
        assertTrue(!requireButton(controls, "Next Hand").isEnabled(),
                "Next Hand should remain illegal after game over");
        assertEquals(TableTheme.GOLD, requireButton(controls, "New Game").getBackground(),
                "New Game should become the terminal primary action");
    }

    private static void shouldKeepControlsLegalResponsiveAndFocusable()
    {
        GameControls controls = new GameControls(noop(), noop(), noop(), noop());
        GameSnapshot playerTurn = snapshot(GamePhase.PLAYER_TURN, null,
                cards(10, 8), cards(9, 7), 18, 16, 5, 5);
        controls.render(playerTurn, GamePresentation.statusMessage(playerTurn));
        controls.setSize(640, 120);
        layoutTree(controls);
        assertEquals(2, controls.getControlRows(), "Narrow controls should use a 2 by 2 action grid");

        Container actionPanel = (Container) findAccessible(controls, "Game actions");
        assertEquals("Hit", ((JButton) actionPanel.getComponent(0)).getText(),
                "Focus order should start with Hit");
        assertEquals("Stay", ((JButton) actionPanel.getComponent(1)).getText(),
                "Focus order should continue to Stay");
        assertEquals("Next Hand", ((JButton) actionPanel.getComponent(2)).getText(),
                "Focus order should continue to Next Hand");
        assertEquals("New Game", ((JButton) actionPanel.getComponent(3)).getText(),
                "Focus order should end with New Game");

        for (Component component : actionPanel.getComponents())
        {
            JButton button = (JButton) component;
            assertTrue(button.isFocusPainted(), "Every game action should retain a visible focus indicator");
            assertTrue(button.getAccessibleContext().getAccessibleName() != null,
                    "Every game action should have an accessible name");
            assertTrue(button.getPreferredSize().height >= 44,
                    "Every game action should retain a 44 pixel target height");
        }
        assertTrue(requireButton(controls, "Hit").isEnabled(), "Hit should be legal during player turn");
        assertTrue(requireButton(controls, "Stay").isEnabled(), "Stay should be legal during player turn");
        assertTrue(!requireButton(controls, "Next Hand").isEnabled(),
                "Next Hand should remain unavailable during player turn");

        controls.setAnimationLocked(true);
        controls.render(playerTurn, "Dealing");
        assertTrue(!requireButton(controls, "Hit").isEnabled(),
                "Hit should lock during an animation");
        assertTrue(!requireButton(controls, "Stay").isEnabled(),
                "Stay should lock during an animation");
        assertTrue(!requireButton(controls, "New Game").isEnabled(),
                "New Game should lock during an animation");
    }

    private static void shouldInstallKeyboardActions()
    {
        final AtomicInteger hits = new AtomicInteger();
        final AtomicInteger stays = new AtomicInteger();
        final AtomicInteger nextHands = new AtomicInteger();
        JRootPane root = new JRootPane();
        PlayCardsFrame.installKeyboardActions(root, increment(hits), increment(stays), increment(nextHands));

        triggerKey(root, KeyEvent.VK_H);
        triggerKey(root, KeyEvent.VK_S);
        triggerKey(root, KeyEvent.VK_N);
        assertEquals(1, hits.get(), "H should invoke Hit");
        assertEquals(1, stays.get(), "S should invoke Stay");
        assertEquals(1, nextHands.get(), "N should invoke Next Hand");
    }

    private static void shouldThemeAndOrderThePlayerNamePrompt()
    {
        PlayerNamePanel prompt = new PlayerNamePanel();
        assertEquals(TableTheme.TABLE_GREEN, prompt.getBackground(),
                "Name prompt should share the table theme");
        assertEquals("Player", PlayerNamePanel.normalizeName("  "),
                "Blank player names should use the safe default");
        assertEquals("Casey", PlayerNamePanel.normalizeName("  Casey  "),
                "Player names should be trimmed");
        assertEquals("Player name", prompt.getNameField().getAccessibleContext().getAccessibleName(),
                "Player-name field should be labelled");

        FocusTraversalPolicy policy = prompt.getFocusTraversalPolicy();
        assertEquals(prompt.getNameField(), policy.getDefaultComponent(prompt),
                "Name input should receive initial focus");
        assertEquals(prompt.getStartButton(),
                policy.getComponentAfter(prompt, prompt.getNameField()),
                "Tab should move from the name to Start Game");
        assertEquals(prompt.getCancelButton(),
                policy.getComponentAfter(prompt, prompt.getStartButton()),
                "Tab should move from Start Game to the default-name action");
    }

    private static void shouldExposeStatusAnnouncementsAndReadableContrast()
    {
        GameControls controls = new GameControls(noop(), noop(), noop(), noop());
        JLabel status = (JLabel) findAccessible(controls, "Game status");
        final AtomicInteger announcements = new AtomicInteger();
        final AtomicInteger outcomeAnnouncements = new AtomicInteger();
        OutcomePanel outcome = findComponent(controls, OutcomePanel.class);
        status.getAccessibleContext().addPropertyChangeListener(new PropertyChangeListener()
        {
            @Override
            public void propertyChange(PropertyChangeEvent event)
            {
                if (javax.accessibility.AccessibleContext.ACCESSIBLE_VISIBLE_DATA_PROPERTY
                        .equals(event.getPropertyName()))
                    announcements.incrementAndGet();
            }
        });
        outcome.getAccessibleContext().addPropertyChangeListener(new PropertyChangeListener()
        {
            @Override
            public void propertyChange(PropertyChangeEvent event)
            {
                if (javax.accessibility.AccessibleContext.ACCESSIBLE_VISIBLE_DATA_PROPERTY
                        .equals(event.getPropertyName()))
                    outcomeAnnouncements.incrementAndGet();
            }
        });

        GameSnapshot turn = snapshot(GamePhase.PLAYER_TURN, null,
                cards(10, 8), cards(9, 7), 18, 16, 5, 5);
        controls.render(turn, "Your turn");
        controls.render(turn, "Choose Hit or Stay");
        assertTrue(announcements.get() >= 2, "Status changes should emit accessible announcements");
        assertEquals("Choose Hit or Stay", status.getAccessibleContext().getAccessibleDescription(),
                "Status description should contain the announced copy");

        GameSnapshot completed = snapshot(GamePhase.HAND_COMPLETE,
                BlackjackGame.HandOutcome.HUMAN_WIN, cards(10, 10), cards(10, 7),
                20, 17, 6, 4);
        controls.render(completed, GamePresentation.statusMessage(completed));
        assertEquals(1, outcomeAnnouncements.get(),
                "Completed-hand outcome should emit its own accessible announcement");

        assertTrue(contrastRatio(TableTheme.CREAM, TableTheme.TABLE_GREEN) >= 4.5,
                "Cream table text should meet WCAG AA contrast");
        assertTrue(contrastRatio(TableTheme.INK, TableTheme.GOLD) >= 4.5,
                "Gold primary actions should meet WCAG AA contrast");
        assertTrue(contrastRatio(TableTheme.RED, TableTheme.LOSS_BACKGROUND) >= 4.5,
                "Loss outcome text should meet WCAG AA contrast");
        assertTrue(contrastRatio(TableTheme.PUSH_INK, TableTheme.PUSH_BACKGROUND) >= 4.5,
                "Push outcome text should meet WCAG AA contrast");
    }

    private static void shouldHonorReducedMotion()
    {
        String original = System.getProperty("playcards.reduceMotion");
        System.setProperty("playcards.reduceMotion", "true");
        try
        {
            final AtomicInteger completed = new AtomicInteger();
            GameTablePanel table = new GameTablePanel();
            GameSnapshot opening = snapshot(GamePhase.PLAYER_TURN, null,
                    cards(10, 8), cards(9, 7), 18, 16, 5, 5);
            table.animateOpeningHand(opening, true, increment(completed));
            assertEquals(1, completed.get(), "Reduced motion should complete the opening transition immediately");
            assertTrue(!table.isAnimating(), "Reduced motion should not leave a timer running");
        }
        finally
        {
            if (original == null)
                System.clearProperty("playcards.reduceMotion");
            else
                System.setProperty("playcards.reduceMotion", original);
        }
    }

    private static GameSnapshot snapshot(GamePhase phase, BlackjackGame.HandOutcome outcome,
            List<Card> humanCards, List<Card> dealerCards, int humanValue, int dealerValue,
            int humanPoints, int dealerPoints)
    {
        return snapshot("Casey", phase, outcome, humanCards, dealerCards, humanValue,
                dealerValue, humanPoints, dealerPoints);
    }

    private static GameSnapshot snapshot(String humanName, GamePhase phase,
            BlackjackGame.HandOutcome outcome, List<Card> humanCards, List<Card> dealerCards,
            int humanValue, int dealerValue, int humanPoints, int dealerPoints)
    {
        return new GameSnapshot(humanName, humanCards, dealerCards, humanValue, dealerValue,
                humanPoints, dealerPoints, phase, outcome);
    }

    private static List<Card> cards(int... values)
    {
        List<Card> cards = new ArrayList<Card>();
        for (int value : values)
            cards.add(new Card(value, Card.Suit.DIAMONDS));
        return cards;
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

    private static Runnable increment(final AtomicInteger value)
    {
        return new Runnable()
        {
            @Override
            public void run()
            {
                value.incrementAndGet();
            }
        };
    }

    private static void triggerKey(JRootPane root, int keyCode)
    {
        Object actionKey = root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW)
                .get(KeyStroke.getKeyStroke(keyCode, 0));
        Action action = root.getActionMap().get(actionKey);
        assertTrue(action != null, "Keyboard action should be installed for " + KeyEvent.getKeyText(keyCode));
        action.actionPerformed(new ActionEvent(root, ActionEvent.ACTION_PERFORMED, String.valueOf(actionKey)));
    }

    private static void layoutTree(Container container)
    {
        container.doLayout();
        for (Component child : container.getComponents())
        {
            if (child instanceof Container)
                layoutTree((Container) child);
        }
    }

    private static void assertWithin(Container parent, Component child, String message)
    {
        assertTrue(child.getX() >= 0 && child.getY() >= 0
                        && child.getX() + child.getWidth() <= parent.getWidth()
                        && child.getY() + child.getHeight() <= parent.getHeight(),
                message + " (parent " + parent.getWidth() + "x" + parent.getHeight()
                        + ", child " + child.getBounds() + ")");
    }

    private static Component findAccessible(Container parent, String accessibleName)
    {
        for (Component child : parent.getComponents())
        {
            if (child.getAccessibleContext() != null
                    && accessibleName.equals(child.getAccessibleContext().getAccessibleName()))
                return child;
            if (child instanceof Container)
            {
                Component nested = findAccessible((Container) child, accessibleName);
                if (nested != null)
                    return nested;
            }
        }
        return null;
    }

    private static <T extends Component> T findComponent(Container parent, Class<T> type)
    {
        for (Component child : parent.getComponents())
        {
            if (type.isInstance(child))
                return type.cast(child);
            if (child instanceof Container)
            {
                T nested = findComponent((Container) child, type);
                if (nested != null)
                    return nested;
            }
        }
        return null;
    }

    private static JLabel findLabel(Container parent, String text)
    {
        for (Component child : parent.getComponents())
        {
            if (child instanceof JLabel && text.equals(((JLabel) child).getText()))
                return (JLabel) child;
            if (child instanceof Container)
            {
                JLabel nested = findLabel((Container) child, text);
                if (nested != null)
                    return nested;
            }
        }
        return null;
    }

    private static JButton requireButton(Container parent, String text)
    {
        for (Component child : parent.getComponents())
        {
            if (child instanceof JButton && text.equals(((JButton) child).getText()))
                return (JButton) child;
            if (child instanceof Container)
            {
                JButton nested = requireButtonOrNull((Container) child, text);
                if (nested != null)
                    return nested;
            }
        }
        throw new AssertionError("Button not found: " + text);
    }

    private static JButton requireButtonOrNull(Container parent, String text)
    {
        for (Component child : parent.getComponents())
        {
            if (child instanceof JButton && text.equals(((JButton) child).getText()))
                return (JButton) child;
            if (child instanceof Container)
            {
                JButton nested = requireButtonOrNull((Container) child, text);
                if (nested != null)
                    return nested;
            }
        }
        return null;
    }

    private static double contrastRatio(Color first, Color second)
    {
        double lighter = Math.max(luminance(first), luminance(second));
        double darker = Math.min(luminance(first), luminance(second));
        return (lighter + 0.05) / (darker + 0.05);
    }

    private static double luminance(Color color)
    {
        return 0.2126 * channel(color.getRed())
                + 0.7152 * channel(color.getGreen())
                + 0.0722 * channel(color.getBlue());
    }

    private static double channel(int value)
    {
        double normalized = value / 255.0;
        return normalized <= 0.03928
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
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
}
