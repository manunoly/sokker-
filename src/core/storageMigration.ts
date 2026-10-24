import {
    createRecoveryArchive,
    verifyRecoveryArchives,
} from './storageRecovery';
import { isValidBackupData, type BackupData } from './repository';
import {
    ALL_STORES,
    captureSharedData,
    DATA_STORES,
    putState,
    readState,
    transaction,
    writeDataInTransaction,
} from './storageDatabase';
import { verifyLegacySnapshot } from './legacyStorage';
import { mergeBackupData } from './storageMerge';
import { sha256 } from './transferProtocol';
import {
    StorageError,
    type LegacySnapshot,
    type MigrationBase,
    type MigrationReceipt,
    type PreparedMigration,
} from './storageTypes';
interface Stage {
    stageId: string;
    owner: string;
    kind: 'legacy' | 'import';
    origin: string;
    intentEpoch: string;
    base: MigrationBase;
    input: BackupData;
    inputDigest: string;
    sourceDigest: string;
    candidate: BackupData;
    candidateDigest: string;
    verified: boolean;
    sourceConfirmed: boolean;
}
const digest = (value: unknown) => sha256(JSON.stringify(value));
export function validateBackup(data: unknown): asserts data is BackupData {
    if (!isValidBackupData(data))
        throw new StorageError('INVALID_REQUEST', 'Invalid backup format');
    const value = data as BackupData;
    if (value.formatVersion !== undefined && value.formatVersion !== 2)
        throw new StorageError('INVALID_REQUEST', 'Unsupported backup version');
    const ids = new Set<number>();
    for (const p of value.players ?? []) {
        if (
            !Number.isSafeInteger(p.id) ||
            p.id <= 0 ||
            ids.has(p.id) ||
            p.history.some((h) => !Number.isSafeInteger(h.week) || h.week <= 0)
        )
            throw new StorageError(
                'INVALID_REQUEST',
                'Invalid player identity/history',
            );
        ids.add(p.id);
    }
    for (const key of [
        'migrationConflicts',
        'legacyArchives',
        'legacyMetadata',
    ] as const)
        if (value[key] !== undefined && !Array.isArray(value[key]))
            throw new StorageError('INVALID_REQUEST', `Invalid ${key}`);
    for (const c of value.migrationConflicts ?? [])
        if (
            !c ||
            typeof c.id !== 'string' ||
            typeof c.origin !== 'string' ||
            typeof c.entity !== 'string' ||
            typeof c.reason !== 'string' ||
            !('discarded' in c)
        )
            throw new StorageError('INVALID_REQUEST', 'Invalid conflict');
    for (const a of value.legacyArchives ?? [])
        if (
            !a ||
            typeof a.id !== 'string' ||
            typeof a.digest !== 'string' ||
            !['legacy', 'previous-destination'].includes(a.kind) ||
            (a.kind === 'legacy' ? !a.snapshot : !a.backup && !a.backupRef)
        )
            throw new StorageError(
                'INVALID_REQUEST',
                'Invalid recovery archive',
            );
    for (const archive of value.legacyArchives ?? []) {
        if (archive.kind !== 'previous-destination') continue;
        if (archive.backup) validateBackup(archive.backup);
        if (
            archive.archiveRefs !== undefined &&
            (!Array.isArray(archive.archiveRefs) ||
                archive.archiveRefs.some(
                    (ref) =>
                        !ref ||
                        typeof ref.id !== 'string' ||
                        typeof ref.digest !== 'string',
                ))
        )
            throw new StorageError(
                'INVALID_REQUEST',
                'Invalid recovery references',
            );
        if (
            archive.archiveAliases !== undefined &&
            (!Array.isArray(archive.archiveAliases) ||
                archive.archiveAliases.some(
                    (alias) =>
                        !alias ||
                        typeof alias.storedId !== 'string' ||
                        !alias.reference ||
                        typeof alias.reference.id !== 'string' ||
                        typeof alias.reference.digest !== 'string',
                ))
        )
            throw new StorageError(
                'INVALID_REQUEST',
                'Invalid recovery aliases',
            );
        if (
            archive.backupRef &&
            (!archive.backupRef.id ||
                typeof archive.backupRef.digest !== 'string')
        )
            throw new StorageError(
                'INVALID_REQUEST',
                'Invalid recovery body reference',
            );
    }
}
function legacyInput(
    snapshot: LegacySnapshot,
    stores: Awaited<ReturnType<typeof verifyLegacySnapshot>>,
): BackupData {
    const result: BackupData = {
        formatVersion: 2,
        players: [],
        juniors: [],
        legacyMetadata: [],
        legacyArchives: [
            {
                id: `legacy:${snapshot.origin}:${snapshot.digest}`,
                kind: 'legacy',
                snapshot,
                digest: snapshot.digest,
            },
        ],
    };
    for (const store of stores) {
        if (store.name === 'players') {
            for (const r of store.records) {
                const one = { players: [r.value] };
                validateBackup(one);
                const p = r.value as NonNullable<BackupData['players']>[number];
                if (r.key !== p.id)
                    throw new Error('Legacy player key differs from value');
                result.players!.push(p);
            }
        } else if (store.name === 'juniors') {
            for (const r of store.records) {
                validateBackup({ juniors: [r.value] });
                const j = r.value as NonNullable<BackupData['juniors']>[number];
                if (
                    JSON.stringify(r.key) !==
                    JSON.stringify([j.teamId, j.juniorId])
                )
                    throw new Error('Legacy junior key differs from value');
                result.juniors!.push(j);
            }
        } else if (store.name === 'metadata' || store.name === 'weeks')
            result.legacyMetadata!.push({
                origin: snapshot.origin,
                store: store.name,
                records: store.records,
            });
    }
    validateBackup(result);
    return result;
}
export class PublicationService {
    constructor(private db: IDBDatabase) {}
    async receipt(
        stageId: string,
        owner?: string,
    ): Promise<MigrationReceipt | null> {
        return transaction(
            this.db,
            ['control'],
            'readonly',
            (tx, set, fail) => {
                const r = tx.objectStore('control').get(`receipt:${stageId}`);
                r.onsuccess = () => {
                    if (r.result && owner && r.result.owner !== owner) {
                        fail(
                            new StorageError(
                                'INVALID_REQUEST',
                                'Publication belongs to another document',
                            ),
                        );
                        return;
                    }
                    set(r.result?.receipt ?? null);
                };
            },
        );
    }
    /** Read-only idempotency check. Never infer completion from the UI status alone. */
    async lookupLegacy(
        origin: string,
        sourceDigest: string,
    ): Promise<MigrationReceipt | null> {
        const captured = await transaction<{
            epoch: string;
            archive: NonNullable<BackupData['legacyArchives']>[number];
            receipt: MigrationReceipt;
        } | null>(
            this.db,
            ['control', 'legacyArchives'],
            'readonly',
            (tx, set, fail) =>
                readState(tx, (state) => {
                    if (state.automaticMigrationBlocked)
                        return fail(
                            new StorageError(
                                'MIGRATION_BLOCKED',
                                'Automatic migration disabled',
                            ),
                        );
                    const marker = tx
                        .objectStore('control')
                        .get(`origin:${origin}`);
                    marker.onsuccess = () => {
                        if (marker.result?.digest !== sourceDigest) {
                            set(null);
                            return;
                        }
                        const archived = tx
                            .objectStore('legacyArchives')
                            .get(
                                marker.result.archiveId ??
                                    `legacy:${origin}:${sourceDigest}`,
                            );
                        archived.onsuccess = () => {
                            if (!archived.result)
                                return fail(
                                    new Error(
                                        'Confirmed legacy archive is missing',
                                    ),
                                );
                            if (marker.result.receipt) {
                                set({
                                    epoch: state.epoch,
                                    archive: archived.result,
                                    receipt: marker.result.receipt,
                                });
                                return;
                            }
                            const oldReceipts = tx
                                .objectStore('control')
                                .getAll();
                            oldReceipts.onsuccess = () => {
                                const original = oldReceipts.result.find(
                                    (entry) =>
                                        entry.receipt?.origin === origin &&
                                        entry.receipt?.sourceDigest ===
                                            sourceDigest &&
                                        entry.receipt?.state === 'migrated',
                                );
                                if (!original)
                                    return fail(
                                        new Error(
                                            'Confirmed legacy receipt is missing',
                                        ),
                                    );
                                set({
                                    epoch: state.epoch,
                                    archive: archived.result,
                                    receipt: original.receipt,
                                });
                            };
                        };
                    };
                }),
        );
        if (!captured) return null;
        if (
            captured.archive.kind !== 'legacy' ||
            captured.archive.digest !== sourceDigest ||
            captured.archive.snapshot?.origin !== origin
        )
            throw new Error(
                'Confirmed legacy archive does not match the source',
            );
        await verifyLegacySnapshot(captured.archive.snapshot);
        return transaction(this.db, ['control'], 'readonly', (tx, set, fail) =>
            readState(tx, (state) => {
                if (state.automaticMigrationBlocked)
                    return fail(
                        new StorageError(
                            'MIGRATION_BLOCKED',
                            'Automatic migration disabled',
                        ),
                    );
                if (state.epoch !== captured.epoch)
                    return fail(
                        new StorageError(
                            'STALE_EPOCH',
                            'Storage changed during migration lookup',
                        ),
                    );
                const marker = tx
                    .objectStore('control')
                    .get(`origin:${origin}`);
                marker.onsuccess = () => {
                    if (marker.result?.digest !== sourceDigest) {
                        set(null);
                        return;
                    }
                    set({ ...captured.receipt, state: 'already-migrated' });
                };
            }),
        );
    }
    private async stage(owner: string, id: string): Promise<Stage> {
        return transaction(
            this.db,
            ['migrationStaging'],
            'readonly',
            (tx, set, fail) => {
                const r = tx.objectStore('migrationStaging').get(id);
                r.onsuccess = () => {
                    if (!r.result || r.result.owner !== owner)
                        return fail(
                            new StorageError(
                                'INVALID_REQUEST',
                                'Unknown staging attempt',
                            ),
                        );
                    set(r.result);
                };
            },
        );
    }
    private async saveVerified(stage: Stage): Promise<void> {
        await transaction(
            this.db,
            ['migrationStaging', 'control'],
            'readwrite',
            (tx, set, fail) => {
                readState(tx, (state) => {
                    if (state.epoch !== stage.intentEpoch)
                        return fail(
                            new StorageError(
                                'STALE_EPOCH',
                                'Staging intent is stale',
                            ),
                        );
                    if (
                        stage.kind === 'legacy' &&
                        state.automaticMigrationBlocked
                    )
                        return fail(
                            new StorageError(
                                'MIGRATION_BLOCKED',
                                'Automatic migration disabled',
                            ),
                        );
                    tx.objectStore('migrationStaging').put({
                        ...stage,
                        verified: false,
                    });
                    set(undefined);
                });
            },
        );
        const saved = await this.stage(stage.owner, stage.stageId);
        if (
            (await digest(saved.input)) !== saved.inputDigest ||
            (await digest(saved.candidate)) !== saved.candidateDigest
        )
            throw new Error('Staging readback mismatch');
        validateBackup(saved.candidate);
        await verifyRecoveryArchives(saved.candidate);
        await transaction(
            this.db,
            ['migrationStaging', 'control'],
            'readwrite',
            (tx, set, fail) =>
                readState(tx, (state) => {
                    if (state.epoch !== stage.intentEpoch)
                        return fail(
                            new StorageError(
                                'STALE_EPOCH',
                                'Staging epoch changed during verification',
                            ),
                        );
                    if (
                        stage.kind === 'legacy' &&
                        state.automaticMigrationBlocked
                    )
                        return fail(
                            new StorageError(
                                'MIGRATION_BLOCKED',
                                'Automatic migration disabled',
                            ),
                        );
                    const request = tx
                        .objectStore('migrationStaging')
                        .get(stage.stageId);
                    request.onsuccess = () => {
                        const authoritative = request.result as
                            | Stage
                            | undefined;
                        if (
                            !authoritative ||
                            authoritative.owner !== stage.owner ||
                            authoritative.inputDigest !== saved.inputDigest ||
                            authoritative.candidateDigest !==
                                saved.candidateDigest
                        )
                            return fail(
                                new Error(
                                    'Staging changed during verification',
                                ),
                            );
                        tx.objectStore('migrationStaging').put({
                            ...authoritative,
                            verified: true,
                        });
                        set(undefined);
                    };
                }),
        );
    }
    private async candidate(
        local: BackupData,
        input: BackupData,
        origin: string,
        stageId: string,
    ): Promise<BackupData> {
        const candidate = mergeBackupData(local, input, origin);
        if (
            (local.players?.length ?? 0) +
                (local.juniors?.length ?? 0) +
                (local.legacyArchives?.length ?? 0) +
                (local.migrationConflicts?.length ?? 0) >
            0
        ) {
            candidate.legacyArchives!.push(
                await createRecoveryArchive(local, stageId),
            );
        }
        validateBackup(candidate);
        await verifyRecoveryArchives(candidate);
        return candidate;
    }
    async prepareImport(
        owner: string,
        data: unknown,
        intentEpoch: string,
    ): Promise<PreparedMigration> {
        validateBackup(data);
        await verifyRecoveryArchives(data);
        return this.prepare(
            owner,
            'import',
            'backup',
            structuredClone(data),
            intentEpoch,
            '',
        );
    }
    async prepareLegacy(
        owner: string,
        snapshot: LegacySnapshot,
    ): Promise<PreparedMigration> {
        const stores = await verifyLegacySnapshot(snapshot);
        const current = await captureSharedData(this.db);
        if (current.state.automaticMigrationBlocked)
            throw new StorageError(
                'MIGRATION_BLOCKED',
                'Automatic migration was disabled by clearing data',
            );
        const archive = {
            id: `legacy:${snapshot.origin}:${snapshot.digest}`,
            kind: 'legacy' as const,
            snapshot,
            digest: snapshot.digest,
        };
        await transaction(
            this.db,
            ['legacyArchives', 'control'],
            'readwrite',
            (tx, set, fail) => {
                readState(tx, (state) => {
                    if (state.epoch !== current.state.epoch)
                        return fail(
                            new StorageError(
                                'STALE_EPOCH',
                                'Legacy archive intent is stale',
                            ),
                        );
                    if (state.automaticMigrationBlocked)
                        return fail(
                            new StorageError(
                                'MIGRATION_BLOCKED',
                                'Automatic migration disabled',
                            ),
                        );
                    const store = tx.objectStore('legacyArchives');
                    const existing = store.get(archive.id);
                    existing.onsuccess = () => {
                        if (!existing.result) {
                            store.put(archive);
                            putState(tx, {
                                ...state,
                                revision: state.revision + 1,
                            });
                        } else if (
                            JSON.stringify(existing.result) !==
                            JSON.stringify(archive)
                        )
                            return fail(
                                new Error('Contradictory archived source'),
                            );
                        set(undefined);
                    };
                });
            },
        );
        const readback = await transaction<typeof archive>(
            this.db,
            ['legacyArchives'],
            'readonly',
            (tx, set) => {
                const r = tx.objectStore('legacyArchives').get(archive.id);
                r.onsuccess = () => set(r.result);
            },
        );
        await verifyLegacySnapshot(readback.snapshot);
        return this.prepare(
            owner,
            'legacy',
            snapshot.origin,
            legacyInput(snapshot, stores),
            current.state.epoch,
            snapshot.digest,
        );
    }
    private async prepare(
        owner: string,
        kind: 'legacy' | 'import',
        origin: string,
        input: BackupData,
        intentEpoch: string,
        sourceDigest: string,
    ): Promise<PreparedMigration> {
        const capture = await captureSharedData(this.db);
        if (capture.state.epoch !== intentEpoch)
            throw new StorageError(
                'STALE_EPOCH',
                'Storage changed during preparation',
            );
        if (kind === 'legacy' && capture.state.automaticMigrationBlocked)
            throw new StorageError(
                'MIGRATION_BLOCKED',
                'Automatic migration disabled',
            );
        const stageId = crypto.randomUUID();
        const stage: Stage = {
            stageId,
            owner,
            kind,
            origin,
            intentEpoch,
            base: {
                epoch: capture.state.epoch,
                revision: capture.state.revision,
            },
            input,
            inputDigest: await digest(input),
            sourceDigest,
            candidate: await this.candidate(
                capture.data,
                input,
                origin,
                stageId,
            ),
            candidateDigest: '',
            verified: true,
            sourceConfirmed: kind === 'import',
        };
        stage.candidateDigest = await digest(stage.candidate);
        await this.saveVerified(stage);
        return {
            stageId,
            origin,
            sourceDigest,
            candidateDigest: stage.candidateDigest,
            base: stage.base,
        };
    }
    async confirmSource(
        owner: string,
        stageId: string,
        sourceDigest: string,
    ): Promise<void> {
        const stage = await this.stage(owner, stageId);
        if (stage.kind !== 'legacy' || stage.sourceDigest !== sourceDigest)
            throw new StorageError(
                'INVALID_REQUEST',
                'Source changed after capture',
            );
        stage.sourceConfirmed = true;
        await this.saveVerified(stage);
    }
    async publish(owner: string, stageId: string): Promise<MigrationReceipt> {
        const existing = await this.receipt(stageId, owner);
        if (existing) return existing;
        for (let retries = 0; retries < 32; retries++) {
            let stage = await this.stage(owner, stageId);
            if (
                !stage.verified ||
                !stage.sourceConfirmed ||
                (await digest(stage.input)) !== stage.inputDigest ||
                (await digest(stage.candidate)) !== stage.candidateDigest
            )
                throw new Error('Unverified staging');
            const capture = await captureSharedData(this.db);
            if (capture.state.epoch !== stage.intentEpoch)
                throw new StorageError(
                    'STALE_EPOCH',
                    'Publication intent belongs to an older epoch',
                );
            if (
                stage.kind === 'legacy' &&
                capture.state.automaticMigrationBlocked
            )
                throw new StorageError(
                    'MIGRATION_BLOCKED',
                    'Automatic migration disabled',
                );
            if (capture.state.revision !== stage.base.revision) {
                stage = {
                    ...stage,
                    base: {
                        epoch: capture.state.epoch,
                        revision: capture.state.revision,
                    },
                    candidate: await this.candidate(
                        capture.data,
                        stage.input,
                        stage.origin,
                        stage.stageId,
                    ),
                };
                stage.candidateDigest = await digest(stage.candidate);
                await this.saveVerified(stage);
            }
            try {
                return await transaction(
                    this.db,
                    ALL_STORES,
                    'readwrite',
                    (tx, set, fail) => {
                        readState(tx, (state) => {
                            if (state.epoch !== stage.intentEpoch)
                                return fail(
                                    new StorageError(
                                        'STALE_EPOCH',
                                        'Storage epoch changed before commit',
                                    ),
                                );
                            if (state.revision !== stage.base.revision)
                                return fail(
                                    new StorageError(
                                        'STALE_REVISION',
                                        'Storage revision changed before commit',
                                    ),
                                );
                            if (
                                stage.kind === 'legacy' &&
                                state.automaticMigrationBlocked
                            )
                                return fail(
                                    new StorageError(
                                        'MIGRATION_BLOCKED',
                                        'Automatic migration disabled',
                                    ),
                                );
                            const marker = tx
                                .objectStore('control')
                                .get(`origin:${stage.origin}`);
                            marker.onsuccess = () => {
                                const already =
                                    stage.kind === 'legacy' &&
                                    marker.result?.digest ===
                                        stage.sourceDigest;
                                const receipt: MigrationReceipt = {
                                    origin: stage.origin,
                                    state: already
                                        ? 'already-migrated'
                                        : 'migrated',
                                    sourceDigest: stage.sourceDigest || null,
                                    archiveDigest: stage.sourceDigest || null,
                                    players:
                                        stage.candidate.players?.length ?? 0,
                                    juniors:
                                        stage.candidate.juniors?.length ?? 0,
                                    conflicts:
                                        stage.candidate.migrationConflicts
                                            ?.length ?? 0,
                                };
                                if (!already) {
                                    writeDataInTransaction(tx, stage.candidate);
                                    putState(tx, {
                                        ...state,
                                        epoch:
                                            stage.kind === 'import'
                                                ? crypto.randomUUID()
                                                : state.epoch,
                                        revision: state.revision + 1,
                                        migration:
                                            stage.kind === 'legacy'
                                                ? {
                                                      ...state.migration,
                                                      [stage.origin]: {
                                                          state: 'migrated',
                                                      },
                                                  }
                                                : state.migration,
                                    });
                                    if (stage.kind === 'legacy')
                                        tx.objectStore('control').put({
                                            key: `origin:${stage.origin}`,
                                            digest: stage.sourceDigest,
                                            archiveId: `legacy:${stage.origin}:${stage.sourceDigest}`,
                                            receipt,
                                        });
                                }
                                tx.objectStore('control').put({
                                    key: `receipt:${stageId}`,
                                    owner,
                                    receipt,
                                });
                                tx.objectStore('migrationStaging').delete(
                                    stageId,
                                );
                                set(receipt);
                            };
                        });
                    },
                );
            } catch (e) {
                if (e instanceof StorageError && e.code === 'STALE_REVISION')
                    continue;
                throw e;
            }
        }
        throw new StorageError(
            'STALE_REVISION',
            'Storage remained busy; publication was not committed',
        );
    }
    async absent(origin: string): Promise<MigrationReceipt> {
        return transaction(this.db, ['control'], 'readwrite', (tx, set, fail) =>
            readState(tx, (state) => {
                if (state.automaticMigrationBlocked)
                    return fail(
                        new StorageError(
                            'MIGRATION_BLOCKED',
                            'Automatic migration disabled',
                        ),
                    );
                putState(tx, {
                    ...state,
                    revision: state.revision + 1,
                    migration: {
                        ...state.migration,
                        [origin]: { state: 'absent' },
                    },
                });
                set({
                    origin,
                    state: 'absent',
                    sourceDigest: null,
                    archiveDigest: null,
                    players: 0,
                    juniors: 0,
                    conflicts: 0,
                });
            }),
        );
    }
    async clear(
        identity?: import('./storageDatabase').MutationIdentity,
    ): Promise<void> {
        await transaction(this.db, ALL_STORES, 'readwrite', (tx, set, fail) => {
            const commit = () =>
                readState(tx, (state) => {
                    for (const name of ALL_STORES) tx.objectStore(name).clear();
                    const next = {
                        epoch: crypto.randomUUID(),
                        revision: state.revision + 1,
                        migration: {},
                        automaticMigrationBlocked: true,
                    };
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
                    set(undefined);
                });
            if (!identity) {
                commit();
                return;
            }
            const prior = tx
                .objectStore('control')
                .get(`mutation:${identity.id}`);
            prior.onsuccess = () => {
                if (!prior.result) {
                    commit();
                    return;
                }
                if (
                    prior.result.owner !== identity.owner ||
                    prior.result.digest !== identity.digest
                )
                    return fail(
                        new StorageError(
                            'INVALID_REQUEST',
                            'Clear ID belongs to another request',
                        ),
                    );
                set(undefined);
            };
        });
    }
}
