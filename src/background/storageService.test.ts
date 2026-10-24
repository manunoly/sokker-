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
import { weekFixture } from '../core/storageFixtures';
import { downloadTransfer } from '../core/transferProtocol';
import { STORAGE_CHANNEL } from '../core/storageTypes';
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
afterEach(() => db.close());
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
