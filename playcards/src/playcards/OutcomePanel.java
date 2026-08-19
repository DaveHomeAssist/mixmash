package playcards;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Font;
import javax.accessibility.AccessibleContext;
import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;

/** High-visibility, text-first presentation of a completed hand. */
final class OutcomePanel extends JPanel
{
    private final JLabel icon = new JLabel();
    private final JLabel title = new JLabel();
    private final JLabel copy = new JLabel();

    OutcomePanel()
    {
        setLayout(new BorderLayout(TableTheme.CONTROL_GAP, 0));
        setBorder(BorderFactory.createEmptyBorder(6, 10, 6, 10));

        icon.setFont(TableTheme.uiFont(Font.BOLD, 24));
        JPanel text = new JPanel(new BorderLayout());
        text.setOpaque(false);
        title.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.CONTROL_SIZE));
        copy.setFont(TableTheme.uiFont(Font.PLAIN, TableTheme.SUBTITLE_SIZE));
        text.add(title, BorderLayout.NORTH);
        text.add(copy, BorderLayout.SOUTH);

        add(icon, BorderLayout.WEST);
        add(text, BorderLayout.CENTER);
        setVisible(false);
    }

    void render(GameSnapshot snapshot, String message)
    {
        if (!snapshot.isHandComplete())
        {
            setVisible(false);
            return;
        }

        Color background;
        Color foreground;
        String iconText;
        String titleText;
        if (snapshot.isGameOver())
        {
            background = TableTheme.GOLD;
            foreground = TableTheme.INK;
            iconText = "★";
            titleText = "GAME OVER";
        }
        else
        {
            switch (snapshot.getOutcome())
            {
                case HUMAN_BLACKJACK:
                    background = TableTheme.WIN_BACKGROUND;
                    foreground = TableTheme.INK;
                    iconText = "★";
                    titleText = "BLACKJACK";
                    break;
                case DEALER_BLACKJACK:
                    background = TableTheme.LOSS_BACKGROUND;
                    foreground = TableTheme.RED;
                    iconText = "♠";
                    titleText = "DEALER BLACKJACK";
                    break;
                case HUMAN_BUST:
                    background = TableTheme.LOSS_BACKGROUND;
                    foreground = TableTheme.RED;
                    iconText = "!";
                    titleText = "BUST";
                    break;
                case DEALER_BUST:
                    background = TableTheme.WIN_BACKGROUND;
                    foreground = TableTheme.INK;
                    iconText = "↗";
                    titleText = "DEALER BUST";
                    break;
                case HUMAN_WIN:
                    background = TableTheme.WIN_BACKGROUND;
                    foreground = TableTheme.INK;
                    iconText = "✓";
                    titleText = "HAND WON";
                    break;
                case DEALER_WIN:
                    background = TableTheme.LOSS_BACKGROUND;
                    foreground = TableTheme.RED;
                    iconText = "✕";
                    titleText = "DEALER WINS";
                    break;
                case PUSH:
                    background = TableTheme.PUSH_BACKGROUND;
                    foreground = TableTheme.PUSH_INK;
                    iconText = "↔";
                    titleText = "PUSH";
                    break;
                default:
                    throw new IllegalStateException("Unknown hand outcome: " + snapshot.getOutcome());
            }
        }

        setBackground(background);
        icon.setText(iconText);
        icon.setForeground(foreground);
        title.setText(titleText);
        title.setForeground(foreground);
        copy.setText(message);
        copy.setForeground(foreground);
        String announcement = titleText + ". " + message;
        String oldAnnouncement = getAccessibleContext().getAccessibleDescription();
        getAccessibleContext().setAccessibleName("Hand outcome: " + announcement);
        getAccessibleContext().setAccessibleDescription(announcement);
        if (oldAnnouncement == null || !oldAnnouncement.equals(announcement))
            getAccessibleContext().firePropertyChange(
                    AccessibleContext.ACCESSIBLE_VISIBLE_DATA_PROPERTY,
                    oldAnnouncement, announcement);
        setVisible(true);
    }
}
