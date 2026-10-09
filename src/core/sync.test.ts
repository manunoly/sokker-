import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({ fetchCurrentWeek: vi.fn(), fetchTrainingData: vi.fn() }));
vi.mock('./repository', () => ({
    initDB: vi.fn(),
    getLastSyncWeek: vi.fn(),
    saveWeekData: vi.fn(),
    isWeekSynced: vi.fn(),
    markWeekEmpty: vi.fn(),
}));
vi.mock('./gapDetector', () => ({ reconcileGaps: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../utils/scheduleIdle', () => ({ scheduleIdle: vi.fn() }));

import { syncData, MAX_WEEKS_TO_FETCH } from './sync';
import { fetchCurrentWeek, fetchTrainingData } from './api';
import { getLastSyncWeek, isWeekSynced, markWeekEmpty, saveWeekData } from './repository';

const CURRENT_WEEK = 100;
const OLDEST_WITH_DATA = 91; // weeks below this return no players

const fetchedWeeks = () => vi.mocked(fetchTrainingData).mock.calls.map(([w]) => w);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('syncData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchCurrentWeek).mockResolvedValue(CURRENT_WEEK);
        vi.mocked(getLastSyncWeek).mockResolvedValue(null);
        vi.mocked(isWeekSynced).mockResolvedValue(false);
        vi.mocked(fetchTrainingData).mockImplementation(async (week: number) =>
            (week >= OLDEST_WITH_DATA ? [{ id: week }] : []) as never
        );
    });

    it('requests up to 30 weeks back, including the current week', async () => {
        expect(MAX_WEEKS_TO_FETCH).toBe(30);
        await syncData();
        expect(fetchedWeeks()).toEqual(range(CURRENT_WEEK - 29, CURRENT_WEEK));
    });

    it('marks empty past weeks so they are not requested again, and saves weeks with data', async () => {
        await syncData();
        expect(vi.mocked(markWeekEmpty).mock.calls.map(([w]) => w)).toEqual(range(CURRENT_WEEK - 29, OLDEST_WITH_DATA - 1));
        expect(vi.mocked(saveWeekData).mock.calls.map(([w]) => w)).toEqual(range(OLDEST_WITH_DATA, CURRENT_WEEK));
    });

    it('never marks the current week as empty', async () => {
        vi.mocked(fetchTrainingData).mockResolvedValue([] as never);
        await syncData();
        expect(markWeekEmpty).not.toHaveBeenCalledWith(CURRENT_WEEK);
    });

    it('skips past weeks already synced or marked empty', async () => {
        vi.mocked(isWeekSynced).mockImplementation(async (week: number) => week < OLDEST_WITH_DATA);
        await syncData();
        expect(fetchedWeeks()).toEqual(range(OLDEST_WITH_DATA, CURRENT_WEEK));
        expect(markWeekEmpty).not.toHaveBeenCalled();
    });
});
