package playcards;

import java.util.Objects;

/**
 * An immutable playing card.
 */
public final class Card
{
    public enum Color
    {
        RED,
        BLACK
    }

    public enum Suit
    {
        DIAMONDS('\u2666', Color.RED),
        HEARTS('\u2665', Color.RED),
        SPADES('\u2660', Color.BLACK),
        CLUBS('\u2663', Color.BLACK);

        private final char symbol;
        private final Color color;

        Suit(char symbol, Color color)
        {
            this.symbol = symbol;
            this.color = color;
        }

        public char getSymbol()
        {
            return symbol;
        }

        public Color getColor()
        {
            return color;
        }
    }

    public enum Rank
    {
        TWO(2, "2", 2),
        THREE(3, "3", 3),
        FOUR(4, "4", 4),
        FIVE(5, "5", 5),
        SIX(6, "6", 6),
        SEVEN(7, "7", 7),
        EIGHT(8, "8", 8),
        NINE(9, "9", 9),
        TEN(10, "10", 10),
        JACK(11, "J", 10),
        QUEEN(12, "Q", 10),
        KING(13, "K", 10),
        ACE(14, "A", 1);

        private final int deckValue;
        private final String displayValue;
        private final int blackjackValue;

        Rank(int deckValue, String displayValue, int blackjackValue)
        {
            this.deckValue = deckValue;
            this.displayValue = displayValue;
            this.blackjackValue = blackjackValue;
        }

        public int getDeckValue()
        {
            return deckValue;
        }

        public String getDisplayValue()
        {
            return displayValue;
        }

        public int getBlackjackValue()
        {
            return blackjackValue;
        }

        public boolean isAce()
        {
            return this == ACE;
        }

        public static Rank fromDeckValue(int value)
        {
            for (Rank rank : values())
            {
                if (rank.deckValue == value)
                    return rank;
            }
            throw new IllegalArgumentException("Card value must be between 2 and 14");
        }
    }

    private final Rank rank;
    private final Suit suit;

    /**
     * Creates the legacy default card: the king of hearts.
     */
    public Card()
    {
        this(Rank.KING, Suit.HEARTS);
    }

    public Card(int value, Suit suit)
    {
        this(Rank.fromDeckValue(value), suit);
    }

    public Card(Rank rank, Suit suit)
    {
        this.rank = Objects.requireNonNull(rank, "Rank is required");
        this.suit = Objects.requireNonNull(suit, "Suit is required");
    }

    /**
     * Returns the original 2 through 14 deck value for compatibility with
     * the original project API.
     */
    public int getValue()
    {
        return rank.getDeckValue();
    }

    public Rank getRank()
    {
        return rank;
    }

    public Suit getSuit()
    {
        return suit;
    }

    public Color getColor()
    {
        return suit.getColor();
    }

    @Override
    public String toString()
    {
        return rank.getDisplayValue() + suit.getSymbol();
    }

    @Override
    public boolean equals(Object other)
    {
        if (this == other)
            return true;
        if (!(other instanceof Card))
            return false;

        Card card = (Card) other;
        return rank == card.rank && suit == card.suit;
    }

    @Override
    public int hashCode()
    {
        return Objects.hash(rank, suit);
    }
}
