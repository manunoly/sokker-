import { parseCaptureDate } from './playerTimeline';
import type { PlayerData, PlayerHistoryEntry } from '../types';
import type { JuniorRecord } from './juniorTypes';
import type { BackupData } from './repository';
import type { MigrationConflict } from './storageTypes';
const equal = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
const conflict = (
    origin: string,
    entity: string,
    coordinate: number | string,
    discarded: unknown,
    reason: string,
): MigrationConflict => ({
    id: crypto.randomUUID(),
    origin,
    entity,
    coordinate,
    discarded,
    reason,
});
export function mergePlayerHistory(
    existing: PlayerData | undefined,
    incoming: PlayerData,
    origin = 'backup',
): {
    player: PlayerData;
    conflicts: MigrationConflict[];
} {
    const conflicts: MigrationConflict[] = [];
    const history = new Map<number, PlayerHistoryEntry>();
    for (const entry of existing?.history ?? []) history.set(entry.week, entry);
    for (const next of incoming.history) {
        const old = history.get(next.week);
        if (!old) {
            history.set(next.week, next);
            continue;
        }
        if (equal(old, next)) continue;
        const oldReal = (old.source ?? 'training') === 'training';
        const newReal = (next.source ?? 'training') === 'training';
        const oldDate = parseCaptureDate(old.date)?.timestamp ?? NaN,
            newDate = parseCaptureDate(next.date)?.timestamp ?? NaN;
        const replace =
            (!oldReal && newReal) ||
            (oldReal &&
                newReal &&
                Number.isFinite(oldDate) &&
                Number.isFinite(newDate) &&
                newDate > oldDate);
        const discarded = replace ? old : next;
        history.set(next.week, replace ? next : old);
        conflicts.push(
            conflict(
                origin,
                `player:${incoming.id}`,
                next.week,
                discarded,
                replace ? 'incoming-report-preferred' : 'destination-preferred',
            ),
        );
    }
    const sorted = [...history.values()].sort((a, b) => a.week - b.week);
    return {
        player: {
            ...incoming,
            ...existing,
            id: incoming.id,
            name: existing?.name ?? incoming.name,
            history: sorted,
            latest: sorted.at(-1) ?? incoming.latest,
        },
        conflicts,
    };
}
export function mergeJuniorHistory(
    existing: JuniorRecord | undefined,
    incoming: JuniorRecord,
    origin = 'backup',
): {
    junior: JuniorRecord;
    conflicts: MigrationConflict[];
} {
    const conflicts: MigrationConflict[] = [];
    const graphWeek = (r: JuniorRecord | undefined) =>
        r?.graphWeek ??
        (r?.resolution === 'graph' ? r.resolvedWeek : null) ??
        0;
    const preferIncoming = graphWeek(incoming) > graphWeek(existing);
    const points = new Map((existing?.points ?? []).map((p) => [p.x, p]));
    for (const next of incoming.points) {
        const old = points.get(next.x);
        if (!old) {
            points.set(next.x, next);
            continue;
        }
        if (equal(old, next)) continue;
        points.set(next.x, preferIncoming ? next : old);
        conflicts.push(
            conflict(
                origin,
                `junior:${incoming.teamId}:${incoming.juniorId}`,
                next.x,
                preferIncoming ? old : next,
                'graph-freshness',
            ),
        );
    }
    const preferTalent =
        !existing ||
        (incoming.nativeTalentWeek ?? 0) > (existing.nativeTalentWeek ?? 0);
    const talent = preferTalent ? incoming : existing!;
    if (
        existing &&
        !equal(
            [
                existing.nativeTalent,
                existing.nativeTalentWeek,
                existing.weeksLeft,
            ],
            [
                incoming.nativeTalent,
                incoming.nativeTalentWeek,
                incoming.weeksLeft,
            ],
        )
    )
        conflicts.push(
            conflict(
                origin,
                `junior:${incoming.teamId}:${incoming.juniorId}`,
                'nativeTalent',
                preferTalent ? existing : incoming,
                'talent-provenance',
            ),
        );
    const graph = Math.max(graphWeek(existing), graphWeek(incoming)) || null;
    return {
        junior: {
            ...incoming,
            ...existing,
            teamId: incoming.teamId,
            juniorId: incoming.juniorId,
            points: [...points.values()].sort((a, b) => a.x - b.x),
            nativeTalent: talent.nativeTalent,
            nativeTalentWeek: talent.nativeTalentWeek,
            weeksLeft: talent.weeksLeft ?? null,
            graphWeek: graph,
            resolvedWeek:
                existing?.resolvedWeek ??
                (incoming.resolution === 'graph'
                    ? incoming.resolvedWeek
                    : null),
            resolution:
                existing?.resolution ??
                (incoming.resolution === 'graph' ? 'graph' : null),
        },
        conflicts,
    };
}
/** Retain both variants if a backup reuses an archive/conflict ID for different evidence. */
function preserveVariants<T extends { id: string }>(values: readonly T[]): T[] {
    const records = new Map<string, T>();
    for (const value of values) {
        const prior = records.get(value.id);
        if (!prior) {
            records.set(value.id, value);
            continue;
        }
        if (equal(prior, value)) continue;
        const variant = {
            ...value,
            id: value.id + ':variant:' + crypto.randomUUID(),
        };
        records.set(variant.id, variant);
    }
    return [...records.values()];
}
export function mergeBackupData(
    local: BackupData,
    incoming: BackupData,
    origin: string,
): BackupData {
    const players = new Map((local.players ?? []).map((p) => [p.id, p]));
    const juniors = new Map(
        (local.juniors ?? []).map((j) => [`${j.teamId}:${j.juniorId}`, j]),
    );
    const conflicts: MigrationConflict[] = [
        ...(local.migrationConflicts ?? []),
        ...(incoming.migrationConflicts ?? []),
    ];
    for (const p of incoming.players ?? []) {
        const merged = mergePlayerHistory(players.get(p.id), p, origin);
        players.set(p.id, merged.player);
        conflicts.push(...merged.conflicts);
    }
    for (const j of incoming.juniors ?? []) {
        const key = `${j.teamId}:${j.juniorId}`;
        const merged = mergeJuniorHistory(juniors.get(key), j, origin);
        juniors.set(key, merged.junior);
        conflicts.push(...merged.conflicts);
    }
    const weeks = new Map(
        (local.weeks ?? [])
            .filter((w) => Number.isSafeInteger(w.teamId))
            .map((w) => [`${w.teamId}:${w.week}`, w]),
    );
    for (const w of incoming.weeks ?? [])
        if (
            Number.isSafeInteger(w.teamId) &&
            !weeks.has(`${w.teamId}:${w.week}`)
        )
            weeks.set(`${w.teamId}:${w.week}`, w);

    const legacyMetadata = [
        ...(local.legacyMetadata ?? []),
        ...(incoming.legacyMetadata ?? []),
        ...(incoming.metadata ?? []),
        ...(incoming.weeks ?? []).filter(
            (w) => !Number.isSafeInteger(w.teamId),
        ),
    ];
    return {
        formatVersion: 2,
        players: [...players.values()],
        juniors: [...juniors.values()],
        weeks: [...weeks.values()],
        metadata: local.metadata ?? [],
        migrationConflicts: preserveVariants(conflicts),
        legacyArchives: preserveVariants([
            ...(local.legacyArchives ?? []),
            ...(incoming.legacyArchives ?? []),
        ]),
        legacyMetadata: [
            ...new Map(
                legacyMetadata.map((item) => [JSON.stringify(item), item]),
            ).values(),
        ],
    };
}
