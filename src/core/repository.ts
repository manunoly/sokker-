/**
 * IndexedDB Wrapper using closures.
 * No classes, no external dependencies.
 */

import { PlayerData, PlayerHistoryEntry, SnapshotSource } from '../types/index';
import { extractTrainingReport } from './trainingReport';

const DB_NAME = 'SokkerTalentTrackerDB';
const DB_VERSION = 2; // Incremented version for new store
const STORE_PLAYERS = 'players';
const STORE_META = 'metadata';
const STORE_WEEKS = 'weeks'; // New store

let db: IDBDatabase | null = null;

/**
 * Pure helper that merges one week's stats into a player record.
 *
 * Invariants:
 *  - R1: a 'training' entry is never overwritten by a 'carried-over' entry.
 *  - R2: a 'training' entry upgrades an existing 'carried-over' entry for the
 *        same week. A 'carried-over' entry never overwrites another
 *        'carried-over' entry (first write wins).
 *  - Migration: legacy entries without a `source` field are treated as
 *    'training' (they came from the training endpoint before this feature).
 */
export const upsertPlayerWeekRecord = (
    existingRecord: PlayerData | undefined,
    playerId: number,
    playerName: string,
    weekStats: PlayerHistoryEntry
): PlayerData => {
    const record: PlayerData = existingRecord ? {
        ...existingRecord,
        history: [...existingRecord.history]
    } : {
        id: playerId,
        name: playerName,
        latest: weekStats,
        history: []
    };

    const existingIndex = record.history.findIndex(h => h.week === weekStats.week);
    if (existingIndex !== -1) {
        const existing = record.history[existingIndex];
        const existingSource: SnapshotSource = existing.source ?? 'training';
        const incomingSource: SnapshotSource = weekStats.source ?? 'training';

        const isUpgrade = existingSource !== 'training' && incomingSource === 'training';
        const isSameTraining = existingSource === 'training' && incomingSource === 'training';

        if (isUpgrade || isSameTraining) {
            record.history[existingIndex] = weekStats;
        }
        // Otherwise (training already in place vs carried-over incoming, or
        // carried-over vs carried-over): keep existing. R1 protects training;
        // first carry-over wins.
    } else {
        record.history.push(weekStats);
    }

    record.history.sort((a, b) => a.week - b.week);

    // Recompute latest as the entry with the highest week after merge.
    record.latest = record.history[record.history.length - 1] ?? weekStats;

    return record;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidBackupData(data: unknown): data is { players?: unknown[]; metadata?: unknown[]; weeks?: unknown[] } {
    if (!isObject(data)) return false;
    if (data.players !== undefined && !Array.isArray(data.players)) return false;
    if (data.metadata !== undefined && !Array.isArray(data.metadata)) return false;
    if (data.weeks !== undefined && !Array.isArray(data.weeks)) return false;
    return true;
}

/**
 * Initializes the IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Store for Player History: id -> { id, name, history: [{week, skills...}] }
            if (!database.objectStoreNames.contains(STORE_PLAYERS)) {
                database.createObjectStore(STORE_PLAYERS, { keyPath: 'id' });
            }

            // Store for Metadata: key -> value
            if (!database.objectStoreNames.contains(STORE_META)) {
                database.createObjectStore(STORE_META, { keyPath: 'key' });
            }

            // Store for Weeks: week -> { week, syncedAt }
            if (!database.objectStoreNames.contains(STORE_WEEKS)) {
                database.createObjectStore(STORE_WEEKS, { keyPath: 'week' });
            }
        };

        request.onsuccess = (event: Event) => {
            db = (event.target as IDBOpenDBRequest).result;
            // console.log('Sokker++ DB Initialized');
            resolve(db);
        };

        request.onerror = (event: Event) => {
            console.error('Sokker++ DB Error:', (event.target as IDBOpenDBRequest).error);
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
};

/**
 * Saves training data for a specific week.
 * Updates player history appending the new week's data.
 * @param {number} week 
 * @param {any[]} playersDataFromArray 
 * @returns {Promise<void>}
 */
export const saveWeekData = async (week: number, playersDataFromArray: any[]): Promise<void> => {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));

        const transaction = db.transaction([STORE_PLAYERS, STORE_META, STORE_WEEKS], 'readwrite');
        const playerStore = transaction.objectStore(STORE_PLAYERS);
        const metaStore = transaction.objectStore(STORE_META);
        const weekStore = transaction.objectStore(STORE_WEEKS);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject((e.target as IDBTransaction).error);

        // Update Metadata
        metaStore.put({ key: 'lastSyncWeek', value: week });

        // Mark week as synced
        weekStore.put({ week: week, syncedAt: new Date().toISOString() });

        // Process each player
        playersDataFromArray.forEach((entry: any) => {
            const playerId = entry.id;

            const report = entry.report;
            if (!report || !report.skills || (report.kind && (report.kind.name === 'missing' || report.kind.code === 3))) {
                return;
            }

            const injury = entry.player.injury;
            const injuryDays = typeof injury?.daysRemaining === 'number' ? injury.daysRemaining : 0;
            const training = extractTrainingReport(report);
            const weekStats: PlayerHistoryEntry = {
                week: week,
                date: report.day?.date?.value || new Date().toISOString().slice(0, 10),
                skills: report.skills,
                value: entry.player.value.value,
                source: 'training',
                injured: injuryDays > 0,
                ...(injury ? { injury } : {}),
                ...(training ? { training } : {})
            };

            const getRequest = playerStore.get(playerId);
            getRequest.onsuccess = () => {
                const record = upsertPlayerWeekRecord(
                    getRequest.result as PlayerData | undefined,
                    playerId,
                    entry.player.name.full,
                    weekStats
                );

                playerStore.put(record);
            };
        });
    });
};

