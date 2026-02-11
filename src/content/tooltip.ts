import { drawChart } from '../ui-components/canvas';
import { getPlayerHistory } from '../core/repository';

let tooltip: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;

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

    document.body.appendChild(tooltip);
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

    // Initial position
    updatePosition(x, y);
    if (tooltip) tooltip.style.display = 'block';

    // Fetch data for the graph
    // We assume we want to show history for this specific skill
    const playerHistory = await getPlayerHistory(playerId);

    if (canvas && playerHistory && playerHistory.history) {
        // Prepare and validate data points
        // Prepare and validate data points
        // Fix: Adjust week based on training day (Thursday) to avoid "extra week" effect for pre-training data.
        // Logic: 
        // - Week starts on Saturday in Sokker.
        // - Training is on Thursday.
        // - Data from Sat, Sun, Mon, Tue, Wed belongs to the *previous* training cycle (or rather, is just the old value).
        // - Data from Thu, Fri is the new value.
        // So: If day is NOT Thu(4) or Fri(5), we treat it effectively as part of the "previous" week for charting purposes
        // or ensure we don't plot it as a separate "new level" if it's just the old level carried over.

        const rawPoints = playerHistory.history.map(entry => {
            const date = new Date(entry.date);
            const day = date.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat

            // If it's Thursday(4) or Friday(5), it's the "new" value for this week.
            // If it's Sat-Wed, it's the "old" value (pre-training).
            // Users want to see the progression of TRAINED values.
            // So if we have Week X (Mon), it is effectively Week X-1 level.
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
            // Fix: Exclude future data points (e.g. placeholder reports for upcoming Thursday)
            // If today is Wednesday and report date is Thursday, it hasn't happened yet.
            if (p.date > new Date()) continue;

            if (isNaN(p.week) || p.week <= 0 || p.value === undefined || p.value === null) continue;

            const existing = bestPointsMap.get(p.week);
            if (!existing) {
                bestPointsMap.set(p.week, p);
            } else {
                // Keep the one with the later date? 
                // Or if one is post-training (Thu/Fri) vs pre-training?
                // Actually, if we adjusted Week 11 Mon to Week 10, it effectively says "In Week 10 cycle, value was X".
                // If we also have Week 10 Thu, it says "In Week 10 cycle, value was Y".
                // We probably want the LATEST reading for that cycle.
                if (p.date > existing.date) {
                    bestPointsMap.set(p.week, p);
                }
            }
        }

        let sortedPoints = Array.from(bestPointsMap.values())
            .sort((a, b) => a.week - b.week)
            .map(p => ({ week: p.week, value: p.value }));

        // Fix: Detect "Bad Backfill" data.
        // Scenario: Code previously backfilled missing weeks with "current" skills.
        // Symptom: History starts with a flat line equal to CURRENT value, then drops to a lower real value, then rises again.
        // Logic: For CORE skills (not Form/Stamina), if start sequence == latest_value and then drops, discard start sequence.

        const fluctuatingSkills = ['form', 'stamina', 'teamwork', 'tacticalDiscipline']; // Experience only grows
        const isFluctuating = fluctuatingSkills.some(s => skillName.toLowerCase().includes(s));

        if (!isFluctuating && sortedPoints.length > 2) {
            const latestVal = sortedPoints[sortedPoints.length - 1].value;
            let firstValidIndex = 0;
            let potentialBadSequence = true;

            for (let i = 0; i < sortedPoints.length - 1; i++) {
                const val = sortedPoints[i].value;

                if (val !== latestVal) {
                    // Found a value different from latest.
                    if (val < latestVal) {
                        // We dropped! This confirms the previous sequence of "latestVal" was likely bad backfill.
                        // Because core skills generally don't drop from High(Latest) to Low then back to High(Latest) quickly.
                        // Especially if the first chunk was identical to latest.
                        firstValidIndex = i;
                    }
                    potentialBadSequence = false;
                    break;
                }
            }

            if (!potentialBadSequence) {
                // We detected a drop, so we apply the slice
                if (firstValidIndex > 0) {
                    // console.log(`[Sokker++] Filtered ${firstValidIndex} bad backfilled points for ${skillName}`);
                    sortedPoints = sortedPoints.slice(firstValidIndex);
                }
            }
        }

        const dataPoints = sortedPoints;

        // console.log(`[Sokker++] Tooltip Data for ${skillName}:`, dataPoints);

        if (dataPoints.length === 0) {
            // No valid data
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#fff';
                ctx.fillText('No valid history', 10, 50);
            }
            return;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
            drawChart(ctx, dataPoints, canvas.width, canvas.height);
        }
    } else if (canvas) {
        // Clear canvas or show "No Data"
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.fillText('No history data', 10, 50);
        }
    }
}

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
 * Hides the tooltip.
 */
export function hideTooltip(): void {
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}
