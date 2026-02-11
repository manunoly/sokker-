import { drawChart } from '../ui-components/canvas';
import { getPlayerHistory } from '../core/repository';

let tooltip: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let zoomBtn: HTMLElement | null = null;

/**
 * creates the tooltip element in the DOM if not exists.
 */
function createTooltip(): void {
    if (tooltip) return;

    tooltip = document.createElement('div');
    tooltip.id = 'sokker-plus-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.zIndex = '9999';
    tooltip.style.backgroundColor = '#333';
    tooltip.style.color = '#fff';
    tooltip.style.padding = '10px';
    tooltip.style.borderRadius = '5px';
    tooltip.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
    tooltip.style.display = 'none';
    tooltip.style.pointerEvents = 'none'; // Pass through clicks

    // Canvas container
    canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    tooltip.appendChild(canvas);

    // Zoom Button (Overlay or appended)
    zoomBtn = document.createElement('div');
    zoomBtn.innerText = '🔍';
    zoomBtn.title = 'Zoom Chart';
    zoomBtn.style.position = 'absolute';
    zoomBtn.style.top = '5px';
    zoomBtn.style.right = '5px';
    zoomBtn.style.cursor = 'pointer';
    zoomBtn.style.fontSize = '12px';
    zoomBtn.style.opacity = '0.7';
    zoomBtn.style.pointerEvents = 'auto'; // Capture clicks
    tooltip.appendChild(zoomBtn);

    // Keep tooltip open when hovering over it
    tooltip.addEventListener('mouseenter', () => {
        cancelHide();
    });

    tooltip.addEventListener('mouseleave', () => {
        scheduleHide();
    });

    document.body.appendChild(tooltip);
}

/**
 * Shows the tooltip at specific coordinates with data.
 * @param {number} x - pageX
 * @param {number} y - pageY
 * @param {number} playerId 
 * @param {string} skillName 
 */
/**
 * Fetches and processes chart data for a player and skill.
 * @param {number} playerId 
 * @param {string} skillName 
 * @returns {Promise<Array<{week: number, value: number}> | null>}
 */
async function fetchChartData(playerId: number, skillName: string): Promise<Array<{ week: number, value: number }> | null> {
    const playerHistory = await getPlayerHistory(playerId);

    if (!playerHistory || !playerHistory.history) return null;

    // Prepare and validate data points
    // Fix: Adjust week based on training day (Thursday) to avoid "extra week" effect for pre-training data.
    const rawPoints = playerHistory.history.map(entry => {
        const date = new Date(entry.date);
        const day = date.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat

        // If it's Thursday(4) or Friday(5), it's the "new" value for this week.
        // If it's Sat-Wed, it's the "old" value (pre-training).
        let adjustedWeek = Number(entry.week);

        if (day !== 4 && day !== 5) {
            adjustedWeek = adjustedWeek - 1;
        }

        return {
            week: adjustedWeek,
            value: entry.skills[skillName],
            date: date
        };
    });

    // Deduplicate: If we have multiple entries for the same adjustedWeek, take the LATEST one.
    const bestPointsMap = new Map<number, { week: number, value: any, date: Date }>();

    for (const p of rawPoints) {
        // Fix: Exclude future data points
        if (p.date > new Date()) continue;

        if (isNaN(p.week) || p.week <= 0 || p.value === undefined || p.value === null) continue;

        const existing = bestPointsMap.get(p.week);
        if (!existing) {
            bestPointsMap.set(p.week, p);
        } else {
            if (p.date > existing.date) {
                bestPointsMap.set(p.week, p);
            }
        }
    }

    let sortedPoints = Array.from(bestPointsMap.values())
        .sort((a, b) => a.week - b.week)
        .map(p => ({ week: p.week, value: p.value }));

    // Fix: Detect "Bad Backfill" data.
    const fluctuatingSkills = ['form', 'stamina', 'teamwork', 'tacticalDiscipline'];
    const isFluctuating = fluctuatingSkills.some(s => skillName.toLowerCase().includes(s));

    if (!isFluctuating && sortedPoints.length > 2) {
        const latestVal = sortedPoints[sortedPoints.length - 1].value;
        let firstValidIndex = 0;
        let potentialBadSequence = true;

        for (let i = 0; i < sortedPoints.length - 1; i++) {
            const val = sortedPoints[i].value;

            if (val !== latestVal) {
                if (val < latestVal) {
                    firstValidIndex = i;
                }
                potentialBadSequence = false;
                break;
            }
        }

        if (!potentialBadSequence) {
            if (firstValidIndex > 0) {
                sortedPoints = sortedPoints.slice(firstValidIndex);
            }
        }
    }

    return sortedPoints;
}

