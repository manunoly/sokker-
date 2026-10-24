/** Lossless, explicit structured-clone codec. Unsupported values fail closed. */
export interface LegacyStore {
    name: string;
    keyPath: string | string[] | null;
    autoIncrement: boolean;
    indexes: Array<{
        name: string;
        keyPath: string | string[];
        unique: boolean;
        multiEntry: boolean;
    }>;
    records: Array<{
        key: IDBValidKey;
        value: unknown;
    }>;
}
export function encodeLegacyStores(stores: readonly LegacyStore[]): string {
    const nodes: unknown[] = [];
    const seen = new Map<object, number>();
    const visit = (value: any): unknown => {
        if (value === undefined) return ['undefined'];
        if (
            value === null ||
            typeof value === 'string' ||
            typeof value === 'boolean'
        )
            return value;
        if (typeof value === 'number')
            return Number.isNaN(value)
                ? ['number', 'NaN']
                : !Number.isFinite(value)
                  ? ['number', String(value)]
                  : Object.is(value, -0)
                    ? ['number', '-0']
                    : value;
        if (typeof value === 'bigint') return ['bigint', String(value)];
        if (typeof value !== 'object')
            throw new Error('Unsupported legacy value type');
        const known = seen.get(value);
        if (known !== undefined) return ['ref', known];
        const id = nodes.length;
        seen.set(value, id);
        nodes.push(null);
        let node: unknown;
        if (value instanceof Date) node = ['date', visit(value.getTime())];
        else if (value instanceof ArrayBuffer)
            node = ['buffer', Array.from(new Uint8Array(value))];
        else if (ArrayBuffer.isView(value))
            node = [
                'view',
                value.constructor.name,
                visit(value.buffer),
                value.byteOffset,
                value instanceof DataView
                    ? value.byteLength
                    : (
                          value as unknown as {
                              length: number;
                          }
                      ).length,
            ];
        else if (value instanceof Map)
            node = ['map', Array.from(value, ([k, v]) => [visit(k), visit(v)])];
        else if (value instanceof Set) node = ['set', Array.from(value, visit)];
        else if (value instanceof RegExp)
            node = ['regexp', value.source, value.flags];
        else if (Array.isArray(value))
            node = [
                'array',
                value.length,
                Object.keys(value)
                    .sort()
                    .map((k) => [k, visit((value as any)[k])]),
            ];
        else if (
            Object.getPrototypeOf(value) === Object.prototype ||
            Object.getPrototypeOf(value) === null
        )
            node = [
                'object',
                Object.keys(value)
                    .sort()
                    .map((k) => [k, visit((value as any)[k])]),
            ];
        else
            throw new Error(
                `Unsupported legacy object: ${Object.prototype.toString.call(value)}`,
            );
        nodes[id] = node;
        return ['ref', id];
    };
    const root = visit(
        [...stores]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => ({
                ...s,
                indexes: [...s.indexes].sort((a, b) =>
                    a.name.localeCompare(b.name),
                ),
            })),
    );
    return JSON.stringify({ codec: 1, root, nodes });
}
export function decodeLegacyStores(encoded: string): LegacyStore[] {
    const data = JSON.parse(encoded);
    if (data.codec !== 1 || !Array.isArray(data.nodes))
        throw new Error('Invalid legacy codec');
    const refs: any[] = [];
    const building = new Set<number>();
    const read = (v: any): any => {
        if (!Array.isArray(v)) return v;
        switch (v[0]) {
            case 'undefined':
                return undefined;
            case 'bigint':
                return BigInt(v[1]);
            case 'number':
                return v[1] === '-0' ? -0 : Number(v[1]);
            case 'ref':
                return node(v[1]);
            default:
                throw new Error('Invalid legacy tag');
        }
    };
    const define = (target: any, entries: any[]) => {
        for (const [k, v] of entries)
            Object.defineProperty(target, k, {
                value: read(v),
                writable: true,
                enumerable: true,
                configurable: true,
            });
    };
    const node = (id: number): any => {
        if (id in refs) return refs[id];
        if (!Number.isSafeInteger(id) || !data.nodes[id] || building.has(id))
            throw new Error('Invalid legacy reference');
        building.add(id);
        const n = data.nodes[id];
        let value: any;
        switch (n[0]) {
            case 'object':
                value = {};
                refs[id] = value;
                define(value, n[1]);
                break;
            case 'array':
                value = new Array(n[1]);
                refs[id] = value;
                define(value, n[2]);
                break;
            case 'map':
                value = new Map();
                refs[id] = value;
                for (const [k, v] of n[1]) value.set(read(k), read(v));
                break;
            case 'set':
                value = new Set();
                refs[id] = value;
                for (const v of n[1]) value.add(read(v));
                break;
            case 'date':
                value = new Date(read(n[1]));
                break;
            case 'buffer':
                value = new Uint8Array(n[1]).buffer;
                break;
            case 'view': {
                const constructors: Record<string, any> = {
                    Int8Array,
                    Uint8Array,
                    Uint8ClampedArray,
                    Int16Array,
                    Uint16Array,
                    Int32Array,
                    Uint32Array,
                    Float32Array,
                    Float64Array,
                    BigInt64Array,
                    BigUint64Array,
                    DataView,
                };
                const C = constructors[n[1]];
                if (!C) throw new Error('Unsupported typed array');
                value = new C(read(n[2]), n[3], n[4]);
                break;
            }
            case 'regexp':
                value = new RegExp(n[1], n[2]);
                break;
            default:
                throw new Error('Invalid legacy node');
        }
        refs[id] = value;
        building.delete(id);
        return value;
    };
    const result = read(data.root);
    if (
        !Array.isArray(result) ||
        result.some(
            (s) =>
                typeof s.name !== 'string' ||
                !Array.isArray(s.records) ||
                !Array.isArray(s.indexes),
        )
    )
        throw new Error('Invalid store inventory');
    return result;
}
