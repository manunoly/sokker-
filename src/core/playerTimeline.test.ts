import { describe, expect, it } from 'vitest';
import type { PlayerHistoryEntry, Skills } from '../types/index';
import { observedSkillPoints, PLAYER_SKILL_COLUMNS, preparePlayerTimeline } from './playerTimeline';

const BASE: Skills = {
    stamina: 10, keeper: 1, playmaking: 10, passing: 10, technique: 10,
    defending: 10, striker: 10, pace: 10, tacticalDiscipline: 10,
    form: 10, teamwork: 10, experience: 10,
};

function entry(
    week: number,
    date: string,
    pace: number,
    source: PlayerHistoryEntry['source'] = 'training',
    otherSkills: Partial<Skills> = {},
): PlayerHistoryEntry {
    return { week, date, source, skills: { ...BASE, ...otherSkills, pace }, value: 1 };
}

describe('preparePlayerTimeline', () => {
    it('keeps the player-page skill order in two columns', () => {
        expect(PLAYER_SKILL_COLUMNS).toEqual([
            ['stamina', 'pace', 'technique', 'passing'],
            ['keeper', 'defending', 'playmaking', 'striker'],
        ]);
    });

    it('derives date-only weekdays from the calendar and preserves stored report weeks', () => {
        const rows = preparePlayerTimeline([
            entry(1210, '2026-10-14', 10), // Wednesday
            entry(1211, '2026-10-15', 11), // Thursday
            entry(1212, '2026-10-16', 12), // Friday
            entry(1213, '2026-10-17', 13), // Saturday
        ]);
        expect(rows.map(r => [r.reportWeek, r.observedWeek, r.dateReliable])).toEqual([
            [1210, 1209, true], [1211, 1211, true],
            [1212, 1212, true], [1213, 1212, true],
        ]);
        expect(rows.map(r => r.entry.week)).toEqual([1210, 1211, 1212, 1213]);
    });

    it('falls back to the stored week for invalid dates without making them reliable', () => {
        const rows = preparePlayerTimeline([
            entry(1211, '2026-02-30', 10),
            entry(1212, 'not-a-date', 11),
        ]);
        expect(rows.map(r => [r.reportWeek, r.observedWeek, r.dateReliable])).toEqual([
            [1211, 1211, false], [1212, 1212, false],
        ]);
    });

    it('normalizes a legacy missing source to a real report', () => {
        const legacy = entry(1211, '2026-10-15', 10);
        delete (legacy as Partial<PlayerHistoryEntry>).source;
        expect(preparePlayerTimeline([legacy])[0].source).toBe('training');
    });

    it('keeps one row per report week, preferring a real report and then the latest capture', () => {
        const rows = preparePlayerTimeline([
            entry(1210, '2026-10-16T14:00:00Z', 13, 'roster-fallback'),
            entry(1210, '2026-10-15T08:00:00Z', 11, 'training'),
            entry(1210, '2026-10-15T20:00:00Z', 12, 'training'),
            entry(1211, '2026-10-16T08:00:00Z', 13, 'carried-over'),
        ]);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({ reportWeek: 1210, source: 'training', entry: { skills: { pace: 12 } } });
    });

    it('marks older weeks captured on the same day as the latest report as date echoes', () => {
        const rows = preparePlayerTimeline([
            entry(1200, '2026-10-15', 10),
            entry(1201, '2026-10-15', 10),
            entry(1210, '2026-10-15', 11),
        ]);
        expect(rows.map(r => r.dateEcho)).toEqual([true, true, false]);
        expect(rows).toHaveLength(3); // Keep stored reports available to the table.
    });
});

describe('observedSkillPoints', () => {
    it('deduplicates by observed week, preferring real reports then newer timestamps', () => {
        const rows = preparePlayerTimeline([
            entry(1212, '2026-10-09T08:00:00Z', 10, 'carried-over'),
            entry(1213, '2026-10-10T20:00:00Z', 11, 'training'),
            entry(1214, '2026-10-10T21:00:00Z', 12, 'roster-fallback'),
        ]);
        const points = observedSkillPoints(rows, 'pace');
        expect(points).toHaveLength(2);
        expect(points[0]).toMatchObject({ week: 1212, reportWeek: 1213, level: 11, source: 'training' });
    });

    it('accepts zero and eighteen but rejects invalid or out-of-range levels', () => {
        const rows = preparePlayerTimeline([
            entry(1209, '2026-10-08', 0),
            entry(1210, '2026-10-15', 18),
            entry(1211, 'invalid', -1),
            entry(1212, 'invalid', 19),
            entry(1213, 'invalid', Number.NaN),
            entry(1214, 'invalid', 10.5),
        ]);
        expect(observedSkillPoints(rows, 'pace').map(p => p.level)).toEqual([0, 18]);
    });

    it('retains a stable form history and does not discard it as static backfill', () => {
        const rows = preparePlayerTimeline([
            entry(1209, '2026-10-01', 10, 'training', { form: 10 }),
            entry(1210, '2026-10-08', 10, 'training', { form: 10 }),
            entry(1211, '2026-10-15', 11, 'training', { form: 10 }),
        ]);
        expect(observedSkillPoints(rows, 'pace')).toHaveLength(3);
    });

    it('carries invalid-date uncertainty into the displayed point', () => {
        const points = observedSkillPoints(preparePlayerTimeline([entry(1211, 'invalid', 10)]), 'pace');
        expect(points[0]).toMatchObject({ week: 1211, dateReliable: false });
    });

    it('excludes implausible old date echoes from the chart while retaining table rows', () => {
        const rows = preparePlayerTimeline([
            entry(1200, '2026-10-15', 10),
            entry(1210, '2026-10-15', 11),
        ]);
        expect(rows).toHaveLength(2);
        expect(observedSkillPoints(rows, 'pace')).toEqual([
            expect.objectContaining({ week: 1210, reportWeek: 1210, level: 11 }),
        ]);
    });
});
