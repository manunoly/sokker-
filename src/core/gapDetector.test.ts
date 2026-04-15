import { describe, it, expect } from 'vitest';
import {
    buildCarryOverEntry,
    findWeekGaps,
    inferInjury,
    reconcileGapsWithDeps,
    ReconcileDeps
} from './gapDetector';
import { PlayerHistoryEntry, PlayerData, RosterPlayer, Skills } from '../types/index';
import { healthyPlayer } from './__fixtures__/rosterSample';

const baseSkills: Skills = {
    form: 5, tacticalDiscipline: 10, teamwork: 8, experience: 12,
    stamina: 11, keeper: 0, playmaking: 9, passing: 10, technique: 11,
    defending: 8, striker: 12, pace: 10
};

function entry(week: number, source: 'training' | 'carried-over' = 'training'): PlayerHistoryEntry {
    return {
        week,
        date: `2026-01-${String(week).padStart(2, '0')}`,
        skills: { ...baseSkills },
        value: 500000,
        source
    };
}

describe('findWeekGaps', () => {
    it('returns weeks missing between firstStoredWeek and currentWeek-1', () => {
        const history = [entry(10), entry(12)];
        expect(findWeekGaps(history, 14)).toEqual([11, 13]);
    });

    it('ignores weeks outside the first-appearance..currentWeek-1 window', () => {
        const history = [entry(10), entry(11)];
        expect(findWeekGaps(history, 12)).toEqual([]);
    });

    it('excludes the current week from the scan range', () => {
        const history = [entry(10)];
        expect(findWeekGaps(history, 11)).toEqual([]);
    });

    it('detects multiple consecutive gaps', () => {
        const history = [entry(10), entry(14)];
        expect(findWeekGaps(history, 15)).toEqual([11, 12, 13]);
    });

    it('returns empty list when history is empty', () => {
        expect(findWeekGaps([], 20)).toEqual([]);
    });

    it('considers carried-over entries as filled (so they are not re-detected)', () => {
        const history = [entry(10), entry(11, 'carried-over'), entry(12)];
        expect(findWeekGaps(history, 13)).toEqual([]);
    });
});

function entryWithInjury(week: number, days: number, severe = false): PlayerHistoryEntry {
    return {
        ...entry(week),
        injury: { daysRemaining: days, severe },
        injured: days > 0
    };
}

describe('inferInjury', () => {
    it('returns true when previous week had daysRemaining >= 7', () => {
        expect(inferInjury(entryWithInjury(9, 7), undefined)).toBe(true);
        expect(inferInjury(entryWithInjury(9, 10), undefined)).toBe(true);
    });

    it('returns true when next week has daysRemaining > 0', () => {
        expect(inferInjury(entry(9), entryWithInjury(11, 3))).toBe(true);
        expect(inferInjury(undefined, entryWithInjury(11, 1))).toBe(true);
    });

    it('returns undefined when previous has daysRemaining < 7 and no next evidence', () => {
        expect(inferInjury(entryWithInjury(9, 3), entry(11))).toBeUndefined();
    });

    it('returns undefined when there is no injury info anywhere', () => {
        expect(inferInjury(entry(9), entry(11))).toBeUndefined();
        expect(inferInjury(undefined, undefined)).toBeUndefined();
    });

    it('prev has priority over next (both positive)', () => {
        expect(inferInjury(entryWithInjury(9, 7), entryWithInjury(11, 2))).toBe(true);
    });
});

describe('buildCarryOverEntry', () => {
    it('clones skills and value from the previous entry', () => {
        const prev = entry(9);
        const result = buildCarryOverEntry(prev, 10, undefined);
        expect(result.skills).toEqual(prev.skills);
        expect(result.skills).not.toBe(prev.skills); // defensive copy
        expect(result.value).toBe(prev.value);
        expect(result.week).toBe(10);
    });

    it('sets source to carried-over and reason to missing-report', () => {
        const prev = entry(9);
        const result = buildCarryOverEntry(prev, 10, undefined);
        expect(result.source).toBe('carried-over');
        expect(result.reason).toBe('missing-report');
    });

    it('sets injured only when inference is true', () => {
        const prev = entry(9);
        const injuredResult = buildCarryOverEntry(prev, 10, true);
        expect(injuredResult.injured).toBe(true);

        const unknownResult = buildCarryOverEntry(prev, 10, undefined);
        expect(unknownResult.injured).toBeUndefined();
    });

    it('derives the date from the previous week shifted by 7 days when parseable', () => {
        const prev: PlayerHistoryEntry = { ...entry(9), date: '2026-01-09' };
        const result = buildCarryOverEntry(prev, 10, undefined);
        expect(result.date).toBe('2026-01-16');
    });

    it('falls back to previous date verbatim when not parseable', () => {
        const prev: PlayerHistoryEntry = { ...entry(9), date: 'not-a-date' };
        const result = buildCarryOverEntry(prev, 10, undefined);
        expect(result.date).toBe('not-a-date');
    });
});

