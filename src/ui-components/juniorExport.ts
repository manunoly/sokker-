import type { JuniorPoint } from '../core/juniorTypes';
import { estimateJuniorTalent } from '../core/juniorTalent';
import { createChartExportCanvas } from './chartExport';
import { drawJuniorChart } from './juniorCanvas';

/** Supply juvenile data and labels to the shared native-Canvas PNG compositor. */
export function createJuniorExportCanvas(points: readonly JuniorPoint[], weeksLeft: number | null): HTMLCanvasElement {
    const estimate = estimateJuniorTalent(points);
    const weeks = weeksLeft !== null && Number.isSafeInteger(weeksLeft) && weeksLeft >= 0
        ? String(weeksLeft) : '—';
    const talent = estimate.state === 'estimated' && estimate.weeksPerLevel !== null
        ? estimate.weeksPerLevel < 3 ? '<3'
            : estimate.weeksPerLevel > 12 ? '>12' : estimate.weeksPerLevel.toFixed(1)
        : '—';
    return createChartExportCanvas({
        draw: (ctx, width, height) => drawJuniorChart(ctx, points, width, height, estimate.slope, weeksLeft),
        footer: `${weeks} weeks left · ${talent} talent`,
        credit: 'by manuel.team'
    });
}
