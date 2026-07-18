import type { Project } from "@impulso/document-schema";
import type { CanvasRuntime } from "./bootstrap.js";
import { mountCanvasRuntime } from "./bootstrap.js";
import { createDemoProject } from "./demoProject.js";
import { saveProjectLocally, loadProjectLocally } from "./persistence.js";

export interface ToolbarElements {
  newButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  openButton: HTMLButtonElement;
  statusElement: HTMLElement;
}

export interface ToolbarDependencies {
  canvasContainer: HTMLDivElement;
  elements: ToolbarElements;
  /** Inyectable para tests; por defecto `localStorage` real (ver persistence.ts). */
  storage?: Storage;
}

export interface Toolbar {
  getRuntime(): CanvasRuntime;
}

/**
 * Cablea los 5 botones de Milestone 1 (Impulso Alpha) sobre el
 * `CanvasRuntime` ya existente (`bootstrap.ts`) — sin tocar la API pública
 * de `@impulso/engine` ni de `@impulso/renderer-konva`. "Nuevo"/"Abrir"
 * reemplazan el runtime completo (`renderer.destroy()` + `mountCanvasRuntime`
 * de nuevo) en vez de exigirle al Engine una API de "reemplazar el Project
 * actual" que no tiene ni necesita — ver ADR-0009.
 */
export function mountToolbar(deps: ToolbarDependencies): Toolbar {
  const { elements, canvasContainer } = deps;
  let runtime = mountCanvasRuntime(canvasContainer);
  let unsubscribeHistory = subscribeToHistory();

  function setStatus(message: string): void {
    elements.statusElement.textContent = message;
  }

  function updateUndoRedoButtons(): void {
    elements.undoButton.disabled = !runtime.engine.canUndo();
    elements.redoButton.disabled = !runtime.engine.canRedo();
  }

  function subscribeToHistory(): () => void {
    return runtime.engine.subscribe((event) => {
      if (event.type === "historyChanged") updateUndoRedoButtons();
    });
  }

  function remount(project: Project): void {
    unsubscribeHistory();
    runtime.renderer.destroy();
    runtime = mountCanvasRuntime(canvasContainer, project);
    unsubscribeHistory = subscribeToHistory();
    updateUndoRedoButtons();
  }

  updateUndoRedoButtons();

  elements.newButton.addEventListener("click", () => {
    remount(createDemoProject());
    setStatus("Documento nuevo creado.");
  });

  elements.undoButton.addEventListener("click", () => {
    const result = runtime.engine.undo();
    setStatus(result.ok ? "Deshecho." : "No hay nada para deshacer.");
  });

  elements.redoButton.addEventListener("click", () => {
    const result = runtime.engine.redo();
    setStatus(result.ok ? "Rehecho." : "No hay nada para rehacer.");
  });

  elements.saveButton.addEventListener("click", () => {
    saveProjectLocally(runtime.engine.getProject(), deps.storage);
    setStatus("Documento guardado localmente.");
  });

  elements.openButton.addEventListener("click", () => {
    let loaded;
    try {
      loaded = loadProjectLocally(deps.storage);
    } catch (error) {
      setStatus(`No se pudo abrir el documento guardado: ${(error as Error).message}`);
      return;
    }
    if (!loaded) {
      setStatus("No hay ningún documento guardado todavía.");
      return;
    }
    remount(loaded);
    setStatus("Documento cargado.");
  });

  return { getRuntime: () => runtime };
}
