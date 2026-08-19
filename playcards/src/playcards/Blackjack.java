package playcards;

import java.io.PrintStream;
import java.util.List;
import java.util.Locale;
import java.util.Scanner;

/**
 * Console input/output adapter for the shared BlackjackGame state engine.
 */
public final class Blackjack
{
    private final Scanner input;
    private final PrintStream output;
    private BlackjackGame game;

    public Blackjack()
    {
        this(new Scanner(System.in), System.out);
    }

    Blackjack(Scanner input, PrintStream output)
    {
        if (input == null)
            throw new IllegalArgumentException("Input scanner is required");
        if (output == null)
            throw new IllegalArgumentException("Output stream is required");

        this.input = input;
        this.output = output;
    }

    public void play()
    {
        showWelcome();
        game = new BlackjackGame(readPlayerName());
        GameSnapshot snapshot = game.getSnapshot();

        while (true)
        {
            showOpeningHand(snapshot);
            if (!playCurrentHand())
            {
                output.println("Input ended. Game over.");
                return;
            }

            snapshot = game.getSnapshot();
            showHandResults(snapshot);
            if (snapshot.isGameOver())
            {
                showGameWinner(snapshot);
                return;
            }

            snapshot = game.startHand();
        }
    }

    static char parseDecision(String response)
    {
        if (response == null)
            return '\0';

        String normalized = response.trim().toUpperCase(Locale.ROOT);
        if (normalized.length() != 1)
            return '\0';

        char decision = normalized.charAt(0);
        return decision == 'H' || decision == 'S' ? decision : '\0';
    }

    private String readPlayerName()
    {
        output.println("Please enter your name -> ");
        return input.hasNextLine() ? input.nextLine() : "Player";
    }

    private boolean playCurrentHand()
    {
        while (!game.getSnapshot().isHandComplete())
        {
            output.println("\n Do you want another card?\n"
                    + "\n 'H' to Hit\n"
                    + "\n 'S' to Stay\n");

            if (!input.hasNextLine())
                return false;

            char decision = parseDecision(input.nextLine());
            if (decision == 'H')
                showHit();
            else if (decision == 'S')
                showStay();
            else
                output.println("Please enter H or S.");
        }

        return true;
    }

    private void showOpeningHand(GameSnapshot snapshot)
    {
        output.println(snapshot.getHumanName() + "'s Cards:");
        showCards(snapshot.getHumanCards(), 0);
        output.println(snapshot.getHumanValue());

        output.println("Dealer showing:");
        showCards(snapshot.getDealerCards(), 1);
        output.println("\nWell, " + snapshot.getHumanName() + " choose wisely,");
    }

    private void showHit()
    {
        GameSnapshot beforeHit = game.getSnapshot();
        GameSnapshot afterHit = game.hit();

        if (afterHit.getHumanCards().size() > beforeHit.getHumanCards().size())
        {
            output.println("New Value: " + afterHit.getHumanValue());
            showCards(afterHit.getHumanCards(), 0);
        }
    }

    private void showStay()
    {
        output.println("Now the Computer will Go:\n");
        GameSnapshot beforeStay = game.getSnapshot();
        GameSnapshot afterStay = game.stay();
        showCards(afterStay.getDealerCards(), beforeStay.getDealerCards().size());
    }

    private void showHandResults(GameSnapshot snapshot)
    {
        output.println("\n ------------------------ \n");
        output.println("Player: " + snapshot.getHumanName() + "'s Hand:\n");
        showCards(snapshot.getHumanCards(), 0);
        output.println("Value: " + snapshot.getHumanValue());

        output.println("Dealer's Hand:\n");
        showCards(snapshot.getDealerCards(), 0);
        output.println("Value: " + snapshot.getDealerValue());
        output.println(outcomeMessage(snapshot));
        output.println("******CURRENT SCORE******\n");
        output.println(snapshot.getHumanName() + ": " + snapshot.getHumanPoints() + "        "
                + "Dealer: " + snapshot.getDealerPoints());
    }

    private String outcomeMessage(GameSnapshot snapshot)
    {
        switch (snapshot.getOutcome())
        {
            case DEALER_BLACKJACK:
                return "Dealer Blackjack! The house wins. PTS -1";
            case HUMAN_BLACKJACK:
                return snapshot.getHumanName() + " has Blackjack! PTS +1";
            case HUMAN_BUST:
                return "Human bust. The house wins. PTS -1";
            case DEALER_BUST:
                return "Dealer bust! " + snapshot.getHumanName() + " wins. PTS +1";
            case DEALER_WIN:
                return "Dealer has better cards. Dealer wins. PTS -1";
            case HUMAN_WIN:
                return snapshot.getHumanName() + " has better cards. Player wins. PTS +1";
            case PUSH:
                return "You tied. It's a push.";
            default:
                throw new IllegalStateException("Unknown hand outcome: " + snapshot.getOutcome());
        }
    }

    private void showGameWinner(GameSnapshot snapshot)
    {
        if (snapshot.getHumanPoints() > snapshot.getDealerPoints())
            output.println("PLAYER WINS\n\nThanks for playing!");
        else
            output.println("DEALER WINS\n\nThanks for playing!");
    }

    private void showWelcome()
    {
        output.println("WELCOME to the fabulous game of blackjack... "
                + "I am sure I can beat you!\n"
                + "We will each start with 5 chips.\n"
                + "If you win a hand, you get one of my chips.\n"
                + "If you lose a hand, I get one of your chips.\n"
                + "Whoever runs out of chips first loses.\n");
    }

    private void showCards(List<Card> cards, int startIndex)
    {
        for (int index = startIndex; index < cards.size(); index++)
            output.println(cards.get(index));
    }
}
