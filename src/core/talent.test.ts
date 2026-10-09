import { describe, it, expect } from 'vitest';
import { computeTalentSummary, TalentSkill, TalentSummary } from './talent';
import { PlayerHistoryEntry, Skills, TrainingReport } from '../types/index';

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
