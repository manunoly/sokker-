/**
 * IndexedDB Wrapper using closures.
 * No classes, no external dependencies.
 */

import { PlayerData, PlayerHistoryEntry, SnapshotSource } from '../types/index';
import { extractTrainingReport } from './trainingReport';
import type { JuniorPoint, JuniorRecord } from './juniorTypes';

const DB_NAME = 'SokkerTalentTrackerDB';
const DB_VERSION = 3;
const STORE_PLAYERS = 'players';
const STORE_META = 'metadata';
const STORE_WEEKS = 'weeks'; // New store
const STORE_JUNIORS = 'juniors';
export const JUNIOR_WRITE_GENERATION_KEY = 'juniorWriteGeneration';

let db: IDBDatabase | null = null;
let openingDb: Promise<IDBDatabase> | null = null;

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

export interface BackupData {
    players?: PlayerData[];
    metadata?: Array<{ key: string } & Record<string, unknown>>;
    weeks?: Array<{ week: number } & Record<string, unknown>>;
    juniors?: JuniorRecord[];
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPositiveId = (v: unknown): v is number =>
    typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

function isValidJuniorPoint(value: unknown): value is JuniorPoint {
    return isObject(value)
        && typeof value.x === 'number' && Number.isSafeInteger(value.x)
        && isFiniteNumber(value.y) && value.y >= 0 && value.y <= 18
        && (value.scale === undefined || isFiniteNumber(value.scale))
        && value.source === 'graph';
}

function isValidJuniorRecord(value: unknown): value is JuniorRecord {
    if (!isObject(value)) return false;
    const hasNativeWeek = value.nativeTalentWeek === null || isPositiveId(value.nativeTalentWeek);
    const hasGraphWeek = value.graphWeek === undefined || value.graphWeek === null || isPositiveId(value.graphWeek);
    const hasWeeksLeft = value.weeksLeft === undefined || value.weeksLeft === null ||
        (typeof value.weeksLeft === 'number' && Number.isSafeInteger(value.weeksLeft) && value.weeksLeft >= 0);
    const hasResolvedWeek = value.resolvedWeek === null || isPositiveId(value.resolvedWeek);
    const validResolution = value.resolution === null ||
        value.resolution === 'graph' || value.resolution === 'absent' || value.resolution === 'unknown';
    return isPositiveId(value.teamId)
        && isPositiveId(value.juniorId)
        && Array.isArray(value.points) && value.points.every(isValidJuniorPoint)
        && (value.nativeTalent === null || isFiniteNumber(value.nativeTalent))
        && hasNativeWeek
        && hasGraphWeek
        && hasWeeksLeft
        && (value.nativeTalent === null || value.nativeTalentWeek !== null)
        && hasResolvedWeek && validResolution
        && (value.resolvedWeek === null) === (value.resolution === null);
}

function isValidJuniorSection(value: unknown): boolean {
    if (value === undefined) return true;
    if (!Array.isArray(value) || !value.every(isValidJuniorRecord)) return false;
    const keys = new Set<string>();
    for (const record of value as JuniorRecord[]) {
        const key = `${record.teamId}:${record.juniorId}`;
        if (keys.has(key)) return false;
        keys.add(key);
    }
    return true;
}

/** A restore adds missing observations, with the already stored observation winning a collision. */
export function mergeRestoredJuniorRecord(local: JuniorRecord | undefined, backup: JuniorRecord): JuniorRecord {
    const points = new Map<number, JuniorPoint>();
    for (const point of backup.points) points.set(point.x, { ...point });
    for (const point of local?.points ?? []) points.set(point.x, { ...point });

    const localTalentIsNewer = local?.nativeTalentWeek != null &&
        (backup.nativeTalentWeek == null || local.nativeTalentWeek >= backup.nativeTalentWeek);
    const talentSource = localTalentIsNewer ? local! : backup;
    const weeksLeft = talentSource.weeksLeft ??
        (localTalentIsNewer && local?.nativeTalentWeek != null &&
            local.nativeTalentWeek === backup.nativeTalentWeek ? backup.weeksLeft ?? null : null);
    // Local markers retain their local roster context. Imported absence/unknown markers
    // lose their roster context because backup snapshots are never restored.
    const resolutionSource = local ?? backup;
    const hasReliableResolution = !!local || resolutionSource.resolution === 'graph';
    const graphWeekOf = (record: JuniorRecord | undefined): number | null =>
        record?.graphWeek ?? (record?.resolution === 'graph' ? record.resolvedWeek : null);
    const graphWeek = Math.max(graphWeekOf(local) ?? 0, graphWeekOf(backup) ?? 0) || null;

    return {
        teamId: backup.teamId,
        juniorId: backup.juniorId,
        points: [...points.values()].sort((a, b) => a.x - b.x),
        nativeTalent: talentSource.nativeTalent,
        nativeTalentWeek: talentSource.nativeTalentWeek,
        weeksLeft,
        graphWeek,
        resolvedWeek: hasReliableResolution ? resolutionSource.resolvedWeek : null,
        resolution: hasReliableResolution ? resolutionSource.resolution : null
    };
}

function isValidHistoryEntry(value: unknown): boolean {
    return isObject(value)
        && isFiniteNumber(value.week)
        && isObject(value.skills)
        && Object.values(value.skills).every(isFiniteNumber);
}

function isValidPlayerRecord(value: unknown): boolean {
    return isObject(value)
        && isFiniteNumber(value.id)
        && typeof value.name === 'string'
        && Array.isArray(value.history)
        && value.history.every(isValidHistoryEntry);
}

const isArrayOf = (value: unknown, check: (item: unknown) => boolean): boolean =>
    value === undefined || (Array.isArray(value) && value.every(check));

export function isValidBackupData(data: unknown): data is BackupData {
    return isObject(data)
        && isArrayOf(data.players, isValidPlayerRecord)
        && isArrayOf(data.metadata, (m) => isObject(m) && typeof m.key === 'string')
        && isArrayOf(data.weeks, (w) => isObject(w) && isFiniteNumber(w.week))
        && isValidJuniorSection(data.juniors);
}

/**
 * Initializes the IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
export const initDB = (): Promise<IDBDatabase> => {
    if (db) return Promise.resolve(db);
    if (openingDb) return openingDb;

    openingDb = new Promise<IDBDatabase>((resolve, reject) => {
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

            if (!database.objectStoreNames.contains(STORE_JUNIORS)) {
                database.createObjectStore(STORE_JUNIORS, { keyPath: ['teamId', 'juniorId'] });
            }
        };

        request.onsuccess = (event: Event) => {
            db = (event.target as IDBOpenDBRequest).result;
            const connection = db;
            connection.onversionchange = () => {
                connection.close();
                if (db === connection) db = null;
            };
            // console.log('Sokker++ DB Initialized');
            resolve(db);
        };

        request.onerror = (event: Event) => {
            console.error('Sokker++ DB Error:', (event.target as IDBOpenDBRequest).error);
            reject((event.target as IDBOpenDBRequest).error);
        };
    }).finally(() => { openingDb = null; });
    return openingDb;
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
 * Records a past week that returned no training data, so sync stops re-requesting it.
 * Does not touch lastSyncWeek or player records.
 */
export const markWeekEmpty = async (week: number): Promise<void> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        const transaction = db.transaction([STORE_WEEKS], 'readwrite');
        transaction.objectStore(STORE_WEEKS).put({ week, syncedAt: new Date().toISOString(), empty: true });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
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
export const getAllData = async (): Promise<BackupData> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        const transaction = db.transaction([STORE_PLAYERS, STORE_META, STORE_WEEKS, STORE_JUNIORS], 'readonly');

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

