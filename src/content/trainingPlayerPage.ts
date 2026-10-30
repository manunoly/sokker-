import { createHistoryButton, updateHistoryButton } from './historyButton';
import { getPlayerStrings } from './playerLocale';
import { contextFromPath, playerIdFromUrl, type PageContext } from './pageContext';
import { hideTooltip, scheduleHide, showHistoryTooltip } from './tooltip';
import { cancelHover, scheduleHover } from './hoverIntent';

export interface TrainingPlayerView {
    pathname: string;
    names: Map<number, HTMLElement>;
}

const playerIds = new WeakMap<HTMLElement, number>();
const boundNames = new WeakSet<HTMLElement>();
let active: TrainingPlayerView | null = null;
const controls = new Map<HTMLElement, { id: number; button: HTMLButtonElement }>();
let presentation = 0;

function positiveId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

function playerIdFromLink(link: HTMLAnchorElement): number | null {
    try {
        const url = new URL(link.getAttribute('href') ?? '', 'https://sokker.org');
        return playerIdFromUrl(url, true);
    }
    catch { return null; }
}

/** Find first-team names only on training routes whose actual DOM has been observed. */
export function scanTrainingPlayerPage(page: PageContext | string | null, root: Document): TrainingPlayerView | null {
    const context = typeof page === 'string' ? contextFromPath(page) : page;
    if (!context || (context.kind !== 'training-setup' && context.kind !== 'training-report')) return null;
    const { pathname } = context;
    const names = new Map<number, HTMLElement>();
    if (context.layout === 'beta') {
        const report = context.kind === 'training-report';
        const selector = report ? '.boxes-training__main-team tr.table-row[data-row-id]' : 'tr.table-row[data-row-id]';
        root.querySelectorAll<HTMLElement>(selector).forEach(row => {
            if (row.closest('[aria-hidden="true"]') || row.querySelector('td.table__cell--exp, td.table__cell--weeks')) return;
            const id = positiveId(row.dataset.rowId ?? '');
            if (id === null) return;
            if (report) {
                const name = row.querySelector<HTMLElement>('td.table__cell--player .rich-text');
                if (name && !name.closest('[aria-hidden="true"]')) names.set(id, name);
            } else {
                const name = row.querySelector<HTMLAnchorElement>('td.table__cell--player a[href]');
                if (!name || name.closest('[aria-hidden="true"]')) return;
                let url: URL;
                try { url = new URL(name.getAttribute('href')!, 'https://sokker.org'); }
                catch { return; }
                const match = /^\/player\/([1-9]\d*)\/development\/?$/.exec(url.pathname);
                if (match && playerIdFromUrl(url, true) === id) names.set(id, name);
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
    if (name instanceof HTMLAnchorElement && playerIdFromLink(name) !== id) return null;
    const row = name.closest<HTMLElement>('tr[data-row-id]');
    if (row && positiveId(row.dataset.rowId ?? '') !== id) return null;
    return id !== undefined && name.isConnected && active?.pathname === window.location.pathname && active.names.get(id) === name
        ? id : null;
}

function presentName(name: HTMLElement, trigger: HTMLElement, pinned = false, event?: MouseEvent): void {
    cancelHover();
    const id = selectedId(name);
    if (id === null) return;
    const token = ++presentation;
    const rect = trigger.getBoundingClientRect();
    const opening = pinned
        ? showHistoryTooltip(rect.right, rect.top, id, trigger, { pinned: true })
        : showHistoryTooltip(event?.pageX ?? rect.right, event?.pageY ?? rect.top, id, trigger);
    void opening.then(() => {
        if (token === presentation && selectedId(name) !== id) hideTooltip();
    }).catch(error => console.warn('Could not show saved player history:', error));
}

function bindName(name: HTMLElement): void {
    if (boundNames.has(name)) return;
    boundNames.add(name);
    if (name.tabIndex < 0) name.tabIndex = 0;
    name.addEventListener('mouseenter', event => {
        const id = selectedId(name);
        if (id !== null) scheduleHover(name, () => { if (selectedId(name) === id) presentName(name, name, false, event); });
    });
    name.addEventListener('focus', () => presentName(name, name));
    name.addEventListener('click', () => cancelHover(name));
    name.addEventListener('mouseleave', () => { cancelHover(name); if (selectedId(name) !== null) scheduleHide(); });
    name.addEventListener('blur', () => { cancelHover(name); if (selectedId(name) !== null) scheduleHide(); });
}

/** Called on SPA renders; replaced names receive listeners without duplicate bindings. */
export function handleTrainingPlayerPage(view: TrainingPlayerView): void {
    if (view.pathname !== window.location.pathname) return;
    if (active?.pathname !== view.pathname) leaveTrainingPlayerPage();
    for (const [name, control] of controls) {
        if (!name.isConnected || view.names.get(control.id) !== name) {
            cancelHover(name);
            control.button.remove();
            controls.delete(name);
            ++presentation;
            hideTooltip();
        }
    }
    active = view;
    const strings = getPlayerStrings(location.pathname, document.documentElement.lang, navigator.language);
    for (const [id, name] of view.names) {
        playerIds.set(name, id);
        bindName(name);
        let control = controls.get(name);
        if (!control?.button.isConnected) {
            const button = createHistoryButton(name, trigger => presentName(name, trigger, true));
            if (!button) continue;
            control = { id, button };
            controls.set(name, control);
        }
        updateHistoryButton(control.button, 'name', `${strings.history}: ${name.textContent?.trim() ?? ''}`);
    }
}

export function leaveTrainingPlayerPage(): void {
    for (const name of active?.names.values() ?? []) cancelHover(name);
    ++presentation;
    for (const { button } of controls.values()) button.remove();
    controls.clear();
    if (!active) return;
    active = null;
    hideTooltip();
}
