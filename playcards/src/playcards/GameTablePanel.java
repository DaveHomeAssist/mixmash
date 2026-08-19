package playcards;

import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.List;
import javax.swing.BorderFactory;
import javax.swing.JPanel;
import javax.swing.Timer;

/** Renders both hands and the shared chip economy from one snapshot. */
final class GameTablePanel extends JPanel
{
    private final HandPanel dealerHand = new HandPanel(true);
    private final HandPanel playerHand = new HandPanel(false);
    private final ChipRail chipRail = new ChipRail();
    private Timer animationTimer;
    private boolean animating;

    GameTablePanel()
    {
        setLayout(new GridBagLayout());
        setOpaque(true);
        setBackground(TableTheme.TABLE_GREEN_DARK);
        setBorder(BorderFactory.createEmptyBorder(TableTheme.TABLE_INSET, TableTheme.TABLE_INSET,
                TableTheme.TABLE_INSET, TableTheme.TABLE_INSET));

        GridBagConstraints hand = new GridBagConstraints();
        hand.gridx = 0;
        hand.weightx = 1.0;
        hand.weighty = 0.5;
        hand.fill = GridBagConstraints.BOTH;
        hand.gridy = 0;
        add(dealerHand, hand);

        GridBagConstraints rail = new GridBagConstraints();
        rail.gridx = 0;
        rail.gridy = 1;
        rail.weightx = 1.0;
        rail.fill = GridBagConstraints.HORIZONTAL;
        rail.insets = new Insets(TableTheme.CHIP_RAIL_GAP, 0, TableTheme.CHIP_RAIL_GAP, 0);
        add(chipRail, rail);

        hand.gridy = 2;
        add(playerHand, hand);
    }

    void render(GameSnapshot snapshot)
    {
        stopAnimation();
        renderSnapshot(snapshot);
    }

    void animateOpeningHand(final GameSnapshot snapshot, final boolean showShuffle, final Runnable onComplete)
    {
        stopAnimation();
        if (!TableTheme.animationsEnabled())
        {
            renderSnapshot(snapshot);
            onComplete.run();
            return;
        }
        animating = true;
        renderChips(snapshot);
        animationTimer = new Timer(TableTheme.SHUFFLE_FRAME_MILLIS, new ActionListener()
        {
            private int frame;

            @Override
            public void actionPerformed(ActionEvent event)
            {
                if (showShuffle && frame < TableTheme.SHUFFLE_FRAME_COUNT)
                {
                    renderShuffleFrame(snapshot, frame++);
                    return;
                }

                int dealFrame = frame++ - (showShuffle ? TableTheme.SHUFFLE_FRAME_COUNT : 0);
                if (dealFrame == 0)
                    renderOpeningStep(snapshot, 1, 0);
                else if (dealFrame == 1)
                    renderOpeningStep(snapshot, 1, 1);
                else if (dealFrame == 2)
                    renderOpeningStep(snapshot, 2, 1);
                else
                    finishAnimation(snapshot, onComplete);
            }
        });
        animationTimer.setInitialDelay(0);
        animationTimer.start();
    }

    void animateHit(final GameSnapshot beforeHit, final GameSnapshot afterHit, final Runnable onComplete)
    {
        stopAnimation();
        if (!TableTheme.animationsEnabled())
        {
            renderSnapshot(afterHit);
            onComplete.run();
            return;
        }
        animating = true;
        renderHitPlaceholder(beforeHit);
        animationTimer = new Timer(TableTheme.DEAL_FRAME_MILLIS, new ActionListener()
        {
            @Override
            public void actionPerformed(ActionEvent event)
            {
                finishAnimation(afterHit, onComplete);
            }
        });
        animationTimer.setRepeats(false);
        animationTimer.start();
    }

    void animateDealerTurn(final GameSnapshot beforeStay, final GameSnapshot afterStay, final Runnable onComplete)
    {
        stopAnimation();
        if (!TableTheme.animationsEnabled())
        {
            renderSnapshot(afterStay);
            onComplete.run();
            return;
        }
        animating = true;
        renderChips(beforeStay);
        animationTimer = new Timer(TableTheme.DEAL_FRAME_MILLIS, new ActionListener()
        {
            private int visibleDealerCards = Math.min(2, afterStay.getDealerCards().size());

            @Override
            public void actionPerformed(ActionEvent event)
            {
                renderDealerStep(beforeStay, afterStay, visibleDealerCards);
                if (visibleDealerCards >= afterStay.getDealerCards().size())
                    finishAnimation(afterStay, onComplete);
                else
                    visibleDealerCards++;
            }
        });
        animationTimer.setInitialDelay(0);
        animationTimer.start();
    }

    boolean isAnimating()
    {
        return animating;
    }

    HandPanel getDealerHand()
    {
        return dealerHand;
    }

    HandPanel getPlayerHand()
    {
        return playerHand;
    }

    ChipRail getChipRail()
    {
        return chipRail;
    }

    private void renderSnapshot(GameSnapshot snapshot)
    {
        boolean revealDealer = snapshot.isHandComplete();
        dealerHand.render("Dealer", snapshot.getDealerPoints(), snapshot.getDealerCards(),
                snapshot.getDealerValue(), !revealDealer, revealDealer);
        playerHand.render(snapshot.getHumanName(), snapshot.getHumanPoints(), snapshot.getHumanCards(),
                snapshot.getHumanValue(), false, true);
        renderChips(snapshot);
        applySnapshotEmphasis(snapshot);
    }

