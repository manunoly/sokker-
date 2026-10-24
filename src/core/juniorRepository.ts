import type { JuniorPoint, JuniorRecord, JuniorResolution, JuniorRosterEntry } from './juniorTypes';

const emptyRecord = (teamId: number, juniorId: number): JuniorRecord => ({
    teamId,
    juniorId,
    points: [],
    nativeTalent: null,
    nativeTalentWeek: null,
    weeksLeft: null,
    graphWeek: null,
    resolvedWeek: null,
    resolution: null
});

/** Merge observed coordinates without mutating either input. New API points win collisions. */
export const mergeJuniorPoints = (
    existing: readonly JuniorPoint[],
    incoming: readonly JuniorPoint[]
): JuniorPoint[] => {
    const byX = new Map<number, JuniorPoint>();
    for (const point of existing) byX.set(point.x, { ...point });
    for (const point of incoming) byX.set(point.x, { ...point });
    return [...byX.values()].sort((a, b) => a.x - b.x);
};

/** Graph age is independent of the later roster-membership resolution. */
export const mergeJuniorGraphRecord = (
    existing: JuniorRecord | undefined,
    teamId: number,
    juniorId: number,
    week: number,
    points: readonly JuniorPoint[]
): JuniorRecord => {
    const record = existing ?? emptyRecord(teamId, juniorId);
    const previousGraphWeek = record.graphWeek ??
        (record.resolution === 'graph' ? record.resolvedWeek : null);
    const stale = previousGraphWeek != null && previousGraphWeek > week;
    const laterResolution = record.resolvedWeek != null && record.resolvedWeek > week;
    return {
        ...record,
        points: stale
            ? mergeJuniorPoints(points, record.points)
            : mergeJuniorPoints(record.points, points),
        graphWeek: stale ? previousGraphWeek : week,
        resolvedWeek: laterResolution ? record.resolvedWeek : week,
        resolution: laterResolution ? record.resolution : 'graph'
    };
};

/** Preserve graph age before a roster decision replaces a legacy graph marker. */
export const mergeJuniorResolutionRecord = (
    existing: JuniorRecord | undefined,
    teamId: number,
    juniorId: number,
    week: number,
    resolution: Extract<JuniorResolution, 'absent' | 'unknown'>
): JuniorRecord | null => {
    if (existing?.resolvedWeek != null &&
        (existing.resolvedWeek > week || (existing.resolvedWeek === week && existing.resolution === 'graph'))) return null;
    return {
        ...(existing ?? emptyRecord(teamId, juniorId)),
        graphWeek: existing?.graphWeek ??
            (existing?.resolution === 'graph' ? existing.resolvedWeek : null),
        resolvedWeek: week,
        resolution
    };
};

/** Roster values share one capture week; callers reject stale captures. */
export const mergeJuniorRosterRecord = (
    existing: JuniorRecord | undefined,
    teamId: number,
    entry: JuniorRosterEntry,
    week: number
): JuniorRecord => ({
    ...(existing ?? emptyRecord(teamId, entry.id)),
    nativeTalent: entry.talent,
    nativeTalentWeek: week,
    weeksLeft: entry.weeksLeft
});
