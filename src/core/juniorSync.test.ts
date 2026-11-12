import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJuniorGraph, fetchJuniorRoster } from './apiClient';
import {
    getJuniorRosterSnapshot, getWriteContext, saveJuniorGraph, saveJuniorResolution,
    saveJuniorRosterSnapshot
} from './storageClient';
import type { JuniorPoint, JuniorRecord, JuniorRosterEntry, JuniorRosterSnapshot } from './juniorTypes';
import { mergeJuniorGraphRecord } from './juniorRepository';
import {
    cancelQueuedJuniorSync, getJuniorSyncState, invalidateJuniorSync,
    subscribeJuniorUpdates, syncVisibleJuniors, syncCurrentJuniors
} from './juniorSync';

vi.mock('./apiClient', () => ({ fetchJuniorRoster: vi.fn(), fetchJuniorGraph: vi.fn() }));
vi.mock('./storageClient', () => ({
    getJuniorRosterSnapshot: vi.fn(), getWriteContext: vi.fn(),
    saveJuniorRosterSnapshot: vi.fn(), saveJuniorGraph: vi.fn(), saveJuniorResolution: vi.fn()
}));

const teamId = 9001;
const point = (x: number, y: number): JuniorPoint => ({ x, y, source: 'graph' });
const roster = (...ids: number[]): JuniorRosterEntry[] =>
    ids.map((id) => ({ id, teamId, talent: 4, weeksLeft: 12 }));
const key = (id: number): string => `${teamId}:${id}`;
const record = (id: number): JuniorRecord => ({
    teamId, juniorId: id, points: [], nativeTalent: null, nativeTalentWeek: null,
    resolvedWeek: null, resolution: null
});

let records: Map<string, JuniorRecord>;
let snapshot: JuniorRosterSnapshot | null;
let persistedGeneration: string;

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

beforeEach(async () => {
    await invalidateJuniorSync();
    vi.clearAllMocks();
    records = new Map();
    snapshot = null;
    persistedGeneration = 'generation-1';
    vi.mocked(getWriteContext).mockImplementation(async () => ({teamId,epoch:persistedGeneration}));
    vi.mocked(getJuniorRosterSnapshot).mockImplementation(async () => snapshot);
    vi.mocked(saveJuniorRosterSnapshot).mockImplementation(async (ctx, value, entries) => {
        if (ctx.epoch !== persistedGeneration) throw new Error('Junior storage generation changed');
        snapshot = value;
        for (const entry of entries) {
            records.set(key(entry.id), {
                ...(records.get(key(entry.id)) ?? record(entry.id)),
                nativeTalent: entry.talent, nativeTalentWeek: value.week, weeksLeft: entry.weeksLeft
            });
        }
    });
    vi.mocked(saveJuniorGraph).mockImplementation(async (ctx, id, week, points) => {
        if (ctx.epoch !== persistedGeneration) throw new Error('Junior storage generation changed');
        records.set(key(id), mergeJuniorGraphRecord(records.get(key(id)), teamId, id, week, points));
    });
    vi.mocked(saveJuniorResolution).mockImplementation(async (ctx, id, week, resolution) => {
        if (ctx.epoch !== persistedGeneration) throw new Error('Junior storage generation changed');
        records.set(key(id), {
            ...(records.get(key(id)) ?? record(id)), resolvedWeek: week, resolution
        });
    });
    vi.mocked(fetchJuniorRoster).mockResolvedValue(roster(101));
    vi.mocked(fetchJuniorGraph).mockResolvedValue([point(10, 5)]);
});

