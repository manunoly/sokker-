import { PlayerHistoryEntry, TrainingReport } from '../types/index';

export type TalentSkill = 'keeper' | 'pace' | 'technique' | 'passing' | 'defending' | 'playmaking' | 'striker';

export interface TalentRow {
    skill: TalentSkill;
    sinceLastPop: number;
    hasPop: boolean;
    /** True when the counter is exact: a pop was observed and no training-unknown week followed it. */
    exact: boolean;
    lastPopWeek: number | null;
    lastPopAfter: number | null;
    talent: number | null;
}

export interface TalentSummary {
    rows: TalentRow[];
    overallTalent: number | null;
}

type HistoryPoint = Pick<PlayerHistoryEntry, 'week' | 'skills' | 'training' | 'source'>;

const FIELD_SKILLS: TalentSkill[] = ['pace', 'technique', 'passing', 'defending', 'playmaking', 'striker'];
const GK_THRESHOLD = 6;
export const MIN_DIRECT_INTENSITY = 50;

const isDirectTraining = (training: TrainingReport | undefined, skill: TalentSkill): boolean =>
    training?.kind === 'individual' && training.skill === skill && training.intensity >= MIN_DIRECT_INTENSITY;

const average = (values: number[]): number | null =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

// Weeks stored before training reports existed have no training and are not carry-over.
const isTrainingUnknown = (entry: HistoryPoint): boolean => !entry.training && entry.source !== 'carried-over';

function analyzeSkill(sorted: HistoryPoint[], skill: TalentSkill): { row: TalentRow; intervals: number[] } {
    let count = 0;
    let pops = 0;
    let trainingGap = false;
    let dropped = false;
    let lastPopWeek: number | null = null;
    let lastPopAfter: number | null = null;
    const intervals: number[] = [];

    for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        if (isDirectTraining(entry.training, skill)) count++;
        if (isTrainingUnknown(entry)) trainingGap = true;
        if (i > 0 && entry.skills[skill] < sorted[i - 1].skills[skill]) dropped = true;
        if (i > 0 && entry.skills[skill] > sorted[i - 1].skills[skill]) {
            const usable = pops > 0 && !trainingGap && !dropped;
            lastPopAfter = usable ? count : null;
            if (usable && count > 0) intervals.push(count);
            pops++;
            lastPopWeek = entry.week;
            count = 0;
            trainingGap = false;
            dropped = false;
        }
    }

    return {
        row: { skill, sinceLastPop: count, hasPop: pops > 0, exact: pops > 0 && !trainingGap, lastPopWeek, lastPopAfter, talent: average(intervals) },
        intervals,
    };
}

/** Expects at most one entry per week (the tooltip dedupes). */
export function computeTalentSummary(history: HistoryPoint[]): TalentSummary {
    const sorted = [...history].sort((a, b) => a.week - b.week);
    const latestKeeper = sorted.length ? sorted[sorted.length - 1].skills.keeper : 0;
    const skills: TalentSkill[] = latestKeeper > GK_THRESHOLD ? ['keeper', ...FIELD_SKILLS] : FIELD_SKILLS;

    const analyses = skills.map((skill) => analyzeSkill(sorted, skill));
    return {
        rows: analyses.map((a) => a.row),
        overallTalent: average(analyses.flatMap((a) => a.intervals)),
    };
}
