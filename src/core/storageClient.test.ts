// @vitest-environment node
import { afterEach, it, expect, vi } from 'vitest';
afterEach(() => vi.unstubAllGlobals());
it('serializes concurrent client requests and reconstructs juvenile Maps from JSON pairs', async () => {
    vi.resetModules();
    let active = 0,
        max = 0;
    const listeners: Array<(m: unknown) => void> = [];
    vi.stubGlobal('chrome', {
        runtime: {
            connect: () => ({
                onMessage: {
                    addListener: (f: (m: unknown) => void) => listeners.push(f),
                },
                onDisconnect: { addListener: vi.fn() },
                postMessage: (message: any) => {
                    active++;
                    max = Math.max(max, active);
                    setTimeout(() => {
                        active--;
                        for (const f of listeners)
                            f({
                                ok: true,
                                value:
                                    message.operation === 'getJuniorRecords'
                                        ? [[555, { teamId: 42, juniorId: 555 }]]
                                        : {
                                              epoch: 'one',
                                              revision: 0,
                                              migration: {},
                                          },
                            });
                    }, 1);
                },
            }),
        },
    });
    const c = await import('./storageClient');
    const [state, map] = await Promise.all([
        c.ensureStorageReady(),
        c.getJuniorRecords(42, [555]),
    ]);
    expect(state.epoch).toBe('one');
    expect(map).toBeInstanceOf(Map);
    expect(map.get(555)?.juniorId).toBe(555);
    expect(max).toBe(1);
});
it('surfaces explicit worker errors instead of empty/successful data', async () => {
    vi.resetModules();
    let listener: (m: unknown) => void = () => {};
    vi.stubGlobal('chrome', {
        runtime: {
            connect: () => ({
                onMessage: {
                    addListener: (f: typeof listener) => {
                        listener = f;
                    },
                },
                onDisconnect: { addListener: vi.fn() },
                postMessage: () =>
                    queueMicrotask(() =>
                        listener({
                            ok: false,
                            code: 'STALE_EPOCH',
                            message: 'Changed',
                        }),
                    ),
            }),
        },
    });
    const c = await import('./storageClient');
    await expect(c.getAllPlayers()).rejects.toMatchObject({
        code: 'STALE_EPOCH',
    });
});

it.each([undefined, 'Synthetic extension context invalidated'])(
    'reports a storage disconnect with runtime diagnostic %s and reconnects on the next read', async diagnostic => {
        vi.resetModules();
        let receive: (message: unknown) => void = () => {};
        let disconnect = () => {};
        let failed = false;
        const lastError = vi.fn(() => diagnostic ? { message: diagnostic } : undefined);
        const runtime = {
            get lastError() { return lastError(); },
            connect: vi.fn(() => ({
                onMessage: { addListener: (fn: typeof receive) => { receive = fn; } },
                onDisconnect: { addListener: (fn: () => void) => { disconnect = fn; } },
                postMessage: () => queueMicrotask(() => {
                    if (!failed) { failed = true; disconnect(); }
                    else receive({ ok: true, value: [] });
                }),
            })),
        };
        vi.stubGlobal('chrome', { runtime });
        const client = await import('./storageClient');
        await expect(client.getAllPlayers()).rejects.toThrow(diagnostic
            ? `Storage worker disconnected: ${diagnostic}`
            : 'Storage worker disconnected; the result may be uncertain');
        expect(lastError).toHaveBeenCalledOnce();
        await expect(client.getAllPlayers()).resolves.toEqual([]);
        expect(runtime.connect).toHaveBeenCalledTimes(2);
    },
);
