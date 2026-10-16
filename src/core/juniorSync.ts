import { fetchJuniorGraph, fetchJuniorRoster } from './api';
import {
    getJuniorRecords,
    getJuniorRosterSnapshot,
    getJuniorWriteGeneration,
    saveJuniorGraph,
    saveJuniorResolution,
    saveJuniorRosterSnapshot
} from './juniorRepository';
import type { JuniorRosterSnapshot } from './juniorTypes';

export type JuniorSyncState = 'idle' | 'queued' | 'loading' | 'error';

export interface JuniorSyncInput {
    teamId: number;
    week: number;
    kind: 'report' | 'academy';
    ids: readonly number[];
}

const states = new Map<string, JuniorSyncState>();
const listeners = new Set<(teamId: number, juniorId: number) => void>();
const attempted = new Set<string>();
const backfillAttempted = new Set<string>();
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
    backfillAttempted.clear();
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

async function runSync(input: JuniorSyncInput, route: number, data: number): Promise<void> {
    if (!isCurrent(route, data)) return;
    const { teamId, week, kind } = input;
    const ids = [...new Set(input.ids)];
    if (ids.length === 0) return;

    const controller = new AbortController();
    activeControllers.add(controller);
    let pending: number[] = ids;
    try {
        const writeGeneration = await getJuniorWriteGeneration();
        if (!isCurrent(route, data)) return;
        const records = await getJuniorRecords(teamId, ids);
        if (!isCurrent(route, data)) return;
        pending = ids.filter((id) => {
            const record = records.get(id);
            const resolved = record?.resolvedWeek === week &&
                (kind !== 'academy' || record.resolution === 'graph');
            return !resolved && !attempted.has(attemptKey(teamId, week, kind, id));
        });
        const backfillKey = `${teamId}:${week}`;
        const backfillIds = backfillAttempted.has(backfillKey) ? [] : ids.filter((id) => {
            const record = records.get(id);
            return record?.resolvedWeek === week && record.resolution === 'graph' &&
                record.nativeTalentWeek === week && record.weeksLeft === undefined;
        });
        if (pending.length === 0 && backfillIds.length === 0) return;
        for (const id of pending) {
            attempted.add(attemptKey(teamId, week, kind, id));
            setState(teamId, id, 'queued');
        }

        let snapshot = await getJuniorRosterSnapshot(teamId);
        if (!isCurrent(route, data)) return;
        if (snapshot?.week !== week) snapshot = null;
        const needsBackfill = backfillIds.length > 0 && snapshot?.weeksLeftCaptured !== true;
        if (pending.length === 0 && !needsBackfill) return;
        if (needsBackfill) backfillAttempted.add(backfillKey);

        // A newly visible ID missing from a saved snapshot may have entered this week.
        if (!snapshot || needsBackfill || pending.some((id) => !snapshot!.ids.includes(id))) {
            const roster = await fetchJuniorRoster(controller.signal);
            if (!isCurrent(route, data)) return;
            if (roster.some((entry) => entry.teamId !== teamId)) {
                throw new Error('Junior roster belongs to another team');
            }
            snapshot = {
                teamId,
                week,
                ids: roster.map((entry) => entry.id),
                complete: roster.length < 100,
                weeksLeftCaptured: true
            } satisfies JuniorRosterSnapshot;
            await trackWrite(saveJuniorRosterSnapshot(snapshot, roster, writeGeneration));
            if (!isCurrent(route, data)) return;
            for (const id of new Set([...pending, ...(needsBackfill ? backfillIds : [])])) notify(teamId, id);
        }

        const rosterIds = new Set(snapshot.ids);
        const graphIds: number[] = [];
        const resolutionSaves: Promise<void>[] = [];
        for (const id of pending) {
            if (rosterIds.has(id) || kind === 'academy') {
                graphIds.push(id);
            } else {
                resolutionSaves.push(trackWrite(saveJuniorResolution(
                    teamId, id, week, snapshot.complete ? 'absent' : 'unknown', writeGeneration
                )).then(() => { if (isCurrent(route, data)) setState(teamId, id, 'idle'); })
                    .catch(() => { if (isCurrent(route, data)) setState(teamId, id, 'error'); }));
            }
        }
        await Promise.all(resolutionSaves);
        if (!isCurrent(route, data)) return;

        for (const id of graphIds) setState(teamId, id, 'queued');
        let next = 0;
        const worker = async (): Promise<void> => {
            while (isCurrent(route, data) && next < graphIds.length) {
                const id = graphIds[next++];
                setState(teamId, id, 'loading');
                try {
                    const points = await fetchJuniorGraph(id, controller.signal);
                    if (!hasCurrentData(data)) return;
                    await trackWrite(saveJuniorGraph(teamId, id, week, points, writeGeneration));
                    if (!hasCurrentData(data)) return;
                    setState(teamId, id, 'idle');
                } catch {
                    if (hasCurrentData(data)) setState(teamId, id, 'error');
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(3, graphIds.length) }, () => worker()));
    } catch {
        if (!isCurrent(route, data)) return;
        for (const id of pending) {
            attempted.add(attemptKey(teamId, week, kind, id));
            setState(teamId, id, 'error');
        }
    } finally {
        activeControllers.delete(controller);
    }
}

/** Synchronize visible juniors once per game week; later calls share the same serialized coordinator. */
export function syncVisibleJuniors(input: JuniorSyncInput): Promise<void> {
    if (!Number.isSafeInteger(input.teamId) || input.teamId <= 0 ||
        !Number.isSafeInteger(input.week) || input.week <= 0 ||
        input.ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        return Promise.reject(new Error('Invalid junior sync input'));
    }
    const route = routeEpoch;
    const data = dataEpoch;
    const next = coordinatorTail.then(() => runSync(input, route, data));
    coordinatorTail = next.catch(() => undefined);
    return next;
}
