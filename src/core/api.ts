/**
 * pure fetch wrappers for sokker.org API
 */
import { RosterPlayer, RosterResponse, SokkerResponse } from '../types/index';
import type { JuniorPoint, JuniorRosterEntry } from './juniorTypes';

const BASE_URL: string = location.origin + '/api'; // Assumes running on sokker.org

export interface TodayInfo {
    season: number;
    week: number;
    seasonWeek: number;
    day: number;
    date: {
        value: string;
        timestamp: number;
    };
    teamId: number;
}

/**
 * Fetches the current day/week info + the user's team id.
 * @returns {Promise<TodayInfo>}
 */
export async function fetchTodayInfo(): Promise<TodayInfo> {
    try {
        const response = await fetch(`${BASE_URL}/current`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        const today = data.today;
        const teamId = data?.team?.id;
        if (typeof teamId !== 'number') throw new Error('Missing team.id in /current response');
        return { ...today, teamId };
    } catch (error) {
        console.error('Failed to fetch today info:', error);
        throw error;
    }
}

/**
 * Fetches the current game week.
 * @returns {Promise<number>} The current week number.
 */
export async function fetchCurrentWeek(): Promise<number> {
    const info = await fetchTodayInfo();
    return info.week;
}

/**
 * Fetches training data for a specific week.
 * @param {number} week - The week number to fetch.
 * @returns {Promise<SokkerResponse['players']>} Array of player training reports.
 */
export async function fetchTrainingData(week: number): Promise<SokkerResponse['players']> {
    try {
        const response = await fetch(`${BASE_URL}/training?filter[week]=${week}`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        return data.players || [];
    } catch (error) {
        console.error(`Failed to fetch training data for week ${week}:`, error);
        throw error;
    }
}

/**
 * Fetches the current roster of a team (all players currently owned).
 * Used by Pipeline B (gap detector) to know which players deserve carry-over
 * entries when they are missing from a training report.
 * @param {number} teamId
 * @returns {Promise<RosterPlayer[]>}
 */
export async function fetchRoster(teamId: number): Promise<RosterPlayer[]> {
    try {
        const url = `${BASE_URL}/player?filter[team]=${teamId}&filter[limit]=200&filter[offset]=0`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = (await response.json()) as RosterResponse;
        return Array.isArray(data.players) ? data.players : [];
    } catch (error) {
        console.error(`Failed to fetch roster for team ${teamId}:`, error);
        throw error;
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveId(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** Fetches the current junior roster; malformed responses never become an empty roster. */
export async function fetchJuniorRoster(signal?: AbortSignal): Promise<JuniorRosterEntry[]> {
    const url = `${BASE_URL}/junior?filter[limit]=100`;
    const response = signal ? await fetch(url, { signal }) : await fetch(url);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data: unknown = await response.json();
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
    const url = `${BASE_URL}/junior/${juniorId}/graph`;
    const response = signal ? await fetch(url, { signal }) : await fetch(url);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data: unknown = await response.json();
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
