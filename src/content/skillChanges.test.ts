// @vitest-environment-options {"url":"https://sokker.org/"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchTodayInfo } from '../core/apiClient';
import { getPlayerHistory } from '../core/storageClient';
import { processBetaPlayers, processPlayerPage, processSquadTable, invalidatePlayerCache } from './ui';
import { resolvePageContext } from './pageContext';
import { leavePlayerBindings } from './playerBindings';
import type { PlayerData, PlayerHistoryEntry, Skills } from '../types';

vi.mock('../core/apiClient', () => ({ fetchTodayInfo: vi.fn() }));
vi.mock('../core/storageClient', () => ({ getPlayerHistory: vi.fn() }));
vi.mock('./tooltip', () => ({
    showTooltip: vi.fn(), showHistoryTooltip: vi.fn(), openZoomChart: vi.fn(),
    scheduleHide: vi.fn(), hideTooltip: vi.fn(),
}));

const BASE: Skills = {
    stamina: 10, keeper: 1, playmaking: 10, passing: 8, technique: 10,
    defending: 6, striker: 10, pace: 10, tacticalDiscipline: 10,
    form: 10, teamwork: 10, experience: 10,
};
const entry = (week: number, date: string, skills: Partial<Pick<Skills, 'passing' | 'defending'>>): PlayerHistoryEntry => ({
    week, date, skills: { ...BASE, ...skills }, value: 0, source: 'training',
});
const layouts = ['classic-profile', 'classic-squad', 'beta-profile', 'beta-squad'] as const;
type Layout = typeof layouts[number];
let saved: PlayerData;

beforeEach(() => {
    const history = [
        entry(1000, '2030-01-03', {}),
        entry(1001, '2030-01-10', { defending: 7 }),
        entry(1002, '2030-01-17', { defending: 7, passing: 9 }),
    ];
    saved = { id: 7, name: 'Synthetic Player', history, latest: history.at(-1)! };
    vi.mocked(getPlayerHistory).mockImplementation(async () => saved);
    vi.mocked(fetchTodayInfo).mockResolvedValue({
        season: 50, week: 1003, seasonWeek: 3, day: 2,
        date: { value: '2030-01-22', timestamp: Date.UTC(2030, 0, 22) }, teamId: 99,
    });
});
afterEach(() => {
    invalidatePlayerCache(); leavePlayerBindings(); document.body.replaceChildren(); vi.restoreAllMocks();
});

function mount(layout: Layout): () => Promise<void> {
    const { passing, defending } = saved.history.at(-1)!.skills;
    const skillCells = `<td id="passing"><strong>Level <span class="skillNameNumber">${passing}</span></strong> Passing</td>`
        + `<td id="defending"><strong>Level <span class="skillNameNumber">${defending}</span></strong> Defender</td>`;
    if (layout === 'classic-profile') {
        window.history.replaceState({}, '', '/en/app/player/PID/7/');
        document.body.innerHTML = `<table class="table-skills"><tbody><tr>${skillCells}</tr></tbody></table>`;
        return () => processPlayerPage(document.body);
    }
    if (layout === 'classic-squad') {
        window.history.replaceState({}, '', '/app/squad/');
        document.body.innerHTML = '<div class="player-box"><a href="/player/PID/7">Synthetic Player</a>'
            + `<div class="skill-list__item"><span id="passing" class="skillLabel">Passing</span><span class="skill-list__value">${passing}</span></div>`
            + `<div class="skill-list__item"><span id="defending" class="skillLabel">Defender</span><span class="skill-list__value">${defending}</span></div></div>`;
        return () => processSquadTable(document.body);
    }
    if (layout === 'beta-profile') {
        window.history.replaceState({}, '', '/player/7');
        document.body.innerHTML = '<div class="@container/player"><div class="[grid-area:name]"><div><span>Synthetic Player</span></div></div>'
            + `<div class="@container/skills"><button id="passing"><span>passing</span><span>${passing}</span></button>`
            + `<button id="defending"><span>defender</span><span>${defending}</span></button></div></div>`;
    } else {
        window.history.replaceState({}, '', '/squad');
        document.body.innerHTML = '<table><tbody><tr class="table-row" data-row-id="7">'
            + '<td class="table__cell--name"><a href="/player/7">Synthetic Player</a></td>'
            + `<td id="passing" class="table__cell--passing">${passing}</td>`
            + `<td id="defending" class="table__cell--defending">${defending}</td></tr></tbody></table>`;
    }
    return () => processBetaPlayers(resolvePageContext(new URL(location.href))!);
}

