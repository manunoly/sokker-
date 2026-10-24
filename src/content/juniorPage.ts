import { createHistoryButton, updateHistoryButton } from './historyButton';
import { getPlayerStrings } from './playerLocale';
import { fetchTodayInfo, type TodayInfo } from '../core/apiClient';
import { cancelQueuedJuniorSync, syncVisibleJuniors } from '../core/juniorSync';
import { contextFromPath, type PageContext } from './pageContext';
import { hideJuniorCard, scheduleJuniorCardHide, showJuniorCard } from './juniorCard';

export type JuniorPageView =
    | { kind: 'report'; pathname: string; names: Map<number, HTMLElement> }
    | { kind: 'academy'; pathname: string; routeTeamId: number; layout?: 'legacy' | 'beta'; names: Map<number, HTMLElement> };

interface ActiveEntry {
    pathname: string;
    generation: number;
    view: JuniorPageView;
    todayPromise: Promise<TodayInfo>;
    today: TodayInfo | null;
    syncedIds: string;
    listenersAttached: boolean;
}

let active: ActiveEntry | null = null;
let generation = 0;
const controls = new Map<HTMLElement, { id: number; button: HTMLButtonElement }>();

function refreshControls(entry: ActiveEntry): void {
    for (const [anchor, control] of controls) {
        if (!anchor.isConnected || entry.view.names.get(control.id) !== anchor) {
            control.button.remove();
            controls.delete(anchor);
            hideJuniorCard();
        }
    }
    const strings = getPlayerStrings(location.pathname, document.documentElement.lang, navigator.language);
    for (const [id, anchor] of entry.view.names) {
        let control = controls.get(anchor);
        if (!control?.button.isConnected) {
            const button = createHistoryButton(anchor, returnFocus => {
                const current = active;
                const match = current && juniorNameFromTarget(anchor, current.view);
                if (!current || !currentEntry(current) || !eligible(current) || !match) return;
                const valid = () => active === current && currentEntry(current) && eligible(current) &&
                    juniorNameFromTarget(anchor, current.view)?.id === match.id;
                void showJuniorCard(anchor, current.today!.teamId, match.id,
                    anchor.textContent?.trim() ?? '', current.view.kind === 'report' ? 'left' : 'right',
                    { pinned: true, returnFocus, isCurrent: valid }).catch(error => console.warn('Could not show junior card:', error));
            });
            if (!button) continue;
            control = { id, button };
            controls.set(anchor, control);
        }
        control.id = id;
        updateHistoryButton(control.button, 'name', `${strings.history}: ${anchor.textContent?.trim() ?? ''}`);
    }
}

function positiveId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

function validCurrent(today: unknown): today is TodayInfo {
    return today !== null && typeof today === 'object' &&
        Number.isSafeInteger((today as TodayInfo).week) && (today as TodayInfo).week > 0 &&
        Number.isSafeInteger((today as TodayInfo).teamId) && (today as TodayInfo).teamId > 0;
}

function currentEntry(entry: ActiveEntry): boolean {
    return active === entry && entry.generation === generation &&
        window.location.pathname === entry.pathname;
}

function juniorNameFromTarget(target: EventTarget | null, view: JuniorPageView):
    { id: number; name: HTMLElement } | null {
    if (!(target instanceof Element)) return null;
    for (const [id, name] of view.names) {
        if (!name.isConnected || !name.contains(target)) continue;
        const currentRow = name.closest<HTMLElement>('tr');
        if (view.kind === 'report' && positiveId(currentRow?.dataset.rowId ?? '') !== id) return null;
        if (view.kind === 'academy' && view.layout !== 'beta' && currentRow?.id !== "juniorRow" + id) return null;
        if (view.kind === 'academy' && view.layout === 'beta') {
            const row = name.closest<HTMLElement>('tr.table-row[data-row-id]');
            if (row?.dataset.rowId !== String(id) || name.closest('[id^="junior-row-"]')?.id !== `junior-row-${id}`) return null;
        }
        return { id, name };
    }
    return null;
}