    private void renderShuffleFrame(GameSnapshot snapshot, int frame)
    {
        int dealerCards = frame % 2 == 0 ? 3 : 2;
        int playerCards = frame % 2 == 0 ? 2 : 3;
        dealerHand.renderCardBacks("Dealer", snapshot.getDealerPoints(), dealerCards,
                "Hand value: shuffling", CardView.FaceDownPurpose.SHUFFLE);
        playerHand.renderCardBacks(snapshot.getHumanName(), snapshot.getHumanPoints(), playerCards,
                "Hand value: shuffling", CardView.FaceDownPurpose.SHUFFLE);
        renderChips(snapshot);
        dealerHand.setEmphasis(HandPanel.Emphasis.DEFAULT);
        playerHand.setEmphasis(HandPanel.Emphasis.DEFAULT);
    }

    private void renderOpeningStep(GameSnapshot snapshot, int visiblePlayerCards, int visibleDealerCards)
    {
        dealerHand.renderCards("Dealer", snapshot.getDealerPoints(),
                firstCards(snapshot.getDealerCards(), visibleDealerCards), "Hand value: dealing",
                true, false);
        playerHand.renderCards(snapshot.getHumanName(), snapshot.getHumanPoints(),
                firstCards(snapshot.getHumanCards(), visiblePlayerCards), "Hand value: dealing",
                false, false);
        renderChips(snapshot);
        dealerHand.setEmphasis(HandPanel.Emphasis.DEFAULT);
        playerHand.setEmphasis(HandPanel.Emphasis.ACTIVE);
    }

    private void renderHitPlaceholder(GameSnapshot beforeHit)
    {
        boolean revealDealer = beforeHit.isHandComplete();
        dealerHand.render("Dealer", beforeHit.getDealerPoints(), beforeHit.getDealerCards(),
                beforeHit.getDealerValue(), !revealDealer, revealDealer);
        playerHand.renderWithTrailingCardBack(beforeHit.getHumanName(), beforeHit.getHumanPoints(),
                beforeHit.getHumanCards(), beforeHit.getHumanValue(), false, true);
        renderChips(beforeHit);
        dealerHand.setEmphasis(HandPanel.Emphasis.DEFAULT);
        playerHand.setEmphasis(HandPanel.Emphasis.ACTIVE);
    }

    private void renderDealerStep(GameSnapshot beforeStay, GameSnapshot afterStay, int visibleDealerCards)
    {
        dealerHand.renderCards("Dealer", beforeStay.getDealerPoints(),
                firstCards(afterStay.getDealerCards(), visibleDealerCards), "Hand value: dealing",
                false, false);
        playerHand.render(afterStay.getHumanName(), beforeStay.getHumanPoints(), afterStay.getHumanCards(),
                afterStay.getHumanValue(), false, true);
        renderChips(beforeStay);
        dealerHand.setEmphasis(HandPanel.Emphasis.ACTIVE);
        playerHand.setEmphasis(HandPanel.Emphasis.DEFAULT);
    }

    private void renderChips(GameSnapshot snapshot)
    {
        chipRail.render(snapshot.getHumanName(), snapshot.getHumanPoints(), snapshot.getDealerPoints());
    }

    private void applySnapshotEmphasis(GameSnapshot snapshot)
    {
        if (snapshot.getPhase() == GamePhase.PLAYER_TURN)
        {
            dealerHand.setEmphasis(HandPanel.Emphasis.DEFAULT);
            playerHand.setEmphasis(HandPanel.Emphasis.ACTIVE);
            return;
        }
        if (snapshot.getPhase() == GamePhase.DEALER_TURN)
        {
            dealerHand.setEmphasis(HandPanel.Emphasis.ACTIVE);
            playerHand.setEmphasis(HandPanel.Emphasis.DEFAULT);
            return;
        }
        if (snapshot.getOutcome() == BlackjackGame.HandOutcome.PUSH)
        {
            dealerHand.setEmphasis(HandPanel.Emphasis.PUSH);
            playerHand.setEmphasis(HandPanel.Emphasis.PUSH);
            return;
        }

        boolean humanWon = snapshot.getOutcome() == BlackjackGame.HandOutcome.HUMAN_BLACKJACK
                || snapshot.getOutcome() == BlackjackGame.HandOutcome.DEALER_BUST
                || snapshot.getOutcome() == BlackjackGame.HandOutcome.HUMAN_WIN;
        dealerHand.setEmphasis(humanWon ? HandPanel.Emphasis.LOSER : HandPanel.Emphasis.WINNER);
        playerHand.setEmphasis(humanWon ? HandPanel.Emphasis.WINNER : HandPanel.Emphasis.LOSER);
    }

    private List<Card> firstCards(List<Card> cards, int count)
    {
        return cards.subList(0, Math.min(count, cards.size()));
    }

    private void finishAnimation(GameSnapshot snapshot, Runnable onComplete)
    {
        if (animationTimer != null)
            animationTimer.stop();
        animationTimer = null;
        animating = false;
        renderSnapshot(snapshot);
        onComplete.run();
    }

    private void stopAnimation()
    {
        if (animationTimer != null)
            animationTimer.stop();
        animationTimer = null;
        animating = false;
    }
}
