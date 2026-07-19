// @vitest-environment node
//
// fake-indexeddb no interopera perfectamente con el `Blob` de jsdom (ver
// `@impulso/asset-library`'s `indexedDbStore.test.ts`) — este archivo
// corre en un entorno "node" explícito, donde el `Blob` nativo sobrevive
// el roundtrip intacto.
import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { ProjectIdSchema } from "@impulso/document-schema";
import { createIndexedDbProjectStore } from "./indexedDbProjectStore.js";
import { testProjectStoreContract } from "./projectStore.contract.js";
import { buildWorkspaceProject } from "../testUtils/fixtures.js";

describe("createIndexedDbProjectStore", () => {
  testProjectStoreContract("indexedDb", () => createIndexedDbProjectStore({ databaseName: `test-db-${Math.random()}` }));

  it("usa 'impulso-project-library' como nombre de base de datos por defecto", async () => {
    const store = createIndexedDbProjectStore();
    await store.save(buildWorkspaceProject("project_1"));
    const databases = await indexedDB.databases();
    expect(databases.some((d) => d.name === "impulso-project-library")).toBe(true);
  });

  it("reutiliza la misma conexión entre llamadas sucesivas", async () => {
    const store = createIndexedDbProjectStore({ databaseName: `test-reuse-${Math.random()}` });
    await store.save(buildWorkspaceProject("project_1"));
    await store.save(buildWorkspaceProject("project_2"));
    expect(await store.listDescriptors()).toHaveLength(2);
  });

  it("acepta un IDBFactory inyectado en vez de globalThis.indexedDB", async () => {
    const store = createIndexedDbProjectStore({ databaseName: `test-injected-${Math.random()}`, indexedDB });
    await store.save(buildWorkspaceProject("project_1"));
    expect(await store.getDescriptor(ProjectIdSchema.parse("project_1"))).toBeDefined();
  });
});
