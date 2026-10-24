import * as api from '../core/api';
import { API_CHANNEL, isApiRequest, type ApiRequest, type ApiResponse, type ApiValue } from '../core/apiTypes';
import { assertMessageSize, TRANSFER_CHANNEL } from '../core/transferProtocol';
import { getMessageOwner } from './messageOwner';
import { TransferService } from './transferService';

const aborted = (): DOMException => new DOMException('The API request was cancelled', 'AbortError');
function failure(error: unknown): ApiResponse {
    return { ok: false, error: { name: error instanceof Error || error instanceof DOMException ? error.name : 'Error',
        message: (error instanceof Error || error instanceof DOMException ? error.message : 'API request failed').slice(0, 500) } };
}

/** Request identity always includes the browser-provided document/context. */
export class ApiService {
    private active = new Map<string, Map<string, AbortController>>();
    private cancelled = new Map<string, Set<string>>();
    constructor(private transfers: TransferService) {}

    cancel(owner: string, requestId: string): void {
        let ids = this.cancelled.get(owner);
        if (!ids) { ids = new Set(); this.cancelled.set(owner, ids); }
        ids.add(requestId);
        this.active.get(owner)?.get(requestId)?.abort();
    }

    /** A disconnected port cannot register further work; its aborted IDs can be released. */
    release(owner: string, requestIds: Iterable<string>): void {
        const cancelled = this.cancelled.get(owner);
        for (const requestId of requestIds) cancelled?.delete(requestId);
        if (!cancelled?.size) this.cancelled.delete(owner);
    }

    async handle(owner: string, message: unknown): Promise<ApiResponse> {
        try {
            assertMessageSize(message);
            if (!isApiRequest(message)) throw new Error('Invalid API request');
            if (message.operation === 'api.cancel') { this.cancel(owner, message.requestId); return { ok: true, value: 0 }; }
            if (this.cancelled.get(owner)?.has(message.requestId)) throw aborted();
            let requests = this.active.get(owner);
            if (!requests) { requests = new Map(); this.active.set(owner, requests); }
            if (requests.has(message.requestId)) throw new Error('Duplicate active API request ID');
            const controller = new AbortController();
            requests.set(message.requestId, controller);
            try {
                const value = await this.execute(message, controller.signal);
                controller.signal.throwIfAborted();
                const response: ApiResponse = Array.isArray(value)
                    ? { ok: true, transfer: await this.transfers.createDownload(owner, value) }
                    : { ok: true, value };
                if (controller.signal.aborted) {
                    if ('transfer' in response) await this.transfers.handle(owner, {
                        channel: TRANSFER_CHANNEL, operation: 'transfer.cancel', transferId: response.transfer.transferId,
                    });
                    throw aborted();
                }
                assertMessageSize(response);
                return response;
            } finally {
                requests.delete(message.requestId);
                if (!requests.size) this.active.delete(owner);
            }
        } catch (error) { return failure(error); }
    }

    private execute(request: ApiRequest, signal: AbortSignal): Promise<ApiValue> {
        switch (request.operation) {
            case 'api.today': return api.fetchTodayInfo(signal);
            case 'api.currentWeek': return api.fetchCurrentWeek(signal);
            case 'api.training': return api.fetchTrainingData(request.week, signal);
            case 'api.roster': return api.fetchRoster(request.teamId, signal);
            case 'api.juniorRoster': return api.fetchJuniorRoster(signal);
            case 'api.juniorGraph': return api.fetchJuniorGraph(request.juniorId, signal);
        }
    }
}

/** A dedicated port supplies identity even when Chrome omits documentId. */
export function registerApiService(transfers: TransferService): () => void {
    const service = new ApiService(transfers);
    const connected = (port: chrome.runtime.Port): void => {
        if (port.name !== API_CHANNEL) return;
        const owner = port.sender && getMessageOwner(port.sender, crypto.randomUUID());
        if (!owner) { port.disconnect(); return; }
        const requests = new Set<string>();
        const downloads = new Set<string>();
        let closed = false;
        port.onDisconnect.addListener(() => {
            closed = true;
            for (const id of requests) service.cancel(owner, id);
            service.release(owner, requests);
            for (const id of downloads) void transfers.handle(owner, {
                channel: TRANSFER_CHANNEL, operation: 'transfer.cancel', transferId: id,
            }).catch(() => { /* A completed transfer is already released. */ });
        });
        port.onMessage.addListener((message: unknown) => {
            if (closed) return;
            if (isApiRequest(message) && message.operation === 'api.cancel') {
                requests.add(message.requestId);
                service.cancel(owner, message.requestId);
                return; // Cancellation is fire-and-forget; the pending request gets its error.
            }
            const run = async (): Promise<unknown> => {
                if (message && typeof message === 'object' && 'channel' in message && message.channel === TRANSFER_CHANNEL) {
                    const frame = message as { transferId?: string; operation?: string };
                    if (!frame.transferId || !downloads.has(frame.transferId)
                        || !['transfer.read', 'transfer.finish', 'transfer.cancel'].includes(frame.operation ?? '')) {
                        throw new Error('Invalid API download request');
                    }
                    const result = await transfers.handle(owner, message);
                    if (frame.operation !== 'transfer.read') downloads.delete(frame.transferId);
                    return result;
                }
                if (isApiRequest(message)) requests.add(message.requestId);
                const response = await service.handle(owner, message);
                if (response.ok && 'transfer' in response) {
                    downloads.add(response.transfer.transferId);
                    if (closed) await transfers.handle(owner, { channel: TRANSFER_CHANNEL,
                        operation: 'transfer.cancel', transferId: response.transfer.transferId });
                }
                return response;
            };
            void run().catch(failure).then(response => {
                if (!closed) {
                    try { assertMessageSize(response); port.postMessage(response); }
                    catch { port.disconnect(); }
                }
            });
        });
    };
    chrome.runtime.onConnect.addListener(connected);
    return () => chrome.runtime.onConnect.removeListener(connected);
}
