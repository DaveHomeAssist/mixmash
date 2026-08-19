package playcards;

import java.awt.BasicStroke;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import javax.swing.JPanel;

/** Compact physical chip stack and numeric total for one participant. */
final class ChipCountView extends JPanel
{
    private int points;
    private boolean dealer;

    ChipCountView()
    {
        setFont(TableTheme.uiFont(Font.BOLD, TableTheme.SUBTITLE_SIZE));
        setOpaque(false);
    }

    void render(String participantName, int points, boolean dealer)
    {
        if (points < 0)
            throw new IllegalArgumentException("Chip count cannot be negative");
        this.points = points;
        this.dealer = dealer;
        getAccessibleContext().setAccessibleName(participantName + ": " + points + " chips");
        getAccessibleContext().setAccessibleDescription(
                "A stack representing " + points + " chips owned by " + participantName);
        revalidate();
        repaint();
    }

    int getPoints()
    {
        return points;
    }

    boolean isDealerStack()
    {
        return dealer;
    }

    @Override
    public Dimension getPreferredSize()
    {
        FontMetrics metrics = getFontMetrics(getFont());
        int stackWidth = stackWidth();
        int labelWidth = metrics.stringWidth(points + " chips");
        int gap = stackWidth == 0 ? 0 : TableTheme.CHIP_LABEL_GAP;
        return new Dimension(stackWidth + gap + labelWidth, Math.max(28, TableTheme.CHIP_DIAMETER));
    }

    @Override
    public Dimension getMinimumSize()
    {
        return getPreferredSize();
    }

    @Override
    protected void paintComponent(Graphics graphics)
    {
        super.paintComponent(graphics);
        Graphics2D copy = (Graphics2D) graphics.create();
        copy.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        int diameter = TableTheme.CHIP_DIAMETER;
        int chipY = Math.max(0, (getHeight() - diameter) / 2);
        for (int index = 0; index < points; index++)
            paintChip(copy, index * TableTheme.CHIP_OVERLAP, chipY, diameter);

        copy.setFont(getFont());
        copy.setColor(TableTheme.GOLD);
        FontMetrics metrics = copy.getFontMetrics();
        int stackWidth = stackWidth();
        int textX = stackWidth == 0 ? 0 : stackWidth + TableTheme.CHIP_LABEL_GAP;
        int textY = (getHeight() - metrics.getHeight()) / 2 + metrics.getAscent();
        copy.drawString(points + " chips", textX, textY);
        copy.dispose();
    }

    private int stackWidth()
    {
        return points == 0 ? 0
                : TableTheme.CHIP_DIAMETER + ((points - 1) * TableTheme.CHIP_OVERLAP);
    }

    private void paintChip(Graphics2D graphics, int x, int y, int diameter)
    {
        java.awt.Color body = dealer ? TableTheme.RED : TableTheme.GOLD;
        java.awt.Color inner = dealer ? TableTheme.RED_DARK : TableTheme.GOLD_DARK;
        graphics.setColor(TableTheme.CREAM);
        graphics.fillOval(x, y, diameter, diameter);
        graphics.setColor(inner);
        graphics.drawOval(x, y, diameter - 1, diameter - 1);
        graphics.setColor(body);
        graphics.fillOval(x + 3, y + 3, diameter - 6, diameter - 6);
        graphics.setColor(inner);
        graphics.setStroke(new BasicStroke(1f));
        graphics.drawOval(x + 5, y + 5, diameter - 10, diameter - 10);
        graphics.setColor(body);
        int center = diameter / 2;
        graphics.fillRect(x + center - 1, y, 3, 4);
        graphics.fillRect(x + center - 1, y + diameter - 4, 3, 4);
        graphics.fillRect(x, y + center - 1, 4, 3);
        graphics.fillRect(x + diameter - 4, y + center - 1, 4, 3);
    }
}
