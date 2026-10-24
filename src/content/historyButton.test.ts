import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHistoryButton, updateHistoryButton } from './historyButton';

const preferences = vi.hoisted(() => ({ visible: true, listener: (_visible: boolean) => {} }));
vi.mock('../core/historyButtonPreferences', () => ({
    historyButtonsVisible: () => preferences.visible,
    subscribeHistoryButtonsVisibility: (listener: (visible: boolean) => void) => { preferences.listener = listener; return () => {}; }
}));

beforeEach(() => { document.body.replaceChildren(); preferences.visible = true; history.replaceState({}, '', '/squad'); });
describe('shared history controls', () => {
    it('uses no skill border/background, a name border, a 24px target and a keyboard focus rule', () => {
        document.body.innerHTML = '<button id="native">Pace</button>';
        const anchor = document.querySelector<HTMLElement>('#native')!;
        const button = createHistoryButton(anchor, () => {})!;
        updateHistoryButton(button, 'skill', 'History: Pace');
        expect(button.parentElement).toBe(anchor.parentElement);
        expect(button.dataset.historyVariant).toBe('skill');
        expect(getComputedStyle(button).borderWidth).toBe('0px');
        expect(getComputedStyle(button).backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(getComputedStyle(button).minWidth).toBe('24px');
        expect(document.getElementById('sokkerpp-history-button-style')!.textContent).toContain(':focus-visible');
        updateHistoryButton(button, 'name', 'History: Player');
        expect(button.dataset.historyVariant).toBe('name');
        expect(getComputedStyle(button).borderWidth).toBe('1px');
        expect(button.getAttribute('aria-label')).toBe('History: Player');
    });
    it('updates visibility immediately without inline display overriding hidden', () => {
        document.body.innerHTML = '<a id="native" href="/player/12345">Player</a>';
        const anchor = document.querySelector<HTMLElement>('#native')!;
        const button = createHistoryButton(anchor, () => {})!;
        updateHistoryButton(button, 'name', 'History');
        preferences.visible = false;
        preferences.listener(false);
        expect(button.hidden).toBe(true);
        expect(getComputedStyle(button).display).toBe('none');
        preferences.visible = true;
        preferences.listener(true);
        expect(button.hidden).toBe(false);
        expect(getComputedStyle(button).display).toBe('inline-flex');
    });
    it('keeps controls outside a nested native link/button and stops their click from activating it', () => {
        document.body.innerHTML = '<a id="native" href="/player/12345"><span>Name</span></a>';
        const anchor = document.querySelector<HTMLElement>('span')!;
        const nativeClick = vi.fn();
        document.querySelector('a')!.addEventListener('click', nativeClick);
        const action = vi.fn();
        const button = createHistoryButton(anchor, action)!;
        expect(button.previousElementSibling).toBe(document.querySelector('a'));
        button.click();
        expect(action).toHaveBeenCalledWith(button);
        expect(nativeClick).not.toHaveBeenCalled();
    });
});
