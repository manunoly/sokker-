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

/**
 * Conservative injury inference for a gap week N. Returns:
 *  - true  when prev (N-1) had daysRemaining >= 7 (the injury covered N),
 *          or next (N+1) has any active injury (>0 days remaining).
 *  - undefined otherwise. Never returns false: absence of evidence is not
 *    evidence of absence.
 */
export function inferInjury(
    prev: PlayerHistoryEntry | undefined,
    next: PlayerHistoryEntry | undefined
): boolean | undefined {
    const prevDays = prev?.injury?.daysRemaining ?? 0;
    if (prevDays >= 7) return true;
    const nextDays = next?.injury?.daysRemaining ?? 0;
    if (nextDays > 0) return true;
    return undefined;
}

/**
 * Builds a carried-over PlayerHistoryEntry for week `targetWeek` by cloning
 * skills and value from `prev`. Never mutates `prev`. The `date` is shifted
 * forward 7 days when `prev.date` is a parseable ISO date; otherwise it
 * falls back to `prev.date` verbatim (we refuse to fabricate a date).
 */
export function buildCarryOverEntry(
    prev: PlayerHistoryEntry,
    targetWeek: number,
    injured: boolean | undefined
): PlayerHistoryEntry {
    const prevTs = Date.parse(prev.date);
    const date = Number.isFinite(prevTs)
        ? new Date(prevTs + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : prev.date;

    const entry: PlayerHistoryEntry = {
        week: targetWeek,
        date,
        skills: { ...prev.skills },
        value: prev.value,
        source: 'carried-over',
        reason: 'missing-report'
    };
    if (injured === true) entry.injured = true;
    return entry;
}
