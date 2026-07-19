import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ObjectIdSchema,
  PageIdSchema,
  DocumentIdSchema,
  LayerIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type SceneObject,
} from "@impulso/document-schema";
import { createMemoryTemplateStore, type TemplateStore } from "@impulso/template-library";
import { createMemoryProjectStore } from "@impulso/project-library";
import { mountApp, moveIndexBy, type AppElements } from "./app.js";
import { BUILT_IN_STICKER_TEMPLATES } from "./builtInTemplates.js";
import { createProjectFromSize } from "./projectPresets.js";

/** Pre-siembra el store con los 3 Templates incorporados ya "existentes"
 * (mismos ids que `BUILT_IN_STICKER_TEMPLATES`) — así `seedBuiltInTemplates`
 * (disparada al hacer click en "Nuevo") los salta a todos y nunca llama a
 * `generateThumbnail`/`exportProject`, que necesita rasterizar un PNG real
 * (`HTMLCanvasElement.toBlob`, no implementado por jsdom). Los tests de
 * `seedBuiltInTemplates` en sí viven en `builtInTemplates.test.ts`. */
async function preSeedBuiltIns(store: TemplateStore, now: string): Promise<void> {
  for (const seed of BUILT_IN_STICKER_TEMPLATES) {
    await store.save(
      { id: seed.id, moduleId: "sticker-builder", name: seed.name, tags: [], builtIn: true, createdAt: now, updatedAt: now },
      { project: createProjectFromSize({ widthMm: seed.widthMm, heightMm: seed.heightMm, shape: seed.shape, now }) },
    );
  }
}

const NOW = "2026-07-18T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

function buildRect(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 20, height: 20 },
    cornerRadius: 0,
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  } as SceneObject;
}

function buildProject(objects: SceneObject[]): Project {
  return {
    id: ProjectIdSchema.parse("project_1"),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse("document_1"),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse("page_1"),
          size: { width: 200, height: 200 },
          unit: "px",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects, metadata, pluginData: {}, customProperties: {} }],
          metadata,
          pluginData: {},
          customProperties: {},
        },
      ],
      assets: [],
      metadata,
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
    metadata: { ...metadata, name: "test" },
    pluginData: {},
    customProperties: {},
  };
}

function buildElements(): AppElements {
  const canvasViewport = document.createElement("div");
  const canvasContainer = document.createElement("div");
  const layersContainer = document.createElement("div");
  const assetsContainer = document.createElement("div");
  const inspectorContainer = document.createElement("div");
  const alignmentContainer = document.createElement("div");
  const toolsContainer = document.createElement("div");
  const gridSnapContainer = document.createElement("div");
  const zoomContainer = document.createElement("div");
  const newProjectDialogContainer = document.createElement("div");
  const exportDialogContainer = document.createElement("div");
  const saveAsTemplateDialogContainer = document.createElement("div");
  const rulerHorizontal = document.createElement("canvas");
  const rulerVertical = document.createElement("canvas");
  const pointerIndicator = document.createElement("div");
  const canvasArea = document.createElement("div");

  function button(): HTMLButtonElement {
    return document.createElement("button");
  }
  const statusElement = document.createElement("span");

  const root = document.createElement("div");
  root.append(
    canvasViewport,
    layersContainer,
    assetsContainer,
    inspectorContainer,
    alignmentContainer,
    toolsContainer,
    gridSnapContainer,
    zoomContainer,
    newProjectDialogContainer,
    exportDialogContainer,
    saveAsTemplateDialogContainer,
    statusElement,
    rulerHorizontal,
    rulerVertical,
    pointerIndicator,
    canvasArea,
  );
  canvasViewport.appendChild(canvasContainer);
  document.body.appendChild(root);

  return {
    canvasViewport,
    canvasContainer,
    layersContainer,
    assetsContainer,
    tabLayersButton: button(),
    tabAssetsButton: button(),
    inspectorContainer,
    alignmentContainer,
    toolsContainer,
    gridSnapContainer,
    zoomContainer,
    rulerHorizontal,
    rulerVertical,
    pointerIndicator,
    canvasArea,
    newProjectDialogContainer,
    exportDialogContainer,
    saveAsTemplateDialogContainer,
    newButton: button(),
    undoButton: button(),
    redoButton: button(),
    saveButton: button(),
    backToWorkspaceButton: button(),
    exportButton: button(),
    saveAsTemplateButton: button(),
    duplicateButton: button(),
    deleteButton: button(),
    groupButton: button(),
    ungroupButton: button(),
    statusElement,
  };
}

