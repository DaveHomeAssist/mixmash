package playcards;

/** Coordinates UI actions with the shared BlackjackGame state engine. */
final class BlackjackController
{
    private BlackjackGame game;

    BlackjackController(String humanName)
    {
        game = new BlackjackGame(humanName);
    }

    GameSnapshot getSnapshot()
    {
        return game.getSnapshot();
    }

    GameSnapshot hit()
    {
        return game.hit();
    }

    GameSnapshot stay()
    {
        return game.stay();
    }

    GameSnapshot startNextHand()
    {
        return game.startHand();
    }

    GameSnapshot startNewGame(String humanName)
    {
        game = new BlackjackGame(humanName);
        return game.getSnapshot();
    }
}
