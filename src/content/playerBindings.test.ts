// @vitest-environment-options {"url":"https://sokker.org/"}
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTodayInfo } from '../core/apiClient';
import { getPlayerHistory } from '../core/storageClient';
import type { PlayerData } from '../types/index';
import { hideTooltip, openZoomChart, showHistoryTooltip, showTooltip } from './tooltip';
import { bindPlayerAnchors, leavePlayerBindings, type PlayerAnchors } from './playerBindings';
import { processBetaPlayers, processPlayerPage, processSquadTable, invalidatePlayerCache } from './ui';
import { resolvePageContext } from './pageContext';
import squad from './fixtures/betaSquad.html?raw';

vi.mock('../core/apiClient', () => ({ fetchTodayInfo: vi.fn().mockResolvedValue({ day: 6 }) }));
vi.mock('../core/storageClient', () => ({ getPlayerHistory: vi.fn().mockResolvedValue(null) }));
vi.mock('./tooltip', () => ({
    openZoomChart: vi.fn().mockResolvedValue(undefined), showTooltip: vi.fn().mockResolvedValue(undefined),
    showHistoryTooltip: vi.fn().mockResolvedValue(undefined), scheduleHide: vi.fn(), hideTooltip: vi.fn(),
}));

beforeEach(() => { leavePlayerBindings(); vi.clearAllMocks(); history.replaceState({}, '', '/squad'); document.body.innerHTML = ''; });
function anchors(id = 12345): PlayerAnchors[] {
    return [{ playerId: id, names: [document.querySelector<HTMLElement>('#name')!], skills: [{ key: 'pace', anchor: document.querySelector<HTMLElement>('#skill')! }] }];
}
describe('player identity and native interactions', () => {
    it('binds once per event and follows reused nodes to their new player identity', () => {
        document.body.innerHTML = '<a id="name" href="/player/12345">Player One</a><button id="skill">Pace</button>';
        bindPlayerAnchors(anchors()); bindPlayerAnchors(anchors());
        const name = document.querySelector<HTMLElement>('#name')!;
        name.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showHistoryTooltip).toHaveBeenCalledOnce();
        expect(showHistoryTooltip).toHaveBeenLastCalledWith(0, 0, 12345, name);
        name.setAttribute('href', '/player/12346');
        bindPlayerAnchors(anchors(12346));
        document.querySelector<HTMLElement>('#skill')!.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showTooltip).toHaveBeenLastCalledWith(0, 0, 12346, 'pace', document.querySelector('#skill'));
        name.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showHistoryTooltip).toHaveBeenLastCalledWith(0, 0, 12346, name);
        leavePlayerBindings(); name.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showHistoryTooltip).toHaveBeenCalledTimes(2);
        expect(document.querySelectorAll('[data-sokkerpp-owned="pin"]')).toHaveLength(0);
    });
    it('preserves the native click and pins from its own keyboard-accessible button', () => {
        document.body.innerHTML = '<span id="name">Player</span><button id="skill">Pace</button>';
        const native = document.querySelector<HTMLButtonElement>('#skill')!;
        const clicked = vi.fn(); native.addEventListener('click', clicked);
        bindPlayerAnchors(anchors());
        const event = new MouseEvent('click', { bubbles: true, cancelable: true }); native.dispatchEvent(event);
        expect(clicked).toHaveBeenCalledOnce(); expect(event.defaultPrevented).toBe(false);
        expect(openZoomChart).not.toHaveBeenCalled();
        const control = native.nextElementSibling as HTMLButtonElement;
        expect(control.tagName).toBe('BUTTON'); expect(control.tabIndex).toBe(0);
        expect(control.getAttribute('aria-label')).toBeTruthy();
        control.focus(); control.click();
        expect(openZoomChart).toHaveBeenCalledWith(12345, 'pace', control);
        native.focus();
        expect(showTooltip).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 12345, 'pace', native);
        expect(fetchTodayInfo).not.toHaveBeenCalled(); expect(getPlayerHistory).not.toHaveBeenCalled();
    });
    it('reads each player once for table+cards and keeps a stable indicator through rescans', async () => {
        document.body.innerHTML = squad;
        const skills = { stamina: 10, pace: 10, technique: 10, passing: 10, keeper: 10, defending: 10, playmaking: 10, striker: 10 };
        vi.mocked(getPlayerHistory).mockImplementation(async id => id === 12345 ? ({ id, history: [{ week: 1000, skills }, { week: 1001, skills: { ...skills, pace: 11 } }] } as PlayerData) : null);
        const context = resolvePageContext(new URL(location.href))!;
        await processBetaPlayers(context);
        expect(getPlayerHistory).toHaveBeenCalledTimes(2);
        expect(document.querySelectorAll('[data-sokkerpp-owned="change"]')).toHaveLength(2);
        const controls = document.querySelectorAll('[data-sokkerpp-owned="pin"]').length;
        await processBetaPlayers(context);
        expect(document.querySelectorAll('[data-sokkerpp-owned="change"]')).toHaveLength(2);
        expect(document.querySelectorAll('[data-sokkerpp-owned="pin"]')).toHaveLength(controls);
        expect([...document.querySelectorAll('.native-bar')].every(bar => bar.textContent === '10')).toBe(true);
        const requests = vi.mocked(fetchTodayInfo).mock.calls.length;
        document.querySelector<HTMLElement>('td.table__cell--name a[href*="/player/"]')!.dispatchEvent(new MouseEvent('mouseenter'));
        expect(fetchTodayInfo).toHaveBeenCalledTimes(requests);
    });
    it('does not duplicate legacy profile handlers and updates reused skill/name IDs', async () => {
        history.replaceState({}, '', '/es/app/player/PID/12345/');
        document.body.innerHTML = '<div class="h5 title-block-1"><a href="/player/PID/12345">Player One</a></div><table class="table-skills"><tbody><tr><td><strong>Good <span class="skillNameNumber">10</span></strong> Pace</td></tr></tbody></table>';
        await processPlayerPage(document.body); await processPlayerPage(document.body);
        const cell = document.querySelector<HTMLElement>('td')!;
        cell.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showTooltip).toHaveBeenCalledOnce();
        history.replaceState({}, '', '/es/app/player/ID_player/12346/');
        await processPlayerPage(document.body); cell.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showTooltip).toHaveBeenLastCalledWith(0, 0, 12346, 'pace', cell);
    });
});

