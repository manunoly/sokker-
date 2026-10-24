/**
 * IndexedDB Wrapper using closures.
 * No classes, no external dependencies.
 */

import { PlayerData, PlayerHistoryEntry, SnapshotSource } from '../types/index';

import type { JuniorPoint, JuniorRecord } from './juniorTypes';

export const JUNIOR_WRITE_GENERATION_KEY = 'juniorWriteGeneration';

/**
 * Pure helper that merges one week's stats into a player record.
 *
 * Invariants:
 *  - R1: a 'training' entry is never overwritten by a 'carried-over' entry.
 *  - R2: a 'training' entry upgrades an existing 'carried-over' entry for the
 *        same week. A 'carried-over' entry never overwrites another
 *        'carried-over' entry (first write wins).
 *  - Migration: legacy entries without a `source` field are treated as
 *    'training' (they came from the training endpoint before this feature).
 */
export const upsertPlayerWeekRecord = (
    existingRecord: PlayerData | undefined,
    playerId: number,
    playerName: string,
    weekStats: PlayerHistoryEntry,
): PlayerData => {
    const record: PlayerData = existingRecord
        ? {
              ...existingRecord,
              history: [...existingRecord.history],
          }
        : {
              id: playerId,
              name: playerName,
              latest: weekStats,
              history: [],
          };

    const existingIndex = record.history.findIndex(
        (h) => h.week === weekStats.week,
    );
    if (existingIndex !== -1) {
        const existing = record.history[existingIndex];
        const existingSource: SnapshotSource = existing.source ?? 'training';
        const incomingSource: SnapshotSource = weekStats.source ?? 'training';

        const isUpgrade =
            existingSource !== 'training' && incomingSource === 'training';
        const isSameTraining =
            existingSource === 'training' && incomingSource === 'training';

        if (isUpgrade || isSameTraining) {
            record.history[existingIndex] = weekStats;
        }
        // Otherwise (training already in place vs carried-over incoming, or
        // carried-over vs carried-over): keep existing. R1 protects training;
        // first carry-over wins.
    } else {
        record.history.push(weekStats);
    }

    record.history.sort((a, b) => a.week - b.week);

    // Recompute latest as the entry with the highest week after merge.
    record.latest = record.history[record.history.length - 1] ?? weekStats;

    return record;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ArchiveReference {
    id: string;
    digest: string;
}
export interface ArchiveAlias {
    reference: ArchiveReference;
    storedId: string;
}
export interface LegacyArchive {
    id: string;
    snapshot?: import('./storageTypes').LegacySnapshot;
    backup?: BackupData;
    backupRef?: ArchiveReference;
    backupDigest?: string;
    archiveRefs?: ArchiveReference[];
    archiveAliases?: ArchiveAlias[];
    recoveryDigest?: string;
    digest: string;
    kind: 'legacy' | 'previous-destination';
}
export interface BackupData {
    formatVersion?: 2;
    migrationConflicts?: import('./storageTypes').MigrationConflict[];
    legacyArchives?: LegacyArchive[];
    legacyMetadata?: unknown[];
    players?: PlayerData[];
    metadata?: Array<{ key: string } & Record<string, unknown>>;
    weeks?: Array<{ week: number } & Record<string, unknown>>;
    juniors?: JuniorRecord[];
}

const isFiniteNumber = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);
const isPositiveId = (v: unknown): v is number =>
    typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

function isValidJuniorPoint(value: unknown): value is JuniorPoint {
    return (
        isObject(value) &&
        typeof value.x === 'number' &&
        Number.isSafeInteger(value.x) &&
        isFiniteNumber(value.y) &&
        value.y >= 0 &&
        value.y <= 18 &&
        (value.scale === undefined || isFiniteNumber(value.scale)) &&
        value.source === 'graph'
    );
}

