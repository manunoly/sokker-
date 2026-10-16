import type { SkillProgress } from '../core/talent';
import type { PlayerSkillPoint } from '../core/playerTimeline';

const SOURCE_PRIORITY: Record<PlayerSkillPoint['source'], number> = {
    training: 2,
    'carried-over': 1,
    'roster-fallback': 0,
};

/** Draws saved levels only; gaps and inferred snapshots never become training observations. */
export function drawPlayerSkillChart(
    ctx: CanvasRenderingContext2D,
    progress: SkillProgress,
    width: number,
    height: number,
): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);
    if (width <= 44 || height <= 40) return;

    const byWeek = new Map<number, PlayerSkillPoint>();
    for (const point of progress.points) {
        if (!Number.isSafeInteger(point.week) || !Number.isFinite(point.level) || point.level < 0 || point.level > 18) continue;
        const earlier = byWeek.get(point.week);
        if (!earlier || SOURCE_PRIORITY[point.source] > SOURCE_PRIORITY[earlier.source]) byWeek.set(point.week, point);
    }
    const points = [...byWeek.values()].sort((a, b) => a.week - b.week);
    if (points.length === 0) return;

    let lowestLevel = Math.min(...points.map(point => point.level));
    let highestLevel = Math.max(...points.map(point => point.level));
    if (lowestLevel === highestLevel) {
        lowestLevel = Math.max(0, lowestLevel - 1);
        highestLevel = Math.min(18, highestLevel + 1);
    }
    const gridLevels = [...new Set([lowestLevel, Math.round((lowestLevel + highestLevel) / 2), highestLevel])];
    const left = 32;
    const right = width - 12;
    const top = 12;
    const bottom = height - 22;
    const firstWeek = points[0].week;
    const lastWeek = points[points.length - 1].week;
    const weekRange = lastWeek - firstWeek;
    const chartWidth = right - left;
    const chartHeight = bottom - top;
    const pixelX = (week: number) => weekRange === 0 ? left + chartWidth / 2 : left + ((week - firstWeek) / weekRange) * chartWidth;
    const pixelY = (level: number) => bottom - ((level - lowestLevel) / (highestLevel - lowestLevel)) * chartHeight;

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const level of gridLevels) {
        const y = pixelY(level);
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
    }
    ctx.stroke();

    const { pace, trendStartWeek, trendEndWeek } = progress;
    if (progress.skill !== 'stamina' && pace?.state === 'estimated' && pace.slope !== null &&
        Number.isFinite(pace.slope) && pace.slope > 0 && trendStartWeek !== null && trendEndWeek !== null) {
        const fitted = points.filter(point => point.source === 'training' && point.week >= trendStartWeek && point.week <= trendEndWeek);
        if (fitted.length >= 4 && fitted[0].week < fitted[fitted.length - 1].week) {
            const meanWeek = fitted.reduce((sum, point) => sum + point.week, 0) / fitted.length;
            const meanLevel = fitted.reduce((sum, point) => sum + point.level, 0) / fitted.length;
            const fittedLevel = (week: number) => meanLevel + pace.slope! * (week - meanWeek);
            const startWeek = fitted[0].week;
            const endWeek = fitted[fitted.length - 1].week;
            ctx.save();
            ctx.beginPath();
            ctx.rect(left, top, chartWidth, chartHeight);
            ctx.clip();
            ctx.beginPath();
            ctx.moveTo(pixelX(startWeek), pixelY(fittedLevel(startWeek)));
            ctx.lineTo(pixelX(endWeek), pixelY(fittedLevel(endWeek)));
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = '#ffbf69';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }

    ctx.strokeStyle = '#78d4ff';
    ctx.lineWidth = 2;
    for (let index = 1; index < points.length; index++) {
        const previous = points[index - 1];
        const current = points[index];
        if (previous.source !== 'training' || current.source !== 'training' || current.week - previous.week !== 1) continue;
        ctx.beginPath();
        ctx.moveTo(pixelX(previous.week), pixelY(previous.level));
        ctx.lineTo(pixelX(current.week), pixelY(current.level));
        ctx.stroke();
    }

    const rises = new Set(progress.riseWeeks);
    for (const point of points) {
        const x = pixelX(point.week);
        const y = pixelY(point.level);
        if (point.source === 'roster-fallback') {
            ctx.fillStyle = '#a78bfa';
            ctx.fillRect(x - 3, y - 3, 6, 6);
        } else {
            ctx.fillStyle = point.source === 'training' ? '#dff6ff' : '#9ca3af';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            if (point.source === 'training') ctx.fill();
            else {
                ctx.strokeStyle = '#9ca3af';
                ctx.stroke();
            }
        }
        if (point.source === 'training' && rises.has(point.week)) {
            ctx.fillStyle = '#93eab4';
            ctx.beginPath();
            ctx.moveTo(x + 6, y - 10);
            ctx.lineTo(x + 10, y - 4);
            ctx.lineTo(x + 2, y - 4);
            ctx.closePath();
            ctx.fill();
        }
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (const level of gridLevels) ctx.fillText(String(level), left - 5, pixelY(level) + 3);
    ctx.textAlign = 'center';
    const labelCount = Math.min(weekRange + 1, Math.max(2, Math.floor(chartWidth / 45)));
    for (let index = 0; index < labelCount; index++) {
        const week = weekRange === 0 ? firstWeek : firstWeek + Math.round(index * weekRange / (labelCount - 1));
        ctx.fillText(String(week), pixelX(week), height - 5);
    }
}
