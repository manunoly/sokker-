// @vitest-environment-options {"url":"https://sokker.org/"}
import { HOVER_DELAY_MS } from './hoverIntent';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchTodayInfo } from '../core/apiClient';
import { getPlayerHistory } from '../core/storageClient';
import { processBetaPlayers, processPlayerPage, processSquadTable, invalidatePlayerCache } from './ui';
import { resolvePageContext } from './pageContext';
import { leavePlayerBindings } from './playerBindings';
import type { PlayerData, PlayerHistoryEntry, Skills } from '../types';
import betaSkillValues from './fixtures/betaSkillValues.html?raw';
import betaProgress from './fixtures/betaTrainingProgress.html?raw';
import legacyProgress from './fixtures/legacyTrainingProgress.html?raw';
import { showHistoryTooltip, showTooltip } from './tooltip';

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
const layouts = ['classic-profile', 'classic-squad', 'beta-profile', 'beta-squad', 'beta-progress', 'legacy-progress'] as const;
type Layout = typeof layouts[number];
let saved: PlayerData;

beforeEach(() => {
    vi.useFakeTimers();
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
    invalidatePlayerCache(); leavePlayerBindings(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.useRealTimers();
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
        document.body.innerHTML = betaSkillValues;
        document.querySelector('#passing-value')!.textContent = String(passing);
        document.querySelector('#defending-value')!.textContent = String(defending);
    } else if (layout === 'beta-progress' || layout === 'legacy-progress') {
        window.history.replaceState({}, '', layout === 'beta-progress' ? '/training/main-team-progress' : '/en/app/training/main-team-progress/');
        document.body.innerHTML = layout === 'beta-progress' ? betaProgress : legacyProgress;
        document.querySelector<HTMLElement>('tr')!.dataset.rowId = '7';
        document.querySelector('td.table__cell--name a')!.setAttribute('href', layout === 'beta-progress' ? '/player/7/development?from=training' : '/en//app/training/player-info/7');
        for (const [key, value] of [['passing', passing], ['defending', defending]] as const) {
            const cell = document.querySelector(`td.table__cell--${key}`)!;
            cell.id = key;
            cell.querySelector('.growth-bg, span span span')!.textContent = String(value);
        }
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
    for (const [key, direction] of [['passing', passing], ['defending', defending]] as const) {
        const anchor = document.querySelector<HTMLElement>(`#${key}`)!;
        expect(anchor.querySelectorAll('.skill-arrow')).toHaveLength(0);
        const value = anchor.querySelector<HTMLElement>('.skillNameNumber')
            ?? document.querySelector<HTMLElement>(`#${key}-value`)
            ?? (anchor.matches('.skillLabel') ? anchor.parentElement!.querySelector<HTMLElement>('.skill-list__value') : null)
            ?? anchor.querySelector<HTMLElement>('.growth-bg, span span span') ?? anchor;
        if (direction) {
            expect(value.dataset.sokkerppSkillChange).toBe(direction);
            expect(value.style.color).toBe(direction === 'up' ? 'rgb(40, 167, 69)' : 'rgb(220, 53, 69)');
        } else {
            expect(value.dataset.sokkerppSkillChange).toBeUndefined();
            expect(['rgb(40, 167, 69)', 'rgb(220, 53, 69)']).not.toContain(value.style.color);
        }
    }
}

it.each(['beta-progress', 'legacy-progress'] as const)('opens progress history and skill cards, preserves native clicks and rejects reused identities: %s', async layout => {
    const render = mount(layout);
    await render(); await render();
    const name = document.querySelector<HTMLAnchorElement>('td.table__cell--name a')!;
    const cell = document.querySelector<HTMLElement>('#passing')!;
    const value = cell.querySelector<HTMLElement>('.growth-bg, span span span')!;
    expect(value.dataset.sokkerppSkillChange).toBe('up');
    expect(cell.querySelectorAll('.skill-arrow')).toHaveLength(0);
    expect(document.querySelectorAll('[data-sokkerpp-owned="pin"]')).toHaveLength(1);
    vi.mocked(showHistoryTooltip).mockClear(); vi.mocked(showTooltip).mockClear();
    name.focus();
    expect(showHistoryTooltip).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 7, name);
    const pin = name.nextElementSibling as HTMLButtonElement;
    pin.click();
    expect(showHistoryTooltip).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), 7, pin, { pinned: true });
    cell.dispatchEvent(new MouseEvent('mouseenter')); vi.advanceTimersByTime(HOVER_DELAY_MS);
    expect(showTooltip).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 7, 'passing', cell);
    const native = vi.fn(); name.addEventListener('click', event => { native(); event.preventDefault(); });
    name.click(); expect(native).toHaveBeenCalledOnce();
    name.setAttribute('href', '/player/8/development?from=training');
    vi.mocked(showTooltip).mockClear(); vi.mocked(showHistoryTooltip).mockClear();
    cell.dispatchEvent(new MouseEvent('mouseenter')); vi.advanceTimersByTime(HOVER_DELAY_MS); pin.click();
    expect(showTooltip).not.toHaveBeenCalled(); expect(showHistoryTooltip).not.toHaveBeenCalled();
    await render();
    expect(value.dataset.sokkerppSkillChange).toBeUndefined();
    expect(document.querySelectorAll('[data-sokkerpp-owned="pin"], .skill-arrow')).toHaveLength(0);
});

