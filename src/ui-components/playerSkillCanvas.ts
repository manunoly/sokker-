import type { SkillProgress } from '../core/talent';
import type { PlayerSkillPoint } from '../core/playerTimeline';

const SOURCE_PRIORITY: Record<PlayerSkillPoint['source'], number> = {
    training: 2,
    'carried-over': 1,
    'roster-fallback': 0,
};

export const PLAYER_SKILL_CHART_WIDTH = 680;
export const PLAYER_SKILL_CHART_HEIGHT = 400;

/** Draws saved levels only; gaps and inferred snapshots never become training observations. */
export function drawPlayerSkillChart(
    ctx: CanvasRenderingContext2D,
    progress: SkillProgress,
    width: number,
    height: number,
): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#243247';
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

    const gridLevels = Array.from({ length: 19 }, (_, level) => level);
    const left = 32;
    const right = width - 18;
    const top = 12;
    const bottom = height - 52;
    const firstWeek = points[0].week;
    const lastWeek = points[points.length - 1].week;
    const weekRange = lastWeek - firstWeek;
    const chartWidth = right - left;
    const chartHeight = bottom - top;
    const pixelX = (week: number) => weekRange === 0 ? left + chartWidth / 2 : left + ((week - firstWeek) / weekRange) * chartWidth;
    const pixelY = (level: number) => bottom - (level / 18) * chartHeight;
    const reportedRises = new Set(progress.riseWeeks);
    const rises = new Set(points.filter(point => point.source === 'training' && reportedRises.has(point.week)).map(point => point.week));
    const labelWeeks = [...new Set([firstWeek, ...rises, lastWeek])].sort((a, b) => a - b);

    ctx.strokeStyle = '#3b4b60';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const level of gridLevels) {
        const y = pixelY(level);
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
    }
    for (const week of labelWeeks) {
        const x = pixelX(week);
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
    }
    ctx.stroke();

    ctx.lineWidth = 2;
    for (let index = 1; index < points.length; index++) {
        const previous = points[index - 1];
        const current = points[index];
        const reference = previous.source !== 'training' || current.source !== 'training';
        const gap = current.week - previous.week > 1;
        ctx.beginPath();
        ctx.moveTo(pixelX(previous.week), pixelY(previous.level));
        ctx.lineTo(pixelX(current.week), pixelY(current.level));
        ctx.strokeStyle = reference ? '#94a3b8' : '#78d4ff';
        ctx.setLineDash(reference || gap ? [4, 3] : []);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const point of points) {
        const x = pixelX(point.week);
        const y = pixelY(point.level);
        if (point.source === 'roster-fallback') {
            ctx.fillStyle = '#a78bfa';
            ctx.fillRect(x - 3, y - 3, 6, 6);
        } else {
            ctx.fillStyle = rises.has(point.week) ? '#93eab4' : point.source === 'training' ? '#dff6ff' : point.injured ? '#fb923c' : '#9ca3af';
            ctx.beginPath();
            ctx.arc(x, y, rises.has(point.week) ? 4 : 3, 0, 2 * Math.PI);
            if (point.source === 'training' || point.injured) ctx.fill();
            else {
                ctx.strokeStyle = '#9ca3af';
                ctx.stroke();
            }
        }
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (const level of gridLevels) {
        if (level % 2 === 0) ctx.fillText(String(level), left - 5, pixelY(level) + 3);
    }
    ctx.textAlign = 'center';
    const rowLastX = [-Infinity, -Infinity, -Infinity, -Infinity];
    for (const week of labelWeeks) {
        const x = pixelX(week);
        const row = rowLastX.findIndex(previousX => x - previousX >= 27);
        const chosenRow = row >= 0 ? row : rowLastX.indexOf(Math.min(...rowLastX));
        rowLastX[chosenRow] = x;
        ctx.fillStyle = rises.has(week) ? '#93eab4' : '#cbd5e1';
        ctx.fillText(String(week), x, height - 5 - chosenRow * 11);
    }
}
