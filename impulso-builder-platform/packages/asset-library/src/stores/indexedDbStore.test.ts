// jsdom (el entorno por defecto de este paquete, ver vitest.config.ts) trae
// su propio `Blob` interno, que `fake-indexeddb` no sabe clonar
// correctamente (el valor recuperado pierde el prototipo de Blob) — un
// problema conocido de interoperabilidad entre ambos, no un bug de
// `indexedDbStore.ts`. Este archivo corre en el entorno "node" en cambio,
// donde el `Blob` nativo sí sobrevive el roundtrip de `fake-indexeddb`
// intacto (ver ADR de esta épica).
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AssetIdSchema } from "@impulso/document-schema";
import { createIndexedDbAssetStore } from "./indexedDbStore.js";
import { testAssetBinaryStoreContract, blobToText } from "./assetBinaryStore.contract.js";

let counter = 0;
/** Cada test usa su propia base de datos — evita que el estado de una
 * prueba se filtre a la siguiente (fake-indexeddb persiste entre tests
 * dentro del mismo proceso, igual que el IndexedDB real de un navegador). */
function freshDatabaseName(): string {
  return `test-db-${++counter}`;
}

describe("createIndexedDbAssetStore", () => {
  testAssetBinaryStoreContract("indexedDbStore", () =>
    createIndexedDbAssetStore({ databaseName: freshDatabaseName() }),
  );

  it("usa 'impulso-asset-library' como nombre de base de datos por defecto (no lanza al abrir)", async () => {
    const store = createIndexedDbAssetStore();
    await expect(store.get(AssetIdSchema.parse("asset_x"))).resolves.toBeUndefined();
  });

  it("reutiliza la misma conexión entre llamadas sucesivas (no reabre la base de datos cada vez)", async () => {
    const store = createIndexedDbAssetStore({ databaseName: freshDatabaseName() });
    const assetId = AssetIdSchema.parse("asset_1");

    await store.set(assetId, new Blob(["a"]));
    await store.set(assetId, new Blob(["b"])); // segunda operación reutiliza getDb()

    expect(await blobToText((await store.get(assetId))!)).toBe("b");
  });

  it("acepta un IDBFactory inyectado explícitamente", async () => {
    const store = createIndexedDbAssetStore({
      databaseName: freshDatabaseName(),
      indexedDB: globalThis.indexedDB,
    });
    const assetId = AssetIdSchema.parse("asset_1");
    await store.set(assetId, new Blob(["contenido"]));

    expect(await blobToText((await store.get(assetId))!)).toBe("contenido");
  });
});
