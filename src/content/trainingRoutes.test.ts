import { afterEach, expect, it, vi } from 'vitest';
import { initObserver } from './observer';
import { handleJuniorPage, leaveJuniorPage, scanJuniorPage } from './juniorPage';
import { handleTrainingPlayerPage, leaveTrainingPlayerPage, scanTrainingPlayerPage } from './trainingPlayerPage';

vi.mock('./observer', () => ({ initObserver: vi.fn() }));
vi.mock('./ui', () => ({ processSquadTable: vi.fn(), processPlayerPage: vi.fn() }));
vi.mock('../core/gapDetector', () => ({ reconcileGaps: vi.fn() }));
vi.mock('../core/sync', () => ({ syncData: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./juniorPage', () => ({
    handleJuniorPage: vi.fn().mockResolvedValue(undefined), leaveJuniorPage: vi.fn(), scanJuniorPage: vi.fn()
}));
vi.mock('./trainingPlayerPage', () => ({
    handleTrainingPlayerPage: vi.fn(), leaveTrainingPlayerPage: vi.fn(), scanTrainingPlayerPage: vi.fn()
}));
vi.mock('../core/repository', () => ({
    getAllData: vi.fn(), restoreData: vi.fn(), getLastSyncWeek: vi.fn(), clearDatabase: vi.fn()
}));
vi.mock('../core/juniorSync', () => ({ invalidateJuniorSync: vi.fn() }));
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
    expect(handleJuniorPage).toHaveBeenCalledWith(juniorView);
    expect(handleTrainingPlayerPage).toHaveBeenCalledWith(playerView);

    const setupView = { pathname: '/en/app/training/training-setup/', names: new Map() };
    window.history.replaceState({}, '', setupView.pathname);
    vi.mocked(scanJuniorPage).mockReturnValue(null);
    vi.mocked(scanTrainingPlayerPage).mockReturnValue(setupView);
    onPageChanged();
    expect(leaveJuniorPage).toHaveBeenCalled();
    expect(handleTrainingPlayerPage).toHaveBeenLastCalledWith(setupView);

    window.history.replaceState({}, '', '/en/app/overview/');
    vi.mocked(scanTrainingPlayerPage).mockReturnValue(null);
    onPageChanged();
    expect(leaveTrainingPlayerPage).toHaveBeenCalled();
});
