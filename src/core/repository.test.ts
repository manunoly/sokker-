import { describe, it, expect } from 'vitest';
import { isValidBackupData, mergeRestoredJuniorRecord, upsertPlayerWeekRecord } from './repository';
import { PlayerData, PlayerHistoryEntry, SnapshotSource } from '../types/index';
import type { JuniorRecord } from './juniorTypes';

function makeWeekStats(week: number, playmaking: number): PlayerHistoryEntry {
    return {
        week,
        date: `2023-01-${String(week).padStart(2, '0')}T12:00:00`,
        skills: {
            stamina: 10,
            keeper: 1,
            playmaking,
            passing: 10,
            technique: 10,
            defending: 10,
            striker: 10,
            pace: 10,
            tacticalDiscipline: 10,
            form: 10,
            teamwork: 10,
            experience: 10
        },
        value: 1_000_000,
        source: 'training'
    };
}

describe('upsertPlayerWeekRecord', () => {
    it('creates a new record when player does not exist', () => {
        const weekStats = makeWeekStats(10, 5);
        const record = upsertPlayerWeekRecord(undefined, 123, 'Player One', weekStats);

        expect(record.id).toBe(123);
        expect(record.name).toBe('Player One');
        expect(record.history).toHaveLength(1);
        expect(record.history[0].week).toBe(10);
        expect(record.latest.week).toBe(10);
    });

    it('overwrites existing week data (baseline/intro week refresh)', () => {
        const existing: PlayerData = {
            id: 123,
            name: 'Player One',
            latest: makeWeekStats(10, 5),
            history: [
                makeWeekStats(9, 4),
                makeWeekStats(10, 5)
            ]
        };

        const refreshedWeek = makeWeekStats(10, 6);
        const updated = upsertPlayerWeekRecord(existing, 123, 'Player One', refreshedWeek);

        expect(updated.history).toHaveLength(2);
        expect(updated.history[0].week).toBe(9);
        expect(updated.history[1].week).toBe(10);
        expect(updated.history[1].skills.playmaking).toBe(6);
        expect(updated.latest.week).toBe(10);
        expect(updated.latest.skills.playmaking).toBe(6);
    });

    it('appends missing week and keeps history sorted', () => {
        const existing: PlayerData = {
            id: 123,
            name: 'Player One',
            latest: makeWeekStats(12, 7),
            history: [
                makeWeekStats(10, 5),
                makeWeekStats(12, 7)
            ]
        };

        const inserted = makeWeekStats(11, 6);
        const updated = upsertPlayerWeekRecord(existing, 123, 'Player One', inserted);

        expect(updated.history.map(h => h.week)).toEqual([10, 11, 12]);
        expect(updated.latest.week).toBe(12);
    });

    it('does not mutate existing record/history input', () => {
        const existing: PlayerData = {
            id: 123,
            name: 'Player One',
            latest: makeWeekStats(12, 7),
            history: [
                makeWeekStats(10, 5),
                makeWeekStats(12, 7)
            ]
        };

        const originalHistoryWeeks = existing.history.map(h => h.week);
        const originalRef = existing.history;

        const updated = upsertPlayerWeekRecord(existing, 123, 'Player One', makeWeekStats(11, 6));

        expect(existing.history.map(h => h.week)).toEqual(originalHistoryWeeks);
        expect(existing.history).toBe(originalRef);
        expect(updated.history).not.toBe(existing.history);
        expect(updated.history.map(h => h.week)).toEqual([10, 11, 12]);
    });
});

function makeWeekStatsWithSource(
    week: number,
    playmaking: number,
    source: SnapshotSource,
    injured?: boolean
): PlayerHistoryEntry {
    return {
        week,
        date: `2023-01-${String(week).padStart(2, '0')}T12:00:00`,
        skills: {
            stamina: 10, keeper: 1, playmaking, passing: 10, technique: 10,
            defending: 10, striker: 10, pace: 10, tacticalDiscipline: 10,
            form: 10, teamwork: 10, experience: 10
        },
        value: 1_000_000,
        source,
        ...(injured !== undefined ? { injured } : {})
    };
}

