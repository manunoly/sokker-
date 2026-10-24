// @vitest-environment node
import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { StorageService } from '../background/storageService';
import { openSharedDatabase, captureSharedData } from './storageDatabase';
import {
    assertMessageSize,
    serializedBytes,
    MAX_MESSAGE_BYTES,
} from './transferProtocol';
import { STORAGE_CHANNEL } from './storageTypes';
import { playerFixture, weekFixture } from './storageFixtures';
let db: IDBDatabase;
let service: StorageService;
let envelopes: number[];
beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
    db = await openSharedDatabase();
    service = new StorageService(undefined, db);
    envelopes = [];
    vi.stubGlobal('chrome', {
        runtime: {
            connect: () => {
                const messages: Array<(value: unknown) => void> = [];
                const disconnect: Array<() => void> = [];
                return {
                    onMessage: {
                        addListener: (fn: (value: unknown) => void) =>
                            messages.push(fn),
                    },
                    onDisconnect: {
                        addListener: (fn: () => void) => disconnect.push(fn),
                    },
                    postMessage: (message: unknown) => {
                        assertMessageSize(message);
                        envelopes.push(serializedBytes(message));
                        service
                            .handle(
                                'popup',
                                message,
                                'chrome-extension://extension',
                            )
                            .then(
                                (reply) => {
                                    assertMessageSize(reply);
                                    envelopes.push(serializedBytes(reply));
                                    for (const fn of messages) fn(reply);
                                },
                                (error) => {
                                    for (const fn of messages)
                                        fn({
                                            ok: false,
                                            code: error.code ?? 'STORAGE_ERROR',
                                            message: error.message,
                                        });
                                },
                            );
                    },
                    disconnect: () => disconnect.forEach((fn) => fn()),
                };
            },
            sendMessage: vi.fn().mockResolvedValue(undefined),
            onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
        tabs: { query: vi.fn().mockResolvedValue([]) },
    });
});
afterEach(() => db.close());
it('round trips a generated backup larger than 64 MiB through bounded complete envelopes', async () => {
    const client = await import('./storageClient');
    const huge = 'synthetic-archive-'.repeat(
        Math.ceil((65 * 1024 * 1024) / 18),
    );
    const { snapshotFromStores } = await import('./legacyStorage');
    const snapshot = await snapshotFromStores(
        'https://sokker.org',
        'SokkerTalentTrackerDB',
        3,
        [
            {
                name: 'unknown',
                keyPath: null,
                autoIncrement: false,
                indexes: [],
                records: [
                    {
                        key: 'opaque',
                        value: {
                            unknown: undefined,
                            bytes: new Uint8Array([1, 2]),
                        },
                    },
                ],
            },
        ],
    );
    const backup = {
        formatVersion: 2,
        legacyArchives: [
            {
                id: 'synthetic-source',
                kind: 'legacy',
                snapshot,
                digest: snapshot.digest,
            },
        ],
        players: [playerFixture(1000)],
        migrationConflicts: [
            {
                id: 'large-conflict',
                origin: 'synthetic',
                entity: 'unknown',
                coordinate: 1,
                reason: 'retained',
                discarded: huge,
            },
        ],
        legacyMetadata: [{ key: 'unknown-field', value: undefined }],
    };
    expect(serializedBytes(backup)).toBeGreaterThan(64 * 1024 * 1024);
    await client.importBackup(backup);
    const exported = await client.exportBackup();
    expect(exported.migrationConflicts?.[0].discarded).toBe(huge);
    expect(exported.players).toEqual(backup.players);
    expect(exported.legacyArchives).toEqual(backup.legacyArchives);
    expect(envelopes.length).toBeGreaterThan(1000);
    expect(Math.max(...envelopes)).toBeLessThanOrEqual(MAX_MESSAGE_BYTES);
}, 120000);
it('pins export before concurrent writes and accepts old small backups', async () => {
    const client = await import('./storageClient');
    await client.importBackup({ players: [playerFixture(1000)] });
    const response = (await service.handle('exporter', {
        channel: STORAGE_CHANNEL,
        operation: 'getAllData',
        input: {},
    })) as any;
    const ctx = await service.execute('writer', 'getWriteContext', {
        teamId: 42,
    });
    await service.execute('writer', 'savePlayerCarryOverEntry', {
        ctx,
        id: 12345,
        name: 'Synthetic',
        entry: weekFixture(1200),
    });
    const { downloadTransfer } = await import('./transferProtocol');
    const exported = (await downloadTransfer(response.transfer, (message) =>
        service.handle('exporter', message),
    )) as any;
    expect(exported.players[0].history.map((h: any) => h.week)).toEqual([1000]);
    expect(
        (await captureSharedData(db)).data.players![0].history.map(
            (h) => h.week,
        ),
    ).toEqual([1000, 1200]);
    expect(exported).not.toHaveProperty('epoch');
    expect(exported).not.toHaveProperty('migration');
});
it('recovers a committed write and clear after lost responses without replaying them', async () => {
    const client = await import('./storageClient');
    let loseNext = false;
    let writes = 0;

    chrome.runtime.connect = (() => {
        const messages: Array<(v: unknown) => void> = [];
        const disconnects: Array<() => void> = [];
        return {
            onMessage: {
                addListener: (f: (v: unknown) => void) => messages.push(f),
            },
            onDisconnect: {
                addListener: (f: () => void) => disconnects.push(f),
            },
            postMessage: (request: any) => {
                service.handle('popup', request).then((reply) => {
                    if (
                        request.operation.startsWith('save') ||
                        request.operation === 'clearSharedData'
                    ) {
                        writes++;
                        if (loseNext) {
                            loseNext = false;
                            disconnects.forEach((f) => f());
                            return;
                        }
                    }
                    messages.forEach((f) => f(reply));
                });
            },
        };
    }) as unknown as typeof chrome.runtime.connect;
    const ctx = await client.getWriteContext(42);
    loseNext = true;
    await client.savePlayerCarryOverEntry(
        ctx,
        12345,
        'Synthetic',
        weekFixture(1000),
    );
    expect(writes).toBe(1);
    expect((await service.state()).revision).toBe(1);
    loseNext = true;
    await client.clearSharedData();
    expect(writes).toBe(2);
    expect((await service.state()).revision).toBe(2);
    expect((await captureSharedData(db)).data.players).toEqual([]);
});
