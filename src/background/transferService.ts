import {
    assertMessageSize,
    fragmentText,
    sha256,
    TRANSFER_CHANNEL,
    type TransferManifest,
} from '../core/transferProtocol';
import { StorageError } from '../core/storageTypes';
type TransferMessage =
    | {
          channel: string;
          operation: 'transfer.begin';
          totalFrames: number;
          totalBytes: number;
          digest: string;
      }
    | {
          channel: string;
          operation: 'transfer.write';
          transferId: string;
          index: number;
          text: string;
      }
    | {
          channel: string;
          operation: 'transfer.read';
          transferId: string;
          index: number;
      }
    | {
          channel: string;
          operation: 'transfer.finish' | 'transfer.cancel';
          transferId: string;
      };
interface Transfer {
    owner: string;
    direction: 'upload' | 'download';
    manifest: TransferManifest;
    frames: Map<number, string>;
    state: 'open' | 'complete';
    reads: Set<number>;
}
/** In-flight transfers intentionally die on worker restart; active data is never held here. */
export class TransferService {
    private transfers = new Map<string, Transfer>();
    async createDownload(
        owner: string,
        value: unknown,
    ): Promise<TransferManifest> {
        const text = JSON.stringify(value);
        const id = crypto.randomUUID();
        const frames = fragmentText(text, (f) => ({ ok: true, value: f }));
        const manifest = {
            transferId: id,
            totalFrames: frames.length,
            totalBytes: new TextEncoder().encode(text).byteLength,
            digest: await sha256(text),
        };
        this.transfers.set(id, {
            owner,
            direction: 'download',
            manifest,
            frames: new Map(frames.map((f, i) => [i, f])),
            state: 'complete',
            reads: new Set(),
        });
        return manifest;
    }
    begin(
        owner: string,
        input: {
            totalFrames: number;
            totalBytes: number;
            digest: string;
        },
    ): TransferManifest {
        if (
            !Number.isSafeInteger(input.totalFrames) ||
            input.totalFrames < 0 ||
            !Number.isSafeInteger(input.totalBytes) ||
            input.totalBytes < 0 ||
            !/^[a-f0-9]{64}$/.test(input.digest)
        )
            throw new StorageError('INVALID_REQUEST', 'Invalid manifest');
        const manifest = { ...input, transferId: crypto.randomUUID() };
        this.transfers.set(manifest.transferId, {
            owner,
            direction: 'upload',
            manifest,
            frames: new Map(),
            state: 'open',
            reads: new Set(),
        });
        return manifest;
    }
    private own(owner: string, id: string): Transfer {
        const transfer = this.transfers.get(id);
        if (!transfer || transfer.owner !== owner)
            throw new StorageError(
                'UNKNOWN_TRANSFER',
                'Unknown transfer for this document',
            );
        return transfer;
    }
    write(owner: string, id: string, index: number, text: string): void {
        const t = this.own(owner, id);
        if (
            t.direction !== 'upload' ||
            t.state !== 'open' ||
            !Number.isSafeInteger(index) ||
            index < 0 ||
            index >= t.manifest.totalFrames ||
            typeof text !== 'string'
        )
            throw new StorageError('INVALID_REQUEST', 'Invalid frame');
        const prior = t.frames.get(index);
        if (prior !== undefined && prior !== text)
            throw new StorageError(
                'INVALID_REQUEST',
                'Contradictory duplicate frame',
            );
        if (prior === undefined && index !== t.frames.size)
            throw new StorageError('INVALID_REQUEST', 'Out of order frame');
        t.frames.set(index, text);
    }
    read(
        owner: string,
        id: string,
        index: number,
    ): {
        index: number;
        text: string;
    } {
        const t = this.own(owner, id);
        if (
            t.direction !== 'download' ||
            !Number.isSafeInteger(index) ||
            !t.frames.has(index)
        )
            throw new StorageError('INVALID_REQUEST', 'Invalid frame index');
        t.reads.add(index);
        return { index, text: t.frames.get(index)! };
    }
    async consume(owner: string, id: string): Promise<unknown> {
        const t = this.own(owner, id);
        if (
            t.direction !== 'upload' ||
            t.frames.size !== t.manifest.totalFrames
        )
            throw new StorageError('INVALID_REQUEST', 'Incomplete transfer');
        const text = Array.from(
            { length: t.manifest.totalFrames },
            (_, i) => t.frames.get(i)!,
        ).join('');
        if (
            new TextEncoder().encode(text).byteLength !==
                t.manifest.totalBytes ||
            (await sha256(text)) !== t.manifest.digest
        )
            throw new StorageError(
                'INVALID_REQUEST',
                'Transfer integrity mismatch',
            );
        const value = JSON.parse(text);
        this.transfers.delete(id);
        return value;
    }
    finishDownload(owner: string, id: string): void {
        const t = this.own(owner, id);
        if (
            t.direction !== 'download' ||
            t.reads.size !== t.manifest.totalFrames
        )
            throw new StorageError('INVALID_REQUEST', 'Not a download');
        this.transfers.delete(id);
    }
    cancelOwner(owner: string): void {
        for (const [id, t] of this.transfers)
            if (t.owner === owner) this.transfers.delete(id);
    }
    async handle(owner: string, raw: unknown): Promise<unknown> {
        assertMessageSize(raw);
        if (!raw || typeof raw !== 'object')
            throw new StorageError(
                'INVALID_REQUEST',
                'Invalid transfer envelope',
            );
        const valueRecord = raw as Record<string, unknown>;
        if (typeof valueRecord.operation !== 'string')
            throw new StorageError(
                'INVALID_REQUEST',
                'Invalid transfer operation',
            );
        if (valueRecord.operation === 'transfer.begin') {
            if (
                typeof valueRecord.totalFrames !== 'number' ||
                typeof valueRecord.totalBytes !== 'number' ||
                typeof valueRecord.digest !== 'string'
            )
                throw new StorageError(
                    'INVALID_REQUEST',
                    'Invalid transfer manifest',
                );
        } else if (typeof valueRecord.transferId !== 'string')
            throw new StorageError('INVALID_REQUEST', 'Invalid transfer ID');
        if (
            (valueRecord.operation === 'transfer.read' ||
                valueRecord.operation === 'transfer.write') &&
            typeof valueRecord.index !== 'number'
        )
            throw new StorageError('INVALID_REQUEST', 'Invalid frame index');
        if (
            valueRecord.operation === 'transfer.write' &&
            typeof valueRecord.text !== 'string'
        )
            throw new StorageError('INVALID_REQUEST', 'Invalid frame text');
        const message = raw as TransferMessage;
        if (message?.channel !== TRANSFER_CHANNEL)
            throw new StorageError(
                'INVALID_REQUEST',
                'Invalid transfer channel',
            );
        let value: unknown;
        switch (message.operation) {
            case 'transfer.begin':
                value = this.begin(owner, message);
                break;
            case 'transfer.write':
                this.write(
                    owner,
                    message.transferId,
                    message.index,
                    message.text,
                );
                value = null;
                break;
            case 'transfer.read':
                value = this.read(owner, message.transferId, message.index);
                break;
            case 'transfer.finish':
                this.finishDownload(owner, message.transferId);
                value = null;
                break;
            case 'transfer.cancel':
                this.own(owner, message.transferId);
                this.transfers.delete(message.transferId);
                value = null;
                break;
            default:
                throw new StorageError(
                    'INVALID_REQUEST',
                    'Unknown transfer operation',
                );
        }
        const response = { ok: true, value };
        assertMessageSize(response);
        return response;
    }
}
