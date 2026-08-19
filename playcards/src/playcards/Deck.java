package playcards;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Objects;

/**
 * A standard deck of cards with an explicit draw pile.
 */
public final class Deck
{
    public static final int SIZE = Card.Rank.values().length * Card.Suit.values().length;

    private final List<Card> cards;
    private final Deque<Card> drawPile;
    private final boolean reshuffleWhenExhausted;

    public Deck()
    {
        cards = new ArrayList<Card>(SIZE);
        for (Card.Suit suit : Card.Suit.values())
        {
            for (Card.Rank rank : Card.Rank.values())
                cards.add(new Card(rank, suit));
        }

        drawPile = new ArrayDeque<Card>(SIZE);
        reshuffleWhenExhausted = true;
        resetDrawPile();
    }

    /**
     * Package-private deterministic deck for game tests.
     */
    Deck(Card... scriptedCards)
    {
        if (scriptedCards == null || scriptedCards.length == 0)
            throw new IllegalArgumentException("A scripted deck requires at least one card");

        cards = new ArrayList<Card>(scriptedCards.length);
        for (Card card : Arrays.asList(scriptedCards))
            cards.add(Objects.requireNonNull(card, "Scripted cards cannot contain null"));

        drawPile = new ArrayDeque<Card>(cards.size());
        reshuffleWhenExhausted = false;
        resetDrawPile();
    }

    /**
     * Shuffles every card and resets the draw pile to the full deck.
     */
    public void shuffle()
    {
        Collections.shuffle(cards);
        resetDrawPile();
    }

    /**
     * Draws the next card. A standard deck reshuffles when exhausted; a
     * scripted test deck instead reports exhaustion so tests remain deterministic.
     */
    public Card draw()
    {
        if (drawPile.isEmpty())
        {
            if (!reshuffleWhenExhausted)
                throw new IllegalStateException("Scripted deck is exhausted");
            shuffle();
        }

        return drawPile.removeFirst();
    }

    /**
     * Retained for callers of the original project API.
     */
    public Card dealACard()
    {
        return draw();
    }

    public int getRemainingCardCount()
    {
        return drawPile.size();
    }

    /**
     * Returns a card by its documented one-based deck position.
     */
    public Card pickACard(int whichCard)
    {
        if (whichCard < 1 || whichCard > cards.size())
            throw new IllegalArgumentException("Card number must be between 1 and " + cards.size());
        return cards.get(whichCard - 1);
    }

    /**
     * Retained for the original console exercise API.
     */
    public void showACard(int whichCard)
    {
        System.out.println(pickACard(whichCard));
    }

    @Override
    public String toString()
    {
        StringBuilder result = new StringBuilder();
        for (int index = 0; index < cards.size(); index++)
        {
            if (index % 4 == 0)
                result.append('\n');
            result.append('\t').append(cards.get(index));
        }
        return result.append('\n').toString();
    }

    private void resetDrawPile()
    {
        drawPile.clear();
        drawPile.addAll(cards);
    }
}
