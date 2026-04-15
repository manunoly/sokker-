/**
 * pure fetch wrappers for sokker.org API
 */
import { RosterPlayer, RosterResponse, SokkerResponse } from '../types/index';

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