it.each(layouts.flatMap(layout => [0, 1, 2, 3, 4, 5, 6].map(day => ({ layout, day }))))(
    'shows the latest completed rise without a current-week entry: $layout day=$day', async ({ layout, day }) => {
        const today = await fetchTodayInfo();
        vi.mocked(fetchTodayInfo).mockResolvedValue({ ...today, day });
        await mount(layout)();
        expectChanges('up', null);
        if (layout === 'classic-profile') {
            expect(document.querySelector<HTMLElement>('#passing .skillNameNumber')!.style.color).toBe('rgb(40, 167, 69)');
            expect(document.querySelector<HTMLElement>('#defending .skillNameNumber')!.style.color).toBe('');
        }
    },
);

it.each(layouts)('collapses a redundant Sunday capture into the preceding observed week: %s', async layout => {
    saved.history.push(entry(1003, '2030-01-20', { defending: 7, passing: 9 }));
    await mount(layout)();
    expectChanges('up', null);
});

it.each(layouts)('uses a real Thursday report from the current week instead of the previous rise: %s', async layout => {
    saved.history.push(entry(1003, '2030-01-24', { defending: 8, passing: 9 }));
    const today = await fetchTodayInfo();
    vi.mocked(fetchTodayInfo).mockResolvedValue({ ...today, day: 5, date: { value: '2030-01-24', timestamp: Date.UTC(2030, 0, 24) / 1000 } });
    await mount(layout)();
    expectChanges(null, 'up');
});

it.each(layouts)('shows a drop from the latest completed report: %s', async layout => {
    saved.history.push(entry(1003, '2030-01-24', { defending: 7, passing: 8 }));
    const today = await fetchTodayInfo();
    vi.mocked(fetchTodayInfo).mockResolvedValue({ ...today, day: 5, date: { value: '2030-01-24', timestamp: Date.UTC(2030, 0, 24) / 1000 } });
    await mount(layout)();
    expectChanges('down', null);
    if (layout === 'classic-profile') {
        expect(document.querySelector<HTMLElement>('#passing .skillNameNumber')!.style.color).toBe('rgb(220, 53, 69)');
    }
});

it('updates profile colors and restores native styles through rescans and invalidation without changing saved history', async () => {
    const render = mount('classic-profile');
    const passing = document.querySelector<HTMLElement>('#passing .skillNameNumber')!;
    passing.style.color = 'blue';
    passing.title = 'Native value';
    const original = structuredClone(saved);
    await render(); await render();
    expect(document.querySelectorAll('.skill-arrow')).toHaveLength(0);
    expect(saved).toEqual(original);
    saved.history.push(entry(1003, '2030-01-24', { defending: 8, passing: 9 }));
    document.querySelector('#defending .skillNameNumber')!.textContent = '8';
    const today = await fetchTodayInfo();
    vi.mocked(fetchTodayInfo).mockResolvedValue({ ...today, day: 5, date: { value: '2030-01-24', timestamp: Date.UTC(2030, 0, 24) / 1000 } });
    await render();
    expectChanges(null, 'up');
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
    expectChanges('up', null);
});


it.each(layouts.flatMap(layout => [0, 1, 2, 3, 4].map(day => ({ layout, day }))))(
    'retains the previous training result after rollover with a dated pending report: $layout day=$day', async ({ layout, day }) => {
        saved.history.push(entry(1003, '2030-01-17', { defending: 7, passing: 9 }));
        const today = await fetchTodayInfo();
        const currentDate = new Date(Date.UTC(2030, 0, 19 + day));
        vi.mocked(fetchTodayInfo).mockResolvedValue({ ...today, day, date: { value: currentDate.toISOString().slice(0, 10), timestamp: currentDate.getTime() / 1000 } });
        await mount(layout)();
        expectChanges('up', null);
        if (layout === 'classic-profile') {
            expect(document.querySelector<HTMLElement>('#passing .skillNameNumber')!.style.color).toBe('rgb(40, 167, 69)');
        }
    },
);


function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

