import { createLazyIndexedDbConnection, promisifyRequest, runInTransaction } from "@impulso/storage-kit";
import type { Project } from "@impulso/document-schema";
import { deriveDescriptor } from "../deriveDescriptor.js";
import type { ProjectDescriptor, ProjectStore } from "../types.js";

const DESCRIPTOR_STORE_NAME = "projectDescriptors";
const CONTENT_STORE_NAME = "projectContent";

export interface IndexedDbProjectStoreOptions {
  /** Por defecto `"impulso-project-library"`; inyectable para aislar
   * bases de datos distintas en tests. */
  databaseName?: string;
  /** Inyectable para tests; por defecto `globalThis.indexedDB`. */
  indexedDB?: IDBFactory;
}

/**
 * Adaptador real de `ProjectStore` sobre IndexedDB, sobre el andamiaje
 * genérico de `@impulso/storage-kit` — dos object stores: descriptores
 * (livianos, para listar la Workspace) y contenido (el `Project` completo,
 * cargado solo al abrir uno puntual).
 */
export function createIndexedDbProjectStore(options: IndexedDbProjectStoreOptions = {}): ProjectStore {
  const connection = createLazyIndexedDbConnection({
    databaseName: options.databaseName ?? "impulso-project-library",
    indexedDB: options.indexedDB,
    onUpgrade: (db) => {
      db.createObjectStore(DESCRIPTOR_STORE_NAME);
      db.createObjectStore(CONTENT_STORE_NAME);
    },
    openErrorMessage: "No se pudo abrir la base de datos de Project Library.",
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
      const all = await withStore<ProjectDescriptor[]>(DESCRIPTOR_STORE_NAME, "readonly", (store) => store.getAll());
      if (!filter?.moduleId) return all;
      return all.filter((descriptor) => descriptor.moduleId === filter.moduleId);
    },
    async getDescriptor(id) {
      return withStore<ProjectDescriptor | undefined>(DESCRIPTOR_STORE_NAME, "readonly", (store) => store.get(id));
    },
    async getProject(id) {
      return withStore<Project | undefined>(CONTENT_STORE_NAME, "readonly", (store) => store.get(id));
    },
    async save(project, thumbnail) {
      const existing = await withStore<ProjectDescriptor | undefined>(DESCRIPTOR_STORE_NAME, "readonly", (store) => store.get(project.id));
      const descriptor = deriveDescriptor(project, existing?.thumbnail, thumbnail);
      const db = await connection.getDb();
      await runInTransaction(db, [DESCRIPTOR_STORE_NAME, CONTENT_STORE_NAME], "readwrite", (transaction) =>
        Promise.all([
          promisifyRequest(transaction.objectStore(DESCRIPTOR_STORE_NAME).put(descriptor, project.id)),
          promisifyRequest(transaction.objectStore(CONTENT_STORE_NAME).put(project, project.id)),
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
