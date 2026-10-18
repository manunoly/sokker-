import { describe, it, expect } from 'vitest';
import { computeSkillProgress, computeTalentSummary, TalentSkill, TalentSummary } from './talent';
import { PlayerHistoryEntry, Skills, TrainingReport } from '../types/index';
import type { PlayerSkill, PlayerTimelineRow } from './playerTimeline';

const BASE: Skills = {
    stamina: 10, keeper: 1, playmaking: 10, passing: 10, technique: 10, defending: 10,
    striker: 10, pace: 10, tacticalDiscipline: 10, form: 10, teamwork: 10, experience: 10,
};

const wk = (week: number, skills: Partial<Skills>, training?: Partial<TrainingReport>) => ({
    week,
    skills: { ...BASE, ...skills } as Skills,
    training: training
        ? ({ kind: 'individual', skill: 'pace', position: 'MID', intensity: 100, minutes: 90, ...training } as TrainingReport)
        : undefined,
    source: 'training' as PlayerHistoryEntry['source'],
});

// Known week without training (carry-over: no report means 0 directs).
const co = (week: number, skills: Partial<Skills>) => ({ ...wk(week, skills), source: 'carried-over' as PlayerHistoryEntry['source'] });
// Legacy week (stored before training reports existed): no training, not carry-over.
const legacy = (week: number, skills: Partial<Skills>) => ({ ...wk(week, skills), source: 'training' as PlayerHistoryEntry['source'] });

const row = (s: TalentSummary, skill: TalentSkill) => s.rows.find((r) => r.skill === skill)!;

describe('computeTalentSummary', () => {
    it('counts only advanced training on that skill with intensity >= 50, ignoring minutes', () => {
        const s = computeTalentSummary([
            wk(1, {}, {}),                                  // direct
            wk(2, {}, { kind: 'formation' }),               // GT
            wk(3, {}, { skill: 'passing' }),                // other skill
            wk(4, {}, { intensity: 49 }),                   // too weak
            wk(5, {}, { intensity: 50, minutes: 0 }),       // direct
            co(6, {}),                                      // no training (carry-over)
        ]);
        expect(row(s, 'pace')).toMatchObject({ sinceLastPop: 2, hasPop: false, lastPopWeek: null, talent: null });
        expect(row(s, 'passing').sinceLastPop).toBe(1);
    });

    it('resets on pop and estimates talent from complete intervals only (input order irrelevant)', () => {
        const history = [
            wk(1, { pace: 10 }, {}), wk(2, { pace: 11 }, {}),                          // first pop: incomplete interval
            wk(3, { pace: 11 }, {}), wk(4, { pace: 11 }, {}), wk(5, { pace: 11 }, {}), wk(6, { pace: 12 }, {}), // 4 directs
            wk(7, { pace: 12 }, {}), wk(8, { pace: 12 }, {}),
        ];
        const s = computeTalentSummary([...history].reverse());
        expect(row(s, 'pace')).toEqual({ skill: 'pace', sinceLastPop: 2, hasPop: true, lastPopWeek: 6, lastPopAfter: 4, talent: 4, exact: true });
    });

    it('resets on a GT-only pop without lowering talent', () => {
        const s = computeTalentSummary([
            wk(1, { pace: 10 }, {}), wk(2, { pace: 11 }, {}),                          // first pop
            wk(3, { pace: 11 }, {}), wk(4, { pace: 11 }, {}), wk(5, { pace: 12 }, {}), // 3 directs
            wk(6, { pace: 13 }, { kind: 'formation' }),                                // GT pop, 0 directs
            wk(7, { pace: 13 }, {}),
        ]);
        expect(row(s, 'pace')).toMatchObject({ sinceLastPop: 1, lastPopWeek: 6, lastPopAfter: 0, talent: 3 });
        expect(s.overallTalent).toBe(3);
    });

    it('computes overall talent across skills weighted by interval', () => {
        const s = computeTalentSummary([
            co(1, { pace: 10, playmaking: 10 }),
            co(2, { pace: 11, playmaking: 11 }),                                         // first pops
            wk(3, { pace: 11, playmaking: 11 }, {}), wk(4, { pace: 11, playmaking: 11 }, {}),
            wk(5, { pace: 11, playmaking: 11 }, {}), wk(6, { pace: 12, playmaking: 11 }, {}), // pace: 4
            wk(7, { pace: 12, playmaking: 11 }, { skill: 'playmaking' }),
            wk(8, { pace: 12, playmaking: 11 }, { skill: 'playmaking' }),
            wk(9, { pace: 12, playmaking: 12 }, { skill: 'playmaking' }),               // playmaking: 3
            wk(10, { pace: 12, playmaking: 12 }, { skill: 'playmaking' }),
            wk(11, { pace: 12, playmaking: 12 }, { skill: 'playmaking' }),
            wk(12, { pace: 12, playmaking: 12 }, { skill: 'playmaking' }),
            wk(13, { pace: 12, playmaking: 12 }, { skill: 'playmaking' }),
            wk(14, { pace: 12, playmaking: 13 }, { skill: 'playmaking' }),              // playmaking: 5
        ]);
        expect(row(s, 'pace').talent).toBe(4);
        expect(row(s, 'playmaking').talent).toBe(4);
        expect(s.overallTalent).toBe(4); // (4 + 3 + 5) / 3
    });

    it('lists skills in order, never stamina, keeper first only when keeper > 6', () => {
        const order = (keeper: number) => computeTalentSummary([wk(1, { keeper })]).rows.map((r) => r.skill);
        expect(order(6)).toEqual(['pace', 'technique', 'passing', 'defending', 'playmaking', 'striker']);
        expect(order(7)).toEqual(['keeper', 'pace', 'technique', 'passing', 'defending', 'playmaking', 'striker']);
    });

    it('handles empty history', () => {
        const s = computeTalentSummary([]);
        expect(s.overallTalent).toBeNull();
        expect(s.rows.every((r) => r.sinceLastPop === 0 && r.talent === null && !r.hasPop)).toBe(true);
    });

    it('legacy week makes the interval incomplete', () => {
        const base = [
            legacy(1, { pace: 10 }), legacy(2, { pace: 11 }), legacy(3, { pace: 11 }),
            wk(4, { pace: 11 }, {}), wk(5, { pace: 12 }, {}),
        ];
        expect(row(computeTalentSummary(base), 'pace')).toMatchObject({
            talent: null, lastPopAfter: null, lastPopWeek: 5, sinceLastPop: 0, exact: true,
        });
        const more = [...base, wk(6, { pace: 12 }, {}), wk(7, { pace: 12 }, {}), wk(8, { pace: 13 }, {})];
        expect(row(computeTalentSummary(more), 'pace')).toMatchObject({ talent: 3, lastPopAfter: 3, exact: true });
    });

    it('legacy week after the last pop makes the counter a minimum', () => {
        const s = computeTalentSummary([
            wk(1, { pace: 10 }, {}), wk(2, { pace: 11 }, {}), legacy(3, { pace: 11 }), wk(4, { pace: 11 }, {}),
        ]);
        expect(row(s, 'pace')).toMatchObject({ sinceLastPop: 1, exact: false, hasPop: true });
    });

    it('carry-over week is known and keeps the interval complete', () => {
        const s = computeTalentSummary([
            wk(1, { pace: 10 }, {}), wk(2, { pace: 11 }, {}), co(3, { pace: 11 }),
            wk(4, { pace: 11 }, {}), wk(5, { pace: 12 }, {}),
        ]);
        expect(row(s, 'pace')).toMatchObject({ talent: 2, exact: true });
    });

    it('drop then recovery is excluded and a drop does not reset the counter', () => {
        const history = [
            wk(1, { pace: 12 }, {}), wk(2, { pace: 13 }, {}), wk(3, { pace: 13 }, {}),
            wk(4, { pace: 12 }, {}), wk(5, { pace: 12 }, {}),
        ];
        expect(row(computeTalentSummary(history), 'pace').sinceLastPop).toBe(3);
        const s = computeTalentSummary([...history, wk(6, { pace: 13 }, {})]);
        expect(row(s, 'pace')).toMatchObject({ talent: null, lastPopAfter: null, lastPopWeek: 6 });
    });
});

