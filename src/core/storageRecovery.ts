import type { BackupData, LegacyArchive, ArchiveReference } from './repository';
import { verifyLegacySnapshot } from './legacyStorage';
import { sha256 } from './transferProtocol';

const digest = (value: unknown) => sha256(JSON.stringify(value));
const archiveKey = (reference: ArchiveReference) =>
    JSON.stringify([reference.id, reference.digest]);
const reference = (archive: LegacyArchive): ArchiveReference => ({
    id: archive.id,
    digest: archive.digest,
});
export function canonicalRecoveryBackup(data: BackupData): BackupData {
    const result = {
        ...data,
        legacyArchives: [...(data.legacyArchives ?? [])].sort((a, b) =>
            archiveKey(a).localeCompare(archiveKey(b)),
        ),
    };
    return Object.fromEntries(
        Object.keys(result)
            .sort()
            .map((key) => [key, result[key as keyof BackupData]]),
    );
}
function dependencies(archive: LegacyArchive): ArchiveReference[] {
    if (archive.kind === 'legacy') return [];
    return [
        ...(archive.archiveRefs ?? []),
        ...(archive.backupRef ? [archive.backupRef] : []),
    ];
}
function resolveStored(
    reference: ArchiveReference,
    registry: readonly LegacyArchive[],
): LegacyArchive {
    const exact = registry.find(
        (archive) =>
            archive.id === reference.id && archive.digest === reference.digest,
    );
    // Imports may rename an ID collision while retaining the content-addressed record.
    const match =
        exact ??
        registry.find((archive) => archive.digest === reference.digest);
    if (!match) throw new Error('Missing recovery archive reference');
    return match;
}
function resolve(
    reference: ArchiveReference,
    registry: readonly LegacyArchive[],
): LegacyArchive {
    const match = resolveStored(reference, registry);
    return match.id === reference.id ? match : { ...match, id: reference.id };
}
function bodyOf(
    archive: LegacyArchive,
    registry: readonly LegacyArchive[],
    visiting = new Set<string>(),
): BackupData {
    const key = archiveKey(archive);
    if (visiting.has(key)) throw new Error('Cyclic recovery body reference');
    if (archive.backup) return archive.backup;
    if (!archive.backupRef) throw new Error('Missing recovery backup body');
    visiting.add(key);
    const body = bodyOf(
        resolve(archive.backupRef, registry),
        registry,
        visiting,
    );
    visiting.delete(key);
    return body;
}
async function verifyRecord(
    archive: LegacyArchive,
    registry: readonly LegacyArchive[],
    visiting: Set<string>,
    verified: Set<string>,
): Promise<void> {
    const key = archiveKey(archive);
    if (verified.has(key)) return;
    if (visiting.has(key))
        throw new Error('Cyclic recovery archive references');
    visiting.add(key);
    if (archive.kind === 'legacy') {
        if (!archive.snapshot) throw new Error('Missing legacy snapshot');
        await verifyLegacySnapshot(archive.snapshot);
        if (archive.digest !== archive.snapshot.digest)
            throw new Error('Archive digest mismatch');
    } else if (archive.archiveRefs === undefined) {
        if (
            !archive.backup ||
            (await digest(archive.backup)) !== archive.digest
        )
            throw new Error('Previous destination digest mismatch');
        for (const nested of archive.backup.legacyArchives ?? [])
            await verifyRecord(
                nested,
                archive.backup.legacyArchives ?? [],
                visiting,
                verified,
            );
    } else {
        if (archive.backup && archive.backupRef)
            throw new Error(
                'Recovery body cannot be both inline and referenced',
            );
        const body = bodyOf(archive, registry);
        if (body.legacyArchives !== undefined)
            throw new Error('Recovery backup body must be flat');
        if ((await digest(body)) !== archive.backupDigest)
            throw new Error('Recovery body digest mismatch');
        const descriptor = {
            backup: archive.backup,
            backupRef: archive.backupRef,
            backupDigest: archive.backupDigest,
            archiveRefs: archive.archiveRefs,
            archiveAliases: archive.archiveAliases,
            recoveryDigest: archive.recoveryDigest,
        };
        if ((await digest(descriptor)) !== archive.digest)
            throw new Error('Recovery descriptor digest mismatch');
        for (const dependency of dependencies(archive))
            await verifyRecord(
                resolve(dependency, registry),
                registry,
                visiting,
                verified,
            );
        const recovered = rehydrateUnchecked(archive, registry);
        if ((await digest(recovered)) !== archive.recoveryDigest)
            throw new Error('Rehydrated destination digest mismatch');
    }
    visiting.delete(key);
    verified.add(key);
}
function rehydrateUnchecked(
    archive: LegacyArchive,
    registry: readonly LegacyArchive[],
): BackupData {
    if (archive.archiveRefs === undefined) return archive.backup!;
    const archives = new Map<string, LegacyArchive>();
    const visiting = new Set<string>();
    const aliases = new Map(
        (archive.archiveAliases ?? []).map((alias) => [
            archiveKey(alias.reference),
            alias.storedId,
        ]),
    );
    const collect = (ref: ArchiveReference) => {
        const snapshotId = aliases.get(archiveKey(ref)) ?? ref.id;
        const key = archiveKey({ ...ref, id: snapshotId });
        if (archives.has(key)) return;
        if (visiting.has(key))
            throw new Error('Cyclic recovery archive references');
        visiting.add(key);
        const stored = resolveStored(ref, registry);
        const record =
            stored.id === snapshotId ? stored : { ...stored, id: snapshotId };
        for (const dependency of dependencies(record)) collect(dependency);
        archives.set(key, record);
        visiting.delete(key);
    };
    for (const ref of archive.archiveRefs) collect(ref);
    // A reused body lives in an earlier recovery record already present in the old destination.
    if (archive.backupRef) collect(archive.backupRef);
    return canonicalRecoveryBackup({
        ...bodyOf(archive, registry),
        legacyArchives: [...archives.values()],
    });
}
/** Reconstruct a complete prior destination from its immutable, verified archive DAG. */
export async function rehydrateRecoveryArchive(
    archive: LegacyArchive,
    registry: readonly LegacyArchive[],
): Promise<BackupData> {
    if (archive.kind !== 'previous-destination')
        throw new Error('Not a previous destination archive');
    await verifyRecord(archive, registry, new Set(), new Set());
    return rehydrateUnchecked(archive, registry);
}
export async function verifyRecoveryArchives(data: BackupData): Promise<void> {
    const verified = new Set<string>();
    for (const archive of data.legacyArchives ?? [])
        await verifyRecord(
            archive,
            data.legacyArchives ?? [],
            new Set(),
            verified,
        );
}
/** Store each distinct backup body once; link only DAG roots rather than copying older archives. */
export async function createRecoveryArchive(
    local: BackupData,
    stageId: string,
): Promise<LegacyArchive> {
    const { legacyArchives: archives = [], ...body } = local;
    const backupDigest = await digest(body);
    const existingBody = archives.find(
        (archive) =>
            archive.kind === 'previous-destination' &&
            archive.archiveRefs !== undefined &&
            archive.backup &&
            archive.backupDigest === backupDigest,
    );
    // Resolve dependencies in the current registry, retaining each older snapshot's own names.
    const aliasByReference = new Map<
        string,
        { reference: ArchiveReference; storedId: string }
    >();
    const referenced = new Set<string>();
    for (const archive of archives)
        for (const dependency of dependencies(archive)) {
            const stored = resolveStored(dependency, archives);
            referenced.add(archiveKey(stored));
            if (stored.id !== dependency.id)
                aliasByReference.set(archiveKey(dependency), {
                    reference: dependency,
                    storedId: stored.id,
                });
        }
    const archiveAliases = aliasByReference.size
        ? [...aliasByReference.values()].sort((a, b) =>
              archiveKey(a.reference).localeCompare(archiveKey(b.reference)),
          )
        : undefined;
    const archiveRefs = archives
        .filter((archive) => !referenced.has(archiveKey(archive)))
        .map(reference)
        .sort((a, b) => archiveKey(a).localeCompare(archiveKey(b)));
    const descriptor = {
        backup: existingBody ? undefined : body,
        backupRef: existingBody ? reference(existingBody) : undefined,
        backupDigest,
        archiveRefs,
        archiveAliases,
        recoveryDigest: await digest(canonicalRecoveryBackup(local)),
    };
    return {
        id: `previous:${stageId}`,
        kind: 'previous-destination',
        ...descriptor,
        digest: await digest(descriptor),
    };
}
