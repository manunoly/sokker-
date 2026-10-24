import { StorageService } from '../../src/background/storageService';
import { TransferService } from '../../src/background/transferService';
import {
    openSharedDatabase,
    captureSharedData,
    transaction,
    guardedWrite,
} from '../../src/core/storageDatabase';
import { PublicationService } from '../../src/core/storageMigration';
import {
    canonicalRecoveryBackup,
    rehydrateRecoveryArchive,
    verifyRecoveryArchives,
} from '../../src/core/storageRecovery';
import {
    LEGACY_DATABASE_NAME,
    readLegacySnapshot,
    restoreLegacyArchive,
    snapshotFromStores,
    verifyLegacySnapshot,
} from '../../src/core/legacyStorage';
import {
    encodeLegacyStores,
    type LegacyStore,
} from '../../src/core/legacyCodec';
import {
    assertMessageSize,
    downloadTransfer,
    fragmentText,
    MAX_MESSAGE_BYTES,
    serializedBytes,
    sha256,
    TRANSFER_CHANNEL,
    type TransferManifest,
} from '../../src/core/transferProtocol';
import {
    STORAGE_CHANNEL,
    type LegacySnapshot,
    type WriteContext,
} from '../../src/core/storageTypes';
import type { BackupData } from '../../src/core/repository';
import {
    juniorFixture,
    playerFixture,
    weekFixture,
} from '../../src/core/storageFixtures';

const CATALOG_KEY = 'sokker++:native-storage-harness:v1';
const SHARED_NAME = 'SokkerPlusPlusDB';
const OWNER = 'synthetic-browser-document';
const MiB = 1024 * 1024;
type Catalog = { version: 1; databases: Record<string, string> };
export type CheckReport = {
    name: string;
    status: 'running' | 'passed' | 'failed';
    details?: unknown;
};
export type Reporter = (report: CheckReport) => void;

export function requireIsolatedOrigin(): void {
    if (
        location.protocol !== 'http:' ||
        !['127.0.0.1', 'localhost'].includes(location.hostname) ||
        location.port !== '4175'
    ) {
        throw new Error(
            'Refused: this harness runs only on HTTP loopback port 4175, never on Sokker.',
        );
    }
    if (typeof indexedDB.databases !== 'function')
        throw new Error('Safe database inventory is unavailable.');
}
function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}
async function rejects(work: Promise<unknown>, code?: string): Promise<void> {
    try {
        await work;
    } catch (error) {
        if (code)
            assert(
                !!error &&
                    typeof error === 'object' &&
                    'code' in error &&
                    error.code === code,
                `Expected ${code}: ${String(error)}`,
            );
        return;
    }
    throw new Error(`Expected rejection${code ? ` (${code})` : ''}`);
}
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const digest = (value: unknown) => sha256(JSON.stringify(value));
const weeksOf = (data: BackupData) =>
    data.players
        ?.find((player) => player.id === 12345)
        ?.history.map((row) => row.week) ?? [];