function isValidJuniorRecord(value: unknown): value is JuniorRecord {
    if (!isObject(value)) return false;
    const hasNativeWeek =
        value.nativeTalentWeek === null || isPositiveId(value.nativeTalentWeek);
    const hasGraphWeek =
        value.graphWeek === undefined ||
        value.graphWeek === null ||
        isPositiveId(value.graphWeek);
    const hasWeeksLeft =
        value.weeksLeft === undefined ||
        value.weeksLeft === null ||
        (typeof value.weeksLeft === 'number' &&
            Number.isSafeInteger(value.weeksLeft) &&
            value.weeksLeft >= 0);
    const hasResolvedWeek =
        value.resolvedWeek === null || isPositiveId(value.resolvedWeek);
    const validResolution =
        value.resolution === null ||
        value.resolution === 'graph' ||
        value.resolution === 'absent' ||
        value.resolution === 'unknown';
    return (
        isPositiveId(value.teamId) &&
        isPositiveId(value.juniorId) &&
        Array.isArray(value.points) &&
        value.points.every(isValidJuniorPoint) &&
        (value.nativeTalent === null || isFiniteNumber(value.nativeTalent)) &&
        hasNativeWeek &&
        hasGraphWeek &&
        hasWeeksLeft &&
        (value.nativeTalent === null || value.nativeTalentWeek !== null) &&
        hasResolvedWeek &&
        validResolution &&
        (value.resolvedWeek === null) === (value.resolution === null)
    );
}

function isValidJuniorSection(value: unknown): boolean {
    if (value === undefined) return true;
    if (!Array.isArray(value) || !value.every(isValidJuniorRecord))
        return false;
    const keys = new Set<string>();
    for (const record of value as JuniorRecord[]) {
        const key = `${record.teamId}:${record.juniorId}`;
        if (keys.has(key)) return false;
        keys.add(key);
    }
    return true;
}

/** A restore adds missing observations, with the already stored observation winning a collision. */
export function mergeRestoredJuniorRecord(
    local: JuniorRecord | undefined,
    backup: JuniorRecord,
): JuniorRecord {
    const points = new Map<number, JuniorPoint>();
    for (const point of backup.points) points.set(point.x, { ...point });
    for (const point of local?.points ?? []) points.set(point.x, { ...point });

    const localTalentIsNewer =
        local?.nativeTalentWeek != null &&
        (backup.nativeTalentWeek == null ||
            local.nativeTalentWeek >= backup.nativeTalentWeek);
    const talentSource = localTalentIsNewer ? local! : backup;
    const weeksLeft =
        talentSource.weeksLeft ??
        (localTalentIsNewer &&
        local?.nativeTalentWeek != null &&
        local.nativeTalentWeek === backup.nativeTalentWeek
            ? (backup.weeksLeft ?? null)
            : null);
    // Local markers retain their local roster context. Imported absence/unknown markers
    // lose their roster context because backup snapshots are never restored.
    const resolutionSource = local ?? backup;
    const hasReliableResolution =
        !!local || resolutionSource.resolution === 'graph';
    const graphWeekOf = (record: JuniorRecord | undefined): number | null =>
        record?.graphWeek ??
        (record?.resolution === 'graph' ? record.resolvedWeek : null);
    const graphWeek =
        Math.max(graphWeekOf(local) ?? 0, graphWeekOf(backup) ?? 0) || null;

    return {
        teamId: backup.teamId,
        juniorId: backup.juniorId,
        points: [...points.values()].sort((a, b) => a.x - b.x),
        nativeTalent: talentSource.nativeTalent,
        nativeTalentWeek: talentSource.nativeTalentWeek,
        weeksLeft,
        graphWeek,
        resolvedWeek: hasReliableResolution
            ? resolutionSource.resolvedWeek
            : null,
        resolution: hasReliableResolution ? resolutionSource.resolution : null,
    };
}

function isValidHistoryEntry(value: unknown): boolean {
    return (
        isObject(value) &&
        isFiniteNumber(value.week) &&
        isObject(value.skills) &&
        Object.values(value.skills).every(isFiniteNumber)
    );
}

function isValidPlayerRecord(value: unknown): boolean {
    return (
        isObject(value) &&
        isFiniteNumber(value.id) &&
        typeof value.name === 'string' &&
        Array.isArray(value.history) &&
        value.history.every(isValidHistoryEntry)
    );
}

const isArrayOf = (
    value: unknown,
    check: (item: unknown) => boolean,
): boolean =>
    value === undefined || (Array.isArray(value) && value.every(check));

export function isValidBackupData(data: unknown): data is BackupData {
    return (
        isObject(data) &&
        isArrayOf(data.players, isValidPlayerRecord) &&
        isArrayOf(
            data.metadata,
            (m) => isObject(m) && typeof m.key === 'string',
        ) &&
        isArrayOf(data.weeks, (w) => isObject(w) && isFiniteNumber(w.week)) &&
        isValidJuniorSection(data.juniors)
    );
}
