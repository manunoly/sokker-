import { describe, it, expect } from 'vitest';
import { findWeekGaps } from './gapDetector';
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
