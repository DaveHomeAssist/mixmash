package playcards;

import java.awt.BasicStroke;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Insets;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.geom.RoundRectangle2D;
import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingConstants;
import javax.swing.border.Border;

/** Visual representation of one card, independent of game state. */
final class CardView extends JPanel
{
    enum FaceDownPurpose
    {
        SHUFFLE("Shuffling card, face down"),
        PLAYER_HIT("New player card, face down");

        private final String description;

        FaceDownPurpose(String description)
        {
            this.description = description;
        }
    }

    private final JLabel topLabel;
    private final JLabel centerLabel;
    private final JLabel bottomLabel;
    private final boolean hidden;

    static CardView faceDown(FaceDownPurpose purpose)
    {
        if (purpose == null)
            throw new IllegalArgumentException("Face-down purpose is required");
        return new CardView(null, true, purpose.description);
    }

    CardView(Card card, boolean hidden)
    {
        this(card, hidden, "Dealer hole card, face down");
    }

    private CardView(Card card, boolean hidden, String hiddenDescription)
    {
        if (!hidden && card == null)
            throw new IllegalArgumentException("A visible card requires card data");

        this.hidden = hidden;
        setLayout(new BorderLayout());
        setOpaque(false);
        setBackground(hidden ? TableTheme.CARD_BACK : TableTheme.PAPER);
        Color borderColor = hidden ? TableTheme.CARD_BACK_BORDER : TableTheme.CARD_BORDER;
        setBorder(BorderFactory.createCompoundBorder(
                new RoundedLineBorder(borderColor, TableTheme.CARD_BORDER_WIDTH,
                        TableTheme.CARD_CORNER_RADIUS),
                BorderFactory.createEmptyBorder(TableTheme.CARD_INSET_VERTICAL,
                        TableTheme.CARD_INSET_HORIZONTAL, TableTheme.CARD_INSET_VERTICAL,
                        TableTheme.CARD_INSET_HORIZONTAL)));

        if (hidden)
        {
            topLabel = createBackLabel(SwingConstants.LEFT);
            centerLabel = createBackLabel(SwingConstants.CENTER);
            bottomLabel = createBackLabel(SwingConstants.RIGHT);
        }
        else
        {
            Color faceColor = cardColor(card);
            topLabel = createCornerLabel(card, faceColor, SwingConstants.LEFT);
            centerLabel = new JLabel(String.valueOf(card.getSuit().getSymbol()), SwingConstants.CENTER);
            centerLabel.setForeground(faceColor);
            bottomLabel = createCornerLabel(card, faceColor, SwingConstants.RIGHT);
        }

        add(topLabel, BorderLayout.NORTH);
        add(centerLabel, BorderLayout.CENTER);
        add(bottomLabel, BorderLayout.SOUTH);
        setCardSize(TableTheme.cardPreferredSize());

        String accessibleName = hidden ? "Face-down card" : "Card " + card;
        getAccessibleContext().setAccessibleName(accessibleName);
        getAccessibleContext().setAccessibleDescription(hidden
                ? hiddenDescription
                : "A visible playing card showing " + card);
        setToolTipText(accessibleName);
    }

    @Override
    protected void paintComponent(Graphics graphics)
    {
        super.paintComponent(graphics);
        Graphics2D copy = (Graphics2D) graphics.create();
        copy.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        int width = Math.max(0, getWidth() - 1);
        int height = Math.max(0, getHeight() - 1);
        int arc = TableTheme.CARD_CORNER_RADIUS;
        Shape cardShape = new RoundRectangle2D.Float(0, 0, width, height, arc, arc);
        copy.setColor(hidden ? TableTheme.CARD_BACK : TableTheme.PAPER);
        copy.fill(cardShape);

        if (hidden)
        {
            copy.setClip(cardShape);
            copy.setColor(TableTheme.CARD_BACK_STRIPE);
            copy.setStroke(new BasicStroke(7f));
            for (int x = -height; x < width + height; x += 16)
                copy.drawLine(x, height, x + height, 0);
        }
        copy.dispose();
    }

    void setCardSize(Dimension size)
    {
        Dimension applied = new Dimension(size);
        if (!applied.equals(getPreferredSize()))
        {
            setPreferredSize(applied);
            setMinimumSize(applied);
            setMaximumSize(applied);
        }

        float scale = (float) applied.width / TableTheme.CARD_WIDTH;
        int cornerSize = Math.max(10, Math.round(TableTheme.CARD_CORNER_SIZE * scale));
        int centerSize = Math.max(24, Math.round(TableTheme.CARD_SUIT_SIZE * scale));
        topLabel.setFont(TableTheme.cardFont(Font.BOLD, cornerSize));
        bottomLabel.setFont(TableTheme.cardFont(Font.BOLD, cornerSize));
        centerLabel.setFont(TableTheme.cardFont(Font.BOLD, centerSize));
    }

    private JLabel createCornerLabel(Card card, Color color, int alignment)
    {
        JLabel label = new JLabel(card.getRank().getDisplayValue() + card.getSuit().getSymbol(), alignment);
        label.setFont(TableTheme.cardFont(Font.BOLD, TableTheme.CARD_CORNER_SIZE));
        label.setForeground(color);
        return label;
    }

    private JLabel createBackLabel(int alignment)
    {
        JLabel label = new JLabel("", alignment);
        label.setForeground(TableTheme.GOLD);
        return label;
    }

    private Color cardColor(Card card)
    {
        return card.getColor() == Card.Color.RED ? TableTheme.RED : TableTheme.INK;
    }

    private static final class RoundedLineBorder implements Border
    {
        private final Color color;
        private final int thickness;
        private final int arc;

        RoundedLineBorder(Color color, int thickness, int arc)
        {
            this.color = color;
            this.thickness = thickness;
            this.arc = arc;
        }

        @Override
        public Insets getBorderInsets(Component component)
        {
            return new Insets(thickness, thickness, thickness, thickness);
        }

        @Override
        public boolean isBorderOpaque()
        {
            return false;
        }

        @Override
        public void paintBorder(Component component, Graphics graphics, int x, int y, int width, int height)
        {
            Graphics2D copy = (Graphics2D) graphics.create();
            copy.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            copy.setColor(color);
            copy.setStroke(new BasicStroke(thickness));
            int offset = thickness / 2;
            copy.drawRoundRect(x + offset, y + offset, width - thickness, height - thickness, arc, arc);
            copy.dispose();
        }
    }
}
