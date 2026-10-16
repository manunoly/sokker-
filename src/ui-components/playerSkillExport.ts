import type { SkillProgress } from '../core/talent';
import { createChartExportCanvas } from './chartExport';
import { drawPlayerSkillChart } from './playerSkillCanvas';

/** Supply one first-team skill and its fixed-English footer to the shared PNG layout. */
export function createPlayerSkillExportCanvas(progress: SkillProgress, englishSkillName: string): HTMLCanvasElement {
    const uncertainWeek = progress.points.some(point => point.source === 'training' && point.dateReliable === false);
    const footer = progress.skill === 'stamina'
        ? `${englishSkillName} · level history${uncertainWeek ? ' · week?' : ''}`
        : progress.pace?.state === 'estimated' && progress.pace.weeksPerLevel !== null &&
          Number.isFinite(progress.pace.weeksPerLevel)
            ? `${englishSkillName} · ${progress.pace.weeksPerLevel.toFixed(1)} weeks/level${uncertainWeek ? ' · week?' : ''}`
            : `${englishSkillName} · pace unavailable${uncertainWeek ? ' · week?' : ''}`;
    return createChartExportCanvas({
        draw: (ctx, width, height) => drawPlayerSkillChart(ctx, progress, width, height),
        footer,
        credit: 'by manuel.team',
    });
}
