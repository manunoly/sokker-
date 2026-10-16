import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateJuniorSync } from '../core/juniorSync';
import { clearDatabase, restoreData } from '../core/repository';
import { hideJuniorCard } from './juniorCard';

vi.mock('./observer', () => ({ initObserver: vi.fn() }));
vi.mock('./ui', () => ({ processSquadTable: vi.fn(), processPlayerPage: vi.fn() }));
vi.mock('../core/gapDetector', () => ({ reconcileGaps: vi.fn() }));
vi.mock('../core/sync', () => ({ syncData: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./juniorPage', () => ({
    handleJuniorPage: vi.fn(), leaveJuniorPage: vi.fn(), scanJuniorPage: vi.fn()
}));
vi.mock('../core/repository', () => ({
    getAllData: vi.fn(), restoreData: vi.fn(), getLastSyncWeek: vi.fn(), clearDatabase: vi.fn()
}));
vi.mock('../core/juniorSync', () => ({ invalidateJuniorSync: vi.fn() }));
vi.mock('./juniorCard', () => ({ hideJuniorCard: vi.fn() }));

type MessageListener = (
    request: { action: string; data?: unknown },
    sender: unknown,
    sendResponse: (response: unknown) => void
) => boolean;

let listener: MessageListener;

beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('chrome', {
        runtime: {
            onMessage: { addListener: (callback: MessageListener) => { listener = callback; } }
        }
    });
    await import('./main');
});

describe('juvenile writes during data management', () => {
    it.each([
        ['IMPORT_DATA', restoreData],
        ['CLEAR_DATA', clearDatabase]
    ])('drains juvenile sync before %s', async (action, operation) => {
        let finishInvalidation!: () => void;
        vi.mocked(invalidateJuniorSync).mockReturnValue(new Promise<void>((resolve) => {
            finishInvalidation = resolve;
        }));
        vi.mocked(operation).mockResolvedValue(undefined);
        const sendResponse = vi.fn();

        expect(listener({ action, data: { juniors: [] } }, null, sendResponse)).toBe(true);
        expect(invalidateJuniorSync).toHaveBeenCalledOnce();
        expect(operation).not.toHaveBeenCalled();

        finishInvalidation();
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ status: 'success' }));
        expect(operation).toHaveBeenCalledOnce();
        expect(hideJuniorCard).toHaveBeenCalledOnce();
        if (action === 'IMPORT_DATA') expect(operation).toHaveBeenCalledWith({ juniors: [] });
    });
});
