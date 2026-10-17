import { hideTooltip, scheduleHide, showHistoryTooltip } from './tooltip';

export interface TrainingPlayerView {
    pathname: string;
    names: Map<number, HTMLElement>;
}

const playerIds = new WeakMap<HTMLElement, number>();
const boundNames = new WeakSet<HTMLElement>();
let active: TrainingPlayerView | null = null;

function positiveId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

function playerIdFromLink(link: HTMLAnchorElement): number | null {
    const match = /\/player\/(?:PID|ID_player)\/([1-9]\d*)(?:\/|$)/.exec(link.pathname);
    return match ? positiveId(match[1]) : null;
}

/** Find first-team names on the two training routes without selecting junior report rows. */
export function scanTrainingPlayerPage(pathname: string, root: Document): TrainingPlayerView | null {
    const setup = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?app\/training\/training-setup\/?$/i.test(pathname);
    const report = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?app\/training\/reports\/details\/[1-9]\d*\/?$/i.test(pathname);
    if (!setup && !report) return null;

    const names = new Map<number, HTMLElement>();
    root.querySelectorAll<HTMLElement>('tr.table-row[data-row-id]').forEach((row) => {
        // The junior table has these columns; its names belong to juniorPage.
        if (row.querySelector('td.table__cell--exp, td.table__cell--weeks')) return;
        const id = positiveId(row.getAttribute('data-row-id') ?? '');
        const name = row.querySelector<HTMLElement>('td.table__cell--player .text.c-text-link');
        if (id !== null && name) names.set(id, name);
    });

    root.querySelectorAll<HTMLAnchorElement>('a[href*="/player/PID/"], a[href*="/player/ID_player/"]').forEach((link) => {
        if (link.closest('tr')?.querySelector('td.table__cell--exp, td.table__cell--weeks')) return;
        const id = playerIdFromLink(link);
        if (id !== null) names.set(id, link);
    });
    return { pathname, names };
}

function selectedId(name: HTMLElement): number | null {
    const id = playerIds.get(name);
    return id !== undefined && active?.pathname === window.location.pathname && active.names.get(id) === name
        ? id : null;
}

function bindName(name: HTMLElement): void {
    if (boundNames.has(name)) return;
    boundNames.add(name);
    if (name.tabIndex < 0) name.tabIndex = 0;

    name.addEventListener('mouseenter', (event) => {
        const id = selectedId(name);
        if (id === null) return;
        void showHistoryTooltip(event.pageX, event.pageY, id, name).catch((error) => {
            console.warn('Could not show saved player history:', error);
        });
    });
    name.addEventListener('focus', () => {
        const id = selectedId(name);
        if (id === null) return;
        const rect = name.getBoundingClientRect();
        void showHistoryTooltip(rect.right, rect.top, id, name).catch((error) => {
            console.warn('Could not show saved player history:', error);
        });
    });
    name.addEventListener('mouseleave', () => { if (selectedId(name) !== null) scheduleHide(); });
    name.addEventListener('blur', () => { if (selectedId(name) !== null) scheduleHide(); });
}

/** Called on SPA renders; replaced names receive listeners without duplicate bindings. */
export function handleTrainingPlayerPage(view: TrainingPlayerView): void {
    if (view.pathname !== window.location.pathname) return;
    if (active?.pathname !== view.pathname) hideTooltip();
    active = view;
    for (const [id, name] of view.names) {
        playerIds.set(name, id);
        bindName(name);
    }
}

export function leaveTrainingPlayerPage(): void {
    if (!active) return;
    active = null;
    hideTooltip();
}
