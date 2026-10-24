// @vitest-environment node
import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { StorageService } from '../background/storageService';
import { openSharedDatabase, captureSharedData } from './storageDatabase';
import { playerFixture } from './storageFixtures';
let db: IDBDatabase;
let service: StorageService;
beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('location', { origin: 'https://sokker.org' });
    db = await openSharedDatabase();
    service = new StorageService(undefined, db);
    vi.stubGlobal('chrome', {
        runtime: {
            connect: () => {
                const listeners: Array<(value: unknown) => void> = [];
                return {
                    onMessage: {
                        addListener: (f: (v: unknown) => void) =>
                            listeners.push(f),
                    },
                    onDisconnect: { addListener: vi.fn() },
                    postMessage: (message: unknown) =>
                        service
                            .handle(
                                'sokker-document',
                                message,
                                'https://sokker.org',
                            )
                            .then(
                                (value) => listeners.forEach((f) => f(value)),
                                (error) =>
                                    listeners.forEach((f) =>
                                        f({
                                            ok: false,
                                            code:
                                                typeof error.code === 'string'
                                                    ? error.code
                                                    : 'STORAGE_ERROR',
                                            message: error.message,
                                        }),
                                    ),
                            ),
                };
            },
            sendMessage: vi.fn().mockResolvedValue(undefined),
            onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
        tabs: { query: vi.fn().mockResolvedValue([]) },
    });
});
afterEach(() => {
    vi.restoreAllMocks();
    db.close();
});
async function writeLegacy(...weeks: number[]): Promise<void> {
    const source = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('SokkerTalentTrackerDB', 3);
        request.onupgradeneeded = () =>
            request.result.createObjectStore('players', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
        const tx = source.transaction('players', 'readwrite');
        tx.objectStore('players').put(playerFixture(...weeks));
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
    });
    source.close();
}
it('production bootstrap skips unchanged migration under staging quota and still discovers changed source and tombstones', async () => {
    await writeLegacy(1000);
    const { migrateCurrentOrigin, clearSharedData } = await import(
        './storageClient'
    );
    const migrated = await migrateCurrentOrigin();
    expect(migrated.state).toBe('migrated');
    const before = await captureSharedData(db);
    const originalPut = IDBObjectStore.prototype.put;
    const put = vi
        .spyOn(IDBObjectStore.prototype, 'put')
        .mockImplementation(function (
            this: IDBObjectStore,
            ...args: Parameters<IDBObjectStore['put']>
        ) {
            if (this.name === 'migrationStaging')
                throw new DOMException(
                    'Synthetic staging quota exhausted',
                    'QuotaExceededError',
                );
            return originalPut.apply(this, args);
        });
    const repeated = await migrateCurrentOrigin();
    expect(repeated).toEqual({ ...migrated, state: 'already-migrated' });
    expect(put).not.toHaveBeenCalled();
    expect(await captureSharedData(db)).toEqual(before);
    await writeLegacy(1000, 1001);
    await expect(migrateCurrentOrigin()).rejects.toMatchObject({
        code: 'STORAGE_ERROR',
    });
    expect(
        (await captureSharedData(db)).data.players?.[0].history.map(
            (h) => h.week,
        ),
    ).toEqual([1000]);
    put.mockRestore();
    const updated = await migrateCurrentOrigin();
    expect(updated.state).toBe('migrated');
    expect(updated.sourceDigest).not.toBe(migrated.sourceDigest);
    expect(
        (await captureSharedData(db)).data.players?.[0].history.map(
            (h) => h.week,
        ),
    ).toEqual([1000, 1001]);
    await clearSharedData();
    expect((await migrateCurrentOrigin()).state).toBe('blocked');
    expect((await captureSharedData(db)).data.players).toEqual([]);
});
