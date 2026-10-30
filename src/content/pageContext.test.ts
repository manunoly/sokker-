import { describe, expect, it } from 'vitest';
import { playerIdFromUrl, resolvePageContext } from './pageContext';

const hosts = ['sokker.org', 'app.sokker.org', 'future.sokker.org'];
describe('host-independent page identity', () => {
    it.each(hosts)('classifies complete new and legacy routes on %s', host => {
        const routes = [
            ['/training/training-setup/', 'training-setup', 'beta'], ['/training/reports/details/1000/', 'training-report', 'beta'],
            ['/training/main-team-progress/', 'training-progress', 'beta'],
            ['/en/app/training/main-team-progress/', 'training-progress', 'legacy'],
            ['/es/app/training/main-team-progress', 'training-progress', 'legacy'],
            ['/app/training/main-team-progress', 'training-progress', 'legacy'],
            ['/squad', 'squad', 'beta'], ['/squad/42/', 'squad', 'beta'],
            ['/player/12345/?tab=x#name', 'player', 'beta'], ['/juniors/42/', 'academy', 'beta'],
            ['/juniors', 'academy', 'beta'], ['/juniors/', 'academy', 'beta'],
            ['/app/squad/', 'squad', 'legacy'], ['/es/app/squad/', 'squad', 'legacy'],
            ['/player/PID/12345', 'player', 'legacy'], ['/player/ID_player/12345/', 'player', 'legacy'],
            ['/app/player/PID/12345/', 'player', 'legacy'], ['/es/app/player/ID_player/12345', 'player', 'legacy'],
            ['/es/app/player/PID/12345', 'player', 'legacy'], ['/app/player/ID_player/12345/', 'player', 'legacy'],
            ['/juniors/teamID/42', 'academy', 'legacy'],
            ['/en/app/training/training-setup/', 'training-setup', 'legacy'],
            ['/app/training/reports/details/1000/', 'training-report', 'legacy'],
        ];
        for (const [route, kind, layout] of routes) {
            expect(resolvePageContext(new URL(`https://${host}${route}`))).toMatchObject({ kind, layout });
        }
    });
    it.each(['/player/0', '/player/-1', '/player/1.5', '/player/01', '/player/9007199254740992',
        '/player/12345/transfers', '/player/PID/12345/transfers', '/squad-extra', '/squad/0',
        '/juniors/42/history', '/juniors-extra', '/juniors/0', '/juniors/01',
        '/juniors/9007199254740992', '/app/training/reports/details/9007199254740992',
        '/training/training-setup/unknown', '/training/reports/details/0'])('rejects invalid or unverified route %s', path => {
        expect(resolvePageContext(new URL(`https://sokker.org${path}`))).toBeNull();
    });
    it.each(['https://example.test/player/12345', 'https://sokker.org.example.test/squad',
        'https://notsokker.org/squad', 'http://sokker.org/squad'])('rejects foreign or unapproved origin %s', url => {
        expect(resolvePageContext(new URL(url))).toBeNull();
    });
    it('excludes query and fragment from the player identity', () => {
        expect(resolvePageContext(new URL('https://sokker.org/player/12345/?id=12346#12346')))
            .toEqual({ kind: 'player', playerId: 12345, pathname: '/player/12345/', layout: 'beta' });
    });
    it('identifies the implicit own academy without taking a team ID from the query or fragment', () => {
        expect(resolvePageContext(new URL('https://app.sokker.org/juniors?teamId=99#99')))
            .toEqual({ kind: 'academy', teamId: null, pathname: '/juniors', layout: 'beta' });
    });
});

describe('player identity on training tables', () => {
    it.each(['/en//app/training/player-info/12345', '/en/app/training/player-info/12345/',
        '/es/app/training/player-info/12345?from=training#history', '/app/training/player-info/12345'])('accepts the observed training link %s only when explicitly enabled', path => {
        const url = new URL(path, 'https://sokker.org');
        expect(playerIdFromUrl(url, true)).toBe(12345);
        expect(playerIdFromUrl(url)).toBeNull();
        expect(resolvePageContext(url)).toBeNull();
        expect(url.pathname).toBe(new URL(path, 'https://sokker.org').pathname);
    });
    it.each(['https://example.test/en//app/training/player-info/12345',
        'http://sokker.org/en//app/training/player-info/12345',
        'https://sokker.org/en//app/training/player-info/0',
        'https://sokker.org/en//app/training/player-info/012345',
        'https://sokker.org/en//app/training/player-info/9007199254740992',
        'https://sokker.org/en//app/training/player-info/12345/unknown'])('rejects unsafe or unrelated training link %s', url => {
        expect(playerIdFromUrl(new URL(url), true)).toBeNull();
    });
});
