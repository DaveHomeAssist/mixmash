package playcards.holdem;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.TreeSet;

import playcards.Card;

/**
 * A console Texas Hold'em simulation: 2-10 heuristic AI seats play fixed
 * $5/$10 blinds until one player holds every chip. Shares the immutable
 * {@link playcards.Card} with the Blackjack table but owns its own table
 * state, betting engine, and {@link HandEvaluator}.
 *
 * Engine guarantees, enforced by {@code TexasHoldemTest}:
 * - a fresh 52-card deck is built and shuffled every hand;
 * - the table current bet is real state with a per-street reset, blinds act
 *   pre-flop (the big blind keeps his option), a full raise reopens action,
 *   and the hand ends as soon as one unfolded player remains;
 * - chips are conserved: every post is capped at the stack before it joins
 *   the pot, uncalled bets are refunded, and side pots are layered from
 *   per-hand contributions so all-ins settle correctly;
 * - ties split the pot, with odd chips going to the earliest eligible seat.
 *
 * Launch via {@code PlayCards --holdem [seed]} or run this class directly.
 */
public final class TexasHoldemGame
{
    static final int STARTING_CHIPS = 1000;
    static final int SMALL_BLIND = 5;
    static final int BIG_BLIND = 10;
    public static final int MAX_HANDS = 100_000; // safety valve, never hit in practice

    private final List<HoldemPlayer> players = new ArrayList<HoldemPlayer>();
    private final Random rng;
    private final boolean verbose;
    private final List<Card> communityCards = new ArrayList<Card>();
    private HoldemDeck deck;
    private int dealerPosition = 0;
    private int pot;
    private int currentBet;   // amount each player must have in on THIS street
    private int minRaise;     // size of the last bet/raise on this street
    private int handsPlayed = 0;

    public TexasHoldemGame(int numPlayers, long seed, boolean verbose)
    {
        if (numPlayers < 2 || numPlayers > 10)
            throw new IllegalArgumentException("2-10 players required");

        this.rng = new Random(seed);
        this.verbose = verbose;
        for (int i = 0; i < numPlayers; i++)
            players.add(new HoldemPlayer("Player " + (i + 1), STARTING_CHIPS));
    }

    // ------------------------------------------------------------------ game

    public void startGame()
    {
        log("=== Texas Hold'em (" + players.size() + " players, $"
                + SMALL_BLIND + "/$" + BIG_BLIND + " blinds) ===");
        while (!isGameOver() && handsPlayed < MAX_HANDS)
        {
            playHand();
            rotateDealer();
        }
        announceWinner();
    }

    public boolean isGameOver()
    {
        return fundedCount() <= 1;
    }

    public int totalChips()
    {
        int total = 0;
        for (HoldemPlayer p : players)
            total += p.getChips();
        return total;
    }

    public int getPot()
    {
        return pot;
    }

    public int handsPlayed()
    {
        return handsPlayed;
    }

    List<HoldemPlayer> getPlayers()
    {
        return players;
    }

    public void playHand()
    {
        handsPlayed++;
        log("\n--- Hand " + handsPlayed + " (dealer: "
                + players.get(dealerPosition).getName() + ") ---");
        resetHand();
        dealHoleCards();

        postBlindsAndPreFlop();
        if (settleIfHandOver())
            return;

        dealCommunity(3, "Flop");
        bettingStreet(firstActiveAfter(dealerPosition));
        if (settleIfHandOver())
            return;

        dealCommunity(1, "Turn");
        bettingStreet(firstActiveAfter(dealerPosition));
        if (settleIfHandOver())
            return;

        dealCommunity(1, "River");
        bettingStreet(firstActiveAfter(dealerPosition));
        if (settleIfHandOver())
            return;

        showdown();
        displayChipCounts();
    }

    private void resetHand()
    {
        deck = new HoldemDeck(rng);    // fresh 52-card deck every hand
        communityCards.clear();
        pot = 0;
        currentBet = 0;
        minRaise = BIG_BLIND;
        for (HoldemPlayer p : players)
            p.resetForHand(p.getChips() > 0); // busted players are not dealt in
    }

