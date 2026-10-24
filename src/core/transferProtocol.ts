export const MAX_MESSAGE_BYTES = 262144;
export const TRANSFER_CHANNEL = 'sokker++:transfer:v1';
export interface TransferManifest {
    transferId: string;
    totalFrames: number;
    totalBytes: number;
    digest: string;
}
export const serializedBytes = (value: unknown): number => {
    const json = JSON.stringify(value);
    if (typeof json !== 'string')
        throw new Error('Message must be JSON serializable');
    return new TextEncoder().encode(json).byteLength;
};
export function assertMessageSize(value: unknown): void {
    if (serializedBytes(value) > MAX_MESSAGE_BYTES)
        throw new Error('Message exceeds MAX_MESSAGE_BYTES');
}
export async function sha256(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), (n) =>
        n.toString(16).padStart(2, '0'),
    ).join('');
}
export function fragmentText(
    text: string,
    envelope: (frame: { index: number; text: string }) => unknown,
): string[] {
    const frames: string[] = [];
    let position = 0;
    while (position < text.length) {
        let size = Math.min(65536, text.length - position);
        while (
            size > 0 &&
            serializedBytes(
                envelope({
                    index: frames.length,
                    text: text.slice(position, position + size),
                }),
            ) > MAX_MESSAGE_BYTES
        )
            size = Math.floor(size / 2);
        if (!size) throw new Error('Envelope exceeds message limit');
        if (
            position + size < text.length &&
            /[\uD800-\uDBFF]/.test(text[position + size - 1])
        )
            size--;
        if (!size) throw new Error('Invalid frame size');
        frames.push(text.slice(position, position + size));
        position += size;
    }
    return frames;
}
export async function downloadTransfer(
    manifest: TransferManifest,
    send: (message: unknown) => Promise<unknown>,
): Promise<unknown> {
    if (
        typeof manifest.transferId !== 'string' ||
        !Number.isSafeInteger(manifest.totalFrames) ||
        manifest.totalFrames < 1 ||
        !Number.isSafeInteger(manifest.totalBytes) ||
        manifest.totalBytes < 1 ||
        !/^[a-f0-9]{64}$/.test(manifest.digest)
    )
        throw new Error('Invalid transfer manifest');
    const frames: string[] = [];
    for (let index = 0; index < manifest.totalFrames; index++) {
        const reply = await send({
            channel: TRANSFER_CHANNEL,
            operation: 'transfer.read',
            transferId: manifest.transferId,
            index,
        });
        assertMessageSize(reply);
        if (
            !reply ||
            typeof reply !== 'object' ||
            !('ok' in reply) ||
            reply.ok !== true ||
            !('value' in reply)
        )
            throw new Error('Transfer read failed');
        const frame = reply.value;
        if (
            !frame ||
            typeof frame !== 'object' ||
            !('index' in frame) ||
            !('text' in frame)
        )
            throw new Error('Invalid transfer frame');
        if (frame.index !== index || typeof frame.text !== 'string')
            throw new Error('Invalid transfer frame');
        frames.push(frame.text);
    }
    const text = frames.join('');
    if (
        new TextEncoder().encode(text).byteLength !== manifest.totalBytes ||
        (await sha256(text)) !== manifest.digest
    )
        throw new Error('Transfer integrity mismatch');
    const finished = await send({
        channel: TRANSFER_CHANNEL,
        operation: 'transfer.finish',
        transferId: manifest.transferId,
    });
    assertMessageSize(finished);
    if (
        !finished ||
        typeof finished !== 'object' ||
        !('ok' in finished) ||
        finished.ok !== true
    )
        throw new Error('Transfer finish was not confirmed');
    return JSON.parse(text);
}
