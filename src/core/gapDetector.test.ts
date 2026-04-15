import { describe, it, expect } from 'vitest';
import { buildCarryOverEntry, findWeekGaps, inferInjury } from './gapDetector';
import { PlayerHistoryEntry, Skills } from '../types/index';

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
