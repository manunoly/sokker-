import { PlayerHistoryEntry, TrainingReport } from '../types/index';
import { observedSkillPoints } from './playerTimeline';
import type { PlayerSkill, PlayerSkillPoint, PlayerTimelineRow } from './playerTimeline';
import { estimateLevelTrend } from './levelTrend';
import type { LevelTrendEstimate } from './levelTrend';

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

/** Focused reports known since the latest observed increase in this skill. */
export interface SkillProgress {
    skill: PlayerSkill;
    /** All displayable observations, including explicitly marked inferred references. */
    points: PlayerSkillPoint[];
    /** Positive-intensity weeks directly focused on this skill. */
    advanced: number;
    /** Positive-intensity weeks without direct focus on this skill. */
    formation: number;
    /** False means the displayed counters are minimum known counts. */
    exact: boolean;
    lastRiseReportWeek: number | null;
    /** Observed game weeks of increases between real reports. */
    riseWeeks: number[];
    trendStartWeek: number | null;
    trendEndWeek: number | null;
    /** Stamina has no pace interpretation. */
    pace: LevelTrendEstimate | null;
}

/** Analyzes saved history only; it never fills a missing report with assumed training. */
export function computeSkillProgress(rows: readonly PlayerTimelineRow[], skill: PlayerSkill): SkillProgress {
    const points = observedSkillPoints(rows, skill);
    const realPoints = points.filter(point => point.source === 'training');
    const riseWeeks: number[] = [];
    let lastRiseReportWeek: number | null = null;
    let lastDropIndex = 0;

    for (let index = 1; index < realPoints.length; index++) {
        const current = realPoints[index];
        const previous = realPoints[index - 1];
        if (current.level > previous.level) {
            riseWeeks.push(current.week);
            lastRiseReportWeek = current.reportWeek;
        } else if (current.level < previous.level) {
            // The lower observation is the first point of the new fitted segment.
            lastDropIndex = index;
        }
    }

    const fittingPoints = realPoints.slice(lastDropIndex);
    const pace = skill === 'stamina'
        ? null
        : estimateLevelTrend(fittingPoints.map(point => ({ x: point.week, y: point.level })));

    const windowRows = rows
        .filter(row => !row.dateEcho && (lastRiseReportWeek === null || row.reportWeek > lastRiseReportWeek))
        .sort((a, b) => a.reportWeek - b.reportWeek);
    let advanced = 0;
    let formation = 0;
    const lastRise = lastRiseReportWeek;
    let exact = lastRise !== null
        && !rows.some(row => row.dateEcho && row.reportWeek > lastRise);
    let previousWeek = lastRiseReportWeek;

    for (const row of windowRows) {
        if (previousWeek !== null && row.reportWeek > previousWeek + 1) exact = false;
        previousWeek = row.reportWeek;

        const training = row.entry.training;
        if (row.source !== 'training' || !training || (training.kind !== 'individual' && training.kind !== 'formation')) {
            exact = false;
            continue;
        }
        if (!Number.isFinite(training.intensity) || training.intensity <= 0) continue;
        if (training.kind === 'individual' && training.skill === skill) advanced++;
        else formation++;
    }

    return {
        skill,
        points,
        advanced,
        formation,
        exact,
        lastRiseReportWeek,
        riseWeeks,
        trendStartWeek: skill === 'stamina' ? null : fittingPoints[0]?.week ?? null,
        trendEndWeek: skill === 'stamina' ? null : fittingPoints[fittingPoints.length - 1]?.week ?? null,
        pace,
    };
}
