import { initObserver, refreshObserver } from './observer';
import { invalidatePlayerCache, processBetaPlayers, processSquadTable, processPlayerPage } from './ui';
import { reconcileGaps } from '../core/gapDetector';
import { syncData } from '../core/sync';
import { fetchTodayInfo } from '../core/apiClient';
import { ensureStorageReady, getLastSyncWeek, migrateCurrentOrigin, subscribeStorageChanges } from '../core/storageClient';
import { cancelQueuedJuniorSync, invalidateJuniorSync } from '../core/juniorSync';
import { handleJuniorPage, leaveJuniorPage, scanJuniorPage } from './juniorPage';
import { handleTrainingPlayerPage, leaveTrainingPlayerPage, scanTrainingPlayerPage } from './trainingPlayerPage';
import { hideJuniorCard } from './juniorCard';
import { hideTooltip } from './tooltip';
import { leavePlayerBindings } from './playerBindings';
import { resolvePageContext } from './pageContext';
import type { StorageState } from '../core/storageTypes';
import { initHistoryButtonPreferences } from '../core/historyButtonPreferences';

let ready: Promise<void> | null = null;
let storageState: StorageState | null = null;
let initialSyncStarted = false;

function initializationError(error: unknown): void {
    let notice = document.getElementById('sokkerpp-storage-status');
    if (!notice) {
        notice = document.createElement('div'); notice.id = 'sokkerpp-storage-status';
        notice.dataset.sokkerppOwned = 'storage-status'; notice.setAttribute('role', 'status');
        notice.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:10001;max-width:420px;padding:12px;background:#fff3cd;color:#664d03;border:1px solid #ffecb5;border-radius:6px;font:13px system-ui';
        document.body.appendChild(notice);
    }
    notice.textContent = `Sokker++: shared history could not be initialized. ${error instanceof Error ? error.message : 'Please retry after reloading.'}`;
}

/** No content consumer starts IO before this origin has completed migration. */
async function withReady(action: () => void | Promise<unknown>): Promise<void> {
    if (!resolvePageContext(new URL(location.href))) return;
    const page = `${location.origin}${location.pathname}`;
    if (!ready) ready = (async () => {
        await migrateCurrentOrigin();
        storageState = await ensureStorageReady();
        document.getElementById('sokkerpp-storage-status')?.remove();
    })();
    try {
        await ready;
    } catch (error) { initializationError(error); throw error; }
    if (page !== `${location.origin}${location.pathname}`) return;
    await action();
}

function leavePage(): void {
    invalidatePlayerCache();
    leavePlayerBindings(); leaveJuniorPage(); leaveTrainingPlayerPage();
    cancelQueuedJuniorSync(); hideJuniorCard(); hideTooltip();
}

function report(error: unknown): void { console.warn('Sokker++ page operation failed:', error); }

function main(): void {
    void initHistoryButtonPreferences().catch(report);
    subscribeStorageChanges(state => {
        const previous = storageState;
        storageState = state;
        if (!previous) return;
        if (previous.epoch !== state.epoch) {
            leavePage();
            void invalidateJuniorSync().then(() => refreshObserver()).catch(report);
        }
        else if (previous.revision !== state.revision) {
            hideTooltip(); hideJuniorCard(); invalidatePlayerCache({ preserveIndicators: true }); refreshObserver();
        }
    });
    initObserver(
        container => { void withReady(() => processSquadTable(container)).catch(report); },
        container => { void withReady(() => processPlayerPage(container)).catch(report); },
        () => { void withReady(() => reconcileGaps()).catch(report); },
        () => {
            void withReady(() => {
                const context = resolvePageContext(new URL(location.href));
                const view = scanJuniorPage(context, document);
                if (view) void handleJuniorPage(view).catch(report); else leaveJuniorPage();
                const trainingPlayers = scanTrainingPlayerPage(context, document);
                if (trainingPlayers) handleTrainingPlayerPage(trainingPlayers); else leaveTrainingPlayerPage();
            }).catch(report);
        },
        context => { void withReady(() => processBetaPlayers(context)).catch(report); },
        context => {
            leavePage();
            if (context && !initialSyncStarted) {
                void withReady(() => {
                    // Reserve only when the current route actually starts the sync.
                    if (initialSyncStarted) return;
                    initialSyncStarted = true;
                    return syncData();
                }).catch(report);
            }
        },
    );
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        if (!request || typeof request !== 'object') return;
        // Backups and clearing go directly from popup to the shared storage service.
        let operation: (() => Promise<unknown>) | undefined;
        if (request.action === 'REPAIR_HISTORY') operation = () => reconcileGaps();
        if (request.action === 'FORCE_SYNC') operation = () => syncData();
        if (request.action === 'CHECK_STATUS') operation = async () => {
            const today = await fetchTodayInfo();
            return { lastWeek: await getLastSyncWeek(today.teamId) };
        };
        if (!operation) return;
        if (!resolvePageContext(new URL(location.href))) {
            sendResponse({ status: 'error', message: 'Open a supported Sokker page to synchronize history.' }); return;
        }
        let responded = false;
        void withReady(async () => {
            const result = await operation!();
            responded = true;
            sendResponse(request.action === 'CHECK_STATUS' ? { status: 'alive', ...result as object } : { status: 'success', result });
        }).then(() => {
            if (!responded) sendResponse({ status: 'error', message: 'The Sokker page changed; retry the operation.' });
        }).catch(error => sendResponse({ status: 'error', message: error instanceof Error ? error.message : 'Shared history initialization failed' }));
        return true;
    });
}

main();