describe('upsertPlayerWeekRecord R1/R2 invariants', () => {
    it('R1: refuses to overwrite a training entry with a carried-over entry', () => {
        const trainingEntry = makeWeekStatsWithSource(10, 5, 'training');
        const existing: PlayerData = {
            id: 123,
            name: 'Player',
            latest: trainingEntry,
            history: [trainingEntry]
        };

        const carryOver = makeWeekStatsWithSource(10, 99, 'carried-over', true);
        const updated = upsertPlayerWeekRecord(existing, 123, 'Player', carryOver);

        expect(updated.history).toHaveLength(1);
        expect(updated.history[0].source).toBe('training');
        expect(updated.history[0].skills.playmaking).toBe(5);
    });

    it('R2: training entry upgrades an existing carried-over entry', () => {
        const carryOver = makeWeekStatsWithSource(10, 5, 'carried-over', true);
        const existing: PlayerData = {
            id: 123,
            name: 'Player',
            latest: carryOver,
            history: [carryOver]
        };

        const training = makeWeekStatsWithSource(10, 6, 'training');
        const updated = upsertPlayerWeekRecord(existing, 123, 'Player', training);

        expect(updated.history).toHaveLength(1);
        expect(updated.history[0].source).toBe('training');
        expect(updated.history[0].skills.playmaking).toBe(6);
        expect(updated.history[0].injured).toBeUndefined();
    });

    it('R2: carried-over does not overwrite another carried-over', () => {
        const first = makeWeekStatsWithSource(10, 5, 'carried-over', true);
        const existing: PlayerData = {
            id: 123,
            name: 'Player',
            latest: first,
            history: [first]
        };

        const second = makeWeekStatsWithSource(10, 99, 'carried-over', false);
        const updated = upsertPlayerWeekRecord(existing, 123, 'Player', second);

        expect(updated.history).toHaveLength(1);
        expect(updated.history[0].skills.playmaking).toBe(5);
        expect(updated.history[0].injured).toBe(true);
    });

    it('migration: entry without source is treated as training (R1 applies)', () => {
        const legacyEntry = {
            week: 10,
            date: '2023-01-10T12:00:00',
            skills: makeWeekStats(10, 5).skills,
            value: 1_000_000
        } as PlayerHistoryEntry;

        const existing: PlayerData = {
            id: 123,
            name: 'Player',
            latest: legacyEntry,
            history: [legacyEntry]
        };

        const carryOver = makeWeekStatsWithSource(10, 99, 'carried-over', true);
        const updated = upsertPlayerWeekRecord(existing, 123, 'Player', carryOver);

        expect(updated.history[0].skills.playmaking).toBe(5);
    });
});

describe('isValidBackupData', () => {
    it('rejects non-object and array payloads', () => {
        expect(isValidBackupData(null)).toBe(false);
        expect(isValidBackupData([])).toBe(false);
        expect(isValidBackupData('bad')).toBe(false);
    });

    it('accepts object payloads with optional array sections', () => {
        expect(isValidBackupData({})).toBe(true);
        expect(isValidBackupData({ players: [], metadata: [], weeks: [] })).toBe(true);
        expect(isValidBackupData({ players: {} })).toBe(false);
    });
    it('accepts a player record produced by upsertPlayerWeekRecord', () => {
        const player = upsertPlayerWeekRecord(undefined, 1, 'Test', makeWeekStats(10, 5));
        expect(isValidBackupData({ players: [player], metadata: [{ key: 'lastSyncWeek', value: 10 }], weeks: [{ week: 10 }] })).toBe(true);
    });

    it('rejects players whose skills are not numbers', () => {
        const player = upsertPlayerWeekRecord(undefined, 1, 'Test', makeWeekStats(10, 5));
        const bad = { ...player, history: [{ ...player.history[0], skills: { ...player.history[0].skills, pace: '<img src=x>' } }] };
        expect(isValidBackupData({ players: [bad] })).toBe(false);
    });

    it('rejects players without numeric id or history array', () => {
        expect(isValidBackupData({ players: [{ id: '1', name: 'x', history: [] }] })).toBe(false);
        expect(isValidBackupData({ players: [{ id: 1, name: 'x' }] })).toBe(false);
    });

    it('rejects metadata without key and weeks without numeric week', () => {
        expect(isValidBackupData({ metadata: [{ value: 1 }] })).toBe(false);
        expect(isValidBackupData({ weeks: [{ week: 'x' }] })).toBe(false);
    });

    it('accepts a legacy backup with no juvenile section and a valid juvenile backup', () => {
        expect(isValidBackupData({ players: [], metadata: [], weeks: [] })).toBe(true);
        expect(isValidBackupData({ juniors: [makeJuniorRecord()] })).toBe(true);
        expect(isValidBackupData({ juniors: [{ ...makeJuniorRecord(), points: [] }] })).toBe(true);
    });

    it('rejects malformed juvenile records and duplicate team/id keys', () => {
        const junior = makeJuniorRecord();
        expect(isValidBackupData({ juniors: {} })).toBe(false);
        expect(isValidBackupData({ juniors: [{ ...junior, teamId: '7' }] })).toBe(false);
        expect(isValidBackupData({ juniors: [{ ...junior, points: [{ ...junior.points[0], y: 19 }] }] })).toBe(false);
        expect(isValidBackupData({ juniors: [{ ...junior, points: [{ ...junior.points[0], source: 'invented' }] }] })).toBe(false);
        expect(isValidBackupData({ juniors: [{ ...junior, resolvedWeek: 1213, resolution: null }] })).toBe(false);
        expect(isValidBackupData({ juniors: [{ ...junior, graphWeek: '1213' }] })).toBe(false);
        expect(isValidBackupData({ juniors: [{ ...junior, graphWeek: 1213 }] })).toBe(true);
        expect(isValidBackupData({ juniors: [{ ...junior, weeksLeft: '12' }] })).toBe(false);
        expect(isValidBackupData({ juniors: [{ ...junior, weeksLeft: 0 }] })).toBe(true);
        expect(isValidBackupData({ juniors: [junior, { ...junior }] })).toBe(false);
    });
});

