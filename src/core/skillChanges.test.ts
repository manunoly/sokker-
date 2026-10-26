import { describe, expect, it } from 'vitest';
import { computeSkillChanges } from './skillChanges';
import type { PlayerSkill } from './playerTimeline';
import type { PlayerHistoryEntry, Skills, SnapshotSource } from '../types';

const BASE: Skills = {
    stamina: 10, keeper: 1, playmaking: 10, passing: 8, technique: 10,
    defending: 6, striker: 10, pace: 10, tacticalDiscipline: 10,
    form: 10, teamwork: 10, experience: 10,
};
const today = { week: 1003, day: 2 };
const entry = (week: number, date: string, skills: Partial<Pick<Skills, PlayerSkill | 'form' | 'tacticalDiscipline'>> = {}, source: SnapshotSource = 'training'): PlayerHistoryEntry => ({
    week, date, skills: { ...BASE, ...skills }, value: 0, source,
});
const reports = () => [
    entry(1000, '2030-01-03'),
    entry(1001, '2030-01-10', { defending: 7 }),
    entry(1002, '2030-01-17', { defending: 7, passing: 9 }),
];

describe('measured skill changes', () => {
    it('sorts observations without changing records or the stored report weeks', () => {
        const history = reports().reverse();
        const original = structuredClone(history);
        expect(computeSkillChanges(history, today)).toEqual({ passing: { current: 9, previous: 8 } });
        expect(history).toEqual(original);
    });

    it.each([{ history: [] }, { history: [entry(1002, '2030-01-17')] }])('requires a measured baseline: %j', ({ history }) => {
        expect(computeSkillChanges(history, today)).toEqual({});
    });

    it('keeps a rise with just two reports and no current-week entry', () => {
        expect(computeSkillChanges(reports().slice(1), today)).toEqual({ passing: { current: 9, previous: 8 } });
    });

    it.each(['carried-over', 'roster-fallback'] as const)('does not claim a change from a new %s observation', source => {
        const history = [...reports(), entry(1003, '2030-01-24', { defending: 12, passing: 15 }, source)];
        expect(computeSkillChanges(history, { week: 1003, day: 5 })).toEqual({});
    });

    it.each(['carried-over', 'roster-fallback'] as const)('prefers a real report over a %s capture of the same observed week', source => {
        const history = [...reports(), entry(1003, '2030-01-20', { defending: 12, passing: 15 }, source)];
        expect(computeSkillChanges(history, today)).toEqual({ passing: { current: 9, previous: 8 } });
    });

    it('measures the net change across a gap without treating an inferred week as a baseline', () => {
        const history = [entry(1000, '2030-01-03'), entry(1001, '2030-01-10', { passing: 14 }, 'carried-over'),
            entry(1003, '2030-01-24', { passing: 9 })];
        expect(computeSkillChanges(history, { week: 1003, day: 5 })).toEqual({ passing: { current: 9, previous: 8 } });
    });

    it('measures both rises and drops in all eight displayed skills', () => {
        const history = [entry(1000, '2030-01-03'), entry(1002, '2030-01-17', {
            stamina: 11, keeper: 0, pace: 11, technique: 9, passing: 9, defending: 5, playmaking: 11, striker: 9,
            form: 11, tacticalDiscipline: 11,
        })];
        expect(computeSkillChanges(history, today)).toEqual({
            stamina: { current: 11, previous: 10 }, keeper: { current: 0, previous: 1 },
            pace: { current: 11, previous: 10 }, technique: { current: 9, previous: 10 },
            passing: { current: 9, previous: 8 }, defending: { current: 5, previous: 6 },
            playmaking: { current: 11, previous: 10 }, striker: { current: 9, previous: 10 },
        });
    });

    it('ignores future report weeks before choosing the latest date and filtering echoes', () => {
        const history = [...reports(), entry(1004, '2030-01-17', { defending: 12 })];
        expect(computeSkillChanges(history, today)).toEqual({ passing: { current: 9, previous: 8 } });
    });

    it('excludes old date echoes using the chart normalization', () => {
        const history = [entry(1000, '2030-01-17'), entry(1002, '2030-01-17', { passing: 9 })];
        expect(computeSkillChanges(history, today)).toEqual({});
    });

    it('treats legacy entries without source as measured training reports', () => {
        const history = reports();
        for (const report of history) delete (report as Partial<PlayerHistoryEntry>).source;
        expect(computeSkillChanges(history, today)).toEqual({ passing: { current: 9, previous: 8 } });
    });

    it('uses report weeks for invalid dates without discarding the latest completed report', () => {
        const history = reports().map(report => ({ ...report, date: 'invalid' }));
        expect(computeSkillChanges(history, today)).toEqual({ passing: { current: 9, previous: 8 } });
    });

    it('excludes a pending current-week entry even when its date is invalid', () => {
        const history = [...reports(), entry(1003, 'invalid', { defending: 7, passing: 9 })];
        expect(computeSkillChanges(history, today)).toEqual({ passing: { current: 9, previous: 8 } });
        expect(computeSkillChanges(history, { ...today, day: 5 })).toEqual({});
    });

    it('deduplicates dated Sunday captures even without current context', () => {
        const history = [...reports(), entry(1003, '2030-01-20', { defending: 7, passing: 9 })];
        expect(computeSkillChanges(history)).toEqual({ passing: { current: 9, previous: 8 } });
    });

    it('does not replace the completed training with a later capture from the pending week', () => {
        const history = [...reports(), entry(1003, '2030-01-20', { defending: 7, passing: 10 })];
        expect(computeSkillChanges(history, today)).toEqual({ passing: { current: 9, previous: 8 } });
    });
});


describe('last completed training across a Saturday rollover', () => {
    it.each([0, 1, 2, 3, 4].flatMap(day =>
        (['training', 'carried-over', 'roster-fallback'] as const).map(source => ({ day, source })),
    ))('retains the completed rise before training despite a dated current-week entry: day=$day source=$source', ({ day, source }) => {
        const history = [...reports(), entry(1003, '2030-01-17', { defending: 7, passing: 9 }, source)];
        const original = structuredClone(history);
        expect(computeSkillChanges(history, { week: 1003, day })).toEqual({ passing: { current: 9, previous: 8 } });
        expect(history).toEqual(original);
    });

    it.each([0, 1, 2, 3, 4])('does not replace the completed result with a pending capture: day=%s', day => {
        const captureDate = new Date(Date.UTC(2030, 0, 19 + day)).toISOString().slice(0, 10);
        const history = [...reports(), entry(1003, captureDate, { defending: 8, passing: 10 })];
        expect(computeSkillChanges(history, { week: 1003, day })).toEqual({ passing: { current: 9, previous: 8 } });
    });

    it.each([5, 6])('clears the previous rise when the next completed training has no changes: day=%s', day => {
        const history = [...reports(), entry(1003, '2030-01-24', { defending: 7, passing: 9 })];
        expect(computeSkillChanges(history, { week: 1003, day })).toEqual({});
    });
});
