package playcards;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * The cards and blackjack score for one player. PlayCards retains its
 * existing five-card hand rule, so a sixth card is rejected explicitly.
 */
public final class Hand
{
    public static final int MAX_CARDS = 5;

    private final List<Card> cards = new ArrayList<Card>(MAX_CARDS);

    public void addCard(Card card)
    {
        if (cards.size() == MAX_CARDS)
            throw new IllegalStateException("A blackjack hand cannot hold more than " + MAX_CARDS + " cards");
        cards.add(Objects.requireNonNull(card, "Card is required"));
    }

    public void clear()
    {
        cards.clear();
    }

    public int getCardCount()
    {
        return cards.size();
    }

    public boolean isAtLimit()
    {
        return cards.size() == MAX_CARDS;
    }

    public List<Card> getCards()
    {
        return Collections.unmodifiableList(new ArrayList<Card>(cards));
    }

    public int getValue()
    {
        int value = 0;
        int aces = 0;

        for (Card card : cards)
        {
            value += card.getRank().getBlackjackValue();
            if (card.getRank().isAce())
                aces++;
        }

        while (aces > 0 && value + 10 <= 21)
        {
            value += 10;
            aces--;
        }
        return value;
    }

    public boolean hasBlackjack()
    {
        return cards.size() == 2 && getValue() == 21;
    }

    public boolean isBust()
    {
        return getValue() > 21;
    }
}
