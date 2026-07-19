import type { AssetId } from "@impulso/document-schema";
import { createLazyIndexedDbConnection, promisifyRequest, runInTransaction } from "@impulso/storage-kit";
import type { AssetBinaryStore } from "../types.js";

const OBJECT_STORE_NAME = "assetBinaries";

export interface IndexedDbAssetStoreOptions {
  /** Por defecto `"impulso-asset-library"`; inyectable para aislar bases de
   * datos distintas en tests. */
  databaseName?: string;
  /** Inyectable para tests; por defecto `globalThis.indexedDB`. */
  indexedDB?: IDBFactory;
}

/**
 * Adaptador real de `AssetBinaryStore` sobre IndexedDB — un único object
 * store (`assetId -> Blob`, claves fuera de línea), sobre el andamiaje
 * genérico de `@impulso/storage-kit`. El caso de uso (get/set/delete/clear
 * de un solo store) no necesita más que este puñado de líneas.
 */
export function createIndexedDbAssetStore(options: IndexedDbAssetStoreOptions = {}): AssetBinaryStore {
  const connection = createLazyIndexedDbConnection({
    databaseName: options.databaseName ?? "impulso-asset-library",
    indexedDB: options.indexedDB,
    onUpgrade: (db) => db.createObjectStore(OBJECT_STORE_NAME),
    openErrorMessage: "No se pudo abrir la base de datos de Asset Library.",
  });

  async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await connection.getDb();
    return runInTransaction(db, OBJECT_STORE_NAME, mode, (transaction) =>
      promisifyRequest(run(transaction.objectStore(OBJECT_STORE_NAME))),
    );
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
