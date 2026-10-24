import type { BackupData } from './repository';
import {
    StorageError,
    type StorageState,
    type WriteContext,
} from './storageTypes';

export const SHARED_DATABASE_NAME = 'SokkerPlusPlusDB';
export const DATA_STORES = [
    'players',
    'juniors',
    'metadata',
    'weeks',
    'migrationConflicts',
    'legacyArchives',
] as const;
export const ALL_STORES = [
    ...DATA_STORES,
    'control',
    'migrationStaging',
] as const;
export interface MutationIdentity {
    id: string;
    owner: string;
    digest: string;
}
export interface MutationReceipt {
    state: 'committed';
    epoch: string;
    revision: number;
}

export function openSharedDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(SHARED_DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
            const database = request.result;
            database.createObjectStore('players', { keyPath: 'id' });
            database.createObjectStore('juniors', {
                keyPath: ['teamId', 'juniorId'],
            });
            database.createObjectStore('metadata', { keyPath: 'key' });
            database.createObjectStore('weeks', {
                keyPath: ['teamId', 'week'],
            });
            database.createObjectStore('control', { keyPath: 'key' });
            database.createObjectStore('migrationConflicts', { keyPath: 'id' });
            database.createObjectStore('legacyArchives', { keyPath: 'id' });
            database.createObjectStore('migrationStaging', {
                keyPath: 'stageId',
            });
            request.transaction!.objectStore('control').put({
                key: 'state',
                epoch: crypto.randomUUID(),
                revision: 0,
                migration: {},
                automaticMigrationBlocked: false,
            });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
        };
    });
}

/** enqueue is synchronous; its IndexedDB callbacks may enqueue more IndexedDB work. */
export function transaction<T>(
    database: IDBDatabase,
    stores: readonly string[],
    mode: IDBTransactionMode,
    enqueue: (
        tx: IDBTransaction,
        result: (value: T) => void,
        fail: (error: Error) => void,
    ) => void,
): Promise<T> {
    return new Promise((resolve, reject) => {
        const tx = database.transaction([...stores], mode);
        let result!: T;
        let failure: Error | undefined;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () =>
            reject(
                failure ??
                    tx.error ??
                    new StorageError('STORAGE_ERROR', 'Transaction aborted'),
            );
        tx.onerror = () => {
            failure ??=
                tx.error ??
                new StorageError('STORAGE_ERROR', 'Transaction failed');
        };
        const fail = (error: Error) => {
            failure = error;
            try {
                tx.abort();
            } catch {
                /* The transaction may already have aborted. */
            }
        };
        try {
            enqueue(
                tx,
                (value) => {
                    result = value;
                },
                fail,
            );
        } catch (error) {
            fail(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

export function readState(
    tx: IDBTransaction,
    done: (state: StorageState) => void,
): void {
    const request = tx.objectStore('control').get('state');
    request.onsuccess = () => done(request.result as StorageState);
}

export function putState(tx: IDBTransaction, state: StorageState): void {
    tx.objectStore('control').put({ ...state, key: 'state' });
}

/** Epoch, revision, data and an optional replay receipt share the same write lock. */
export function guardedWrite<T>(
    database: IDBDatabase,
    stores: readonly string[],
    ctx: WriteContext,
    enqueue: (
        tx: IDBTransaction,
        set: (value: T) => void,
        fail: (error: Error) => void,
    ) => void,
    identity?: MutationIdentity,
): Promise<T> {
    return transaction(
        database,
        [...new Set([...stores, 'control'])],
        'readwrite',
        (tx, set, fail) => {
            const write = () =>
                readState(tx, (state) => {
                    if (state.epoch !== ctx.epoch) {
                        fail(
                            new StorageError(
                                'STALE_EPOCH',
                                'The storage epoch changed',
                            ),
                        );
                        return;
                    }
                    const next = { ...state, revision: state.revision + 1 };
                    putState(tx, next);
                    if (identity)
                        tx.objectStore('control').put({
                            key: `mutation:${identity.id}`,
                            owner: identity.owner,
                            digest: identity.digest,
                            receipt: {
                                state: 'committed',
                                epoch: next.epoch,
                                revision: next.revision,
                            },
                        });
                    try {
                        enqueue(tx, set, fail);
                    } catch (error) {
                        fail(
                            error instanceof Error
                                ? error
                                : new Error(String(error)),
                        );
                    }
                });
            if (!identity) {
                write();
                return;
            }
            const prior = tx
                .objectStore('control')
                .get(`mutation:${identity.id}`);
            prior.onsuccess = () => {
                if (!prior.result) {
                    write();
                    return;
                }
                if (
                    prior.result.owner !== identity.owner ||
                    prior.result.digest !== identity.digest
                ) {
                    fail(
                        new StorageError(
                            'INVALID_REQUEST',
                            'Mutation ID belongs to another request',
                        ),
                    );
                    return;
                }
                set(undefined as T);
            };
        },
    );
}

export function readDataInTransaction(
    tx: IDBTransaction,
    done: (data: BackupData) => void,
): void {
    const result: BackupData = { formatVersion: 2 };
    let pending = DATA_STORES.length;
    for (const store of DATA_STORES) {
        const request = tx.objectStore(store).getAll();
        request.onsuccess = () => {
            Object.assign(result, { [store]: request.result });
            if (--pending !== 0) return;
            const metadata = result.metadata ?? [];
            result.legacyMetadata = metadata
                .filter((item) => item.key === 'legacyMetadata')
                .flatMap((item) =>
                    Array.isArray(item.value) ? item.value : [],
                );
            result.metadata = metadata.filter(
                (item) => item.key !== 'legacyMetadata',
            );
            done(result);
        };
    }
}

export function writeDataInTransaction(
    tx: IDBTransaction,
    data: BackupData,
): void {
    for (const store of DATA_STORES) {
        const target = tx.objectStore(store);
        target.clear();
        for (const value of data[store] ?? []) target.put(value);
    }
    if (data.legacyMetadata?.length)
        tx.objectStore('metadata').put({
            key: 'legacyMetadata',
            value: data.legacyMetadata,
        });
}

export async function captureSharedData(
    database: IDBDatabase,
): Promise<{ data: BackupData; state: StorageState }> {
    return transaction(
        database,
        [...DATA_STORES, 'control'],
        'readonly',
        (tx, set) => {
            let state: StorageState;
            let data: BackupData;
            const done = () => {
                if (state && data) set({ state, data });
            };
            readState(tx, (value) => {
                state = value;
                done();
            });
            readDataInTransaction(tx, (value) => {
                data = value;
                done();
            });
        },
    );
}
