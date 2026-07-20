import { createLazyIndexedDbConnection, promisifyRequest, runInTransaction } from "@impulso/storage-kit";
import type { Project } from "@impulso/document-schema";
import { deriveDescriptor } from "../deriveDescriptor.js";
import type { ProjectDescriptor, ProjectRecoveryEntry, ProjectStore } from "../types.js";

const DESCRIPTOR_STORE_NAME = "projectDescriptors";
const CONTENT_STORE_NAME = "projectContent";
/** Epic 8 — tercer object store en la MISMA base de datos: reutiliza la
 * conexión ya abierta en vez de crear una segunda IndexedDB, ver
 * `ProjectRecoveryEntry`. Subir `version` a 2 dispara `onUpgrade` también
 * para bases de datos que ya existían solo con los dos stores originales
 * (IndexedDB llama a `onupgradeneeded` para CUALQUIER incremento de
 * versión, no solo para una base de datos nueva). */
const RECOVERY_STORE_NAME = "projectRecovery";
const DATABASE_VERSION = 2;

export interface IndexedDbProjectStoreOptions {
  /** Por defecto `"impulso-project-library"`; inyectable para aislar
   * bases de datos distintas en tests. */
  databaseName?: string;
  /** Inyectable para tests; por defecto `globalThis.indexedDB`. */
  indexedDB?: IDBFactory;
}

/**
 * Adaptador real de `ProjectStore` sobre IndexedDB, sobre el andamiaje
 * genérico de `@impulso/storage-kit` — tres object stores: descriptores
 * (livianos, para listar la Workspace), contenido (el `Project` completo,
 * cargado solo al abrir uno puntual), y recovery (Epic 8, ver
 * `ProjectRecoveryEntry`). `onUpgrade` crea cada store solo si todavía no
 * existe — `indexedDB` invoca `onupgradeneeded` para CUALQUIER incremento
 * de `version`, incluida una base de datos real que ya tenía los dos
 * stores originales de antes de Epic 8; volver a llamar
 * `createObjectStore` sobre uno ya existente lanzaría.
 */
export function createIndexedDbProjectStore(options: IndexedDbProjectStoreOptions = {}): ProjectStore {
  const connection = createLazyIndexedDbConnection({
    databaseName: options.databaseName ?? "impulso-project-library",
    indexedDB: options.indexedDB,
    version: DATABASE_VERSION,
    onUpgrade: (db) => {
      if (!db.objectStoreNames.contains(DESCRIPTOR_STORE_NAME)) db.createObjectStore(DESCRIPTOR_STORE_NAME);
      if (!db.objectStoreNames.contains(CONTENT_STORE_NAME)) db.createObjectStore(CONTENT_STORE_NAME);
      if (!db.objectStoreNames.contains(RECOVERY_STORE_NAME)) db.createObjectStore(RECOVERY_STORE_NAME);
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
      // Epic 8: borrar un Project también borra cualquier recovery huérfano
      // asociado — sin esto, eliminar un proyecto desde la Workspace dejaría
      // una entrada de recovery "resucitable" para un id que el usuario ya
      // decidió eliminar explícitamente.
      await runInTransaction(db, [DESCRIPTOR_STORE_NAME, CONTENT_STORE_NAME, RECOVERY_STORE_NAME], "readwrite", (transaction) =>
        Promise.all([
          promisifyRequest(transaction.objectStore(DESCRIPTOR_STORE_NAME).delete(id)),
          promisifyRequest(transaction.objectStore(CONTENT_STORE_NAME).delete(id)),
          promisifyRequest(transaction.objectStore(RECOVERY_STORE_NAME).delete(id)),
        ]),
      );
    },
    async saveRecovery(project, savedAt) {
      const entry: ProjectRecoveryEntry = { projectId: project.id, project, savedAt };
      await withStore<IDBValidKey>(RECOVERY_STORE_NAME, "readwrite", (store) => store.put(entry, project.id));
    },
    async getRecovery(id) {
      return withStore<ProjectRecoveryEntry | undefined>(RECOVERY_STORE_NAME, "readonly", (store) => store.get(id));
    },
    async clearRecovery(id) {
      await withStore<undefined>(RECOVERY_STORE_NAME, "readwrite", (store) => store.delete(id));
    },
    async listRecoveries() {
      return withStore<ProjectRecoveryEntry[]>(RECOVERY_STORE_NAME, "readonly", (store) => store.getAll());
    },
    async clear() {
      const db = await connection.getDb();
      await runInTransaction(db, [DESCRIPTOR_STORE_NAME, CONTENT_STORE_NAME, RECOVERY_STORE_NAME], "readwrite", (transaction) =>
        Promise.all([
          promisifyRequest(transaction.objectStore(RECOVERY_STORE_NAME).clear()),
          promisifyRequest(transaction.objectStore(DESCRIPTOR_STORE_NAME).clear()),
          promisifyRequest(transaction.objectStore(CONTENT_STORE_NAME).clear()),
        ]),
      );
    },
  };
}