/**
 * Shows the tooltip at specific coordinates with data.
 * @param {number} x - pageX
 * @param {number} y - pageY
 * @param {number} playerId 
 * @param {string} skillName 
 */
export async function showTooltip(x: number, y: number, playerId: number, skillName: string): Promise<void> {
    if (!tooltip) createTooltip();

    // Cancel any pending hide
    cancelHide();

    // Initial position
    updatePosition(x, y);
    if (tooltip) tooltip.style.display = 'block';

    const dataPoints = await fetchChartData(playerId, skillName);

    if (canvas && dataPoints && dataPoints.length > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            drawChart(ctx, dataPoints, canvas.width, canvas.height);
        }

        // Update Zoom Button
        if (zoomBtn) {
            zoomBtn.style.display = 'block';
            zoomBtn.onclick = (e) => {
                // e.stopPropagation(); // Not needed since tooltip has pointer-events: none, but button has auto.
                createZoomModal(dataPoints, skillName);
            };
        }

    } else if (canvas) {
        // Clear canvas or show "No Data"
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.fillText('No history data', 10, 50);
        }
        if (zoomBtn) zoomBtn.style.display = 'none';
    }
}

/**
 * Opens the Zoom Modal directly for a player's skill.
 * @param {number} playerId 
 * @param {string} skillName 
 */
export async function openZoomChart(playerId: number, skillName: string): Promise<void> {
    const dataPoints = await fetchChartData(playerId, skillName);
    if (dataPoints && dataPoints.length > 0) {
        createZoomModal(dataPoints, skillName);
    } else {
        alert('No history data available for this skill.');
    }
}

let hideTimeout: number | null = null;

/**
 * Updates tooltip position.
 * @param {number} x 
 * @param {number} y 
 */
export function updatePosition(x: number, y: number): void {
    if (!tooltip) return;
    // Offset to not cover cursor
    tooltip.style.left = (x + 15) + 'px';
    tooltip.style.top = (y + 15) + 'px';
}

/**
 * Hides the tooltip immediately.
 */
export function hideTooltip(): void {
    if (tooltip) {
        tooltip.style.display = 'none';

        // Reset zoom button state if needed
        if (zoomBtn) zoomBtn.style.display = 'none';
    }
}

/**
 * Schedules hiding the tooltip with a delay.
 * Allows user to move mouse over the tooltip.
 */
export function scheduleHide(): void {
    if (hideTimeout) window.clearTimeout(hideTimeout);
    hideTimeout = window.setTimeout(() => {
        hideTooltip();
    }, 300); // 300ms delay
}

/**
 * Cancels a scheduled hide.
 */
export function cancelHide(): void {
    if (hideTimeout) {
        window.clearTimeout(hideTimeout);
        hideTimeout = null;
    }
}

/**
 * Creates and shows a full-screen modal with the zoomed chart.
 * @param {Array<{week: number, value: number}>} dataPoints 
 * @param {string} skillName 
 */
function createZoomModal(dataPoints: Array<{ week: number, value: number }>, skillName: string): void {
    const modalId = 'sokker-plus-zoom-modal';
    let modal = document.getElementById(modalId);

    if (modal) {
        document.body.removeChild(modal);
    }

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    modal.style.zIndex = '100000';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.flexDirection = 'column';

    // Close on click outside
    modal.onclick = (e) => {
        if (e.target === modal) document.body.removeChild(modal as HTMLElement);
    };

    const container = document.createElement('div');
    container.style.backgroundColor = '#222';
    container.style.padding = '20px';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
    container.style.textAlign = 'center';
    container.style.border = '1px solid #444';

    const title = document.createElement('h2');
    title.innerText = `${skillName.toUpperCase()} - History Detail`;
    title.style.color = '#fff';
    title.style.marginBottom = '20px';
    title.style.marginTop = '0';
    container.appendChild(title);

    const modalCanvas = document.createElement('canvas');
    modalCanvas.width = 800;
    modalCanvas.height = 400;
    modalCanvas.style.backgroundColor = '#111';
    modalCanvas.style.border = '1px solid #333';
    container.appendChild(modalCanvas);

    const closeBtn = document.createElement('button');
    closeBtn.innerText = 'Close';
    closeBtn.style.marginTop = '20px';
    closeBtn.style.padding = '10px 20px';
    closeBtn.style.backgroundColor = '#444';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
    };
    container.appendChild(closeBtn);

    modal.appendChild(container);
    document.body.appendChild(modal);

    const ctx = modalCanvas.getContext('2d');
    if (ctx) {
        drawChart(ctx, dataPoints, modalCanvas.width, modalCanvas.height, {
            forceYRange: [0, 18],
            showAllXLabels: true,
            showGrid: true
        });
    }
}