it('preserves legacy numeric highlighting with one label arrow and clears it after storage invalidation', async () => {
    history.replaceState({}, '', '/app/squad/');
    document.body.innerHTML = '<div class="player-box"><a href="/player/PID/12345">Player One</a><div class="skill-list__item"><span class="skillLabel">Pace</span><span class="skill-list__value" style="color:blue">10</span></div></div>';
    const skills = { stamina: 10, pace: 10, technique: 10, passing: 10, keeper: 10, defending: 10, playmaking: 10, striker: 10 };
    vi.mocked(getPlayerHistory).mockResolvedValue({ id: 12345, history: [{ week: 1000, skills }, { week: 1001, skills: { ...skills, pace: 11 } }] } as PlayerData);
    await processSquadTable(document.body); await processSquadTable(document.body);
    const value = document.querySelector<HTMLElement>('.skill-list__value')!;
    expect(value.style.color).toBe('rgb(40, 167, 69)');
    expect(document.querySelectorAll('.skill-arrow')).toHaveLength(1);
    invalidatePlayerCache();
    expect(value.style.color).toBe('blue');
    expect(document.querySelectorAll('.skill-arrow')).toHaveLength(0);
});

it('preserves native descendants of a legacy skill cell while text and cell keyboard still pin the chart', async () => {
    history.replaceState({}, '', '/player/PID/12345');
    document.body.innerHTML = '<table class="table-skills"><tbody><tr><td><strong>Good <span class="skillNameNumber">10</span></strong> <a href="#native-skill"><span>Pace</span></a><button type="button" aria-label="Native skill action"><span></span></button></td></tr></tbody></table>';
    await processPlayerPage(document.body);
    const cell = document.querySelector<HTMLElement>('td')!;
    const native = [cell.querySelector<HTMLElement>('a span')!, cell.querySelector<HTMLElement>('button span')!];
    const clicked = vi.fn();
    const keyed = vi.fn();
    const bubbled = vi.fn();
    cell.parentElement!.addEventListener('click', bubbled);
    for (const target of native) {
        target.parentElement!.addEventListener('click', clicked);
        target.parentElement!.addEventListener('keydown', keyed);
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        target.dispatchEvent(click);
        expect(click.defaultPrevented).toBe(false);
        for (const key of ['Enter', ' ']) {
            const keydown = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            target.dispatchEvent(keydown);
            expect(keydown.defaultPrevented).toBe(false);
        }
    }
    expect(clicked).toHaveBeenCalledTimes(2);
    expect(keyed).toHaveBeenCalledTimes(4);
    expect(bubbled).toHaveBeenCalledTimes(2);
    expect(openZoomChart).not.toHaveBeenCalled();

    const value = cell.querySelector<HTMLElement>('.skillNameNumber')!;
    value.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(openZoomChart).toHaveBeenLastCalledWith(12345, 'pace', cell);
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    for (const key of ['Enter', ' ']) {
        const keydown = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        cell.dispatchEvent(keydown);
        expect(keydown.defaultPrevented).toBe(true);
    }
    expect(openZoomChart).toHaveBeenCalledTimes(4);
});

