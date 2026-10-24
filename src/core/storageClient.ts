import type { PlayerData, PlayerHistoryEntry, SokkerResponse } from '../types';
import type {
    JuniorPoint,
    JuniorRecord,
    JuniorRosterEntry,
    JuniorRosterSnapshot,
} from './juniorTypes';
import type { BackupData } from './repository';
import { readLegacySnapshot } from './legacyStorage';
import {
    assertMessageSize,
    downloadTransfer,
    fragmentText,
    MAX_MESSAGE_BYTES,
    serializedBytes,
    sha256,
    TRANSFER_CHANNEL,
    type TransferManifest,
} from './transferProtocol';
import {
    STORAGE_CHANNEL,
    STORAGE_CHANGED,
    StorageError,
    type LegacySnapshot,
    type MigrationReceipt,
    type PreparedMigration,
    type StorageOperations,
    type StorageState,
    type WriteContext,
} from './storageTypes';
export class UncertainStorageMutation extends Error {
    constructor(
        public requestId: string,
        public digest: string,
    ) {
        super(
            'The worker disconnected; query the persisted mutation receipt before retrying',
        );
        this.name = 'UncertainStorageMutation';
    }
}
interface TransportResponse {
    ok: boolean;
    value?: unknown;
    transfer?: TransferManifest;
    code?: ConstructorParameters<typeof StorageError>[0];
    message?: string;
}
let port: chrome.runtime.Port | null = null;
let serial: Promise<unknown> = Promise.resolve();
let pending: {
    resolve: (value: TransportResponse) => void;
    reject: (e: Error) => void;
} | null = null;
function connection(): chrome.runtime.Port {
    if (port) return port;
    const opened = chrome.runtime.connect({ name: STORAGE_CHANNEL });
    port = opened;
    opened.onMessage.addListener((message: TransportResponse) => {
        const request = pending;
        pending = null;
        request?.resolve(message);
    });
    opened.onDisconnect.addListener(() => {
        if (port === opened) port = null;
        const request = pending;
        pending = null;
        request?.reject(
            new Error(
                'Storage worker disconnected; the result may be uncertain',
            ),
        );
    });
    return opened;
}
async function send(message: unknown): Promise<TransportResponse> {
    assertMessageSize(message);
    return new Promise((resolve, reject) => {
        const current = connection();
        pending = { resolve, reject };
        try {
            current.postMessage(message);
        } catch (e) {
            pending = null;
            reject(e);
        }
    });
}
function unwrap(response: TransportResponse): unknown {
    assertMessageSize(response);
    if (!response.ok)
        throw new StorageError(
            response.code ?? 'STORAGE_ERROR',
            response.message ?? 'Storage request failed',
        );
    return response.value;
}
async function invoke(operation: string, input: unknown): Promise<unknown> {
    const requestId = crypto.randomUUID();
    const requestDigest = await sha256(JSON.stringify({ operation, input }));
    let message: unknown = {
        channel: STORAGE_CHANNEL,
        operation,
        input,
        requestId,
    };
    if (
        operation === 'backup.import.prepare' ||
        operation === 'migration.prepare' ||
        serializedBytes(message) > MAX_MESSAGE_BYTES
    ) {
        const text = JSON.stringify(message);
        const frames = fragmentText(text, (f) => ({
            channel: TRANSFER_CHANNEL,
            operation: 'transfer.write',
            transferId: '00000000-0000-0000-0000-000000000000',
            ...f,
        }));
        const manifest = unwrap(
            await send({
                channel: TRANSFER_CHANNEL,
                operation: 'transfer.begin',
                totalFrames: frames.length,
                totalBytes: new TextEncoder().encode(text).byteLength,
                digest: await sha256(text),
            }),
        ) as TransferManifest;
        for (let index = 0; index < frames.length; index++)
            unwrap(
                await send({
                    channel: TRANSFER_CHANNEL,
                    operation: 'transfer.write',
                    transferId: manifest.transferId,
                    index,
                    text: frames[index],
                }),
            );
        message = {
            channel: STORAGE_CHANNEL,
            operation: 'request.upload',
            transferId: manifest.transferId,
        };
    }
    let reply: TransportResponse;
    try {
        reply = await send(message);
    } catch (error) {
        const mutation =
            operation.startsWith('save') ||
            operation === 'markWeekEmpty' ||
            operation === 'clearSharedData';
        if (!mutation) throw error;
        try {
            const receipt = await invoke('getMutationReceipt', {
                requestId,
                digest: requestDigest,
            });
            if (receipt) return undefined;
        } catch {}
        throw new UncertainStorageMutation(requestId, requestDigest);
    }
    if (!reply.ok) return unwrap(reply);
    if (reply.transfer) return downloadTransfer(reply.transfer, send);
    return unwrap(reply);
}
export function requestStorage<K extends keyof StorageOperations>(
    operation: K,
    input: StorageOperations[K]['input'],
): Promise<StorageOperations[K]['output']> {
    const result = serial.then(() => invoke(operation, input));
    serial = result.catch(() => {});
    return result as Promise<StorageOperations[K]['output']>;
}
export const ensureStorageReady = () =>
    requestStorage('ensureStorageReady', {});
export const getWriteContext = (teamId: number) =>
    requestStorage('getWriteContext', { teamId });