function containsWeeks(data: BackupData, weeks: number[]): void {
    const actual = weeksOf(data);
    assert(
        weeks.every((week) => actual.includes(week)),
        `Missing observations: expected ${weeks}, found ${actual}`,
    );
    assert(actual.length === new Set(actual).size, 'Duplicated observations');
}
function catalog(): Catalog {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return { version: 1, databases: {} };
    const value: unknown = JSON.parse(raw);
    assert(
        !!value &&
            typeof value === 'object' &&
            'version' in value &&
            value.version === 1 &&
            'databases' in value &&
            !!value.databases &&
            typeof value.databases === 'object' &&
            !Array.isArray(value.databases),
        'Invalid harness ownership catalog; no database will be opened.',
    );
    for (const [name, run] of Object.entries(value.databases)) {
        assert(
            typeof run === 'string' &&
                /^[a-f0-9-]{36}$/.test(run) &&
                (name === SHARED_NAME ||
                    name === LEGACY_DATABASE_NAME ||
                    name.startsWith(`SokkerRecovery-${run}-`)),
            'Unrecognized database in ownership catalog.',
        );
    }
    return value as Catalog;
}
function ownDatabase(name: string, runId: string): void {
    requireIsolatedOrigin();
    const value = catalog();
    assert(!value.databases[name], `Database already registered: ${name}`);
    value.databases[name] = runId;
    localStorage.setItem(CATALOG_KEY, JSON.stringify(value));
}
async function resetOwnedDatabases(): Promise<string[]> {
    requireIsolatedOrigin();
    const existing = await indexedDB.databases();
    const owned = catalog();
    assert(
        existing.every(
            (item) => !!item.name && Object.hasOwn(owned.databases, item.name),
        ),
        'Unknown pre-existing database detected. Refused all reads, writes and cleanup; use a fresh isolated origin/profile.',
    );
    const names = existing.map((item) => item.name!);
    for (const name of names) {
        requireIsolatedOrigin();
        assert(
            catalog().databases[name] === owned.databases[name],
            'Database ownership changed before cleanup.',
        );
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () =>
                reject(
                    new Error(
                        `Owned synthetic database is in use; close other harness tabs: ${name}`,
                    ),
                );
        });
    }
    localStorage.setItem(
        CATALOG_KEY,
        JSON.stringify({ version: 1, databases: {} }),
    );
    return names;
}

