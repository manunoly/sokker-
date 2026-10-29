import { HOVER_DELAY_MS } from './hoverIntent';
import academy from './fixtures/betaAcademy.html?raw';
import betaReport from './fixtures/betaTrainingReport.html?raw';
import { resolvePageContext } from './pageContext';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTodayInfo } from '../core/apiClient';
import { syncVisibleJuniors, cancelQueuedJuniorSync } from '../core/juniorSync';
import { showJuniorCard, hideJuniorCard } from './juniorCard';
import { handleJuniorPage, leaveJuniorPage, scanJuniorPage } from './juniorPage';

vi.mock('../core/apiClient', () => ({ fetchTodayInfo: vi.fn() }));
vi.mock('../core/juniorSync', () => ({
    syncVisibleJuniors: vi.fn().mockResolvedValue(undefined),
    cancelQueuedJuniorSync: vi.fn()
}));
vi.mock('./juniorCard', () => ({
    showJuniorCard: vi.fn().mockResolvedValue(undefined),
    scheduleJuniorCardHide: vi.fn(),
    hideJuniorCard: vi.fn()
}));

const current = vi.mocked(fetchTodayInfo);
const sync = vi.mocked(syncVisibleJuniors);

function reportRow(id: string, junior = true): string {
    return `<tr class="table-row" data-row-id="${id}">
      <td class="table__cell--player"><div class="text c-text-link">Player ${id}</div></td>
      ${junior ? '<td class="table__cell--exp"></td><td class="table__cell--weeks"></td>' : ''}
    </tr>`;
}

function academyRow(id: string): string {
    return `<tr id="juniorRow${id}"><td><strong>Player ${id}</strong></td></tr>`;
}

function setPage(path: string, html: string): void {
    window.history.replaceState({}, '', path);
    document.body.innerHTML = html;
}

function today(week: unknown = 1213, teamId: unknown = 42) {
    return { week, teamId } as Awaited<ReturnType<typeof fetchTodayInfo>>;
}

beforeEach(() => {
    vi.useFakeTimers();
    leaveJuniorPage();
    vi.clearAllMocks();
    current.mockResolvedValue(today());
    sync.mockResolvedValue(undefined);
    setPage('/app/overview/', '');
});

describe('scanJuniorPage', () => {
    it('selects junior report rows by structure across route languages, ignoring main-team rows', () => {
        setPage('/es/app/training/reports/details/1213/',
            `<table>${reportRow('12')}${reportRow('55', false)}${reportRow('bad')}${reportRow('17')}</table>`);
        const view = scanJuniorPage(window.location.pathname, document);
        expect(view?.kind).toBe('report');
        expect([...view!.names.keys()]).toEqual([12, 17]);
        expect(scanJuniorPage('/app/training/reports/details/1213', document)?.kind).toBe('report');
        expect(scanJuniorPage('/app/training/reports/details/nope', document)).toBeNull();
    });

    it('reads classic academy IDs and rejects unrelated routes', () => {
        setPage('/juniors/teamID/42', `<table>${academyRow('7')}${academyRow('oops')}</table>`);
        const view = scanJuniorPage(window.location.pathname, document);
        expect(view?.kind).toBe('academy');
        expect([...view!.names.keys()]).toEqual([7]);
        expect(scanJuniorPage('/juniors/teamID/nope', document)).toBeNull();
        expect(scanJuniorPage('/app/squad/', document)).toBeNull();
    });
});

