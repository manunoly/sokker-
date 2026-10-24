import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const key = 'sokker++:history-buttons-visible';
type Changed = (changes: Record<string, { newValue?: unknown }>, area: string) => void;
let changed: Changed;
let stored: Record<string, unknown>;
let get: ReturnType<typeof vi.fn>;
let set: ReturnType<typeof vi.fn>;
let addListener: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.resetModules();
    stored = {};
    get = vi.fn(async () => ({ ...stored }));
    set = vi.fn(async (values: Record<string, unknown>) => { Object.assign(stored, values); });
    addListener = vi.fn((listener: Changed) => { changed = listener; });
    vi.stubGlobal('chrome', { storage: { local: { get, set }, onChanged: { addListener } } });
});
afterEach(() => vi.unstubAllGlobals());

describe('extension profile history button visibility', () => {
    it.each([undefined, null, 'false', 0, {}, true, false])('loads %j with a safe boolean default', async value => {
        stored[key] = value;
        const preferences = await import('./historyButtonPreferences');
        expect(preferences.historyButtonsVisible()).toBe(true);
        await preferences.initHistoryButtonPreferences();
        expect(preferences.historyButtonsVisible()).toBe(value === false ? false : true);
        expect(set).not.toHaveBeenCalled();
    });

    it('persists off and on across fresh extension contexts', async () => {
        let preferences = await import('./historyButtonPreferences');
        await preferences.setHistoryButtonsVisible(false);
        expect(stored[key]).toBe(false);
        expect(preferences.historyButtonsVisible()).toBe(false);
        vi.resetModules();
        preferences = await import('./historyButtonPreferences');
        await preferences.initHistoryButtonPreferences();
        expect(preferences.historyButtonsVisible()).toBe(false);
        await preferences.setHistoryButtonsVisible(true);
        expect(stored[key]).toBe(true);
        vi.resetModules();
        preferences = await import('./historyButtonPreferences');
        await preferences.initHistoryButtonPreferences();
        expect(preferences.historyButtonsVisible()).toBe(true);
    });

    it('initializes once and does not overwrite a cross-context change with a stale read', async () => {
        let finish!: (value: Record<string, unknown>) => void;
        get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        const preferences = await import('./historyButtonPreferences');
        const ready = preferences.initHistoryButtonPreferences();
        expect(preferences.initHistoryButtonPreferences()).toBe(ready);
        changed({ [key]: { newValue: false } }, 'local');
        finish({ [key]: true });
        await ready;
        expect(preferences.historyButtonsVisible()).toBe(false);
        expect(addListener).toHaveBeenCalledOnce();
        expect(get).toHaveBeenCalledOnce();
    });

    it('notifies changes from other contexts, restores the default on deletion, and unsubscribes', async () => {
        const preferences = await import('./historyButtonPreferences');
        await preferences.initHistoryButtonPreferences();
        const listener = vi.fn();
        const unsubscribe = preferences.subscribeHistoryButtonsVisibility(listener);
        changed({ [key]: { newValue: false } }, 'sync');
        changed({ other: { newValue: false } }, 'local');
        expect(listener).not.toHaveBeenCalled();
        changed({ [key]: { newValue: false } }, 'local');
        changed({ [key]: { newValue: false } }, 'local');
        expect(listener).toHaveBeenCalledExactlyOnceWith(false);
        changed({ [key]: {} }, 'local');
        expect(listener).toHaveBeenLastCalledWith(true);
        unsubscribe();
        changed({ [key]: { newValue: false } }, 'local');
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('retains confirmed state and rejects a failed write or an invalid setter value', async () => {
        const preferences = await import('./historyButtonPreferences');
        await preferences.initHistoryButtonPreferences();
        const listener = vi.fn();
        preferences.subscribeHistoryButtonsVisibility(listener);
        set.mockRejectedValue(new Error('Quota unavailable'));
        await expect(preferences.setHistoryButtonsVisible(false)).rejects.toThrow('Quota unavailable');
        await expect(preferences.setHistoryButtonsVisible('false' as unknown as boolean)).rejects.toThrow('boolean');
        expect(preferences.historyButtonsVisible()).toBe(true);
        expect(listener).not.toHaveBeenCalled();
        expect(set).toHaveBeenCalledOnce();
    });

    it('reports read failure while continuing to receive later cross-context changes', async () => {
        get.mockRejectedValue(new Error('Storage unavailable'));
        const preferences = await import('./historyButtonPreferences');
        await expect(preferences.initHistoryButtonPreferences()).rejects.toThrow('Storage unavailable');
        expect(preferences.historyButtonsVisible()).toBe(true);
        changed({ [key]: { newValue: false } }, 'local');
        expect(preferences.historyButtonsVisible()).toBe(false);
    });

    it('keeps the enabled fallback usable in contexts without chrome.storage', async () => {
        vi.stubGlobal('chrome', { runtime: {} });
        const preferences = await import('./historyButtonPreferences');
        await preferences.initHistoryButtonPreferences();
        expect(preferences.historyButtonsVisible()).toBe(true);
        await expect(preferences.setHistoryButtonsVisible(false)).rejects.toThrow('unavailable');
        expect(preferences.historyButtonsVisible()).toBe(true);
    });
});
