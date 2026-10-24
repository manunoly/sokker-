import type { PlayerHistoryEntry, SnapshotSource } from '../types/index';

export type PlayerSkill =
    | 'stamina' | 'pace' | 'technique' | 'passing'
    | 'keeper' | 'defending' | 'playmaking' | 'striker';

export const PLAYER_SKILL_COLUMNS = [
    ['stamina', 'pace', 'technique', 'passing'],
    ['keeper', 'defending', 'playmaking', 'striker'],
] as const satisfies readonly (readonly PlayerSkill[])[];

export interface PlayerTimelineRow {
    entry: PlayerHistoryEntry;
    reportWeek: number;
    observedWeek: number;
    source: SnapshotSource;
    dateReliable: boolean;
    /** A distant report stamped on the latest capture day; kept for the table, omitted from analysis. */
    dateEcho?: boolean;
}

export interface PlayerSkillPoint {
    week: number;
    reportWeek: number;
    level: number;
    source: SnapshotSource;
    injured: boolean;
    /** False when the calendar date was invalid and the stored report week was used. */
    dateReliable?: boolean;
}

interface ParsedDate {
    weekday: number;
    timestamp: number;
}

/** Parse the written calendar date, never the host's local calendar day. */
export function parseCaptureDate(value: string): ParsedDate | null {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.+)?$/.exec(value);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const midnight = new Date(Date.UTC(year, month - 1, day));
    if (midnight.getUTCFullYear() !== year || midnight.getUTCMonth() !== month - 1 || midnight.getUTCDate() !== day) {
        return null;
    }

    const timestamp = match[0].length === 10 ? midnight.getTime() : Date.parse(value);
    return Number.isFinite(timestamp) ? { weekday: midnight.getUTCDay(), timestamp } : null;
}

function sourcePriority(source: SnapshotSource): number {
    if (source === 'training') return 3;
    return source === 'carried-over' ? 2 : 1;
}

function timestampOf(row: PlayerTimelineRow): number {
    return row.dateReliable ? parseCaptureDate(row.entry.date)?.timestamp ?? -Infinity : -Infinity;
}

/** Prefer an actual report, then the latest dated capture, then the later stored report. */
function prefer(candidate: PlayerTimelineRow, current: PlayerTimelineRow): boolean {
    const priority = sourcePriority(candidate.source) - sourcePriority(current.source);
    if (priority !== 0) return priority > 0;
    const timestamp = timestampOf(candidate) - timestampOf(current);
    if (timestamp !== 0 && !Number.isNaN(timestamp)) return timestamp > 0;
    return candidate.reportWeek >= current.reportWeek;
}

/** Normalize stored reports without changing the report week shown in the table or CSV. */
export function preparePlayerTimeline(history: readonly PlayerHistoryEntry[]): PlayerTimelineRow[] {
    const byReportWeek = new Map<number, PlayerTimelineRow>();
    for (const entry of history) {
        if (!Number.isSafeInteger(entry.week) || entry.week <= 0) continue;
        const date = parseCaptureDate(entry.date);
        const observedWeek = date && date.weekday !== 4 && date.weekday !== 5 ? entry.week - 1 : entry.week;
        const row: PlayerTimelineRow = {
            entry,
            reportWeek: entry.week,
            observedWeek,
            source: entry.source ?? 'training',
            dateReliable: date !== null,
            dateEcho: false,
        };
        const previous = byReportWeek.get(row.reportWeek);
        if (!previous || prefer(row, previous)) byReportWeek.set(row.reportWeek, row);
    }

    const rows = [...byReportWeek.values()].sort((a, b) => a.reportWeek - b.reportWeek);
    const latest = rows.reduce<PlayerTimelineRow | null>((best, row) => {
        if (!row.dateReliable) return best;
        if (!best || row.observedWeek > best.observedWeek) return row;
        return row.observedWeek === best.observedWeek && timestampOf(row) > timestampOf(best) ? row : best;
    }, null);

    if (latest) {
        const latestTimestamp = timestampOf(latest);
        for (const row of rows) {
            if (!row.dateReliable || row.observedWeek >= latest.observedWeek - 1) continue;
            row.dateEcho = Math.abs(latestTimestamp - timestampOf(row)) < 24 * 60 * 60 * 1000;
        }
    }
    return rows;
}

/** Return chart observations in game-week order; inferred sources remain explicitly tagged. */
export function observedSkillPoints(rows: readonly PlayerTimelineRow[], skill: PlayerSkill): PlayerSkillPoint[] {
    const byObservedWeek = new Map<number, { row: PlayerTimelineRow; level: number }>();
    for (const row of rows) {
        if (row.dateEcho || !Number.isSafeInteger(row.observedWeek) || row.observedWeek <= 0) continue;
        const level = row.entry.skills?.[skill];
        if (!Number.isInteger(level) || level < 0 || level > 18) continue;
        const current = byObservedWeek.get(row.observedWeek);
        if (!current || prefer(row, current.row)) byObservedWeek.set(row.observedWeek, { row, level });
    }

    return [...byObservedWeek.entries()]
        .sort(([a], [b]) => a - b)
        .map(([week, { row, level }]) => ({
            week,
            reportWeek: row.reportWeek,
            level,
            source: row.source,
            injured: row.entry.injured === true,
            dateReliable: row.dateReliable,
        }));
}
