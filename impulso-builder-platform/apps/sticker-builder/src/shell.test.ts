import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeProject, ProjectIdSchema, AssetIdSchema, ObjectIdSchema, type Project } from "@impulso/document-schema";
import { createMemoryTemplateStore } from "@impulso/template-library";
import { createMemoryProjectStore, type ProjectStore } from "@impulso/project-library";
import { createMemoryAssetStore, type AssetBinaryStore } from "@impulso/asset-library";
import { mountShell, type ShellElements } from "./shell.js";
import { createDemoProject } from "./demoProject.js";
import type { AppElements } from "./app.js";

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

function buildEditorElements(): AppElements {
  function div(): HTMLDivElement {
    return document.createElement("div");
  }
  function button(): HTMLButtonElement {
    return document.createElement("button");
  }
  const canvasContainer = div();
  const canvasViewport = div();
  canvasViewport.appendChild(canvasContainer);

  return {
    canvasViewport,
    canvasContainer,
    layersContainer: div(),
    assetsContainer: div(),
    tabLayersButton: button(),
    tabAssetsButton: button(),
    inspectorContainer: div(),
    alignmentContainer: div(),
    toolsContainer: div(),
    gridSnapContainer: div(),
    zoomContainer: div(),
    rulerHorizontal: document.createElement("canvas"),
    rulerVertical: document.createElement("canvas"),
    pointerIndicator: div(),
    canvasArea: div(),
    newProjectDialogContainer: div(),
    exportDialogContainer: div(),
    productionExportDialogContainer: div(),
    saveAsTemplateDialogContainer: div(),
    unsavedChangesDialogContainer: div(),
    newButton: button(),
    undoButton: button(),
    redoButton: button(),
    saveButton: button(),
    backToWorkspaceButton: button(),
    exportButton: button(),
    productionExportButton: button(),
    saveAsTemplateButton: button(),
    duplicateButton: button(),
    deleteButton: button(),
    groupButton: button(),
    ungroupButton: button(),
    statusElement: document.createElement("span"),
    saveStatusElement: document.createElement("span"),
    saveStatusAnnouncer: document.createElement("span"),
  };
}

function buildShellElements(): ShellElements {
  const workspaceScreen = document.createElement("div");
  const workspaceContainer = document.createElement("div");
  workspaceScreen.appendChild(workspaceContainer);
  const editorScreen = document.createElement("div");
  editorScreen.style.display = "none";
  const editor = buildEditorElements();
  editorScreen.appendChild(editor.canvasViewport);
  document.body.append(workspaceScreen, editorScreen);

  return { workspaceScreen, workspaceContainer, editorScreen, editor };
}

const fakeGenerateThumbnail = async () => new Blob(["png"], { type: "image/png" });

/** jsdom no resuelve `onload`/`onerror` de un `<img>` real para una blob URL
 * falsa (la que stubea `URL.createObjectURL` en el `beforeEach` de este
 * archivo) — se queda colgado para siempre. Mismo stub que usa
 * `tools.test.ts` para poder ejercitar `preloadDocumentAssets` de verdad. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

/** Proyecto con un ImageObject real (referenciando un Asset en
 * `document.assets`) — para la regresión RC1 de abajo, que necesita un
 * Asset de type "image" cuyo binario `openEditor` deba precargar. */