        const juniorsPromise = new Promise<JuniorRecord[]>((res, rej) => {
            const req = transaction.objectStore(STORE_JUNIORS).getAll();
            req.onsuccess = () => res(req.result as JuniorRecord[]);
            req.onerror = () => rej(req.error);
        });

        Promise.all([playersPromise, metaPromise, weeksPromise, juniorsPromise])
            .then(([players, metadata, weeks, juniors]) => resolve({
                players: players as PlayerData[],
                metadata: metadata as BackupData['metadata'],
                weeks: weeks as BackupData['weeks'],
                juniors
            }))
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
        const nextJuniorGeneration = crypto.randomUUID();
        const transaction = db.transaction([STORE_PLAYERS, STORE_META, STORE_WEEKS, STORE_JUNIORS], 'readwrite');

        const playerStore = transaction.objectStore(STORE_PLAYERS);
        data.players?.forEach((p) => playerStore.put(p));

        const metaStore = transaction.objectStore(STORE_META);
        // The backup cannot prove a roster snapshot is current. Keep local snapshots,
        // but do not import a snapshot whose age and membership may be uncertain.
        data.metadata?.forEach((m) => {
            if (!m.key.startsWith('juniorRoster:') && m.key !== JUNIOR_WRITE_GENERATION_KEY) metaStore.put(m);
        });
        // A restored backup never revives a sync that began before this transaction.
        metaStore.put({ key: JUNIOR_WRITE_GENERATION_KEY, value: nextJuniorGeneration });

        const weekStore = transaction.objectStore(STORE_WEEKS);
        data.weeks?.forEach((w) => weekStore.put(w));

        const juniorStore = transaction.objectStore(STORE_JUNIORS);
        data.juniors?.forEach((record) => {
            const request = juniorStore.get([record.teamId, record.juniorId]);
            request.onsuccess = () => {
                juniorStore.put(mergeRestoredJuniorRecord(request.result as JuniorRecord | undefined, record));
            };
        });

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
        const nextJuniorGeneration = crypto.randomUUID();
        const transaction = db.transaction([STORE_PLAYERS, STORE_META, STORE_WEEKS, STORE_JUNIORS], 'readwrite');

        transaction.objectStore(STORE_PLAYERS).clear();
        transaction.objectStore(STORE_META).clear();
        transaction.objectStore(STORE_WEEKS).clear();
        transaction.objectStore(STORE_JUNIORS).clear();
        transaction.objectStore(STORE_META).put({ key: JUNIOR_WRITE_GENERATION_KEY, value: nextJuniorGeneration });

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
