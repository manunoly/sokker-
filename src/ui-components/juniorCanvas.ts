import type { JuniorPoint } from '../core/juniorTypes';

/** Last observed x represents the roster's current weeksLeft; older x values count backwards. */
export function juniorAxisWeek(x: number, firstX: number, lastX: number, weeksLeft: number | null): number {
    return weeksLeft !== null && Number.isSafeInteger(weeksLeft) && weeksLeft >= 0
        ? weeksLeft + lastX - x
        : x - firstX;
}

/** Renders only observed levels and a fitted trend within the observed time span. */
export function drawJuniorChart(
    ctx: CanvasRenderingContext2D,
    points: readonly JuniorPoint[],
    width: number,
    height: number,
    trendSlope: number | null,
    weeksLeft: number | null,
): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);

    if (width <= 44 || height <= 40) return;

    const byWeek = new Map<number, JuniorPoint>();
    for (const point of points) {
        if (Number.isInteger(point.x) && Number.isFinite(point.y) && point.y >= 0 && point.y <= 18) {
            byWeek.set(point.x, point);
        }
    }
    const observed = [...byWeek.values()].sort((a, b) => a.x - b.x);
    if (observed.length === 0) return;
    let lowestLevel = observed.reduce((lowest, point) => Math.min(lowest, point.y), observed[0].y);
    let highestLevel = observed.reduce((highest, point) => Math.max(highest, point.y), observed[0].y);
    if (lowestLevel === highestLevel) {
        lowestLevel = Math.max(0, lowestLevel - 1);
        highestLevel = Math.min(18, highestLevel + 1);
    }
    const gridLevels = [...new Set([lowestLevel, Math.round((lowestLevel + highestLevel) / 2), highestLevel])];

    const left = 32;
    const right = width - 12;
    const top = 12;
    const bottom = height - 22;
    const firstX = observed[0].x;
    const lastX = observed[observed.length - 1].x;
    const xRange = lastX - firstX;
    const chartWidth = right - left;
    const chartHeight = bottom - top;
    const pixelX = (x: number) => xRange === 0 ? left + chartWidth / 2 : left + ((x - firstX) / xRange) * chartWidth;
    const pixelY = (y: number) => bottom - ((y - lowestLevel) / (highestLevel - lowestLevel)) * chartHeight;

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    for (const level of gridLevels) {
        const y = pixelY(level);
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
    }
    ctx.stroke();

    // OLS intercept is derived from the same observed coordinates as the estimator.
    // A caller supplies the fitted slope only when a trend should be shown.
    if (observed.length >= 4 && trendSlope !== null && Number.isFinite(trendSlope)) {
        const meanX = observed.reduce((sum, point) => sum + point.x, 0) / observed.length;
        const meanY = observed.reduce((sum, point) => sum + point.y, 0) / observed.length;
        const fittedY = (x: number) => meanY + trendSlope * (x - meanX);
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, chartWidth, chartHeight);
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(pixelX(firstX), pixelY(fittedY(firstX)));
        ctx.lineTo(pixelX(lastX), pixelY(fittedY(lastX)));
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#ffbf69';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    ctx.strokeStyle = '#78d4ff';
    ctx.lineWidth = 2;
    for (let index = 1; index < observed.length; index++) {
        const previous = observed[index - 1];
        const current = observed[index];
        if (current.x - previous.x !== 1) continue;
        ctx.beginPath();
        ctx.moveTo(pixelX(previous.x), pixelY(previous.y));
        ctx.lineTo(pixelX(current.x), pixelY(current.y));
        ctx.stroke();
    }

    ctx.fillStyle = '#dff6ff';
    for (const point of observed) {
        ctx.beginPath();
        ctx.arc(pixelX(point.x), pixelY(point.y), 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (const level of gridLevels) ctx.fillText(String(level), left - 5, pixelY(level) + 3);
    ctx.textAlign = 'center';
    const labelCount = Math.min(xRange + 1, Math.max(2, Math.floor(chartWidth / 30)));
    for (let index = 0; index < labelCount; index++) {
        const x = xRange === 0 ? firstX : firstX + Math.round(index * xRange / (labelCount - 1));
        ctx.fillText(String(juniorAxisWeek(x, firstX, lastX, weeksLeft)), pixelX(x), height - 5);
    }
}
