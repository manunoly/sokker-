import { describe, it, expect } from 'vitest';
import { upsertPlayerWeekRecord } from './repository';
import { PlayerData, PlayerHistoryEntry } from '../types/index';

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
        value: 1_000_000
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
});
