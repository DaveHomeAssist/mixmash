package playcards;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.util.ArrayList;
import java.util.List;
import javax.swing.BorderFactory;
import javax.swing.JPanel;

/** Renders one participant's cards and hand value from a game snapshot. */
final class HandPanel extends JPanel
{
    enum Emphasis
    {
        DEFAULT,
        ACTIVE,
        WINNER,
        LOSER,
        PUSH
    }

    private final ScorePanel score;
    private final JPanel cards = new JPanel(new FlowLayout(FlowLayout.LEFT, TableTheme.CARD_GAP,
            TableTheme.CARD_VERTICAL_GAP));
    private final List<CardView> cardViews = new ArrayList<CardView>();
    private Emphasis emphasis = Emphasis.DEFAULT;

    HandPanel()
    {
        this(false);
    }

    HandPanel(boolean dealer)
    {
        score = new ScorePanel(dealer);
        setLayout(new BorderLayout(0, TableTheme.HAND_GAP));
        setBackground(TableTheme.PANEL_GREEN);
        applyEmphasis();

        cards.setOpaque(false);

        add(score, BorderLayout.NORTH);
        add(cards, BorderLayout.CENTER);
    }

    void render(String participantName, int points, List<Card> hand, int handValue,
            boolean hideFirstCard, boolean showValue)
    {
        renderCards(participantName, points, hand,
                showValue ? "Hand value: " + handValue : "Hand value: hidden", hideFirstCard, false);
    }

    void renderCardBacks(String participantName, int points, int cardCount, String valueText,
            CardView.FaceDownPurpose purpose)
    {
        score.render(participantName, points, valueText);
        cards.removeAll();
        cardViews.clear();
        for (int index = 0; index < cardCount; index++)
            addCard(CardView.faceDown(purpose));

        getAccessibleContext().setAccessibleName(participantName + " hand");
        finishRendering();
    }

    void renderWithTrailingCardBack(String participantName, int points, List<Card> hand, int handValue,
            boolean hideFirstCard, boolean showValue)
    {
        renderCards(participantName, points, hand,
                showValue ? "Hand value: " + handValue : "Hand value: hidden", hideFirstCard, true);
    }

    void renderCards(String participantName, int points, List<Card> hand, String valueText,
            boolean hideFirstCard, boolean addTrailingCardBack)
    {
        score.render(participantName, points, valueText);
        cards.removeAll();
        cardViews.clear();
        for (int index = 0; index < hand.size(); index++)
            addCard(new CardView(hand.get(index), hideFirstCard && index == 0));
        if (addTrailingCardBack)
            addCard(CardView.faceDown(CardView.FaceDownPurpose.PLAYER_HIT));

        getAccessibleContext().setAccessibleName(participantName + " hand");
        finishRendering();
    }

    void setEmphasis(Emphasis emphasis)
    {
        if (emphasis == null)
            throw new IllegalArgumentException("Hand emphasis is required");
        this.emphasis = emphasis;
        applyEmphasis();
        score.setEmphasis(emphasis);
    }

    Emphasis getEmphasis()
    {
        return emphasis;
    }

    ScorePanel getScorePanel()
    {
        return score;
    }

    JPanel getCardArea()
    {
        return cards;
    }

    @Override
    public void doLayout()
    {
        super.doLayout();
        resizeCards();
        cards.doLayout();
    }

    private void addCard(CardView card)
    {
        cardViews.add(card);
        cards.add(card);
    }

    private void finishRendering()
    {
        resizeCards();
        cards.revalidate();
        cards.repaint();
    }

    private void resizeCards()
    {
        if (cardViews.isEmpty() || cards.getWidth() <= 0 || cards.getHeight() <= 0)
            return;

        int availableWidth = cards.getWidth() - (2 * TableTheme.CARD_GAP);
        int availableHeight = cards.getHeight() - (2 * TableTheme.CARD_VERTICAL_GAP);
        Dimension cardSize = TableTheme.cardSizeFor(availableWidth, availableHeight, cardViews.size());
        for (CardView card : cardViews)
            card.setCardSize(cardSize);
    }

    private void applyEmphasis()
    {
        java.awt.Color borderColor = TableTheme.PANEL_BORDER;
        java.awt.Color background = TableTheme.PANEL_GREEN;
        int borderWidth = TableTheme.PANEL_BORDER_WIDTH;
        String description = "Participant hand";

        switch (emphasis)
        {
            case ACTIVE:
                borderColor = TableTheme.GOLD;
                borderWidth = TableTheme.HAND_EMPHASIS_BORDER_WIDTH;
                description = "Active participant";
                break;
            case WINNER:
                borderColor = TableTheme.GOLD;
                background = TableTheme.WINNER_GREEN;
                borderWidth = TableTheme.HAND_EMPHASIS_BORDER_WIDTH;
                description = "Winning participant";
                break;
            case LOSER:
                description = "Other participant";
                break;
            case PUSH:
                borderColor = TableTheme.GOLD_DARK;
                borderWidth = TableTheme.HAND_EMPHASIS_BORDER_WIDTH;
                description = "Push: tied participants";
                break;
            case DEFAULT:
                break;
            default:
                throw new IllegalStateException("Unknown hand emphasis: " + emphasis);
        }

        setBackground(background);
        setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(borderColor, borderWidth),
                BorderFactory.createEmptyBorder(TableTheme.HAND_PADDING, TableTheme.HAND_SIDE_PADDING,
                        TableTheme.HAND_PADDING, TableTheme.HAND_SIDE_PADDING)));
        getAccessibleContext().setAccessibleDescription(description);
    }
}
