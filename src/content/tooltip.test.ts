
import { describe, it, expect } from 'vitest';
import { prepareChartData } from './tooltip';

describe('prepareChartData', () => {
    // Helper to create history entry
    const createEntry = (week: number, dateStr: string, skillVal: number, form: number = 10) => ({
        week,
        date: dateStr,
        skills: {
            playmaking: skillVal,
            form: form,
            stamina: 10,
            teamwork: 10,
            tacticalDiscipline: 10
        }
    });

    it('should adjust weeks for pre-training days (Sat-Wed)', () => {
        const history = [
            createEntry(100, '2023-10-21T12:00:00', 5), // Saturday (Week 100) -> Should be Week 99
            createEntry(100, '2023-10-25T12:00:00', 6), // Wednesday (Week 100) -> Should be Week 99
            createEntry(100, '2023-10-26T12:00:00', 7), // Thursday (Week 100) -> Should be Week 100
        ];

        const result = prepareChartData(history, 'playmaking');

        expect(result).toHaveLength(2);

        const week99 = result.find(p => p.week === 99);
        expect(week99).toBeDefined();
        expect(week99?.value).toBe(6); // Wed overrides Sat

        const week100 = result.find(p => p.week === 100);
        expect(week100).toBeDefined();
        expect(week100?.value).toBe(7);
    });

    it('should deduplicate multiple entries for same adjusted week', () => {
        const history = [
            createEntry(100, '2023-10-26T10:00:00', 7), // Thu AM
            createEntry(100, '2023-10-26T12:00:00', 8), // Thu Noon (Latest)
        ];

        const result = prepareChartData(history, 'playmaking');

        expect(result).toHaveLength(1);
        expect(result[0].week).toBe(100);
        expect(result[0].value).toBe(8);
    });

    it('should remove naive backfills (flatlines > 3 weeks)', () => {
        // Create 5 weeks of identical data (flatline) to be safe > 3
        const history = [
            createEntry(10, '2023-01-01T12:00:00', 5, 5),
            createEntry(11, '2023-01-08T12:00:00', 5, 5),
            createEntry(12, '2023-01-15T12:00:00', 5, 5),
            createEntry(13, '2023-01-22T12:00:00', 5, 5),
            createEntry(14, '2023-01-29T12:00:00', 5, 5),
        ];

        const result = prepareChartData(history, 'playmaking');

        expect(result).toHaveLength(1);
        expect(result[0].week).toBe(13); // Should keep only the latest (Week 14 Sun -> Week 13)
    });

    it('should NOT remove flatlines if form fluctuates', () => {
        const history = [
            createEntry(10, '2023-01-01T12:00:00', 5, 5),
            createEntry(11, '2023-01-08T12:00:00', 5, 6), // Form changed
            createEntry(12, '2023-01-15T12:00:00', 5, 5),
            createEntry(13, '2023-01-22T12:00:00', 5, 5),
        ];

        const result = prepareChartData(history, 'playmaking');

        expect(result).toHaveLength(4); // Should keep all
    });

    it('should detect bad backfills based on date clustering', () => {
        // Use fixed Friday timestamps so week-adjust logic is stable in any execution day.
        const oneHourAgo = '2023-10-27T11:00:00';
        const twoHoursAgo = '2023-10-27T10:00:00';

        // Scenario: Week 50 and Week 100 both synchronized "today"
        // Week 50 is a ghost entry with "today's" date
        const history = [
            createEntry(50, twoHoursAgo, 5), // Old week, but recent date
            createEntry(100, oneHourAgo, 5), // Current week
        ];

        const result = prepareChartData(history, 'playmaking');

        // Logic: if p.week < latest.week - 1 AND date diff < 1 day -> remove
        // Week 50 < 99, and date diff is 1 hour. Should be removed.

        expect(result).toHaveLength(1);
        expect(result[0].week).toBe(100);
    });

    it('should handle "missing" players gracefully (by not receiving them)', () => {
        const result = prepareChartData([], 'playmaking');
        expect(result).toHaveLength(0);
    });

    it('should process mixed sequence of backfill and valid data', () => {
        const history = [
            createEntry(10, '2023-01-01T12:00:00', 5, 10), // Backfill
            createEntry(11, '2023-01-08T12:00:00', 5, 10), // Backfill
            createEntry(12, '2023-01-15T12:00:00', 5, 10), // Backfill
            createEntry(13, '2023-01-22T12:00:00', 6, 11), // Real update
            createEntry(14, '2023-01-29T12:00:00', 6, 11), // Real update
        ];

        const result = prepareChartData(history, 'playmaking');

        expect(result).toHaveLength(5);
        expect(result[result.length - 1].value).toBe(6);
    });
});
