import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hideTooltip, scheduleHide, showHistoryTooltip } from './tooltip';
import { handleTrainingPlayerPage, leaveTrainingPlayerPage, scanTrainingPlayerPage } from './trainingPlayerPage';

vi.mock('./tooltip', () => ({
    hideTooltip: vi.fn(),
    scheduleHide: vi.fn(),
    showHistoryTooltip: vi.fn().mockResolvedValue(undefined)
}));

function reportRow(id: string, junior = false): string {
    return `<tr class="table-row" data-row-id="${id}">
      <td class="table__cell--player"><span class="text c-text-link">Player ${id}</span></td>
      ${junior ? '<td class="table__cell--exp"></td><td class="table__cell--weeks"></td>' : ''}
    </tr>`;
}

function setPage(path: string, html: string): void {
    window.history.replaceState({}, '', path);
    document.body.innerHTML = html;
}

beforeEach(() => {
    leaveTrainingPlayerPage();
    vi.clearAllMocks();
    setPage('/en/app/overview/', '');
});

describe('training first-team names', () => {
    it('selects main-team report rows without taking over junior rows', () => {
        setPage('/es/app/training/reports/details/1213/',
            `<table>${reportRow('12')}${reportRow('55', true)}${reportRow('bad')}${reportRow('17')}
            <tr class="table-row" data-row-id="80"><td class="table__cell--player">
              <a href="/en/app/player/PID/80/">Junior link</a></td><td class="table__cell--weeks"></td></tr>
            </table>`);
        const view = scanTrainingPlayerPage(location.pathname, document);
        expect([...view!.names.keys()]).toEqual([12, 17]);
        expect(scanTrainingPlayerPage('/app/training/reports/details/1213', document)?.names.size).toBe(2);
        expect(scanTrainingPlayerPage('/app/training/reports/details/nope', document)).toBeNull();
    });

    it('finds linked players on training setup across supported player URL formats', () => {
        setPage('/en/app/training/training-setup/', `<main>
            <a href="/en/app/player/PID/7/">Player Seven</a>
            <a href="/en/app/player/ID_player/8/">Player Eight</a>
            <a href="/en/app/junior/9/">Junior Nine</a>
        </main>`);
        const view = scanTrainingPlayerPage(location.pathname, document);
        expect([...view!.names.keys()]).toEqual([7, 8]);
        expect(scanTrainingPlayerPage('/app/squad/', document)).toBeNull();
    });

    it('opens the existing local modal on hover or focus, without duplicate listeners after rerender', () => {
        setPage('/en/app/training/reports/details/1213/', `<table>${reportRow('7')}${reportRow('8', true)}</table>`);
        const view = scanTrainingPlayerPage(location.pathname, document)!;
        handleTrainingPlayerPage(view);
        handleTrainingPlayerPage(scanTrainingPlayerPage(location.pathname, document)!);
        const name = view.names.get(7)!;
        expect(name.tabIndex).toBe(0);
        name.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showHistoryTooltip).toHaveBeenCalledOnce();
        expect(showHistoryTooltip).toHaveBeenCalledWith(0, 0, 7, name);
        name.focus();
        expect(showHistoryTooltip).toHaveBeenCalledTimes(2);
        name.dispatchEvent(new MouseEvent('mouseleave'));
        expect(scheduleHide).toHaveBeenCalled();
        view.names.get(8)?.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showHistoryTooltip).toHaveBeenCalledTimes(2);

        setPage('/en/app/training/reports/details/1213/', `<table>${reportRow('7')}</table>`);
        handleTrainingPlayerPage(scanTrainingPlayerPage(location.pathname, document)!);
        const replacement = document.querySelector<HTMLElement>('.text.c-text-link')!;
        replacement.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showHistoryTooltip).toHaveBeenCalledTimes(3);
        expect(showHistoryTooltip).toHaveBeenLastCalledWith(0, 0, 7, replacement);
    });

    it('stops responding and closes the card after leaving a training route', () => {
        setPage('/en/app/training/training-setup/', '<a href="/en/app/player/PID/7/">Player</a>');
        handleTrainingPlayerPage(scanTrainingPlayerPage(location.pathname, document)!);
        const name = document.querySelector<HTMLElement>('a')!;
        setPage('/en/app/overview/', '');
        leaveTrainingPlayerPage();
        expect(hideTooltip).toHaveBeenCalled();
        name.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showHistoryTooltip).not.toHaveBeenCalled();
    });
});
