import { historyButtonsVisible, subscribeHistoryButtonsVisibility } from '../core/historyButtonPreferences';

export type HistoryButtonVariant = 'name' | 'skill';
const selector = 'button[data-sokkerpp-owned="pin"]';
const styleId = 'sokkerpp-history-button-style';

subscribeHistoryButtonsVisibility(visible => {
    document.querySelectorAll<HTMLButtonElement>(selector).forEach(button => { button.hidden = !visible; });
});

function ensureStyle(): void {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
${selector} {
    display:inline-flex!important;align-items:center;justify-content:center;box-sizing:border-box;
    width:auto!important;min-width:24px!important;height:24px;min-height:24px!important;padding:0 3px!important;
    margin:0 0 0 3px!important;border:0!important;border-radius:3px;background:transparent!important;
    color:inherit!important;cursor:pointer;font:700 15px/1 system-ui,sans-serif!important;
    vertical-align:middle;box-shadow:none!important;text-decoration:none!important;
}
${selector}[data-history-variant="name"] {border:1px solid currentColor!important;padding:0 4px!important;}
${selector}:hover {background:#80808018!important;}
${selector}:focus-visible {outline:2px solid currentColor!important;outline-offset:2px!important;}
${selector}[hidden] {display:none!important;}
`;
    (document.head ?? document.documentElement).appendChild(style);
}

/** Shared presentation; native actions remain on their original element. */
export function updateHistoryButton(button: HTMLButtonElement, variant: HistoryButtonVariant, label: string): void {
    ensureStyle();
    button.dataset.historyVariant = variant;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.hidden = !historyButtonsVisible();
}

export function createHistoryButton(anchor: HTMLElement, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement | null {
    let native: HTMLElement = anchor.closest<HTMLElement>('button, a') ?? anchor;
    while (native.parentElement?.closest('button, a')) native = native.parentElement.closest<HTMLElement>('button, a')!;
    const host = native.tagName === 'TD' ? native : native.parentElement;
    if (!host) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '+';
    button.dataset.sokkerppOwned = 'pin';
    button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        onClick(button);
    });
    if (host === native) host.appendChild(button);
    else native.insertAdjacentElement('afterend', button);
    return button;
}
