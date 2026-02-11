/**
 * pure fetch wrappers for sokker.org API
 */
import { SokkerResponse } from '../types/index';

const BASE_URL: string = location.origin + '/api'; // Assumes running on sokker.org

/**
 * Fetches the current game week.
 * @returns {Promise<number>} The current week number.
 */
export async function fetchCurrentWeek(): Promise<number> {
    try {
        const response = await fetch(`${BASE_URL}/current`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        return data.today.week;
    } catch (error) {
        console.error('Failed to fetch current week:', error);
        throw error;
    }
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
