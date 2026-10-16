import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTodayInfo } from '../core/api';
import { syncVisibleJuniors, cancelQueuedJuniorSync } from '../core/juniorSync';
import { showJuniorCard, hideJuniorCard } from './juniorCard';
import { handleJuniorPage, leaveJuniorPage, scanJuniorPage } from './juniorPage';

vi.mock('../core/api', () => ({ fetchTodayInfo: vi.fn() }));
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
        name.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(showJuniorCard).toHaveBeenCalledWith(name, 42, 7, 'Player 7', 'left');
        name.focus();
        expect(showJuniorCard).toHaveBeenCalledWith(name, 42, 7, 'Player 7', 'left');
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
            document.querySelector('strong')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            expect(showJuniorCard).not.toHaveBeenCalled();
        }
    );

    it('rejects another academy before attaching card events or syncing', async () => {
        setPage('/juniors/teamID/99', `<table>${academyRow('7')}</table>`);
        await handleJuniorPage(scanJuniorPage(window.location.pathname, document)!);
        expect(sync).not.toHaveBeenCalled();
        document.querySelector('strong')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(showJuniorCard).not.toHaveBeenCalled();
    });

    it('syncs and focuses names in the owner academy', async () => {
        setPage('/juniors/teamID/42', `<table>${academyRow('7')}</table>`);
        await handleJuniorPage(scanJuniorPage(window.location.pathname, document)!);
        expect(sync).toHaveBeenCalledWith({ teamId: 42, week: 1213, kind: 'academy', ids: [7] });
        const name = document.querySelector<HTMLElement>('strong')!;
        expect(name.tabIndex).toBe(0);
        name.focus();
        expect(showJuniorCard).toHaveBeenCalledWith(name, 42, 7, 'Player 7', 'right');
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
        document.querySelector('strong')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(showJuniorCard).not.toHaveBeenCalled();
        expect(cancelQueuedJuniorSync).toHaveBeenCalled();
        expect(hideJuniorCard).toHaveBeenCalled();
    });
});
