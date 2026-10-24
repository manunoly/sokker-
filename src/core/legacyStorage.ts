import {
    decodeLegacyStores,
    encodeLegacyStores,
    type LegacyStore,
} from './legacyCodec';
import { sha256 } from './transferProtocol';
import type { LegacySnapshot } from './storageTypes';
export const LEGACY_DATABASE_NAME = 'SokkerTalentTrackerDB';
export async function snapshotFromStores(
    origin: string,
    databaseName: string,
    databaseVersion: number,
    stores: LegacyStore[],
): Promise<LegacySnapshot> {
    const encodedStores = encodeLegacyStores(stores);
    return {
        origin,
        databaseName,
        databaseVersion,
        encodedStores,
        digest: await sha256(
            JSON.stringify({
                origin,
                databaseName,
                databaseVersion,
                encodedStores,
            }),
        ),
        inventory: await Promise.all(
            [...stores]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(async (s) => ({
                    store: s.name,
                    records: s.records.length,
                    digest: await sha256(encodeLegacyStores([s])),
                })),
        ),
    };
}
export async function verifyLegacySnapshot(
    snapshot: LegacySnapshot,
): Promise<LegacyStore[]> {
    if (
        snapshot.databaseName !== LEGACY_DATABASE_NAME ||
        !Number.isSafeInteger(snapshot.databaseVersion) ||
        snapshot.databaseVersion < 1 ||
        (await sha256(
            JSON.stringify({
                origin: snapshot.origin,
                databaseName: snapshot.databaseName,
                databaseVersion: snapshot.databaseVersion,
                encodedStores: snapshot.encodedStores,
            }),
        )) !== snapshot.digest
    )
        throw new Error('Invalid legacy snapshot digest/schema');
    const stores = decodeLegacyStores(snapshot.encodedStores);
    const reconstructed = await snapshotFromStores(
        snapshot.origin,
        snapshot.databaseName,
        snapshot.databaseVersion,
        stores,
    );
    if (
        reconstructed.encodedStores !== snapshot.encodedStores ||
        JSON.stringify(reconstructed.inventory) !==
            JSON.stringify(snapshot.inventory)
    )
        throw new Error('Legacy archive readback mismatch');
    return stores;
}
/** No version argument, no schema changes, no writes. Existence is checked before opening. */
export async function readLegacySnapshot(): Promise<LegacySnapshot | null> {
    if (typeof indexedDB.databases !== 'function')
        throw new Error('Safe legacy inspection is unavailable');
    if (
        !(await indexedDB.databases()).some(
            (d) => d.name === LEGACY_DATABASE_NAME,
        )
    )
        return null;
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open(LEGACY_DATABASE_NAME);
        r.onupgradeneeded = () => {
            r.transaction?.abort();
            reject(
                new Error('Legacy database disappeared; inspection aborted'),
            );
        };
        r.onerror = () => reject(r.error);
        r.onsuccess = () => resolve(r.result);
    });
    try {
        const names = Array.from(database.objectStoreNames).sort();
        const stores = names.length
            ? await new Promise<LegacyStore[]>((resolve, reject) => {
                  const tx = database.transaction(names, 'readonly');
                  const result: LegacyStore[] = [];
                  tx.oncomplete = () => resolve(result);
                  tx.onabort = () =>
                      reject(tx.error ?? new Error('Legacy read aborted'));
                  tx.onerror = () => reject(tx.error);
                  for (const name of names) {
                      const store = tx.objectStore(name);
                      const s: LegacyStore = {
                          name,
                          keyPath: store.keyPath,
                          autoIncrement: store.autoIncrement,
                          indexes: Array.from(store.indexNames)
                              .sort()
                              .map((name) => {
                                  const i = store.index(name);
                                  return {
                                      name,
                                      keyPath: i.keyPath,
                                      unique: i.unique,
                                      multiEntry: i.multiEntry,
                                  };
                              }),
                          records: [],
                      };
                      result.push(s);
                      const cursor = store.openCursor();
                      cursor.onsuccess = () => {
                          const c = cursor.result;
                          if (c) {
                              s.records.push({
                                  key: c.primaryKey,
                                  value: c.value,
                              });
                              c.continue();
                          }
                      };
                  }
              })
            : [];
        return await snapshotFromStores(
            location.origin,
            database.name,
            database.version,
            stores,
        );
    } finally {
        database.close();
    }
}
/** Recovery is permitted only into a fresh, explicitly named isolated database. */
export async function restoreLegacyArchive(
    snapshot: LegacySnapshot,
    databaseName: string,
): Promise<IDBDatabase> {
    if (
        databaseName === LEGACY_DATABASE_NAME ||
        !databaseName.startsWith('SokkerRecovery-')
    )
        throw new Error(
            'Recovery requires an isolated SokkerRecovery- database',
        );
    const stores = await verifyLegacySnapshot(snapshot);
    if ((await indexedDB.databases()).some((d) => d.name === databaseName))
        throw new Error('Recovery target already exists');
    return new Promise((resolve, reject) => {
        const r = indexedDB.open(databaseName, snapshot.databaseVersion);
        r.onupgradeneeded = () => {
            for (const s of stores) {
                const store = r.result.createObjectStore(s.name, {
                    keyPath: s.keyPath,
                    autoIncrement: s.autoIncrement,
                });
                for (const i of s.indexes)
                    store.createIndex(i.name, i.keyPath, {
                        unique: i.unique,
                        multiEntry: i.multiEntry,
                    });
                for (const record of s.records) {
                    if (s.keyPath === null) store.put(record.value, record.key);
                    else store.put(record.value);
                }
            }
        };
        r.onerror = () => reject(r.error);
        r.onsuccess = () => resolve(r.result);
    });
}
