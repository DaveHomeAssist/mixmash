package playcards;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Immutable view of BlackjackGame state for console and Swing adapters.
 */
public final class GameSnapshot
{
    private final String humanName;
    private final List<Card> humanCards;
    private final List<Card> dealerCards;
    private final int humanValue;
    private final int dealerValue;
    private final int humanPoints;
    private final int dealerPoints;
    private final GamePhase phase;
    private final BlackjackGame.HandOutcome outcome;

    GameSnapshot(String humanName, List<Card> humanCards, List<Card> dealerCards,
            int humanValue, int dealerValue, int humanPoints, int dealerPoints,
            GamePhase phase, BlackjackGame.HandOutcome outcome)
    {
        this.humanName = Objects.requireNonNull(humanName, "Human name is required");
        this.humanCards = immutableCopy(humanCards);
        this.dealerCards = immutableCopy(dealerCards);
        this.humanValue = humanValue;
        this.dealerValue = dealerValue;
        this.humanPoints = humanPoints;
        this.dealerPoints = dealerPoints;
        this.phase = Objects.requireNonNull(phase, "Game phase is required");
        this.outcome = outcome;
    }

    public String getHumanName()
    {
        return humanName;
    }

    public List<Card> getHumanCards()
    {
        return humanCards;
    }

    public List<Card> getDealerCards()
    {
        return dealerCards;
    }

    public int getHumanValue()
    {
        return humanValue;
    }

    public int getDealerValue()
    {
        return dealerValue;
    }

    public int getHumanPoints()
    {
        return humanPoints;
    }

    public int getDealerPoints()
    {
        return dealerPoints;
    }

    public GamePhase getPhase()
    {
        return phase;
    }

    public BlackjackGame.HandOutcome getOutcome()
    {
        return outcome;
    }

    public boolean isHandComplete()
    {
        return phase == GamePhase.HAND_COMPLETE || phase == GamePhase.GAME_OVER;
    }

    public boolean isGameOver()
    {
        return phase == GamePhase.GAME_OVER;
    }

    public boolean canHit()
    {
        return phase == GamePhase.PLAYER_TURN && humanCards.size() < Hand.MAX_CARDS;
    }

    public boolean canStay()
    {
        return phase == GamePhase.PLAYER_TURN;
    }

    public boolean canStartNextHand()
    {
        return phase == GamePhase.HAND_COMPLETE;
    }

    private List<Card> immutableCopy(List<Card> cards)
    {
        return Collections.unmodifiableList(new ArrayList<Card>(
                Objects.requireNonNull(cards, "Card list is required")));
    }
}
