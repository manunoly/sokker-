import { fetchTodayInfo, type TodayInfo } from '../core/api';
import { cancelQueuedJuniorSync, syncVisibleJuniors } from '../core/juniorSync';
import { hideJuniorCard, scheduleJuniorCardHide, showJuniorCard } from './juniorCard';

export type JuniorPageView =
    | { kind: 'report'; pathname: string; names: Map<number, HTMLElement> }
    | { kind: 'academy'; pathname: string; routeTeamId: number; names: Map<number, HTMLElement> };

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
    if (view.kind === 'report') {
        const name = target.closest<HTMLElement>('td.table__cell--player .text.c-text-link');
        const row = name?.closest<HTMLElement>('tr.table-row[data-row-id]');
        const id = row ? positiveId(row.getAttribute('data-row-id') ?? '') : null;
        if (id === null || !row?.querySelector('td.table__cell--exp') ||
            !row.querySelector('td.table__cell--weeks')) return null;
        return { id, name: name! };
    }
    const name = target.closest<HTMLElement>('tr[id^="juniorRow"] td:first-child strong');
    const row = name?.closest<HTMLElement>('tr[id^="juniorRow"]');
    const id = row ? positiveId(row.id.slice('juniorRow'.length)) : null;
    return id === null ? null : { id, name: name! };
}

/** Scan only structural junior rows; all labels and saved IDs remain language-neutral. */
export function scanJuniorPage(pathname: string, root: Document): JuniorPageView | null {
    const reportRoute = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?app\/training\/reports\/details\/([1-9]\d*)\/?$/i.exec(pathname);
    if (reportRoute && positiveId(reportRoute[1]) !== null) {
        const names = new Map<number, HTMLElement>();
        root.querySelectorAll<HTMLElement>('tr.table-row[data-row-id]').forEach((row) => {
            if (!row.querySelector('td.table__cell--exp') || !row.querySelector('td.table__cell--weeks')) return;
            const id = positiveId(row.getAttribute('data-row-id') ?? '');
            const name = row.querySelector<HTMLElement>('td.table__cell--player .text.c-text-link');
            if (id !== null && name) names.set(id, name);
        });
        return { kind: 'report', pathname, names };
    }

    const academyRoute = /^\/juniors\/teamID\/([1-9]\d*)\/?$/.exec(pathname);
    const routeTeamId = academyRoute ? positiveId(academyRoute[1]) : null;
    if (routeTeamId === null) return null;
    const names = new Map<number, HTMLElement>();
    root.querySelectorAll<HTMLElement>('tr[id^="juniorRow"]').forEach((row) => {
        const id = positiveId(row.id.slice('juniorRow'.length));
        const name = row.querySelector<HTMLElement>('td:first-child strong');
        if (id !== null && name) names.set(id, name);
    });
    return { kind: 'academy', pathname, routeTeamId, names };
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
    cancelQueuedJuniorSync();
    hideJuniorCard();
}