describe('handleJuniorPage', () => {
    it('delays juvenile hover, cancels a passing pointer and ignores recycled row IDs', async () => {
        setPage('/en/app/training/reports/details/1213/', `<table>${reportRow('7')}</table>`);
        await handleJuniorPage(scanJuniorPage(location.pathname, document)!);
        const name = document.querySelector<HTMLElement>('.text.c-text-link')!;
        name.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        vi.advanceTimersByTime(HOVER_DELAY_MS - 1);
        expect(showJuniorCard).not.toHaveBeenCalled();
        name.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        vi.advanceTimersByTime(HOVER_DELAY_MS);
        expect(showJuniorCard).not.toHaveBeenCalled();
        name.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        name.closest<HTMLElement>('tr')!.dataset.rowId = '8';
        vi.advanceTimersByTime(HOVER_DELAY_MS);
        expect(showJuniorCard).not.toHaveBeenCalled();
    });
    it('shares /current on partial render, only syncs new ID signatures, and delegates replaced names', async () => {
        setPage('/en/app/training/reports/details/1213/', `<table>${reportRow('7')}</table>`);
        await handleJuniorPage(scanJuniorPage(window.location.pathname, document)!);
        expect(current).toHaveBeenCalledTimes(1);
        expect(sync).toHaveBeenCalledTimes(1);
        expect(sync).toHaveBeenCalledWith({ teamId: 42, week: 1213, kind: 'report', ids: [7] });

        // The site replaces its row without adding an ID: interaction still works, no sync.
        setPage('/en/app/training/reports/details/1213/', `<table>${reportRow('7')}</table>`);
        await handleJuniorPage(scanJuniorPage(window.location.pathname, document)!);
        expect(sync).toHaveBeenCalledTimes(1);
        const name = document.querySelector<HTMLElement>('.text.c-text-link')!;
        expect(name.tabIndex).toBe(0);
        name.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); vi.advanceTimersByTime(HOVER_DELAY_MS);
        expect(showJuniorCard).toHaveBeenCalledWith(name, 42, 7, 'Player 7', 'left', { isCurrent: expect.any(Function) });
        name.focus();
        expect(showJuniorCard).toHaveBeenCalledWith(name, 42, 7, 'Player 7', 'left', { isCurrent: expect.any(Function) });
        expect(current).toHaveBeenCalledTimes(1);
        expect(sync).toHaveBeenCalledTimes(1);

        setPage('/en/app/training/reports/details/1213/', `<table>${reportRow('7')}${reportRow('8')}</table>`);
        await handleJuniorPage(scanJuniorPage(window.location.pathname, document)!);
        expect(current).toHaveBeenCalledTimes(1);
        expect(sync).toHaveBeenCalledTimes(2);
        expect(sync).toHaveBeenLastCalledWith({ teamId: 42, week: 1213, kind: 'report', ids: [7, 8] });
    });

    it.each([today(0, 42), today(1213, 0), today('1213', 42), today(1213, 1.5)])(
        'does not attach or sync when /current is malformed', async (badToday) => {
            current.mockResolvedValue(badToday);
            setPage('/juniors/teamID/42', `<table>${academyRow('7')}</table>`);
            await handleJuniorPage(scanJuniorPage(window.location.pathname, document)!);
            expect(sync).not.toHaveBeenCalled();
            document.querySelector('strong')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); vi.advanceTimersByTime(HOVER_DELAY_MS);
            expect(showJuniorCard).not.toHaveBeenCalled();
        }
    );

    it('rejects another academy before attaching card events or syncing', async () => {
        setPage('/juniors/teamID/99', `<table>${academyRow('7')}</table>`);
        await handleJuniorPage(scanJuniorPage(window.location.pathname, document)!);
        expect(sync).not.toHaveBeenCalled();
        document.querySelector('strong')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); vi.advanceTimersByTime(HOVER_DELAY_MS);
        expect(showJuniorCard).not.toHaveBeenCalled();
    });

    it('syncs and focuses names in the owner academy', async () => {
        setPage('/juniors/teamID/42', `<table>${academyRow('7')}</table>`);
        await handleJuniorPage(scanJuniorPage(window.location.pathname, document)!);
        expect(sync).toHaveBeenCalledWith({ teamId: 42, week: 1213, kind: 'academy', ids: [7] });
        const name = document.querySelector<HTMLElement>('strong')!;
        expect(name.tabIndex).toBe(0);
        name.focus();
        expect(showJuniorCard).toHaveBeenCalledWith(name, 42, 7, 'Player 7', 'right', { isCurrent: expect.any(Function) });
        expect(sync).toHaveBeenCalledTimes(1);
    });

    it('discards /current arriving after navigation away', async () => {
        let complete!: (value: ReturnType<typeof today>) => void;
        current.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
        setPage('/en/app/training/reports/details/1213/', `<table>${reportRow('7')}</table>`);
        const pending = handleJuniorPage(scanJuniorPage(window.location.pathname, document)!);
        setPage('/juniors/teamID/99', `<table>${academyRow('7')}</table>`);
        // Simulates the observer processing the route change while the old /current is pending.
        const another = handleJuniorPage(scanJuniorPage(window.location.pathname, document)!);
        complete(today());
        await Promise.all([pending, another]);
        expect(sync).not.toHaveBeenCalled();
        document.querySelector('strong')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); vi.advanceTimersByTime(HOVER_DELAY_MS);
        expect(showJuniorCard).not.toHaveBeenCalled();
        expect(cancelQueuedJuniorSync).toHaveBeenCalled();
        expect(hideJuniorCard).toHaveBeenCalled();
    });
});


