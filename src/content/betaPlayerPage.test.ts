// @vitest-environment-options {"url":"https://sokker.org/"}
import { beforeEach, describe, expect, it } from 'vitest';
import squad from './fixtures/betaSquad.html?raw';
import player from './fixtures/betaPlayer.html?raw';
import colors from './fixtures/betaPlayerColors.html?raw';
import { resolvePageContext } from './pageContext';
import { scanBetaPlayers } from './betaPlayerPage';

beforeEach(() => { document.body.innerHTML = ''; });
const context = (path: string, host = 'sokker.org') => resolvePageContext(new URL(`https://${host}${path}`))!;
describe('observed beta player structures', () => {
    it('merges table and card anchors and ignores flag links and measurement copies', () => {
        document.body.innerHTML = squad;
        const players = scanBetaPlayers(context('/squad'), document);
        expect(players.map(item => item.playerId)).toEqual([12345, 12346]);
        expect(players[0].names).toHaveLength(2);
        expect(players[0].skills).toHaveLength(16);
        expect(new Set(players[0].skills.map(item => item.key))).toEqual(new Set([
            'stamina', 'pace', 'technique', 'passing', 'keeper', 'defending', 'playmaking', 'striker',
        ]));
        expect(players[0].names.every(name => name.textContent === 'Player One')).toBe(true);
    });
    it.each([player, colors])('reads all eight profile buttons independently of colors', html => {
        document.body.innerHTML = html;
        const players = scanBetaPlayers(context('/player/12345', 'future.sokker.org'), document);
        expect(players).toHaveLength(1);
        expect(players[0].names[0].textContent).toBe('Player One');
        expect(players[0].skills.map(item => item.key)).toEqual([
            'stamina', 'pace', 'technique', 'passing', 'keeper', 'defending', 'playmaking', 'striker',
        ]);
    });
    it('rejects structural/link ID mismatches and explicit foreign player links', () => {
        document.body.innerHTML = squad;
        document.querySelector('tr')!.dataset.rowId = 'bad';
        document.querySelector('tr[data-row-id="12346"] a')!.setAttribute('href', 'https://example.test/player/12346');
        document.querySelector('[class~="@container/player"]')!.remove();
        expect(scanBetaPlayers(context('/squad/42/'), document)).toEqual([]);
    });
    it('keeps old layouts and academy rows outside the first-team adapter', () => {
        document.body.innerHTML = squad;
        expect(scanBetaPlayers(context('/app/squad'), document)).toEqual([]);
        expect(scanBetaPlayers(context('/juniors/42'), document)).toEqual([]);
    });
});
