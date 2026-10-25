import type { PlayerHistoryEntry } from '../types';
import type { TodayInfo } from './apiTypes';
import { observedSkillPoints, PLAYER_SKILL_COLUMNS, preparePlayerTimeline, type PlayerSkill } from './playerTimeline';

export interface SkillChange { current: number; previous: number }

/** Compare measured observations, collapsing repeated captures with the chart's week rules. */
export function computeSkillChanges(
    history: readonly PlayerHistoryEntry[],
    today?: Pick<TodayInfo, 'week' | 'day'>,
): Partial<Record<PlayerSkill, SkillChange>> {
    const eligible = history.filter(entry => !today || entry.week <= today.week);
    const rows = preparePlayerTimeline(eligible).filter(row =>
        // Without a usable date, only an actual current-week entry needs the pre-training fallback.
        !(today && today.day < 5 && row.reportWeek === today.week && !row.dateReliable));
    const changes: Partial<Record<PlayerSkill, SkillChange>> = {};
    for (const skill of PLAYER_SKILL_COLUMNS.flat()) {
        const points = observedSkillPoints(rows, skill);
        const current = points.at(-1);
        // A new inferred reference cannot establish a measured rise or drop.
        if (current?.source !== 'training') continue;
        const previous = points.filter(point => point.source === 'training').at(-2);
        if (previous && current.level !== previous.level) {
            changes[skill] = { current: current.level, previous: previous.level };
        }
    }
    return changes;
}