describe('observed beta academy and report', () => {
    const context = () => resolvePageContext(new URL(window.location.pathname, 'https://sokker.org'))!;
    it('validates both academy identities and syncs only an own team, preserving native clicks', async () => {
        setPage('/juniors/42/', academy);
        const view = scanJuniorPage(context(), document)!;
        expect([...view.names.keys()]).toEqual([12345, 12346]);
        const button = view.names.get(12345)!;
        const native = vi.fn(); button.addEventListener('click', native);
        await handleJuniorPage(view);
        button.focus();
        expect(showJuniorCard).toHaveBeenCalledWith(button, 42, 12345, 'Junior One', 'right', { isCurrent: expect.any(Function) });
        button.click(); expect(native).toHaveBeenCalledOnce();
        expect(sync).toHaveBeenCalledWith({ teamId: 42, week: 1213, kind: 'academy', ids: [12345, 12346] });
        const requests = current.mock.calls.length;
        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); vi.advanceTimersByTime(HOVER_DELAY_MS);
        expect(current).toHaveBeenCalledTimes(requests);

        setPage('/juniors/99/', academy);
        await handleJuniorPage(scanJuniorPage(context(), document)!);
        expect(sync).toHaveBeenCalledTimes(1);
        vi.mocked(showJuniorCard).mockClear();
        document.querySelector('button')!.focus();
        expect(showJuniorCard).not.toHaveBeenCalled();
    });
    it('rejects mismatched, unsafe and hidden academy IDs and handles replaced names', async () => {
        setPage('/juniors/42', academy);
        document.querySelector('[id="junior-row-12346"]')!.id = 'junior-row-12345';
        expect([...scanJuniorPage(context(), document)!.names.keys()]).toEqual([12345]);
        await handleJuniorPage(scanJuniorPage(context(), document)!);
        const replacement = document.createElement('button'); replacement.textContent = 'Junior One';
        document.querySelector('button')!.replaceWith(replacement);
        await handleJuniorPage(scanJuniorPage(context(), document)!);
        replacement.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); vi.advanceTimersByTime(HOVER_DELAY_MS);
        expect(showJuniorCard).toHaveBeenLastCalledWith(replacement, 42, 12345, 'Junior One', 'right', { isCurrent: expect.any(Function) });
        expect(sync).toHaveBeenCalledTimes(1);
        document.querySelector('tr')!.setAttribute('data-row-id', '9007199254740992');
        expect(scanJuniorPage(context(), document)!.names.size).toBe(0);
    });
    it('keeps report juniors inside their observed section', async () => {
        setPage('/training/reports/details/1000/', betaReport);
        const view = scanJuniorPage(context(), document)!;
        expect(view.kind).toBe('report');
        expect([...view.names.keys()]).toEqual([12346]);
        await handleJuniorPage(view);
        expect(sync).toHaveBeenCalledWith({ teamId: 42, week: 1213, kind: 'report', ids: [12346] });
    });
});


it('pins from separate junior controls, reuses rescans and ignores stale IDs before a rescan', async () => {
    setPage('/juniors/42', academy);
    const context = resolvePageContext(new URL(location.pathname, 'https://sokker.org'))!;
    await handleJuniorPage(scanJuniorPage(context, document)!);
    await handleJuniorPage(scanJuniorPage(context, document)!);
    expect(document.querySelectorAll('[data-sokkerpp-owned="pin"]')).toHaveLength(2);
    const name = document.querySelector<HTMLButtonElement>('span[id="junior-row-12345"] > button')!;
    const button = name.nextElementSibling as HTMLButtonElement;
    expect(button.matches('[data-sokkerpp-owned="pin"]')).toBe(true);
    const native = vi.fn(); name.addEventListener('click', native);
    const requests = current.mock.calls.length;
    button.click();
    expect(native).not.toHaveBeenCalled();
    expect(showJuniorCard).toHaveBeenLastCalledWith(name, 42, 12345, 'Junior One', 'right', {
        pinned: true, returnFocus: button, isCurrent: expect.any(Function)
    });
    expect(current).toHaveBeenCalledTimes(requests);
    expect(sync).toHaveBeenCalledTimes(1);
    vi.mocked(showJuniorCard).mockClear();
    name.closest('tr')!.dataset.rowId = '12347';
    button.click();
    expect(showJuniorCard).not.toHaveBeenCalled();
    leaveJuniorPage();
    expect(document.querySelectorAll('[data-sokkerpp-owned="pin"]')).toHaveLength(0);
});

it('keeps classic junior hover/focus when + controls are hidden and removes controls on remount', async () => {
    setPage('/juniors/teamID/42', `<table>${academyRow('7')}</table>`);
    await handleJuniorPage(scanJuniorPage(location.pathname, document)!);
    const name = document.querySelector<HTMLElement>('strong')!;
    const button = name.nextElementSibling as HTMLButtonElement;
    button.hidden = true;
    name.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); vi.advanceTimersByTime(HOVER_DELAY_MS);
    name.focus();
    expect(showJuniorCard).toHaveBeenCalledWith(name, 42, 7, 'Player 7', 'right', { isCurrent: expect.any(Function) });
    name.parentElement!.innerHTML = '<strong>Replacement</strong>';
    await handleJuniorPage(scanJuniorPage(location.pathname, document)!);
    expect(button.isConnected).toBe(false);
    expect(document.querySelectorAll('[data-sokkerpp-owned="pin"]')).toHaveLength(1);
    expect(hideJuniorCard).toHaveBeenCalled();
});

afterEach(() => { leaveJuniorPage(); vi.useRealTimers(); });
