import { describe, expect, it, vi } from "vitest";
import { serializeProject } from "@impulso/document-schema";
import { createMemoryProjectStore } from "@impulso/project-library";
import { createMemoryAssetStore } from "@impulso/asset-library";
import { migrateLegacyLocalProject } from "./workspaceMigration.js";
import { createDemoProject } from "./demoProject.js";

const STORAGE_KEY = "impulso:sticker-builder:project";
const NOW = "2026-07-19T00:00:00.000Z";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe("migrateLegacyLocalProject", () => {
  it("no hace nada y devuelve migrated:false si no hay proyecto legado guardado", async () => {
    const storage = fakeStorage();
    const projectStore = createMemoryProjectStore();
    const binaryStore = createMemoryAssetStore();

    const result = await migrateLegacyLocalProject(projectStore, binaryStore, { storage, now: () => NOW });

    expect(result).toEqual({ migrated: false, migratedImageCount: 0 });
    expect(await projectStore.listDescriptors()).toEqual([]);
  });

  it("mueve el proyecto legado al ProjectStore y limpia el slot legado", async () => {
    const storage = fakeStorage();
    const project = createDemoProject();
    storage.setItem(STORAGE_KEY, serializeProject(project));
    const projectStore = createMemoryProjectStore();
    const binaryStore = createMemoryAssetStore();

    const result = await migrateLegacyLocalProject(projectStore, binaryStore, { storage, now: () => NOW });

    expect(result.migrated).toBe(true);
    expect(await projectStore.getProject(project.id)).toEqual(project);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("descarta silenciosamente un slot legado corrupto (no bloquea el arranque)", async () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, "{ esto no es JSON válido");
    const projectStore = createMemoryProjectStore();
    const binaryStore = createMemoryAssetStore();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await migrateLegacyLocalProject(projectStore, binaryStore, { storage, now: () => NOW });

    expect(result).toEqual({ migrated: false, migratedImageCount: 0 });
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(await projectStore.listDescriptors()).toEqual([]);
    consoleError.mockRestore();
  });
});
