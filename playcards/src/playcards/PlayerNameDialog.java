package playcards;

import java.awt.Frame;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.KeyStroke;

/** Modal wrapper around the testable, themed player-name panel. */
final class PlayerNameDialog extends JDialog
{
    private final PlayerNamePanel prompt = new PlayerNamePanel();
    private String playerName = "Player";

    private PlayerNameDialog(Frame owner)
    {
        super(owner, "PlayCards · New Game", true);
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setResizable(false);
        setContentPane(prompt);
        getRootPane().setDefaultButton(prompt.getStartButton());

        prompt.getStartButton().addActionListener(event -> acceptName());
        prompt.getNameField().addActionListener(event -> acceptName());
        prompt.getCancelButton().addActionListener(event -> dispose());
        getRootPane().getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(
                KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), "cancel-name");
        getRootPane().getActionMap().put("cancel-name", new AbstractAction()
        {
            @Override
            public void actionPerformed(ActionEvent event)
            {
                dispose();
            }
        });
        addWindowListener(new WindowAdapter()
        {
            @Override
            public void windowOpened(WindowEvent event)
            {
                prompt.getNameField().requestFocusInWindow();
            }
        });
        pack();
        setLocationRelativeTo(owner);
    }

    static String requestName(Frame owner)
    {
        PlayerNameDialog dialog = new PlayerNameDialog(owner);
        dialog.setVisible(true);
        return dialog.playerName;
    }

    private void acceptName()
    {
        playerName = prompt.getPlayerName();
        dispose();
    }
}
