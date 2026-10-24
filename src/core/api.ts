/**
 * pure fetch wrappers for sokker.org API
 */
import type { RosterPlayer, SokkerResponse } from '../types/index';
import type { JuniorPoint, JuniorRosterEntry } from './juniorTypes';

export { type TodayInfo } from './apiTypes';
import type { TodayInfo } from './apiTypes';

export const BASE_URL = 'https://sokker.org/api';

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveId(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function finite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function integer(value: unknown, minimum = 0): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function requirePositiveId(value: unknown, name: string): asserts value is number {
    if (!isPositiveId(value)) throw new Error(`Invalid ${name}`);
}

/** All network IO runs in the worker, using the existing canonical session. */
async function getJson(path: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    signal?.throwIfAborted();
    const response = await fetch(`${BASE_URL}${path}`, { method: 'GET', credentials: 'include', ...(signal ? { signal } : {}) });
    signal?.throwIfAborted();
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
        throw new Error('Invalid API response: expected JSON (session may have expired)');
    }
    const data: unknown = await response.json();
    signal?.throwIfAborted();
    if (!isObject(data)) throw new Error('Invalid API response: expected an object');
    return data;
}

/**
 * Fetches the current day/week info + the user's team id.
 * @returns {Promise<TodayInfo>}
 */
export async function fetchTodayInfo(signal?: AbortSignal): Promise<TodayInfo> {
    const data = await getJson('/current', signal);
    const today = data.today;
    if (!isObject(today) || !integer(today.season) || !isPositiveId(today.week)
        || !integer(today.seasonWeek) || !integer(today.day)
        || !isObject(today.date) || typeof today.date.value !== 'string'
        || !Number.isFinite(Date.parse(today.date.value)) || !finite(today.date.timestamp)
        || !isObject(data.team) || !isPositiveId(data.team.id)) {
        throw new Error('Invalid /current response: missing or malformed today/team');
    }
    return { season: today.season, week: today.week, seasonWeek: today.seasonWeek,
        day: today.day, date: { value: today.date.value, timestamp: today.date.timestamp }, teamId: data.team.id };
}

/**
 * Fetches the current game week.
 * @returns {Promise<number>} The current week number.
 */
export async function fetchCurrentWeek(signal?: AbortSignal): Promise<number> {
    const info = await fetchTodayInfo(signal);
    return info.week;
}

/**
 * Fetches training data for a specific week.
 * @param {number} week - The week number to fetch.
 * @returns {Promise<SokkerResponse['players']>} Array of player training reports.
 */
export async function fetchTrainingData(week: number, signal?: AbortSignal): Promise<SokkerResponse['players']> {
    requirePositiveId(week, 'week');
    const data = await getJson(`/training?filter[week]=${week}`, signal);
    if (!Array.isArray(data.players)) throw new Error('Invalid /training response: missing players array');
    for (const entry of data.players) {
        if (!isObject(entry) || !isPositiveId(entry.id) || !isObject(entry.player)
            || !isObject(entry.player.name) || typeof entry.player.name.full !== 'string') {
            throw new Error('Invalid /training response: malformed player');
        }
        // Missing reports are valid Sokker entries, skipped by the existing persistence rule.
        if (entry.report === undefined || entry.report === null) continue;
        const report = entry.report;
        if (!isObject(report)) throw new Error('Invalid /training response: malformed report');
        if (isObject(report.kind) && (report.kind.name === 'missing' || report.kind.code === 3)) continue;
        if (report.week !== week || !isObject(report.skills) || Object.keys(report.skills).length === 0
            || !Object.values(report.skills).every(finite) || !isObject(report.day)
            || !isObject(report.day.date) || typeof report.day.date.value !== 'string'
            || !Number.isFinite(Date.parse(report.day.date.value))
            || !isObject(report.playerValue) || !finite(report.playerValue.value)) {
            throw new Error('Invalid /training response: malformed report');
        }
    }
    return data.players as SokkerResponse['players'];
}

