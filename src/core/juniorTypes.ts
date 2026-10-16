/** A level reported by Sokker's junior graph, with its original x coordinate. */
export interface JuniorPoint {
    x: number;
    y: number;
    scale?: number;
    source: 'graph';
}

/** Current-roster fields needed for ownership and Sokker's own talent value. */
export interface JuniorRosterEntry {
    id: number;
    teamId: number;
    talent: number | null;
    weeksLeft: number | null;
}

export type JuniorResolution = 'graph' | 'absent' | 'unknown';

export interface JuniorRecord {
    teamId: number;
    juniorId: number;
    points: JuniorPoint[];
    nativeTalent: number | null;
    nativeTalentWeek: number | null;
    /** Remaining academy weeks from the roster capture; absent in older v3 records. */
    weeksLeft?: number | null;
    /** Last game week whose graph was persisted; absent in older v3 records. */
    graphWeek?: number | null;
    resolvedWeek: number | null;
    resolution: JuniorResolution | null;
}

export interface JuniorRosterSnapshot {
    teamId: number;
    week: number;
    ids: number[];
    complete: boolean;
    /** Newer snapshots include weeksLeft, even when an individual value is unavailable. */
    weeksLeftCaptured?: boolean;
}
