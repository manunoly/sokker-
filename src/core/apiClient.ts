import { API_CHANNEL, type ApiOperation, type ApiResponse, type TodayInfo } from './apiTypes';
import { assertMessageSize, downloadTransfer } from './transferProtocol';
import type { RosterPlayer, SokkerResponse } from '../types/index';
import type { JuniorPoint, JuniorRosterEntry } from './juniorTypes';
export type { TodayInfo } from './apiTypes';

const aborted = (): DOMException => new DOMException('The API request was cancelled', 'AbortError');

/** Signals remain local; the worker owns the actual fetch controller. */
async function request<T>(operation: ApiOperation, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    const requestId = crypto.randomUUID();
    const port = chrome.runtime.connect({ name: API_CHANNEL });
    let pending: { resolve: (value: unknown) => void; reject: (error: Error) => void } | undefined;
    let disconnected = false;
    const disconnectError = (): Error => new Error(chrome.runtime.lastError?.message ?? 'API transport disconnected; retry the request');
    const onDisconnect = (): void => { disconnected = true; pending?.reject(disconnectError()); pending = undefined; };
    const onMessage = (value: unknown): void => {
        try { assertMessageSize(value); pending?.resolve(value); }
        catch (error) { pending?.reject(error instanceof Error ? error : new Error('Invalid API response')); }
        pending = undefined;
    };
    const onAbort = (): void => {
        if (!disconnected) {
            try { port.postMessage({ channel: API_CHANNEL, operation: 'api.cancel', requestId }); }
            catch { /* The local abort remains authoritative if the worker has stopped. */ }
        }
        pending?.reject(aborted()); pending = undefined;
    };
    const send = (message: unknown): Promise<unknown> => {
        signal?.throwIfAborted();
        if (disconnected) return Promise.reject(disconnectError());
        assertMessageSize(message);
        return new Promise((resolve, reject) => {
            pending = { resolve, reject };
            try { port.postMessage(message); }
            catch (error) { pending = undefined; reject(error); }
        });
    };
    port.onDisconnect.addListener(onDisconnect);
    port.onMessage.addListener(onMessage);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
        const raw = await send({ channel: API_CHANNEL, requestId, ...operation });
        signal?.throwIfAborted();
        if (!raw || typeof raw !== 'object' || !('ok' in raw) || typeof raw.ok !== 'boolean') throw new Error('Invalid API broker response');
        const response = raw as ApiResponse;
        if (!response.ok) {
            if (!response.error || typeof response.error.message !== 'string' || typeof response.error.name !== 'string') throw new Error('Invalid API broker error');
            const error = new Error(response.error?.message ?? 'API request failed');
            error.name = response.error?.name ?? 'Error';
            throw error;
        }
        if (!('transfer' in response) && !('value' in response)) throw new Error('Invalid API broker success');
        const value = 'transfer' in response ? await downloadTransfer(response.transfer, send) : response.value;
        signal?.throwIfAborted();
        return value as T;
    } finally {
        signal?.removeEventListener('abort', onAbort);
        port.onDisconnect.removeListener(onDisconnect);
        port.onMessage.removeListener(onMessage);
        port.disconnect();
    }
}

export const fetchTodayInfo = (): Promise<TodayInfo> => request({ operation: 'api.today' });
export const fetchCurrentWeek = (): Promise<number> => request({ operation: 'api.currentWeek' });
export const fetchTrainingData = (week: number): Promise<SokkerResponse['players']> => request({ operation: 'api.training', week });
export const fetchRoster = (teamId: number): Promise<RosterPlayer[]> => request({ operation: 'api.roster', teamId });
export const fetchJuniorRoster = (signal?: AbortSignal): Promise<JuniorRosterEntry[]> => request({ operation: 'api.juniorRoster' }, signal);
export const fetchJuniorGraph = (juniorId: number, signal?: AbortSignal): Promise<JuniorPoint[]> => request({ operation: 'api.juniorGraph', juniorId }, signal);