/**
 * Fetches the current roster of a team (all players currently owned).
 * Used by Pipeline B (gap detector) to know which players deserve carry-over
 * entries when they are missing from a training report.
 * @param {number} teamId
 * @returns {Promise<RosterPlayer[]>}
 */
export async function fetchRoster(teamId: number, signal?: AbortSignal): Promise<RosterPlayer[]> {
    requirePositiveId(teamId, 'team ID');
    const data = await getJson(`/player?filter[team]=${teamId}&filter[limit]=200&filter[offset]=0`, signal);
    if (!Array.isArray(data.players)) throw new Error('Invalid /player response: missing players array');
    for (const player of data.players) {
        if (!isObject(player) || !isPositiveId(player.id) || !isObject(player.info)
            || !isObject(player.info.name) || typeof player.info.name.full !== 'string'
            || !isObject(player.info.skills) || Object.keys(player.info.skills).length === 0
            || !Object.values(player.info.skills).every(finite)) {
            throw new Error('Invalid /player response: malformed player');
        }
    }
    return data.players as RosterPlayer[];
}

/** Fetches the current junior roster; malformed responses never become an empty roster. */
export async function fetchJuniorRoster(signal?: AbortSignal): Promise<JuniorRosterEntry[]> {
    const data = await getJson('/junior?filter[limit]=100', signal);
    if (!isObject(data) || !Array.isArray(data.juniors)) {
        throw new Error('Invalid /junior response: missing juniors array');
    }

    const roster: JuniorRosterEntry[] = [];
    const seenIds = new Set<number>();
    let rosterTeamId: number | null = null;
    for (const raw of data.juniors) {
        if (!isObject(raw) || !isPositiveId(raw.id) || !isPositiveId(raw.teamId)) {
            throw new Error('Invalid /junior response: malformed junior ID or team ID');
        }
        if (seenIds.has(raw.id) || (rosterTeamId !== null && raw.teamId !== rosterTeamId)) {
            throw new Error('Invalid /junior response: duplicate junior or mixed teams');
        }
        const talent = raw.talent === undefined || raw.talent === null ? null : raw.talent;
        if (talent !== null && (typeof talent !== 'number' || !Number.isFinite(talent))) {
            throw new Error('Invalid /junior response: malformed talent');
        }
        const weeksLeft = typeof raw.weeksLeft === 'number' && Number.isSafeInteger(raw.weeksLeft)
            && raw.weeksLeft >= 0 ? raw.weeksLeft : null;
        rosterTeamId = raw.teamId;
        seenIds.add(raw.id);
        roster.push({ id: raw.id, teamId: raw.teamId, talent, weeksLeft });
    }
    return roster;
}

/** Fetches a junior's observed levels, preserving Sokker's original x values. */
export async function fetchJuniorGraph(juniorId: number, signal?: AbortSignal): Promise<JuniorPoint[]> {
    if (!isPositiveId(juniorId)) throw new Error('Invalid junior ID');
    const data = await getJson(`/junior/${juniorId}/graph`, signal);
    if (!isObject(data) || data.juniorId !== juniorId || !Array.isArray(data.values)) {
        throw new Error('Invalid junior graph response: ID mismatch or missing values array');
    }

    return data.values.map((raw: unknown): JuniorPoint => {
        if (!isObject(raw) || typeof raw.x !== 'number' || !Number.isSafeInteger(raw.x)
            || typeof raw.y !== 'number' || !Number.isFinite(raw.y) || raw.y < 0 || raw.y > 18) {
            throw new Error('Invalid junior graph response: malformed point');
        }
        if (raw.scale !== undefined && (typeof raw.scale !== 'number' || !Number.isFinite(raw.scale))) {
            throw new Error('Invalid junior graph response: malformed scale');
        }
        return raw.scale === undefined
            ? { x: raw.x, y: raw.y, source: 'graph' }
            : { x: raw.x, y: raw.y, scale: raw.scale, source: 'graph' };
    });
}