function buildProjectWithImage(): Project {
  const project = createDemoProject();
  const assetId = AssetIdSchema.parse("asset_image_1");
  const metadata = { tags: [], visible: true, locked: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
  return {
    ...project,
    document: {
      ...project.document,
      assets: [{ id: assetId, type: "image", name: "foto.png", mimeType: "image/png", width: 10, height: 10, metadata, pluginData: {}, customProperties: {} }],
      pages: [
        {
          ...project.document.pages[0]!,
          layers: [
            {
              ...project.document.pages[0]!.layers[0]!,
              objects: [
                ...project.document.pages[0]!.layers[0]!.objects,
                {
                  id: ObjectIdSchema.parse("image_object_1"),
                  type: "image",
                  assetId,
                  transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                  size: { width: 10, height: 10 },
                  style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
                  metadata,
                  pluginData: {},
                  customProperties: {},
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/** Envuelve un `AssetBinaryStore` para registrar cada `assetId` consultado
 * — usado por la regresión RC1 de abajo para confirmar que abrir un
 * proyecto de verdad precarga sus imágenes (y no solo genera un thumbnail
 * correcto, que usa una ruta de resolución completamente aparte). */
function createTrackedAssetStore(inner: AssetBinaryStore): { store: AssetBinaryStore; requestedIds: string[] } {
  const requestedIds: string[] = [];
  return {
    store: {
      ...inner,
      get: async (assetId) => {
        requestedIds.push(assetId);
        return inner.get(assetId);
      },
    },
    requestedIds,
  };
}

/** Epic 8 — igual que en `app.test.ts`: envuelve un `ProjectStore` real
 * para que `save()` falle mientras `shouldFail()` sea `true`. */
function createFlakySaveStore(inner: ProjectStore, shouldFail: () => boolean): ProjectStore {
  return {
    ...inner,
    save: async (project, thumbnail) => {
      if (shouldFail()) throw new Error("fallo simulado");
      return inner.save(project, thumbnail);
    },
  };
}

describe("mountShell", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aterriza en la Workspace (editor oculto) al montar", async () => {
    const elements = buildShellElements();
    mountShell({ elements, projectStore: createMemoryProjectStore(), templateStore: createMemoryTemplateStore(), storage: fakeStorage() });
    await Promise.resolve();

    expect(elements.editorScreen.style.display).toBe("none");
    expect(elements.workspaceScreen.style.display).not.toBe("none");
  });

  it("abrir un proyecto desde la Workspace muestra el editor y oculta la Workspace", async () => {
    const projectStore = createMemoryProjectStore();
    const project = createDemoProject();
    await projectStore.save(project);

    const elements = buildShellElements();
    mountShell({ elements, projectStore, templateStore: createMemoryTemplateStore(), storage: fakeStorage(), generateThumbnail: fakeGenerateThumbnail });
    await Promise.resolve();

    (elements.workspaceContainer.querySelector(".workspace-card-open") as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(elements.editorScreen.style.display).not.toBe("none");
    });
    expect(elements.workspaceScreen.style.display).toBe("none");
  });

  it("regresión RC1: abrir un proyecto con una imagen precarga su binario ANTES/al mostrar el editor (no se queda como placeholder)", async () => {
    // Bug real encontrado en la validación de comprador en vivo: `mountApp()`
    // montaba el Canvas Runtime inicial con el `resolvedCache` de imágenes
    // vacío — cualquier ImageObject quedaba como placeholder para siempre,
    // sin importar cuánto tiempo pasara, porque `createImageNode`
    // (`@impulso/renderer-konva`) solo resuelve la Image UNA vez, al crear
    // el node. `remount()` (usado por "Nuevo"/"Abrir" DESDE DENTRO del
    // editor) ya evitaba este bug esperando `preloadDocumentAssets` antes de
    // montar — pero el primer `mountApp()` de `shell.ts` (el que usa
    // "Abrir" desde la Workspace, el flujo real de cualquier comprador) no
    // lo hacía. Este test falla sin el fix: antes de él, `binaryStore.get`
    // nunca se llamaba para el asset de imagen al abrir el proyecto.
    const projectStore = createMemoryProjectStore();
    const project = buildProjectWithImage();
    await projectStore.save(project);

    const innerBinaryStore = createMemoryAssetStore();
    await innerBinaryStore.set(AssetIdSchema.parse("asset_image_1"), new Blob(["x"], { type: "image/png" }));
    const { store: binaryStore, requestedIds } = createTrackedAssetStore(innerBinaryStore);
    vi.stubGlobal("Image", FakeImage);

    const elements = buildShellElements();
    mountShell({ elements, projectStore, binaryStore, templateStore: createMemoryTemplateStore(), storage: fakeStorage(), generateThumbnail: fakeGenerateThumbnail });
    await Promise.resolve();

    (elements.workspaceContainer.querySelector(".workspace-card-open") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(elements.editorScreen.style.display).not.toBe("none"));

    expect(requestedIds).toContain("asset_image_1");
  });

  it("'Mis proyectos' desde el editor destruye el editor y vuelve a mostrar la Workspace", async () => {
    const projectStore = createMemoryProjectStore();
    await projectStore.save(createDemoProject());

    const elements = buildShellElements();
    mountShell({ elements, projectStore, templateStore: createMemoryTemplateStore(), storage: fakeStorage(), generateThumbnail: fakeGenerateThumbnail });
    await Promise.resolve();
    (elements.workspaceContainer.querySelector(".workspace-card-open") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(elements.editorScreen.style.display).not.toBe("none"));

    elements.editor.backToWorkspaceButton.click();

    await vi.waitFor(() => {
      expect(elements.editorScreen.style.display).toBe("none");
    });
    expect(elements.workspaceScreen.style.display).not.toBe("none");
  });

  it("abrir un segundo proyecto destruye la instancia anterior del editor antes de montar la nueva", async () => {
    const projectStore = createMemoryProjectStore();
    await projectStore.save(createDemoProject());

    const elements = buildShellElements();
    mountShell({ elements, projectStore, templateStore: createMemoryTemplateStore(), storage: fakeStorage(), generateThumbnail: fakeGenerateThumbnail });
    await Promise.resolve();
    (elements.workspaceContainer.querySelector(".workspace-card-open") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(elements.editorScreen.style.display).not.toBe("none"));

    // volver y reabrir no debería lanzar ni dejar dos runtimes montados
    elements.editor.backToWorkspaceButton.click();
    await vi.waitFor(() => expect(elements.workspaceScreen.style.display).not.toBe("none"));
    (elements.workspaceContainer.querySelector(".workspace-card-open") as HTMLButtonElement).click();

    await vi.waitFor(() => expect(elements.editorScreen.style.display).not.toBe("none"));
    // 2 hijos esperados por runtime (no 4): el `.grid-overlay` de Fase 7.3
    // (Assisted Placement) + el wrapper que Konva genera — si el runtime
    // anterior hubiera quedado montado además del nuevo, serían 4.
    expect(elements.editor.canvasContainer.children).toHaveLength(2);
  });

  it("abrir un segundo proyecto mientras el editor ya está abierto destruye la instancia anterior antes de montar la nueva", async () => {
    const projectStore = createMemoryProjectStore();
    const first = createDemoProject();
    const second = { ...createDemoProject(), id: ProjectIdSchema.parse("project_two") };
    await projectStore.save(first);
    await projectStore.save(second);

    const elements = buildShellElements();
    mountShell({ elements, projectStore, templateStore: createMemoryTemplateStore(), storage: fakeStorage(), generateThumbnail: fakeGenerateThumbnail });
    await Promise.resolve();

    const cards = () => Array.from(elements.workspaceContainer.querySelectorAll(".workspace-card-open")) as HTMLButtonElement[];
    cards()[0]!.click();
    await vi.waitFor(() => expect(elements.editorScreen.style.display).not.toBe("none"));
    expect(elements.editor.canvasContainer.children).toHaveLength(2);

    // Sin pasar por "Mis proyectos": la tarjeta de la Workspace sigue en el
    // DOM (solo oculta) — clic directo en la segunda debe destruir la
    // instancia anterior del editor antes de montar la nueva.
    cards()[1]!.click();
    await vi.waitFor(() => expect(elements.editor.canvasContainer.children).toHaveLength(2));
  });

  it("migra transparentemente el proyecto legado de localStorage al ProjectStore al arrancar", async () => {
    const storage = fakeStorage();
    const legacyProject = createDemoProject();
    storage.setItem("impulso:sticker-builder:project", serializeProject(legacyProject));
    const projectStore = createMemoryProjectStore();

    const elements = buildShellElements();
    mountShell({ elements, projectStore, templateStore: createMemoryTemplateStore(), storage });

    await vi.waitFor(async () => {
      expect(await projectStore.getProject(legacyProject.id)).toEqual(legacyProject);
    });
    expect(storage.getItem("impulso:sticker-builder:project")).toBeNull();
  });

  it("destroy() limpia la Workspace y cualquier editor abierto", async () => {
    const projectStore = createMemoryProjectStore();
    await projectStore.save(createDemoProject());
    const elements = buildShellElements();
    const shell = mountShell({ elements, projectStore, templateStore: createMemoryTemplateStore(), storage: fakeStorage(), generateThumbnail: fakeGenerateThumbnail });
    await Promise.resolve();
    (elements.workspaceContainer.querySelector(".workspace-card-open") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(elements.editorScreen.style.display).not.toBe("none"));

    expect(() => shell.destroy()).not.toThrow();
  });

  // Epic 8 — Autosave, Recovery & Project Safety.
  describe("beforeunload / salida segura", () => {
    it("no advierte en beforeunload cuando el editor abierto está guardado (sin cambios pendientes)", async () => {
      const projectStore = createMemoryProjectStore();
      await projectStore.save(createDemoProject());

      const elements = buildShellElements();
      mountShell({ elements, projectStore, templateStore: createMemoryTemplateStore(), storage: fakeStorage(), generateThumbnail: fakeGenerateThumbnail });
      await Promise.resolve();
      (elements.workspaceContainer.querySelector(".workspace-card-open") as HTMLButtonElement).click();
      await vi.waitFor(() => expect(elements.editorScreen.style.display).not.toBe("none"));

      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });

    it("advierte (preventDefault) en beforeunload si el editor tiene cambios sin guardar", async () => {
      const projectStore = createMemoryProjectStore();
      await projectStore.save(createDemoProject());
      const keyboardTarget = document.createElement("div");

      const elements = buildShellElements();
      mountShell({
        elements,
        projectStore,
        templateStore: createMemoryTemplateStore(),
        storage: fakeStorage(),
        generateThumbnail: fakeGenerateThumbnail,
        keyboardTarget,
      });
      await Promise.resolve();
      (elements.workspaceContainer.querySelector(".workspace-card-open") as HTMLButtonElement).click();
      await vi.waitFor(() => expect(elements.editorScreen.style.display).not.toBe("none"));

      // "T" inserta un object de texto (ver `keyboardShortcuts.ts`) — un
      // cambio de contenido real, no efímero, que ensucia el Project.
      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));

      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it("'Mis proyectos' con un guardado fallido: abre el diálogo, y 'Permanecer' mantiene el editor abierto", async () => {
      const first = createDemoProject();
      const inner = createMemoryProjectStore();
      await inner.save(first);
      let shouldFail = true;
      const projectStore = createFlakySaveStore(inner, () => shouldFail);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const keyboardTarget = document.createElement("div");

      const elements = buildShellElements();
      mountShell({
        elements,
        projectStore,
        templateStore: createMemoryTemplateStore(),
        storage: fakeStorage(),
        generateThumbnail: fakeGenerateThumbnail,
        keyboardTarget,
      });
      await Promise.resolve();
      (elements.workspaceContainer.querySelector(".workspace-card-open") as HTMLButtonElement).click();
      await vi.waitFor(() => expect(elements.editorScreen.style.display).not.toBe("none"));

      keyboardTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
      elements.editor.backToWorkspaceButton.click();

      const overlay = elements.editor.unsavedChangesDialogContainer.querySelector(".unsaved-changes-dialog-overlay") as HTMLElement;
      await vi.waitFor(() => expect(overlay.style.display).not.toBe("none"));

      (elements.editor.unsavedChangesDialogContainer.querySelector(".unsaved-changes-dialog-stay") as HTMLButtonElement).click();

      // Permanece en el editor: nunca llega a mostrarse la Workspace.
      expect(elements.editorScreen.style.display).not.toBe("none");
      expect(elements.workspaceScreen.style.display).toBe("none");

      shouldFail = false;
      consoleError.mockRestore();
    });
  });
});
