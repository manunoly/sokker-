import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTodayInfo, fetchCurrentWeek, fetchTrainingData, fetchRoster } from './api';

const today = { season: 80, week: 1200, seasonWeek: 5, day: 2, date: { value: '2026-10-23', timestamp: 1792713600 } };
function respond(body: unknown, type = 'application/json', status = 200): void {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: status === 200, status,
        headers: new Headers({ 'content-type': type }), json: async () => body }));
}
afterEach(() => vi.unstubAllGlobals());

describe('canonical worker API', () => {
    it('runs independently of page location with GET and existing credentials', async () => {
        vi.stubGlobal('location', undefined);
        respond({ today, team: { id: 9001 } });
        await expect(fetchTodayInfo()).resolves.toEqual({ ...today, teamId: 9001 });
        await expect(fetchCurrentWeek()).resolves.toBe(1200);
        expect(fetch).toHaveBeenCalledWith('https://sokker.org/api/current', { method: 'GET', credentials: 'include' });
    });
    it.each([
        {}, { today, team: {} }, { today: { ...today, week: '1200' }, team: { id: 9001 } },
        { today: { ...today, date: { value: 'bad', timestamp: 0 } }, team: { id: 9001 } },
        { today: { ...today, seasonWeek: null }, team: { id: 9001 } },
    ])('rejects malformed current information: %j', async body => {
        respond(body); await expect(fetchTodayInfo()).rejects.toThrow('Invalid /current');
    });
    it('rejects session HTML, JSON with a false content-type, invalid JSON and HTTP failures', async () => {
        respond('<html>Sign in</html>', 'text/html');
        await expect(fetchTodayInfo()).rejects.toThrow('expected JSON');
        respond({ today, team: { id: 9001 } }, 'text/plain');
        await expect(fetchTodayInfo()).rejects.toThrow('expected JSON');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => { throw new SyntaxError('Invalid JSON'); } }));
        await expect(fetchTodayInfo()).rejects.toThrow('Invalid JSON');
        respond({}, 'application/json', 401);
        await expect(fetchTodayInfo()).rejects.toThrow('401');
    });
    it('accepts genuinely empty reports/rosters, but never missing arrays', async () => {
        respond({ players: [] });
        await expect(fetchTrainingData(1200)).resolves.toEqual([]);
        await expect(fetchRoster(9001)).resolves.toEqual([]);
        respond({ error: 'session expired' });
        await expect(fetchTrainingData(1200)).rejects.toThrow();
        await expect(fetchRoster(9001)).rejects.toThrow();
    });
    it('validates consumed training and roster records', async () => {
        const player = { id: 101, player: { name: { full: 'Synthetic Player' } }, report: {
            week: 1200, skills: { pace: 10 }, day: { date: { value: '2026-10-23' } }, playerValue: { value: 1000 } } };
        respond({ players: [player] });
        await expect(fetchTrainingData(1200)).resolves.toEqual([player]);
        respond({ players: [{ ...player, report: { ...player.report, week: 1199 } }] });
        await expect(fetchTrainingData(1200)).rejects.toThrow('malformed report');
        respond({ players: [{ id: 101, info: { name: { full: 'Synthetic Player' }, skills: { pace: '10' } } }] });
        await expect(fetchRoster(9001)).rejects.toThrow('malformed player');
    });
    it.each([0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, Number.NaN])('rejects unsafe query numbers: %s', async id => {
        respond({ players: [] });
        await expect(fetchTrainingData(id)).rejects.toThrow();
        await expect(fetchRoster(id)).rejects.toThrow();
        expect(fetch).not.toHaveBeenCalled();
    });
});
