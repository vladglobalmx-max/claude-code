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

function openDatabase(databaseName: string, indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DESCRIPTOR_STORE_NAME);
      request.result.createObjectStore(CONTENT_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    // No cubierto por tests: reproducir de forma determinística un fallo
    // real de `indexedDB.open` es frágil en `fake-indexeddb` — mismo
    // criterio ya documentado en `@impulso/asset-library`.
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir la base de datos de Templates."));
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Operación de IndexedDB fallida."));
  });
}

/**
 * Adaptador real de `TemplateStore` sobre IndexedDB nativo (sin la
 * dependencia `idb`, mismo criterio que `@impulso/asset-library`) — dos
 * object stores: descriptores (livianos, para listar la galería) y
 * contenido (el `Project` completo + thumbnail, más pesado, cargado solo
 * al instanciar o gestionar un Template puntual).
 */
export function createIndexedDbTemplateStore(options: IndexedDbTemplateStoreOptions = {}): TemplateStore {
  const databaseName = options.databaseName ?? "impulso-template-library";
  const indexedDB = options.indexedDB ?? globalThis.indexedDB;
  let dbPromise: Promise<IDBDatabase> | undefined;

  function getDb(): Promise<IDBDatabase> {
    dbPromise ??= openDatabase(databaseName, indexedDB);
    return dbPromise;
  }

  async function withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await getDb();
    const transaction = db.transaction(storeName, mode);
    return promisifyRequest(run(transaction.objectStore(storeName)));
  }

  return {
    async listDescriptors(filter) {
      const all = await withStore<TemplateDescriptor[]>(DESCRIPTOR_STORE_NAME, "readonly", (store) => store.getAll());
      if (!filter?.moduleId) return all;
      return all.filter((descriptor) => descriptor.moduleId === filter.moduleId);
    },
    async getDescriptor(id) {
      return withStore<TemplateDescriptor | undefined>(DESCRIPTOR_STORE_NAME, "readonly", (store) => store.get(id));
    },
    async getContent(id) {
      return withStore<TemplateContent | undefined>(CONTENT_STORE_NAME, "readonly", (store) => store.get(id));
    },
    async save(descriptor, content) {
      const db = await getDb();
      const transaction = db.transaction([DESCRIPTOR_STORE_NAME, CONTENT_STORE_NAME], "readwrite");
      await Promise.all([
        promisifyRequest(transaction.objectStore(DESCRIPTOR_STORE_NAME).put(descriptor, descriptor.id)),
        promisifyRequest(transaction.objectStore(CONTENT_STORE_NAME).put(content, descriptor.id)),
      ]);
    },
    async delete(id) {
      const db = await getDb();
      const transaction = db.transaction([DESCRIPTOR_STORE_NAME, CONTENT_STORE_NAME], "readwrite");
      await Promise.all([
        promisifyRequest(transaction.objectStore(DESCRIPTOR_STORE_NAME).delete(id)),
        promisifyRequest(transaction.objectStore(CONTENT_STORE_NAME).delete(id)),
      ]);
    },
    async clear() {
      const db = await getDb();
      const transaction = db.transaction([DESCRIPTOR_STORE_NAME, CONTENT_STORE_NAME], "readwrite");
      await Promise.all([
        promisifyRequest(transaction.objectStore(DESCRIPTOR_STORE_NAME).clear()),
        promisifyRequest(transaction.objectStore(CONTENT_STORE_NAME).clear()),
      ]);
    },
  };
}
