/** One shared delay prevents incidental pointer travel from opening history cards. */
export const HOVER_DELAY_MS = 400;

let pending: { anchor: HTMLElement; timer: ReturnType<typeof setTimeout> } | null = null;

function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') cancelHover();
}

export function cancelHover(anchor?: HTMLElement): void {
    if (!pending || (anchor && pending.anchor !== anchor)) return;
    clearTimeout(pending.timer);
    pending = null;
    document.removeEventListener('keydown', onKey);
}

/** Callers revalidate the player/skill identity immediately before opening. */
export function scheduleHover(anchor: HTMLElement, open: () => void): void {
    cancelHover();
    const page = `${location.origin}${location.pathname}`;
    const intent = { anchor, timer: setTimeout(() => {
        if (pending !== intent) return;
        cancelHover();
        if (anchor.isConnected && !anchor.closest('[hidden], [aria-hidden="true"]') &&
            page === `${location.origin}${location.pathname}`) open();
    }, HOVER_DELAY_MS) };
    pending = intent;
    document.addEventListener('keydown', onKey);
}