function makeDeps(overrides: Partial<ReconcileDeps>): ReconcileDeps {
    return {
        fetchCurrentContext: async () => ({ week: 13, teamId: 42 }),
        fetchRoster: async () => [],
        getAllPlayers: async () => [],
        savePlayerCarryOverEntry: async () => {},
        ...overrides
    };
}

function makePlayerData(id: number, name: string, entries: PlayerHistoryEntry[]): PlayerData {
    return {
        id,
        name,
        latest: entries[entries.length - 1],
        history: [...entries]
    };
}

describe('reconcileGapsWithDeps', () => {
    it('fills a simple gap using skills from N-1, injured=undefined without evidence', async () => {
        const saved: Array<[number, string, PlayerHistoryEntry]> = [];
        const history = [entry(10), entry(12)];
        const deps = makeDeps({
            fetchRoster: async () => [{ ...healthyPlayer, id: 777 }],
            getAllPlayers: async () => [makePlayerData(777, 'Test Player', history)],
            savePlayerCarryOverEntry: async (id, name, e) => { saved.push([id, name, e]); }
        });

        const result = await reconcileGapsWithDeps(deps);

        expect(saved).toHaveLength(1);
        expect(saved[0][0]).toBe(777);
        expect(saved[0][2].week).toBe(11);
        expect(saved[0][2].source).toBe('carried-over');
        expect(saved[0][2].injured).toBeUndefined();
        expect(result.gapsFilled).toBe(1);
    });

    it('marks injured=true when N-1 had daysRemaining >= 7', async () => {
        const saved: PlayerHistoryEntry[] = [];
        const prev: PlayerHistoryEntry = {
            ...entry(10),
            injury: { daysRemaining: 7, severe: false },
            injured: true
        };
        const next = entry(12);
        const deps = makeDeps({
            fetchRoster: async () => [{ ...healthyPlayer, id: 1 }],
            getAllPlayers: async () => [makePlayerData(1, 'X', [prev, next])],
            savePlayerCarryOverEntry: async (_id, _name, e) => { saved.push(e); }
        });

        await reconcileGapsWithDeps(deps);

        expect(saved[0].injured).toBe(true);
    });

    it('skips the current week (R3)', async () => {
        const saved: PlayerHistoryEntry[] = [];
        const deps = makeDeps({
            fetchCurrentContext: async () => ({ week: 11, teamId: 1 }),
            fetchRoster: async () => [{ ...healthyPlayer, id: 1 }],
            getAllPlayers: async () => [makePlayerData(1, 'X', [entry(10)])],
            savePlayerCarryOverEntry: async (_id, _name, e) => { saved.push(e); }
        });

        const result = await reconcileGapsWithDeps(deps);

        expect(saved).toHaveLength(0);
        expect(result.gapsFilled).toBe(0);
    });

    it('counts ex-players (in store but not in roster) as skipped.notInRoster (R4)', async () => {
        const saved: PlayerHistoryEntry[] = [];
        const deps = makeDeps({
            fetchRoster: async () => [{ ...healthyPlayer, id: 1 }],
            getAllPlayers: async () => [
                makePlayerData(1, 'Current', [entry(10), entry(12)]),
                makePlayerData(999, 'Gone', [entry(10), entry(12)])
            ],
            savePlayerCarryOverEntry: async (id, _name, e) => { saved.push({ ...e, week: id }); }
        });

        const result = await reconcileGapsWithDeps(deps);

        // Only the current player's gap was filled; the ex-player's gap was NOT.
        expect(saved).toHaveLength(1);
        expect(saved[0].week).toBe(1); // sentinel = player id
        expect(result.skipped.notInRoster).toBe(1);
    });

    it('does not reconcile players with no prior history (R3 firstWeek)', async () => {
        const saved: PlayerHistoryEntry[] = [];
        const deps = makeDeps({
            fetchRoster: async () => [{ ...healthyPlayer, id: 1 }],
            getAllPlayers: async () => [],
            savePlayerCarryOverEntry: async (_id, _name, e) => { saved.push(e); }
        });

        const result = await reconcileGapsWithDeps(deps);

        expect(saved).toHaveLength(0);
        expect(result.skipped.noHistory).toBeGreaterThan(0);
    });

    it('fills multiple consecutive gaps cloning from N-1 each time (cascading)', async () => {
        const saved: PlayerHistoryEntry[] = [];
        const deps = makeDeps({
            fetchCurrentContext: async () => ({ week: 15, teamId: 1 }),
            fetchRoster: async () => [{ ...healthyPlayer, id: 1 }],
            getAllPlayers: async () => [makePlayerData(1, 'X', [entry(10), entry(14)])],
            savePlayerCarryOverEntry: async (_id, _name, e) => { saved.push(e); }
        });

        await reconcileGapsWithDeps(deps);

        expect(saved.map((e) => e.week)).toEqual([11, 12, 13]);
        expect(saved.every((e) => e.source === 'carried-over')).toBe(true);
    });

    it('does not crash if fetchRoster throws; returns error result', async () => {
        const deps = makeDeps({
            fetchRoster: async () => { throw new Error('network'); }
        });
        const result = await reconcileGapsWithDeps(deps);
        expect(result.gapsFilled).toBe(0);
        expect(result.error).toBeDefined();
    });
});
