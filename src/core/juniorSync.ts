import { fetchJuniorGraph, fetchJuniorRoster } from './apiClient';
import {
    getJuniorRosterSnapshot,
    getWriteContext,
    saveJuniorGraph,
    saveJuniorResolution,
    saveJuniorRosterSnapshot
} from './storageClient';
import type { JuniorRosterSnapshot } from './juniorTypes';

export type JuniorSyncState = 'idle' | 'queued' | 'loading' | 'error';

export interface JuniorSyncInput {
    teamId: number;
    week: number;
    kind: 'report' | 'academy';
    ids: readonly number[];
}

interface SyncRequest extends JuniorSyncInput {
    /** Manual synchronization refreshes the whole current roster, even after a prior attempt. */
    currentRoster?: boolean;
}

const states = new Map<string, JuniorSyncState>();
const listeners = new Set<(teamId: number, juniorId: number) => void>();
const attempted = new Set<string>();
const rosterChecked = new Set<string>();
const activeWrites = new Set<Promise<unknown>>();
const activeControllers = new Set<AbortController>();
let routeEpoch = 0;
let dataEpoch = 0;
let coordinatorTail: Promise<void> = Promise.resolve();

const juniorKey = (teamId: number, juniorId: number): string => `${teamId}:${juniorId}`;
const attemptKey = (teamId: number, week: number, kind: JuniorSyncInput['kind'], juniorId: number): string =>
    `${teamId}:${week}:${kind}:${juniorId}`;

function notify(teamId: number, juniorId: number): void {
    for (const listener of listeners) {
        try { listener(teamId, juniorId); } catch (error) {
            console.error('Junior update listener failed:', error);
        }
    }
}

function setState(teamId: number, juniorId: number, state: JuniorSyncState): void {
    const key = juniorKey(teamId, juniorId);
    if ((states.get(key) ?? 'idle') === state) return;
    if (state === 'idle') states.delete(key);
    else states.set(key, state);
    notify(teamId, juniorId);
}

export function getJuniorSyncState(teamId: number, juniorId: number): JuniorSyncState {
    return states.get(juniorKey(teamId, juniorId)) ?? 'idle';
}

