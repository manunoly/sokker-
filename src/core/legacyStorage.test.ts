// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
    readLegacySnapshot,
    restoreLegacyArchive,
    verifyLegacySnapshot,
} from './legacyStorage';
import { decodeLegacyStores } from './legacyCodec';
beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('location', { origin: 'https://sokker.org' });
});
it('does not create an absent legacy database', async () => {
    expect(await readLegacySnapshot()).toBeNull();
    expect(await indexedDB.databases()).toEqual([]);
});
it('captures all stores and schema without changing keys, values or version and restores in isolation', async () => {
    const source = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open('SokkerTalentTrackerDB', 3);
        r.onupgradeneeded = () => {
            const s = r.result.createObjectStore('extra', { keyPath: null });
            s.createIndex('byKind', 'kind', { unique: false });
            s.put(
                {
                    kind: 'x',
                    unknown: undefined,
                    bytes: new Uint8Array([2, 4]),
                },
                'key',
            );
            r.result.createObjectStore('players', { keyPath: 'id' });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
    source.close();
    const first = await readLegacySnapshot();
    expect(first?.inventory.map((i) => i.store)).toEqual(['extra', 'players']);
    const recovered = await restoreLegacyArchive(first!, 'SokkerRecovery-test');
    expect(recovered.version).toBe(3);
    expect(
        recovered
            .transaction('extra')
            .objectStore('extra')
            .indexNames.contains('byKind'),
    ).toBe(true);
    const value = await new Promise((resolve) => {
        const r = recovered
            .transaction('extra')
            .objectStore('extra')
            .get('key');
        r.onsuccess = () => resolve(r.result);
    });
    expect(value).toEqual({
        kind: 'x',
        unknown: undefined,
        bytes: new Uint8Array([2, 4]),
    });
    recovered.close();
    expect(await readLegacySnapshot()).toEqual(first);
    expect(await verifyLegacySnapshot(first!)).toEqual(
        decodeLegacyStores(first!.encodedStores),
    );
    await expect(
        restoreLegacyArchive(first!, 'SokkerTalentTrackerDB'),
    ).rejects.toThrow('isolated');
});
it('never calls source writes, upgrade, deleteDatabase or readwrite transactions while inspecting', async () => {
    const { IDBDatabase, IDBObjectStore } = await import('fake-indexeddb');
    const source = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open('SokkerTalentTrackerDB', 3);
        r.onupgradeneeded = () =>
            r.result
                .createObjectStore('unknown', { keyPath: 'id' })
                .put({ id: 1, unexpected: 'retained' });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
    source.close();
    const originalTransaction = IDBDatabase.prototype.transaction;
    const transaction = vi
        .spyOn(IDBDatabase.prototype, 'transaction')
        .mockImplementation(function (
            this: IDBDatabase,
            ...args: Parameters<IDBDatabase['transaction']>
        ) {
            if (this.name === 'SokkerTalentTrackerDB')
                expect(args[1]).toBe('readonly');
            return originalTransaction.apply(this, args);
        });
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    const clear = vi.spyOn(IDBObjectStore.prototype, 'clear');
    const remove = vi.spyOn(IDBObjectStore.prototype, 'delete');
    const deleted = vi.spyOn(indexedDB, 'deleteDatabase');
    const open = vi.spyOn(indexedDB, 'open');
    const result = await readLegacySnapshot();
    expect(result?.databaseVersion).toBe(3);
    expect(open).toHaveBeenCalledExactlyOnceWith('SokkerTalentTrackerDB');
    expect(put).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(deleted).not.toHaveBeenCalled();
    transaction.mockRestore();
    put.mockRestore();
    clear.mockRestore();
    remove.mockRestore();
    deleted.mockRestore();
    open.mockRestore();
});
it('fingerprints the database version as well as visible schema and content', async () => {
    const { snapshotFromStores } = await import('./legacyStorage');
    const first = await snapshotFromStores(
        'https://sokker.org',
        'SokkerTalentTrackerDB',
        3,
        [],
    );
    const next = await snapshotFromStores(
        'https://sokker.org',
        'SokkerTalentTrackerDB',
        4,
        [],
    );
    expect(first.digest).not.toBe(next.digest);
    await expect(
        verifyLegacySnapshot({ ...first, databaseVersion: 4 }),
    ).rejects.toThrow('digest');
});
