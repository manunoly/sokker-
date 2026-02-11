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

        let startWeek = currentWeek - MAX_WEEKS_TO_FETCH + 1;
        if (startWeek < 1) startWeek = 1;

        // If we have a lastSyncWeek that is recent, we might want to start from there + 1.
        // But the requirement effectively says: ensure last 5 weeks are Present.
        // Whether we have gap before that doesn't matter for this specific "development mode limit".

        const weeksToSync: number[] = [];

        for (let w = startWeek; w <= currentWeek; w++) {
            // Check if we already have it
            const alreadySynced = await isWeekSynced(w);
            if (!alreadySynced) {
                weeksToSync.push(w);
            }
        }

        if (weeksToSync.length === 0) {
            // console.log('All recent weeks are already synced.');
            return { status: 'up-to-date', week: currentWeek, weeks: 0, lastWeek: currentWeek };
        }

        // console.log(`Syncing missing weeks: ${weeksToSync.join(', ')}`);

        // Fetch and save sequentially
        for (const week of weeksToSync) {
            const playersData = await fetchTrainingData(week);
            if (playersData && playersData.length > 0) {
                await saveWeekData(week, playersData);
                console.log(`Synced week ${week}: ${playersData.length} players`);
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
