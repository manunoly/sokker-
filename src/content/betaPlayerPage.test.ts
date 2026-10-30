// @vitest-environment-options {"url":"https://sokker.org/"}
import { beforeEach, describe, expect, it } from 'vitest';
import squad from './fixtures/betaSquad.html?raw';
import player from './fixtures/betaPlayer.html?raw';
import colors from './fixtures/betaPlayerColors.html?raw';
import values from './fixtures/betaSkillValues.html?raw';
import progress from './fixtures/betaTrainingProgress.html?raw';
import legacyProgress from './fixtures/legacyTrainingProgress.html?raw';
import { resolvePageContext } from './pageContext';
import { scanBetaPlayers } from './betaPlayerPage';

beforeEach(() => { document.body.innerHTML = ''; });
const context = (path: string, host = 'sokker.org') => resolvePageContext(new URL(`https://${host}${path}`))!;
describe('observed beta player structures', () => {
    it('recognizes native legacy training player-info links, including the observed double slash', () => {
        document.body.innerHTML = legacyProgress;
        const route = context('/en/app/training/main-team-progress/');
        const players = scanBetaPlayers(route, document);
        expect(players).toHaveLength(1);
        expect(players[0].playerId).toBe(12345);
        expect(players[0].skills.map(skill => skill.getValue?.()?.textContent)).toEqual(['8','10','9','10','4','10','10','10']);
        const name = players[0].names[0];
        expect(name.getAttribute('href')).toBe('https://sokker.org/en//app/training/player-info/12345');
        name.setAttribute('href', '/en//app/training/player-info/12346');
        expect(scanBetaPlayers(route, document)).toEqual([]);
        name.setAttribute('href', 'https://example.test/en//app/training/player-info/12345');
        expect(scanBetaPlayers(route, document)).toEqual([]);
    });
    it('supports the localized progress route and classic player links without widening other routes', () => {
        document.body.innerHTML = progress;
        const name = document.querySelector<HTMLAnchorElement>('td.table__cell--name a')!;
        name.setAttribute('href', '/en/app/player/PID/12345/');
        const players = scanBetaPlayers(context('/en/app/training/main-team-progress/'), document);
        expect(players).toHaveLength(1); expect(players[0].skills).toHaveLength(8);
        expect(players[0].names).toEqual([name]);
        expect(scanBetaPlayers(context('/en/app/squad'), document)).toEqual([]);
        name.setAttribute('href', 'https://example.test/en/app/player/PID/12345/');
        expect(scanBetaPlayers(context('/en/app/training/main-team-progress/'), document)).toEqual([]);
    });

    it('binds classic text-only names by row identity and rejects hidden rows or foreign links', () => {
        document.body.innerHTML = progress;
        const cell = document.querySelector('td.table__cell--name')!;
        cell.className = 'table__cell--player';
        cell.innerHTML = '<span class="text c-text-link">Player One</span>';
        const route = context('/en/app/training/main-team-progress/');
        const players = scanBetaPlayers(route, document);
        expect(players).toHaveLength(1); expect(players[0].playerId).toBe(12345);
        expect(players[0].skills).toHaveLength(8);
        expect(scanBetaPlayers(context('/training/main-team-progress'), document)).toEqual([]);
        cell.insertAdjacentHTML('beforeend', '<a href="https://example.test/player/12345">Foreign</a>');
        expect(scanBetaPlayers(route, document)).toEqual([]);
        cell.querySelector('a')!.remove();
        cell.closest('tr')!.setAttribute('aria-hidden', 'true');
        expect(scanBetaPlayers(route, document)).toEqual([]);
    });
    it('reads progress names and all eight visible skill values through development links', () => {
        document.body.innerHTML = progress;
        const players = scanBetaPlayers(context('/training/main-team-progress'), document);
        expect(players).toHaveLength(1);
        expect(players[0].playerId).toBe(12345);
        expect(players[0].names[0].textContent).toBe('Player One');
        expect(players[0].skills).toHaveLength(8);
        expect(players[0].skills.map(skill => skill.getValue?.()?.textContent)).toEqual(['8','10','9','10','4','10','10','10']);
        const name = players[0].names[0];
        name.setAttribute('href', 'https://example.test/player/12345/development');
        expect(scanBetaPlayers(context('/training/main-team-progress'), document)).toEqual([]);
        name.setAttribute('href', '/player/12346/development');
        expect(scanBetaPlayers(context('/training/main-team-progress'), document)).toEqual([]);
        name.setAttribute('href', '/player/12345/development');
        name.closest('tr')!.setAttribute('aria-hidden', 'true');
        expect(scanBetaPlayers(context('/training/main-team-progress'), document)).toEqual([]);
    });
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


it('resolves the visible sibling value and rejects ambiguous level copies', () => {
    document.body.innerHTML = values;
    const player = scanBetaPlayers(context('/player/7'), document)[0];
    const passing = player.skills.find(skill => skill.key === 'passing')!;
    const value = document.querySelector<HTMLElement>('#passing-value')!;
    expect(passing.anchor).toBe(document.querySelector('#passing'));
    expect(passing.anchor.contains(value)).toBe(false);
    expect(passing.getValue?.()).toBe(value);
    value.parentElement!.append(value.cloneNode(true));
    expect(passing.getValue?.()).toBeNull();
});
