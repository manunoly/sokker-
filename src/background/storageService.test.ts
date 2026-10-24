// @vitest-environment node
import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
    openSharedDatabase,
    captureSharedData,
    guardedWrite,
} from '../core/storageDatabase';
import { StorageService } from './storageService';
import { PublicationService } from '../core/storageMigration';
import { weekFixture, playerFixture } from '../core/storageFixtures';
import { readLegacySnapshot, snapshotFromStores } from '../core/legacyStorage';
import type {
    StorageState,
    WriteContext,
    PreparedMigration,
} from '../core/storageTypes';
import type { PlayerData } from '../types';
import { downloadTransfer } from '../core/transferProtocol';
import { STORAGE_CHANNEL, STORAGE_CHANGED } from '../core/storageTypes';
let db: IDBDatabase;
let service: StorageService;
beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('chrome', {
        runtime: { sendMessage: vi.fn().mockResolvedValue(undefined) },
        tabs: { query: vi.fn().mockResolvedValue([]) },
    });
    db = await openSharedDatabase();
    service = new StorageService(undefined, db);
});
afterEach(() => {
    db.close();
    vi.unstubAllGlobals();
});
it('two clients share history, scopes sync markers by team, and transports juvenile Map as pairs', async () => {
    const ctx = await service.execute('one', 'getWriteContext', { teamId: 42 });
    await service.execute('one', 'savePlayerCarryOverEntry', {
        ctx,
        id: 12345,
        name: 'Synthetic',
        entry: weekFixture(1000),
    });
    expect(
        (
            (await service.execute('two', 'getPlayerHistory', {
                id: 12345,
            })) as any
        ).history[0].week,
    ).toBe(1000);
    await service.execute('one', 'markWeekEmpty', { ctx, week: 1000 });
    expect(
        await service.execute('two', 'isWeekSynced', {
            teamId: 42,
            week: 1000,
        }),
    ).toBe(true);
    expect(
        await service.execute('two', 'isWeekSynced', {
            teamId: 43,
            week: 1000,
        }),
    ).toBe(false);
    await service.execute('one', 'saveJuniorGraph', {
        ctx,
        id: 555,
        week: 1000,
        points: [{ x: 10, y: 6, source: 'graph' }],
    });
    const pairs = await service.execute('two', 'getJuniorRecords', {
        teamId: 42,
        ids: [555],
    });
    expect(JSON.parse(JSON.stringify(pairs))).toEqual([
        [555, expect.objectContaining({ juniorId: 555 })],
    ]);
    const result = (await service.handle('two', {
        channel: STORAGE_CHANNEL,
        operation: 'getAllPlayers',
        input: {},
    })) as any;
    expect(result.transfer).toBeDefined();
    expect(
        await downloadTransfer(result.transfer, (message) =>
            service.handle('two', message),
        ),
    ).toEqual(await service.execute('two', 'getAllPlayers', {}));
});
it('checks persisted epoch under write lock and rejects invalid inputs', async () => {
    const ctx = await service.execute('one', 'getWriteContext', { teamId: 42 });
    await new PublicationService(db).clear();
    const state = await service.state();
    await expect(
        service.execute('two', 'savePlayerCarryOverEntry', {
            ctx,
            id: 12345,
            name: 'Synthetic',
            entry: weekFixture(1000),
        }),
    ).rejects.toMatchObject({ code: 'STALE_EPOCH' });
    expect((await service.state()).revision).toBe(state.revision);
    expect((await captureSharedData(db)).data.players).toEqual([]);
    await expect(
        service.execute('one', 'getPlayerHistory', { id: -1 }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(
        service.execute('one', 'saveJuniorRosterSnapshot', {
            ctx: await service.execute('one', 'getWriteContext', {
                teamId: 42,
            }),
            snapshot: { teamId: 43 },
            entries: [],
        }),
    ).rejects.toThrow();
});
it('waits for commit and surfaces actual transaction abort', async () => {
    const ctx = (await service.execute('one', 'getWriteContext', {
        teamId: 42,
    })) as any;
    await expect(
        guardedWrite(db, ['players'], ctx, (tx, set) => {
            tx.objectStore('players').put({ id: 1 });
            set(undefined);
            tx.abort();
        }),
    ).rejects.toThrow();
    expect((await service.state()).revision).toBe(0);
    expect((await captureSharedData(db)).data.players).toEqual([]);
});
it('import intent captured before upload cannot adopt a later epoch', async () => {
    const intent = (await service.execute(
        'one',
        'backup.import.begin',
        {},
    )) as any;
    await new PublicationService(db).clear();
    await expect(
        service.execute('one', 'backup.import.prepare', {
            attemptId: intent.attemptId,
            data: { players: [] },
        }),
    ).rejects.toMatchObject({ code: 'STALE_EPOCH' });
});
it('persists ordinary mutation and clear receipts and refuses contradictory reuse', async () => {
    const ctx = await service.execute('one', 'getWriteContext', { teamId: 42 });
    const input = {
        ctx,
        id: 12345,
        name: 'Synthetic',
        entry: weekFixture(1000),
    };
    const { sha256 } = await import('../core/transferProtocol');
    const digest = await sha256(
        JSON.stringify({ operation: 'savePlayerCarryOverEntry', input }),
    );
    await service.execute(
        'one',
        'savePlayerCarryOverEntry',
        input,
        undefined,
        'mutation-1',
    );
    const before = await service.state();
    await service.execute(
        'one',
        'savePlayerCarryOverEntry',
        input,
        undefined,
        'mutation-1',
    );
    expect((await service.state()).revision).toBe(before.revision);
    expect(
        await new StorageService(undefined, db).execute(
            'one',
            'getMutationReceipt',
            { requestId: 'mutation-1', digest },
        ),
    ).toMatchObject({ state: 'committed', revision: before.revision });
    await expect(
        service.execute(
            'one',
            'savePlayerCarryOverEntry',
            { ...input, entry: weekFixture(1200) },
            undefined,
            'mutation-1',
        ),
    ).rejects.toThrow('another request');
    const clearDigest = await sha256(
        JSON.stringify({ operation: 'clearSharedData', input: {} }),
    );
    await service.execute('one', 'clearSharedData', {}, undefined, 'clear-1');
    const cleared = await service.state();
    expect(
        await new StorageService(undefined, db).execute(
            'one',
            'getMutationReceipt',
            { requestId: 'clear-1', digest: clearDigest },
        ),
    ).toMatchObject({ state: 'committed', epoch: cleared.epoch });
    await service.execute('one', 'clearSharedData', {}, undefined, 'clear-1');
    expect((await service.state()).epoch).toBe(cleared.epoch);
});
it('disconnecting one port preserves another port and API transfers in the same document', async () => {
    const { registerStorageService } = await import('./storageService');
    const { getMessageOwner } = await import('./messageOwner');
    const connected: Array<(port: chrome.runtime.Port) => void> = [];
    const runtime = {
        id: 'extension',
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        onConnect: {
            addListener: (f: (port: chrome.runtime.Port) => void) =>
                connected.push(f),
            removeListener: vi.fn(),
        },
    };
    vi.stubGlobal('chrome', { runtime });
    registerStorageService(service);
    const sender = {
        id: 'extension',
        url: 'https://sokker.org/squad',
        documentId: 'same-document',
        frameId: 0,
        tab: { id: 1 },
    } as chrome.runtime.MessageSender;
    function port() {
        const listeners: Array<(m: unknown) => void> = [];
        const closes: Array<() => void> = [];
        const replies: unknown[] = [];
        const value = {
            name: STORAGE_CHANNEL,
            sender,
            onMessage: {
                addListener: (f: (m: unknown) => void) => listeners.push(f),
            },
            onDisconnect: { addListener: (f: () => void) => closes.push(f) },
            postMessage: (m: unknown) => replies.push(m),
            disconnect: vi.fn(),
        } as unknown as chrome.runtime.Port;
        connected[0](value);
        return {
            send: (m: unknown) => listeners.forEach((f) => f(m)),
            close: () => closes.forEach((f) => f()),
            replies,
        };
    }
    const a = port(),
        b = port();
    a.send({ channel: STORAGE_CHANNEL, operation: 'getAllPlayers', input: {} });
    b.send({ channel: STORAGE_CHANNEL, operation: 'getAllPlayers', input: {} });
    await vi.waitFor(() => expect(a.replies.length + b.replies.length).toBe(2));
    const owner = getMessageOwner(sender)!;
    const api = await service.transfers.createDownload(owner, {
        synthetic: 'API',
    });
    const aId = (a.replies[0] as any).transfer.transferId;
    const bId = (b.replies[0] as any).transfer.transferId;
    a.close();
    expect(() => service.transfers.read(owner, aId, 0)).toThrow('Unknown');
    expect(service.transfers.read(owner, bId, 0).text).toBe('[]');
    expect(service.transfers.read(owner, api.transferId, 0).text).toContain(
        'API',
    );
});
function observeTabNotices(isCommitted: () => boolean) {
    const notices: Array<{
        tabId: number;
        state: StorageState;
        committed: boolean;
    }> = [];
    chrome.tabs.query = vi.fn().mockResolvedValue([
        { id: 1, url: 'https://sokker.org/app/squad' },
        { id: 2, url: 'https://app.sokker.org/squad' },
    ]) as typeof chrome.tabs.query;
    chrome.tabs.sendMessage = vi.fn(
        (tabId: number, message: { channel: string; state: StorageState }) => {
            notices.push({
                tabId,
                state: message.state,
                committed: isCommitted(),
            });
            return Promise.resolve(undefined);
        },
    ) as typeof chrome.tabs.sendMessage;
    return notices;
}
const ordinaryWrites = [
    { operation: 'saveWeekData', payload: { week: 1200, players: [] } },
    { operation: 'markWeekEmpty', payload: { week: 1200 } },
    {
        operation: 'savePlayerCarryOverEntry',
        payload: { id: 12345, name: 'Synthetic', entry: weekFixture(1200) },
    },
    {
        operation: 'saveJuniorRosterSnapshot',
        payload: {
            snapshot: { teamId: 42, week: 1200, ids: [555], complete: true },
            entries: [{ id: 555, teamId: 42, talent: 3, weeksLeft: 5 }],
        },
    },
    {
        operation: 'saveJuniorGraph',
        payload: {
            id: 555,
            week: 1200,
            points: [{ x: 10, y: 6, source: 'graph' }],
        },
    },
    {
        operation: 'saveJuniorResolution',
        payload: { id: 555, week: 1200, resolution: 'absent' },
    },
];
it.each(ordinaryWrites)(
    '$operation notifies root and app only after its transaction commits',
    async ({ operation, payload }) => {
        const ctx = (await service.execute('root', 'getWriteContext', {
            teamId: 42,
        })) as WriteContext;
        let committed = false;
        const notices = observeTabNotices(() => committed);
        const original = db.transaction.bind(db);
        const transactions = vi
            .spyOn(db, 'transaction')
            .mockImplementation(
                (...args: Parameters<IDBDatabase['transaction']>) => {
                    const tx = original(...args);
                    if (args[1] === 'readwrite')
                        tx.addEventListener('complete', () => {
                            committed = true;
                        });
                    return tx;
                },
            );
        try {
            await service.execute('root', operation, { ctx, ...payload });
            expect(notices.map((notice) => notice.tabId)).toEqual([1, 2]);
            expect(notices.every((notice) => notice.committed)).toBe(true);
            const persisted = await service.state();
            expect(persisted.epoch).toBe(ctx.epoch);
            expect(persisted.revision).toBe(1);
            expect(
                notices.every(
                    (notice) =>
                        notice.state.epoch === ctx.epoch &&
                        notice.state.revision === persisted.revision,
                ),
            ).toBe(true);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledExactlyOnceWith({
                channel: STORAGE_CHANGED,
                state: persisted,
            });
            expect(chrome.tabs.query).toHaveBeenCalledExactlyOnceWith({
                url: ['https://sokker.org/*', 'https://*.sokker.org/*'],
            });
        } finally {
            transactions.mockRestore();
        }
    },
);
it('legacy publication refreshes both existing tab histories with weeks older than the API range and leaves the source intact', async () => {
    const ctx = (await service.execute('app', 'getWriteContext', {
        teamId: 42,
    })) as WriteContext;
    await service.execute('app', 'savePlayerCarryOverEntry', {
        ctx,
        id: 12345,
        name: 'Synthetic',
        entry: weekFixture(1200),
    });
    vi.mocked(chrome.runtime.sendMessage).mockClear();
    vi.mocked(chrome.tabs.query).mockClear();
    vi.stubGlobal('location', { origin: 'https://sokker.org' });
    const source = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('SokkerTalentTrackerDB', 3);
        request.onupgradeneeded = () => {
            request.result
                .createObjectStore('players', { keyPath: 'id' })
                .put(playerFixture(1000, 1001, 1100));
            request.result
                .createObjectStore('opaque')
                .put(
                    { unknown: undefined, bytes: new Uint8Array([1, 2]) },
                    'retained',
                );
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    source.close();
    const snapshot = await readLegacySnapshot();
    expect(snapshot).not.toBeNull();
    const prepared = (await service.execute(
        'root',
        'migration.prepare',
        { snapshot },
        'https://sokker.org',
    )) as PreparedMigration;
    const confirmed = await readLegacySnapshot();
    expect(confirmed).toEqual(snapshot);
    await service.execute('root', 'migration.confirmSource', {
        stageId: prepared.stageId,
        sourceDigest: confirmed!.digest,
    });
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(chrome.tabs.query).not.toHaveBeenCalled();
    const cachedHistories = new Map<number, number[]>([
        [1, [1200]],
        [2, [1200]],
    ]);
    const refreshes: Promise<void>[] = [];
    let committed = false;
    const notices = observeTabNotices(() => committed);
    const observe = chrome.tabs.sendMessage;
    chrome.tabs.sendMessage = vi.fn((tabId: number, message: unknown) => {
        (observe as (id: number, message: unknown) => Promise<unknown>)(
            tabId,
            message,
        );
        refreshes.push(
            service
                .execute(`tab:${tabId}`, 'getPlayerHistory', { id: 12345 })
                .then((record) => {
                    cachedHistories.set(
                        tabId,
                        (record as PlayerData).history.map(
                            (entry) => entry.week,
                        ),
                    );
                }),
        );
        return Promise.resolve(undefined);
    }) as typeof chrome.tabs.sendMessage;
    const original = db.transaction.bind(db);
    const transactions = vi
        .spyOn(db, 'transaction')
        .mockImplementation(
            (...args: Parameters<IDBDatabase['transaction']>) => {
                const tx = original(...args);
                if (
                    args[1] === 'readwrite' &&
                    Array.from(args[0] as string[]).includes('players')
                )
                    tx.addEventListener('complete', () => {
                        committed = true;
                    });
                return tx;
            },
        );
    try {
        const receipt = await service.execute('root', 'migration.publish', {
            stageId: prepared.stageId,
        });
        await Promise.all(refreshes);
        expect(receipt).toMatchObject({
            state: 'migrated',
            sourceDigest: snapshot!.digest,
        });
        expect(notices.map((notice) => notice.tabId)).toEqual([1, 2]);
        expect(notices.every((notice) => notice.committed)).toBe(true);
        expect(cachedHistories.get(1)).toEqual([1000, 1001, 1100, 1200]);
        expect(cachedHistories.get(2)).toEqual([1000, 1001, 1100, 1200]);
        const state = await service.state();
        expect(state.epoch).toBe(ctx.epoch);
        expect(
            notices.every((notice) => notice.state.revision === state.revision),
        ).toBe(true);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
        expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
        expect(await readLegacySnapshot()).toEqual(snapshot);
    } finally {
        transactions.mockRestore();
    }
});
it.each([
    'savePlayerCarryOverEntry',
    'migration.publish',
    'backup.import.publish',
])(
    '%s emits no notification after an actual transaction abort',
    async (operation) => {
        const ctx = (await service.execute('root', 'getWriteContext', {
            teamId: 42,
        })) as WriteContext;
        let input: unknown = {
            ctx,
            id: 12345,
            name: 'Synthetic',
            entry: weekFixture(1200),
        };
        if (operation === 'migration.publish') {
            const snapshot = await snapshotFromStores(
                'https://sokker.org',
                'SokkerTalentTrackerDB',
                3,
                [
                    {
                        name: 'players',
                        keyPath: 'id',
                        autoIncrement: false,
                        indexes: [],
                        records: [{ key: 12345, value: playerFixture(1000) }],
                    },
                ],
            );
            const stage = (await service.execute(
                'root',
                'migration.prepare',
                { snapshot },
                snapshot.origin,
            )) as PreparedMigration;
            await service.execute('root', 'migration.confirmSource', {
                stageId: stage.stageId,
                sourceDigest: snapshot.digest,
            });
            input = { stageId: stage.stageId };
        } else if (operation === 'backup.import.publish') {
            const stage = await new PublicationService(db).prepareImport(
                'root',
                { players: [playerFixture(1000)] },
                ctx.epoch,
            );
            input = { stageId: stage.stageId };
        }
        const before = await captureSharedData(db);
        const notices = observeTabNotices(() => false);
        const original = db.transaction.bind(db);
        const transactions = vi
            .spyOn(db, 'transaction')
            .mockImplementation(
                (...args: Parameters<IDBDatabase['transaction']>) => {
                    const tx = original(...args);
                    if (
                        args[1] === 'readwrite' &&
                        Array.from(args[0] as string[]).includes('players')
                    ) {
                        const control = tx.objectStore('control');
                        const put = control.put.bind(control);
                        vi.spyOn(control, 'put').mockImplementation(
                            (...putArgs: Parameters<IDBObjectStore['put']>) => {
                                const request = put(...putArgs);
                                queueMicrotask(() => {
                                    try {
                                        tx.abort();
                                    } catch {}
                                });
                                return request;
                            },
                        );
                    }
                    return tx;
                },
            );
        try {
            await expect(
                service.execute('root', operation, input),
            ).rejects.toThrow();
            expect(await captureSharedData(db)).toEqual(before);
            expect(notices).toEqual([]);
            expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
            expect(chrome.tabs.query).not.toHaveBeenCalled();
        } finally {
            transactions.mockRestore();
        }
    },
);
it('rejected writes and repeated reads emit no change events', async () => {
    const ctx = await service.execute('root', 'getWriteContext', {
        teamId: 42,
    });
    await new PublicationService(db).clear();
    const notices = observeTabNotices(() => false);
    await expect(
        service.execute('root', 'savePlayerCarryOverEntry', {
            ctx,
            id: 12345,
            name: 'Synthetic',
            entry: weekFixture(1200),
        }),
    ).rejects.toMatchObject({ code: 'STALE_EPOCH' });
    await expect(
        service.execute('root', 'getPlayerHistory', { id: -1 }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    for (let pass = 0; pass < 3; pass++) {
        await service.execute('app', 'ensureStorageReady', {});
        await service.execute('app', 'getPlayerHistory', { id: 12345 });
        await service.execute('app', 'getAllPlayers', {});
        await service.execute('app', 'getAllData', {});
        await service.execute('app', 'getJuniorRecords', {
            teamId: 42,
            ids: [555],
        });
    }
    expect(notices).toEqual([]);
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(chrome.tabs.query).not.toHaveBeenCalled();
});
