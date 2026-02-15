document.addEventListener('DOMContentLoaded', () => {
    const syncBtn = document.getElementById('syncBtn') as HTMLButtonElement;
    const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
    const importBtn = document.getElementById('importBtn') as HTMLButtonElement;
    const importFile = document.getElementById('importFile') as HTMLInputElement;
    const statusDiv = document.getElementById('status') as HTMLElement;

    function isValidBackupPayload(data: unknown): data is { players?: unknown[]; metadata?: unknown[]; weeks?: unknown[] } {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
        const payload = data as { players?: unknown; metadata?: unknown; weeks?: unknown };
        if (payload.players !== undefined && !Array.isArray(payload.players)) return false;
        if (payload.metadata !== undefined && !Array.isArray(payload.metadata)) return false;
        if (payload.weeks !== undefined && !Array.isArray(payload.weeks)) return false;
        return true;
    }

    // Helper to send message to active tab
    function sendMessageToContentScript(message: any, callback?: (response: any) => void) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                if (statusDiv) statusDiv.textContent = 'Error: No active tab found.';
                return;
            }
            if (tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                    if (chrome.runtime.lastError) {
                        if (statusDiv) statusDiv.innerHTML = 'Error: Content script not found.<br>Please refresh Sokker.org page.';
                        console.error(chrome.runtime.lastError);
                        return;
                    }
                    if (callback) callback(response);
                });
            }
        });
    }

    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            if (statusDiv) statusDiv.textContent = 'Sync Status: Syncing...';
            sendMessageToContentScript({ action: 'FORCE_SYNC' }, (response) => {
                if (response && response.status === 'success') {
                    const result = response.result;
                    if (result.status === 'up-to-date') {
                        if (statusDiv) statusDiv.textContent = `Already up-to-date (Week ${result.lastWeek || result.week})`;
                    } else if (result.status === 'synced') {
                        if (statusDiv) statusDiv.textContent = `Sync Complete. Synced ${result.weeks} weeks (Latest: ${result.lastWeek})`;
                    } else {
                        if (statusDiv) statusDiv.textContent = `Sync Complete. Last Week: ${result.lastWeek}`;
                    }
                } else {
                    if (statusDiv) statusDiv.textContent = 'Sync Failed.';
                }
            });
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (statusDiv) statusDiv.textContent = 'Exporting...';
            sendMessageToContentScript({ action: 'EXPORT_DATA' }, (response) => {
                if (response && response.status === 'success') {
                    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sokker-backup-${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    if (statusDiv) statusDiv.textContent = 'Export Successful.';
                } else {
                    if (statusDiv) statusDiv.textContent = 'Export Failed.';
                }
            });
        });
    }

    const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;

    // ... existing export code ...

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to DELETE ALL DATA? This cannot be undone.')) {
                if (statusDiv) statusDiv.textContent = 'Clearing Data...';
                sendMessageToContentScript({ action: 'CLEAR_DATA' }, (response) => {
                    if (response && response.status === 'success') {
                        if (statusDiv) statusDiv.textContent = 'Data Cleared. Please refresh the page.';
                    } else {
                        if (statusDiv) statusDiv.textContent = 'Clear Failed.';
                    }
                });
            }
        });
    }

    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement;
            if (!target.files || target.files.length === 0) return;

            const file = target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const result = e.target?.result as string;
                    const data = JSON.parse(result);
                    if (!isValidBackupPayload(data)) {
                        if (statusDiv) statusDiv.textContent = 'Invalid backup format.';
                        return;
                    }
                    if (statusDiv) statusDiv.textContent = 'Importing...';
                    sendMessageToContentScript({ action: 'IMPORT_DATA', data }, (response) => {
                        if (response && response.status === 'success') {
                            if (statusDiv) statusDiv.textContent = 'Import Successful.';
                        } else {
                            if (statusDiv) statusDiv.textContent = 'Import Failed.';
                        }
                    });
                } catch (err) {
                    console.error(err);
                    if (statusDiv) statusDiv.textContent = 'Invalid JSON file.';
                }
            };
            reader.readAsText(file);
        });
    }

    // Check status on load
    sendMessageToContentScript({ action: 'CHECK_STATUS' }, (response) => {
        if (response && response.status === 'alive') {
            if (statusDiv) statusDiv.textContent = `Sync Status: Ready. Last Week: ${response.lastWeek || 'Never'}`;
        } else {
            if (statusDiv) statusDiv.textContent = 'Sync Status: Connect Error (Refresh Page)';
        }
    });
});
