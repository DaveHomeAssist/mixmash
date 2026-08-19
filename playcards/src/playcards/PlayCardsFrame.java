package playcards;

import java.awt.BorderLayout;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.InputMap;
import javax.swing.ActionMap;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JRootPane;
import javax.swing.KeyStroke;
import javax.swing.SwingConstants;

/**
 * Swing view for PlayCards. All gameplay state is owned by BlackjackGame.
 */
public final class PlayCardsFrame extends JFrame
{
    private final BlackjackController controller;
    private final GameTablePanel table = new GameTablePanel();
    private final GameControls controls;
    private boolean animationRunning;

    public PlayCardsFrame()
    {
        super("PlayCards Blackjack");
        controller = new BlackjackController(PlayerNameDialog.requestName(this));
        controls = new GameControls(new Runnable()
        {
            @Override
            public void run()
            {
                takeHit();
            }
        }, new Runnable()
        {
            @Override
            public void run()
            {
                takeStay();
            }
        }, new Runnable()
        {
            @Override
            public void run()
            {
                startNextHand();
            }
        }, new Runnable()
        {
            @Override
            public void run()
            {
                startNewGame();
            }
        });

        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setMinimumSize(TableTheme.minimumWindowSize());
        setSize(TableTheme.startingWindowSize());
        setLocationByPlatform(true);
        buildInterface();
        installKeyboardActions();
        animateOpeningHand(controller.getSnapshot(), true);
    }

    private void buildInterface()
    {
        setContentPane(createInterface(table, controls));
    }

    static JPanel createInterface(GameTablePanel table, GameControls controls)
    {
        JPanel root = new JPanel(new BorderLayout(TableTheme.ROOT_GAP, TableTheme.ROOT_GAP));
        root.setBackground(TableTheme.TABLE_GREEN);
        root.setBorder(BorderFactory.createEmptyBorder(TableTheme.ROOT_PADDING_TOP,
                TableTheme.ROOT_PADDING_SIDE, TableTheme.ROOT_PADDING_BOTTOM,
                TableTheme.ROOT_PADDING_SIDE));
        root.add(createHeader(), BorderLayout.NORTH);
        root.add(table, BorderLayout.CENTER);
        root.add(controls, BorderLayout.SOUTH);
        root.getAccessibleContext().setAccessibleName("PlayCards blackjack table");
        return root;
    }

    private static JPanel createHeader()
    {
        JPanel header = new JPanel(new BorderLayout());
        header.setOpaque(false);

        JLabel title = new JLabel("PLAYCARDS");
        title.setForeground(TableTheme.CREAM);
        title.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.TITLE_SIZE));

        JLabel subtitle = new JLabel("BLACKJACK TABLE");
        subtitle.setForeground(TableTheme.GOLD);
        subtitle.setFont(TableTheme.uiFont(Font.BOLD, TableTheme.SUBTITLE_SIZE));
        subtitle.setHorizontalAlignment(SwingConstants.RIGHT);

        header.add(title, BorderLayout.WEST);
        header.add(subtitle, BorderLayout.EAST);
        return header;
    }

    private void installKeyboardActions()
    {
        installKeyboardActions(getRootPane(), new Runnable()
        {
            @Override
            public void run()
            {
                takeHit();
            }
        }, new Runnable()
        {
            @Override
            public void run()
            {
                takeStay();
            }
        }, new Runnable()
        {
            @Override
            public void run()
            {
                startNextHand();
            }
        });
    }

    static void installKeyboardActions(JRootPane rootPane, Runnable hit, Runnable stay, Runnable nextHand)
    {
        InputMap inputMap = rootPane.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actionMap = rootPane.getActionMap();
        bindKey(inputMap, actionMap, KeyEvent.VK_H, "hit", hit);
        bindKey(inputMap, actionMap, KeyEvent.VK_S, "stay", stay);
        bindKey(inputMap, actionMap, KeyEvent.VK_N, "next-hand", nextHand);
    }

    private static void bindKey(InputMap inputMap, ActionMap actionMap, int keyCode,
            String actionKey, final Runnable action)
    {
        inputMap.put(KeyStroke.getKeyStroke(keyCode, 0), actionKey);
        actionMap.put(actionKey, new AbstractAction()
        {
            @Override
            public void actionPerformed(ActionEvent event)
            {
                action.run();
            }
        });
    }

    private void takeHit()
    {
        GameSnapshot beforeHit = controller.getSnapshot();
        if (!animationRunning && beforeHit.canHit())
        {
            GameSnapshot afterHit = controller.hit();
            beginAnimation(afterHit, "Dealing your card...");
            table.animateHit(beforeHit, afterHit, new Runnable()
            {
                @Override
                public void run()
                {
                    finishAnimation();
                }
            });
        }
    }

    private void takeStay()
    {
        GameSnapshot beforeStay = controller.getSnapshot();
        if (!animationRunning && beforeStay.canStay())
        {
            GameSnapshot afterStay = controller.stay();
            beginAnimation(afterStay, "Dealer is dealing...");
            table.animateDealerTurn(beforeStay, afterStay, new Runnable()
            {
                @Override
                public void run()
                {
                    finishAnimation();
                }
            });
        }
    }

    private void startNextHand()
    {
        GameSnapshot snapshot = controller.getSnapshot();
        if (!animationRunning && snapshot.canStartNextHand())
        {
            animateOpeningHand(controller.startNextHand(), false);
        }
    }

    private void startNewGame()
    {
        if (!animationRunning)
        {
            String playerName = PlayerNameDialog.requestName(this);
            animateOpeningHand(controller.startNewGame(playerName), true);
        }
    }

    private void animateOpeningHand(GameSnapshot snapshot, boolean showShuffle)
    {
        beginAnimation(snapshot, showShuffle ? "Shuffling and dealing..." : "Dealing the next hand...");
        table.animateOpeningHand(snapshot, showShuffle, new Runnable()
        {
            @Override
            public void run()
            {
                finishAnimation();
            }
        });
    }

    private void beginAnimation(GameSnapshot snapshot, String statusMessage)
    {
        animationRunning = true;
        controls.setAnimationLocked(true);
        controls.render(snapshot, statusMessage);
    }

    private void finishAnimation()
    {
        animationRunning = false;
        controls.setAnimationLocked(false);
        refresh();
    }

    private void refresh()
    {
        GameSnapshot snapshot = controller.getSnapshot();
        table.render(snapshot);
        controls.render(snapshot, GamePresentation.statusMessage(snapshot));
    }
}