it.each((['classic-profile', 'classic-squad', 'beta-profile'] as const).flatMap(layout =>
    (['context', 'history'] as const).map(waitingFor => ({ layout, waitingFor })),
))('keeps the numeric highlight while an ordinary rescan waits for $waitingFor: $layout', async ({ layout, waitingFor }) => {
    const render = mount(layout);
    const selector = {
        'classic-profile': '#passing .skillNameNumber',
        'classic-squad': '#passing ~ .skill-list__value',
        'beta-profile': '#passing-value',
    }[layout];
    const value = document.querySelector<HTMLElement>(selector)!;
    value.style.color = 'blue';
    value.title = 'Native value';
    await render();
    const today = await fetchTodayInfo();
    const pendingContext = deferred<Awaited<ReturnType<typeof fetchTodayInfo>>>();
    const pendingHistory = deferred<PlayerData | null>();
    const historyStarted = deferred<void>();
    if (waitingFor === 'context') vi.mocked(fetchTodayInfo).mockReturnValueOnce(pendingContext.promise);
    else vi.mocked(getPlayerHistory).mockImplementationOnce(() => {
        historyStarted.resolve();
        return pendingHistory.promise;
    });
    const pendingRender = render();
    if (waitingFor === 'history') await historyStarted.promise;
    try {
        expect(value.style.color).toBe('rgb(40, 167, 69)');
        expect(value.style.fontWeight).toBe('bold');
        expect(value.title).toBe('Previous: 8');
        expectChanges('up', null);
    } finally {
        pendingContext.resolve(today);
        pendingHistory.resolve(saved);
        await pendingRender;
    }
    expect(value.style.color).toBe('rgb(40, 167, 69)');
    expectChanges('up', null);
    invalidatePlayerCache();
    expect(value.style.color).toBe('blue');
    expect(value.title).toBe('Native value');
});

it('removes the old player highlight immediately when a reused profile changes identity during a pending read', async () => {
    const render = mount('classic-profile');
    const value = document.querySelector<HTMLElement>('#passing .skillNameNumber')!;
    value.style.color = 'blue';
    await render();
    const today = await fetchTodayInfo();
    const pendingContext = deferred<Awaited<ReturnType<typeof fetchTodayInfo>>>();
    vi.mocked(fetchTodayInfo).mockReturnValueOnce(pendingContext.promise);
    vi.mocked(getPlayerHistory).mockResolvedValueOnce(null);
    window.history.replaceState({}, '', '/en/app/player/PID/8/');
    const pendingRender = render();
    try {
        expect(value.style.color).toBe('blue');
        expectChanges(null, null);
    } finally {
        pendingContext.resolve(today);
        await pendingRender;
    }
    expect(value.style.color).toBe('blue');
});

it('removes a highlight immediately when the same native value is reused for a different skill', async () => {
    const render = mount('classic-profile');
    const value = document.querySelector<HTMLElement>('#passing .skillNameNumber')!;
    value.style.color = 'blue';
    await render();
    const today = await fetchTodayInfo();
    const pendingContext = deferred<Awaited<ReturnType<typeof fetchTodayInfo>>>();
    vi.mocked(fetchTodayInfo).mockReturnValueOnce(pendingContext.promise);
    const cell = document.querySelector('#passing')!;
    [...cell.childNodes].find(node => node.nodeType === Node.TEXT_NODE)!.textContent = ' Defender';
    const pendingRender = render();
    try {
        expect(value.style.color).toBe('blue');
        expectChanges(null, null);
    } finally {
        pendingContext.resolve(today);
        await pendingRender;
    }
    expect(value.style.color).toBe('blue');
});


it('keeps indicators through a normal storage revision while cancelling pending reads', async () => {
    vi.mocked(getPlayerHistory).mockClear();
    const render = mount('classic-profile');
    const value = document.querySelector<HTMLElement>('#passing .skillNameNumber')!;
    value.style.color = 'blue';
    await render();
    const today = await fetchTodayInfo();
    const pendingContext = deferred<Awaited<ReturnType<typeof fetchTodayInfo>>>();
    vi.mocked(fetchTodayInfo).mockReturnValueOnce(pendingContext.promise);
    const staleRender = render();
    try {
        invalidatePlayerCache({ preserveIndicators: true });
        expect(value.style.color).toBe('rgb(40, 167, 69)');
        expectChanges('up', null);
        await render();
    } finally {
        pendingContext.resolve(today);
        await staleRender;
    }
    expect(value.style.color).toBe('rgb(40, 167, 69)');
    expect(getPlayerHistory).toHaveBeenCalledTimes(2);
    invalidatePlayerCache();
    expect(value.style.color).toBe('blue');
    expectChanges(null, null);
});


