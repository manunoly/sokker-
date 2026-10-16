import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJuniorGraph, fetchJuniorRoster } from './api';

function respondWith(body: unknown, ok = true): void {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 503, json: async () => body }));
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchJuniorRoster', () => {
    it('returns the validated current roster and preserves absent talent as null', async () => {
        respondWith({ juniors: [
            { id: 101, teamId: 9001, talent: 4, weeksLeft: 12 },
            { id: 102, teamId: 9001 },
        ] });

        await expect(fetchJuniorRoster()).resolves.toEqual([
            { id: 101, teamId: 9001, talent: 4, weeksLeft: 12 },
            { id: 102, teamId: 9001, talent: null, weeksLeft: null },
        ]);
        expect(fetch).toHaveBeenCalledWith(`${location.origin}/api/junior?filter[limit]=100`);
    });

    it('accepts an empty roster but rejects a missing or malformed juniors array', async () => {
        respondWith({ juniors: [] });
        await expect(fetchJuniorRoster()).resolves.toEqual([]);
        respondWith({});
        await expect(fetchJuniorRoster()).rejects.toThrow();
        respondWith({ juniors: null });
        await expect(fetchJuniorRoster()).rejects.toThrow();
    });

    it('ignores an invalid optional weeksLeft without rejecting the roster', async () => {
        respondWith({ juniors: [{ id: 101, teamId: 9001, talent: 4, weeksLeft: '12' }] });
        await expect(fetchJuniorRoster()).resolves.toEqual([
            { id: 101, teamId: 9001, talent: 4, weeksLeft: null }
        ]);
    });

    it('rejects invalid IDs, inconsistent teams, duplicate IDs and malformed talent', async () => {
        const invalidRosters = [
            [{ id: 0, teamId: 9001, talent: 4 }],
            [{ id: 101, teamId: 9001 }, { id: 102, teamId: 9002 }],
            [{ id: 101, teamId: 9001 }, { id: 101, teamId: 9001 }],
            [{ id: 101, teamId: 9001, talent: '4' }],
        ];
        for (const juniors of invalidRosters) {
            respondWith({ juniors });
            await expect(fetchJuniorRoster()).rejects.toThrow();
        }
    });

    it('rejects an HTTP error', async () => {
        respondWith({}, false);
        await expect(fetchJuniorRoster()).rejects.toThrow('503');
    });
});

describe('fetchJuniorGraph', () => {
    it('forwards an abort signal to the graph request', async () => {
        respondWith({ juniorId: 101, values: [] });
        const controller = new AbortController();
        await fetchJuniorGraph(101, controller.signal);
        expect(fetch).toHaveBeenCalledWith(`${location.origin}/api/junior/101/graph`, {
            signal: controller.signal
        });
    });

    it('returns validated points without shifting x or using scale as a week', async () => {
        respondWith({ juniorId: 101, values: [
            { x: 1213, y: 6, scale: 0 },
            { x: 1214, y: 7 },
        ] });

        await expect(fetchJuniorGraph(101)).resolves.toEqual([
            { x: 1213, y: 6, scale: 0, source: 'graph' },
            { x: 1214, y: 7, source: 'graph' },
        ]);
        expect(fetch).toHaveBeenCalledWith(`${location.origin}/api/junior/101/graph`);
    });

    it('accepts an empty values array only when the requested juniorId matches', async () => {
        respondWith({ juniorId: 101, values: [] });
        await expect(fetchJuniorGraph(101)).resolves.toEqual([]);
        respondWith({ juniorId: 102, values: [] });
        await expect(fetchJuniorGraph(101)).rejects.toThrow();
    });

    it('rejects missing values and invalid coordinates', async () => {
        const invalidBodies = [
            { juniorId: 101 },
            { juniorId: 101, values: [{ x: 1213.5, y: 6 }] },
            { juniorId: 101, values: [{ x: 1213, y: -1 }] },
            { juniorId: 101, values: [{ x: 1213, y: 19 }] },
            { juniorId: 101, values: [{ x: 1213, y: Number.NaN }] },
            { juniorId: 101, values: [{ x: 1213, y: 6, scale: '0' }] },
        ];
        for (const body of invalidBodies) {
            respondWith(body);
            await expect(fetchJuniorGraph(101)).rejects.toThrow();
        }
    });

    it('rejects an invalid requested ID and an HTTP error', async () => {
        respondWith({ juniorId: 101, values: [] });
        await expect(fetchJuniorGraph(0)).rejects.toThrow();
        expect(fetch).not.toHaveBeenCalled();
        respondWith({}, false);
        await expect(fetchJuniorGraph(101)).rejects.toThrow('503');
    });
});
