import { contextFromPath, resolvePageContext, type PageContext } from './pageContext';
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
    let context: PageContext | null;
    try { context = resolvePageContext(new URL(link.getAttribute('href') ?? '', 'https://sokker.org')); }
    catch { return null; }
    return context?.kind === 'player' ? context.playerId : null;
}

/** Find first-team names only on training routes whose actual DOM has been observed. */
export function scanTrainingPlayerPage(page: PageContext | string | null, root: Document): TrainingPlayerView | null {
    const context = typeof page === 'string' ? contextFromPath(page) : page;
    if (!context || (context.kind !== 'training-setup' && context.kind !== 'training-report')) return null;
    const { pathname } = context;
    const names = new Map<number, HTMLElement>();
    if (context.layout === 'beta') {
        const report = context.kind === 'training-report';
        const selector = report ? '.boxes-training__main-team tr.table-row[data-row-id]' : '.players-table tr.table-row[data-row-id]';
        root.querySelectorAll<HTMLElement>(selector).forEach(row => {
            if (row.closest('[aria-hidden="true"]') || row.querySelector('td.table__cell--exp, td.table__cell--weeks')) return;
            const id = positiveId(row.dataset.rowId ?? '');
            if (id === null) return;
            if (report) {
                const name = row.querySelector<HTMLElement>('td.table__cell--player .rich-text');
                if (name && !name.closest('[aria-hidden="true"]')) names.set(id, name);
            } else {
                const name = row.querySelector<HTMLAnchorElement>('td.table__cell--player a.players-table__cell.players-table__player[aria-label="player"][href]');
                if (!name || name.closest('[aria-hidden="true"]')) return;
                let url: URL;
                try { url = new URL(name.getAttribute('href')!, 'https://sokker.org'); }
                catch { return; }
                const match = /^\/player\/([1-9]\d*)\/development\/?$/.exec(url.pathname);
                const identity = match ? resolvePageContext(new URL(`/player/${match[1]}`, url.origin)) : null;
                if (identity?.kind === 'player' && identity.playerId === id) names.set(id, name);
            }
        });
        return { pathname, names };
    }
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
    const row = name.closest<HTMLElement>('tr[data-row-id]');
    if (row && positiveId(row.dataset.rowId ?? '') !== id) return null;
    return id !== undefined && name.isConnected && active?.pathname === window.location.pathname && active.names.get(id) === name
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
