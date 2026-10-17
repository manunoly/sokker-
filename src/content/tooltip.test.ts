import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlayerHistory } from '../core/repository';
import type { PlayerData, PlayerHistoryEntry } from '../types/index';
import { hideTooltip, openZoomChart, scheduleHide, showHistoryTooltip, showTooltip } from './tooltip';

vi.mock('../core/repository', () => ({ getPlayerHistory: vi.fn() }));
vi.mock('../ui-components/playerSkillCanvas', () => ({ drawPlayerSkillChart: vi.fn() }));

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
        expect(card.textContent).toContain('Habilidades generales ++');
        expect(card.textContent).toContain('Registro');
        expect(card.querySelectorAll('[data-player-skill-column]')).toHaveLength(2);
        expect(card.querySelector('table')).not.toBeNull();
        expect(parseInt(card.style.width, 10)).toBeGreaterThan(630);
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
        expect(text).toContain('Ritmo observado');
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
        expect(card.style.left).toBe('188px');
        expect(card.textContent).toContain('Ritmo observado');
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
        expect(card.style.width).toBe('800px');
        expect(card.querySelector('table')?.querySelectorAll('th')).toHaveLength(13);
    });

    it('allows the summary to use 80 percent of a wide viewport', async () => {
        vi.stubGlobal('innerWidth', 1920);
        const trigger = anchor();
        await showHistoryTooltip(130, 110, 7, trigger);
        const card = document.querySelector<HTMLElement>('#sokkerpp-history-tooltip')!;
        expect(card.style.width).toBe('1536px');
    });
});
