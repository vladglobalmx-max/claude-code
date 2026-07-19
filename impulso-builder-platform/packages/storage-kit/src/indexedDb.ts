/**
 * Andamiaje genérico de IndexedDB, extraído tras aparecer duplicado casi
 * línea por línea en tres pilares de plataforma reales (Asset Library,
 * Template Library, Project Library) — nunca antes de que existiera un
 * tercer consumidor real (ver ADR-0014). Sin ninguna noción de qué se
 * guarda: un object store puede contener binarios, descriptores, Projects
 * completos o cualquier otra cosa — este paquete no lo sabe ni le importa.
 */

/** Envuelve un `IDBRequest` en una Promise — `onsuccess`/`onerror`, sin más. */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Operación de IndexedDB fallida."));
  });
}

export interface OpenIndexedDbOptions {
  databaseName: string;
  /** Inyectable para tests; por defecto `globalThis.indexedDB`. */
  indexedDB?: IDBFactory;
  /** Por defecto 1 — súbela si un consumidor necesita migrar el esquema de sus object stores en el futuro. */
  version?: number;
  /** Crea los object stores que este consumidor necesita. Solo corre la primera vez (o al subir `version`). */
  onUpgrade: (database: IDBDatabase) => void;
  /** Mensaje de error si `indexedDB.open` falla — cada consumidor lo personaliza para su propio dominio. */
  openErrorMessage?: string;
}

/** Abre (o crea) una base de datos IndexedDB. Una sola llamada — quien
 * necesite reutilizar la conexión entre operaciones usa `createLazyIndexedDbConnection`. */
export function openIndexedDb(options: OpenIndexedDbOptions): Promise<IDBDatabase> {
  const indexedDB = options.indexedDB ?? globalThis.indexedDB;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(options.databaseName, options.version ?? 1);
    request.onupgradeneeded = () => options.onUpgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    // No cubierto por tests: reproducir de forma determinística un fallo
    // real de `indexedDB.open` (ej. VersionError) sin dejar conexiones
    // colgadas es frágil en `fake-indexeddb` — se verifica manualmente
    // contra un navegador real (mismo criterio ya documentado en Asset
    // Library/Template Library antes de esta extracción).
    request.onerror = () => reject(request.error ?? new Error(options.openErrorMessage ?? "No se pudo abrir la base de datos."));
  });
}

/** Memoiza la conexión (una sola vez, perezosamente) — el patrón que cada
 * store real (`createIndexedDb*Store`) necesita para no reabrir la base de
 * datos en cada operación. */
export function createLazyIndexedDbConnection(options: OpenIndexedDbOptions): { getDb(): Promise<IDBDatabase> } {
  let dbPromise: Promise<IDBDatabase> | undefined;
  return {
    getDb(): Promise<IDBDatabase> {
      dbPromise ??= openIndexedDb(options);
      return dbPromise;
    },
  };
}

/** Corre una transacción sobre uno o más object stores, devolviendo lo que
 * `run` resuelva. `run` recibe la `IDBTransaction` cruda — el llamador
 * decide qué store(s) tomar de ella y cuántas operaciones combinar (ej.
 * escribir en dos stores dentro de la misma transacción atómica). */
export function runInTransaction<T>(
  db: IDBDatabase,
  storeNames: string | string[],
  mode: IDBTransactionMode,
  run: (transaction: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const transaction = db.transaction(storeNames, mode);
  return Promise.resolve(run(transaction));
}
