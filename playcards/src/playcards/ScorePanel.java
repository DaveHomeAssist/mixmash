package playcards;

import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Insets;
import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;

/** Header showing participant identity, hand value, turn state, and physical chips. */
final class ScorePanel extends JPanel
{
    private static final String ELLIPSIS = "\u2026";

    private final boolean dealer;
    private final JPanel identity = new JPanel(new BorderLayout(TableTheme.SCORE_GAP, 0));
    private final JPanel handDetails = new JPanel(new FlowLayout(FlowLayout.LEFT,
            TableTheme.SCORE_DETAIL_GAP, 0));
    private final JLabel name = new JLabel();
    private final JLabel handLabel = new JLabel("HAND");
    private final JLabel handValue = new JLabel();
    private final JLabel stateBadge = new JLabel();
    private final ChipCountView chips = new ChipCountView();
    private String fullDisplayName = "";

    ScorePanel()
    {
        this(false);
    }

    ScorePanel(boolean dealer)
    {
        this.dealer = dealer;
        setLayout(new BorderLayout(TableTheme.SCORE_GAP, 0));
        setOpaque(false);
        identity.setOpaque(false);
        handDetails.setOpaque(false);

        name.setForeground(TableTheme.CREAM);
        name.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.SECTION_SIZE));
        handLabel.setForeground(TableTheme.CREAM_DIM);
        handLabel.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.META_SIZE));
        handValue.setForeground(TableTheme.CREAM);
        handValue.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.HAND_VALUE_SIZE));

        stateBadge.setOpaque(true);
        stateBadge.setBackground(TableTheme.GOLD);
        stateBadge.setForeground(TableTheme.INK);
        stateBadge.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.META_SIZE));
        stateBadge.setBorder(BorderFactory.createEmptyBorder(3, 7, 3, 7));
        stateBadge.setVisible(false);

        handDetails.add(handLabel);
        handDetails.add(handValue);
        handDetails.add(stateBadge);
        identity.add(name, BorderLayout.WEST);
        identity.add(handDetails, BorderLayout.CENTER);
        add(identity, BorderLayout.CENTER);
        add(chips, BorderLayout.EAST);
    }

    void render(String participantName, int points, String valueText)
    {
        fullDisplayName = participantName;
        name.setText(fullDisplayName);
        name.setToolTipText(participantName);
        name.getAccessibleContext().setAccessibleName(participantName);
        handValue.setText(compactValue(valueText));
        handValue.getAccessibleContext().setAccessibleName(valueText);
        chips.render(participantName, points, dealer);
    }

    void setEmphasis(HandPanel.Emphasis emphasis)
    {
        String badge = "";
        switch (emphasis)
        {
            case ACTIVE:
                badge = dealer ? "DEALER TURN" : "YOUR TURN";
                break;
            case WINNER:
                badge = "WINNER";
                break;
            case PUSH:
                badge = "PUSH";
                break;
            case DEFAULT:
            case LOSER:
                break;
            default:
                throw new IllegalStateException("Unknown hand emphasis: " + emphasis);
        }
        stateBadge.setText(badge);
        stateBadge.setVisible(badge.length() > 0);
        stateBadge.getAccessibleContext().setAccessibleName(badge.length() == 0
                ? "No participant state" : badge);
        revalidate();
        repaint();
    }

    JLabel getNameLabel()
    {
        return name;
    }

    JLabel getHandValueLabel()
    {
        return handValue;
    }

    JLabel getStateBadge()
    {
        return stateBadge;
    }

    ChipCountView getChipCountView()
    {
        return chips;
    }

    @Override
    public void doLayout()
    {
        fitNameToAvailableWidth();
        super.doLayout();
    }

    private String compactValue(String valueText)
    {
        int separator = valueText.indexOf(':');
        String value = separator >= 0 ? valueText.substring(separator + 1).trim() : valueText.trim();
        if ("hidden".equalsIgnoreCase(value))
            return "\u2014";
        if ("dealing".equalsIgnoreCase(value) || "shuffling".equalsIgnoreCase(value))
            return "\u2026";
        return value;
    }

    private void fitNameToAvailableWidth()
    {
        if (getWidth() <= 0)
        {
            updateDisplayedName(fullDisplayName);
            return;
        }

        Insets insets = getInsets();
        int availableWidth = getWidth() - insets.left - insets.right
                - chips.getPreferredSize().width - handDetails.getPreferredSize().width
                - (2 * TableTheme.SCORE_GAP);
        updateDisplayedName(elide(fullDisplayName, Math.max(0, availableWidth)));
    }

    private void updateDisplayedName(String displayName)
    {
        if (!displayName.equals(name.getText()))
            name.setText(displayName);
    }

    private String elide(String value, int maximumWidth)
    {
        FontMetrics metrics = name.getFontMetrics(name.getFont());
        if (metrics.stringWidth(value) <= maximumWidth)
            return value;
        if (metrics.stringWidth(ELLIPSIS) > maximumWidth)
            return "";

        int end = value.length();
        while (end > 0)
        {
            end = value.offsetByCodePoints(end, -1);
            if (metrics.stringWidth(value.substring(0, end) + ELLIPSIS) <= maximumWidth)
                return value.substring(0, end) + ELLIPSIS;
        }
        return ELLIPSIS;
    }
}
