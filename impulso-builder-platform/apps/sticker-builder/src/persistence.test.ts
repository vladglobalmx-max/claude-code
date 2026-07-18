import { describe, expect, it } from "vitest";
import { saveProjectLocally, loadProjectLocally, hasLocalProject, clearLocalProject } from "./persistence.js";
import { createDemoProject } from "./demoProject.js";

/** Storage en memoria, aislado entre tests — evita depender del
 * `localStorage` global de jsdom (compartido entre casos si no se limpia). */
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

describe("persistence local", () => {
  it("hasLocalProject es false cuando no se guardó nada todavía", () => {
    expect(hasLocalProject(fakeStorage())).toBe(false);
  });

  it("loadProjectLocally devuelve null cuando no hay nada guardado", () => {
    expect(loadProjectLocally(fakeStorage())).toBeNull();
  });

  it("guarda y recupera un Project sin pérdida de datos", () => {
    const storage = fakeStorage();
    const project = createDemoProject();

    saveProjectLocally(project, storage);

    expect(hasLocalProject(storage)).toBe(true);
    expect(loadProjectLocally(storage)).toEqual(project);
  });

  it("clearLocalProject elimina lo guardado", () => {
    const storage = fakeStorage();
    saveProjectLocally(createDemoProject(), storage);

    clearLocalProject(storage);

    expect(hasLocalProject(storage)).toBe(false);
    expect(loadProjectLocally(storage)).toBeNull();
  });

  it("un guardado posterior sobrescribe el anterior (un solo slot)", () => {
    const storage = fakeStorage();
    const first = createDemoProject();
    const second = { ...createDemoProject(), metadata: { ...first.metadata, name: "Segundo documento" } };

    saveProjectLocally(first, storage);
    saveProjectLocally(second, storage);

    const loaded = loadProjectLocally(storage);
    expect(loaded?.metadata.name).toBe("Segundo documento");
    expect(loaded).toEqual(second);
  });

  it("propaga el error si lo guardado no es un Project válido (storage corrupto)", () => {
    const storage = fakeStorage();
    storage.setItem("impulso:sticker-builder:project", "{ esto no es JSON válido de Project");

    expect(() => loadProjectLocally(storage)).toThrow();
  });

  it("usa localStorage real por defecto cuando no se inyecta storage", () => {
    localStorage.clear();
    const project = createDemoProject();

    saveProjectLocally(project);

    expect(hasLocalProject()).toBe(true);
    expect(loadProjectLocally()).toEqual(project);

    clearLocalProject();
    expect(hasLocalProject()).toBe(false);
  });
});
