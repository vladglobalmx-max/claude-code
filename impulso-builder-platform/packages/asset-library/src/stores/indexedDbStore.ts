import type { AssetId } from "@impulso/document-schema";
import type { AssetBinaryStore } from "../types.js";

const OBJECT_STORE_NAME = "assetBinaries";

export interface IndexedDbAssetStoreOptions {
  /** Por defecto `"impulso-asset-library"`; inyectable para aislar bases de
   * datos distintas en tests. */
  databaseName?: string;
  /** Inyectable para tests; por defecto `globalThis.indexedDB`. */
  indexedDB?: IDBFactory;
}

function openDatabase(databaseName: string, indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(OBJECT_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    // No cubierto por tests: reproducir de forma determinística un fallo
    // real de `indexedDB.open` (ej. VersionError por pedir una versión
    // menor a la existente) sin dejar conexiones colgadas es frágil en
    // `fake-indexeddb` — el camino se verificó manualmente en un navegador
    // real en cambio.
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo abrir la base de datos de Asset Library."));
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Operación de IndexedDB fallida."));
  });
}

/**
 * Adaptador real de `AssetBinaryStore` sobre IndexedDB — un único object
 * store (`assetId -> Blob`, claves fuera de línea). Implementado
 * directamente sobre la API nativa (sin la dependencia `idb`): el caso de
 * uso (get/set/delete/clear de un solo store) no necesita más que este
 * puñado de líneas de envoltura en Promises.
 */
export function createIndexedDbAssetStore(options: IndexedDbAssetStoreOptions = {}): AssetBinaryStore {
  const databaseName = options.databaseName ?? "impulso-asset-library";
  const indexedDB = options.indexedDB ?? globalThis.indexedDB;
  let dbPromise: Promise<IDBDatabase> | undefined;

  function getDb(): Promise<IDBDatabase> {
    dbPromise ??= openDatabase(databaseName, indexedDB);
    return dbPromise;
  }

  async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await getDb();
    const transaction = db.transaction(OBJECT_STORE_NAME, mode);
    return promisifyRequest(run(transaction.objectStore(OBJECT_STORE_NAME)));
  }

  return {
    async get(assetId) {
      const result = await withStore<Blob | undefined>("readonly", (store) => store.get(assetId));
      return result;
    },
    async set(assetId: AssetId, blob: Blob) {
      await withStore("readwrite", (store) => store.put(blob, assetId));
    },
    async delete(assetId) {
      await withStore("readwrite", (store) => store.delete(assetId));
    },
    async clear() {
      await withStore("readwrite", (store) => store.clear());
    },
  };
}
