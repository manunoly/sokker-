import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTodayInfo } from '../core/api';
import { getPlayerHistory } from '../core/repository';
import { openZoomChart, showHistoryTooltip, showTooltip } from './tooltip';
import { processPlayerPage } from './ui';

vi.mock('../core/api', () => ({ fetchTodayInfo: vi.fn() }));
vi.mock('../core/repository', () => ({ getPlayerHistory: vi.fn() }));
vi.mock('./tooltip', () => ({
    showTooltip: vi.fn(), showHistoryTooltip: vi.fn(), openZoomChart: vi.fn(), scheduleHide: vi.fn()
}));

beforeEach(() => {
    window.history.pushState({}, '', '/en/app/player/PID/7/');
    vi.mocked(fetchTodayInfo).mockResolvedValue({ day: 6 } as Awaited<ReturnType<typeof fetchTodayInfo>>);
    vi.mocked(getPlayerHistory).mockResolvedValue(null);
});

afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
});

describe('player-page keyboard wiring', () => {
    it('opens summary and skill card from focus, and pins the skill from Enter', async () => {
        const container = document.createElement('div');
        container.innerHTML = '<div class="h5 title-block-1"><a href="/en/app/player/PID/7/">Player</a></div>'
            + '<table class="table-skills"><tbody><tr><td><strong>Level <span class="skillNameNumber">10</span></strong> Pace</td></tr></tbody></table>';
        document.body.appendChild(container);
        await processPlayerPage(container);
        const name = container.querySelector<HTMLElement>('.h5 a')!;
        const skillCell = container.querySelector<HTMLElement>('.table-skills td')!;
        name.focus();
        expect(showHistoryTooltip).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 7, name);
        skillCell.focus();
        expect(showTooltip).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 7, 'pace', skillCell);
        skillCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(openZoomChart).toHaveBeenCalledWith(7, 'pace', skillCell);
    });
});