describe('weekly junior synchronization', () => {
    it('refreshes a pre-training capture on entry in the same week and deduplicates renders', async () => {
        records.set(key(101), {
            ...record(101), points: [point(10, 13)], nativeTalentWeek: 1213, weeksLeft: 4,
            resolvedWeek: 1213, resolution: 'graph'
        });
        snapshot = { teamId, week: 1213, ids: [101], complete: true, weeksLeftCaptured: true };
        vi.mocked(fetchJuniorRoster).mockResolvedValue([{ id: 101, teamId, talent: 4, weeksLeft: 3 }]);
        vi.mocked(fetchJuniorGraph).mockResolvedValue([point(10, 14)]);
        const input = { teamId, week: 1213, kind: 'academy' as const, ids: [101] };

        await syncVisibleJuniors(input);
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(1);
        expect(records.get(key(101))).toMatchObject({ points: [point(10, 14)], weeksLeft: 3, resolvedWeek: 1213 });

        await syncVisibleJuniors(input);
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(1);
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(1);

        cancelQueuedJuniorSync();
        vi.mocked(fetchJuniorGraph).mockResolvedValue([point(10, 15)]);
        await syncVisibleJuniors(input);
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(2);
        expect(records.get(key(101))?.points).toEqual([point(10, 15)]);
    });

    it('rechecks membership on reentry without requesting a departed report junior graph', async () => {
        records.set(key(101), {
            ...record(101), points: [point(10, 5)], nativeTalentWeek: 1213,
            resolvedWeek: 1213, resolution: 'graph'
        });
        snapshot = { teamId, week: 1213, ids: [101], complete: true };
        vi.mocked(fetchJuniorRoster).mockResolvedValue([]);
        const input = { teamId, week: 1213, kind: 'report' as const, ids: [101] };

        await syncVisibleJuniors(input);
        cancelQueuedJuniorSync();
        await syncVisibleJuniors(input);

        expect(fetchJuniorRoster).toHaveBeenCalledTimes(2);
        expect(fetchJuniorGraph).not.toHaveBeenCalled();
        expect(snapshot?.weeksLeftCaptured).toBe(true);
    });

    it('passes one captured write generation to roster, resolution and graph writes', async () => {
        await syncVisibleJuniors({ teamId, week: 1213, kind: 'report', ids: [101, 102] });
        expect(getWriteContext).toHaveBeenCalledTimes(1);
        expect(saveJuniorRosterSnapshot).toHaveBeenCalledWith(
            { teamId, epoch: 'generation-1' }, expect.objectContaining({ teamId, week: 1213 }), roster(101)
        );
        expect(saveJuniorResolution).toHaveBeenCalledWith({teamId,epoch:'generation-1'}, 102, 1213, 'absent');
        expect(saveJuniorGraph).toHaveBeenCalledWith({teamId,epoch:'generation-1'}, 101, 1213, [point(10, 5)]);
    });

    it('persists an empty graph and makes no duplicate request during the same visit', async () => {
        vi.mocked(fetchJuniorGraph).mockResolvedValue([]);
        const input = { teamId, week: 1213, kind: 'academy' as const, ids: [101] };
        await syncVisibleJuniors(input);
        expect(records.get(key(101))).toMatchObject({ points: [], resolvedWeek: 1213, resolution: 'graph' });
        await syncVisibleJuniors(input);
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(1);
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(1);
    });

    it('refreshes on a new week and on a new visible ID first seen in a report', async () => {
        await syncVisibleJuniors({ teamId, week: 1213, kind: 'report', ids: [101] });
        vi.mocked(fetchJuniorRoster).mockResolvedValue(roster(101, 102));
        await syncVisibleJuniors({ teamId, week: 1213, kind: 'report', ids: [101, 102] });
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(2);
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(2);
        expect(fetchJuniorGraph).toHaveBeenCalledWith(102, expect.any(AbortSignal));
        await syncVisibleJuniors({ teamId, week: 1213, kind: 'report', ids: [102] });
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(2);
        await syncVisibleJuniors({ teamId, week: 1214, kind: 'report', ids: [102] });
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(3);
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(3);
    });

    it('keeps a dismissed report junior and records absence only with a complete roster', async () => {
        records.set(key(102), { ...record(102), points: [point(9, 4)] });
        await syncVisibleJuniors({ teamId, week: 1213, kind: 'report', ids: [102] });
        expect(fetchJuniorGraph).not.toHaveBeenCalled();
        expect(records.get(key(102))).toMatchObject({
            points: [point(9, 4)], resolvedWeek: 1213, resolution: 'absent'
        });
        await syncVisibleJuniors({ teamId, week: 1213, kind: 'report', ids: [102] });
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(1);
    });

    it('shows queued while the roster loads, then loading or idle after membership resolves', async () => {
        const rosterResponse = deferred<JuniorRosterEntry[]>();
        const graphResponse = deferred<JuniorPoint[]>();
        vi.mocked(fetchJuniorRoster).mockReturnValue(rosterResponse.promise);
        vi.mocked(fetchJuniorGraph).mockReturnValue(graphResponse.promise);
        const running = syncVisibleJuniors({ teamId, week: 1213, kind: 'report', ids: [101, 102] });
        await vi.waitFor(() => expect(fetchJuniorRoster).toHaveBeenCalledTimes(1));
        expect(getJuniorSyncState(teamId, 101)).toBe('queued');
        expect(getJuniorSyncState(teamId, 102)).toBe('queued');
        rosterResponse.resolve(roster(101));
        await vi.waitFor(() => expect(getJuniorSyncState(teamId, 101)).toBe('loading'));
        expect(getJuniorSyncState(teamId, 102)).toBe('idle');
        expect(records.get(key(102))?.resolution).toBe('absent');
        graphResponse.resolve([point(10, 5)]);
        await running;
        expect(getJuniorSyncState(teamId, 101)).toBe('idle');
    });

    it('uses unknown for a roster at the limit and lets own-academy presence override it', async () => {
        const fullRoster = roster(...Array.from({ length: 100 }, (_, i) => i + 1));
        vi.mocked(fetchJuniorRoster).mockResolvedValue(fullRoster);
        await syncVisibleJuniors({ teamId, week: 1213, kind: 'report', ids: [102] });
        expect(records.get(key(102))?.resolution).toBe('unknown');
        await syncVisibleJuniors({ teamId, week: 1213, kind: 'academy', ids: [102] });
        expect(fetchJuniorGraph).toHaveBeenCalledWith(102, expect.any(AbortSignal));
        expect(records.get(key(102))?.resolution).toBe('graph');
    });

    it('rejects a different team and retries a failed roster only after route exit', async () => {
        vi.mocked(fetchJuniorRoster).mockResolvedValueOnce([{ id: 101, teamId: 9999, talent: 4, weeksLeft: 12 }]);
        const input = { teamId, week: 1213, kind: 'academy' as const, ids: [101] };
        await syncVisibleJuniors(input);
        expect(saveJuniorRosterSnapshot).not.toHaveBeenCalled();
        expect(getJuniorSyncState(teamId, 101)).toBe('error');
        await syncVisibleJuniors(input);
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(1);
        cancelQueuedJuniorSync();
        await syncVisibleJuniors(input);
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(2);
        expect(getJuniorSyncState(teamId, 101)).toBe('idle');
    });

    it('does not loop after a graph error and retries on the next route entry', async () => {
        vi.mocked(fetchJuniorGraph).mockRejectedValueOnce(new Error('network'));
        const input = { teamId, week: 1213, kind: 'academy' as const, ids: [101] };
        await syncVisibleJuniors(input);
        expect(getJuniorSyncState(teamId, 101)).toBe('error');
        expect(records.get(key(101))?.resolvedWeek).toBeNull();
        await syncVisibleJuniors(input);
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(1);
        cancelQueuedJuniorSync();
        await syncVisibleJuniors(input);
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(2);
        expect(records.get(key(101))?.resolvedWeek).toBe(1213);
    });

    it('does not mark graph success when another tab changed the storage generation', async () => {
        const graphResponse = deferred<JuniorPoint[]>();
        vi.mocked(fetchJuniorGraph).mockReturnValueOnce(graphResponse.promise);
        const input = { teamId, week: 1213, kind: 'academy' as const, ids: [101] };
        const running = syncVisibleJuniors(input);
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledTimes(1));
        persistedGeneration = 'generation-2';
        graphResponse.resolve([point(10, 5)]);
        await running;
        expect(saveJuniorGraph).toHaveBeenCalledWith({teamId,epoch:'generation-1'}, 101, 1213, [point(10, 5)]);
        expect(records.get(key(101))?.resolvedWeek).toBeNull();
        expect(getJuniorSyncState(teamId, 101)).toBe('error');
        cancelQueuedJuniorSync();
        await syncVisibleJuniors(input);
        expect(saveJuniorGraph).toHaveBeenLastCalledWith({teamId,epoch:'generation-2'}, 101, 1213, [point(10, 5)]);
        expect(records.get(key(101))?.resolvedWeek).toBe(1213);
    });

    it('finishes an active graph but does not start queued graphs after route exit', async () => {
        const pending = deferred<JuniorPoint[]>();
        vi.mocked(fetchJuniorRoster).mockResolvedValue(roster(1, 2, 3, 4));
        vi.mocked(fetchJuniorGraph).mockImplementation(() => pending.promise);
        const running = syncVisibleJuniors({ teamId, week: 1213, kind: 'academy', ids: [1, 2, 3, 4] });
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledTimes(3));
        cancelQueuedJuniorSync();
        expect(getJuniorSyncState(teamId, 4)).toBe('idle');
        pending.resolve([point(10, 5)]);
        await running;
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(3);
        expect(saveJuniorGraph).toHaveBeenCalledTimes(3);
        expect(getJuniorSyncState(teamId, 1)).toBe('idle');
    });

    it('limits graph fetches to three and announces queued, loading, error and save', async () => {
        const requests = Array.from({ length: 5 }, () => deferred<JuniorPoint[]>());
        vi.mocked(fetchJuniorRoster).mockResolvedValue(roster(1, 2, 3, 4, 5));
        let started = 0;
        vi.mocked(fetchJuniorGraph).mockImplementation(() => requests[started++].promise);
        const events: string[] = [];
        const unsubscribe = subscribeJuniorUpdates((team, id) => events.push(`${id}:${getJuniorSyncState(team, id)}`));
        const input = { teamId, week: 1213, kind: 'academy' as const, ids: [1, 2, 3, 4, 5] };
        const first = syncVisibleJuniors(input);
        const second = syncVisibleJuniors(input);
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledTimes(3));
        expect(getJuniorSyncState(teamId, 4)).toBe('queued');
        expect(events).toContain('4:queued');
        expect(events).toContain('1:loading');
        requests[0].resolve([point(10, 5)]);
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledTimes(4));
        requests[1].reject(new Error('network'));
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledTimes(5));
        requests[2].resolve([]);
        requests[3].resolve([]);
        requests[4].resolve([]);
        await Promise.all([first, second]);
        unsubscribe();
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(5);
        expect(events).toContain('2:error');
        expect(events).toContain('1:idle');
        expect(records.get(key(1))?.resolvedWeek).toBe(1213);
        expect(records.get(key(2))?.resolvedWeek).toBeNull();
    });

    it('cancels queued graph work and discards an in-flight response after invalidation', async () => {
        const pending = deferred<JuniorPoint[]>();
        vi.mocked(fetchJuniorRoster).mockResolvedValue(roster(1, 2, 3, 4));
        vi.mocked(fetchJuniorGraph).mockImplementation(() => pending.promise);
        const running = syncVisibleJuniors({ teamId, week: 1213, kind: 'academy', ids: [1, 2, 3, 4] });
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledTimes(3));
        expect(getJuniorSyncState(teamId, 4)).toBe('queued');
        await invalidateJuniorSync();
        pending.resolve([point(10, 5)]);
        await running;
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(3);
        expect(saveJuniorGraph).not.toHaveBeenCalled();
        expect(getJuniorSyncState(teamId, 1)).toBe('idle');
        expect(getJuniorSyncState(teamId, 4)).toBe('idle');
    });

    it('waits for an already-started database write without waiting for network responses', async () => {
        const saving = deferred<void>();
        const network = deferred<JuniorPoint[]>();
        vi.mocked(fetchJuniorRoster).mockResolvedValue(roster(1, 2));
        vi.mocked(fetchJuniorGraph).mockImplementation((id) =>
            id === 1 ? Promise.resolve([point(10, 5)]) : network.promise);
        vi.mocked(saveJuniorGraph).mockImplementation((_, id) =>
            id === 1 ? saving.promise : Promise.resolve());
        const running = syncVisibleJuniors({ teamId, week: 1213, kind: 'academy', ids: [1, 2] });
        await vi.waitFor(() => expect(saveJuniorGraph).toHaveBeenCalledTimes(1));
        let barrierSettled = false;
        const barrier = invalidateJuniorSync().then(() => { barrierSettled = true; });
        await Promise.resolve();
        expect(barrierSettled).toBe(false);
        saving.resolve();
        await barrier;
        expect(barrierSettled).toBe(true);
        // The second network request may still be in flight; it is not part of the barrier.
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(2);
        expect(saveJuniorGraph).toHaveBeenCalledTimes(1);
        network.resolve([point(11, 6)]);
        await running;
        expect(saveJuniorGraph).toHaveBeenCalledTimes(1);
    });

    it('starts a new sync after invalidation while an obsolete graph request remains pending', async () => {
        const obsolete = deferred<JuniorPoint[]>();
        vi.mocked(fetchJuniorRoster).mockResolvedValue(roster(1, 2));
        vi.mocked(fetchJuniorGraph).mockImplementation((id) =>
            id === 1 ? obsolete.promise : Promise.resolve([point(11, 6)]));

        const oldRun = syncVisibleJuniors({ teamId, week: 1213, kind: 'academy', ids: [1] });
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledTimes(1));
        const oldSignal = vi.mocked(fetchJuniorGraph).mock.calls[0][1];

        await invalidateJuniorSync();
        expect(oldSignal?.aborted).toBe(true);

        const freshRun = syncVisibleJuniors({ teamId, week: 1214, kind: 'academy', ids: [2] });
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledTimes(2));
        await freshRun;
        expect(records.get(key(2))?.resolvedWeek).toBe(1214);

        obsolete.resolve([point(10, 5)]);
        await oldRun;
        expect(saveJuniorGraph).toHaveBeenCalledTimes(1);
        expect(records.get(key(1))?.resolvedWeek).toBeNull();
    });
});

