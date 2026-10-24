// @vitest-environment node
import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
    openSharedDatabase,
    captureSharedData,
    transaction,
} from './storageDatabase';
import { PublicationService } from './storageMigration';
import { StorageService } from '../background/storageService';
import { playerFixture, weekFixture } from './storageFixtures';
import { snapshotFromStores } from './legacyStorage';
let db: IDBDatabase;
let service: StorageService;
let publications: PublicationService;
beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('chrome', {
        runtime: { sendMessage: vi.fn().mockResolvedValue(undefined) },
        tabs: { query: vi.fn().mockResolvedValue([]) },
    });
    db = await openSharedDatabase();
    service = new StorageService(undefined, db);
    publications = new PublicationService(db);
});
afterEach(() => db.close());
const save = async (week: number) =>
    service.execute('document', 'savePlayerCarryOverEntry', {
        ctx: await service.execute('document', 'getWriteContext', {
            teamId: 42,
        }),
        id: 12345,
        name: 'Synthetic',
        entry: weekFixture(week),
    });
it('rebases import after concurrent observation, rotates epoch once and persists receipt across restart', async () => {
    await save(1000);
    const epoch = (await service.state()).epoch;
    const prepared = await publications.prepareImport(
        'document',
        { players: [playerFixture(1001)] },
        epoch,
    );
    await save(1200);
    const receipt = await publications.publish('document', prepared.stageId);
    expect(
        (await captureSharedData(db)).data.players![0].history.map(
            (h) => h.week,
        ),
    ).toEqual([1000, 1001, 1200]);
    expect((await service.state()).epoch).not.toBe(epoch);
    expect(await new PublicationService(db).receipt(prepared.stageId)).toEqual(
        receipt,
    );
    const revision = (await service.state()).revision;
    expect(
        await new PublicationService(db).publish('document', prepared.stageId),
    ).toEqual(receipt);
    expect((await service.state()).revision).toBe(revision);
    const backup = (await captureSharedData(db)).data;
    expect(
        backup.legacyArchives?.some((a) =>
            a.backup?.players?.[0].history.some((h) => h.week === 1200),
        ),
    ).toBe(true);
});
it('blocks old import after another import and after clear without adopting new epoch', async () => {
    const epoch = (await service.state()).epoch;
    const first = await publications.prepareImport(
        'a',
        { players: [playerFixture(1000)] },
        epoch,
    );
    const second = await publications.prepareImport(
        'b',
        { players: [playerFixture(1001)] },
        epoch,
    );
    await publications.publish('a', first.stageId);
    await expect(
        publications.publish('b', second.stageId),
    ).rejects.toMatchObject({ code: 'STALE_EPOCH' });
    const third = await publications.prepareImport(
        'c',
        { players: [playerFixture(1200)] },
        (await service.state()).epoch,
    );
    await publications.clear();
    await expect(publications.publish('c', third.stageId)).rejects.toThrow();
    expect((await captureSharedData(db)).data.players).toEqual([]);
    expect((await service.state()).automaticMigrationBlocked).toBe(true);
});
it('requires rechecked source, preserves all stores, prevents foreign stage use and stays idempotent', async () => {
    const source = await snapshotFromStores(
        'https://sokker.org',
        'SokkerTalentTrackerDB',
        3,
        [
            {
                name: 'players',
                keyPath: 'id',
                autoIncrement: false,
                indexes: [],
                records: [{ key: 12345, value: playerFixture(1000, 1001) }],
            },
            {
                name: 'unknown',
                keyPath: null,
                autoIncrement: false,
                indexes: [],
                records: [{ key: 'custom', value: { hidden: undefined } }],
            },
        ],
    );
    const p = await publications.prepareLegacy('a', source);
    expect((await captureSharedData(db)).data.players).toEqual([]);
    await expect(publications.publish('a', p.stageId)).rejects.toThrow(
        'Unverified',
    );
    await expect(
        publications.confirmSource('b', p.stageId, source.digest),
    ).rejects.toThrow('Unknown');
    await expect(
        publications.confirmSource('a', p.stageId, 'wrong'),
    ).rejects.toThrow('Source changed');
    await publications.confirmSource('a', p.stageId, source.digest);
    expect((await publications.publish('a', p.stageId)).state).toBe('migrated');
    const repeat = await publications.prepareLegacy('a', source);
    await publications.confirmSource('a', repeat.stageId, source.digest);
    expect((await publications.publish('a', repeat.stageId)).state).toBe(
        'already-migrated',
    );
    expect((await captureSharedData(db)).data.players![0].history).toHaveLength(
        2,
    );
    expect(
        (await captureSharedData(db)).data.legacyArchives?.some((a) =>
            a.snapshot?.inventory.some((i) => i.store === 'unknown'),
        ),
    ).toBe(true);
    await publications.clear();
    await expect(publications.prepareLegacy('a', source)).rejects.toMatchObject(
        { code: 'MIGRATION_BLOCKED' },
    );
    const explicit = await publications.prepareImport(
        'a',
        { players: [playerFixture(1000)] },
        (await service.state()).epoch,
    );
    await publications.publish('a', explicit.stageId);
    expect((await captureSharedData(db)).data.players).toHaveLength(1);
});
it('transaction abort rolls back active data and epoch/revision', async () => {
    await save(1000);
    const before = await captureSharedData(db);
    const prepared = await publications.prepareImport(
        'a',
        { players: [playerFixture(1001)] },
        before.state.epoch,
    );
    const original = db.transaction.bind(db);
    const spy = vi
        .spyOn(db, 'transaction')
        .mockImplementation(
            (...args: Parameters<IDBDatabase['transaction']>) => {
                const tx = original(...args);
                if (
                    args[1] === 'readwrite' &&
                    Array.from(args[0] as string[]).includes('players')
                ) {
                    const put = tx
                        .objectStore('players')
                        .put.bind(tx.objectStore('players'));
                    const store = tx.objectStore('players');
                    vi.spyOn(store, 'put').mockImplementation(
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
    await expect(publications.publish('a', prepared.stageId)).rejects.toThrow();
    spy.mockRestore();
    expect(await captureSharedData(db)).toEqual(before);
    expect(await publications.receipt(prepared.stageId)).toBeNull();
});
it('failed validation never activates a partial candidate', async () => {
    await save(1000);
    const before = await captureSharedData(db);
    await expect(
        publications.prepareImport(
            'a',
            { players: [{ id: 1, history: 'broken' }] },
            before.state.epoch,
        ),
    ).rejects.toThrow();
    expect(await captureSharedData(db)).toEqual(before);
});
it('quota failure and corrupt staging readback preserve active data and never enable publication', async () => {
    await save(1000);
    const before = await captureSharedData(db);
    const { IDBObjectStore } = await import('fake-indexeddb');
    const originalPut = IDBObjectStore.prototype.put;
    const quota = vi
        .spyOn(IDBObjectStore.prototype, 'put')
        .mockImplementation(function (
            this: IDBObjectStore,
            ...args: Parameters<IDBObjectStore['put']>
        ) {
            if (this.name === 'migrationStaging')
                throw new DOMException(
                    'Synthetic quota exhausted',
                    'QuotaExceededError',
                );
            return originalPut.apply(this, args);
        });
    await expect(
        publications.prepareImport(
            'a',
            { players: [playerFixture(1001)] },
            before.state.epoch,
        ),
    ).rejects.toThrow();
    quota.mockRestore();
    expect(await captureSharedData(db)).toEqual(before);
    const originalGet = IDBObjectStore.prototype.get;
    const corrupt = vi
        .spyOn(IDBObjectStore.prototype, 'get')
        .mockImplementation(function (
            this: IDBObjectStore,
            ...args: Parameters<IDBObjectStore['get']>
        ) {
            const request = originalGet.apply(this, args);
            if (this.name === 'migrationStaging') {
                request.addEventListener('success', () => {
                    const result = structuredClone(request.result);
                    if (result) {
                        result.candidate.players = [];
                        Object.defineProperty(request, 'result', {
                            value: result,
                        });
                    }
                });
            }
            return request;
        });
    await expect(
        publications.prepareImport(
            'a',
            { players: [playerFixture(1001)] },
            before.state.epoch,
        ),
    ).rejects.toThrow('readback');
    corrupt.mockRestore();
    expect(await captureSharedData(db)).toEqual(before);
    const stages = await transaction<any[]>(
        db,
        ['migrationStaging'],
        'readonly',
        (tx, set) => {
            const request = tx.objectStore('migrationStaging').getAll();
            request.onsuccess = () => set(request.result);
        },
    );
    expect(stages).toHaveLength(1);
    expect(stages[0].verified).toBe(false);
    await expect(publications.publish('a', stages[0].stageId)).rejects.toThrow(
        'Unverified',
    );
});
it('stores twelve repeated imports linearly and rehydrates every previous destination in full', async () => {
    const source = await snapshotFromStores(
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
            {
                name: 'opaque',
                keyPath: null,
                autoIncrement: false,
                indexes: [],
                records: [{ key: 'unknown', value: { retained: undefined } }],
            },
        ],
    );
    const migration = await publications.prepareLegacy('document', source);
    const beforeMigration = (await captureSharedData(db)).data;
    await publications.confirmSource(
        'document',
        migration.stageId,
        source.digest,
    );
    await publications.publish('document', migration.stageId);
    const incoming = (await captureSharedData(db)).data;
    const snapshots = new Map<string, typeof incoming>([
        [`previous:${migration.stageId}`, beforeMigration],
    ]);
    const sizes: number[] = [];
    for (let i = 0; i < 12; i++) {
        const before = (await captureSharedData(db)).data;
        const stage = await publications.prepareImport(
            'document',
            incoming,
            (await service.state()).epoch,
        );
        await publications.publish('document', stage.stageId);
        const after = (await captureSharedData(db)).data;
        snapshots.set(`previous:${stage.stageId}`, before);
        sizes.push(JSON.stringify(after).length);
    }
    expect(sizes.at(-1)!).toBeLessThan(sizes[0] * 20);
    const { rehydrateRecoveryArchive } = await import('./storageRecovery');
    const final = (await captureSharedData(db)).data;
    const { sha256 } = await import('./transferProtocol');
    for (const archive of final.legacyArchives ?? []) {
        if (archive.kind !== 'previous-destination') continue;
        const recovered = await rehydrateRecoveryArchive(
            archive,
            final.legacyArchives!,
        );
        const expected = snapshots.get(archive.id)!;
        expect({
            ...recovered,
            legacyArchives: [...(recovered.legacyArchives ?? [])].sort((a, b) =>
                a.id.localeCompare(b.id),
            ),
        }).toEqual({
            ...expected,
            legacyArchives: [...(expected.legacyArchives ?? [])].sort((a, b) =>
                a.id.localeCompare(b.id),
            ),
        });
        expect(await sha256(JSON.stringify(recovered))).toBe(
            archive.recoveryDigest,
        );
    }
    const bodies = (final.legacyArchives ?? []).filter(
        (a) => a.kind === 'previous-destination' && a.backup?.players?.length,
    );
    expect(bodies).toHaveLength(1);
});
it('looks up an unchanged migrated source readonly under staging quota, while changed sources require preparation', async () => {
    const source = await snapshotFromStores(
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
    const prepared = await publications.prepareLegacy('a', source);
    await publications.confirmSource('a', prepared.stageId, source.digest);
    await publications.publish('a', prepared.stageId);
    const before = await captureSharedData(db);
    const { IDBObjectStore } = await import('fake-indexeddb');
    const put = IDBObjectStore.prototype.put;
    const quota = vi
        .spyOn(IDBObjectStore.prototype, 'put')
        .mockImplementation(function (
            this: IDBObjectStore,
            ...args: Parameters<IDBObjectStore['put']>
        ) {
            if (this.name === 'migrationStaging')
                throw new DOMException('Staging full', 'QuotaExceededError');
            return put.apply(this, args);
        });
    const lookup = await service.execute(
        'a',
        'migration.lookup',
        { origin: source.origin, sourceDigest: source.digest },
        source.origin,
    );
    expect(lookup).toMatchObject({
        state: 'already-migrated',
        sourceDigest: source.digest,
    });
    expect(await captureSharedData(db)).toEqual(before);
    const next = await snapshotFromStores(
        source.origin,
        'SokkerTalentTrackerDB',
        3,
        [
            {
                name: 'players',
                keyPath: 'id',
                autoIncrement: false,
                indexes: [],
                records: [{ key: 12345, value: playerFixture(1000, 1001) }],
            },
        ],
    );
    expect(
        await service.execute(
            'a',
            'migration.lookup',
            { origin: source.origin, sourceDigest: next.digest },
            source.origin,
        ),
    ).toBeNull();
    await expect(publications.prepareLegacy('a', next)).rejects.toThrow();
    quota.mockRestore();
    await publications.clear();
    await expect(
        service.execute(
            'a',
            'migration.lookup',
            { origin: source.origin, sourceDigest: source.digest },
            source.origin,
        ),
    ).rejects.toMatchObject({ code: 'MIGRATION_BLOCKED' });
});
it('publishes, exports and imports colliding recovery DAGs while keeping every historical identity recoverable', async () => {
    const {
        createRecoveryArchive,
        rehydrateRecoveryArchive,
        canonicalRecoveryBackup,
        verifyRecoveryArchives,
    } = await import('./storageRecovery');
    const a = await createRecoveryArchive(
        { players: [playerFixture(1000)], legacyArchives: [] },
        'same',
    );
    const b = await createRecoveryArchive(
        { players: [playerFixture(1001)], legacyArchives: [] },
        'same',
    );
    const b2Source = { players: [playerFixture(1002)], legacyArchives: [b] };
    const b2 = await createRecoveryArchive(b2Source, 'b2');
    const first = await publications.prepareImport(
        'document',
        { players: [], legacyArchives: [a] },
        (await service.state()).epoch,
    );
    await publications.publish('document', first.stageId);
    const incoming = await publications.prepareImport(
        'document',
        { players: [], legacyArchives: [b, b2] },
        (await service.state()).epoch,
    );
    await publications.publish('document', incoming.stageId);
    const merged = (await captureSharedData(db)).data;
    expect(
        merged.legacyArchives!.some((record) => record.digest === a.digest),
    ).toBe(true);
    expect(
        merged.legacyArchives!.some(
            (record) => record.digest === b.digest && record.id !== b.id,
        ),
    ).toBe(true);
    expect(await rehydrateRecoveryArchive(b2, merged.legacyArchives!)).toEqual(
        canonicalRecoveryBackup(b2Source),
    );
    const future = await publications.prepareImport(
        'document',
        { players: [playerFixture(1200)] },
        (await service.state()).epoch,
    );
    await publications.publish('document', future.stageId);
    const exported = (await service.execute(
        'document',
        'getAllData',
        {},
    )) as import('./repository').BackupData;
    const previous = exported.legacyArchives!.find(
        (record) => record.id === `previous:${future.stageId}`,
    )!;
    expect(
        await rehydrateRecoveryArchive(previous, exported.legacyArchives!),
    ).toEqual(canonicalRecoveryBackup(merged));
    const transported = JSON.parse(JSON.stringify(exported));
    await verifyRecoveryArchives(transported);
    vi.stubGlobal('indexedDB', new IDBFactory());
    const restoredDb = await openSharedDatabase();
    try {
        const restoredPublisher = new PublicationService(restoredDb);
        const restoredState = (await captureSharedData(restoredDb)).state;
        const restoredStage = await restoredPublisher.prepareImport(
            'restorer',
            transported,
            restoredState.epoch,
        );
        await restoredPublisher.publish('restorer', restoredStage.stageId);
        const restored = (await captureSharedData(restoredDb)).data;
        expect(
            await rehydrateRecoveryArchive(b2, restored.legacyArchives!),
        ).toEqual(canonicalRecoveryBackup(b2Source));
        const later = await restoredPublisher.prepareImport(
            'restorer',
            { players: [playerFixture(1201)] },
            (await captureSharedData(restoredDb)).state.epoch,
        );
        await restoredPublisher.publish('restorer', later.stageId);
        const final = (await captureSharedData(restoredDb)).data;
        const snapshot = final.legacyArchives!.find(
            (record) => record.id === `previous:${later.stageId}`,
        )!;
        expect(
            await rehydrateRecoveryArchive(snapshot, final.legacyArchives!),
        ).toEqual(canonicalRecoveryBackup(restored));
        expect(
            await rehydrateRecoveryArchive(previous, final.legacyArchives!),
        ).toEqual(canonicalRecoveryBackup(merged));
    } finally {
        restoredDb.close();
    }
});
