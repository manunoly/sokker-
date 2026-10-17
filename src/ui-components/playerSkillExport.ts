import type { SkillProgress } from '../core/talent';
import { createChartExportCanvas } from './chartExport';
import { drawPlayerSkillChart, PLAYER_SKILL_CHART_HEIGHT, PLAYER_SKILL_CHART_WIDTH } from './playerSkillCanvas';

/** Supply one first-team skill and its fixed-English footer to the shared PNG layout. */
export function createPlayerSkillExportCanvas(progress: SkillProgress, englishSkillName: string): HTMLCanvasElement {
    const uncertainWeek = progress.points.some(point => point.source === 'training' && point.dateReliable === false);
    let firstWeek = Infinity;
    let lastWeek = -Infinity;
    for (const point of progress.points) {
        if (!Number.isSafeInteger(point.week) || !Number.isFinite(point.level)) continue;
        firstWeek = Math.min(firstWeek, point.week);
        lastWeek = Math.max(lastWeek, point.week);
    }
    const period = firstWeek === Infinity ? 'level history'
        : firstWeek === lastWeek ? `week ${firstWeek}` : `weeks ${firstWeek}–${lastWeek}`;
    const footer = `${englishSkillName} · ${period}${uncertainWeek ? ' · week?' : ''}`;
    return createChartExportCanvas({
        draw: (ctx, width, height) => drawPlayerSkillChart(ctx, progress, width, height),
        footer,
        credit: 'by manuel.team',
        chartWidth: PLAYER_SKILL_CHART_WIDTH,
        chartHeight: PLAYER_SKILL_CHART_HEIGHT,
    });
}
