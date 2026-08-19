package playcards;

import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.plaf.basic.BasicButtonUI;

/** Table-themed action with explicit primary, hover, disabled, and focus states. */
final class TableButton extends JButton
{
    private boolean primary;

    TableButton(String text)
    {
        super(text);
        setUI(new BasicButtonUI());
        setOpaque(true);
        setContentAreaFilled(true);
        setFocusPainted(true);
        setRolloverEnabled(true);
        getModel().addChangeListener(event -> refreshStyle());
        addFocusListener(new FocusAdapter()
        {
            @Override
            public void focusGained(FocusEvent event)
            {
                refreshStyle();
            }

            @Override
            public void focusLost(FocusEvent event)
            {
                refreshStyle();
            }
        });
        refreshStyle();
    }

    void setPrimary(boolean primary)
    {
        this.primary = primary;
        refreshStyle();
    }

    boolean isPrimary()
    {
        return primary;
    }

    private void refreshStyle()
    {
        boolean focused = isFocusOwner();
        boolean hovered = getModel().isRollover() || getModel().isPressed();
        java.awt.Color borderColor;
        int borderWidth = focused || primary ? 2 : 1;

        if (!isEnabled())
        {
            setBackground(TableTheme.PANEL_GREEN_DISABLED);
            setForeground(TableTheme.CREAM_DIM);
            borderColor = TableTheme.PANEL_BORDER;
        }
        else if (primary)
        {
            setBackground(hovered ? TableTheme.GOLD_HOVER : TableTheme.GOLD);
            setForeground(TableTheme.INK);
            borderColor = focused ? TableTheme.CREAM : TableTheme.GOLD_DARK;
        }
        else
        {
            setBackground(hovered ? TableTheme.PANEL_GREEN_HOVER : TableTheme.PANEL_GREEN);
            setForeground(TableTheme.CREAM);
            borderColor = focused ? TableTheme.GOLD : TableTheme.PANEL_BORDER;
        }

        setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(borderColor, borderWidth),
                BorderFactory.createEmptyBorder(6, 10, 6, 10)));
    }
}
