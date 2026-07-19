// @vitest-environment node
//
// fake-indexeddb (usado para testear el adaptador real sin un navegador)
// no interopera perfectamente con el `Blob` de jsdom (ver
// `@impulso/asset-library`'s `indexedDbStore.test.ts` — un Blob clonado a
// través de IndexedDB simulado pierde su prototipo real bajo jsdom). Este
// archivo corre en un entorno "node" explícito, donde el `Blob` nativo de
// Node sobrevive el roundtrip intacto.
import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { createIndexedDbTemplateStore } from "./indexedDbTemplateStore.js";
import { testTemplateStoreContract } from "./templateStore.contract.js";

describe("createIndexedDbTemplateStore", () => {
  testTemplateStoreContract("indexedDb", () => createIndexedDbTemplateStore({ databaseName: `test-db-${Math.random()}` }));

  it("usa 'impulso-template-library' como nombre de base de datos por defecto", async () => {
    const store = createIndexedDbTemplateStore();
    await store.save({ id: "tpl_1", moduleId: "sticker-builder", name: "x", tags: [], builtIn: false, createdAt: "n", updatedAt: "n" }, { project: {} as never });
    const databases = await indexedDB.databases();
    expect(databases.some((d) => d.name === "impulso-template-library")).toBe(true);
  });

  it("reutiliza la misma conexión entre llamadas sucesivas", async () => {
    const store = createIndexedDbTemplateStore({ databaseName: `test-reuse-${Math.random()}` });
    await store.save({ id: "tpl_1", moduleId: "m", name: "x", tags: [], builtIn: false, createdAt: "n", updatedAt: "n" }, { project: {} as never });
    await store.save({ id: "tpl_2", moduleId: "m", name: "y", tags: [], builtIn: false, createdAt: "n", updatedAt: "n" }, { project: {} as never });
    expect(await store.listDescriptors()).toHaveLength(2);
  });

  it("acepta un IDBFactory inyectado en vez de globalThis.indexedDB", async () => {
    const store = createIndexedDbTemplateStore({ databaseName: `test-injected-${Math.random()}`, indexedDB });
    await store.save({ id: "tpl_1", moduleId: "m", name: "x", tags: [], builtIn: false, createdAt: "n", updatedAt: "n" }, { project: {} as never });
    expect(await store.getDescriptor("tpl_1")).toBeDefined();
  });
});
