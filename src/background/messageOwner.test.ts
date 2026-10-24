// @vitest-environment node
import { it, expect, vi } from 'vitest';
import { getMessageOwner } from './messageOwner';
vi.stubGlobal('chrome', { runtime: { id: 'extension' } });
it('binds document, tab and frame and requires worker minted port fallback', () => {
    const base = {
        id: 'extension',
        url: 'https://sokker.org/player/1',
        tab: { id: 1 },
        frameId: 0,
    } as chrome.runtime.MessageSender;
    expect(getMessageOwner(base)).toBeNull();
    expect(getMessageOwner(base, 'port1')).not.toBe(
        getMessageOwner(base, 'port2'),
    );
    expect(getMessageOwner({ ...base, documentId: 'one' })).not.toBe(
        getMessageOwner({ ...base, documentId: 'two' }),
    );
    expect(
        getMessageOwner({ ...base, url: 'https://sokker.org.evil.test' }),
    ).toBeNull();
    expect(getMessageOwner({ ...base, id: 'foreign' }, 'port')).toBeNull();
});
