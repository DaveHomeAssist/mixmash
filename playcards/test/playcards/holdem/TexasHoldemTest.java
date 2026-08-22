package playcards.holdem;

import java.util.ArrayList;
import java.util.List;

import playcards.Card;

/**
 * Dependency-free test executable for the Hold'em simulation, run by
 * {@code ant test} alongside the Blackjack suites. Exits non-zero on the
 * first failure.
 *
 * Covers the evaluator (royal/straight flush, wheel, the
 * flush+straight-but-not-straight-flush trap, two trips = full house,
 * kickers, quads, split ties) and the engine (chip conservation across full
 * games, pots fully distributed, games terminate, heads-up blinds).
 */
public final class TexasHoldemTest
{
    private static int passed = 0;

    public static void main(String[] args)
    {
        evaluatorTests();
        engineTests();
        System.out.println("\nTexasHoldemTest: all " + passed + " assertions passed");
    }

    // ------------------------------------------------------------ evaluator

    private static void evaluatorTests()
    {
        System.out.println("-- HandEvaluator --");

        // Royal flush recognized and named.
        long royal = score("As Ks Qs Js Ts 2h 3d");
        check(HandEvaluator.category(royal) == 8, "royal flush is category 8");
        check(HandEvaluator.handName(royal).equals("Royal Flush"), "royal flush named");

        // Straight flush beats quads.
        long straightFlush = score("9c 8c 7c 6c 5c Ah Ad");
        long quads = score("Ah Ad Ac As Kh 2d 3c");
        check(HandEvaluator.category(straightFlush) == 8, "straight flush is category 8");
        check(straightFlush > quads, "straight flush beats four of a kind");

        // THE TRAP: 7 cards holding a heart flush AND a mixed-suit wheel.
        // A naive isFlush && isStraight scores this straight flush. It is a flush.
        long trap = score("2h 4h 9h Kh Ah 3s 5d");
        check(HandEvaluator.category(trap) == 5,
                "flush + offsuit straight in 7 cards is a FLUSH, not a straight flush");

        // Wheel recognized, and it is the LOWEST straight.
        long wheel = score("Ah 2s 3d 4c 5h 9s Jd");
        long sixHigh = score("2h 3s 4d 5c 6h 9s Jd");
        check(HandEvaluator.category(wheel) == 4, "wheel A-2-3-4-5 is a straight");
        check(sixHigh > wheel, "6-high straight beats the wheel");

        // Two trips in 7 cards = full house, from the higher trips.
        long twoTrips = score("8h 8d 8c 5h 5d 5s Kh");
        check(HandEvaluator.category(twoTrips) == 6, "two trips make a full house");
        check(((twoTrips >> 16) & 0xF) == 8, "full house is 8s full, not 5s full");

        // Kickers decide within a category.
        long acesKingKicker = score("Ah Ad Kc 7s 4d 3c 2h");
        long acesQueenKicker = score("Ah Ad Qc 7s 4d 3c 2h");
        long kings = score("Kh Kd Ac 7s 4d 3c 2h");
        check(acesKingKicker > acesQueenKicker, "same pair: king kicker beats queen kicker");
        check(acesKingKicker > kings, "pair of aces beats pair of kings");

        // Higher two pair wins; the third pair's rank must not leak in.
        long acesEights = score("Ah Ad 8c 8s 4d 3c 2h");
        long kingsQueens = score("Kh Kd Qc Qs Jd 3c 2h");
        check(acesEights > kingsQueens, "aces-up beats kings-up");

        // Identical best-5 from different hole cards -> exact tie (split pot path).
        long tie1 = score("2h 3d Ah Kh Qh Jh Th");   // board plays: royal
        long tie2 = score("9c 9d Ah Kh Qh Jh Th");
        check(tie1 == tie2, "board-plays hands tie exactly");

        // Straight hidden across 7 cards with pairs in the way.
        long buried = score("6h 6d 7c 8s 9d Th Jd");
        check(HandEvaluator.category(buried) == 4, "straight found among paired 7 cards");
    }

    /** Parses "As Kh Td ..." into cards and returns the best-of-7 (or 5/6) score. */
    private static long score(String spec)
    {
        List<Card> cards = new ArrayList<Card>();
        for (String token : spec.trim().split("\\s+"))
            cards.add(parse(token));
        return HandEvaluator.bestScore(cards);
    }

    private static Card parse(String token)
    {
        int value;
        char rankChar = Character.toUpperCase(token.charAt(0));
        switch (rankChar)
        {
            case 'T':
                value = 10;
                break;
            case 'J':
                value = 11;
                break;
            case 'Q':
                value = 12;
                break;
            case 'K':
                value = 13;
                break;
            case 'A':
                value = 14;
                break;
            default:
                value = rankChar - '0';
                break;
        }
        Card.Suit suit;
        switch (Character.toLowerCase(token.charAt(1)))
        {
            case 'h':
                suit = Card.Suit.HEARTS;
                break;
            case 'd':
                suit = Card.Suit.DIAMONDS;
                break;
            case 'c':
                suit = Card.Suit.CLUBS;
                break;
            case 's':
                suit = Card.Suit.SPADES;
                break;
            default:
                throw new IllegalArgumentException("bad card: " + token);
        }
        return new Card(value, suit);
    }

    // --------------------------------------------------------------- engine

    private static void engineTests()
    {
        System.out.println("\n-- Game engine (20 seeded full games) --");
        for (long seed = 1; seed <= 20; seed++)
        {
            TexasHoldemGame game = new TexasHoldemGame(6, seed, false);
            int expected = game.totalChips();
            int hands = 0;
            while (!game.isGameOver() && hands < TexasHoldemGame.MAX_HANDS)
            {
                game.playHand();
                hands++;
                int total = game.totalChips();
                if (total != expected)
                {
                    fail("seed " + seed + " hand " + hands
                            + ": chips " + total + " != " + expected);
                }
                if (game.getPot() != 0)
                {
                    fail("seed " + seed + " hand " + hands
                            + ": pot not fully distributed ($" + game.getPot() + ")");
                }
            }
            if (game.isGameOver())
            {
                boolean oneHasAll = false;
                for (HoldemPlayer p : game.getPlayers())
                {
                    if (p.getChips() == expected)
                        oneHasAll = true;
                }
                if (!oneHasAll)
                    fail("seed " + seed + ": game over but no player holds all chips");
            }
            else
            {
                fail("seed " + seed + ": did not terminate within "
                        + TexasHoldemGame.MAX_HANDS + " hands");
            }
            if (hands < 4)
                fail("seed " + seed + ": ended suspiciously fast (" + hands + " hands)");
        }
        check(true, "20/20 games conserved chips every hand and distributed every pot");
        check(true, "20/20 games terminated with a single winner holding all $6000");

        // Heads-up path (dealer = small blind) also conserves chips.
        TexasHoldemGame headsUp = new TexasHoldemGame(2, 42, false);
        int expected = headsUp.totalChips();
        int hands = 0;
        while (!headsUp.isGameOver() && hands < TexasHoldemGame.MAX_HANDS)
        {
            headsUp.playHand();
            hands++;
            if (headsUp.totalChips() != expected)
                fail("heads-up hand " + hands + ": chips not conserved");
        }
        check(headsUp.isGameOver(), "heads-up game terminates (" + hands + " hands)");
    }

    // ------------------------------------------------------------ plumbing

    private static void check(boolean condition, String label)
    {
        if (!condition)
            fail(label);
        passed++;
        System.out.println("   PASS: " + label);
    }

    private static void fail(String label)
    {
        System.err.println("   FAIL: " + label);
        System.exit(1);
    }
}
