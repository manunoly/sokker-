import type { PlayerData, PlayerHistoryEntry } from '../types';
import type { JuniorRecord } from './juniorTypes';
export function weekFixture(week: number, level = 7): PlayerHistoryEntry {
    return {
        week,
        date: '2026-10-01',
        skills: {
            stamina: level,
            keeper: 1,
            playmaking: level,
            passing: level,
            technique: level,
            defending: level,
            striker: level,
            pace: level,
            tacticalDiscipline: 1,
            form: 1,
            teamwork: 1,
            experience: 1,
        },
        value: 1000,
        source: 'training',
    };
}
export function playerFixture(...weeks: number[]): PlayerData {
    const history = weeks.map((w) => weekFixture(w));
    return {
        id: 12345,
        name: 'Synthetic Player',
        history,
        latest: history.at(-1)!,
    };
}
export function juniorFixture(): JuniorRecord {
    return {
        teamId: 42,
        juniorId: 555,
        points: [{ x: 10, y: 6, source: 'graph' }],
        graphWeek: 1200,
        nativeTalent: 3,
        nativeTalentWeek: 1200,
        weeksLeft: 5,
        resolution: 'graph',
        resolvedWeek: 1200,
    };
}
