package playcards.holdem;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

import playcards.Card;

/**
 * A single-hand draw pile for Texas Hold'em. Unlike the Blackjack
 * {@link playcards.Deck}, a fresh instance is built for every hand and is
 * shuffled with the game's seeded generator so whole games are reproducible.
 */
final class HoldemDeck
{
    private final List<Card> cards = new ArrayList<Card>();

    HoldemDeck(Random rng)
    {
        for (Card.Suit suit : Card.Suit.values())
        {
            for (Card.Rank rank : Card.Rank.values())
                cards.add(new Card(rank, suit));
        }
        Collections.shuffle(cards, rng);
    }

    Card dealCard()
    {
        if (cards.isEmpty())
            throw new IllegalStateException("Deck exhausted");
        return cards.remove(cards.size() - 1);
    }
}
