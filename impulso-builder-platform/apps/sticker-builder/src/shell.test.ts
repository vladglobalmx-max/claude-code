import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeProject, ProjectIdSchema } from "@impulso/document-schema";
import { createMemoryTemplateStore } from "@impulso/template-library";
import { createMemoryProjectStore } from "@impulso/project-library";
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
    saveAsTemplateDialogContainer: div(),
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
    statusElement: document.createElement("span"),
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

  it("'Mis proyectos' desde el editor destruye el editor y vuelve a mostrar la Workspace", async () => {
    const projectStore = createMemoryProjectStore();
    await projectStore.save(createDemoProject());

    const elements = buildShellElements();
    mountShell({ elements, projectStore, templateStore: createMemoryTemplateStore(), storage: fakeStorage(), generateThumbnail: fakeGenerateThumbnail });
    await Promise.resolve();
    (elements.workspaceContainer.querySelector(".workspace-card-open") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(elements.editorScreen.style.display).not.toBe("none"));

    elements.editor.backToWorkspaceButton.click();

    expect(elements.editorScreen.style.display).toBe("none");
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
});
