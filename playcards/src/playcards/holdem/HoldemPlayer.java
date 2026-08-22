package playcards.holdem;

import java.util.ArrayList;
import java.util.List;

import playcards.Card;

/**
 * One seat at the Hold'em table: a chip stack, two hole cards, and the
 * per-street and per-hand amounts committed to the pot. Distinct from the
 * Blackjack {@link playcards.Player}, which owns Blackjack hand state.
 */
final class HoldemPlayer
{
    private final String name;
    private int chips;
    private final List<Card> hand = new ArrayList<Card>();
    private boolean inHand;        // dealt into the current hand
    private boolean folded;
    private int streetBet;         // committed on the current street
    private int contribution;      // committed across the whole hand

    HoldemPlayer(String name, int chips)
    {
        this.name = name;
        this.chips = chips;
    }

    /**
     * Moves up to {@code amount} from stack to the table; returns the ACTUAL
     * amount, capped at the stack so all-ins never overdraw.
     */
    int post(int amount)
    {
        int actual = Math.min(Math.max(amount, 0), chips);
        chips -= actual;
        streetBet += actual;
        contribution += actual;
        return actual;
    }

    void refund(int amount)
    {
        chips += amount;
        contribution -= amount;
    }

    void addCard(Card card)
    {
        hand.add(card);
    }

    void addChips(int amount)
    {
        chips += amount;
    }

    void fold()
    {
        folded = true;
    }

    void resetStreetBet()
    {
        streetBet = 0;
    }

    void resetForHand(boolean dealtIn)
    {
        hand.clear();
        folded = false;
        streetBet = 0;
        contribution = 0;
        inHand = dealtIn;
    }

    boolean canAct()
    {
        return inHand && !folded && chips > 0;
    }

    String holeString()
    {
        return TexasHoldemGame.cardsToString(hand);
    }

    String getName()
    {
        return name;
    }

    int getChips()
    {
        return chips;
    }

    List<Card> getHand()
    {
        return hand;
    }

    boolean isFolded()
    {
        return folded;
    }

    boolean isInHand()
    {
        return inHand;
    }

    int getStreetBet()
    {
        return streetBet;
    }

    int getContribution()
    {
        return contribution;
    }
}
