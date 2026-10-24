import betaSetup from './fixtures/betaTrainingSetup.html?raw';
import betaReport from './fixtures/betaTrainingReport.html?raw';
import { resolvePageContext } from './pageContext';
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

describe('observed beta training structures', () => {
    const context = () => resolvePageContext(new URL(location.pathname, 'https://sokker.org'))!;
    it('selects setup links only when structural identity matches, preserving their native action', () => {
        setPage('/training/training-setup/', betaSetup);
        const view = scanTrainingPlayerPage(context(), document)!;
        expect([...view.names.keys()]).toEqual([12345, 12346]);
        handleTrainingPlayerPage(view);
        const link = view.names.get(12345)!;
        const native = vi.fn(); link.addEventListener('click', event => { native(); event.preventDefault(); });
        link.focus(); expect(showHistoryTooltip).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 12345, link);
        link.click(); expect(native).toHaveBeenCalledOnce();
        expect(link.getAttribute('href')).toBe('/player/12345/development?from=training');
        document.querySelectorAll('tr')[1].dataset.rowId = '12345';
        expect([...scanTrainingPlayerPage(context(), document)!.names.keys()]).toEqual([12345]);
        link.setAttribute('href', 'https://example.test/player/12345/development?from=training');
        expect(scanTrainingPlayerPage(context(), document)!.names.size).toBe(0);
    });
    it('separates report first-team names from juniors and rejects development as a profile', () => {
        setPage('/training/reports/details/1000/', betaReport);
        const view = scanTrainingPlayerPage(context(), document)!;
        expect([...view.names.keys()]).toEqual([12345]);
        handleTrainingPlayerPage(view);
        view.names.get(12345)!.dispatchEvent(new MouseEvent('mouseenter'));
        expect(showHistoryTooltip).toHaveBeenCalledWith(0, 0, 12345, view.names.get(12345));
        expect(resolvePageContext(new URL('https://sokker.org/player/12345/development?from=training'))).toBeNull();
    });
});


it.each([
    ['/en/app/training/training-setup/', '<a href="/en/app/player/PID/7/">Player Seven</a>', 7],
    ['/en/app/training/reports/details/1213/', `<table>${reportRow('7')}${reportRow('8', true)}</table>`, 7],
    ['/training/training-setup/', betaSetup, 12345],
    ['/training/reports/details/1000/', betaReport, 12345]
] as const)('pins a separate name control on %s, preserves native clicks and cleans up', (path, html, id) => {
    setPage(path, html);
    const view = scanTrainingPlayerPage(location.pathname, document)!;
    handleTrainingPlayerPage(view);
    handleTrainingPlayerPage(scanTrainingPlayerPage(location.pathname, document)!);
    const name = view.names.get(id)!;
    const control = name.nextElementSibling as HTMLButtonElement;
    expect(document.querySelectorAll('[data-sokkerpp-owned="pin"]')).toHaveLength(view.names.size);
    expect(control.matches('[data-sokkerpp-owned="pin"]')).toBe(true);
    expect(control.dataset.historyVariant).toBe('name');
    expect(control.closest('a')).toBeNull();
    const native = vi.fn(); name.addEventListener('click', event => { native(); event.preventDefault(); });
    name.click(); expect(native).toHaveBeenCalledOnce();
    control.click(); expect(native).toHaveBeenCalledOnce();
    expect(showHistoryTooltip).toHaveBeenLastCalledWith(0, 0, id, control, { pinned: true });
    control.hidden = true;
    name.dispatchEvent(new MouseEvent('mouseenter'));
    name.focus();
    expect(showHistoryTooltip).toHaveBeenLastCalledWith(0, 0, id, name);
    leaveTrainingPlayerPage();
    expect(document.querySelectorAll('[data-sokkerpp-owned="pin"]')).toHaveLength(0);
});

it('rejects changed setup hrefs before rescan and pins the new identity after reuse', () => {
    setPage('/training/training-setup/', betaSetup);
    const view = scanTrainingPlayerPage(location.pathname, document)!;
    handleTrainingPlayerPage(view);
    const name = view.names.get(12345)!;
    const previous = name.nextElementSibling as HTMLButtonElement;
    name.setAttribute('href', '/player/12347/development?from=training');
    previous.click();
    name.focus();
    expect(showHistoryTooltip).not.toHaveBeenCalled();
    name.closest<HTMLElement>('tr')!.dataset.rowId = '12347';
    handleTrainingPlayerPage(scanTrainingPlayerPage(location.pathname, document)!);
    expect(previous.isConnected).toBe(false);
    const next = name.nextElementSibling as HTMLButtonElement;
    next.click();
    expect(showHistoryTooltip).toHaveBeenLastCalledWith(0, 0, 12347, next, { pinned: true });
    expect(document.querySelectorAll('[data-sokkerpp-owned="pin"]')).toHaveLength(2);
});

it('discards a pending training pin when its row changes, without closing a newer presentation', async () => {
    setPage('/en/app/training/reports/details/1213/', `<table>${reportRow('7')}${reportRow('9')}</table>`);
    const view = scanTrainingPlayerPage(location.pathname, document)!;
    handleTrainingPlayerPage(view);
    const name = view.names.get(7)!;
    const control = name.nextElementSibling as HTMLButtonElement;
    let finish!: () => void;
    vi.mocked(showHistoryTooltip).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    control.click();
    name.closest<HTMLElement>('tr')!.dataset.rowId = '8';
    vi.mocked(hideTooltip).mockClear();
    finish(); await Promise.resolve();
    expect(hideTooltip).toHaveBeenCalledOnce();

    let finishOlder!: () => void;
    name.closest<HTMLElement>('tr')!.dataset.rowId = '7';
    vi.mocked(showHistoryTooltip).mockReturnValueOnce(new Promise(resolve => { finishOlder = resolve; }));
    control.click();
    name.closest<HTMLElement>('tr')!.dataset.rowId = '8';
    (view.names.get(9)!.nextElementSibling as HTMLButtonElement).click();
    vi.mocked(hideTooltip).mockClear();
    finishOlder(); await Promise.resolve();
    expect(hideTooltip).not.toHaveBeenCalled();
});
