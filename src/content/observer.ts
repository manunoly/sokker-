import { scheduleIdle } from '../utils/scheduleIdle';
import { resolvePageContext, type PageContext } from './pageContext';

let dispose: (() => void) | null = null;
let refresh: (() => void) | null = null;
const OWNED = '[data-sokkerpp-owned], .skill-arrow, .sokker-plus-history-icon, #sokkerpp-history-tooltip, #sokkerpp-junior-card';

function owned(node: Node): boolean {
    const element = node instanceof Element ? node : node.parentElement;
    return !!element?.closest(OWNED);
}

function extensionMutation(mutation: MutationRecord): boolean {
    if (owned(mutation.target)) return true;
    const changed = [...mutation.addedNodes, ...mutation.removedNodes];
    return mutation.type === 'childList' && changed.length > 0 && changed.every(owned);
}

/** Observe native renders and history navigation, retaining the final deferred pass. */
export function initObserver(
    onTableFound: (container: HTMLElement) => void,
    onPlayerPageFound?: (container: HTMLElement) => void,
    onSquadReady?: () => void,
    onJuniorPageChanged?: () => void,
    onBetaPlayersFound?: (context: PageContext) => void,
    onPageContextChanged?: (context: PageContext | null) => void,
): void {
    if (dispose) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastPath: string | null = null;
    let lastProcessedAt = -Infinity;
    let stopped = false;
    const cooldown = 2000;
    const currentKey = () => `${location.origin}${location.pathname}`;
    const process = () => {
        timer = null;
        if (stopped) return;
        const key = currentKey();
        const context = resolvePageContext(new URL(location.href));
        if (key !== lastPath) {
            lastPath = key;
            lastProcessedAt = -Infinity;
            onPageContextChanged?.(context);
        }
        onJuniorPageChanged?.();
        const remaining = cooldown - (Date.now() - lastProcessedAt);
        if (remaining > 0) {
            timer = setTimeout(process, remaining);
            return;
        }
        lastProcessedAt = Date.now();
        if (!context) return;
        if (context.kind === 'training-progress') {
            onBetaPlayersFound?.(context);
            return;
        }
        if (context.layout === 'beta') {
            if (context.kind === 'squad' || context.kind === 'player') onBetaPlayersFound?.(context);
            if (context.kind === 'squad' && document.querySelector('td.table__cell--name, [class~="@container/player"]')) {
                scheduleIdle(() => { if (!stopped && key === currentKey()) onSquadReady?.(); });
            }
            return;
        }
        if (context.kind === 'squad') {
            const container = document.querySelector<HTMLElement>('.view-squad') ??
                (document.querySelector('.player-box, .player-box--sm') ? document.body : null);
            if (container) {
                onTableFound(container);
                scheduleIdle(() => { if (!stopped && key === currentKey()) onSquadReady?.(); });
            }
        } else if (context.kind === 'player' && document.querySelector('.table-skills')) {
            onPlayerPageFound?.(document.querySelector<HTMLElement>('.l-main__inner') ?? document.body);
        }
    };
    const schedule = () => {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(process, 100);
    };
    const observer = new MutationObserver(mutations => {
        if (mutations.some(mutation => !extensionMutation(mutation))) schedule();
    });
    observer.observe(document.body, {
        childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['data-row-id', 'href', 'id', 'class', 'aria-hidden'],
    });
    refresh = () => { lastProcessedAt = -Infinity; schedule(); };
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const push: History['pushState'] = function (this: History, ...args) { originalPush.apply(this, args); schedule(); };
    const replace: History['replaceState'] = function (this: History, ...args) { originalReplace.apply(this, args); schedule(); };
    history.pushState = push;
    history.replaceState = replace;
    window.addEventListener('popstate', schedule);
    window.addEventListener('hashchange', schedule);
    dispose = () => {
        stopped = true;
        observer.disconnect();
        if (timer !== null) clearTimeout(timer);
        if (history.pushState === push) history.pushState = originalPush;
        if (history.replaceState === replace) history.replaceState = originalReplace;
        window.removeEventListener('popstate', schedule);
        window.removeEventListener('hashchange', schedule);
    };
    process();
}

export function stopObserver(): void {
    dispose?.();
    dispose = null;
    refresh = null;
}

export function refreshObserver(): void { refresh?.(); }
