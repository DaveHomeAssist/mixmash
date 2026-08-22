/** CSC-122-01  SP 2019  Blackjack
Due Date: 4/11/2019
Date Submitted: 4/11/2019
Programmed by: D. Robertson
Description: Main class for Blackjack Game
*/
package playcards;

import java.awt.GraphicsEnvironment;
import java.util.Arrays;
import java.util.List;
import javax.swing.SwingUtilities;

import playcards.holdem.TexasHoldemGame;

/**
 *
 * @author dRobertson
 */
public class PlayCards {

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args)
    {
        List<String> arguments = Arrays.asList(args);
        int holdemIndex = arguments.indexOf("--holdem");
        if (holdemIndex >= 0)
        {
            long seed = holdemIndex + 1 < args.length
                    ? Long.parseLong(args[holdemIndex + 1])
                    : System.currentTimeMillis();
            new TexasHoldemGame(6, seed, true).startGame();
            return;
        }

        if (!GraphicsEnvironment.isHeadless() && !arguments.contains("--console"))
        {
            SwingUtilities.invokeLater(new Runnable()
            {
                @Override
                public void run()
                {
                    new PlayCardsFrame().setVisible(true);
                }
            });
            return;
        }

        new Blackjack().play();
    }

}