function makeJuniorRecord(overrides: Partial<JuniorRecord> = {}): JuniorRecord {
    return {
        teamId: 7,
        juniorId: 42,
        points: [{ x: 100, y: 5, source: 'graph' }],
        nativeTalent: 4.5,
        nativeTalentWeek: 1213,
        resolvedWeek: 1213,
        resolution: 'graph',
        ...overrides
    };
}

describe('mergeRestoredJuniorRecord', () => {
    it('restores known weeks from a backup captured in the same week as a legacy local record', () => {
        const local = makeJuniorRecord({ nativeTalent: 4.2 });
        const backup = makeJuniorRecord({ nativeTalent: 4.1, weeksLeft: 8 });
        const result = mergeRestoredJuniorRecord(local, backup);
        expect(result.nativeTalent).toBe(4.2);
        expect(result.weeksLeft).toBe(8);
    });

    it('unites missing points while the local point wins a collision without mutating inputs', () => {
        const local = makeJuniorRecord({
            points: [{ x: 100, y: 6, source: 'graph' }, { x: 102, y: 8, source: 'graph' }],
            nativeTalent: 4,
            nativeTalentWeek: 1214,
            graphWeek: 1214,
            weeksLeft: 12,
            resolvedWeek: 1214
        });
        const backup = makeJuniorRecord({
            points: [{ x: 99, y: 4, source: 'graph' }, { x: 100, y: 5, source: 'graph' }]
        });
        const result = mergeRestoredJuniorRecord(local, backup);
        expect(result.points.map((point) => [point.x, point.y])).toEqual([[99, 4], [100, 6], [102, 8]]);
        expect(result.points[1]).not.toBe(local.points[0]);
        expect(result.nativeTalent).toBe(4);
        expect(result.nativeTalentWeek).toBe(1214);
        expect(result.graphWeek).toBe(1214);
        expect(result.weeksLeft).toBe(12);
        expect(result.resolvedWeek).toBe(1214);
        expect(local.points).toHaveLength(2);
        expect(backup.points).toHaveLength(2);
    });

    it('keeps a valid imported graph marker only when there is no local record', () => {
        const backup = makeJuniorRecord({ points: [] });
        expect(mergeRestoredJuniorRecord(undefined, backup)).toMatchObject({
            points: [], resolvedWeek: 1213, resolution: 'graph'
        });
        const local = makeJuniorRecord({ resolvedWeek: null, resolution: null });
        expect(mergeRestoredJuniorRecord(local, backup)).toMatchObject({
            resolvedWeek: null, resolution: null
        });
    });

    it('invalidates imported absent and unknown markers while preserving local markers', () => {
        for (const resolution of ['absent', 'unknown'] as const) {
            const record = makeJuniorRecord({ resolution });
            expect(mergeRestoredJuniorRecord(undefined, record)).toMatchObject({
                resolvedWeek: null, resolution: null
            });
            expect(mergeRestoredJuniorRecord(record, makeJuniorRecord())).toMatchObject({
                resolvedWeek: 1213, resolution
            });
        }
    });
});
