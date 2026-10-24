// @vitest-environment node
import { it, expect } from 'vitest';
import type { BackupData, LegacyArchive } from './repository';
import { snapshotFromStores } from './legacyStorage';
import { playerFixture } from './storageFixtures';
import { sha256 } from './transferProtocol';
import {
    canonicalRecoveryBackup,
    createRecoveryArchive,
    rehydrateRecoveryArchive,
    verifyRecoveryArchives,
} from './storageRecovery';
async function legacyArchive(): Promise<LegacyArchive> {
    const snapshot = await snapshotFromStores(
        'https://sokker.org',
        'SokkerTalentTrackerDB',
        3,
        [
            {
                name: 'opaque',
                keyPath: null,
                autoIncrement: false,
                indexes: [],
                records: [{ key: 'field', value: { unknown: undefined } }],
            },
        ],
    );
    return { id: 'source', kind: 'legacy', snapshot, digest: snapshot.digest };
}
it('accepts old nested v2 recovery backups and links them without discarding their source', async () => {
    const raw = await legacyArchive();
    const oldBackup: BackupData = {
        formatVersion: 2,
        players: [playerFixture(1000)],
        legacyArchives: [raw],
    };
    const old: LegacyArchive = {
        id: 'old-nested',
        kind: 'previous-destination',
        backup: oldBackup,
        digest: await sha256(JSON.stringify(oldBackup)),
    };
    const local: BackupData = {
        formatVersion: 2,
        players: [playerFixture(1000, 1001)],
        legacyArchives: [raw, old],
    };
    await verifyRecoveryArchives(local);
    expect(await rehydrateRecoveryArchive(old, local.legacyArchives!)).toEqual(
        oldBackup,
    );
    const flat = await createRecoveryArchive(local, 'new');
    const registry = [...local.legacyArchives!, flat];
    expect(flat.backup?.legacyArchives).toBeUndefined();
    expect(await rehydrateRecoveryArchive(flat, registry)).toEqual(
        canonicalRecoveryBackup(local),
    );
});
it('reuses one large identical body while retaining complete referenced destinations', async () => {
    const raw = await legacyArchive();
    let local: BackupData = {
        formatVersion: 2,
        players: [playerFixture(1000)],
        legacyMetadata: [{ opaque: 'x'.repeat(1024 * 1024) }],
        legacyArchives: [raw],
    };
    const sizes: number[] = [];
    for (let i = 0; i < 12; i++) {
        const expected = local;
        const archive = await createRecoveryArchive(local, String(i));
        local = {
            ...local,
            legacyArchives: [...local.legacyArchives!, archive],
        };
        expect(
            await rehydrateRecoveryArchive(archive, local.legacyArchives!),
        ).toEqual(canonicalRecoveryBackup(expected));
        sizes.push(JSON.stringify(local).length);
    }
    expect(local.legacyArchives!.filter((a) => a.backup)).toHaveLength(1);
    expect(sizes.at(-1)! - sizes[0]).toBeLessThan(20000);
    const increments = sizes.slice(1).map((size, index) => size - sizes[index]);
    expect(Math.max(...increments.slice(-3))).toBeLessThanOrEqual(
        Math.max(...increments.slice(0, 3)) * 1.1,
    );
});
it('rejects missing references, body tampering and a forged recovery digest', async () => {
    const raw = await legacyArchive();
    const archive = await createRecoveryArchive(
        { players: [playerFixture(1000)], legacyArchives: [raw] },
        'one',
    );
    await expect(rehydrateRecoveryArchive(archive, [archive])).rejects.toThrow(
        'Missing recovery archive',
    );
    await expect(
        rehydrateRecoveryArchive(
            { ...archive, backup: { players: [playerFixture(1200)] } },
            [raw],
        ),
    ).rejects.toThrow('body digest');
    const altered = { ...archive, recoveryDigest: '0'.repeat(64) };
    const descriptor = {
        backup: altered.backup,
        backupRef: altered.backupRef,
        backupDigest: altered.backupDigest,
        archiveRefs: altered.archiveRefs,
        recoveryDigest: altered.recoveryDigest,
    };
    altered.digest = await sha256(JSON.stringify(descriptor));
    await expect(rehydrateRecoveryArchive(altered, [raw])).rejects.toThrow(
        'Rehydrated destination digest',
    );
});
it('preserves both colliding archive identities and their historical scopes in future recovery captures', async () => {
    const { mergeBackupData } = await import('./storageMerge');
    const a = await createRecoveryArchive(
        { players: [playerFixture(1000)], legacyArchives: [] },
        'same',
    );
    const b = await createRecoveryArchive(
        { players: [playerFixture(1001)], legacyArchives: [] },
        'same',
    );
    const b2 = await createRecoveryArchive(
        { players: [playerFixture(1002)], legacyArchives: [b] },
        'b2',
    );
    const merged = mergeBackupData(
        { players: [], legacyArchives: [a] },
        { players: [], legacyArchives: [b, b2] },
        'backup',
    );
    await verifyRecoveryArchives(merged);
    const renamed = merged.legacyArchives!.find(
        (archive) => archive.digest === b.digest,
    )!;
    expect(renamed.id).not.toBe(b.id);
    expect(await rehydrateRecoveryArchive(b2, merged.legacyArchives!)).toEqual(
        canonicalRecoveryBackup({
            players: [playerFixture(1002)],
            legacyArchives: [b],
        }),
    );
    const future = await createRecoveryArchive(merged, 'future');
    expect(
        await rehydrateRecoveryArchive(future, [
            ...merged.legacyArchives!,
            future,
        ]),
    ).toEqual(canonicalRecoveryBackup(merged));
});
it('retains unknown DAG-looking fields on a legacy archive without treating them as recovery dependencies', async () => {
    const raw = await legacyArchive();
    raw.archiveRefs = [{ id: raw.id, digest: raw.digest }];
    const destination: BackupData = {
        players: [playerFixture(1000)],
        legacyArchives: [raw],
    };
    await verifyRecoveryArchives(destination);
    const recovery = await createRecoveryArchive(destination, 'future');
    expect(await rehydrateRecoveryArchive(recovery, [raw, recovery])).toEqual(
        canonicalRecoveryBackup(destination),
    );
});
it('keeps snapshot alias scopes independent after a second registry renames the first alias again', async () => {
    const { mergeBackupData } = await import('./storageMerge');
    const original = await createRecoveryArchive(
        { players: [playerFixture(1000)], legacyArchives: [] },
        'same',
    );
    const incoming = await createRecoveryArchive(
        { players: [playerFixture(1001)], legacyArchives: [] },
        'same',
    );
    const childSource = {
        players: [playerFixture(1002)],
        legacyArchives: [incoming],
    };
    const child = await createRecoveryArchive(childSource, 'child');
    const first = mergeBackupData(
        { legacyArchives: [original] },
        { legacyArchives: [incoming, child] },
        'one',
    );
    const firstSnapshot = await createRecoveryArchive(first, 'first');
    const firstRegistry = [...first.legacyArchives!, firstSnapshot];
    const renamed = firstRegistry.find(
        (record) => record.digest === incoming.digest,
    )!;
    const other = await createRecoveryArchive(
        { players: [playerFixture(1100)], legacyArchives: [] },
        renamed.id.slice('previous:'.length),
    );
    const second = mergeBackupData(
        { legacyArchives: [other] },
        { legacyArchives: firstRegistry },
        'two',
    );
    await verifyRecoveryArchives(second);
    const renamedAgain = second.legacyArchives!.find(
        (record) => record.digest === incoming.digest,
    )!;
    expect(renamedAgain.id).not.toBe(renamed.id);
    const secondSnapshot = await createRecoveryArchive(second, 'second');
    const registry = [...second.legacyArchives!, secondSnapshot];
    expect(await rehydrateRecoveryArchive(child, registry)).toEqual(
        canonicalRecoveryBackup(childSource),
    );
    expect(await rehydrateRecoveryArchive(firstSnapshot, registry)).toEqual(
        canonicalRecoveryBackup(first),
    );
    expect(await rehydrateRecoveryArchive(secondSnapshot, registry)).toEqual(
        canonicalRecoveryBackup(second),
    );
});