function expectChanges(passing: string | null, defending: string | null): void {
    expect(document.querySelector('#passing .skill-arrow')?.textContent ?? null).toBe(passing);
    expect(document.querySelector('#defending .skill-arrow')?.textContent ?? null).toBe(defending);
}

it.each(layouts.flatMap(layout => [0, 1, 2, 3, 4, 5, 6].map(day => ({ layout, day }))))(
    'shows the latest completed rise without a current-week entry: $layout day=$day', async ({ layout, day }) => {
        const today = await fetchTodayInfo();
        vi.mocked(fetchTodayInfo).mockResolvedValue({ ...today, day });
        await mount(layout)();
        expectChanges('▲', null);
        if (layout === 'classic-profile') {
            expect(document.querySelector<HTMLElement>('#passing .skillNameNumber')!.style.color).toBe('rgb(40, 167, 69)');
            expect(document.querySelector<HTMLElement>('#defending .skillNameNumber')!.style.color).toBe('');
        }
    },
);

it.each(layouts)('collapses a redundant Sunday capture into the preceding observed week: %s', async layout => {
    saved.history.push(entry(1003, '2030-01-20', { defending: 7, passing: 9 }));
    await mount(layout)();
    expectChanges('▲', null);
});

it.each(layouts)('uses a real Thursday report from the current week instead of the previous rise: %s', async layout => {
    saved.history.push(entry(1003, '2030-01-24', { defending: 8, passing: 9 }));
    const today = await fetchTodayInfo();
    vi.mocked(fetchTodayInfo).mockResolvedValue({ ...today, day: 4, date: { value: '2030-01-24', timestamp: Date.UTC(2030, 0, 24) } });
    await mount(layout)();
    expectChanges(null, '▲');
});

it.each(layouts)('shows a drop from the latest measured report: %s', async layout => {
    saved.history.push(entry(1003, '2030-01-24', { defending: 7, passing: 8 }));
    await mount(layout)();
    expectChanges('▼', null);
    if (layout === 'classic-profile') {
        expect(document.querySelector<HTMLElement>('#passing .skillNameNumber')!.style.color).toBe('rgb(220, 53, 69)');
    }
});

it('replaces old arrows and restores native number styles through rescans and invalidation without changing saved history', async () => {
    const render = mount('classic-profile');
    const passing = document.querySelector<HTMLElement>('#passing .skillNameNumber')!;
    passing.style.color = 'blue';
    passing.title = 'Native value';
    const original = structuredClone(saved);
    await render(); await render();
    expect(document.querySelectorAll('.skill-arrow')).toHaveLength(1);
    expect(saved).toEqual(original);
    saved.history.push(entry(1003, '2030-01-24', { defending: 8, passing: 9 }));
    document.querySelector('#defending .skillNameNumber')!.textContent = '8';
    const today = await fetchTodayInfo();
    vi.mocked(fetchTodayInfo).mockResolvedValue({ ...today, day: 4, date: { value: '2030-01-24', timestamp: Date.UTC(2030, 0, 24) } });
    await render();
    expectChanges(null, '▲');
    expect(passing.style.color).toBe('blue');
    expect(passing.title).toBe('Native value');
    invalidatePlayerCache(); leavePlayerBindings();
    expect(document.querySelectorAll('.skill-arrow')).toHaveLength(0);
    expect(document.querySelector<HTMLElement>('#defending .skillNameNumber')!.style.color).toBe('');
});

it('keeps dated observed-week comparisons when the current-context request fails', async () => {
    vi.mocked(fetchTodayInfo).mockRejectedValue(new Error('Synthetic context unavailable'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mount('classic-profile')();
    expectChanges('▲', null);
});
