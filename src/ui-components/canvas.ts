/**
 * Draws a progression chart on the given canvas context.
 * Pure function.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Array<{week: number, value: number}>} dataPoints 
 * @param {number} width 
 * @param {number} height 
 */
export function drawChart(ctx: CanvasRenderingContext2D, dataPoints: Array<{ week: number, value: number }>, width: number, height: number): void {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!dataPoints || dataPoints.length === 0) return;

    // Config
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Find min/max for scaling
    // Sort by week just in case
    const sortedData = [...dataPoints].sort((a, b) => a.week - b.week);

    const minWeek = sortedData[0].week;
    const maxWeek = sortedData[sortedData.length - 1].week;

    let weekRange = maxWeek - minWeek;

    // Add buffer to X axis so points don't sit on the edge
    let effectiveMinWeek = minWeek - 1;
    let effectiveMaxWeek = maxWeek + 1;
    weekRange = effectiveMaxWeek - effectiveMinWeek;

    // Handle single point (weekRange would be 2 from buffer, which is fine)
    // If original range was 0, new range is 2.
    // If original range was 1 (e.g. 100, 101), new range is 3 (99 to 102).

    // Y axis: Skill usually 0-20, or adapt to data
    const values = sortedData.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    // Add some buffer
    const yMin = Math.max(0, minVal - 1);
    const yMax = maxVal + 1;
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
    for (let i = Math.floor(yMin); i <= Math.ceil(yMax); i++) {
        const y = getY(i);
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
    }
    ctx.stroke();

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

    // Draw Labels (Simple)
    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    // X Axis Labels (Start and End)
    ctx.fillText(effectiveMinWeek.toString(), padding, height - 5);
    ctx.fillText(effectiveMaxWeek.toString(), width - padding, height - 5);

    // Y Axis Labels (Min and Max)
    ctx.textAlign = 'right';
    ctx.fillText(yMin.toString(), padding - 5, getY(yMin));
    ctx.fillText(yMax.toString(), padding - 5, getY(yMax));
}
