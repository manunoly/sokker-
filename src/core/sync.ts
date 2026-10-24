import { fetchTodayInfo, fetchTrainingData } from './apiClient';
import { ensureStorageReady, getWriteContext, getLastSyncWeek, saveWeekData, isWeekSynced, markWeekEmpty } from './storageClient';
import { reconcileGaps } from './gapDetector';
import { scheduleIdle } from '../utils/scheduleIdle';

export const MAX_WEEKS_TO_FETCH = 30;

interface SyncResult {
    status: 'synced' | 'up-to-date' | 'error';
    weeks?: number;
    week?: number;
    lastWeek?: number;
}

/**
 * Orchestrates the synchronization of player data.
 * @returns {Promise<SyncResult>} Status of the sync operation.
 */
export async function syncData(): Promise<SyncResult> {
    try {
        await ensureStorageReady();

        const today = await fetchTodayInfo();
        const currentWeek = today.week;
        const ctx = await getWriteContext(today.teamId);
        const lastSyncWeek = await getLastSyncWeek(today.teamId);

        // Logic:
        // 1. We want to sync up to MAX_WEEKS_TO_FETCH weeks back from currentWeek.
        // 2. We do NOT want to overwrite or re-fetch weeks we already have (isWeekSynced).
        // 3. We do NOT want to fetch older than (currentWeek - MAX_WEEKS_TO_FETCH).

        // 1. Refresh Last Stored Week (if it exists and is < currentWeek)
        // This ensures the baseline is up-to-date (e.g., Thursday update for previous week)
        if (lastSyncWeek && lastSyncWeek < currentWeek) {
            const baselineData = await fetchTrainingData(lastSyncWeek);
            if (baselineData && baselineData.length > 0) {
                await saveWeekData(ctx, lastSyncWeek, baselineData);
            }
        }

        // 2. Determine range to sync (fill gaps)
        let startWeek = currentWeek - MAX_WEEKS_TO_FETCH + 1;
        if (startWeek < 1) startWeek = 1;

        const candidatePastWeeks: number[] = [];
        for (let w = startWeek; w < currentWeek; w++) {
            candidatePastWeeks.push(w);
        }

        // For past weeks, only sync missing ones. Check in parallel to reduce latency.
        const pastWeekStates = await Promise.all(
            candidatePastWeeks.map(async (week) => ({
                week,
                alreadySynced: await isWeekSynced(today.teamId, week)
            }))
        );

        const weeksToSync: number[] = pastWeekStates
            .filter((state) => !state.alreadySynced)
            .map((state) => state.week);

        // Current week must always sync to capture intra-week updates.
        weeksToSync.push(currentWeek);

        // Fetch and save sequentially
        for (const week of weeksToSync) {
            const playersData = await fetchTrainingData(week);
            if (playersData && playersData.length > 0) {
                await saveWeekData(ctx, week, playersData);
            } else if (week < currentWeek) {
                // Past weeks never gain data later: remember them so we stop re-requesting them.
                await markWeekEmpty(ctx, week);
            } else {
                console.warn(`No data found for week ${week}`);
            }
        }

        // Pipeline B: best-effort, non-blocking. Runs after we've already returned
        // synced status to the caller. Failures here do not surface to the UI —
        // gap detection is an enhancement, not a correctness requirement.
        scheduleIdle(() => {
            reconcileGaps({ week: currentWeek, teamId: today.teamId, writeContext: ctx }).catch((err) => console.warn('reconcileGaps failed:', err));
        });

        return { status: 'synced', weeks: weeksToSync.length, lastWeek: currentWeek };

    } catch (error) {
        console.error('Sync failed:', error);
        throw error;
    }
}
