package playcards;

import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.FocusTraversalPolicy;
import java.awt.Font;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;

/** Theme-aligned, keyboard-ordered content for the player-name dialog. */
final class PlayerNamePanel extends JPanel
{
    private final JTextField nameField = new JTextField(20);
    private final TableButton startButton = new TableButton("Deal Me In");
    private final TableButton cancelButton = new TableButton("Use Player");

    PlayerNamePanel()
    {
        setLayout(new BorderLayout(TableTheme.ROOT_GAP, TableTheme.ROOT_GAP));
        setBackground(TableTheme.TABLE_GREEN);
        setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(TableTheme.GOLD_DARK, 2),
                BorderFactory.createEmptyBorder(20, 22, 20, 22)));

        JPanel introduction = new JPanel(new BorderLayout(0, 5));
        introduction.setOpaque(false);
        JLabel heading = new JLabel("WELCOME TO PLAYCARDS");
        heading.setForeground(TableTheme.GOLD);
        heading.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.SECTION_SIZE));
        heading.getAccessibleContext().setAccessibleName("Welcome to PlayCards");
        JLabel description = new JLabel("Five chips each. A won hand moves one chip across the table.");
        description.setForeground(TableTheme.CREAM_DIM);
        description.setFont(TableTheme.uiFont(Font.PLAIN, TableTheme.SUBTITLE_SIZE));
        introduction.add(heading, BorderLayout.NORTH);
        introduction.add(description, BorderLayout.SOUTH);

        JPanel input = new JPanel(new BorderLayout(0, 6));
        input.setOpaque(false);
        JLabel label = new JLabel("PLAYER NAME");
        label.setForeground(TableTheme.GOLD);
        label.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.META_SIZE));
        label.setLabelFor(nameField);
        nameField.setFont(TableTheme.uiFont(Font.PLAIN, TableTheme.BODY_SIZE));
        nameField.setBackground(TableTheme.PAPER);
        nameField.setForeground(TableTheme.INK);
        nameField.setCaretColor(TableTheme.INK);
        nameField.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(TableTheme.GOLD, 2),
                BorderFactory.createEmptyBorder(8, 10, 8, 10)));
        nameField.setPreferredSize(new Dimension(nameField.getPreferredSize().width,
                TableTheme.CONTROL_BUTTON_HEIGHT));
        nameField.getAccessibleContext().setAccessibleName("Player name");
        nameField.getAccessibleContext().setAccessibleDescription(
                "Enter the name shown beside your blackjack hand");
        input.add(label, BorderLayout.NORTH);
        input.add(nameField, BorderLayout.CENTER);

        JPanel actions = new JPanel(new java.awt.GridLayout(1, 2, TableTheme.CONTROL_GAP, 0));
        actions.setOpaque(false);
        configureButton(startButton, true, "Start game with this player name");
        configureButton(cancelButton, false, "Continue with the default name Player");
        actions.add(startButton);
        actions.add(cancelButton);

        add(introduction, BorderLayout.NORTH);
        add(input, BorderLayout.CENTER);
        add(actions, BorderLayout.SOUTH);

        setFocusCycleRoot(true);
        setFocusTraversalPolicy(new PromptFocusTraversalPolicy());
        getAccessibleContext().setAccessibleName("Player name prompt");
    }

    String getPlayerName()
    {
        return normalizeName(nameField.getText());
    }

    JTextField getNameField()
    {
        return nameField;
    }

    JButton getStartButton()
    {
        return startButton;
    }

    JButton getCancelButton()
    {
        return cancelButton;
    }

    static String normalizeName(String value)
    {
        return value == null || value.trim().length() == 0 ? "Player" : value.trim();
    }

    private void configureButton(TableButton button, boolean primary, String accessibleName)
    {
        button.setPreferredSize(TableTheme.controlButtonSize());
        button.setFocusPainted(true);
        button.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.CONTROL_SIZE));
        button.setPrimary(primary);
        button.getAccessibleContext().setAccessibleName(accessibleName);
    }

    private final class PromptFocusTraversalPolicy extends FocusTraversalPolicy
    {
        @Override
        public Component getComponentAfter(Container container, Component component)
        {
            if (component == nameField)
                return startButton;
            if (component == startButton)
                return cancelButton;
            return nameField;
        }

        @Override
        public Component getComponentBefore(Container container, Component component)
        {
            if (component == nameField)
                return cancelButton;
            if (component == cancelButton)
                return startButton;
            return nameField;
        }

        @Override
        public Component getFirstComponent(Container container)
        {
            return nameField;
        }

        @Override
        public Component getLastComponent(Container container)
        {
            return cancelButton;
        }

        @Override
        public Component getDefaultComponent(Container container)
        {
            return nameField;
        }
    }
}