    private void dealHoleCards()
    {
        for (int i = 0; i < 2; i++)
        {
            for (HoldemPlayer p : inHandPlayersFrom(nextSeat(dealerPosition)))
                p.addCard(deck.dealCard());
        }
        if (verbose)
        {
            for (HoldemPlayer p : players)
            {
                if (p.isInHand())
                    log(p.getName() + " dealt " + p.holeString());
            }
        }
    }

    private void dealCommunity(int n, String label)
    {
        for (int i = 0; i < n; i++)
            communityCards.add(deck.dealCard());
        log("\n" + label + ": " + cardsToString(communityCards));
        for (HoldemPlayer p : players)
            p.resetStreetBet();        // bets start over on each street
        currentBet = 0;
        minRaise = BIG_BLIND;
    }

    // --------------------------------------------------------------- betting

    private void postBlindsAndPreFlop()
    {
        int sbSeat;
        int bbSeat;
        if (fundedCount() == 2)
        {                              // heads-up: dealer is the small blind
            sbSeat = dealerPosition;
            bbSeat = firstFundedAfter(dealerPosition);
        }
        else
        {
            sbSeat = firstFundedAfter(dealerPosition);
            bbSeat = firstFundedAfter(sbSeat);
        }
        HoldemPlayer sb = players.get(sbSeat);
        HoldemPlayer bb = players.get(bbSeat);
        pot += sb.post(SMALL_BLIND);   // the pot gets the stack-capped amount
        pot += bb.post(BIG_BLIND);
        log(sb.getName() + " posts small blind $" + sb.getStreetBet()
                + ", " + bb.getName() + " posts big blind $" + bb.getStreetBet());
        currentBet = BIG_BLIND;
        minRaise = BIG_BLIND;
        bettingStreet(firstActiveAfter(bbSeat));
    }

    /**
     * One betting street. Terminates when every player who can act has either
     * matched the current bet or folded since the last full raise.
     */
    private void bettingStreet(int firstToAct)
    {
        int toAct = countCanAct();     // everyone gets at least one action
        int seat = firstToAct;
        while (toAct > 0 && unfoldedCount() > 1)
        {
            HoldemPlayer p = players.get(seat);
            if (p.canAct())
            {
                boolean reopened = act(p);
                if (reopened)
                {
                    // a full raise makes everyone else respond again
                    toAct = countCanAct() - (p.canAct() ? 1 : 0);
                }
                else
                {
                    toAct--;
                }
            }
            seat = nextSeat(seat);
        }
    }

    /** Executes one decision for p. Returns true if p made a full raise. */
    private boolean act(HoldemPlayer p)
    {
        int owed = currentBet - p.getStreetBet();
        int decision = decideAction(p, owed);   // 0 fold, 1 check/call, 2 bet/raise

        if (decision == 0 && owed > 0)
        {
            p.fold();
            log(p.getName() + " folds");
            return false;
        }
        if (decision == 2 && p.getChips() > owed)
        {
            int target = (currentBet == 0)
                    ? Math.max(BIG_BLIND, minRaise)     // opening bet
                    : currentBet + minRaise;            // minimum legal raise
            int posted = p.post(target - p.getStreetBet());
            pot += posted;
            if (p.getStreetBet() > currentBet)
            {
                int raiseSize = p.getStreetBet() - currentBet;
                boolean fullRaise = raiseSize >= minRaise;
                if (fullRaise)
                    minRaise = raiseSize;
                currentBet = p.getStreetBet();
                log(p.getName() + (p.getChips() == 0 ? " is all-in, raising to $"
                        : " raises to $") + currentBet);
                return fullRaise;
            }
            // could not exceed the current bet: falls through as a call
        }
        // check / call (also the landing spot for an under-raise all-in)
        if (owed <= 0)
        {
            log(p.getName() + " checks");
        }
        else
        {
            int posted = p.post(owed);              // capped at stack
            pot += posted;
            log(p.getName() + (p.getChips() == 0 && posted < owed
                    ? " calls all-in for $" + posted
                    : " calls $" + posted));
        }
        return false;
    }

