import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({ fetchTodayInfo: vi.fn(), fetchTrainingData: vi.fn() }));
vi.mock('./storageClient', () => ({
    ensureStorageReady: vi.fn(),
    getWriteContext: vi.fn().mockResolvedValue({teamId:9001,epoch:"epoch-1"}),
    getLastSyncWeek: vi.fn(),
    saveWeekData: vi.fn(),
    isWeekSynced: vi.fn(),
    markWeekEmpty: vi.fn(),
}));
vi.mock('./gapDetector', () => ({ reconcileGaps: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../utils/scheduleIdle', () => ({ scheduleIdle: vi.fn() }));

import { syncData, MAX_WEEKS_TO_FETCH } from './sync';
import { fetchTodayInfo, fetchTrainingData } from './apiClient';
import { getWriteContext, getLastSyncWeek, isWeekSynced, markWeekEmpty, saveWeekData } from './storageClient';

const CURRENT_WEEK = 100;
const OLDEST_WITH_DATA = 91; // weeks below this return no players

const fetchedWeeks = () => vi.mocked(fetchTrainingData).mock.calls.map(([w]) => w);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('syncData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchTodayInfo).mockResolvedValue({week:CURRENT_WEEK,teamId:9001} as never);
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
        expect(vi.mocked(markWeekEmpty).mock.calls.map(([,w]) => w)).toEqual(range(CURRENT_WEEK - 29, OLDEST_WITH_DATA - 1));
        expect(vi.mocked(saveWeekData).mock.calls.map(([,w]) => w)).toEqual(range(OLDEST_WITH_DATA, CURRENT_WEEK));
    });

    it('never marks the current week as empty', async () => {
        vi.mocked(fetchTrainingData).mockResolvedValue([] as never);
        await syncData();
        expect(markWeekEmpty).not.toHaveBeenCalledWith(expect.anything(), CURRENT_WEEK);
    });

    it('skips past weeks already synced or marked empty', async () => {
        vi.mocked(isWeekSynced).mockImplementation(async (_team: number, week: number) => week < OLDEST_WITH_DATA);
        await syncData();
        expect(fetchedWeeks()).toEqual(range(OLDEST_WITH_DATA, CURRENT_WEEK));
        expect(markWeekEmpty).not.toHaveBeenCalled();
    });
});

describe('first-team epoch ownership', () => {
    it('passes one captured context to every write in a run', async () => {
        vi.clearAllMocks();
        const ctx = {teamId:9001,epoch:'captured-epoch'};
        vi.mocked(getWriteContext).mockResolvedValue(ctx);
        vi.mocked(fetchTodayInfo).mockResolvedValue({week:CURRENT_WEEK,teamId:9001} as never);
        vi.mocked(getLastSyncWeek).mockResolvedValue(null);
        vi.mocked(isWeekSynced).mockResolvedValue(false);
        vi.mocked(fetchTrainingData).mockResolvedValue([{id:101}] as never);
        await syncData();
        expect(getWriteContext).toHaveBeenCalledExactlyOnceWith(9001);
        expect(saveWeekData).toHaveBeenCalledTimes(30);
        expect(vi.mocked(saveWeekData).mock.calls.every(([captured])=>captured===ctx)).toBe(true);
        expect(getLastSyncWeek).toHaveBeenCalledWith(9001);
        expect(isWeekSynced).toHaveBeenCalledWith(9001,CURRENT_WEEK-1);
    });
    it('does not refresh its context to accept a late report after another tab clears data', async () => {
        vi.clearAllMocks();
        let finish!: (value:never)=>void;
        vi.mocked(fetchTodayInfo).mockResolvedValue({week:CURRENT_WEEK,teamId:9001} as never);
        vi.mocked(getWriteContext).mockResolvedValue({teamId:9001,epoch:'before-clear'});
        vi.mocked(getLastSyncWeek).mockResolvedValue(null);
        vi.mocked(isWeekSynced).mockResolvedValue(false);
        vi.mocked(fetchTrainingData).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
        vi.mocked(saveWeekData).mockRejectedValueOnce(new Error('STALE_EPOCH'));
        const run=syncData();const assertion=expect(run).rejects.toThrow('STALE_EPOCH');
        await vi.waitFor(()=>expect(fetchTrainingData).toHaveBeenCalledOnce());
        // A clear in another document changes the transactional epoch while the report is pending.
        vi.mocked(getWriteContext).mockResolvedValue({teamId:9001,epoch:'after-clear'});
        finish([{id:101}] as never);await assertion;
        expect(saveWeekData).toHaveBeenCalledWith({teamId:9001,epoch:'before-clear'},CURRENT_WEEK-29,[{id:101}]);
        expect(getWriteContext).toHaveBeenCalledOnce();expect(markWeekEmpty).not.toHaveBeenCalled();
    });
});
