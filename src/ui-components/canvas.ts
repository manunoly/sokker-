export interface ChartOptions {
    forceYRange?: [number, number];
    showAllXLabels?: boolean;
    showGrid?: boolean;
}

/**
 * Draws a progression chart on the given canvas context.
 * Pure function.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Array<{week: number, value: number}>} dataPoints 
 * @param {number} width 
 * @param {number} height 
 * @param {ChartOptions} [options]
 */
export function drawChart(ctx: CanvasRenderingContext2D, dataPoints: Array<{ week: number, value: number }>, width: number, height: number, options?: ChartOptions): void {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!dataPoints || dataPoints.length === 0) return;

    // Config
    const padding = 30; // Increased padding for labels
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Find min/max for scaling
    // Sort by week just in case
    const sortedData = [...dataPoints].sort((a, b) => a.week - b.week);

    const minWeek = sortedData[0].week;
    const maxWeek = sortedData[sortedData.length - 1].week;

    let weekRange = maxWeek - minWeek;

    // Add buffer to X axis so points don't sit on the edge
    let effectiveMinWeek = minWeek;
    let effectiveMaxWeek = maxWeek;

    if (!options?.showAllXLabels) {
        // Default buffer for small chart
        effectiveMinWeek = minWeek - 1;
        effectiveMaxWeek = maxWeek + 1;
    }

    weekRange = effectiveMaxWeek - effectiveMinWeek;
    if (weekRange === 0) weekRange = 1;

    // Y axis: Skill usually 0-18 (Sokker scale)
    const values = sortedData.map(d => d.value);
    let yMin = 0;
    let yMax = 0;

    if (options?.forceYRange) {
        yMin = options.forceYRange[0];
        yMax = options.forceYRange[1];
    } else {
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        // Add some buffer
        yMin = Math.max(0, minVal - 1);
        yMax = maxVal + 1;
    }

    const valRange = yMax - yMin || 1;

    // Helper to map coordinates
    const getX = (week: number) => padding + ((week - effectiveMinWeek) / weekRange) * chartWidth;
    const getY = (val: number) => height - padding - ((val - yMin) / valRange) * chartHeight;

    // Draw Background/Grid
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Horizontal grid lines
    // If range is fixed 0-18, draw line for every integer
    const step = 1;
    for (let i = Math.floor(yMin); i <= Math.ceil(yMax); i += step) {
        const y = getY(i);
        if (y >= padding && y <= height - padding) { // Clip
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
        }
    }
    ctx.stroke();

    // Vertical grid lines (Weeks)
    if (options?.showAllXLabels) {
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        for (let w = effectiveMinWeek; w <= effectiveMaxWeek; w++) {
            const x = getX(w);
            ctx.moveTo(x, padding);
            ctx.lineTo(x, height - padding);
        }
        ctx.stroke();
    }

    // Draw Line
    ctx.strokeStyle = '#00ff00'; // Neon green
    ctx.lineWidth = 2;
    ctx.beginPath();

    sortedData.forEach((point, index) => {
        const x = getX(point.week);
        const y = getY(point.value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Points
    ctx.fillStyle = '#fff';
    sortedData.forEach((point) => {
        const x = getX(point.week);
        const y = getY(point.value);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2); // Small circle
        ctx.fill();
    });

    // Draw Labels
    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    // X Axis Labels
    if (options?.showAllXLabels) {
        for (let w = effectiveMinWeek; w <= effectiveMaxWeek; w++) {
            // Only draw if we have space? For now draw all.
            // Maybe skip if too crowded
            if (weekRange > 20 && w % 2 !== 0) continue;
            ctx.fillText(w.toString(), getX(w), height - 5);
        }
    } else {
        // Start and End
        ctx.fillText(effectiveMinWeek.toString(), padding, height - 5);
        ctx.fillText(effectiveMaxWeek.toString(), width - padding, height - 5);
    }

    // Y Axis Labels
    ctx.textAlign = 'right';
    if (options?.forceYRange) {
        // Draw 0, 5, 10, 15, 18? Or all?
        // 0-18 is not too many.
        for (let i = yMin; i <= yMax; i++) {
            if (i % 2 === 0) { // Every 2 levels to avoid crowding?
                ctx.fillText(i.toString(), padding - 5, getY(i) + 3);
            }
        }
    } else {
        ctx.fillText(yMin.toString(), padding - 5, getY(yMin));
        ctx.fillText(yMax.toString(), padding - 5, getY(yMax));
    }
}
