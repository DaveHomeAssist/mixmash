package playcards;

import java.awt.Dimension;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import javax.swing.JPanel;

/** Shared chip-economy rail showing how the ten chips are split. */
final class ChipRail extends JPanel
{
    private int humanPoints;
    private int dealerPoints;

    ChipRail()
    {
        setFont(TableTheme.uiFont(Font.BOLD, TableTheme.META_SIZE));
        setOpaque(false);
    }

    void render(String humanName, int humanPoints, int dealerPoints)
    {
        if (humanPoints < 0 || dealerPoints < 0)
            throw new IllegalArgumentException("Chip counts cannot be negative");
        this.humanPoints = humanPoints;
        this.dealerPoints = dealerPoints;
        String split = humanName + " " + humanPoints + ", Dealer " + dealerPoints;
        getAccessibleContext().setAccessibleName("Chips in play: " + split);
        getAccessibleContext().setAccessibleDescription(
                "The shared chip supply is currently split " + split);
        repaint();
    }

    int getHumanPoints()
    {
        return humanPoints;
    }

    int getDealerPoints()
    {
        return dealerPoints;
    }

    @Override
    public Dimension getPreferredSize()
    {
        return new Dimension(100, TableTheme.CHIP_RAIL_HEIGHT);
    }

    @Override
    protected void paintComponent(Graphics graphics)
    {
        super.paintComponent(graphics);
        Graphics2D copy = (Graphics2D) graphics.create();
        copy.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        copy.setColor(TableTheme.TABLE_GREEN_DARK);
        copy.fillRoundRect(0, 0, getWidth(), getHeight(), 4, 4);

        copy.setFont(getFont());
        FontMetrics metrics = copy.getFontMetrics();
        int baseline = (getHeight() - metrics.getHeight()) / 2 + metrics.getAscent();
        copy.setColor(TableTheme.CREAM_DIM);
        copy.drawString("CHIPS IN PLAY", 18, baseline);

        String split = humanPoints + " / " + dealerPoints;
        int splitWidth = metrics.stringWidth(split);
        int splitX = getWidth() - splitWidth - 18;
        int trackX = 130;
        int trackWidth = Math.max(24, splitX - trackX - 16);
        int trackY = (getHeight() - 8) / 2;
        copy.setColor(TableTheme.CHIP_RAIL_TRACK);
        copy.fillRoundRect(trackX, trackY, trackWidth, 8, 8, 8);

        int total = humanPoints + dealerPoints;
        if (total > 0)
        {
            int humanWidth = Math.round((float) trackWidth * humanPoints / total);
            copy.setColor(TableTheme.GOLD);
            copy.fillRoundRect(trackX, trackY, humanWidth, 8, 8, 8);
            if (humanWidth > 0 && humanWidth < trackWidth)
                copy.fillRect(trackX + Math.max(0, humanWidth - 4), trackY, Math.min(4, humanWidth), 8);
        }

        copy.setColor(TableTheme.CREAM_DIM);
        copy.drawString(split, splitX, baseline);
        copy.dispose();
    }
}
