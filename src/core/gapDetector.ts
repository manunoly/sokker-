import { PlayerHistoryEntry } from '../types/index';

/**
 * Given a player's history (any source) and the current week, returns the list
 * of weeks that are missing between the player's first stored week and
 * currentWeek - 1 (exclusive of currentWeek itself).
 *
 * Rules:
 *  - If history is empty, returns [].
 *  - Only weeks strictly greater than min(history.week) and strictly less than
 *    currentWeek are considered (R3).
 *  - An entry whose source is 'carried-over' counts as filled and is NOT
 *    reported as a gap.
 */
export function findWeekGaps(
    history: PlayerHistoryEntry[],
    currentWeek: number
): number[] {
    if (history.length === 0) return [];
    const weeksPresent = new Set(history.map((h) => h.week));
    const firstWeek = Math.min(...history.map((h) => h.week));
    const gaps: number[] = [];
    for (let w = firstWeek + 1; w < currentWeek; w++) {
        if (!weeksPresent.has(w)) gaps.push(w);
    }
    return gaps;
}
