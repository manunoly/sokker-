import { PlayerHistoryEntry, PlayerData, RosterPlayer } from '../types/index';
import { fetchRoster, fetchTodayInfo } from './api';
import { getAllPlayers, savePlayerCarryOverEntry } from './repository';

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

export interface ReconcileContext {
    week: number;
    teamId: number;
}

export interface ReconcileDeps {
    fetchCurrentContext: () => Promise<ReconcileContext>;
    fetchRoster: (teamId: number) => Promise<RosterPlayer[]>;
    getAllPlayers: () => Promise<PlayerData[]>;
    savePlayerCarryOverEntry: (
        playerId: number,
        playerName: string,
        entry: PlayerHistoryEntry
    ) => Promise<void>;
}

export interface ReconcileResult {
    scannedPlayers: number;
    rosterSize: number;
    gapsFilled: number;
    skipped: {
        noHistory: number;
        notInRoster: number;
    };
    error?: string;
}

/**
 * Pure orchestrator: iterates over roster players, finds gaps in their stored
 * history, builds carry-over entries cloning skills from N-1 (cascading if the
 * preceding week was itself just filled in this same pass), and persists them.
 *
 * Respects R1 (never overwrites training), R2 (save helper enforces it), R3
 * (skips currentWeek and anything before firstStoredWeek), R4 (ignores
 * ex-players not in roster).
 *
 * All dependencies are injected so this function is testable without real IO.
 */
export async function reconcileGapsWithDeps(deps: ReconcileDeps): Promise<ReconcileResult> {
    const result: ReconcileResult = {
        scannedPlayers: 0,
        rosterSize: 0,
        gapsFilled: 0,
        skipped: { noHistory: 0, notInRoster: 0 }
    };

    try {
        const ctx = await deps.fetchCurrentContext();
        const roster = await deps.fetchRoster(ctx.teamId);
        const stored = await deps.getAllPlayers();

        result.rosterSize = roster.length;

        const storedById = new Map<number, PlayerData>();
        for (const p of stored) storedById.set(p.id, p);

        const rosterIds = new Set(roster.map((r) => r.id));
        for (const p of stored) {
            if (!rosterIds.has(p.id)) result.skipped.notInRoster++;
        }

        for (const rp of roster) {
            result.scannedPlayers++;
            const storedPlayer = storedById.get(rp.id);
            if (!storedPlayer || storedPlayer.history.length === 0) {
                result.skipped.noHistory++;
                continue;
            }

            const history = [...storedPlayer.history].sort((a, b) => a.week - b.week);
            const gaps = findWeekGaps(history, ctx.week);

            if (gaps.length === 0) continue;

            // Cascade: work in-order so a carry-over written for week W can be used
            // as the N-1 for week W+1 in the same pass.
            const workingHistory = [...history];
            for (const gap of gaps) {
                const prev = workingHistory.find((h) => h.week === gap - 1);
                if (!prev) continue;
                const next = workingHistory.find((h) => h.week === gap + 1);
                const injured = inferInjury(prev, next);
                const carryOver = buildCarryOverEntry(prev, gap, injured);
                await deps.savePlayerCarryOverEntry(rp.id, rp.info.name.full, carryOver);
                workingHistory.push(carryOver);
                workingHistory.sort((a, b) => a.week - b.week);
                result.gapsFilled++;
            }
        }

        return result;
    } catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
        return result;
    }
}

/**
 * Production wrapper. Wires reconcileGapsWithDeps against live
 * repository + API dependencies.
 */
export async function reconcileGaps(): Promise<ReconcileResult> {
    return reconcileGapsWithDeps({
        fetchCurrentContext: async () => {
            const info = await fetchTodayInfo();
            return { week: info.week, teamId: info.teamId };
        },
        fetchRoster,
        getAllPlayers,
        savePlayerCarryOverEntry
    });
}
