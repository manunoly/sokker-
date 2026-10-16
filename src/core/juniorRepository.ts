import type { JuniorPoint, JuniorRecord, JuniorResolution, JuniorRosterEntry, JuniorRosterSnapshot } from './juniorTypes';
import { initDB, JUNIOR_WRITE_GENERATION_KEY } from './repository';

const STORE_JUNIORS = 'juniors';
const STORE_META = 'metadata';

const rosterKey = (teamId: number): string => `juniorRoster:${teamId}`;

/** A null generation represents a database that has never been cleared or restored. */
export const getJuniorWriteGeneration = async (): Promise<string | null> =>
    transact<string | null>([STORE_META], 'readonly', (transaction, setResult) => {
        const request = transaction.objectStore(STORE_META).get(JUNIOR_WRITE_GENERATION_KEY);
        request.onsuccess = () => {
            const value = request.result?.value;
            setResult(typeof value === 'string' ? value : null);
        };
    });

/** Read and compare under the same write lock as the juvenile save. */
const withExpectedGeneration = (
    transaction: IDBTransaction,
    expectedGeneration: string | null,
    write: () => void
): void => {
    const request = transaction.objectStore(STORE_META).get(JUNIOR_WRITE_GENERATION_KEY);
    request.onsuccess = () => {
        const value = request.result?.value;
        const currentGeneration = typeof value === 'string' ? value : null;
        if (currentGeneration !== expectedGeneration) {
            transaction.abort();
            return;
        }
        write();
    };
};

const emptyRecord = (teamId: number, juniorId: number): JuniorRecord => ({
    teamId,
    juniorId,
    points: [],
    nativeTalent: null,
    nativeTalentWeek: null,
    weeksLeft: null,
    graphWeek: null,
    resolvedWeek: null,
    resolution: null
});

/** Merge observed coordinates without mutating either input. New API points win collisions. */
export const mergeJuniorPoints = (
    existing: readonly JuniorPoint[],
    incoming: readonly JuniorPoint[]
): JuniorPoint[] => {
    const byX = new Map<number, JuniorPoint>();
    for (const point of existing) byX.set(point.x, { ...point });
    for (const point of incoming) byX.set(point.x, { ...point });
    return [...byX.values()].sort((a, b) => a.x - b.x);
};

/** Graph age is independent of the later roster-membership resolution. */
export const mergeJuniorGraphRecord = (
    existing: JuniorRecord | undefined,
    teamId: number,
    juniorId: number,
    week: number,
    points: readonly JuniorPoint[]
): JuniorRecord => {
    const record = existing ?? emptyRecord(teamId, juniorId);
    const previousGraphWeek = record.graphWeek ??
        (record.resolution === 'graph' ? record.resolvedWeek : null);
    const stale = previousGraphWeek != null && previousGraphWeek > week;
    const laterResolution = record.resolvedWeek != null && record.resolvedWeek > week;
    return {
        ...record,
        points: stale
            ? mergeJuniorPoints(points, record.points)
            : mergeJuniorPoints(record.points, points),
        graphWeek: stale ? previousGraphWeek : week,
        resolvedWeek: laterResolution ? record.resolvedWeek : week,
        resolution: laterResolution ? record.resolution : 'graph'
    };
};

/** Preserve graph age before a roster decision replaces a legacy graph marker. */
export const mergeJuniorResolutionRecord = (
    existing: JuniorRecord | undefined,
    teamId: number,
    juniorId: number,
    week: number,
    resolution: Extract<JuniorResolution, 'absent' | 'unknown'>
): JuniorRecord | null => {
    if (existing?.resolvedWeek != null &&
        (existing.resolvedWeek > week || (existing.resolvedWeek === week && existing.resolution === 'graph'))) return null;
    return {
        ...(existing ?? emptyRecord(teamId, juniorId)),
        graphWeek: existing?.graphWeek ??
            (existing?.resolution === 'graph' ? existing.resolvedWeek : null),
        resolvedWeek: week,
        resolution
    };
};

/** Roster values share one capture week; callers reject stale captures. */
export const mergeJuniorRosterRecord = (
    existing: JuniorRecord | undefined,
    teamId: number,
    entry: JuniorRosterEntry,
    week: number
): JuniorRecord => ({
    ...(existing ?? emptyRecord(teamId, entry.id)),
    nativeTalent: entry.talent,
    nativeTalentWeek: week,
    weeksLeft: entry.weeksLeft
});

/** Resolve only after the IndexedDB transaction commits, including request callbacks. */
async function transact<T>(
    stores: string[],
    mode: IDBTransactionMode,
    enqueue: (transaction: IDBTransaction, setResult: (value: T) => void) => void
): Promise<T> {
    const database = await initDB();
    return new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(stores, mode);
        let result!: T;
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(transaction.error ?? new Error('Junior IndexedDB transaction aborted'));
        transaction.onerror = () => reject(transaction.error ?? new Error('Junior IndexedDB transaction failed'));
        try {
            enqueue(transaction, (value) => { result = value; });
        } catch (error) {
            transaction.abort();
            reject(error);
        }
    });
}