const timelineRow = (
    week: number,
    level: number,
    training?: Partial<TrainingReport>,
    source: PlayerHistoryEntry['source'] = 'training',
    extras: Partial<PlayerTimelineRow> = {},
): PlayerTimelineRow => ({
    entry: {
        ...wk(week, { pace: level, stamina: level }, training),
        date: `2026-01-${String(week).padStart(2, '0')}`,
        value: 0,
        source,
    },
    reportWeek: week,
    observedWeek: week,
    source,
    dateReliable: true,
    dateEcho: false,
    ...extras,
});

describe('computeSkillProgress', () => {
    it('provides a result for each displayed skill, including stamina and keeper', () => {
        const skills: PlayerSkill[] = [
            'stamina', 'pace', 'technique', 'passing',
            'keeper', 'defending', 'playmaking', 'striker',
        ];
        const rows = [timelineRow(1, 10)];
        expect(skills.map(skill => computeSkillProgress(rows, skill).skill)).toEqual(skills);
        expect(computeSkillProgress(rows, 'stamina').pace).toBeNull();
    });

    it('attributes positive-intensity weeks to the direct skill and formation to the other skills', () => {
        const rows = [
            timelineRow(1, 10, { kind: 'individual', skill: 'pace', intensity: 100 }),
            timelineRow(2, 11, { kind: 'individual', skill: 'passing', intensity: 100 }), // indirect rise
            timelineRow(3, 11, { kind: 'individual', skill: 'pace', intensity: 1 }),
            timelineRow(4, 11, { kind: 'formation', skill: 'pace', intensity: 40 }),
            timelineRow(5, 11, { kind: 'individual', skill: 'pace', intensity: 0 }),
            timelineRow(6, 11, { kind: 'individual', skill: 'general', intensity: 100 }),
            timelineRow(7, 11, { kind: 'formation', skill: 'passing', intensity: 100 }),
        ];
        expect(computeSkillProgress([...rows].reverse(), 'pace')).toMatchObject({
            advanced: 1, formation: 3, exact: true, lastRiseReportWeek: 2, riseWeeks: [2],
        });
        expect(computeSkillProgress(rows, 'passing')).toMatchObject({ advanced: 1, formation: 5, exact: false });
        expect(computeSkillProgress(rows, 'keeper')).toMatchObject({ advanced: 0, formation: 6, exact: false });
    });

    it('counts a formation report for every skill but excludes a zero-intensity week', () => {
        const rows = [
            timelineRow(1, 10, { kind: 'individual', skill: 'striker', intensity: 100 }),
            timelineRow(2, 10, { kind: 'formation', skill: 'passing', intensity: 70 }),
            timelineRow(3, 10, { kind: 'formation', skill: 'general', intensity: 0 }),
        ];
        expect(computeSkillProgress(rows, 'striker')).toMatchObject({ advanced: 1, formation: 1 });
        expect(computeSkillProgress(rows, 'passing')).toMatchObject({ advanced: 0, formation: 2 });
        expect(computeSkillProgress(rows, 'keeper')).toMatchObject({ advanced: 0, formation: 2 });
    });

    it('treats no observed rise, gaps, carried rows and legacy reports as minimum counts', () => {
        const noRise = [timelineRow(1, 10, {}), timelineRow(2, 10, {})];
        expect(computeSkillProgress(noRise, 'pace')).toMatchObject({ advanced: 2, exact: false });

        const base = [timelineRow(1, 10, {}), timelineRow(2, 11, {})];
        expect(computeSkillProgress([...base, timelineRow(4, 11, {})], 'pace')).toMatchObject({ advanced: 1, exact: false });
        expect(computeSkillProgress([...base, timelineRow(3, 11, undefined, 'carried-over')], 'pace')).toMatchObject({ advanced: 0, exact: false });
        expect(computeSkillProgress([...base, timelineRow(3, 11, undefined, 'roster-fallback')], 'pace')).toMatchObject({ advanced: 0, exact: false });
        expect(computeSkillProgress([...base, timelineRow(3, 11)], 'pace')).toMatchObject({ advanced: 0, exact: false });
    });

    it('starts counting after the later real report when a rise spans missing weeks', () => {
        const rows = [
            timelineRow(1, 10, {}),
            timelineRow(4, 11, { kind: 'individual', skill: 'pace', intensity: 100 }),
            timelineRow(5, 11, { kind: 'formation', skill: 'pace', intensity: 100 }),
        ];
        expect(computeSkillProgress(rows, 'pace')).toMatchObject({
            lastRiseReportWeek: 4, riseWeeks: [4], advanced: 0, formation: 1, exact: true,
        });
    });

    it('does not count date echoes as reports or let them reset the counter', () => {
        const rows = [
            timelineRow(1, 10, {}), timelineRow(2, 11, {}),
            timelineRow(3, 12, {}, 'training', { dateEcho: true }),
            timelineRow(4, 11, {}),
        ];
        expect(computeSkillProgress(rows, 'pace')).toMatchObject({
            advanced: 1, lastRiseReportWeek: 2, exact: false, riseWeeks: [2],
        });
        const onlyEchoAfterRise = rows.slice(0, 3);
        expect(computeSkillProgress(onlyEchoAfterRise, 'pace')).toMatchObject({
            advanced: 0, lastRiseReportWeek: 2, exact: false, riseWeeks: [2],
        });
    });

    it('fits a per-skill observed pace and uses only the segment after the last level drop', () => {
        const sample = [
            timelineRow(1205, 10), timelineRow(1208, 10),
            timelineRow(1211, 11), timelineRow(1214, 11),
        ];
        const result = computeSkillProgress(sample, 'pace');
        expect(result.pace?.state).toBe('estimated');
        expect(result.pace?.weeksPerLevel).toBeCloseTo(7.5, 10);
        expect(result.trendStartWeek).toBe(1205);
        expect(result.trendEndWeek).toBe(1214);

        const afterDrop = [...sample, timelineRow(1217, 9), timelineRow(1220, 9), timelineRow(1223, 10)];
        const dropped = computeSkillProgress(afterDrop, 'pace');
        expect(dropped.pace?.state).toBe('insufficient');
        expect(dropped.trendStartWeek).toBe(1217);
        expect(dropped.trendEndWeek).toBe(1223);
        expect(dropped.riseWeeks).toEqual([1211, 1223]);
    });

    it('excludes carried and roster levels from the fitted series while retaining them for display', () => {
        const rows = [
            timelineRow(1, 10), timelineRow(2, 10, undefined, 'carried-over'),
            timelineRow(3, 11), timelineRow(4, 11, undefined, 'roster-fallback'),
            timelineRow(5, 12),
        ];
        const progress = computeSkillProgress(rows, 'pace');
        expect(progress.points).toHaveLength(5);
        expect(progress.pace?.state).toBe('insufficient');
        expect(progress.riseWeeks).toEqual([3, 5]);
    });
});