describe('manual current-roster synchronization', () => {
    it('preserves earlier history when a same-week refresh adds a new training point', async () => {
        records.set(key(101), { ...record(101), points: [point(9, 12), point(10, 13)], resolvedWeek: 1213, resolution: 'graph' });
        vi.mocked(fetchJuniorGraph).mockResolvedValue([point(10, 14), point(11, 14)]);
        await syncCurrentJuniors({ teamId, week: 1213 });
        expect(records.get(key(101))?.points).toEqual([point(9, 12), point(10, 14), point(11, 14)]);
    });

    it('keeps successful saves after a partial failure and limits manual concurrency to three', async () => {
        const graphs = Array.from({ length: 4 }, () => deferred<JuniorPoint[]>());
        vi.mocked(fetchJuniorRoster).mockResolvedValue(roster(101, 102, 103, 104));
        vi.mocked(fetchJuniorGraph).mockImplementation(id => graphs[id - 101].promise);
        const running = syncCurrentJuniors({ teamId, week: 1213 });
        const rejected = expect(running).rejects.toThrow('1 graph');
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledTimes(3));
        expect(getJuniorSyncState(teamId, 104)).toBe('queued');
        graphs[0].reject(new Error('network'));
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledTimes(4));
        for (const graph of graphs.slice(1)) graph.resolve([point(10, 14)]);
        await rejected;
        expect(getJuniorSyncState(teamId, 101)).toBe('error');
        expect(getJuniorSyncState(teamId, 102)).toBe('idle');
        expect(records.get(key(102))?.points).toEqual([point(10, 14)]);
    });

    it('rejects manual completion after route exit instead of reporting a partial run as success', async () => {
        const graph = deferred<JuniorPoint[]>();
        vi.mocked(fetchJuniorGraph).mockReturnValueOnce(graph.promise);
        const running = syncCurrentJuniors({ teamId, week: 1213 });
        const rejected = expect(running).rejects.toThrow('changed');
        await vi.waitFor(() => expect(fetchJuniorGraph).toHaveBeenCalledOnce());
        cancelQueuedJuniorSync();
        graph.resolve([point(10, 14)]);
        await rejected;
    });

    it('refreshes all roster graphs in the same week, including IDs absent from the page', async () => {
        await syncVisibleJuniors({ teamId, week: 1213, kind: 'academy', ids: [101] });
        vi.mocked(fetchJuniorRoster).mockResolvedValue(roster(101, 102));
        vi.mocked(fetchJuniorGraph).mockResolvedValue([point(10, 14)]);
        await syncCurrentJuniors({ teamId, week: 1213 });
        expect(fetchJuniorRoster).toHaveBeenCalledTimes(2);
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(3);
        expect(records.get(key(101))?.points).toEqual([point(10, 14)]);
        expect(records.get(key(102))?.points).toEqual([point(10, 14)]);
        await syncVisibleJuniors({ teamId, week: 1213, kind: 'academy', ids: [101, 102] });
        expect(fetchJuniorGraph).toHaveBeenCalledTimes(3);
    });

    it('reports roster and graph failures and allows an explicit retry', async () => {
        vi.mocked(fetchJuniorRoster).mockRejectedValueOnce(new Error('roster unavailable'));
        await expect(syncCurrentJuniors({ teamId, week: 1213 })).rejects.toThrow('roster unavailable');
        vi.mocked(fetchJuniorGraph).mockRejectedValueOnce(new Error('graph unavailable'));
        await expect(syncCurrentJuniors({ teamId, week: 1213 })).rejects.toThrow();
        expect(getJuniorSyncState(teamId, 101)).toBe('error');
        await syncCurrentJuniors({ teamId, week: 1213 });
        expect(getJuniorSyncState(teamId, 101)).toBe('idle');
    });

    it('accepts an empty roster and rejects a different team before graph requests', async () => {
        vi.mocked(fetchJuniorRoster).mockResolvedValueOnce([]);
        await syncCurrentJuniors({ teamId, week: 1213 });
        expect(fetchJuniorGraph).not.toHaveBeenCalled();
        expect(snapshot).toMatchObject({ ids: [], complete: true });
        vi.mocked(fetchJuniorRoster).mockResolvedValueOnce([{ id: 101, teamId: 9999, talent: 4, weeksLeft: 12 }]);
        await expect(syncCurrentJuniors({ teamId, week: 1213 })).rejects.toThrow('another team');
        expect(fetchJuniorGraph).not.toHaveBeenCalled();
    });
});