/** Independent native schema/key/value inspection is the assertion oracle for recovery. */
async function inspect(database: IDBDatabase): Promise<LegacyStore[]> {
    const names = Array.from(database.objectStoreNames).sort();
    return transaction(database, names, 'readonly', (tx, set) => {
        const stores: LegacyStore[] = [];
        set(stores);
        for (const name of names) {
            const native = tx.objectStore(name);
            const store: LegacyStore = {
                name,
                keyPath: native.keyPath,
                autoIncrement: native.autoIncrement,
                indexes: Array.from(native.indexNames)
                    .sort()
                    .map((name) => {
                        const index = native.index(name);
                        return {
                            name,
                            keyPath: index.keyPath,
                            unique: index.unique,
                            multiEntry: index.multiEntry,
                        };
                    }),
                records: [],
            };
            stores.push(store);
            const request = native.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    store.records.push({
                        key: cursor.primaryKey,
                        value: cursor.value,
                    });
                    cursor.continue();
                }
            };
        }
    });
}
async function createSource(runId: string): Promise<IDBDatabase> {
    ownDatabase(LEGACY_DATABASE_NAME, runId);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(LEGACY_DATABASE_NAME, 3);
        request.onupgradeneeded = () => {
            const db = request.result;
            db.createObjectStore('players', { keyPath: 'id' });
            db.createObjectStore('juniors', {
                keyPath: ['teamId', 'juniorId'],
            });
            db.createObjectStore('metadata', { keyPath: 'key' });
            db.createObjectStore('weeks', { keyPath: 'week' });
            const unknown = db.createObjectStore('unknown-schema', {
                autoIncrement: true,
            });
            unknown.createIndex('by-label', 'label', { unique: true });
            unknown.createIndex('by-tags', 'tags', { multiEntry: true });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    await transaction(
        database,
        Array.from(database.objectStoreNames),
        'readwrite',
        (tx, set) => {
            tx.objectStore('players').put(playerFixture(1000, 1001));
            tx.objectStore('juniors').put(juniorFixture());
            tx.objectStore('metadata').put({
                key: 'lastSyncWeek',
                value: 1001,
                extra: undefined,
            });
            tx.objectStore('weeks').put({
                week: 1001,
                extra: 'legacy team context unknown',
            });
            const bytes = new Uint8Array([1, 2, 3, 4]);
            const sparse = new Array(3);
            sparse[2] = undefined;
            tx.objectStore('unknown-schema').put(
                {
                    label: 'synthetic-only',
                    tags: ['one', 'two'],
                    missing: undefined,
                    when: new Date('2026-10-23T00:00:00Z'),
                    bytes,
                    map: new Map([['preserved', undefined]]),
                    set: new Set([7, 9]),
                    sparse,
                },
                17,
            );
            set(undefined);
        },
    );
    return database;
}

interface WireResponse {
    ok: boolean;
    value?: unknown;
    transfer?: TransferManifest;
    code?: string;
    message?: string;
}
class LocalWire {
    maxRequestBytes = 0;
    maxResponseBytes = 0;
    messages = 0;
    constructor(public service: StorageService) {}
    /** A real JSON serialization boundary, with no extension runtime impersonation. */
    send = async (message: unknown): Promise<WireResponse> => {
        assertMessageSize(message);
        this.maxRequestBytes = Math.max(
            this.maxRequestBytes,
            serializedBytes(message),
        );
        this.messages++;
        const response = await this.service.handle(
            OWNER,
            JSON.parse(JSON.stringify(message)),
            location.origin,
        );
        assertMessageSize(response);
        this.maxResponseBytes = Math.max(
            this.maxResponseBytes,
            serializedBytes(response),
        );
        return JSON.parse(JSON.stringify(response)) as WireResponse;
    };
    unwrap(response: WireResponse): unknown {
        assert(
            response.ok === true,
            `Storage response failed: ${response.code}: ${response.message}`,
        );
        return response.value;
    }
    async request(operation: string, input: unknown): Promise<unknown> {
        const message = { channel: STORAGE_CHANNEL, operation, input };
        let response: WireResponse;
        if (serializedBytes(message) > MAX_MESSAGE_BYTES) {
            let text = JSON.stringify(message);
            const frames = fragmentText(text, (frame) => ({
                channel: TRANSFER_CHANNEL,
                operation: 'transfer.write',
                transferId: '00000000-0000-0000-0000-000000000000',
                ...frame,
            }));
            const manifest = this.unwrap(
                await this.send({
                    channel: TRANSFER_CHANNEL,
                    operation: 'transfer.begin',
                    totalFrames: frames.length,
                    totalBytes: new TextEncoder().encode(text).byteLength,
                    digest: await sha256(text),
                }),
            ) as TransferManifest;
            for (let index = 0; index < frames.length; index++) {
                this.unwrap(
                    await this.send({
                        channel: TRANSFER_CHANNEL,
                        operation: 'transfer.write',
                        transferId: manifest.transferId,
                        index,
                        text: frames[index],
                    }),
                );
                if (index % 32 === 0) await pause();
            }
            text = '';
            frames.length = 0;
            response = await this.send({
                channel: STORAGE_CHANNEL,
                operation: 'request.upload',
                transferId: manifest.transferId,
            });
        } else response = await this.send(message);
        if (response.transfer)
            return downloadTransfer(response.transfer, this.send);
        return this.unwrap(response);
    }
    metrics() {
        return {
            messages: this.messages,
            maxRequestBytes: this.maxRequestBytes,
            maxResponseBytes: this.maxResponseBytes,
            limit: MAX_MESSAGE_BYTES,
        };
    }
}

export async function runStorageChecks(report: Reporter): Promise<unknown> {
    requireIsolatedOrigin();
    const runId = crypto.randomUUID();
    const evidence: Record<string, unknown> = {
        runId,
        origin: location.origin,
        nativeIndexedDB: true,
        extensionRuntime: false,
        network: false,
    };
    const connections: IDBDatabase[] = [];
    const broadcasts: unknown[] = [];
    Object.defineProperty(globalThis, 'chrome', {
        configurable: true,
        value: {
            runtime: {
                sendMessage: async (message: unknown) => {
                    broadcasts.push(message);
                },
            },
            tabs: { query: async () => [], sendMessage: async () => undefined },
        },
    });
    globalThis.fetch = async () => {
        throw new Error('All harness fetch calls are disabled.');
    };
    const step = async <T>(
        name: string,
        work: () => Promise<T>,
    ): Promise<T> => {
        report({ name, status: 'running' });
        await pause();
        try {
            const details = await work();
            report({ name, status: 'passed', details });
            return details;
        } catch (error) {
            report({
                name,
                status: 'failed',
                details: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    };
    let source!: LegacySnapshot;
    let service!: StorageService;
    let publisher!: PublicationService;
    let db!: IDBDatabase;
    let wire!: LocalWire;
    const save = async (week: number, ctx?: WriteContext) =>
        service.execute(OWNER, 'savePlayerCarryOverEntry', {
            ctx:
                ctx ??
                (await service.execute(OWNER, 'getWriteContext', {
                    teamId: 42,
                })),
            id: 12345,
            name: 'Synthetic Player',
            entry: weekFixture(week),
        });
    try {
        evidence.setup = await step(
            '1. Fail-closed origin/ownership gate and synthetic source capture',
            async () => {
                const removedOwned = await resetOwnedDatabases();
                const sourceDb = await createSource(runId);
                connections.push(sourceDb);
                const captured = await readLegacySnapshot();
                assert(captured, 'Synthetic legacy source was not found');
                source = captured;
                const stores = await verifyLegacySnapshot(source);
                const custom = stores.find(
                    (store) => store.name === 'unknown-schema',
                )!.records[0].value as Record<string, unknown>;
                assert(
                    Object.hasOwn(custom, 'missing') &&
                        custom.missing === undefined,
                    'Undefined field was lost',
                );
                assert(
                    custom.map instanceof Map &&
                        custom.bytes instanceof Uint8Array,
                    'Structured clone values were lost',
                );
                assert(
                    stores.length === 5,
                    'The additional schema was not captured',
                );
                sourceDb.close();
                ownDatabase(SHARED_NAME, runId);
                db = await openSharedDatabase();
                connections.push(db);
                service = new StorageService(new TransferService(), db);
                publisher = new PublicationService(db);
                wire = new LocalWire(service);
                return {
                    removedOwned,
                    sourceDigest: source.digest,
                    sourceVersion: source.databaseVersion,
                    inventory: source.inventory,
                };
            },
        );
        evidence.recovery = await step(
            '2. Restore the complete source archive into an isolated database',
            async () => {
                const name = `SokkerRecovery-${runId}-source`;
                ownDatabase(name, runId);
                const restored = await restoreLegacyArchive(source, name);
                connections.push(restored);
                const encoded = encodeLegacyStores(await inspect(restored));
                assert(
                    encoded === source.encodedStores &&
                        restored.version === source.databaseVersion,
                    'Recovered schema/keys/values differ',
                );
                const recoveredDigest = await sha256(encoded);
                restored.close();
                return {
                    database: name,
                    version: source.databaseVersion,
                    stores: source.inventory.length,
                    encodedDigest: recoveredDigest,
                    exactSchemaKeysValues: true,
                };
            },
        );
        evidence.migration = await step(
            '3. Interrupted/repeated migration and service-instance restart',
            async () => {
                const prepared = await publisher.prepareLegacy(OWNER, source);
                await rejects(publisher.publish(OWNER, prepared.stageId));
                assert(
                    (await captureSharedData(db)).data.players?.length === 0,
                    'An unconfirmed stage became active',
                );
                db.close();
                db = await openSharedDatabase();
                connections.push(db);
                publisher = new PublicationService(db);
                service = new StorageService(new TransferService(), db);
                wire.service = service;
                const rechecked = await readLegacySnapshot();
                assert(
                    rechecked?.digest === source.digest,
                    'Source changed while staging',
                );
                await publisher.confirmSource(
                    OWNER,
                    prepared.stageId,
                    rechecked.digest,
                );
                const receipt = await publisher.publish(
                    OWNER,
                    prepared.stageId,
                );
                const state = await service.state();
                const restarted = new StorageService(new TransferService(), db);
                assert(
                    JSON.stringify(
                        await restarted.execute(
                            OWNER,
                            'getPublicationReceipt',
                            { stageId: prepared.stageId },
                        ),
                    ) === JSON.stringify(receipt),
                    'Receipt did not survive instance restart',
                );
                await new PublicationService(db).publish(
                    OWNER,
                    prepared.stageId,
                );
                assert(
                    (await service.state()).revision === state.revision,
                    'Receipt replay duplicated publication',
                );
                const beforeLookup = encodeLegacyStores(await inspect(db));
                for (let retry = 0; retry < 4; retry++) {
                    const repeated = (await wire.request('migration.lookup', {
                        origin: source.origin,
                        sourceDigest: source.digest,
                    })) as { state: string } | null;
                    assert(
                        repeated?.state === 'already-migrated',
                        'Confirmed source was not recognized by the read-only lookup',
                    );
                }
                assert(
                    (await wire.request('migration.lookup', {
                        origin: source.origin,
                        sourceDigest: '0'.repeat(64),
                    })) === null,
                    'An unconfirmed source digest was accepted',
                );
                assert(
                    encodeLegacyStores(await inspect(db)) === beforeLookup,
                    'Repeated migration lookup changed native data, controls, staging or archives',
                );
                const active = (await captureSharedData(db)).data;
                containsWeeks(active, [1000, 1001]);
                assert(
                    (await readLegacySnapshot())?.digest === source.digest,
                    'Migration changed the source',
                );
                assert(
                    active.legacyArchives?.some(
                        (archive) => archive.snapshot?.digest === source.digest,
                    ),
                    'Complete source archive missing',
                );
                return {
                    receipt: receipt.state,
                    repeat: 'already-migrated',
                    sourceDigest: source.digest,
                    weeks: weeksOf(active),
                };
            },
        );
        evidence.importCas = await step(
            '4. Import CAS, concurrent observations/imports and stale contexts',
            async () => {
                const oldCtx = (await service.execute(
                    OWNER,
                    'getWriteContext',
                    { teamId: 42 },
                )) as WriteContext;
                const staged = await publisher.prepareImport(
                    OWNER,
                    { players: [playerFixture(1002)] },
                    oldCtx.epoch,
                );
                await save(1200, oldCtx);
                await save(1201, oldCtx);
                const beforePublish = (await captureSharedData(db)).data;
                const priorDigest = await digest(
                    canonicalRecoveryBackup(beforePublish),
                );
                await publisher.publish(OWNER, staged.stageId);
                await rejects(save(1300, oldCtx), 'STALE_EPOCH');
                let active = (await captureSharedData(db)).data;
                containsWeeks(active, [1000, 1001, 1002, 1200, 1201]);
                const previous = active.legacyArchives?.find(
                    (archive) =>
                        archive.kind === 'previous-destination' &&
                        archive.recoveryDigest === priorDigest,
                );
                assert(
                    previous,
                    'Rebased publication did not archive the actual previous destination',
                );
                const recoveredPrevious = await rehydrateRecoveryArchive(
                    previous,
                    active.legacyArchives ?? [],
                );
                assert(
                    (await digest(recoveredPrevious)) === priorDigest,
                    'Rehydrated previous destination differs from the complete pre-publication capture',
                );
                containsWeeks(recoveredPrevious, [1000, 1001, 1200, 1201]);
                await verifyRecoveryArchives(recoveredPrevious);
                const epoch = (await service.state()).epoch;
                const a = await publisher.prepareImport(
                    'import-a',
                    { players: [playerFixture(1003)] },
                    epoch,
                );
                const b = await publisher.prepareImport(
                    'import-b',
                    { players: [playerFixture(1004)] },
                    epoch,
                );
                const results = await Promise.allSettled([
                    publisher.publish('import-a', a.stageId),
                    publisher.publish('import-b', b.stageId),
                ]);
                assert(
                    results.filter((result) => result.status === 'fulfilled')
                        .length === 1,
                    'Concurrent imports did not enforce epoch CAS',
                );
                const loser =
                    results[0].status === 'rejected'
                        ? { owner: 'import-a', week: 1003 }
                        : { owner: 'import-b', week: 1004 };
                const failure = results.find(
                    (result) => result.status === 'rejected',
                ) as PromiseRejectedResult;
                assert(
                    failure.reason.code === 'STALE_EPOCH',
                    'Concurrent import failed for an unexpected reason',
                );
                const retried = await publisher.prepareImport(
                    loser.owner,
                    { players: [playerFixture(loser.week)] },
                    (await service.state()).epoch,
                );
                await publisher.publish(loser.owner, retried.stageId);
                active = (await captureSharedData(db)).data;
                containsWeeks(
                    active,
                    [1000, 1001, 1002, 1003, 1004, 1200, 1201],
                );
                return {
                    weeks: weeksOf(active),
                    concurrentCommitCount: 1,
                    loserRetriedInNewEpoch: true,
                    staleContextRejected: true,
                };
            },
        );
        evidence.recoveryDag = await step(
            '5. Twelve repeated imports keep recovery bodies flat, unique and fully recoverable',
            async () => {
                const before = (await captureSharedData(db)).data;
                const beforeBytes = serializedBytes(before);
                const restoredDigests: string[] = [];
                for (let attempt = 0; attempt < 12; attempt++) {
                    const capture = (await captureSharedData(db)).data;
                    const recoveryDigest = await digest(
                        canonicalRecoveryBackup(capture),
                    );
                    const prepared = await publisher.prepareImport(
                        OWNER,
                        { players: [playerFixture(1001)] },
                        (await service.state()).epoch,
                    );
                    await publisher.publish(OWNER, prepared.stageId);
                    const active = (await captureSharedData(db)).data;
                    const registry = active.legacyArchives ?? [];
                    const archived = registry.find(
                        (archive) =>
                            archive.kind === 'previous-destination' &&
                            archive.recoveryDigest === recoveryDigest,
                    );
                    assert(
                        archived,
                        'Repeated import omitted its full prior destination',
                    );
                    const restored = await rehydrateRecoveryArchive(
                        archived,
                        registry,
                    );
                    assert(
                        (await digest(restored)) === recoveryDigest,
                        'Repeated import recovery changed prior observations or recovery records',
                    );
                    containsWeeks(
                        restored,
                        [1000, 1001, 1002, 1003, 1004, 1200, 1201],
                    );
                    restoredDigests.push(recoveryDigest);
                    await pause();
                }
                const after = (await captureSharedData(db)).data;
                const inline = (after.legacyArchives ?? []).filter(
                    (archive) =>
                        archive.kind === 'previous-destination' &&
                        archive.backup,
                );
                assert(
                    inline.every(
                        (archive) =>
                            archive.backup!.legacyArchives === undefined,
                    ),
                    'A recovery body recursively embeds earlier archives',
                );
                const bodyDigests = inline.map(
                    (archive) => archive.backupDigest,
                );
                assert(
                    bodyDigests.every((value) => typeof value === 'string') &&
                        new Set(bodyDigests).size === bodyDigests.length,
                    'Repeated imports duplicated identical inline recovery bodies',
                );
                await verifyRecoveryArchives(after);
                return {
                    repeatedImports: 12,
                    beforeBytes,
                    afterBytes: serializedBytes(after),
                    inlineBodies: inline.length,
                    totalArchives: after.legacyArchives?.length ?? 0,
                    everyPriorDestinationRehydrated: true,
                    recoveryDigests: restoredDigests,
                };
            },
        );
        evidence.rollback = await step(
            '6. Preserve post-activation observations while rehearsing return to the source',
            async () => {
                const capture = await captureSharedData(db);
                const exported = (await wire.request(
                    'getAllData',
                    {},
                )) as BackupData;
                containsWeeks(exported, [1200, 1201]);
                const exportDigest = await digest(exported);
                const recovery = `SokkerRecovery-${runId}-rollback`;
                ownDatabase(recovery, runId);
                const restored = await restoreLegacyArchive(source, recovery);
                connections.push(restored);
                assert(
                    encodeLegacyStores(await inspect(restored)) ===
                        source.encodedStores,
                    'Rollback source recovery differs',
                );
                restored.close();
                const after = await captureSharedData(db);
                assert(
                    (await digest(after)) === (await digest(capture)),
                    'Return rehearsal overwrote active destination data or controls',
                );
                const ctx = (await service.execute(OWNER, 'getWriteContext', {
                    teamId: 42,
                })) as WriteContext;
                await rejects(
                    guardedWrite(db, ['players'], ctx, (tx, _set, fail) => {
                        tx.objectStore('players').put(playerFixture(9999));
                        fail(new Error('Synthetic native transaction abort'));
                    }),
                );
                assert(
                    (await digest(await captureSharedData(db))) ===
                        (await digest(after)),
                    'Native aborted write changed data/epoch/revision',
                );
                return {
                    preservedDestinationExportDigest: exportDigest,
                    preservedWeeks: weeksOf(exported),
                    sourceRecovery: recovery,
                    nativeAbortRolledBack: true,
                };
            },
        );
        evidence.clear = await step(
            '7. Clear tombstone blocks old writes and a previously unseen origin',
            async () => {
                const oldCtx = (await service.execute(
                    OWNER,
                    'getWriteContext',
                    { teamId: 42 },
                )) as WriteContext;
                await service.execute(OWNER, 'clearSharedData', {});
                await rejects(save(1400, oldCtx), 'STALE_EPOCH');
                const unknown = await snapshotFromStores(
                    'https://synthetic.sokker.org',
                    LEGACY_DATABASE_NAME,
                    source.databaseVersion,
                    await verifyLegacySnapshot(source),
                );
                await rejects(
                    publisher.prepareLegacy(OWNER, unknown),
                    'MIGRATION_BLOCKED',
                );
                assert(
                    (await service.state()).automaticMigrationBlocked,
                    'Clear tombstone disappeared',
                );
                assert(
                    (await captureSharedData(db)).data.players?.length === 0,
                    'Clear was repopulated by stale data',
                );
                assert(
                    (await readLegacySnapshot())?.digest === source.digest,
                    'Clear changed the source',
                );
                const explicit = await publisher.prepareImport(
                    OWNER,
                    { players: [playerFixture(1500)] },
                    (await service.state()).epoch,
                );
                await publisher.publish(OWNER, explicit.stageId);
                return {
                    staleWriteRejected: true,
                    newOriginMigrationBlocked: true,
                    explicitImportStillAvailable: true,
                    sourceDigest: source.digest,
                };
            },
        );
        evidence.largeBackup = await step(
            '8. Import/export >64 MiB with exact JSON envelope bounds and a fixed export snapshot',
            async () => {
                let payload = 'x'.repeat(65 * MiB) + ' end \" \u{1F603}';
                const payloadDigest = await sha256(payload);
                const payloadBytes = new TextEncoder().encode(
                    payload,
                ).byteLength;
                let backup: BackupData | undefined = {
                    formatVersion: 2,
                    players: [playerFixture(2000)],
                    legacyArchives: [
                        {
                            id: `legacy:${source.origin}:${source.digest}`,
                            kind: 'legacy',
                            snapshot: source,
                            digest: source.digest,
                        },
                    ],
                    migrationConflicts: [
                        {
                            id: 'synthetic-large-conflict',
                            origin: location.origin,
                            entity: 'synthetic-only',
                            coordinate: 0,
                            discarded: payload,
                            reason: 'Generated native-browser transfer stress',
                        },
                    ],
                };
                const inputBytes = serializedBytes(backup);
                assert(inputBytes > 64 * MiB, 'Generated backup is too small');
                const begin = (await wire.request(
                    'backup.import.begin',
                    {},
                )) as { attemptId: string };
                const prepared = (await wire.request('backup.import.prepare', {
                    attemptId: begin.attemptId,
                    data: backup,
                })) as { stageId: string };
                backup = undefined;
                payload = '';
                await pause();
                await wire.request('backup.import.publish', {
                    stageId: prepared.stageId,
                });
                const ctx = (await service.execute(OWNER, 'getWriteContext', {
                    teamId: 42,
                })) as WriteContext;
                const response = await wire.send({
                    channel: STORAGE_CHANNEL,
                    operation: 'getAllData',
                    input: {},
                });
                assert(
                    response.transfer &&
                        response.transfer.totalBytes > 64 * MiB,
                    'Large export was not fragmented',
                );
                // The export has fixed a readonly snapshot. This write happens while its frames are in flight.
                await save(2400, ctx);
                const recovered = (await downloadTransfer(
                    response.transfer,
                    wire.send,
                )) as BackupData;
                assert(
                    !weeksOf(recovered).includes(2400),
                    'Export mixed a later observation into the pinned snapshot',
                );
                containsWeeks(recovered, [1500, 2000]);
                const conflict = recovered.migrationConflicts?.find(
                    (item) => item.id === 'synthetic-large-conflict',
                );
                assert(
                    typeof conflict?.discarded === 'string' &&
                        (await sha256(conflict.discarded)) === payloadDigest,
                    'Large conflict payload changed',
                );
                const archive = recovered.legacyArchives?.find(
                    (item) => item.snapshot?.digest === source.digest,
                );
                assert(
                    archive?.snapshot,
                    'Complete legacy archive missing from large round-trip',
                );
                await verifyLegacySnapshot(archive.snapshot);
                await verifyRecoveryArchives(recovered);
                const resultDigest = await digest(recovered);
                assert(
                    resultDigest === response.transfer.digest,
                    'Recovered export digest differs from its manifest',
                );
                const activePlayer = (await service.execute(
                    OWNER,
                    'getPlayerHistory',
                    { id: 12345 },
                )) as { history: Array<{ week: number }> };
                assert(
                    activePlayer.history.some((row) => row.week === 2400),
                    'Concurrent observation was not committed',
                );
                const metrics = wire.metrics();
                assert(
                    metrics.maxRequestBytes <= MAX_MESSAGE_BYTES &&
                        metrics.maxResponseBytes <= MAX_MESSAGE_BYTES,
                    'A full wire envelope exceeded the limit',
                );
                return {
                    inputBytes,
                    outputBytes: response.transfer.totalBytes,
                    payloadBytes,
                    payloadDigest,
                    outputDigest: resultDigest,
                    downloadFrames: response.transfer.totalFrames,
                    archiveDigest: archive.snapshot.digest,
                    pinnedExportExcludedWeek: 2400,
                    activeDestinationIncludesWeek: 2400,
                    ...metrics,
                };
            },
        );
        evidence.transportFailure = await step(
            '9. Interrupted transfer/restarted service cannot announce a complete result',
            async () => {
                const before = await service.state();
                const transfer = new TransferService();
                const manifest = await transfer.createDownload(OWNER, {
                    synthetic: 'value',
                });
                await rejects(
                    new TransferService().handle(OWNER, {
                        channel: TRANSFER_CHANNEL,
                        operation: 'transfer.read',
                        transferId: manifest.transferId,
                        index: 0,
                    }),
                    'UNKNOWN_TRANSFER',
                );
                const broken = await transfer.createDownload(OWNER, {
                    synthetic: 'integrity',
                });
                await rejects(
                    downloadTransfer(broken, async (message) => {
                        const response = (await transfer.handle(
                            OWNER,
                            message,
                        )) as {
                            ok: true;
                            value: { index: number; text: string };
                        };
                        if (
                            'value' in response &&
                            response.value &&
                            typeof response.value.text === 'string'
                        )
                            response.value.text += 'tampered';
                        return response;
                    }),
                );
                assert(
                    JSON.stringify(await service.state()) ===
                        JSON.stringify(before),
                    'Failed transfer changed destination controls',
                );
                return {
                    lostTransferRejected: true,
                    alteredFrameRejected: true,
                    activeStateUnchanged: true,
                };
            },
        );
        evidence.sourceAfter = {
            digest: (await readLegacySnapshot())?.digest,
            unchanged: (await readLegacySnapshot())?.digest === source.digest,
        };
        assert(
            (evidence.sourceAfter as { unchanged: boolean }).unchanged,
            'Final source digest differs',
        );
        evidence.broadcasts = broadcasts.length;
        evidence.complete = true;
        return evidence;
    } finally {
        for (const connection of connections) connection.close();
    }
}
