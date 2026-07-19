import { describe, expect, it } from "vitest";
import { createLazyIndexedDbConnection, openIndexedDb, promisifyRequest, runInTransaction } from "./indexedDb.js";

const STORE_A = "storeA";
const STORE_B = "storeB";

function openTestDb(databaseName: string): Promise<IDBDatabase> {
  return openIndexedDb({
    databaseName,
    onUpgrade: (db) => {
      db.createObjectStore(STORE_A);
      db.createObjectStore(STORE_B);
    },
  });
}

describe("promisifyRequest", () => {
  it("resuelve con el resultado del request en éxito", async () => {
    const db = await openTestDb("promisify-success");
    const result = await runInTransaction(db, STORE_A, "readwrite", (tx) =>
      promisifyRequest(tx.objectStore(STORE_A).put("valor", "clave")),
    );
    expect(result).toBe("clave");
  });

  it("propaga request.error si el request falla", async () => {
    const db = await openTestDb("promisify-error");
    await runInTransaction(db, STORE_A, "readwrite", (tx) => promisifyRequest(tx.objectStore(STORE_A).put("v", "k")));
    // Forzar un fallo real: una clave duplicada con `add` (en vez de `put`) lanza `ConstraintError`.
    await expect(
      runInTransaction(db, STORE_A, "readwrite", (tx) => promisifyRequest(tx.objectStore(STORE_A).add("otro", "k"))),
    ).rejects.toThrow();
  });
});

describe("openIndexedDb", () => {
  it("crea los object stores declarados en onUpgrade", async () => {
    const db = await openTestDb("open-creates-stores");
    expect(Array.from(db.objectStoreNames)).toEqual(expect.arrayContaining([STORE_A, STORE_B]));
  });

  it("acepta un IDBFactory inyectado en vez de globalThis.indexedDB", async () => {
    const db = await openIndexedDb({
      databaseName: "open-injected-factory",
      indexedDB: globalThis.indexedDB,
      onUpgrade: (database) => database.createObjectStore(STORE_A),
    });
    expect(Array.from(db.objectStoreNames)).toEqual([STORE_A]);
  });

  it("usa la versión indicada", async () => {
    const db = await openIndexedDb({
      databaseName: "open-with-version",
      version: 3,
      onUpgrade: (database) => database.createObjectStore(STORE_A),
    });
    expect(db.version).toBe(3);
  });
});

describe("createLazyIndexedDbConnection", () => {
  it("abre la base de datos solo una vez entre llamadas repetidas a getDb()", async () => {
    const connection = createLazyIndexedDbConnection({
      databaseName: "lazy-connection-memoized",
      onUpgrade: (db) => db.createObjectStore(STORE_A),
    });
    const first = await connection.getDb();
    const second = await connection.getDb();
    expect(first).toBe(second);
  });
});

describe("runInTransaction", () => {
  it("da acceso a la IDBTransaction cruda para combinar más de un store", async () => {
    const db = await openTestDb("run-in-transaction-multi-store");
    await runInTransaction(db, [STORE_A, STORE_B], "readwrite", (tx) =>
      Promise.all([
        promisifyRequest(tx.objectStore(STORE_A).put("a", "id")),
        promisifyRequest(tx.objectStore(STORE_B).put("b", "id")),
      ]),
    );
    const [a, b] = await runInTransaction(db, [STORE_A, STORE_B], "readonly", (tx) =>
      Promise.all([promisifyRequest(tx.objectStore(STORE_A).get("id")), promisifyRequest(tx.objectStore(STORE_B).get("id"))]),
    );
    expect(a).toBe("a");
    expect(b).toBe("b");
  });

  it("soporta un `run` síncrono (no solo uno que devuelva una Promise)", async () => {
    const db = await openTestDb("run-in-transaction-sync");
    const value = await runInTransaction(db, STORE_A, "readonly", (tx) => tx.objectStore(STORE_A).name);
    expect(value).toBe(STORE_A);
  });
});
