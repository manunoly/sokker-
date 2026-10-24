// @vitest-environment node
import { it, expect } from 'vitest';
import {
    fragmentText,
    serializedBytes,
    MAX_MESSAGE_BYTES,
    sha256,
    assertMessageSize,
} from './transferProtocol';
it('bounds complete UTF8 envelopes with multibyte and escaped characters', async () => {
    const text = '😀\\"\n漢'.repeat(100000);
    const frames = fragmentText(text, (frame) => ({ ok: true, value: frame }));
    expect(frames.join('')).toBe(text);
    for (let index = 0; index < frames.length; index++)
        expect(
            serializedBytes({
                ok: true,
                value: { index, text: frames[index] },
            }),
        ).toBeLessThanOrEqual(MAX_MESSAGE_BYTES);
    expect(await sha256(text)).toMatch(/^[a-f0-9]{64}$/);
});
it('rejects oversized messages', () => {
    expect(() =>
        assertMessageSize({ text: 'x'.repeat(MAX_MESSAGE_BYTES) }),
    ).toThrow();
});
