import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    initObserver: vi.fn(), refreshObserver: vi.fn(), processSquadTable: vi.fn(), processPlayerPage: vi.fn(), processBetaPlayers: vi.fn(), invalidatePlayerCache: vi.fn(),
    syncData: vi.fn(), reconcileGaps: vi.fn(), migrateCurrentOrigin: vi.fn(), ensureStorageReady: vi.fn(), getLastSyncWeek: vi.fn(), subscribeStorageChanges: vi.fn(),
    fetchTodayInfo: vi.fn(), invalidateJuniorSync: vi.fn(), cancelQueuedJuniorSync: vi.fn(), hideJuniorCard: vi.fn(), hideTooltip: vi.fn(), leavePlayerBindings: vi.fn(),
    scanJuniorPage: vi.fn(), handleJuniorPage: vi.fn(), leaveJuniorPage: vi.fn(), scanTrainingPlayerPage: vi.fn(), handleTrainingPlayerPage: vi.fn(), leaveTrainingPlayerPage: vi.fn(),
    initHistoryButtonPreferences: vi.fn(),
}));
vi.mock('../core/historyButtonPreferences', () => ({ initHistoryButtonPreferences: mocks.initHistoryButtonPreferences }));
vi.mock('./observer', () => ({ initObserver: mocks.initObserver, refreshObserver: mocks.refreshObserver }));
vi.mock('./ui', () => ({ processSquadTable: mocks.processSquadTable, processPlayerPage: mocks.processPlayerPage, processBetaPlayers: mocks.processBetaPlayers, invalidatePlayerCache: mocks.invalidatePlayerCache }));
vi.mock('../core/gapDetector', () => ({ reconcileGaps: mocks.reconcileGaps }));
vi.mock('../core/sync', () => ({ syncData: mocks.syncData }));
vi.mock('../core/apiClient', () => ({ fetchTodayInfo: mocks.fetchTodayInfo }));
vi.mock('../core/storageClient', () => ({ migrateCurrentOrigin: mocks.migrateCurrentOrigin, ensureStorageReady: mocks.ensureStorageReady,
    getLastSyncWeek: mocks.getLastSyncWeek, subscribeStorageChanges: mocks.subscribeStorageChanges }));
vi.mock('../core/juniorSync', () => ({ invalidateJuniorSync: mocks.invalidateJuniorSync, cancelQueuedJuniorSync: mocks.cancelQueuedJuniorSync }));
vi.mock('./juniorCard', () => ({ hideJuniorCard: mocks.hideJuniorCard }));
vi.mock('./tooltip', () => ({ hideTooltip: mocks.hideTooltip }));
vi.mock('./playerBindings', () => ({ leavePlayerBindings: mocks.leavePlayerBindings }));
vi.mock('./juniorPage', () => ({ scanJuniorPage: mocks.scanJuniorPage, handleJuniorPage: mocks.handleJuniorPage, leaveJuniorPage: mocks.leaveJuniorPage }));
vi.mock('./trainingPlayerPage', () => ({ scanTrainingPlayerPage: mocks.scanTrainingPlayerPage, handleTrainingPlayerPage: mocks.handleTrainingPlayerPage, leaveTrainingPlayerPage: mocks.leaveTrainingPlayerPage }));
let listener: (request: unknown, sender: unknown, reply: (value: unknown) => void) => boolean | undefined;
const state = { epoch: 'epoch-1', revision: 0, migration: {} };
beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks(); document.body.replaceChildren();
    vi.stubGlobal('location', new URL('https://app.sokker.org/squad'));
    vi.stubGlobal('chrome', { runtime: { onMessage: { addListener: (fn: typeof listener) => { listener = fn; } } } });
    mocks.migrateCurrentOrigin.mockResolvedValue({ state: 'absent' });
    mocks.ensureStorageReady.mockResolvedValue(state);
    mocks.invalidateJuniorSync.mockResolvedValue(undefined);
    mocks.syncData.mockResolvedValue({ status: 'synced' });
    mocks.reconcileGaps.mockResolvedValue({ gapsFilled: 0 });
    mocks.initHistoryButtonPreferences.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

async function load(): Promise<any[]> { await import('./main'); return mocks.initObserver.mock.calls[0]; }

