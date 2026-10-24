// @vitest-environment-options {"url":"https://sokker.org/"}
import { afterEach, expect, it, vi } from 'vitest';
import { initObserver } from './observer';
import { handleJuniorPage, leaveJuniorPage, scanJuniorPage } from './juniorPage';
import { handleTrainingPlayerPage, leaveTrainingPlayerPage, scanTrainingPlayerPage } from './trainingPlayerPage';

vi.mock('./observer', () => ({ initObserver: vi.fn(), refreshObserver: vi.fn() }));
vi.mock('./ui', () => ({ processSquadTable: vi.fn(), processPlayerPage: vi.fn(), processBetaPlayers: vi.fn(), invalidatePlayerCache: vi.fn() }));
vi.mock('../core/gapDetector', () => ({ reconcileGaps: vi.fn() }));
vi.mock('../core/sync', () => ({ syncData: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./juniorPage', () => ({
    handleJuniorPage: vi.fn().mockResolvedValue(undefined), leaveJuniorPage: vi.fn(), scanJuniorPage: vi.fn()
}));
vi.mock('./trainingPlayerPage', () => ({
    handleTrainingPlayerPage: vi.fn(), leaveTrainingPlayerPage: vi.fn(), scanTrainingPlayerPage: vi.fn()
}));
vi.mock('../core/storageClient', () => ({ migrateCurrentOrigin: vi.fn().mockResolvedValue({ state: 'absent' }), ensureStorageReady: vi.fn().mockResolvedValue({ epoch: 'test-epoch', revision: 0, migration: {} }), getLastSyncWeek: vi.fn(), subscribeStorageChanges: vi.fn() }));
vi.mock('../core/juniorSync', () => ({ invalidateJuniorSync: vi.fn(), cancelQueuedJuniorSync: vi.fn() }));
vi.mock('./juniorCard', () => ({ hideJuniorCard: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it('activates first-team names beside junior names on training reports, and on training setup', async () => {
    vi.stubGlobal('chrome', { runtime: { onMessage: { addListener: vi.fn() } } });
    await import('./main');
    const onPageChanged = vi.mocked(initObserver).mock.calls[0][3]!;
    const juniorView = { kind: 'report' as const, pathname: '/en/app/training/reports/details/1213/', names: new Map() };
    const playerView = { pathname: juniorView.pathname, names: new Map() };

    window.history.replaceState({}, '', juniorView.pathname);
    vi.mocked(scanJuniorPage).mockReturnValue(juniorView);
    vi.mocked(scanTrainingPlayerPage).mockReturnValue(playerView);
    onPageChanged();
    await vi.waitFor(() => expect(handleJuniorPage).toHaveBeenCalledWith(juniorView));
    expect(handleTrainingPlayerPage).toHaveBeenCalledWith(playerView);

    const setupView = { pathname: '/en/app/training/training-setup/', names: new Map() };
    window.history.replaceState({}, '', setupView.pathname);
    vi.mocked(scanJuniorPage).mockReturnValue(null);
    vi.mocked(scanTrainingPlayerPage).mockReturnValue(setupView);
    onPageChanged();
    await vi.waitFor(() => expect(leaveJuniorPage).toHaveBeenCalled());
    expect(handleTrainingPlayerPage).toHaveBeenLastCalledWith(setupView);

    window.history.replaceState({}, '', '/en/app/overview/');
    vi.mocked(initObserver).mock.calls[0][5]!(null);
    vi.mocked(scanTrainingPlayerPage).mockReturnValue(null);
    onPageChanged();
    await vi.waitFor(() => expect(leaveTrainingPlayerPage).toHaveBeenCalled());
});