/**
 * Retrieves the last synchronized week number.
 * @returns {Promise<number|null>}
 */
export const getLastSyncWeek = async (): Promise<number | null> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        const transaction = db.transaction([STORE_META], 'readonly');
        const store = transaction.objectStore(STORE_META);
        const request = store.get('lastSyncWeek');

        request.onsuccess = () => {
            resolve(request.result ? request.result.value : null);
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Checks if a week is already synced.
 * @param {number} week 
 * @returns {Promise<boolean>}
 */
export const isWeekSynced = async (week: number): Promise<boolean> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        if (!db) return resolve(false);
        const transaction = db.transaction([STORE_WEEKS], 'readonly');
        const store = transaction.objectStore(STORE_WEEKS);
        const request = store.get(week);

        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => resolve(false);
    });
};

/**
 * Retrieves every player record from the store. Used by the gap detector to
 * locate weeks missing from each roster player's history.
 */
export const getAllPlayers = async (): Promise<PlayerData[]> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        const transaction = db.transaction([STORE_PLAYERS], 'readonly');
        const store = transaction.objectStore(STORE_PLAYERS);
        const request = store.getAll();

        request.onsuccess = () => resolve((request.result as PlayerData[]) ?? []);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Retrieves history for a specific player.
 * @param {number} playerId
 * @returns {Promise<PlayerData|null>}
 */
export const getPlayerHistory = async (playerId: number): Promise<PlayerData | null> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        const transaction = db.transaction([STORE_PLAYERS], 'readonly');
        const store = transaction.objectStore(STORE_PLAYERS);
        const request = store.get(Number(playerId)); // Ensure numeric ID

        request.onsuccess = () => resolve(request.result as PlayerData);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Exports all data for backup.
 * @returns {Promise<Object>}
 */
export const getAllData = async (): Promise<any> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        // Need to include weeks store in export potentially, but simplified for now.
        // Or fail gracefully if not needed.
        // Let's include it.
        const transaction = db.transaction([STORE_PLAYERS, STORE_META, STORE_WEEKS], 'readonly');

        const playersPromise = new Promise((res, rej) => {
            const req = transaction.objectStore(STORE_PLAYERS).getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });

        const metaPromise = new Promise((res, rej) => {
            const req = transaction.objectStore(STORE_META).getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });

        const weeksPromise = new Promise((res, rej) => {
            const req = transaction.objectStore(STORE_WEEKS).getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });

        Promise.all([playersPromise, metaPromise, weeksPromise])
            .then(([players, metadata, weeks]) => resolve({ players, metadata, weeks }))
            .catch(reject);
    });
};

/**
 * Imports data from backup.
 * @param {Object} data 
 */
export const restoreData = async (data: unknown): Promise<void> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        if (!isValidBackupData(data)) return reject(new Error('Invalid backup format'));
        const transaction = db.transaction([STORE_PLAYERS, STORE_META, STORE_WEEKS], 'readwrite');

        const playerStore = transaction.objectStore(STORE_PLAYERS);
        if (data.players) {
            data.players.forEach((p: any) => playerStore.put(p));
        }

        const metaStore = transaction.objectStore(STORE_META);
        if (data.metadata) {
            data.metadata.forEach((m: any) => metaStore.put(m));
        }

        const weekStore = transaction.objectStore(STORE_WEEKS);
        if (data.weeks) {
            data.weeks.forEach((w: any) => weekStore.put(w));
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
};

/**
 * Clears the entire database (all stores).
 * @returns {Promise<void>}
 */
export const clearDatabase = async (): Promise<void> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        const transaction = db.transaction([STORE_PLAYERS, STORE_META, STORE_WEEKS], 'readwrite');

        transaction.objectStore(STORE_PLAYERS).clear();
        transaction.objectStore(STORE_META).clear();
        transaction.objectStore(STORE_WEEKS).clear();

        transaction.oncomplete = () => {
            console.log('Database cleared completely.');
            resolve();
        };
        transaction.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
};

/**
 * Persists a single PlayerHistoryEntry produced by Pipeline B. Delegates the
 * R1/R2 enforcement to upsertPlayerWeekRecord. Intended to be called with
 * entries whose source is 'carried-over' or 'roster-fallback'.
 */
export const savePlayerCarryOverEntry = async (
    playerId: number,
    playerName: string,
    entry: PlayerHistoryEntry
): Promise<void> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        const transaction = db.transaction([STORE_PLAYERS], 'readwrite');
        const store = transaction.objectStore(STORE_PLAYERS);

        const getRequest = store.get(playerId);
        getRequest.onsuccess = () => {
            const record = upsertPlayerWeekRecord(
                getRequest.result as PlayerData | undefined,
                playerId,
                playerName,
                entry
            );
            store.put(record);
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
};
