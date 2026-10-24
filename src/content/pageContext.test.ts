import { describe, expect, it } from 'vitest';
import { resolvePageContext } from './pageContext';

const hosts = ['sokker.org', 'app.sokker.org', 'future.sokker.org'];
describe('host-independent page identity', () => {
    it.each(hosts)('classifies complete new and legacy routes on %s', host => {
        const routes = [
            ['/training/training-setup/', 'training-setup', 'beta'], ['/training/reports/details/1000/', 'training-report', 'beta'],
            ['/squad', 'squad', 'beta'], ['/squad/42/', 'squad', 'beta'],
            ['/player/12345/?tab=x#name', 'player', 'beta'], ['/juniors/42/', 'academy', 'beta'],
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
        '/juniors/42/history', '/app/training/reports/details/9007199254740992',
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
});
