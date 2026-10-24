import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, resolve, sep } from 'node:path';
import { playerFixture, juniorFixture } from '../../src/core/storageFixtures';
import {
    snapshotFromStores,
    verifyLegacySnapshot,
    LEGACY_DATABASE_NAME,
} from '../../src/core/legacyStorage';
import { validateBackup } from '../../src/core/storageMigration';
import { verifyRecoveryArchives } from '../../src/core/storageRecovery';
import { sha256 } from '../../src/core/transferProtocol';
import type { BackupData } from '../../src/core/repository';
import type { JuniorRecord } from '../../src/core/juniorTypes';
import type { LegacySnapshot } from '../../src/core/storageTypes';

const DATASET = 'sokker++:mv3-synthetic-files:v1';
const MiB = 1024 * 1024;
const scenarios = ['legacy', 'v2', 'large'] as const;
// These synthetic fixtures keep the same markers when imported sequentially.
const juniorFields = [
    'nativeTalent',
    'nativeTalentWeek',
    'weeksLeft',
    'graphWeek',
    'resolvedWeek',
    'resolution',
] as const;
type Scenario = (typeof scenarios)[number];
interface Expected {
    player: {
        id: number;
        name: string;
        rows: Array<{ week: number; digest: string }>;
    };
    junior: JuniorRecord;
    archive?: {
        digest: string;
        encodedDigest: string;
        inventory: LegacySnapshot['inventory'];
    };
    payload?: {
        conflictId: string;
        bytes: number;
        characters: number;
        digest: string;
    };
}
interface Fixture {
    file: string;
    bytes: number;
    digest: string;
    expected: Expected;
}
interface Manifest {
    dataset: typeof DATASET;
    runId: string;
    createdAt: string;
    evidence: {
        generatedFilesValidated: true;
        chromePopupExecution: 'pending';
        indexedDBUsed: false;
        networkUsed: false;
    };
    files: Record<Scenario, Fixture>;
}
function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}
function canonical(value: unknown): string {
    const ordered = (input: unknown): unknown =>
        Array.isArray(input)
            ? input.map(ordered)
            : input && typeof input === 'object'
              ? Object.fromEntries(
                    Object.entries(input)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, item]) => [key, ordered(item)]),
                )
              : input;
    return JSON.stringify(ordered(value));
}
async function checked(text: string): Promise<BackupData> {
    const data: unknown = JSON.parse(text);
    validateBackup(data);
    await verifyRecoveryArchives(data);
    return data;
}
async function expected(data: BackupData): Promise<Expected> {
    const player = data.players![0];
    const junior = data.juniors![0];
    const archive = data.legacyArchives?.find(
        (item) => item.kind === 'legacy',
    )?.snapshot;
    const payload = data.migrationConflicts?.find((item) =>
        item.id.startsWith('synthetic-mv3-payload-'),
    );
    return {
        player: {
            id: player.id,
            name: player.name,
            rows: await Promise.all(
                player.history.map(async (row) => ({
                    week: row.week,
                    digest: await sha256(canonical(row)),
                })),
            ),
        },
        junior,
        ...(archive
            ? {
                  archive: {
                      digest: archive.digest,
                      encodedDigest: await sha256(archive.encodedStores),
                      inventory: archive.inventory,
                  },
              }
            : {}),
        ...(payload
            ? {
                  payload: {
                      conflictId: payload.id,
                      bytes: new TextEncoder().encode(
                          payload.discarded as string,
                      ).byteLength,
                      characters: (payload.discarded as string).length,
                      digest: await sha256(payload.discarded as string),
                  },
              }
            : {}),
    };
}
async function writeFixture(
    directory: string,
    file: string,
    data: BackupData,
): Promise<Fixture> {
    const text = JSON.stringify(data, null, 2) + '\n';
    await checked(text);
    const path = resolve(directory, file);
    await writeFile(path, text, { encoding: 'utf8', flag: 'wx' });
    const readback = await readFile(path, 'utf8');
    const parsed = await checked(readback);
    assert(
        (await sha256(readback)) === (await sha256(text)),
        'Generated file readback digest differs',
    );
    return {
        file,
        bytes: Buffer.byteLength(readback, 'utf8'),
        digest: await sha256(readback),
        expected: await expected(parsed),
    };
}
async function generate(root: string): Promise<void> {
    const runId = randomUUID();
    const directory = resolve(
        root,
        'node_modules/.cache/sokker-mv3-check',
        runId,
    );
    await mkdir(directory); // An existing run is never reused, removed or overwritten.
    const junior = juniorFixture();
    const source = await snapshotFromStores(
        'https://mv3-fixture.sokker.org',
        LEGACY_DATABASE_NAME,
        3,
        [
            {
                name: 'players',
                keyPath: 'id',
                autoIncrement: false,
                indexes: [],
                records: [{ key: 12345, value: playerFixture(1002, 1003) }],
            },
            {
                name: 'juniors',
                keyPath: ['teamId', 'juniorId'],
                autoIncrement: false,
                indexes: [],
                records: [{ key: [42, 555], value: junior }],
            },
            {
                name: 'metadata',
                keyPath: 'key',
                autoIncrement: false,
                indexes: [],
                records: [
                    {
                        key: 'lastSyncWeek',
                        value: { key: 'lastSyncWeek', value: 1003 },
                    },
                ],
            },
            {
                name: 'weeks',
                keyPath: 'week',
                autoIncrement: false,
                indexes: [],
                records: [{ key: 1003, value: { week: 1003 } }],
            },
            {
                name: 'unknown-synthetic',
                keyPath: null,
                autoIncrement: false,
                indexes: [],
                records: [
                    {
                        key: 'extra',
                        value: {
                            label: 'Synthetic only',
                            missing: undefined,
                            bytes: new Uint8Array([1, 2, 3]),
                        },
                    },
                ],
            },
        ],
    );
    await verifyLegacySnapshot(source);
    const archive = {
        id: `legacy:${source.origin}:${source.digest}`,
        kind: 'legacy' as const,
        snapshot: source,
        digest: source.digest,
    };
    const legacy: BackupData = {
        players: [playerFixture(1000, 1001)],
        juniors: [junior],
        metadata: [{ key: 'lastSyncWeek', value: 1001 }],
        weeks: [{ week: 1001 }],
    };
    const v2: BackupData = {
        formatVersion: 2,
        players: [playerFixture(1002, 1003)],
        juniors: [junior],
        legacyArchives: [archive],
        migrationConflicts: [],
        legacyMetadata: [{ origin: source.origin, synthetic: true }],
    };
    const files = {} as Record<Scenario, Fixture>;
    files.legacy = await writeFixture(directory, 'legacy-small.json', legacy);
    files.v2 = await writeFixture(directory, 'v2-small.json', v2);
    const largeJunior = {
        ...junior,
        points: [...junior.points, { x: 11, y: 7, source: 'graph' as const }],
    };
    const large: BackupData = {
        formatVersion: 2,
        players: [playerFixture(1200)],
        juniors: [largeJunior],
        legacyArchives: [archive],
        migrationConflicts: [
            {
                id: `synthetic-mv3-payload-${runId}`,
                origin: source.origin,
                entity: 'synthetic-payload',
                coordinate: 1200,
                reason: 'Generated MV3 transfer fixture',
                discarded: 'x'.repeat(65 * MiB) + ' end \" \u{1F603}',
            },
        ],
    };
    files.large = await writeFixture(directory, 'v2-over-64mib.json', large);
    assert(
        files.large.bytes > 64 * MiB,
        'Large fixture is not greater than 64 MiB',
    );
    const manifest: Manifest = {
        dataset: DATASET,
        runId,
        createdAt: new Date().toISOString(),
        evidence: {
            generatedFilesValidated: true,
            chromePopupExecution: 'pending',
            indexedDBUsed: false,
            networkUsed: false,
        },
        files,
    };
    const manifestPath = resolve(directory, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', {
        encoding: 'utf8',
        flag: 'wx',
    });
    console.log(
        JSON.stringify(
            {
                manifest: manifestPath,
                files: Object.fromEntries(
                    scenarios.map((key) => [
                        key,
                        {
                            path: resolve(directory, files[key].file),
                            bytes: files[key].bytes,
                            digest: files[key].digest,
                        },
                    ]),
                ),
                chromePopupExecution: 'pending',
            },
            null,
            2,
        ),
    );
}
function option(args: string[], name: string): string {
    const index = args.indexOf(name);
    assert(index >= 0 && !!args[index + 1], `Missing ${name}`);
    return args[index + 1];
}
async function verify(args: string[], root: string): Promise<void> {
    const manifestPath = resolve(option(args, '--manifest'));
    const cache = resolve(root, 'node_modules/.cache/sokker-mv3-check');
    assert(
        manifestPath.startsWith(cache + sep) &&
            basename(manifestPath) === 'manifest.json',
        'Use a manifest generated under this worktree cache',
    );
    const manifest = JSON.parse(
        await readFile(manifestPath, 'utf8'),
    ) as Manifest;
    assert(
        manifest.dataset === DATASET &&
            manifest.runId === basename(dirname(manifestPath)),
        'Unrecognized synthetic manifest',
    );
    const scenario = option(args, '--scenario');
    assert(
        scenario === 'all' || scenarios.includes(scenario as Scenario),
        'Scenario must be legacy, v2, large or all',
    );
    const selected: readonly Scenario[] =
        scenario === 'all' ? scenarios : [scenario as Scenario];
    const exportPath = resolve(option(args, '--export'));
    const text = await readFile(exportPath, 'utf8');
    const data = await checked(text);
    assert(
        (data.players ?? []).every(
            (player) =>
                player.id === 12345 && player.name === 'Synthetic Player',
        ) &&
            (data.juniors ?? []).every(
                (junior) => junior.teamId === 42 && junior.juniorId === 555,
            ),
        'Export contains identities outside this synthetic dataset; no report was written',
    );
    for (const field of [
        'epoch',
        'revision',
        'control',
        'migrationStaging',
        'automaticMigrationBlocked',
    ])
        assert(
            !Object.hasOwn(data, field),
            `Export contains installation-local field: ${field}`,
        );
    const verifiedRows = new Set<number>();
    const verifiedPoints = new Set<number>();
    let archiveDigest: string | null = null;
    let payloadDigest: string | null = null;
    for (const key of selected) {
        const fixture = manifest.files[key];
        const fixturePath = resolve(dirname(manifestPath), fixture.file);
        assert(
            dirname(fixturePath) === dirname(manifestPath),
            'Invalid fixture path in manifest',
        );
        const inputText = await readFile(fixturePath, 'utf8');
        assert(
            Buffer.byteLength(inputText, 'utf8') === fixture.bytes &&
                (await sha256(inputText)) === fixture.digest,
            'Generated fixture no longer matches its manifest',
        );
        const want = fixture.expected;
        const player = data.players?.find(
            (player) => player.id === want.player.id,
        );
        assert(
            player?.name === want.player.name,
            `Missing synthetic player for ${key}`,
        );
        assert(
            new Set(player.history.map((row) => row.week)).size ===
                player.history.length,
            'Player history contains duplicate weeks',
        );
        const latest = player.history.reduce((a, b) =>
            a.week > b.week ? a : b,
        );
        assert(
            canonical(player.latest) === canonical(latest),
            'Player latest does not match its most recent observation',
        );
        for (const row of want.player.rows) {
            const actual = player.history.find(
                (item) => item.week === row.week,
            );
            assert(
                actual && (await sha256(canonical(actual))) === row.digest,
                `Missing or altered player observation at week ${row.week}`,
            );
            verifiedRows.add(row.week);
        }
        const junior = data.juniors?.find(
            (item) =>
                item.teamId === want.junior.teamId &&
                item.juniorId === want.junior.juniorId,
        );
        assert(junior, 'Synthetic junior missing');
        assert(
            new Set(junior.points.map((point) => point.x)).size ===
                junior.points.length,
            'Junior graph contains duplicate coordinates',
        );
        for (const field of juniorFields) {
            assert(
                junior[field] === want.junior[field],
                `Synthetic junior ${field} changed`,
            );
        }
        for (const point of want.junior.points) {
            assert(
                junior.points.some(
                    (actual) => canonical(actual) === canonical(point),
                ),
                `Missing or altered junior point ${point.x}`,
            );
            verifiedPoints.add(point.x);
        }
        if (want.archive) {
            const snapshot = data.legacyArchives?.find(
                (archive) =>
                    archive.kind === 'legacy' &&
                    archive.snapshot?.digest === want.archive!.digest,
            )?.snapshot;
            assert(snapshot, 'Expected full legacy archive missing');
            await verifyLegacySnapshot(snapshot);
            assert(
                (await sha256(snapshot.encodedStores)) ===
                    want.archive.encodedDigest &&
                    canonical(snapshot.inventory) ===
                        canonical(want.archive.inventory),
                'Archive schema/key/value inventory differs',
            );
            archiveDigest = snapshot.digest;
        }
        if (want.payload) {
            const conflict = data.migrationConflicts?.find(
                (item) => item.id === want.payload!.conflictId,
            );
            assert(
                typeof conflict?.discarded === 'string',
                'Long conflict payload missing',
            );
            assert(
                conflict.discarded.length === want.payload.characters &&
                    new TextEncoder().encode(conflict.discarded).byteLength ===
                        want.payload.bytes &&
                    (await sha256(conflict.discarded)) === want.payload.digest,
                'Long conflict payload is incomplete or altered',
            );
            payloadDigest = want.payload.digest;
        }
    }
    const inputIsGeneratedFixture = Object.values(manifest.files).some(
        (file) => resolve(dirname(manifestPath), file.file) === exportPath,
    );
    const report = {
        dataset: DATASET,
        runId: manifest.runId,
        scenario,
        verified: true,
        exportPath,
        exportBytes: Buffer.byteLength(text, 'utf8'),
        exportDigest: await sha256(text),
        playerId: 12345,
        weeks: [...verifiedRows].sort((a, b) => a - b),
        junior: {
            teamId: 42,
            juniorId: 555,
            pointXs: [...verifiedPoints].sort((a, b) => a - b),
            fieldsChecked: juniorFields,
        },
        archiveDigest,
        payloadDigest,
        recoveryArchivesCryptographicallyValidated: true,
        wholeBackupEqualityRequired: false,
        inputIsGeneratedFixture,
        inputClassification: inputIsGeneratedFixture
            ? 'generated-fixture-path'
            : 'external-file-unattributed',
        chromePopupExecution: 'not-established-by-cli',
        evidence:
            'File and product-validator checks only; Chrome popup execution is not established by this command.',
    };
    const path = resolve(
        dirname(manifestPath),
        `verify-${scenario}-${randomUUID()}.json`,
    );
    await writeFile(path, JSON.stringify(report, null, 2) + '\n', {
        encoding: 'utf8',
        flag: 'wx',
    });
    console.log(JSON.stringify({ report: path, ...report }, null, 2));
}
export async function main(args: string[], root: string): Promise<void> {
    if (args[0] === 'generate') return generate(root);
    if (args[0] === 'verify') return verify(args.slice(1), root);
    throw new Error(
        'Usage: node scripts/mv3-browser-check/run.mjs generate | verify --manifest PATH --export PATH --scenario legacy|v2|large|all',
    );
}