it.each(['beta', 'legacy'])('ignores stale %s card identities for hover, focus and pin before a rescan', async layout => {
    if (layout === 'beta') {
        document.body.innerHTML = squad;
        document.querySelector('table')!.remove();
        await processBetaPlayers(resolvePageContext(new URL(location.href))!);
    } else {
        history.replaceState({}, '', '/app/squad');
        document.body.innerHTML = '<div class="player-box"><a href="/player/PID/12345">Player One</a><div class="skill-list__item"><span class="skillLabel">Pace</span><span class="skill-list__value">10</span></div></div>';
        await processSquadTable(document.body);
    }
    const name = document.querySelector<HTMLAnchorElement>('a[href*="/player/"]')!;
    const skill = layout === 'beta'
        ? [...document.querySelectorAll<HTMLButtonElement>('[class~="@container/skills"] button:not([data-sokkerpp-owned])')].find(button => !button.closest('[aria-hidden="true"]') && button.textContent?.toLowerCase().includes('pace'))!
        : document.querySelector<HTMLElement>('.skill-list__value')!;
    name.setAttribute('href', layout === 'beta' ? '/player/12346' : '/player/PID/12346');
    name.textContent = 'Player Two';
    name.dispatchEvent(new MouseEvent('mouseenter'));
    name.focus();
    skill.dispatchEvent(new MouseEvent('mouseenter'));
    skill.focus();
    if (layout === 'beta') {
        const pin = skill.nextElementSibling as HTMLButtonElement;
        pin.click();
    } else {
        skill.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        skill.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    }
    expect(showHistoryTooltip).not.toHaveBeenCalled();
    expect(showTooltip).not.toHaveBeenCalled();
    expect(openZoomChart).not.toHaveBeenCalled();
});

it('discards a pending saved-history result when the card link changes before the rescan', async () => {
    document.body.innerHTML = squad;
    document.querySelector('table')!.remove();
    let finish!: (value: PlayerData) => void;
    vi.mocked(getPlayerHistory).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const pending = processBetaPlayers(resolvePageContext(new URL(location.href))!);
    await vi.waitFor(() => expect(getPlayerHistory).toHaveBeenCalledOnce());
    document.querySelector<HTMLAnchorElement>('a[href*="/player/"]')!.setAttribute('href', '/player/12346');
    const skills = { stamina: 10, pace: 10, technique: 10, passing: 10, keeper: 10, defending: 10, playmaking: 10, striker: 10 };
    finish({ id: 12345, history: [{ week: 1000, skills }, { week: 1001, skills: { ...skills, pace: 11 } }] } as PlayerData);
    await pending;
    expect(document.querySelector('[data-sokkerpp-owned="change"]')).toBeNull();
});

it.each(['name', 'skill', 'pin'])('hides an obsolete pending %s card after a card link identity changes', async interaction => {
    document.body.innerHTML = squad;
    document.querySelector('table')!.remove();
    vi.mocked(getPlayerHistory).mockResolvedValue(null);
    await processBetaPlayers(resolvePageContext(new URL(location.href))!);
    const name = document.querySelector<HTMLAnchorElement>('a[href*="/player/"]')!;
    const skill = [...document.querySelectorAll<HTMLButtonElement>('[class~="@container/skills"] button')].find(button => !button.closest('[aria-hidden="true"]') && button.textContent?.toLowerCase().includes('pace'))!;
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    if (interaction === 'name') { vi.mocked(showHistoryTooltip).mockReturnValueOnce(pending); name.dispatchEvent(new MouseEvent('mouseenter')); }
    if (interaction === 'skill') { vi.mocked(showTooltip).mockReturnValueOnce(pending); skill.dispatchEvent(new MouseEvent('mouseenter')); }
    if (interaction === 'pin') { vi.mocked(openZoomChart).mockReturnValueOnce(pending); (skill.nextElementSibling as HTMLButtonElement).click(); }
    name.setAttribute('href', '/player/12346');
    finish();
    await pending;
    await Promise.resolve();
    expect(hideTooltip).toHaveBeenCalledOnce();
});

it('does not close a newer valid card when an older obsolete presentation finishes', async () => {
    document.body.innerHTML = squad;
    document.querySelector('table')!.remove();
    vi.mocked(getPlayerHistory).mockResolvedValue(null);
    const context = resolvePageContext(new URL(location.href))!;
    await processBetaPlayers(context);
    const name = document.querySelector<HTMLAnchorElement>('a[href*="/player/"]')!;
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    vi.mocked(showHistoryTooltip).mockReturnValueOnce(pending);
    name.dispatchEvent(new MouseEvent('mouseenter'));
    name.setAttribute('href', '/player/12346');
    await processBetaPlayers(context);
    vi.mocked(hideTooltip).mockClear();
    name.dispatchEvent(new MouseEvent('mouseenter'));
    expect(showHistoryTooltip).toHaveBeenLastCalledWith(0, 0, 12346, name);
    finish();
    await pending;
    await Promise.resolve();
    expect(hideTooltip).not.toHaveBeenCalled();
});
