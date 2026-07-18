import { describe, expect, it } from "vitest";
import { ObjectIdSchema } from "@impulso/document-schema";
import { mountToolbar, type ToolbarElements } from "./toolbar.js";
import { saveProjectLocally } from "./persistence.js";
import { createDemoProject } from "./demoProject.js";

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

function elements(): ToolbarElements {
  return {
    newButton: document.createElement("button"),
    undoButton: document.createElement("button"),
    redoButton: document.createElement("button"),
    saveButton: document.createElement("button"),
    openButton: document.createElement("button"),
    statusElement: document.createElement("span"),
  };
}

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

function setup() {
  const els = elements();
  const storage = fakeStorage();
  const toolbar = mountToolbar({ canvasContainer: container(), elements: els, storage });
  return { els, storage, toolbar };
}

describe("mountToolbar — estado inicial", () => {
  it("monta el runtime y deja Deshacer/Rehacer deshabilitados (nada que deshacer todavía)", () => {
    const { els, toolbar } = setup();
    expect(els.undoButton.disabled).toBe(true);
    expect(els.redoButton.disabled).toBe(true);
    expect(toolbar.getRuntime().engine.getProject()).toBeDefined();
  });
});

describe("mountToolbar — Nuevo", () => {
  it("crea un runtime nuevo y actualiza el status", () => {
    const { els, toolbar } = setup();
    const before = toolbar.getRuntime();

    els.newButton.click();

    expect(toolbar.getRuntime()).not.toBe(before);
    expect(els.statusElement.textContent).toBe("Documento nuevo creado.");
  });

  it("el runtime nuevo empieza sin selección ni historial de undo", () => {
    const { els, toolbar } = setup();
    toolbar.getRuntime().engine.dispatch({
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("background"),
      transform: { x: 5 },
    });
    expect(toolbar.getRuntime().engine.canUndo()).toBe(true);

    els.newButton.click();

    expect(toolbar.getRuntime().engine.canUndo()).toBe(false);
    expect(els.undoButton.disabled).toBe(true);
  });
});

describe("mountToolbar — Deshacer / Rehacer", () => {
  it("sin cambios previos, Deshacer queda deshabilitado (un click real no hace nada)", () => {
    const { els } = setup();
    expect(els.undoButton.disabled).toBe(true);
    expect(() => els.undoButton.click()).not.toThrow();
    expect(els.statusElement.textContent).toBe(""); // un botón disabled no dispara el listener
  });

  it("si se fuerza un click sobre el botón deshabilitado (bypass defensivo), avisa por el status sin lanzar", () => {
    const { els } = setup();
    els.undoButton.disabled = false; // simula un estado inconsistente, no alcanzable por un click real
    expect(() => els.undoButton.click()).not.toThrow();
    expect(els.statusElement.textContent).toBe("No hay nada para deshacer.");
  });

  it("Deshacer revierte el último cambio y habilita Rehacer", () => {
    const { els, toolbar } = setup();
    toolbar.getRuntime().engine.dispatch({
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("background"),
      transform: { x: 999 },
    });
    expect(els.undoButton.disabled).toBe(false);

    els.undoButton.click();

    const object = toolbar.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.x).toBe(20); // valor original del demo (background)
    expect(els.statusElement.textContent).toBe("Deshecho.");
    expect(els.redoButton.disabled).toBe(false);
  });

  it("sin nada deshecho, Rehacer queda deshabilitado (un click real no hace nada)", () => {
    const { els } = setup();
    expect(els.redoButton.disabled).toBe(true);
    expect(() => els.redoButton.click()).not.toThrow();
    expect(els.statusElement.textContent).toBe("");
  });

  it("si se fuerza un click sobre Rehacer deshabilitado, avisa por el status sin lanzar", () => {
    const { els } = setup();
    els.redoButton.disabled = false;
    expect(() => els.redoButton.click()).not.toThrow();
    expect(els.statusElement.textContent).toBe("No hay nada para rehacer.");
  });

  it("Rehacer vuelve a aplicar un cambio deshecho", () => {
    const { els, toolbar } = setup();
    toolbar.getRuntime().engine.dispatch({
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("background"),
      transform: { x: 999 },
    });
    els.undoButton.click();

    els.redoButton.click();

    const object = toolbar.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.x).toBe(999);
    expect(els.statusElement.textContent).toBe("Rehecho.");
  });
});

describe("mountToolbar — Guardar / Abrir", () => {
  it("Guardar persiste el Project actual en el storage inyectado", () => {
    const { els, toolbar, storage } = setup();

    els.saveButton.click();

    expect(storage.getItem("impulso:sticker-builder:project")).not.toBeNull();
    expect(els.statusElement.textContent).toBe("Documento guardado localmente.");
    void toolbar;
  });

  it("Abrir sin nada guardado no lanza y avisa por el status", () => {
    const { els } = setup();
    expect(() => els.openButton.click()).not.toThrow();
    expect(els.statusElement.textContent).toBe("No hay ningún documento guardado todavía.");
  });

  it("Abrir carga el Project guardado, reemplazando el runtime actual", () => {
    const { els, toolbar, storage } = setup();
    const savedProject = createDemoProject();
    saveProjectLocally(savedProject, storage);
    const before = toolbar.getRuntime();

    els.openButton.click();

    expect(toolbar.getRuntime()).not.toBe(before);
    expect(toolbar.getRuntime().engine.getProject()).toEqual(savedProject);
    expect(els.statusElement.textContent).toBe("Documento cargado.");
  });

  it("guardar y luego abrir conserva cambios previos (round-trip completo)", () => {
    const { els, toolbar, storage } = setup();
    toolbar.getRuntime().engine.dispatch({
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("background"),
      transform: { x: 42 },
    });
    els.saveButton.click();
    void storage;

    els.openButton.click();

    const object = toolbar.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.x).toBe(42);
  });

  it("Abrir con un storage corrupto no lanza: avisa el error por el status", () => {
    const { els, storage } = setup();
    storage.setItem("impulso:sticker-builder:project", "esto no es JSON válido");

    expect(() => els.openButton.click()).not.toThrow();
    expect(els.statusElement.textContent).toContain("No se pudo abrir");
  });

  it("tras Abrir, el historial de undo del runtime anterior queda desconectado (no actualiza los botones)", () => {
    const { els, toolbar, storage } = setup();
    saveProjectLocally(createDemoProject(), storage);
    const previousRuntime = toolbar.getRuntime();

    els.openButton.click();

    // El runtime anterior sigue existiendo pero ya no está suscrito al toolbar.
    previousRuntime.engine.dispatch({
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("background"),
      transform: { x: 1 },
    });
    expect(els.undoButton.disabled).toBe(true); // el runtime NUEVO no tiene ese cambio
  });
});
