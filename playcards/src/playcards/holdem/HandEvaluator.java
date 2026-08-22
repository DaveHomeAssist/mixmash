package playcards.holdem;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import playcards.Card;

/**
 * Scores hands as a comparable long: category in the high bits, then the five
 * tiebreak ranks (4 bits each) in significance order. Bigger long = better hand.
 * Categories: 8 straight flush (royal = ace-high SF), 7 quads, 6 full house,
 * 5 flush, 4 straight, 3 trips, 2 two pair, 1 pair, 0 high card.
 */
final class HandEvaluator
{
    private HandEvaluator()
    {
    }

    /** Best 5-card score from any 5+ cards (7 at showdown). */
    static long bestScore(List<Card> cards)
    {
        int n = cards.size();
        if (n < 5)
            throw new IllegalArgumentException("Need at least 5 cards");

        long best = Long.MIN_VALUE;
        for (int a = 0; a < n - 4; a++)
        {
            for (int b = a + 1; b < n - 3; b++)
            {
                for (int c = b + 1; c < n - 2; c++)
                {
                    for (int d = c + 1; d < n - 1; d++)
                    {
                        for (int e = d + 1; e < n; e++)
                        {
                            long s = score5(cards.get(a), cards.get(b),
                                    cards.get(c), cards.get(d), cards.get(e));
                            if (s > best)
                                best = s;
                        }
                    }
                }
            }
        }
        return best;
    }

    static int category(long score)
    {
        return (int) (score >> 20);
    }

    static String handName(long score)
    {
        int category = category(score);
        int high = (int) ((score >> 16) & 0xF);
        switch (category)
        {
            case 8:
                return high == 14 ? "Royal Flush" : "Straight Flush";
            case 7:
                return "Four of a Kind";
            case 6:
                return "Full House";
            case 5:
                return "Flush";
            case 4:
                return "Straight";
            case 3:
                return "Three of a Kind";
            case 2:
                return "Two Pair";
            case 1:
                return "One Pair";
            default:
                return "High Card";
        }
    }

    private static long score5(Card c1, Card c2, Card c3, Card c4, Card c5)
    {
        int[] ranks = { c1.getValue(), c2.getValue(), c3.getValue(),
                        c4.getValue(), c5.getValue() };
        Arrays.sort(ranks);   // ascending

        boolean flush = c1.getSuit() == c2.getSuit()
                && c2.getSuit() == c3.getSuit()
                && c3.getSuit() == c4.getSuit()
                && c4.getSuit() == c5.getSuit();

        boolean distinct = ranks[0] != ranks[1] && ranks[1] != ranks[2]
                && ranks[2] != ranks[3] && ranks[3] != ranks[4];
        int straightHigh = 0;
        if (distinct)
        {
            if (ranks[4] - ranks[0] == 4)
                straightHigh = ranks[4];                       // normal run
            else if (ranks[4] == 14 && ranks[3] == 5)
                straightHigh = 5;                              // wheel A-2-3-4-5
        }

        // Group ranks by multiplicity, most significant first.
        Map<Integer, Integer> counts = new HashMap<Integer, Integer>();
        for (int r : ranks)
            counts.merge(r, 1, Integer::sum);
        final List<int[]> groups = new ArrayList<int[]>();     // [count, rank]
        counts.forEach((r, c) -> groups.add(new int[] { c, r }));
        groups.sort(new Comparator<int[]>()
        {
            @Override
            public int compare(int[] x, int[] y)
            {
                return x[0] != y[0] ? y[0] - x[0] : y[1] - x[1];
            }
        });

        int category;
        int[] tiebreak;
        if (straightHigh > 0 && flush)
        {
            category = 8;
            tiebreak = new int[] { straightHigh };
        }
        else if (groups.get(0)[0] == 4)
        {
            category = 7;
            tiebreak = new int[] { groups.get(0)[1], groups.get(1)[1] };
        }
        else if (groups.get(0)[0] == 3 && groups.get(1)[0] == 2)
        {
            category = 6;
            tiebreak = new int[] { groups.get(0)[1], groups.get(1)[1] };
        }
        else if (flush)
        {
            category = 5;
            tiebreak = descending(ranks);
        }
        else if (straightHigh > 0)
        {
            category = 4;
            tiebreak = new int[] { straightHigh };
        }
        else if (groups.get(0)[0] == 3)
        {
            category = 3;
            tiebreak = new int[] { groups.get(0)[1], groups.get(1)[1],
                    groups.get(2)[1] };
        }
        else if (groups.get(0)[0] == 2 && groups.get(1)[0] == 2)
        {
            category = 2;
            tiebreak = new int[] { groups.get(0)[1], groups.get(1)[1],
                    groups.get(2)[1] };
        }
        else if (groups.get(0)[0] == 2)
        {
            category = 1;
            tiebreak = new int[] { groups.get(0)[1], groups.get(1)[1],
                    groups.get(2)[1], groups.get(3)[1] };
        }
        else
        {
            category = 0;
            tiebreak = descending(ranks);
        }

        long score = (long) category << 20;
        int shift = 16;
        for (int r : tiebreak)
        {
            score |= (long) r << shift;
            shift -= 4;
        }
        return score;
    }

    private static int[] descending(int[] ascending)
    {
        int[] d = new int[ascending.length];
        for (int i = 0; i < ascending.length; i++)
            d[i] = ascending[ascending.length - 1 - i];
        return d;
    }
}