describe('shared history bootstrap', () => {
    it('initializes preferences independently and still synchronizes when preferences fail', async () => {
        mocks.initHistoryButtonPreferences.mockRejectedValue(new Error('Preference read failed'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const callbacks = await load();
            callbacks[5]({ kind: 'squad', layout: 'beta', pathname: '/squad', teamId: null });
            await vi.waitFor(() => expect(mocks.syncData).toHaveBeenCalledOnce());
            expect(mocks.initHistoryButtonPreferences).toHaveBeenCalledOnce();
            expect(warn).toHaveBeenCalledWith('Sokker++ page operation failed:', expect.objectContaining({ message: 'Preference read failed' }));
            expect(document.getElementById('sokkerpp-storage-status')).toBeNull();
        } finally { warn.mockRestore(); }
    });

    it('waits for migration before auto-sync or page reads', async () => {
        let finish!: () => void; mocks.migrateCurrentOrigin.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
        const callbacks = await load();
        callbacks[5]({ kind: 'squad', layout: 'beta', pathname: '/squad', teamId: null });
        callbacks[4]({ kind: 'squad', layout: 'beta', pathname: '/squad', teamId: null });
        expect(mocks.migrateCurrentOrigin).toHaveBeenCalledOnce();
        expect(mocks.syncData).not.toHaveBeenCalled(); expect(mocks.processBetaPlayers).not.toHaveBeenCalled();
        finish();
        await vi.waitFor(() => expect(mocks.syncData).toHaveBeenCalledOnce());
        expect(mocks.processBetaPlayers).toHaveBeenCalledOnce();
    });
    it('shows migration failure and never silently continues synchronization', async () => {
        mocks.migrateCurrentOrigin.mockRejectedValue(new Error('Readback mismatch'));
        const callbacks = await load(); callbacks[5]({ kind: 'squad' });
        await vi.waitFor(() => expect(document.querySelector('[role="status"]')?.textContent).toContain('Readback mismatch'));
        expect(mocks.syncData).not.toHaveBeenCalled();
        const reply = vi.fn(); listener({ action: 'FORCE_SYNC' }, null, reply);
        await vi.waitFor(() => expect(reply).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' })));
    });
    it('does no migration or sync for unknown routes and scopes scanners with the validated context', async () => {
        vi.stubGlobal('location', new URL('https://app.sokker.org/unknown'));
        const callbacks = await load(); callbacks[3](); callbacks[5](null);
        await Promise.resolve(); expect(mocks.migrateCurrentOrigin).not.toHaveBeenCalled();
        vi.stubGlobal('location', new URL('https://app.sokker.org/juniors/9001'));
        callbacks[3]();
        await vi.waitFor(() => expect(mocks.scanJuniorPage).toHaveBeenCalledWith(expect.objectContaining({kind:'academy',layout:'beta',teamId:9001}), document));
    });
    it('invalidates pending juniors, cards and saved player views after an epoch change', async () => {
        const callbacks = await load(); callbacks[4]({kind:'squad',layout:'beta',pathname:'/squad'});
        await vi.waitFor(() => expect(mocks.processBetaPlayers).toHaveBeenCalled());
        const changed = mocks.subscribeStorageChanges.mock.calls[0][0];
        changed({ ...state, epoch: 'epoch-2', revision: 1 });
        await vi.waitFor(() => expect(mocks.invalidateJuniorSync).toHaveBeenCalledOnce());
        expect(mocks.hideJuniorCard).toHaveBeenCalled(); expect(mocks.hideTooltip).toHaveBeenCalled();
        expect(mocks.invalidatePlayerCache).toHaveBeenCalledOnce(); expect(mocks.refreshObserver).toHaveBeenCalled();
    });
    it('does not abort its own junior run on ordinary revision notifications', async () => {
        const callbacks = await load(); callbacks[4]({kind:'squad',layout:'beta',pathname:'/squad'});
        await vi.waitFor(() => expect(mocks.processBetaPlayers).toHaveBeenCalled());
        mocks.subscribeStorageChanges.mock.calls[0][0]({ ...state, revision: 1 });
        expect(mocks.invalidateJuniorSync).not.toHaveBeenCalled(); expect(mocks.invalidatePlayerCache).toHaveBeenCalledOnce();
        expect(mocks.invalidatePlayerCache).toHaveBeenCalledWith({ preserveIndicators: true });
    });
    it('keeps large backups and destructive data management out of content messages', async () => {
        await load();
        const reply = vi.fn();
        for (const action of ['EXPORT_DATA','IMPORT_DATA','CLEAR_DATA']) expect(listener({action}, null, reply)).toBeUndefined();
        expect(reply).not.toHaveBeenCalled();
    });
});

it('starts exactly one sync on the new route when navigation happens during migration', async () => {
    let finish!: () => void;
    mocks.migrateCurrentOrigin.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const callbacks = await load();
    callbacks[5]({ kind: 'squad', layout: 'beta', pathname: '/squad', teamId: null });
    callbacks[4]({ kind: 'squad', layout: 'beta', pathname: '/squad', teamId: null });
    expect(mocks.syncData).not.toHaveBeenCalled();
    expect(mocks.processBetaPlayers).not.toHaveBeenCalled();

    vi.stubGlobal('location', new URL('https://app.sokker.org/player/12345'));
    const playerContext = { kind: 'player', layout: 'beta', pathname: '/player/12345', playerId: 12345 };
    callbacks[5](playerContext);
    callbacks[4](playerContext);
    // Two observer callbacks may wait on the same readiness promise.
    callbacks[5](playerContext);
    finish();

    await vi.waitFor(() => expect(mocks.processBetaPlayers).toHaveBeenCalledWith(playerContext));
    expect(mocks.syncData).toHaveBeenCalledOnce();
    expect(mocks.processBetaPlayers).toHaveBeenCalledOnce();
    expect(mocks.processSquadTable).not.toHaveBeenCalled();
    expect(mocks.processPlayerPage).not.toHaveBeenCalled();
});
