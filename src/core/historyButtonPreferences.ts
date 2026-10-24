// UI preferences belong to the extension profile, independently of history/backups.
const visibilityKey = 'sokker++:history-buttons-visible';
let visible = true;
let initialized: Promise<void> | null = null;
let changeVersion = 0;
const listeners = new Set<(visible: boolean) => void>();

function update(value: unknown): void {
    const next = typeof value === 'boolean' ? value : true;
    if (visible === next) return;
    visible = next;
    for (const listener of listeners) listener(visible);
}

export function historyButtonsVisible(): boolean { return visible; }

export function subscribeHistoryButtonsVisibility(listener: (visible: boolean) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function initHistoryButtonPreferences(): Promise<void> {
    if (initialized) return initialized;
    initialized = (async () => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local' || !Object.hasOwn(changes, visibilityKey)) return;
            changeVersion++;
            update(changes[visibilityKey].newValue);
        });
        const version = changeVersion;
        const stored = await chrome.storage.local.get(visibilityKey);
        // A notification received during the read is newer than that snapshot.
        if (version === changeVersion) update(stored[visibilityKey]);
    })();
    return initialized;
}

export async function setHistoryButtonsVisible(next: boolean): Promise<void> {
    if (typeof next !== 'boolean') throw new TypeError('History button visibility must be a boolean.');
    await initHistoryButtonPreferences();
    if (typeof chrome === 'undefined' || !chrome.storage?.local) throw new Error('Preferences storage is unavailable.');
    const version = changeVersion;
    await chrome.storage.local.set({ [visibilityKey]: next });
    if (version === changeVersion) update(next);
}
