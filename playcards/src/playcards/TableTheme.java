package playcards;

import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;

/** Shared visual tokens for the Swing table. */
final class TableTheme
{
    static final Color TABLE_GREEN = new Color(15, 66, 49);
    static final Color TABLE_GREEN_DARK = new Color(10, 49, 37);
    static final Color PANEL_GREEN = new Color(24, 88, 66);
    static final Color PANEL_GREEN_HOVER = new Color(31, 105, 76);
    static final Color PANEL_GREEN_DISABLED = new Color(18, 72, 54);
    static final Color PANEL_BORDER = new Color(96, 151, 126);
    static final Color CREAM = new Color(249, 246, 235);
    static final Color CREAM_DIM = new Color(185, 205, 195);
    static final Color PAPER = new Color(255, 253, 247);
    static final Color GOLD = new Color(239, 190, 68);
    static final Color GOLD_HOVER = new Color(247, 205, 91);
    static final Color GOLD_DARK = new Color(189, 140, 36);
    static final Color RED = new Color(181, 45, 48);
    static final Color RED_DARK = new Color(113, 24, 27);
    static final Color INK = new Color(32, 39, 35);
    static final Color CARD_BACK = new Color(27, 42, 62);
    static final Color CARD_BACK_STRIPE = new Color(44, 66, 102);
    static final Color CARD_BACK_BORDER = new Color(60, 91, 134);
    static final Color CARD_BORDER = new Color(220, 212, 192);
    static final Color CHIP_RAIL_TRACK = new Color(72, 99, 87);
    static final Color WIN_BACKGROUND = new Color(226, 242, 231);
    static final Color LOSS_BACKGROUND = new Color(252, 232, 229);
    static final Color PUSH_BACKGROUND = new Color(227, 239, 248);
    static final Color PUSH_INK = new Color(30, 70, 100);
    static final Color WINNER_GREEN = new Color(31, 105, 76);

    static final String UI_FONT = "SansSerif";
    static final String CARD_FONT = "Serif";

    static final int ROOT_GAP = 12;
    static final int ROOT_PADDING_TOP = 14;
    static final int ROOT_PADDING_SIDE = 28;
    static final int ROOT_PADDING_BOTTOM = 14;
    static final int HAND_GAP = 8;
    static final int TABLE_INSET = 8;
    static final int HAND_PADDING = 10;
    static final int HAND_SIDE_PADDING = 18;
    static final int CARD_GAP = 10;
    static final int CARD_VERTICAL_GAP = 0;
    static final int CONTROL_GAP = 8;
    static final int SCORE_GAP = 10;
    static final int SCORE_DETAIL_GAP = 7;
    static final int CHIP_DIAMETER = 18;
    static final int CHIP_OVERLAP = 7;
    static final int CHIP_LABEL_GAP = 8;
    static final int CHIP_RAIL_HEIGHT = 26;
    static final int CHIP_RAIL_GAP = 4;
    static final int CARD_BORDER_WIDTH = 2;
    static final int CARD_CORNER_RADIUS = 8;
    static final int HAND_EMPHASIS_BORDER_WIDTH = 2;
    static final int PANEL_BORDER_WIDTH = 1;
    static final int CARD_INSET_VERTICAL = 4;
    static final int CARD_INSET_HORIZONTAL = 5;
    static final int CARD_WIDTH = 86;
    static final int CARD_HEIGHT = 116;
    static final int CARD_MIN_WIDTH = 50;
    static final int CARD_MIN_HEIGHT = 67;
    static final int CONTROL_BREAKPOINT = 760;
    static final int CONTROL_BUTTON_WIDTH = 112;
    static final int CONTROL_BUTTON_HEIGHT = 44;
    static final int FRAME_MIN_WIDTH = 700;
    static final int FRAME_MIN_HEIGHT = 520;
    static final int FRAME_WIDTH = 980;
    static final int FRAME_HEIGHT = 680;

    static final int TITLE_SIZE = 30;
    static final int SUBTITLE_SIZE = 13;
    static final int SECTION_SIZE = 16;
    static final int BODY_SIZE = 15;
    static final int CONTROL_SIZE = 14;
    static final int META_SIZE = 10;
    static final int HAND_VALUE_SIZE = 27;
    static final int CARD_CORNER_SIZE = 16;
    static final int CARD_SUIT_SIZE = 46;
    static final int SHUFFLE_FRAME_MILLIS = 110;
    static final int DEAL_FRAME_MILLIS = 160;
    static final int SHUFFLE_FRAME_COUNT = 4;

    private TableTheme()
    {
    }

    static Dimension minimumWindowSize()
    {
        return new Dimension(FRAME_MIN_WIDTH, FRAME_MIN_HEIGHT);
    }

    static Dimension startingWindowSize()
    {
        return new Dimension(FRAME_WIDTH, FRAME_HEIGHT);
    }

    static Dimension cardPreferredSize()
    {
        return new Dimension(CARD_WIDTH, CARD_HEIGHT);
    }

    static Dimension cardMinimumSize()
    {
        return new Dimension(CARD_MIN_WIDTH, CARD_MIN_HEIGHT);
    }

    static Dimension cardSizeFor(int availableWidth, int availableHeight, int cardCount)
    {
        if (cardCount <= 0)
            return cardPreferredSize();

        int horizontalGaps = Math.max(0, cardCount - 1) * CARD_GAP;
        int widthByRow = Math.max(1, availableWidth - horizontalGaps) / cardCount;
        int widthByHeight = availableHeight > 0
                ? availableHeight * CARD_WIDTH / CARD_HEIGHT
                : CARD_WIDTH;
        int width = Math.min(CARD_WIDTH, Math.min(widthByRow, widthByHeight));
        width = Math.max(CARD_MIN_WIDTH, width);
        int height = Math.max(CARD_MIN_HEIGHT,
                Math.round((float) width * CARD_HEIGHT / CARD_WIDTH));
        return new Dimension(width, height);
    }

    static Dimension controlButtonSize()
    {
        return new Dimension(CONTROL_BUTTON_WIDTH, CONTROL_BUTTON_HEIGHT);
    }

    static boolean animationsEnabled()
    {
        return !Boolean.getBoolean("playcards.reduceMotion");
    }

    static Font uiFont(int style, int size)
    {
        return new Font(UI_FONT, style, size);
    }

    static Font cardFont(int style, int size)
    {
        return new Font(CARD_FONT, style, size);
    }
}
