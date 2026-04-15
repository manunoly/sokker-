import { TrainingKind, TrainingPosition, TrainingReport, TrainingSkill } from '../types/index';

const VALID_SKILLS: TrainingSkill[] = [
    'general', 'stamina', 'keeper', 'playmaking',
    'passing', 'technique', 'defending', 'striker', 'pace'
];

const VALID_POSITIONS: TrainingPosition[] = ['GK', 'DEF', 'MID', 'ATT'];

function toNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * Extracts a normalized TrainingReport from the raw `report` object returned by
 * /api/training. Returns undefined when the report is missing, malformed, or
 * has kind=missing (no training happened that week).
 */
export function extractTrainingReport(rawReport: unknown): TrainingReport | undefined {
    if (!isObject(rawReport)) return undefined;

    const kindObj = rawReport.kind;
    if (!isObject(kindObj)) return undefined;
    const kindName = kindObj.name;
    if (kindName !== 'individual' && kindName !== 'formation') return undefined;
    const kind = kindName as TrainingKind;

    const typeObj = isObject(rawReport.type) ? rawReport.type : undefined;
    const rawSkillName = typeObj && typeof typeObj.name === 'string' ? typeObj.name : 'general';
    const skill: TrainingSkill = (VALID_SKILLS as string[]).includes(rawSkillName)
        ? rawSkillName as TrainingSkill
        : 'general';

    const formationObj = isObject(rawReport.formation) ? rawReport.formation : null;
    const rawPosName = formationObj && typeof formationObj.name === 'string' ? formationObj.name : null;
    const position: TrainingPosition | null = rawPosName && (VALID_POSITIONS as string[]).includes(rawPosName)
        ? rawPosName as TrainingPosition
        : null;

    const intensity = toNumber(rawReport.intensity);
    const games = isObject(rawReport.games) ? rawReport.games : {};
    const minutes =
        toNumber(games.minutesOfficial) +
        toNumber(games.minutesFriendly) +
        toNumber(games.minutesNational);

    return { kind, skill, position, intensity, minutes };
}