    /**
     * Heuristic AI. 0 = fold, 1 = check/call, 2 = bet/raise. Decisions weight
     * real hand strength, and the AI never folds when checking is free.
     */
    private int decideAction(HoldemPlayer p, int owed)
    {
        int strength = handStrength(p);   // 0 (junk) .. 8 (straight flush)
        double r = rng.nextDouble();
        if (owed <= 0)
        {                                                // free to check
            if (strength >= 3 && r < 0.55)
                return 2;
            if (strength >= 1 && r < 0.25)
                return 2;
            if (r < 0.10)
                return 2;                                // occasional bluff
            return 1;
        }
        if (strength >= 4)
            return r < 0.45 ? 2 : 1;                     // strong: raise or call
        if (strength >= 2)
        {                                                // medium
            if (r < 0.15)
                return 2;
            return r < 0.85 ? 1 : 0;
        }
        if (strength == 1)
            return r < 0.55 ? 1 : 0;                     // marginal
        return (owed <= BIG_BLIND && r < 0.35) ? 1 : 0;  // junk: mostly fold
    }

    /** Category of the best hand available now (pre-flop: hole-card heuristic). */
    private int handStrength(HoldemPlayer p)
    {
        if (communityCards.isEmpty())
        {
            List<Card> hole = p.getHand();
            int v1 = hole.get(0).getValue();
            int v2 = hole.get(1).getValue();
            if (v1 == v2)
                return v1 >= 10 ? 4 : 3;                 // pocket pair
            if (v1 >= 11 && v2 >= 11)
                return 2;                                // two broadway cards
            if (v1 >= 12 || v2 >= 12)
                return 1;                                // Q+ high
            return 0;
        }
        List<Card> all = new ArrayList<Card>(p.getHand());
        all.addAll(communityCards);
        return HandEvaluator.category(HandEvaluator.bestScore(all));
    }

    // ------------------------------------------------------------ settlement

    /** If only one unfolded player remains, award the pot and end the hand. */
    private boolean settleIfHandOver()
    {
        if (unfoldedCount() > 1)
            return false;
        refundUncalled();
        for (HoldemPlayer p : players)
        {
            if (p.isInHand() && !p.isFolded())
            {
                p.addChips(pot);
                log("\n" + p.getName() + " wins $" + pot + " (everyone folded)");
                pot = 0;
            }
        }
        displayChipCounts();
        return true;
    }

    /** Returns the uncalled portion of the largest bet to its owner. */
    private void refundUncalled()
    {
        HoldemPlayer max = null;
        int maxContribution = 0;
        int secondContribution = 0;
        for (HoldemPlayer p : players)
        {
            int c = p.getContribution();
            if (c > maxContribution)
            {
                secondContribution = maxContribution;
                maxContribution = c;
                max = p;
            }
            else if (c > secondContribution)
            {
                secondContribution = c;
            }
        }
        if (max != null && maxContribution > secondContribution)
        {
            int refund = maxContribution - secondContribution;
            max.refund(refund);
            pot -= refund;
            log(max.getName() + " takes back uncalled $" + refund);
        }
    }

