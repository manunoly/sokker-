import { initObserver } from './observer';
import { processSquadTable } from './ui';
import { syncData } from '../core/sync';
import { getAllData, restoreData, getLastSyncWeek, clearDatabase } from '../core/repository';

async function main() {
    // console.log('Initializing Sokker++...');

    // Attempt auto-sync on load
    syncData().then(res => { /* console.log('Auto Sync result:', res) */ }).catch(err => console.error(err));

    initObserver(processSquadTable);

    // Listen for messages from Popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // Return true to indicate we will send a response asynchronously

        if (request.action === 'EXPORT_DATA') {
            getAllData()
                .then(data => sendResponse({ status: 'success', data }))
                .catch(err => sendResponse({ status: 'error', message: err.message }));
            return true;
        }

        if (request.action === 'IMPORT_DATA') {
            restoreData(request.data)
                .then(() => sendResponse({ status: 'success' }))
                .catch(err => sendResponse({ status: 'error', message: err.message }));
            return true;
        }

        if (request.action === 'FORCE_SYNC') {
            syncData()
                .then(res => sendResponse({ status: 'success', result: res }))
                .catch(err => sendResponse({ status: 'error', message: err.message }));
            return true;
        }

        if (request.action === 'CHECK_STATUS') {
            getLastSyncWeek().then(week => {
                sendResponse({ status: 'alive', lastWeek: week });
            });
            return true;
        }

        if (request.action === 'CLEAR_DATA') {
            clearDatabase()
                .then(() => sendResponse({ status: 'success' }))
                .catch(err => sendResponse({ status: 'error', message: err.message }));
            return true;
        }
    });
}

main();