export const getPlayerHistory = (id: number) =>
    requestStorage('getPlayerHistory', { id });
export const getAllPlayers = () => requestStorage('getAllPlayers', {});
export const getAllData = () => requestStorage('getAllData', {});
export const getJuniorRecord = (teamId: number, id: number) =>
    requestStorage('getJuniorRecord', { teamId, id });
export const getJuniorRecords = async (
    teamId: number,
    ids: readonly number[],
): Promise<Map<number, JuniorRecord>> =>
    new Map(await requestStorage('getJuniorRecords', { teamId, ids }));
export const getJuniorRosterSnapshot = (teamId: number) =>
    requestStorage('getJuniorRosterSnapshot', { teamId });
export const getLastSyncWeek = (teamId: number) =>
    requestStorage('getLastSyncWeek', { teamId });
export const isWeekSynced = (teamId: number, week: number) =>
    requestStorage('isWeekSynced', { teamId, week });
export const saveWeekData = (
    ctx: WriteContext,
    week: number,
    players: SokkerResponse['players'],
) => requestStorage('saveWeekData', { ctx, week, players });
export const markWeekEmpty = (ctx: WriteContext, week: number) =>
    requestStorage('markWeekEmpty', { ctx, week });
export const savePlayerCarryOverEntry = (
    ctx: WriteContext,
    id: number,
    name: string,
    entry: PlayerHistoryEntry,
) => requestStorage('savePlayerCarryOverEntry', { ctx, id, name, entry });
export const saveJuniorRosterSnapshot = (
    ctx: WriteContext,
    snapshot: JuniorRosterSnapshot,
    entries: readonly JuniorRosterEntry[],
) => requestStorage('saveJuniorRosterSnapshot', { ctx, snapshot, entries });
export const saveJuniorGraph = (
    ctx: WriteContext,
    id: number,
    week: number,
    points: readonly JuniorPoint[],
) => requestStorage('saveJuniorGraph', { ctx, id, week, points });
export const saveJuniorResolution = (
    ctx: WriteContext,
    id: number,
    week: number,
    resolution: 'absent' | 'unknown',
) => requestStorage('saveJuniorResolution', { ctx, id, week, resolution });
export const clearSharedData = () => requestStorage('clearSharedData', {});
export const clearDatabase = clearSharedData;
export const exportBackup = getAllData;
export const getPublicationReceipt = (stageId: string) =>
    requestStorage('getPublicationReceipt', { stageId });
const PENDING_PUBLICATION = 'sokker++:pending-publication';
function rememberPublication(stageId: string): void {
    try {
        localStorage.setItem(PENDING_PUBLICATION, stageId);
    } catch {}
}
function forgetPublication(): void {
    try {
        localStorage.removeItem(PENDING_PUBLICATION);
    } catch {}
}
export async function recoverPendingPublication(): Promise<MigrationReceipt | null> {
    let stageId: string | null = null;
    try {
        stageId = localStorage.getItem(PENDING_PUBLICATION);
    } catch {}
    if (!stageId) return null;
    const receipt = await getPublicationReceipt(stageId);
    if (receipt) forgetPublication();
    return receipt;
}
export async function importBackup(data: unknown): Promise<void> {
    const { attemptId } = await requestStorage('backup.import.begin', {});
    const stage = await requestStorage('backup.import.prepare', {
        data,
        attemptId,
    });
    rememberPublication(stage.stageId);
    await requestStorage('backup.import.publish', { stageId: stage.stageId });
    forgetPublication();
}
export const restoreData = importBackup;
export async function migrateCurrentOrigin(): Promise<MigrationReceipt> {
    const state = await ensureStorageReady();
    if (state.automaticMigrationBlocked)
        return {
            origin: location.origin,
            state: 'blocked',
            sourceDigest: null,
            archiveDigest: null,
            players: 0,
            juniors: 0,
            conflicts: 0,
        };
    for (let retry = 0; retry < 3; retry++) {
        const snapshot = await readLegacySnapshot();
        if (!snapshot)
            return requestStorage('migration.absent', {
                origin: location.origin,
            });
        const migrated = await requestStorage('migration.lookup', {
            origin: snapshot.origin,
            sourceDigest: snapshot.digest,
        });
        if (migrated) return migrated;
        const prepared = await requestStorage('migration.prepare', {
            snapshot,
        });
        const confirmed = await readLegacySnapshot();
        if (!confirmed || confirmed.digest !== snapshot.digest) continue;
        await requestStorage('migration.confirmSource', {
            stageId: prepared.stageId,
            sourceDigest: confirmed.digest,
        });
        rememberPublication(prepared.stageId);
        const receipt = await requestStorage('migration.publish', {
            stageId: prepared.stageId,
        });
        forgetPublication();
        return receipt;
    }
    throw new Error('Legacy source kept changing; migration was not activated');
}
export function subscribeStorageChanges(
    listener: (state: StorageState) => void,
): () => void {
    const handler = (message: unknown) => {
        if (
            message &&
            typeof message === 'object' &&
            'channel' in message &&
            message.channel === STORAGE_CHANGED &&
            'state' in message
        )
            listener(message.state as StorageState);
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
}

export const getMutationReceipt = (requestId: string, digest: string) =>
    requestStorage('getMutationReceipt', { requestId, digest });