    /** Showdown with layered side pots built from per-hand contributions. */
    private void showdown()
    {
        refundUncalled();
        log("\n--- Showdown --- board: " + cardsToString(communityCards));

        List<HoldemPlayer> contenders = new ArrayList<HoldemPlayer>();
        for (HoldemPlayer p : players)
        {
            if (p.isInHand() && !p.isFolded())
                contenders.add(p);
        }
        Map<HoldemPlayer, Long> scores = new HashMap<HoldemPlayer, Long>();
        for (HoldemPlayer p : contenders)
        {
            List<Card> all = new ArrayList<Card>(p.getHand());
            all.addAll(communityCards);
            long s = HandEvaluator.bestScore(all);
            scores.put(p, s);
            log(p.getName() + " shows " + p.holeString()
                    + " — " + HandEvaluator.handName(s));
        }

        // Distinct contribution levels among contenders define the pot layers.
        TreeSet<Integer> levels = new TreeSet<Integer>();
        for (HoldemPlayer p : contenders)
        {
            if (p.getContribution() > 0)
                levels.add(p.getContribution());
        }
        int prev = 0;
        int distributed = 0;
        for (int level : levels)
        {
            int layer = 0;
            for (HoldemPlayer p : players)
            {   // folded players' money joins the layer
                layer += Math.min(p.getContribution(), level)
                        - Math.min(p.getContribution(), prev);
            }
            List<HoldemPlayer> eligible = new ArrayList<HoldemPlayer>();
            for (HoldemPlayer p : contenders)
            {
                if (p.getContribution() >= level)
                    eligible.add(p);
            }
            long best = Long.MIN_VALUE;
            for (HoldemPlayer p : eligible)
                best = Math.max(best, scores.get(p));
            List<HoldemPlayer> winners = new ArrayList<HoldemPlayer>();
            for (HoldemPlayer p : eligible)
            {
                if (scores.get(p) == best)
                    winners.add(p);
            }
            int share = layer / winners.size();
            int odd = layer % winners.size();   // odd chips: earliest seats
            for (HoldemPlayer w : winners)
            {
                int amount = share + (odd-- > 0 ? 1 : 0);
                w.addChips(amount);
                distributed += amount;
                log(w.getName() + " wins $" + amount
                        + (levels.size() > 1 ? " (pot layer $" + layer + ")" : "")
                        + " with " + HandEvaluator.handName(scores.get(w)));
            }
            prev = level;
        }
        if (distributed != pot)
        {   // defensive: must never trigger
            throw new IllegalStateException("Pot mismatch: pot=" + pot
                    + " distributed=" + distributed);
        }
        pot = 0;
    }

    // ------------------------------------------------------------- utilities

    private void rotateDealer()
    {
        if (fundedCount() > 0)
            dealerPosition = firstFundedAfter(dealerPosition);
    }

    private int nextSeat(int seat)
    {
        return (seat + 1) % players.size();
    }

    private int firstFundedAfter(int seat)
    {
        int s = nextSeat(seat);
        while (players.get(s).getChips() == 0)
            s = nextSeat(s);
        return s;
    }

    private int firstActiveAfter(int seat)
    {
        int s = nextSeat(seat);
        for (int i = 0; i < players.size(); i++)
        {
            HoldemPlayer p = players.get(s);
            if (p.isInHand() && !p.isFolded())
                return s;
            s = nextSeat(s);
        }
        return seat;
    }

    private List<HoldemPlayer> inHandPlayersFrom(int startSeat)
    {
        List<HoldemPlayer> result = new ArrayList<HoldemPlayer>();
        int s = startSeat;
        for (int i = 0; i < players.size(); i++)
        {
            if (players.get(s).isInHand())
                result.add(players.get(s));
            s = nextSeat(s);
        }
        return result;
    }

    private int fundedCount()
    {
        int count = 0;
        for (HoldemPlayer p : players)
        {
            if (p.getChips() > 0)
                count++;
        }
        return count;
    }

    private int unfoldedCount()
    {
        int count = 0;
        for (HoldemPlayer p : players)
        {
            if (p.isInHand() && !p.isFolded())
                count++;
        }
        return count;
    }

    private int countCanAct()
    {
        int count = 0;
        for (HoldemPlayer p : players)
        {
            if (p.canAct())
                count++;
        }
        return count;
    }

    private void displayChipCounts()
    {
        StringBuilder sb = new StringBuilder("Chips:");
        for (HoldemPlayer p : players)
        {
            sb.append(' ').append(p.getName().replace("Player ", "P"))
              .append("=$").append(p.getChips());
        }
        log(sb.toString());
    }

    private void announceWinner()
    {
        for (HoldemPlayer p : players)
        {
            if (p.getChips() > 0)
            {
                log("\n=== Game over after " + handsPlayed + " hands. Winner: "
                        + p.getName() + " with $" + p.getChips() + " ===");
                return;
            }
        }
    }

    private void log(String msg)
    {
        if (verbose)
            System.out.println(msg);
    }

    static String cardsToString(List<Card> cards)
    {
        StringBuilder sb = new StringBuilder();
        for (Card c : cards)
        {
            if (sb.length() > 0)
                sb.append(' ');
            sb.append(c);
        }
        return sb.toString();
    }

    public static void main(String[] args)
    {
        long seed = args.length > 0 ? Long.parseLong(args[0])
                                    : System.currentTimeMillis();
        new TexasHoldemGame(6, seed, true).startGame();
    }
}
