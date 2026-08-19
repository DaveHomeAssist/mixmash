package playcards;

import java.util.List;
import java.util.Objects;

/**
 * A blackjack participant and their chip balance.
 */
public final class Player
{
    public static final int INITIAL_CHIPS = 5;

    private final Hand hand = new Hand();
    private final String name;
    private int points = INITIAL_CHIPS;

    public Player()
    {
        this("Player");
    }

    public Player(String name)
    {
        this.name = Objects.requireNonNull(name, "Player name is required");
    }

    public void acceptACard(Card card)
    {
        hand.addCard(card);
    }

    public int handValue()
    {
        return hand.getValue();
    }

    public boolean hasBlackjack()
    {
        return hand.hasBlackjack();
    }

    public boolean checkBust()
    {
        return hand.isBust();
    }

    public int getCardCount()
    {
        return hand.getCardCount();
    }

    public List<Card> getCards()
    {
        return hand.getCards();
    }

    public String getName()
    {
        return name;
    }

    public int getPoints()
    {
        return points;
    }

    public void clearHand()
    {
        hand.clear();
    }

    void transferOneChipTo(Player receiver)
    {
        Objects.requireNonNull(receiver, "Chip receiver is required");
        if (points < 1)
            throw new IllegalStateException(name + " has no chips left to transfer");

        points--;
        receiver.points++;
    }
}
