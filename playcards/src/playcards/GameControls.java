package playcards;

import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.GridLayout;
import javax.accessibility.AccessibleContext;
import javax.swing.JLabel;
import javax.swing.JPanel;

/** Status and action controls for a game snapshot. */
final class GameControls extends JPanel
{
    private static final String STATUS_CARD = "status";
    private static final String OUTCOME_CARD = "outcome";

    private final JLabel status = new JLabel();
    private final JPanel messageArea = new JPanel(new CardLayout());
    private final OutcomePanel outcome = new OutcomePanel();
    private final JPanel buttons = new JPanel();
    private final TableButton hitButton = new TableButton("Hit");
    private final TableButton stayButton = new TableButton("Stay");
    private final TableButton nextHandButton = new TableButton("Next Hand");
    private final TableButton newGameButton = new TableButton("New Game");
    private boolean animationLocked;
    private int controlRows;

    GameControls(final Runnable onHit, final Runnable onStay, final Runnable onNextHand, final Runnable onNewGame)
    {
        setOpaque(false);
        setLayout(new BorderLayout(TableTheme.CONTROL_GAP, 0));

        configureButton(hitButton, 'H', "Hit: take another card");
        configureButton(stayButton, 'S', "Stay: resolve the dealer turn");
        configureButton(nextHandButton, 'N', "Start the next hand");
        configureButton(newGameButton, 'G', "Start a new game");

        hitButton.addActionListener(event -> onHit.run());
        stayButton.addActionListener(event -> onStay.run());
        nextHandButton.addActionListener(event -> onNextHand.run());
        newGameButton.addActionListener(event -> onNewGame.run());

        status.setForeground(TableTheme.CREAM);
        status.setFont(TableTheme.uiFont(Font.PLAIN, TableTheme.BODY_SIZE));
        status.getAccessibleContext().setAccessibleName("Game status");
        messageArea.setOpaque(false);
        messageArea.add(status, STATUS_CARD);
        messageArea.add(outcome, OUTCOME_CARD);

        buttons.setOpaque(false);
        buttons.getAccessibleContext().setAccessibleName("Game actions");
        buttons.add(hitButton);
        buttons.add(stayButton);
        buttons.add(nextHandButton);
        buttons.add(newGameButton);

        add(messageArea, BorderLayout.CENTER);
        add(buttons, BorderLayout.EAST);
        updateResponsiveLayout(TableTheme.FRAME_WIDTH);
    }

    void render(GameSnapshot snapshot, String statusMessage)
    {
        CardLayout messages = (CardLayout) messageArea.getLayout();
        if (!animationLocked && snapshot.isHandComplete())
        {
            outcome.render(snapshot, statusMessage);
            messages.show(messageArea, OUTCOME_CARD);
            status.setVisible(false);
            outcome.setVisible(true);
        }
        else
        {
            outcome.setVisible(false);
            messages.show(messageArea, STATUS_CARD);
            status.setVisible(true);
            announceStatus(statusMessage);
        }

        status.setText(statusMessage);
        hitButton.setEnabled(!animationLocked && snapshot.canHit());
        stayButton.setEnabled(!animationLocked && snapshot.canStay());
        nextHandButton.setEnabled(!animationLocked && snapshot.canStartNextHand());
        newGameButton.setEnabled(!animationLocked);
        hitButton.setPrimary(!animationLocked && snapshot.canHit());
        stayButton.setPrimary(false);
        nextHandButton.setPrimary(!animationLocked && snapshot.canStartNextHand());
        newGameButton.setPrimary(!animationLocked && snapshot.isGameOver());
    }

    void setAnimationLocked(boolean animationLocked)
    {
        this.animationLocked = animationLocked;
    }

    int getControlRows()
    {
        return controlRows;
    }

    @Override
    public void doLayout()
    {
        updateResponsiveLayout(getWidth());
        super.doLayout();
    }

    private void updateResponsiveLayout(int width)
    {
        int desiredRows = width > 0 && width < TableTheme.CONTROL_BREAKPOINT ? 2 : 1;
        if (desiredRows == controlRows)
            return;

        controlRows = desiredRows;
        buttons.setLayout(desiredRows == 2
                ? new GridLayout(2, 2, TableTheme.CONTROL_GAP, TableTheme.CONTROL_GAP)
                : new GridLayout(1, 4, TableTheme.CONTROL_GAP, 0));
        Dimension buttonSize = TableTheme.controlButtonSize();
        int widthForButtons = desiredRows == 2
                ? (buttonSize.width * 2) + TableTheme.CONTROL_GAP
                : (buttonSize.width * 4) + (TableTheme.CONTROL_GAP * 3);
        int heightForButtons = desiredRows == 2
                ? (buttonSize.height * 2) + TableTheme.CONTROL_GAP
                : buttonSize.height;
        buttons.setPreferredSize(new Dimension(widthForButtons, heightForButtons));
        revalidate();
    }

    private void announceStatus(String statusMessage)
    {
        String oldMessage = status.getAccessibleContext().getAccessibleDescription();
        status.getAccessibleContext().setAccessibleDescription(statusMessage);
        if (oldMessage == null || !oldMessage.equals(statusMessage))
            status.getAccessibleContext().firePropertyChange(
                    AccessibleContext.ACCESSIBLE_VISIBLE_DATA_PROPERTY, oldMessage, statusMessage);
    }

    private void configureButton(TableButton button, char mnemonic, String accessibleName)
    {
        button.setPreferredSize(TableTheme.controlButtonSize());
        button.setMinimumSize(TableTheme.controlButtonSize());
        button.setFocusPainted(true);
        button.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.CONTROL_SIZE));
        button.setMnemonic(mnemonic);
        button.setToolTipText(accessibleName);
        button.getAccessibleContext().setAccessibleName(accessibleName);
        button.setPrimary(false);
    }
}
