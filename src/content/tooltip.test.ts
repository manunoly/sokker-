import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlayerHistory } from '../core/storageClient';
import type { PlayerData, PlayerHistoryEntry } from '../types/index';
import { hideTooltip, openZoomChart, scheduleHide, showHistoryTooltip, showTooltip } from './tooltip';

vi.mock('../core/storageClient', () => ({ getPlayerHistory: vi.fn() }));
vi.mock('../ui-components/playerSkillCanvas', () => ({ drawPlayerSkillChart: vi.fn(), PLAYER_SKILL_CHART_WIDTH: 680, PLAYER_SKILL_CHART_HEIGHT: 400 }));

const skills = { stamina: 7, pace: 10, technique: 8, passing: 9, keeper: 0, defending: 6, playmaking: 11, striker: 5, form: 10, teamwork: 8, tacticalDiscipline: 5, experience: 4 };
const entry = (week: number, level = 10): PlayerHistoryEntry => ({
    week, date: '2026-10-16', skills: { ...skills, pace: level }, source: 'training', value: 1,
    training: { kind: 'individual', skill: 'pace', position: 'MID', intensity: 85, minutes: 90 }
});
const player = (name = 'Player'): PlayerData => ({ id: 7, name, latest: entry(1214), history: [entry(1211, 9), entry(1212, 9), entry(1213, 10), entry(1214, 10)] });

function anchor(): HTMLSpanElement {
    const node = document.createElement('span');
    node.tabIndex = 0;
    node.textContent = 'Player';
    document.body.appendChild(node);
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ left: 120, right: 180, top: 100, bottom: 120, width: 60, height: 20 } as DOMRect);
    return node;
}

beforeEach(() => {
    document.documentElement.lang = 'es';
    vi.mocked(getPlayerHistory).mockResolvedValue(player());
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
});

afterEach(() => {
    hideTooltip();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('first-team hover integration', () => {
    it('reads local history once, shows the two-column summary and no network request', async () => {
        const trigger = anchor();
        const network = vi.fn();
        vi.stubGlobal('fetch', network);
        await showHistoryTooltip(130, 110, 7, trigger);
        const card = document.querySelector<HTMLElement>('#sokkerpp-history-tooltip')!;
        expect(getPlayerHistory).toHaveBeenCalledOnce();
        expect(network).not.toHaveBeenCalled();
        expect(card.style.display).toBe('block');
        expect(card.style.height).toBe('80vh');
        expect(card.style.overflowX).toBe('hidden');
        expect(card.textContent).toContain('Habilidades generales ++');
        expect(card.textContent).toContain('Registro');
        expect(card.querySelectorAll('[data-player-skill-column]')).toHaveLength(2);
        expect(card.querySelector('table')).not.toBeNull();
        expect(card.style.width).toBe('640px');
        expect(card.firstElementChild?.getAttribute('style')).toContain('height: 100%');
    });

    it('preserves native button accessibility and ArrowDown behavior during hover and close', async () => {
        const trigger=document.createElement('button');trigger.setAttribute('aria-expanded','false');
        trigger.setAttribute('aria-controls','native-menu');trigger.setAttribute('aria-keyshortcuts','ArrowDown');
        document.body.appendChild(trigger);const native=vi.fn();trigger.addEventListener('keydown',native);
        await showTooltip(130,110,7,'pace',trigger);
        const event=new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true});trigger.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);expect(native).toHaveBeenCalledOnce();
        expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(trigger.getAttribute('aria-controls')).toBe('native-menu');
        hideTooltip();expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(trigger.getAttribute('aria-controls')).toBe('native-menu');
        expect(trigger.getAttribute('aria-keyshortcuts')).toBe('ArrowDown');
    });

    it('ignores a stale IndexedDB result after selecting another skill', async () => {
        let release!: (value: PlayerData) => void;
        vi.mocked(getPlayerHistory).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
            .mockResolvedValueOnce(player('New player'));
        const trigger = anchor();
        const first = showHistoryTooltip(130, 110, 7, trigger);
        await showTooltip(130, 110, 7, 'pace', trigger);
        release(player('Old player'));
        await first;
        const text = document.querySelector('#sokkerpp-history-tooltip')?.textContent ?? '';
        expect(text).toContain('New player');
        expect(text).not.toContain('Old player');
        expect(text).toContain('Ritmo 10');
    });

    it('keeps the card open while the pointer crosses to it, and Escape closes it', async () => {
        const trigger = anchor();
        trigger.addEventListener('focus', () => { void showHistoryTooltip(130, 110, 7, trigger); });
        await showHistoryTooltip(130, 110, 7, trigger);
        const card = document.querySelector<HTMLElement>('#sokkerpp-history-tooltip')!;
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(document.activeElement).toBe(card);
        vi.useFakeTimers();
        scheduleHide();
        card.dispatchEvent(new MouseEvent('mouseenter'));
        vi.advanceTimersByTime(700);
        expect(card.style.display).toBe('block');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(card.style.display).toBe('none');
        expect(document.activeElement).toBe(trigger);
        expect(getPlayerHistory).toHaveBeenCalledOnce();
    });

    it('pins the native skill card on click and places it beside its trigger', async () => {
        const trigger = anchor();
        await openZoomChart(7, 'pace', trigger);
        const card = document.querySelector<HTMLElement>('#sokkerpp-history-tooltip')!;
        expect(card.style.position).toBe('fixed');
        expect(card.style.height).toBe('');
        expect(card.style.width).toBe('720px');
        expect(card.style.left).toBe('188px');
        expect(card.textContent).toContain('Ritmo 10');
        expect(card.querySelector('canvas')).not.toBeNull();
        expect(card.querySelector('button[aria-label="Descargar PNG"]')).not.toBeNull();
    });

    it('uses the wider below-anchor layout when neither side fits the summary', async () => {
        vi.stubGlobal('innerWidth', 400);
        const trigger = anchor();
        await showHistoryTooltip(130, 110, 7, trigger);
        const card = document.querySelector<HTMLElement>('#sokkerpp-history-tooltip')!;
        expect(card.style.width).toBe('384px');
        expect(card.style.left).toBe('8px');
        expect(card.style.top).toBe('128px');
    });

    it('keeps the original table fully visible when a centered desktop name has no wide side', async () => {
        vi.stubGlobal('innerWidth', 1000);
        const trigger = anchor();
        vi.mocked(trigger.getBoundingClientRect).mockReturnValue({
            left: 450, right: 510, top: 100, bottom: 120, width: 60, height: 20,
        } as DOMRect);
        await showHistoryTooltip(480, 110, 7, trigger);
        const card = document.querySelector<HTMLElement>('#sokkerpp-history-tooltip')!;
        expect(card.style.width).toBe('640px');
        expect(card.querySelector('table')?.querySelectorAll('th')).toHaveLength(13);
    });

    it('keeps the summary compact even on a wide viewport', async () => {
        vi.stubGlobal('innerWidth', 1920);
        const trigger = anchor();
        await showHistoryTooltip(130, 110, 7, trigger);
        const card = document.querySelector<HTMLElement>('#sokkerpp-history-tooltip')!;
        expect(card.style.width).toBe('640px');
    });
});
