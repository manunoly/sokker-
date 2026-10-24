import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from './apiService';
import { TransferService } from './transferService';
import { getMessageOwner } from './messageOwner';
import { API_CHANNEL, type ApiResponse } from '../core/apiTypes';
import { downloadTransfer } from '../core/transferProtocol';

const message = (requestId = 'request', operation = 'api.juniorGraph', extra = { juniorId: 101 } as object) =>
    ({ channel: API_CHANNEL, requestId, operation, ...extra });
const graph = { juniorId: 101, values: [{ x: 1200, y: 8 }] };
function respond(body: unknown): void {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body }));
}
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());

describe('API service', () => {
    it('transports array results through owned verified transfers', async () => {
        respond(graph);
        const transfers = new TransferService();
        const service = new ApiService(transfers);
        const result = await service.handle('document:A', message());
        expect(result.ok).toBe(true);
        if (!result.ok || !('transfer' in result)) throw new Error('Missing transfer');
        await expect(downloadTransfer(result.transfer, msg => transfers.handle('document:B', msg))).rejects.toThrow('Unknown transfer');
        await expect(downloadTransfer(result.transfer, msg => transfers.handle('document:A', msg))).resolves.toEqual([{ x: 1200, y: 8, source: 'graph' }]);
    });
    it('retains an early cancellation tombstone before fetch is registered', async () => {
        respond(graph);
        const service = new ApiService(new TransferService());
        await service.handle('document:A', message('same', 'api.cancel', {}));
        const result = await service.handle('document:A', message('same'));
        expect(result).toMatchObject({ ok: false, error: { name: 'AbortError' } });
        expect(fetch).not.toHaveBeenCalled();
    });
    it('cancels only the matching request in the owning document', async () => {
        const signals: AbortSignal[] = [];
        const resolve: Array<(value: unknown) => void> = [];
        vi.stubGlobal('fetch', vi.fn((_url, init) => {
            signals.push(init.signal);
            return new Promise(done => resolve.push(done));
        }));
        const service = new ApiService(new TransferService());
        const a = service.handle('document:A', message('same'));
        const b = service.handle('document:B', message('same'));
        await service.handle('document:A', message('same', 'api.cancel', {}));
        expect(signals[0].aborted).toBe(true);
        expect(signals[1].aborted).toBe(false);
        const response = { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => graph };
        resolve.forEach(done => done(response));
        expect(await a).toMatchObject({ ok: false, error: { name: 'AbortError' } });
        expect((await b).ok).toBe(true);
    });
    it('separates a replacement document in the same tab and frame from the cancelled document', async () => {
        vi.stubGlobal('chrome',{runtime:{id:'test-extension'}});respond(graph);
        const sender={id:'test-extension',url:'https://app.sokker.org/squad',tab:{id:1},frameId:0};
        const oldOwner=getMessageOwner({...sender,documentId:'old'} as chrome.runtime.MessageSender)!;
        const newOwner=getMessageOwner({...sender,documentId:'replacement'} as chrome.runtime.MessageSender)!;
        expect(oldOwner).not.toBe(newOwner);
        const service=new ApiService(new TransferService());service.cancel(oldOwner,'same');
        expect((await service.handle(newOwner,message('same'))).ok).toBe(true);
        expect(await service.handle(oldOwner,message('same'))).toMatchObject({ok:false,error:{name:'AbortError'}});
    });
    it('rejects arbitrary URLs, unknown operations and extra parameters', async () => {
        respond(graph);
        const service = new ApiService(new TransferService());
        const invalid = [message('id', 'api.url', { url: 'https://example.test' }),
            { ...message(), url: 'https://example.test' }, message('id', 'api.training', { week: -1 }),
            { ...message(), requestId: '../evil' }];
        for (const request of invalid) expect(await service.handle('document:A', request)).toMatchObject({ ok: false });
        expect(fetch).not.toHaveBeenCalled();
    });
    it('a restarted worker cannot finish an old transfer', async () => {
        respond(graph);
        const result: ApiResponse = await new ApiService(new TransferService()).handle('document:A', message());
        if (!result.ok || !('transfer' in result)) throw new Error('Missing transfer');
        await expect(downloadTransfer(result.transfer, msg => new TransferService().handle('document:A', msg))).rejects.toThrow();
    });
});