function idGeneratorFrom(ids: string[]): () => string {
  let index = 0;
  return () => ids[index++]!;
}

function ids(...values: string[]) {
  return values.map((v) => ObjectIdSchema.parse(v));
}

describe("moveIndexBy", () => {
  it("mueve el id delta posiciones hacia adelante", () => {
    expect(moveIndexBy(ids("a", "b", "c"), ObjectIdSchema.parse("a"), 1)).toEqual(ids("b", "a", "c"));
  });

  it("mueve el id delta posiciones hacia atrás", () => {
    expect(moveIndexBy(ids("a", "b", "c"), ObjectIdSchema.parse("c"), -1)).toEqual(ids("a", "c", "b"));
  });

  it("no hace nada si ya está en el límite", () => {
    expect(moveIndexBy(ids("a", "b", "c"), ObjectIdSchema.parse("c"), 1)).toEqual(ids("a", "b", "c"));
    expect(moveIndexBy(ids("a", "b", "c"), ObjectIdSchema.parse("a"), -1)).toEqual(ids("a", "b", "c"));
  });

  it("no hace nada si el id no existe", () => {
    expect(moveIndexBy(ids("a", "b"), ObjectIdSchema.parse("z"), 1)).toEqual(ids("a", "b"));
  });
});

describe("mountApp", () => {
  let elements: AppElements;
  // Cada test recibe su propio EventTarget para los atajos de teclado — sin
  // esto, todas las instancias de App montadas en TODO el archivo (nunca
  // destruidas explícitamente por la mayoría de los tests) compartirían el
  // listener global de `window`, y un `dispatchEvent` en un test tardío
  // dispararía también los atajos de instancias de tests anteriores ya
  // "terminados" (con sus `vi.stubGlobal` ya revertidos).
  let keyboardTarget: EventTarget;

  beforeEach(() => {
    elements = buildElements();
    keyboardTarget = document.createElement("div");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("monta el CanvasRuntime, el panel de capas y el Inspector con el Project inicial dado", () => {
    const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a")]), now: () => NOW });

    expect(app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects).toHaveLength(1);
    expect(elements.layersContainer.querySelectorAll(".layer-row")).toHaveLength(1);
  });

  it("sin initialProject, monta el proyecto de demostración", () => {
    const app = mountApp({ elements, keyboardTarget });
    expect(app.getRuntime().engine.getProject().moduleId).toBe("sticker-builder");
  });

  it("Deshacer/Rehacer reflejan canUndo/canRedo del Engine", () => {
    const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a")]), now: () => NOW });
    expect(elements.undoButton.disabled).toBe(true);

    app.getRuntime().engine.dispatch({ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 99 } });
    expect(elements.undoButton.disabled).toBe(false);

    elements.undoButton.click();
    expect(elements.statusElement.textContent).toBe("Deshecho.");
    expect(elements.redoButton.disabled).toBe(false);

    elements.redoButton.click();
    expect(elements.statusElement.textContent).toBe("Rehecho.");
  });

  it("Deshacer/Rehacer sin nada pendiente informa el status correspondiente (el botón mismo queda deshabilitado, ver atajo de teclado)", () => {
    mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a")]), now: () => NOW });
    expect(elements.undoButton.disabled).toBe(true);
    expect(elements.redoButton.disabled).toBe(true);

    // jsdom (como cualquier navegador real) no dispara `click` sobre un
    // botón `disabled` — se lo habilita manualmente para poder ejercitar la
    // rama "nada que deshacer/rehacer" del propio handler del botón.
    elements.undoButton.disabled = false;
    elements.undoButton.click();
    expect(elements.statusElement.textContent).toBe("No hay nada para deshacer.");

    elements.redoButton.disabled = false;
    elements.redoButton.click();
    expect(elements.statusElement.textContent).toBe("No hay nada para rehacer.");
  });

  it("Guardar persiste el Project en el ProjectStore con un thumbnail (ver ADR-0014)", async () => {
    const projectStore = createMemoryProjectStore();
    const generateThumbnail = vi.fn().mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    const app = mountApp({
      elements,
      keyboardTarget,
      projectStore,
      generateThumbnail,
      initialProject: buildProject([buildRect("a")]),
      now: () => NOW,
    });

    elements.saveButton.click();
    await vi.waitFor(() => {
      expect(elements.statusElement.textContent).toBe("Documento guardado.");
    });

    const projectId = app.getRuntime().engine.getProject().id;
    expect(await projectStore.getProject(projectId)).toEqual(app.getRuntime().engine.getProject());
    expect((await projectStore.getDescriptor(projectId))?.thumbnail?.type).toBe("image/png");
  });

  it("un fallo generando el thumbnail no bloquea el guardado del Project", async () => {
    const projectStore = createMemoryProjectStore();
    const generateThumbnail = vi.fn().mockRejectedValue(new Error("fallo de rasterización"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = mountApp({
      elements,
      keyboardTarget,
      projectStore,
      generateThumbnail,
      initialProject: buildProject([buildRect("a")]),
      now: () => NOW,
    });

    elements.saveButton.click();
    await vi.waitFor(() => {
      expect(elements.statusElement.textContent).toBe("Documento guardado.");
    });

    const projectId = app.getRuntime().engine.getProject().id;
    expect(await projectStore.getProject(projectId)).toBeDefined();
    consoleError.mockRestore();
  });

  it("el botón 'Mis proyectos' llama a onBackToWorkspace", () => {
    const onBackToWorkspace = vi.fn();
    mountApp({ elements, keyboardTarget, onBackToWorkspace, initialProject: buildProject([buildRect("a")]), now: () => NOW });

    elements.backToWorkspaceButton.click();

    expect(onBackToWorkspace).toHaveBeenCalledOnce();
  });

  it("el botón 'Nuevo' abre el diálogo, y crear (Personalizado) reemplaza el Project actual", async () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    const templateStore = createMemoryTemplateStore();
    await preSeedBuiltIns(templateStore, NOW);
    const app = mountApp({
      elements,
      keyboardTarget,
      initialProject: buildProject([buildRect("a")]),
      now: () => NOW,
      templateStore,
    });

    elements.newButton.click();
    const overlay = elements.newProjectDialogContainer.querySelector(".new-project-dialog-overlay") as HTMLElement;
    await vi.waitFor(() => {
      expect(overlay.style.display).not.toBe("none");
      expect(elements.newProjectDialogContainer.querySelector(".new-project-card-custom")).not.toBeNull();
    });

    const customCard = Array.from(
      elements.newProjectDialogContainer.querySelectorAll(".new-project-card"),
    ).find((card) => card.textContent === "Personalizado") as HTMLElement;
    customCard.click();
    (elements.newProjectDialogContainer.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    expect(overlay.style.display).toBe("none");
    await vi.waitFor(() => {
      expect(elements.statusElement.textContent).toBe("Documento nuevo creado.");
    });
    // El proyecto nuevo (Personalizado, sin objects) no tiene el rectangle "a".
    expect(app.getRuntime().engine.getProject().id).not.toBe("project_1");
  });

  it("Eliminar borra todos los objects seleccionados", () => {
    const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a"), buildRect("b")]), now: () => NOW });
    app.getRuntime().engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

    elements.deleteButton.click();

    expect(app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual(["b"]);
  });

  it("Duplicar clona los objects seleccionados con un offset y los deja seleccionados", () => {
    const app = mountApp({
      elements,
      keyboardTarget,
      initialProject: buildProject([buildRect("a")]),
      now: () => NOW,
      generateId: idGeneratorFrom(["dup1"]),
    });
    app.getRuntime().engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

    elements.duplicateButton.click();

    const objects = app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
    expect(objects).toHaveLength(2);
    expect(objects[1]?.id).toBe("object_dup1");
    expect(objects[1]?.transform.x).toBe(30); // 10 + 20 de offset
    expect(app.getRuntime().engine.getSelection()).toEqual(["object_dup1"]);
  });

  it("Agrupar combina 2+ objects seleccionados en un Group y lo deja seleccionado", () => {
    const app = mountApp({
      elements,
      keyboardTarget,
      initialProject: buildProject([buildRect("a"), buildRect("b")]),
      now: () => NOW,
      generateId: idGeneratorFrom(["group1"]),
    });
    app.getRuntime().engine.dispatch({
      type: "setSelection",
      objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")],
    });

    elements.groupButton.click();

    const objects = app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
    expect(objects).toHaveLength(1);
    expect(objects[0]?.type).toBe("group");
    expect(app.getRuntime().engine.getSelection()).toEqual(["object_group1"]);
  });

  it("Agrupar con menos de 2 seleccionados no hace nada", () => {
    const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a")]), now: () => NOW });
    app.getRuntime().engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

    elements.groupButton.click();

    expect(app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects).toHaveLength(1);
  });

  it("Desagrupar deshace un Group seleccionado", () => {
    const group: SceneObject = {
      id: ObjectIdSchema.parse("g1"),
      type: "group",
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
      metadata,
      pluginData: {},
      customProperties: {},
      children: [buildRect("child_a")],
    };
    const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([group]), now: () => NOW });
    app.getRuntime().engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("g1")] });

    elements.ungroupButton.click();

    const objects = app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
    expect(objects.map((o) => o.id)).toEqual(["child_a"]);
  });

  it("Desagrupar sin un Group seleccionado no hace nada", () => {
    const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a")]), now: () => NOW });
    app.getRuntime().engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

    elements.ungroupButton.click();

    expect(app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects).toHaveLength(1);
  });

  it("los botones de acción se habilitan/deshabilitan según la selección", () => {
    const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a"), buildRect("b")]), now: () => NOW });
    expect(elements.deleteButton.disabled).toBe(true);
    expect(elements.duplicateButton.disabled).toBe(true);
    expect(elements.groupButton.disabled).toBe(true);
    expect(elements.ungroupButton.disabled).toBe(true);

    app.getRuntime().engine.dispatch({
      type: "setSelection",
      objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")],
    });
    expect(elements.deleteButton.disabled).toBe(false);
    expect(elements.duplicateButton.disabled).toBe(false);
    expect(elements.groupButton.disabled).toBe(false);
    expect(elements.ungroupButton.disabled).toBe(true); // 2 seleccionados, no son un solo group
  });

  describe("atajos de teclado", () => {
    it("V/T/I están cableados: T inserta texto, I abre el picker de imagen", () => {
      mountApp({ elements, keyboardTarget, initialProject: buildProject([]), now: () => NOW });

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
      const objects = elements.layersContainer.querySelectorAll(".layer-row");
      expect(objects).toHaveLength(1);

      const fileInput = elements.toolsContainer.querySelector(".tool-image-input") as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");
      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "i" }));
      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it("Ctrl/Cmd+A selecciona todos los objects de nivel superior; Escape limpia la selección", () => {
      const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a"), buildRect("b")]), now: () => NOW });

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true }));
      expect(app.getRuntime().engine.getSelection()).toEqual(["a", "b"]);

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(app.getRuntime().engine.getSelection()).toEqual([]);
    });

    it("las flechas mueven el object seleccionado", () => {
      const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a")]), now: () => NOW });
      app.getRuntime().engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

      const object = app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform.x).toBe(11);
    });

    it("Ctrl/Cmd+] adelanta la capa seleccionada; Ctrl/Cmd+[ la retrasa", () => {
      const app = mountApp({
        elements,
        keyboardTarget,
        initialProject: buildProject([buildRect("a"), buildRect("b"), buildRect("c")]),
        now: () => NOW,
      });
      app.getRuntime().engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "]", ctrlKey: true }));
      expect(app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual([
        "b",
        "a",
        "c",
      ]);

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "[", ctrlKey: true }));
      expect(app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual([
        "a",
        "b",
        "c",
      ]);
    });

    it("adelantar/atrasar capa con más de un object seleccionado no hace nada", () => {
      const app = mountApp({
        elements,
        keyboardTarget,
        initialProject: buildProject([buildRect("a"), buildRect("b")]),
        now: () => NOW,
      });
      app.getRuntime().engine.dispatch({
        type: "setSelection",
        objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")],
      });

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "]", ctrlKey: true }));

      expect(app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual([
        "a",
        "b",
      ]);
    });

    it("Ctrl/Cmd+Z / Shift+Z deshacen/rehacen; Ctrl/Cmd+S guarda; Delete elimina; Ctrl/Cmd+D duplica; Ctrl/Cmd+G/Shift+G agrupan/desagrupan; Ctrl/Cmd+O navega a la Workspace", async () => {
      const onBackToWorkspace = vi.fn();
      const app = mountApp({
        elements,
        keyboardTarget,
        onBackToWorkspace,
        projectStore: createMemoryProjectStore(),
        generateThumbnail: async () => new Blob(["png"], { type: "image/png" }),
        initialProject: buildProject([buildRect("a"), buildRect("b")]),
        now: () => NOW,
        generateId: idGeneratorFrom(["dup1", "group1"]),
      });

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }));
      await vi.waitFor(() => {
        expect(elements.statusElement.textContent).toBe("Documento guardado.");
      });

      app.getRuntime().engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "d", ctrlKey: true }));
      expect(app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects).toHaveLength(3);

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
      expect(elements.statusElement.textContent).toBe("Deshecho.");
      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true }));
      expect(elements.statusElement.textContent).toBe("Rehecho.");

      app.getRuntime().engine.dispatch({
        type: "setSelection",
        objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")],
      });
      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "g", ctrlKey: true }));
      const afterGroup = app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(afterGroup.some((o) => o.type === "group")).toBe(true);

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "g", ctrlKey: true, shiftKey: true }));
      const afterUngroup = app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(afterUngroup.some((o) => o.type === "group")).toBe(false);

      app.getRuntime().engine.dispatch({ type: "setSelection", objectIds: [] });
      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "o", ctrlKey: true }));
      expect(onBackToWorkspace).toHaveBeenCalledOnce();
    });
  });

  it("el zoom mide el tamaño de página actual para 'Ajustar a pantalla'", () => {
    mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a")]), now: () => NOW });
    Object.defineProperty(elements.canvasViewport, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(elements.canvasViewport, "clientHeight", { value: 400, configurable: true });

    (elements.zoomContainer.querySelector(".zoom-fit") as HTMLButtonElement).click();

    // page 200x200, viewport 400x400, padding 32 -> disponible 336x336 -> min(1.68,1.68)
    expect(elements.canvasContainer.style.transform).toBe("scale(1.68)");
  });

  it("las pestañas de la sidebar izquierda alternan entre Capas y Assets", () => {
    mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a")]), now: () => NOW });

    expect(elements.layersContainer.style.display).toBe("");
    expect(elements.assetsContainer.style.display).toBe("none");
    expect(elements.tabLayersButton.classList.contains("active")).toBe(true);

    elements.tabAssetsButton.click();
    expect(elements.layersContainer.style.display).toBe("none");
    expect(elements.assetsContainer.style.display).toBe("");
    expect(elements.tabAssetsButton.classList.contains("active")).toBe(true);
    expect(elements.tabLayersButton.classList.contains("active")).toBe(false);

    elements.tabLayersButton.click();
    expect(elements.layersContainer.style.display).toBe("");
    expect(elements.assetsContainer.style.display).toBe("none");
    expect(elements.tabLayersButton.classList.contains("active")).toBe(true);
    expect(elements.tabAssetsButton.classList.contains("active")).toBe(false);
  });

  it("destroy() limpia toda la UI montada (capas, inspector, atajos, zoom, herramientas, diálogo)", () => {
    const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([buildRect("a")]), now: () => NOW });

    app.destroy();

    expect(elements.toolsContainer.querySelector(".tool-text")).toBeNull();
    expect(elements.zoomContainer.querySelector(".zoom-control")).toBeNull();
    expect(elements.newProjectDialogContainer.querySelector(".new-project-dialog-overlay")).toBeNull();

    keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
    expect(elements.layersContainer.querySelectorAll(".layer-row")).toHaveLength(1); // sin cambios: los atajos ya no escuchan
  });

  it("sin now/generateId inyectados, usa los valores por defecto reales", () => {
    const app = mountApp({ elements, keyboardTarget, initialProject: buildProject([]) });

    app.getRuntime().engine.dispatch({ type: "setSelection", objectIds: [] });
    keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));

    const objects = app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
    expect(objects[0]?.id).toMatch(/^object_/);
  });

  it("sin keyboardTarget inyectado, los atajos escuchan en window por defecto", () => {
    const app = mountApp({ elements, initialProject: buildProject([]) });
    try {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
      const objects = app.getRuntime().engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(objects).toHaveLength(1);
    } finally {
      app.destroy();
    }
  });
});