/** Scan only structural junior rows; all labels and saved IDs remain language-neutral. */
export function scanJuniorPage(page: PageContext | string | null, root: Document): JuniorPageView | null {
    const context = typeof page === 'string' ? contextFromPath(page) : page;
    if (!context) return null;
    const { pathname } = context;
    if (context.kind === 'training-report') {
        const names = new Map<number, HTMLElement>();
        const selector = context.layout === 'beta' ? '.boxes-training__junior-team tr.table-row[data-row-id]' : 'tr.table-row[data-row-id]';
        root.querySelectorAll<HTMLElement>(selector).forEach(row => {
            if (row.closest('[aria-hidden="true"]') || !row.querySelector('td.table__cell--exp') || !row.querySelector('td.table__cell--weeks')) return;
            const id = positiveId(row.getAttribute('data-row-id') ?? '');
            const name = row.querySelector<HTMLElement>(context.layout === 'beta' ? 'td.table__cell--player .rich-text' : 'td.table__cell--player .text.c-text-link');
            if (id !== null && name && !name.closest('[aria-hidden="true"]')) names.set(id, name);
        });
        return { kind: 'report', pathname, names };
    }
    if (context.kind !== 'academy') return null;
    const names = new Map<number, HTMLElement>();
    if (context.layout === 'beta') {
        root.querySelectorAll<HTMLElement>('tr.table-row[data-row-id]').forEach(row => {
            if (row.closest('[aria-hidden="true"]') || !row.querySelector('td.table__cell--weeksIn') || !row.querySelector('td.table__cell--weeksLeft')) return;
            const id = positiveId(row.getAttribute('data-row-id') ?? '');
            const name = row.querySelector<HTMLElement>('td.table__cell--surname button');
            const label = name?.closest<HTMLElement>('span[id^="junior-row-"]');
            if (id !== null && name && label?.id === `junior-row-${id}` && !name.closest('[aria-hidden="true"]')) names.set(id, name);
        });
    } else {
        root.querySelectorAll<HTMLElement>('tr[id^="juniorRow"]').forEach(row => {
            const id = positiveId(row.id.slice('juniorRow'.length));
            const name = row.querySelector<HTMLElement>('td:first-child strong');
            if (id !== null && name) names.set(id, name);
        });
    }
    return { kind: 'academy', pathname, routeTeamId: context.teamId, layout: context.layout, names };
}
function eligible(entry: ActiveEntry): boolean {
    const today = entry.today;
    if (!today || !validCurrent(today)) return false;
    return entry.view.kind === 'report' || entry.view.routeTeamId === today.teamId;
}

function onNameEnter(event: Event): void {
    const entry = active;
    if (!entry || !currentEntry(entry) || !eligible(entry)) return;
    const match = juniorNameFromTarget(event.target, entry.view);
    if (!match) return;
    if (event instanceof MouseEvent && event.relatedTarget instanceof Node &&
        match.name.contains(event.relatedTarget)) return;
    void showJuniorCard(match.name, entry.today!.teamId, match.id,
        match.name.textContent?.trim() ?? '', entry.view.kind === 'report' ? 'left' : 'right').catch((error) => {
        console.warn('Could not show junior card:', error);
    });
}

function onNameLeave(event: Event): void {
    const entry = active;
    if (!entry || !currentEntry(entry) || !eligible(entry)) return;
    const match = juniorNameFromTarget(event.target, entry.view);
    if (!match) return;
    if (event instanceof MouseEvent && event.relatedTarget instanceof Node &&
        match.name.contains(event.relatedTarget)) return;
    scheduleJuniorCardHide();
}

function attachNameListeners(entry: ActiveEntry): void {
    if (entry.listenersAttached) return;
    document.addEventListener('mouseover', onNameEnter);
    document.addEventListener('focusin', onNameEnter);
    document.addEventListener('mouseout', onNameLeave);
    document.addEventListener('focusout', onNameLeave);
    entry.listenersAttached = true;
}

function makeNamesFocusable(view: JuniorPageView): void {
    for (const name of view.names.values()) {
        if (name.tabIndex < 0 && !name.hasAttribute('tabindex')) name.tabIndex = 0;
    }
}

/** A route entry reuses one /current request while incremental DOM renders add new IDs. */
export async function handleJuniorPage(view: JuniorPageView): Promise<void> {
    if (view.pathname !== window.location.pathname) return;
    if (active && active.pathname !== view.pathname) leaveJuniorPage();
    if (!active) {
        active = {
            pathname: view.pathname,
            generation: ++generation,
            view,
            todayPromise: fetchTodayInfo(),
            today: null,
            syncedIds: '',
            listenersAttached: false
        };
    } else {
        active.view = view;
    }

    const entry = active;
    const today = await entry.todayPromise;
    if (!currentEntry(entry)) return;
    if (!validCurrent(today)) return;
    entry.today = today;
    if (!eligible(entry)) return;
    makeNamesFocusable(entry.view);
    attachNameListeners(entry);
    refreshControls(entry);

    const ids = [...entry.view.names.keys()].sort((a, b) => a - b);
    if (ids.length === 0) return;
    const signature = ids.join(',');
    if (signature === entry.syncedIds) return;
    entry.syncedIds = signature;
    await syncVisibleJuniors({ teamId: today.teamId, week: today.week, kind: entry.view.kind, ids });
}

/** Leave an eligible route before any late /current or graph response can update its UI. */
export function leaveJuniorPage(): void {
    if (!active) return;
    ++generation;
    if (active.listenersAttached) {
        document.removeEventListener('mouseover', onNameEnter);
        document.removeEventListener('focusin', onNameEnter);
        document.removeEventListener('mouseout', onNameLeave);
        document.removeEventListener('focusout', onNameLeave);
    }
    active = null;
    for (const { button } of controls.values()) button.remove();
    controls.clear();
    cancelQueuedJuniorSync();
    hideJuniorCard();
}
