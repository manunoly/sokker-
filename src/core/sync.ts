import { fetchCurrentWeek, fetchTrainingData } from './api';
import { initDB, getLastSyncWeek, saveWeekData, isWeekSynced } from './repository';

const MAX_WEEKS_TO_FETCH = 25;

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
        await initDB();

        const currentWeek = await fetchCurrentWeek();
        const lastSyncWeek = await getLastSyncWeek();

        // console.log(`Sync Check: Current Week ${currentWeek}, Last Synced ${lastSyncWeek}`);

        // Logic:
        // 1. We want to sync up to MAX_WEEKS_TO_FETCH weeks back from currentWeek.
        // 2. We do NOT want to overwrite or re-fetch weeks we already have (isWeekSynced).
        // 3. We do NOT want to fetch older than (currentWeek - MAX_WEEKS_TO_FETCH).

        // 1. Refresh Last Stored Week (if it exists and is < currentWeek)
        // This ensures the baseline is up-to-date (e.g., Thursday update for previous week)
        if (lastSyncWeek && lastSyncWeek < currentWeek) {
            // console.log(`Refreshing baseline week: ${lastSyncWeek}`);
            const baselineData = await fetchTrainingData(lastSyncWeek);
            if (baselineData && baselineData.length > 0) {
                await saveWeekData(lastSyncWeek, baselineData);
                // console.log(`Refreshed baseline week ${lastSyncWeek}`);
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
                alreadySynced: await isWeekSynced(week)
            }))
        );

        const weeksToSync: number[] = pastWeekStates
            .filter((state) => !state.alreadySynced)
            .map((state) => state.week);

        // Current week must always sync to capture intra-week updates.
        weeksToSync.push(currentWeek);

        if (weeksToSync.length === 0) {
            return { status: 'up-to-date', week: currentWeek, weeks: 0, lastWeek: currentWeek };
        }

        // Fetch and save sequentially
        for (const week of weeksToSync) {
            const playersData = await fetchTrainingData(week);
            if (playersData && playersData.length > 0) {
                await saveWeekData(week, playersData);
                // console.log(`Synced week ${week}: ${playersData.length} players`);
            } else {
                console.warn(`No data found for week ${week}`);
            }
        }

        return { status: 'synced', weeks: weeksToSync.length, lastWeek: currentWeek };

    } catch (error) {
        console.error('Sync failed:', error);
        throw error;
    }
}
