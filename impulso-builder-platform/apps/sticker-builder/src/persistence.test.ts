import { describe, expect, it } from "vitest";
import { serializeProject } from "@impulso/document-schema";
import { loadProjectLocally, hasLocalProject, clearLocalProject } from "./persistence.js";
import { createDemoProject } from "./demoProject.js";

const STORAGE_KEY = "impulso:sticker-builder:project";

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

describe("persistence local (slot legado, ver ADR-0014)", () => {
  it("hasLocalProject es false cuando no se guardó nada todavía", () => {
    expect(hasLocalProject(fakeStorage())).toBe(false);
  });

  it("loadProjectLocally devuelve null cuando no hay nada guardado", () => {
    expect(loadProjectLocally(fakeStorage())).toBeNull();
  });

  it("lee un Project ya guardado en el slot legado sin pérdida de datos", () => {
    const storage = fakeStorage();
    const project = createDemoProject();
    storage.setItem(STORAGE_KEY, serializeProject(project));

    expect(hasLocalProject(storage)).toBe(true);
    expect(loadProjectLocally(storage)).toEqual(project);
  });

  it("clearLocalProject elimina lo guardado", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, serializeProject(createDemoProject()));

    clearLocalProject(storage);

    expect(hasLocalProject(storage)).toBe(false);
    expect(loadProjectLocally(storage)).toBeNull();
  });

  it("propaga el error si lo guardado no es un Project válido (storage corrupto)", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, "{ esto no es JSON válido de Project");

    expect(() => loadProjectLocally(storage)).toThrow();
  });

  it("usa localStorage real por defecto cuando no se inyecta storage", () => {
    localStorage.clear();
    const project = createDemoProject();
    localStorage.setItem(STORAGE_KEY, serializeProject(project));

    expect(hasLocalProject()).toBe(true);
    expect(loadProjectLocally()).toEqual(project);

    clearLocalProject();
    expect(hasLocalProject()).toBe(false);
  });
});
