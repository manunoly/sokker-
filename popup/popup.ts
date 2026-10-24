import { clearSharedData, ensureStorageReady, exportBackup, importBackup, recoverPendingPublication } from '../src/core/storageClient';
import { historyButtonsVisible, initHistoryButtonPreferences, setHistoryButtonsVisible, subscribeHistoryButtonsVisibility } from '../src/core/historyButtonPreferences';

function setupHistoryButtonsPreference(): void {
    const checkbox = document.getElementById('historyButtonsVisible') as HTMLInputElement | null;
    const error = document.getElementById('historyButtonsError');
    if (!checkbox || !error) return;
    const spanish = (chrome.i18n?.getUILanguage?.() ?? navigator.language).toLowerCase().split(/[-_]/)[0] === 'es';
    document.getElementById('historyButtonsLabel')!.textContent = spanish ? 'Mostrar botones + de historial' : 'Show + history buttons';
    document.getElementById('historyButtonsHint')!.textContent = spanish
        ? 'Se aplica a todas las páginas de Sokker de este perfil del navegador.'
        : 'Applies to all Sokker pages in this browser profile.';
    const showError = (loading: boolean): void => {
        error.textContent = spanish
            ? loading ? 'No se pudo cargar esta preferencia.' : 'No se pudo guardar la preferencia. Inténtalo de nuevo.'
            : loading ? 'Could not load this preference.' : 'Could not save the preference. Please retry.';
        error.hidden = false;
    };
    subscribeHistoryButtonsVisibility(visible => { checkbox.checked = visible; });
    checkbox.addEventListener('change', () => {
        const next = checkbox.checked;
        checkbox.disabled = true;
        error.hidden = true;
        void setHistoryButtonsVisible(next).catch(() => showError(false)).finally(() => {
            checkbox.checked = historyButtonsVisible();
            checkbox.disabled = false;
        });
    });
    void initHistoryButtonPreferences().then(() => {
        checkbox.checked = historyButtonsVisible();
        checkbox.disabled = false;
    }).catch(() => showError(true));
}

function supportedTab(url: string | undefined): boolean {
    try { const parsed = new URL(url ?? ''); return parsed.protocol === 'https:' && (parsed.hostname === 'sokker.org' || parsed.hostname.endsWith('.sokker.org')); }
    catch { return false; }
}

document.addEventListener('DOMContentLoaded', () => {
    setupHistoryButtonsPreference();
    const status = document.getElementById('status')!;
    const recovery = document.getElementById('recovery');
    const importFile = document.getElementById('importFile') as HTMLInputElement;
    const setStatus = (text: string): void => { status.textContent = text; };
    const fail = (error: unknown): void => setStatus(`Error: ${error instanceof Error ? error.message : 'Operation failed.'}`);
    const activeTabMessage = (action: string): Promise<any> => new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            const tab = tabs.find(tab => tab.id !== undefined && supportedTab(tab.url));
            if (!tab?.id) { reject(new Error('Open a Sokker page to synchronize or repair history.')); return; }
            chrome.tabs.sendMessage(tab.id, { action }, response => {
                const error = chrome.runtime.lastError;
                if (error) { reject(new Error('Refresh the Sokker page, then retry.')); return; }
                if (response?.status !== 'success') { reject(new Error(response?.message ?? 'Sokker page did not complete the operation.')); return; }
                resolve(response.result);
            });
        });
    });
    document.getElementById('syncBtn')?.addEventListener('click', () => {
        setStatus('Syncing...');
        void activeTabMessage('FORCE_SYNC').then(result => setStatus(result.status === 'up-to-date'
            ? `Already up-to-date (Week ${result.lastWeek ?? result.week})`
            : `Sync complete. Synced ${result.weeks ?? 0} weeks (Latest: ${result.lastWeek ?? 'unknown'}).`)).catch(fail);
    });
    document.getElementById('repairBtn')?.addEventListener('click', () => {
        setStatus('Repairing history...');
        void activeTabMessage('REPAIR_HISTORY').then(result => {
            if (result.error) throw new Error(result.error);
            setStatus(`Repair done. ${result.gapsFilled} gap(s) filled across ${result.rosterSize} roster player(s).`);
        }).catch(fail);
    });
    document.getElementById('exportBtn')?.addEventListener('click', () => {
        setStatus('Exporting...');
        void exportBackup().then(data => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            const anchor = document.createElement('a'); anchor.href = url;
            anchor.download = `sokker-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
            setStatus('Export successful.');
        }).catch(fail);
    });
    document.getElementById('clearBtn')?.addEventListener('click', () => {
        if (!confirm('Are you sure you want to DELETE ALL DATA? This cannot be undone.')) return;
        setStatus('Clearing data...');
        void clearSharedData().then(() => setStatus('Data cleared.')).catch(fail);
    });
    document.getElementById('importBtn')?.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => {
        const file = importFile.files?.[0]; if (!file) return;
        setStatus('Importing...');
        const reader = new FileReader();
        reader.onerror = () => fail(new Error('Could not read the backup file.'));
        reader.onload = () => {
            let data: unknown;
            try { data = JSON.parse(String(reader.result)); }
            catch { fail(new Error('Invalid JSON file.')); return; }
            void importBackup(data).then(() => setStatus('Import successful.')).catch(fail);
        };
        reader.readAsText(file); importFile.value = '';
    });
    void (async () => {
        const receipt = await recoverPendingPublication();
        const state = await ensureStorageReady();
        if (recovery) recovery.hidden = state.automaticMigrationBlocked === true ||
            state.migration['https://sokker.org']?.state === 'migrated';
        let pending = false;
        try { pending = localStorage.getItem('sokker++:pending-publication') !== null; } catch { /* State remains usable without local storage. */ }
        setStatus(receipt ? 'Previous import confirmed. Shared history is ready.' : pending
            ? 'Previous import result is not confirmed. Reconnect before retrying.' : 'Shared history is ready.');
    })().catch(fail);
});
