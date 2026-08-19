/** CSC-122-01  SP 2019  Blackjack
Due Date: 4/11/2019
Date Submitted: 4/11/2019
Programmed by: D. Robertson
Description: Main class for Blackjack Game
*/
package playcards;

import java.awt.GraphicsEnvironment;
import java.util.Arrays;
import javax.swing.SwingUtilities;

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
        if (!GraphicsEnvironment.isHeadless() && !Arrays.asList(args).contains("--console"))
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
