// @vitest-environment node
import { it, expect, vi } from 'vitest';
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