it.each(['rise', 'drop'] as const)('colors the visible beta profile level for a %s without changing native bars', async direction => {
    if (direction === 'drop') {
        saved.history[2] = entry(1002, '2030-01-17', { defending: 7, passing: 7 });
    }
    const render = mount('beta-profile');
    const value = document.querySelector<HTMLElement>('#passing-value')!;
    const originalStyle = value.style.cssText;
    const bars = [...document.querySelectorAll('.native-bar')].map(bar => bar.outerHTML);
    await render();
    expect(value.style.color).toBe(direction === 'rise' ? 'rgb(40, 167, 69)' : 'rgb(220, 53, 69)');
    expectChanges(direction === 'rise' ? 'up' : 'down', null);
    expect(document.querySelector<HTMLElement>('#passing-measurement')!.style.color).toBe('');
    expect(document.querySelector<HTMLElement>('#defending-value')!.style.color).toBe('var(--c-fg)');
    expect([...document.querySelectorAll('.native-bar')].map(bar => bar.outerHTML)).toEqual(bars);
    invalidatePlayerCache();
    expect(value.style.cssText).toBe(originalStyle);
});

it('highlights the current beta value node when Sokker replaces it during a pending read', async () => {
    const render = mount('beta-profile');
    const today = await fetchTodayInfo();
    const pending = deferred<Awaited<ReturnType<typeof fetchTodayInfo>>>();
    vi.mocked(fetchTodayInfo).mockReturnValueOnce(pending.promise);
    const rendering = render();
    const original = document.querySelector<HTMLElement>('#passing-value')!;
    const replacement = original.cloneNode(true) as HTMLElement;
    original.replaceWith(replacement);
    pending.resolve(today);
    await rendering;
    expect(replacement.style.color).toBe('rgb(40, 167, 69)');
    expect(original.style.color).toBe('var(--c-fg)');
    expectChanges('up', null);
});


it.each(['classic-profile', 'beta-profile'] as const)('removes change arrows from the player profile: %s', async layout => {
    const render = mount(layout);
    const stale = document.createElement('span');
    stale.className = 'skill-arrow'; stale.dataset.sokkerppOwned = 'change'; stale.textContent = String.fromCodePoint(0x25b2);
    document.querySelector('#passing')!.append(stale);
    await render();
    expect(document.querySelectorAll('.skill-arrow')).toHaveLength(0);
    const value = document.querySelector<HTMLElement>(layout === 'classic-profile' ? '#passing .skillNameNumber' : '#passing-value')!;
    expect(value.style.color).toBe('rgb(40, 167, 69)');
});

it('highlights both the beta skill name and its visible numeric level', async () => {
    await mount('beta-profile')();
    expect(document.querySelector<HTMLElement>('#passing span span')!.style.color).toBe('rgb(40, 167, 69)');
    expect(document.querySelector<HTMLElement>('#passing-value')!.style.color).toBe('rgb(40, 167, 69)');
});

it.each(['classic-profile', 'beta-bars', 'beta-text'] as const)(
    'colors the level text as well as the number, including when numbers are omitted: %s', async layout => {
        const render = mount(layout === 'classic-profile' ? layout : 'beta-profile');
        if (layout === 'beta-text') {
            document.querySelector('[class~="@container/skills"]')!.innerHTML = `
                <div class="col-span-3 grid grid-cols-subgrid items-center">
                  <div><button id="passing"><span><span>passing</span></span></button></div>
                  <div><span id="passing-value" style="color:var(--c-fg)">9</span></div>
                  <div><p style="color:var(--c-fg-muted)">very good</p></div>
                </div>`;
        }
        const levelText = layout === 'classic-profile'
            ? document.querySelector<HTMLElement>('#passing strong')!
            : document.querySelector<HTMLElement>('#passing')!.closest('.grid')!.querySelector<HTMLElement>('p')!;
        const number = document.querySelector<HTMLElement>(layout === 'classic-profile' ? '#passing .skillNameNumber' : '#passing-value')!;
        const nativeStyle = levelText.style.cssText;
        const nativeText = levelText.textContent;
        await render();
        expect(getComputedStyle(levelText).color).toBe('rgb(40, 167, 69)');
        expect(getComputedStyle(number).color).toBe('rgb(40, 167, 69)');
        number.remove();
        await render();
        expect(getComputedStyle(levelText).color).toBe('rgb(40, 167, 69)');
        expect(levelText.textContent).toBe(nativeText!.replace(number.textContent!, ''));
        saved.history[2] = entry(1002, '2030-01-17', { defending: 7, passing: 7 });
        await render();
        expect(getComputedStyle(levelText).color).toBe('rgb(220, 53, 69)');
        saved.history[2] = entry(1002, '2030-01-17', { defending: 7, passing: 8 });
        await render();
        expect(levelText.style.cssText).toBe(nativeStyle);
        expect(levelText.hasAttribute('data-sokkerpp-skill-change')).toBe(false);
    },
);
