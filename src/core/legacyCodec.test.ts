// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
    encodeLegacyStores,
    decodeLegacyStores,
    type LegacyStore,
} from './legacyCodec';
const stores = (value: unknown): LegacyStore[] => [
    {
        name: 'extra',
        keyPath: null,
        autoIncrement: false,
        indexes: [],
        records: [{ key: new Date('2020-01-01'), value }],
    },
];
describe('legacy codec', () => {
    it('preserves undefined, absent, sparse arrays, binary, cycles, maps and typed keys', () => {
        const value: any = {
            undefined: undefined,
            date: new Date('2026-01-01'),
            negativeZero: -0,
            nan: NaN,
            big: 123n,
            bytes: new Uint16Array([12, 34]),
            map: new Map([[1, new Set([2])]]),
            sparse: new Array(3),
        };
        value.self = value;
        value.sparse[2] = 'last';
        const decoded = decodeLegacyStores(encodeLegacyStores(stores(value)))[0]
            .records[0].value as typeof value;
        expect(decoded.self).toBe(decoded);
        expect('undefined' in decoded).toBe(true);
        expect('absent' in decoded).toBe(false);
        expect(0 in decoded.sparse).toBe(false);
        expect(decoded.bytes).toEqual(value.bytes);
        expect(decoded.map).toEqual(value.map);
        expect(Object.is(decoded.negativeZero, -0)).toBe(true);
        expect(Number.isNaN(decoded.nan)).toBe(true);
        expect(
            encodeLegacyStores(
                decodeLegacyStores(encodeLegacyStores(stores(value))),
            ),
        ).toBe(encodeLegacyStores(stores(value)));
    });
    it('rejects an unsupported object instead of omitting it', () => {
        expect(() =>
            encodeLegacyStores(stores(new Blob(['unsupported']))),
        ).toThrow('Unsupported');
    });
});
