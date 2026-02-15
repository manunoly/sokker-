/**
 * pure fetch wrappers for sokker.org API
 */
import { SokkerResponse } from '../types/index';

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
}

/**
 * Fetches the current day/week info.
 * @returns {Promise<TodayInfo>}
 */
export async function fetchTodayInfo(): Promise<TodayInfo> {
    try {
        const response = await fetch(`${BASE_URL}/current`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        return data.today;
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