export const getJuniorRecords = async (
    teamId: number,
    ids: readonly number[]
): Promise<Map<number, JuniorRecord>> => {
    if (ids.length === 0) return new Map();
    return transact<Map<number, JuniorRecord>>([STORE_JUNIORS], 'readonly', (transaction, setResult) => {
        const records = new Map<number, JuniorRecord>();
        setResult(records);
        const store = transaction.objectStore(STORE_JUNIORS);
        for (const juniorId of new Set(ids)) {
            const request = store.get([teamId, juniorId]);
            request.onsuccess = () => {
                if (request.result) records.set(juniorId, request.result as JuniorRecord);
            };
        }
    });
};

export const getJuniorRecord = async (teamId: number, juniorId: number): Promise<JuniorRecord | null> =>
    transact<JuniorRecord | null>([STORE_JUNIORS], 'readonly', (transaction, setResult) => {
        const request = transaction.objectStore(STORE_JUNIORS).get([teamId, juniorId]);
        request.onsuccess = () => setResult((request.result as JuniorRecord | undefined) ?? null);
    });

export const getJuniorRosterSnapshot = async (teamId: number): Promise<JuniorRosterSnapshot | null> =>
    transact<JuniorRosterSnapshot | null>([STORE_META], 'readonly', (transaction, setResult) => {
        const request = transaction.objectStore(STORE_META).get(rosterKey(teamId));
        request.onsuccess = () => {
            const snapshot = request.result?.value as JuniorRosterSnapshot | undefined;
            setResult(snapshot?.teamId === teamId ? snapshot : null);
        };
    });

/** Persist the roster snapshot and native talent values in one transaction. */
export const saveJuniorRosterSnapshot = async (
    snapshot: JuniorRosterSnapshot,
    entries: readonly JuniorRosterEntry[],
    expectedGeneration: string | null
): Promise<void> => {
    if (entries.some((entry) => entry.teamId !== snapshot.teamId)) {
        throw new Error('Junior roster entry belongs to another team');
    }
    return transact<void>([STORE_META, STORE_JUNIORS], 'readwrite', (transaction, setResult) => {
        setResult(undefined);
        const metaStore = transaction.objectStore(STORE_META);
        const juniorStore = transaction.objectStore(STORE_JUNIORS);
        withExpectedGeneration(transaction, expectedGeneration, () => {
            const previousRequest = metaStore.get(rosterKey(snapshot.teamId));
            previousRequest.onsuccess = () => {
                const previous = previousRequest.result?.value as JuniorRosterSnapshot | undefined;
                if (previous && previous.week > snapshot.week) return;

                metaStore.put({ key: rosterKey(snapshot.teamId), value: { ...snapshot, ids: [...snapshot.ids] } });
                for (const entry of entries) {
                    const request = juniorStore.get([snapshot.teamId, entry.id]);
                    request.onsuccess = () => {
                        const existing = request.result as JuniorRecord | undefined;
                        if (existing?.nativeTalentWeek != null && existing.nativeTalentWeek > snapshot.week) return;
                        juniorStore.put(mergeJuniorRosterRecord(existing, snapshot.teamId, entry, snapshot.week));
                    };
                }
            };
        });
    });
};

/** Keep older observations, then commit the merged graph and weekly marker together. */
export const saveJuniorGraph = async (
    teamId: number,
    juniorId: number,
    week: number,
    points: readonly JuniorPoint[],
    expectedGeneration: string | null
): Promise<void> =>
    transact<void>([STORE_META, STORE_JUNIORS], 'readwrite', (transaction, setResult) => {
        setResult(undefined);
        const store = transaction.objectStore(STORE_JUNIORS);
        withExpectedGeneration(transaction, expectedGeneration, () => {
            const request = store.get([teamId, juniorId]);
            request.onsuccess = () => {
                const existing = request.result as JuniorRecord | undefined;
                store.put(mergeJuniorGraphRecord(existing, teamId, juniorId, week, points));
            };
        });
    });

/** Record a complete-roster absence or an unconfirmed membership for this game week. */
export const saveJuniorResolution = async (
    teamId: number,
    juniorId: number,
    week: number,
    resolution: Extract<JuniorResolution, 'absent' | 'unknown'>,
    expectedGeneration: string | null
): Promise<void> =>
    transact<void>([STORE_META, STORE_JUNIORS], 'readwrite', (transaction, setResult) => {
        setResult(undefined);
        const store = transaction.objectStore(STORE_JUNIORS);
        withExpectedGeneration(transaction, expectedGeneration, () => {
            const request = store.get([teamId, juniorId]);
            request.onsuccess = () => {
                const existing = request.result as JuniorRecord | undefined;
                const next = mergeJuniorResolutionRecord(existing, teamId, juniorId, week, resolution);
                if (next) store.put(next);
            };
        });
    });
