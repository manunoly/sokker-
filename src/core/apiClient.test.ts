import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJuniorGraph, fetchJuniorRoster, fetchTodayInfo } from './apiClient';
import { registerApiService } from '../background/apiService';
import { TransferService } from '../background/transferService';
import { API_CHANNEL } from './apiTypes';
import { MAX_MESSAGE_BYTES, serializedBytes } from './transferProtocol';

function events() {
    const listeners = new Set<(...args: any[]) => void>();
    return { addListener: (fn: (...args: any[]) => void) => listeners.add(fn),
        removeListener: (fn: (...args: any[]) => void) => listeners.delete(fn),
        emit: (...args: any[]) => { for (const fn of listeners) fn(...args); } };
}
function runtime(url = 'https://app.sokker.org/squad', documentId: string | null = 'document-A') {
    const onConnect = events();
    const messages: unknown[] = [];
    const servers: Array<{ disconnect: () => void }> = [];
    let connectedHook: (() => void) | undefined;
    let replyHook: (() => void) | undefined;
    const connect = vi.fn(() => {
        const clientMessages = events(), serverMessages = events(), clientDisconnected = events(), serverDisconnected = events();
        let closed = false;
        const close = () => { if (!closed) { closed = true; serverDisconnected.emit(); clientDisconnected.emit(); } };
        const client = { name: API_CHANNEL, onMessage: clientMessages, onDisconnect: clientDisconnected,
            postMessage: (msg: unknown) => { messages.push(structuredClone(msg)); if (closed) throw new Error('Disconnected'); queueMicrotask(() => serverMessages.emit(msg)); }, disconnect: close };
        const server = { name: API_CHANNEL, sender: { id: 'test-extension', url, documentId: documentId ?? undefined, tab: { id: 1 }, frameId: 0 },
            onMessage: serverMessages, onDisconnect: serverDisconnected,
            postMessage: (msg: unknown) => { messages.push(structuredClone(msg)); replyHook?.(); if (!closed) queueMicrotask(() => clientMessages.emit(msg)); }, disconnect: close };
        servers.push(server); onConnect.emit(server); connectedHook?.(); return client;
    });
    vi.stubGlobal('chrome', { runtime: { id: 'test-extension', onConnect, connect } });
    registerApiService(new TransferService());
    return { messages, connect, servers, beforeSend: (hook: () => void) => { connectedHook = hook; }, beforeReply: (hook: () => void) => { replyHook = hook; } };
}
function respond(body: unknown): void {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body }));
}
const today = { season: 80, week: 1200, seasonWeek: 5, day: 2, date: { value: '2026-10-23', timestamp: 1792713600 } };
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());

describe('API client and worker transport', () => {
    it.each(['https://sokker.org/app/squad', 'https://app.sokker.org/squad', 'https://synthetic.sokker.org/squad'])('always uses the canonical authenticated API from %s', async url => {
        const transport = runtime(url);
        respond({ today, team: { id: 9001 } });
        await expect(fetchTodayInfo()).resolves.toEqual({ ...today, teamId: 9001 });
        expect(fetch).toHaveBeenCalledWith('https://sokker.org/api/current', expect.objectContaining({ method: 'GET', credentials: 'include', signal: expect.any(AbortSignal) }));
        expect(transport.messages[0]).toMatchObject({ channel: API_CHANNEL, operation: 'api.today' });
        expect(transport.messages[0]).not.toHaveProperty('signal');
    });
    it('uses a worker-created port owner if the sender lacks documentId', async () => {
        runtime('https://app.sokker.org/juniors/9001', null);
        respond({ juniors: [] });
        await expect(fetchJuniorRoster()).resolves.toEqual([]);
    });
    it('rejects unauthorized sender origins before any request runs', async () => {
        runtime('https://sokker.org.example.test/squad'); respond({ today, team: { id: 9001 } });
        await expect(fetchTodayInfo()).rejects.toThrow();
        expect(fetch).not.toHaveBeenCalled();
    });
    it('does not connect with an already aborted signal, or send after abort during connect', async () => {
        const transport = runtime(); respond({ juniors: [] });
        const before = new AbortController(); before.abort();
        await expect(fetchJuniorRoster(before.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(transport.connect).not.toHaveBeenCalled();
        const during = new AbortController(); transport.beforeSend(() => during.abort());
        await expect(fetchJuniorRoster(during.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(transport.messages).toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
    });
    it('aborts pending fetch and discards a late successful network response', async () => {
        const transport = runtime();
        let finish!: (value: unknown) => void;
        let signal!: AbortSignal;
        vi.stubGlobal('fetch', vi.fn((_url, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); }));
        const controller = new AbortController();
        const result = fetchJuniorGraph(101, controller.signal);
        const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        controller.abort(); await assertion;
        await vi.waitFor(() => expect(signal.aborted).toBe(true));
        finish({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ juniorId: 101, values: [] }) });
        expect(transport.messages).toContainEqual(expect.objectContaining({ operation: 'api.cancel' }));
    });
    it('checks the local signal again before accepting an already completed worker response', async () => {
        const transport = runtime(); respond({juniorId:101,values:[]});
        const controller = new AbortController(); transport.beforeReply(() => controller.abort());
        await expect(fetchJuniorGraph(101,controller.signal)).rejects.toMatchObject({name:'AbortError'});
    });
    it('returns a transport error after worker termination instead of an empty roster', async () => {
        const transport = runtime();
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
        const result = fetchJuniorRoster();
        const assertion = expect(result).rejects.toThrow('transport disconnected');
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        transport.servers[0].disconnect(); await assertion;
    });
    it('propagates an expired session as an error', async () => {
        runtime();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'text/html' }), json: async () => ({}) }));
        await expect(fetchJuniorRoster()).rejects.toThrow('expected JSON');
    });
    it('round-trips a large API response with every full envelope within 262144 UTF-8 bytes', async () => {
        const transport = runtime();
        const values = Array.from({ length: 15000 }, (_, x) => ({ x, y: x % 18 }));
        respond({ juniorId: 101, values });
        const result = await fetchJuniorGraph(101);
        expect(result).toEqual(values.map(point => ({ ...point, source: 'graph' })));
        expect(serializedBytes(result)).toBeGreaterThan(MAX_MESSAGE_BYTES);
        expect(transport.messages.every(msg => serializedBytes(msg) <= MAX_MESSAGE_BYTES)).toBe(true);
        expect(transport.messages.filter(msg => (msg as any).operation === 'transfer.read').length).toBeGreaterThan(1);
    });
});
