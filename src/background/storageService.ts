import type { PlayerData, PlayerHistoryEntry } from '../types';
import { upsertPlayerWeekRecord, type BackupData } from '../core/repository';
import {
    mergeJuniorGraphRecord,
    mergeJuniorResolutionRecord,
    mergeJuniorRosterRecord,
} from '../core/juniorRepository';
import type { JuniorRecord, JuniorRosterSnapshot } from '../core/juniorTypes';
import {
    captureSharedData,
    guardedWrite,
    openSharedDatabase,
    readState,
    transaction,
} from '../core/storageDatabase';
import { PublicationService, validateBackup } from '../core/storageMigration';
import { extractTrainingReport } from '../core/trainingReport';
import {
    assertMessageSize,
    MAX_MESSAGE_BYTES,
    serializedBytes,
    sha256,
    TRANSFER_CHANNEL,
} from '../core/transferProtocol';
import {
    STORAGE_CHANNEL,
    STORAGE_CHANGED,
    StorageError,
    type LegacySnapshot,
    type StorageOperations,
    type StorageState,
    type WriteContext,
} from '../core/storageTypes';
import { getMessageOwner } from './messageOwner';
import { TransferService } from './transferService';
const positive = (x: unknown): x is number =>
    typeof x === 'number' && Number.isSafeInteger(x) && x > 0;
const object = (x: unknown): x is Record<string, any> =>
    !!x && typeof x === 'object' && !Array.isArray(x);
