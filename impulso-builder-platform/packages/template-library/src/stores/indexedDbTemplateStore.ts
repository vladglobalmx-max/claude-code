import { createLazyIndexedDbConnection, promisifyRequest, runInTransaction } from "@impulso/storage-kit";
import type { TemplateContent, TemplateDescriptor, TemplateStore } from "../types.js";

const DESCRIPTOR_STORE_NAME = "templateDescriptors";
const CONTENT_STORE_NAME = "templateContent";

export interface IndexedDbTemplateStoreOptions {
  /** Por defecto `"impulso-template-library"`; inyectable para aislar
   * bases de datos distintas en tests. */
  databaseName?: string;
  /** Inyectable para tests; por defecto `globalThis.indexedDB`. */
  indexedDB?: IDBFactory;
}

/**
 * Adaptador real de `TemplateStore` sobre IndexedDB, sobre el andamiaje
 * genérico de `@impulso/storage-kit` — dos object stores: descriptores
 * (livianos, para listar la galería) y contenido (el `Project` completo +
 * thumbnail, más pesado, cargado solo al instanciar o gestionar un
 * Template puntual).
 */
export function createIndexedDbTemplateStore(options: IndexedDbTemplateStoreOptions = {}): TemplateStore {
  const connection = createLazyIndexedDbConnection({
    databaseName: options.databaseName ?? "impulso-template-library",
    indexedDB: options.indexedDB,
    onUpgrade: (db) => {
      db.createObjectStore(DESCRIPTOR_STORE_NAME);
      db.createObjectStore(CONTENT_STORE_NAME);
    },
    openErrorMessage: "No se pudo abrir la base de datos de Templates.",
  });

  async function withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await connection.getDb();
    return runInTransaction(db, storeName, mode, (transaction) => promisifyRequest(run(transaction.objectStore(storeName))));
  }

  return {
    async listDescriptors(filter) {
      let all = await withStore<TemplateDescriptor[]>(DESCRIPTOR_STORE_NAME, "readonly", (store) => store.getAll());
      if (filter?.moduleId) all = all.filter((descriptor) => descriptor.moduleId === filter.moduleId);
      if (filter?.category) all = all.filter((descriptor) => descriptor.category === filter.category);
      if (filter?.shape) all = all.filter((descriptor) => descriptor.shape === filter.shape);
      return all;
    },
    async getDescriptor(id) {
      return withStore<TemplateDescriptor | undefined>(DESCRIPTOR_STORE_NAME, "readonly", (store) => store.get(id));
    },
    async getContent(id) {
      return withStore<TemplateContent | undefined>(CONTENT_STORE_NAME, "readonly", (store) => store.get(id));
    },
    async save(descriptor, content) {
      const db = await connection.getDb();
      await runInTransaction(db, [DESCRIPTOR_STORE_NAME, CONTENT_STORE_NAME], "readwrite", (transaction) =>
        Promise.all([
          promisifyRequest(transaction.objectStore(DESCRIPTOR_STORE_NAME).put(descriptor, descriptor.id)),
          promisifyRequest(transaction.objectStore(CONTENT_STORE_NAME).put(content, descriptor.id)),
        ]),
      );
    },
    async delete(id) {
      const db = await connection.getDb();
      await runInTransaction(db, [DESCRIPTOR_STORE_NAME, CONTENT_STORE_NAME], "readwrite", (transaction) =>
        Promise.all([
          promisifyRequest(transaction.objectStore(DESCRIPTOR_STORE_NAME).delete(id)),
          promisifyRequest(transaction.objectStore(CONTENT_STORE_NAME).delete(id)),
        ]),
      );
    },
    async clear() {
      const db = await connection.getDb();
      await runInTransaction(db, [DESCRIPTOR_STORE_NAME, CONTENT_STORE_NAME], "readwrite", (transaction) =>
        Promise.all([
          promisifyRequest(transaction.objectStore(DESCRIPTOR_STORE_NAME).clear()),
          promisifyRequest(transaction.objectStore(CONTENT_STORE_NAME).clear()),
        ]),
      );
    },
  };
}