export function subscribeJuniorUpdates(listener: (teamId: number, juniorId: number) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Stop work waiting in the graph queue when the eligible route is left. */
export function cancelQueuedJuniorSync(): void {
    routeEpoch += 1;
    attempted.clear();
    rosterChecked.clear();
    for (const [key, state] of states) {
        if (state !== 'queued') continue;
        states.delete(key);
        const [teamId, juniorId] = key.split(':').map(Number);
        notify(teamId, juniorId);
    }
}

/** Ignore late network responses and await writes already started before clear or restore. */
export function invalidateJuniorSync(): Promise<void> {
    dataEpoch += 1;
    cancelQueuedJuniorSync();
    for (const controller of activeControllers) controller.abort();
    activeControllers.clear();
    // Old fetch promises may ignore abort; they must not hold the next route's queue.
    coordinatorTail = Promise.resolve();
    for (const key of states.keys()) {
        states.delete(key);
        const [teamId, juniorId] = key.split(':').map(Number);
        notify(teamId, juniorId);
    }
    return Promise.allSettled([...activeWrites]).then(() => undefined);
}

function isCurrent(route: number, data: number): boolean {
    return route === routeEpoch && data === dataEpoch;
}

function hasCurrentData(data: number): boolean {
    return data === dataEpoch;
}

function trackWrite<T>(write: Promise<T>): Promise<T> {
    activeWrites.add(write);
    void write.then(
        () => { activeWrites.delete(write); },
        () => { activeWrites.delete(write); }
    );
    return write;
}

async function runSync(input: SyncRequest, route: number, data: number): Promise<void> {
    if (!isCurrent(route, data)) return;
    const { teamId, week, kind } = input;
    const manual = input.currentRoster === true;
    const ids = [...new Set(input.ids)];
    if (ids.length === 0 && !manual) return;

    const controller = new AbortController();
    activeControllers.add(controller);
    let pending: number[] = ids;
    try {
        const ctx = await getWriteContext(teamId);
        if (!isCurrent(route, data)) return;
        // A successful capture earlier this week can predate training. Only reuse
        // attempts from this page visit, never a persisted weekly graph marker.
        pending = ids.filter(id => !attempted.has(attemptKey(teamId, week, kind, id)));
        if (pending.length === 0 && !manual) return;
        for (const id of pending) {
            attempted.add(attemptKey(teamId, week, kind, id));
            setState(teamId, id, 'queued');
        }

        let snapshot = await getJuniorRosterSnapshot(teamId);
        if (!isCurrent(route, data)) return;
        const rosterKey = `${teamId}:${week}`;
        if (snapshot?.week !== week || !rosterChecked.has(rosterKey) || manual) snapshot = null;

        // A newly visible ID missing from a saved snapshot may have entered this week.
        if (!snapshot || pending.some((id) => !snapshot!.ids.includes(id))) {
            const roster = await fetchJuniorRoster(controller.signal);
            if (!isCurrent(route, data)) return;
            if (roster.some((entry) => entry.teamId !== teamId)) {
                throw new Error('Junior roster belongs to another team');
            }
            if (manual) {
                pending = roster.map(entry => entry.id);
                for (const id of pending) {
                    // Avoid a duplicate automatic request after the manual write.
                    for (const source of ['academy', 'report'] as const) attempted.add(attemptKey(teamId, week, source, id));
                    setState(teamId, id, 'queued');
                }
            }
            snapshot = {
                teamId,
                week,
                ids: roster.map((entry) => entry.id),
                complete: roster.length < 100,
                weeksLeftCaptured: true
            } satisfies JuniorRosterSnapshot;
            await trackWrite(saveJuniorRosterSnapshot(ctx, snapshot, roster));
            if (!isCurrent(route, data)) return;
            rosterChecked.add(rosterKey);
            for (const id of pending) notify(teamId, id);
        }

        const rosterIds = new Set(snapshot.ids);
        const graphIds: number[] = [];
        const resolutionSaves: Promise<void>[] = [];
        for (const id of pending) {
            if (rosterIds.has(id) || kind === 'academy') {
                graphIds.push(id);
            } else {
                resolutionSaves.push(trackWrite(saveJuniorResolution(
                    ctx, id, week, snapshot.complete ? 'absent' : 'unknown'
                )).then(() => { if (isCurrent(route, data)) setState(teamId, id, 'idle'); })
                    .catch(() => { if (isCurrent(route, data)) setState(teamId, id, 'error'); }));
            }
        }
        await Promise.all(resolutionSaves);
        if (!isCurrent(route, data)) return;

        for (const id of graphIds) setState(teamId, id, 'queued');
        let next = 0;
        let failed = 0;
        const worker = async (): Promise<void> => {
            while (isCurrent(route, data) && next < graphIds.length) {
                const id = graphIds[next++];
                setState(teamId, id, 'loading');
                try {
                    const points = await fetchJuniorGraph(id, controller.signal);
                    if (!hasCurrentData(data)) return;
                    await trackWrite(saveJuniorGraph(ctx, id, week, points));
                    if (!hasCurrentData(data)) return;
                    setState(teamId, id, 'idle');
                } catch {
                    if (hasCurrentData(data)) { failed += 1; setState(teamId, id, 'error'); }
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(3, graphIds.length) }, () => worker()));
        if (manual && failed > 0) throw new Error(`Junior synchronization failed for ${failed} graph(s). Retry synchronization.`);
    } catch (error) {
        if (!isCurrent(route, data)) return;
        for (const id of pending) {
            attempted.add(attemptKey(teamId, week, kind, id));
            // A partial manual failure must not turn successfully saved graphs into errors.
            if (!manual || getJuniorSyncState(teamId, id) !== 'idle') setState(teamId, id, 'error');
        }
        if (manual) throw error;
    } finally {
        activeControllers.delete(controller);
    }
}

function enqueueSync(input: SyncRequest): Promise<void> {
    if (!Number.isSafeInteger(input.teamId) || input.teamId <= 0 ||
        !Number.isSafeInteger(input.week) || input.week <= 0 ||
        input.ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        return Promise.reject(new Error('Invalid junior sync input'));
    }
    const route = routeEpoch;
    const data = dataEpoch;
    const next = coordinatorTail.then(async () => {
        await runSync(input, route, data);
        if (input.currentRoster && !isCurrent(route, data)) throw new Error('The Sokker page or history changed; retry synchronization.');
    });
    coordinatorTail = next.catch(() => undefined);
    return next;
}

/** Refresh visible juniors once per visit, sharing the serialized coordinator across renders. */
export function syncVisibleJuniors(input: JuniorSyncInput): Promise<void> {
    return enqueueSync(input);
}

/** Explicit synchronization also works on first-team pages with no visible junior rows. */
export function syncCurrentJuniors(input: { teamId: number; week: number }): Promise<void> {
    return enqueueSync({ ...input, kind: 'academy', ids: [], currentRoster: true });
}