function invalid(message = 'Invalid storage request'): never {
    throw new StorageError('INVALID_REQUEST', message);
}
function validate(
    operation: string,
    input: unknown,
): asserts input is Record<string, any> {
    if (!object(input)) invalid();
    const p = input;
    const requiredIds = [
        'getPlayerHistory',
        'getJuniorRecord',
        'savePlayerCarryOverEntry',
        'saveJuniorGraph',
        'saveJuniorResolution',
    ];
    const requiredTeams = [
        'getWriteContext',
        'getJuniorRecord',
        'getJuniorRecords',
        'getJuniorRosterSnapshot',
        'getLastSyncWeek',
        'isWeekSynced',
    ];
    const requiredWeeks = [
        'isWeekSynced',
        'saveWeekData',
        'markWeekEmpty',
        'saveJuniorGraph',
        'saveJuniorResolution',
    ];
    if (requiredIds.includes(operation) && !positive(p.id))
        invalid('A positive entity ID is required');
    if (requiredTeams.includes(operation) && !positive(p.teamId))
        invalid('A positive team ID is required');
    if (requiredWeeks.includes(operation) && !positive(p.week))
        invalid('A positive week is required');
    if (
        [
            'migration.publish',
            'backup.import.publish',
            'migration.confirmSource',
            'getPublicationReceipt',
        ].includes(operation) &&
        (typeof p.stageId !== 'string' || !p.stageId)
    )
        invalid('A stage ID is required');
    if (
        operation === 'getMutationReceipt' &&
        (typeof p.requestId !== 'string' || typeof p.digest !== 'string')
    )
        invalid('Receipt identity is required');
    const ctx = p.ctx;
    if (operation.startsWith('save') || operation === 'markWeekEmpty') {
        if (
            !object(ctx) ||
            !positive(ctx.teamId) ||
            typeof ctx.epoch !== 'string'
        )
            invalid('Invalid write context');
    }
    if ('teamId' in p && !positive(p.teamId)) invalid();
    if ('id' in p && !positive(p.id)) invalid();
    if ('week' in p && !positive(p.week)) invalid();
    if (
        operation === 'getJuniorRecords' &&
        (!Array.isArray(p.ids) || !p.ids.every(positive))
    )
        invalid();
    if (operation === 'savePlayerCarryOverEntry') {
        if (typeof p.name !== 'string') invalid();
        validateBackup({
            players: [
                { id: p.id, name: p.name, latest: p.entry, history: [p.entry] },
            ],
        });
    }
    if (operation === 'saveWeekData') {
        if (
            !Array.isArray(p.players) ||
            p.players.some(
                (entry: any) =>
                    !object(entry) ||
                    !positive(entry.id) ||
                    !object(entry.player) ||
                    !object(entry.player.name) ||
                    typeof entry.player.name.full !== 'string' ||
                    !object(entry.player.value) ||
                    typeof entry.player.value.value !== 'number' ||
                    !Number.isFinite(entry.player.value.value) ||
                    !object(entry.report) ||
                    (entry.report.skills !== undefined &&
                        (!object(entry.report.skills) ||
                            !Object.values(entry.report.skills).every(
                                (value) =>
                                    typeof value === 'number' &&
                                    Number.isFinite(value),
                            ))),
            )
        )
            invalid('Invalid training data');
    }
    if (
        operation === 'saveJuniorGraph' &&
        (!Array.isArray(p.points) ||
            p.points.some(
                (v: any) =>
                    !object(v) ||
                    !Number.isSafeInteger(v.x) ||
                    typeof v.y !== 'number' ||
                    !Number.isFinite(v.y) ||
                    v.y < 0 ||
                    v.y > 18 ||
                    v.source !== 'graph',
            ))
    )
        invalid();
    if (
        operation === 'saveJuniorResolution' &&
        !['absent', 'unknown'].includes(p.resolution)
    )
        invalid();
    if (operation === 'saveJuniorRosterSnapshot') {
        if (
            !object(p.snapshot) ||
            p.snapshot.teamId !== ctx.teamId ||
            !positive(p.snapshot.week) ||
            !Array.isArray(p.snapshot.ids) ||
            !p.snapshot.ids.every(positive) ||
            typeof p.snapshot.complete !== 'boolean' ||
            !Array.isArray(p.entries) ||
            p.entries.some(
                (e: any) =>
                    !object(e) ||
                    e.teamId !== ctx.teamId ||
                    !positive(e.id) ||
                    (e.talent !== null &&
                        (typeof e.talent !== 'number' ||
                            !Number.isFinite(e.talent))) ||
                    (e.weeksLeft !== null &&
                        (!Number.isSafeInteger(e.weeksLeft) ||
                            e.weeksLeft < 0)),
            )
        )
            invalid('Invalid roster ownership');
    }
}
export class StorageService {
    readonly ready: Promise<IDBDatabase>;
    private imports = new Map<
        string,
        {
            owner: string;
            epoch: string;
        }
    >();
    constructor(
        readonly transfers = new TransferService(),
        database?: IDBDatabase,
    ) {
        this.ready = database
            ? Promise.resolve(database)
            : openSharedDatabase();
    }
    async state(): Promise<StorageState> {
        const db = await this.ready;
        return transaction(db, ['control'], 'readonly', (tx, set) =>
            readState(tx, set),
        );
    }
    async execute(
        owner: string,
        operation: string,
        input: unknown,
        origin?: string,
        requestId?: string,
    ): Promise<unknown> {
        validate(operation, input);
        const p = input;
        const db = await this.ready;
        const publisher = new PublicationService(db);
        const mutationIdentity = requestId
            ? {
                  id: requestId,
                  owner,
                  digest: await sha256(JSON.stringify({ operation, input })),
              }
            : undefined;
        const get = <T>(
            store: string,
            key: IDBValidKey,
            select: (value: any) => T = (v) => v ?? null,
        ) =>
            transaction<T>(db, [store], 'readonly', (tx, set) => {
                const r = tx.objectStore(store).get(key);
                r.onsuccess = () => set(select(r.result));
            });
        const write = (
            stores: string[],
            enqueue: (tx: IDBTransaction) => void,
        ) =>
            this.afterCommit(
                guardedWrite<void>(
                    db,
                    stores,
                    p.ctx as WriteContext,
                    (tx, set) => {
                        enqueue(tx);
                        set(undefined);
                    },
                    mutationIdentity,
                ),
            );
        const putPlayer = (
            tx: IDBTransaction,
            id: number,
            name: string,
            entry: PlayerHistoryEntry,
        ) => {
            const store = tx.objectStore('players');
            const r = store.get(id);
            r.onsuccess = () =>
                store.put(upsertPlayerWeekRecord(r.result, id, name, entry));
        };
        switch (operation) {
            case 'ensureStorageReady':
                return this.state();
            case 'getWriteContext': {
                if (!positive(p.teamId)) invalid();
                return { teamId: p.teamId, epoch: (await this.state()).epoch };
            }
            case 'getPlayerHistory':
                if (!positive(p.id)) invalid();
                return get('players', p.id);
            case 'getAllPlayers':
                return transaction(db, ['players'], 'readonly', (tx, set) => {
                    const r = tx.objectStore('players').getAll();
                    r.onsuccess = () => set(r.result);
                });
            case 'getJuniorRecord':
                return get('juniors', [p.teamId, p.id]);
            case 'getJuniorRecords':
                return transaction(db, ['juniors'], 'readonly', (tx, set) => {
                    const entries: Array<[number, JuniorRecord]> = [];
                    set(entries);
                    for (const id of new Set<number>(p.ids)) {
                        const r = tx.objectStore('juniors').get([p.teamId, id]);
                        r.onsuccess = () => {
                            if (r.result) entries.push([id, r.result]);
                        };
                    }
                });
            case 'getJuniorRosterSnapshot':
                return get(
                    'metadata',
                    `juniorRoster:${p.teamId}`,
                    (v) => v?.value ?? null,
                );
            case 'getLastSyncWeek':
                return get(
                    'metadata',
                    `lastSyncWeek:${p.teamId}`,
                    (v) => v?.value ?? null,
                );
            case 'isWeekSynced':
                return get('weeks', [p.teamId, p.week], (v) => !!v);
            case 'getMutationReceipt':
                return get('control', `mutation:${p.requestId}`, (value) => {
                    if (value && value.digest !== p.digest)
                        invalid('Receipt digest differs');
                    return value?.receipt ?? null;
                });
            case 'getAllData':
                return (await captureSharedData(db)).data;
            case 'savePlayerCarryOverEntry':
                return write(['players'], (tx) =>
                    putPlayer(tx, p.id, p.name, p.entry),
                );
            case 'markWeekEmpty':
                return write(['weeks'], (tx) =>
                    tx.objectStore('weeks').put({
                        teamId: p.ctx.teamId,
                        week: p.week,
                        empty: true,
                        syncedAt: new Date().toISOString(),
                    }),
                );
            case 'saveWeekData':
                return write(['players', 'metadata', 'weeks'], (tx) => {
                    const meta = tx.objectStore('metadata');
                    const r = meta.get(`lastSyncWeek:${p.ctx.teamId}`);
                    r.onsuccess = () =>
                        meta.put({
                            key: `lastSyncWeek:${p.ctx.teamId}`,
                            value: Math.max(p.week, r.result?.value ?? 0),
                        });
                    tx.objectStore('weeks').put({
                        teamId: p.ctx.teamId,
                        week: p.week,
                        syncedAt: new Date().toISOString(),
                    });
                    for (const entry of p.players) {
                        const report = entry.report;
                        if (
                            !report.skills ||
                            report.kind?.name === 'missing' ||
                            report.kind?.code === 3
                        )
                            continue;
                        const injury = entry.player.injury;
                        const training = extractTrainingReport(report);
                        putPlayer(tx, entry.id, entry.player.name.full, {
                            week: p.week,
                            date:
                                report.day?.date?.value ??
                                new Date().toISOString().slice(0, 10),
                            skills: report.skills,
                            value: entry.player.value.value,
                            source: 'training',
                            injured: (injury?.daysRemaining ?? 0) > 0,
                            ...(injury ? { injury } : {}),
                            ...(training ? { training } : {}),
                        });
                    }
                });
            case 'saveJuniorGraph':
                return write(['juniors'], (tx) => {
                    const s = tx.objectStore('juniors');
                    const r = s.get([p.ctx.teamId, p.id]);
                    r.onsuccess = () =>
                        s.put(
                            mergeJuniorGraphRecord(
                                r.result,
                                p.ctx.teamId,
                                p.id,
                                p.week,
                                p.points,
                            ),
                        );
                });
            case 'saveJuniorResolution':
                return write(['juniors'], (tx) => {
                    const s = tx.objectStore('juniors');
                    const r = s.get([p.ctx.teamId, p.id]);
                    r.onsuccess = () => {
                        const next = mergeJuniorResolutionRecord(
                            r.result,
                            p.ctx.teamId,
                            p.id,
                            p.week,
                            p.resolution,
                        );
                        if (next) s.put(next);
                    };
                });
            case 'saveJuniorRosterSnapshot':
                return write(['metadata', 'juniors'], (tx) => {
                    const meta = tx.objectStore('metadata');
                    const s = tx.objectStore('juniors');
                    const r = meta.get(`juniorRoster:${p.ctx.teamId}`);
                    r.onsuccess = () => {
                        if (r.result?.value.week > p.snapshot.week) return;
                        meta.put({
                            key: `juniorRoster:${p.ctx.teamId}`,
                            value: p.snapshot,
                        });
                        for (const entry of p.entries) {
                            const request = s.get([p.ctx.teamId, entry.id]);
                            request.onsuccess = () => {
                                if (
                                    request.result?.nativeTalentWeek >
                                    p.snapshot.week
                                )
                                    return;
                                s.put(
                                    mergeJuniorRosterRecord(
                                        request.result,
                                        p.ctx.teamId,
                                        entry,
                                        p.snapshot.week,
                                    ),
                                );
                            };
                        }
                    };
                });
            case 'backup.import.begin': {
                const attemptId = crypto.randomUUID();
                const epoch = (await this.state()).epoch;
                this.imports.set(attemptId, { owner, epoch });
                return { attemptId };
            }
            case 'backup.import.prepare': {
                const intent = this.imports.get(p.attemptId);
                if (!intent || intent.owner !== owner)
                    throw new StorageError(
                        'UNKNOWN_TRANSFER',
                        'Import intent was lost; restart import',
                    );
                this.imports.delete(p.attemptId);
                return publisher.prepareImport(owner, p.data, intent.epoch);
            }
            case 'migration.lookup':
                if (
                    p.origin !== origin ||
                    typeof p.sourceDigest !== 'string' ||
                    !/^[a-f0-9]{64}$/.test(p.sourceDigest)
                )
                    invalid('Invalid migration lookup origin/digest');
                return publisher.lookupLegacy(p.origin, p.sourceDigest);
            case 'migration.prepare':
                if (!object(p.snapshot) || p.snapshot.origin !== origin)
                    invalid('Migration origin differs from sender');
                return publisher.prepareLegacy(
                    owner,
                    p.snapshot as unknown as LegacySnapshot,
                );
            case 'migration.confirmSource':
                return publisher.confirmSource(
                    owner,
                    p.stageId,
                    p.sourceDigest,
                );
            case 'migration.publish':
            case 'backup.import.publish':
                return this.afterCommit(publisher.publish(owner, p.stageId));
            case 'migration.absent':
                if (p.origin !== origin) invalid('Origin differs from sender');
                return publisher.absent(p.origin);
            case 'getPublicationReceipt':
                return publisher.receipt(p.stageId);
            case 'clearSharedData':
                return this.afterCommit(publisher.clear(mutationIdentity));
            default:
                return invalid('Unknown storage operation');
        }
    }
    /** Repository promises resolve only after their IndexedDB transaction commits. */
    private async afterCommit<T>(mutation: Promise<T>): Promise<T> {
        const result = await mutation;
        await this.broadcast();
        return result;
    }
    private async broadcast(): Promise<void> {
        const message = { channel: STORAGE_CHANGED, state: await this.state() };
        try {
            await chrome.runtime.sendMessage(message);
        } catch {}
        try {
            for (const tab of await chrome.tabs.query({
                url: ['https://sokker.org/*', 'https://*.sokker.org/*'],
            }))
                if (tab.id !== undefined)
                    chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        } catch {}
    }
    async handle(
        owner: string,
        message: unknown,
        origin?: string,
    ): Promise<unknown> {
        assertMessageSize(message);
        if (!object(message)) invalid();
        if (message.channel === TRANSFER_CHANNEL)
            return this.transfers.handle(owner, message);
        if (message?.channel !== STORAGE_CHANNEL)
            invalid('Invalid storage channel');
        let request = message;
        if (message.operation === 'request.upload') {
            const uploaded = await this.transfers.consume(
                owner,
                message.transferId,
            );
            if (!object(uploaded) || uploaded.channel !== STORAGE_CHANNEL)
                invalid('Invalid uploaded request');
            request = uploaded;
        }
        if (typeof request.operation !== 'string') invalid();
        const value = await this.execute(
            owner,
            request.operation,
            request.input,
            origin,
            request.requestId,
        );
        const response = {
            ok: true,
            value: value === undefined ? null : value,
        };
        const unbounded = [
            'getAllData',
            'getAllPlayers',
            'getPlayerHistory',
            'getJuniorRecords',
            'getJuniorRecord',
            'getJuniorRosterSnapshot',
        ].includes(request.operation);
        return unbounded || serializedBytes(response) > MAX_MESSAGE_BYTES
            ? {
                  ok: true,
                  transfer: await this.transfers.createDownload(
                      owner,
                      response.value,
                  ),
              }
            : response;
    }
    disconnect(
        owner: string,
        transferIds: ReadonlySet<string>,
        importIds: ReadonlySet<string>,
    ): void {
        for (const id of transferIds)
            void this.transfers
                .handle(owner, {
                    channel: TRANSFER_CHANNEL,
                    operation: 'transfer.cancel',
                    transferId: id,
                })
                .catch(() => {});
        for (const id of importIds)
            if (this.imports.get(id)?.owner === owner) this.imports.delete(id);
    }
}
function errorResponse(error: unknown) {
    return {
        ok: false,
        code: error instanceof StorageError ? error.code : 'STORAGE_ERROR',
        message:
            error instanceof Error
                ? (
                      error.message ||
                      error.name ||
                      'Storage operation failed'
                  ).slice(0, 1000)
                : 'Storage operation failed',
    };
}
export function registerStorageService(service: StorageService): () => void {
    const onMessage = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: unknown) => void,
    ) => {
        if (
            !object(message) ||
            ![STORAGE_CHANNEL, TRANSFER_CHANNEL].includes(message.channel)
        )
            return;
        const owner = getMessageOwner(sender);
        if (!owner) {
            sendResponse(
                errorResponse(
                    new StorageError(
                        'INVALID_REQUEST',
                        'A dedicated document port is required',
                    ),
                ),
            );
            return false;
        }
        const origin = sender.url ? new URL(sender.url).origin : undefined;
        service
            .handle(owner, message, origin)
            .then(sendResponse, (e) => sendResponse(errorResponse(e)));
        return true;
    };
    const onConnect = (port: chrome.runtime.Port) => {
        if (port.name !== STORAGE_CHANNEL) return;
        const owner = port.sender
            ? getMessageOwner(port.sender, crypto.randomUUID())
            : null;
        if (!owner) {
            port.disconnect();
            return;
        }
        let disconnected = false;
        const transferIds = new Set<string>();
        const importIds = new Set<string>();
        const origin = port.sender?.url
            ? new URL(port.sender.url).origin
            : undefined;
        port.onDisconnect.addListener(() => {
            disconnected = true;
            service.disconnect(owner, transferIds, importIds);
        });
        port.onMessage.addListener((message) => {
            service.handle(owner, message, origin).then(
                (value) => {
                    if (object(value) && value.ok === true) {
                        if (
                            object(value.transfer) &&
                            typeof value.transfer.transferId === 'string'
                        )
                            transferIds.add(value.transfer.transferId);
                        if (
                            object(value.value) &&
                            typeof value.value.transferId === 'string'
                        )
                            transferIds.add(value.value.transferId);
                        if (
                            object(value.value) &&
                            typeof value.value.attemptId === 'string'
                        )
                            importIds.add(value.value.attemptId);
                    }
                    if (disconnected)
                        service.disconnect(owner, transferIds, importIds);
                    else port.postMessage(value);
                },
                (error) => {
                    if (!disconnected) port.postMessage(errorResponse(error));
                },
            );
        });
    };
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.runtime.onConnect.addListener(onConnect);
    return () => {
        chrome.runtime.onMessage.removeListener(onMessage);
        chrome.runtime.onConnect.removeListener(onConnect);
    };
}
