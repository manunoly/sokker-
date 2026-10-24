// @vitest-environment node
import { it, expect } from 'vitest';
import { TransferService } from './transferService';
import { sha256 } from '../core/transferProtocol';
it('rejects missing, contradictory, out of order, changed and foreign frames', async () => {
    const t = new TransferService();
    const text = '{"hello":"world"}';
    const manifest = t.begin('a', {
        totalFrames: 2,
        totalBytes: text.length,
        digest: await sha256(text),
    });
    t.write('a', manifest.transferId, 0, text.slice(0, 5));
    await expect(t.consume('a', manifest.transferId)).rejects.toThrow(
        'Incomplete',
    );
    expect(() => t.write('a', manifest.transferId, 0, 'different')).toThrow(
        'Contradictory',
    );
    expect(() => t.write('b', manifest.transferId, 1, '')).toThrow('Unknown');
    t.write('a', manifest.transferId, 1, text.slice(5));
    expect(await t.consume('a', manifest.transferId)).toEqual({
        hello: 'world',
    });
    await expect(t.consume('a', manifest.transferId)).rejects.toThrow(
        'Unknown',
    );
});
it('worker restart and disconnect discard unfinished transfers', async () => {
    const t = new TransferService();
    const m = await t.createDownload('a', { x: 1 });
    expect(() => new TransferService().read('a', m.transferId, 0)).toThrow(
        'Unknown',
    );
    expect(() => t.read('b', m.transferId, 0)).toThrow('Unknown');
    t.cancelOwner('a');
    expect(() => t.read('a', m.transferId, 0)).toThrow('Unknown');
});
it('rejects altered digest and malformed transfer envelopes', async () => {
    const service = new TransferService();
    const manifest = service.begin('a', {
        totalFrames: 1,
        totalBytes: 2,
        digest: await sha256('{}'),
    });
    service.write('a', manifest.transferId, 0, '[]');
    await expect(service.consume('a', manifest.transferId)).rejects.toThrow(
        'integrity',
    );
    await expect(
        service.handle('a', {
            channel: 'sokker++:transfer:v1',
            operation: 'transfer.write',
            transferId: manifest.transferId,
            index: 'bad',
            text: '[]',
        }),
    ).rejects.toThrow('index');
});
