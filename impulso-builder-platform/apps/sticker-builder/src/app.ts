import { ObjectIdSchema, type ObjectId, type Project } from "@impulso/document-schema";
import { findObjectInDocument, cloneSceneObjectWithNewIds } from "@impulso/engine";
import { createIndexedDbAssetStore, type AssetBinaryStore } from "@impulso/asset-library";
import type { CanvasRuntime } from "./bootstrap.js";
import { mountCanvasRuntime } from "./bootstrap.js";
import { createDemoProject } from "./demoProject.js";
import { saveProjectLocally, loadProjectLocally } from "./persistence.js";
import { createResolvedAssetCache, preloadDocumentAssets, type ResolvedAssetCache } from "./assetResolution.js";
import { migrateLegacyEmbeddedImages } from "./legacyMigration.js";
import { mountLayersPanel, type LayersPanel } from "./layersPanel.js";
import { mountInspector, type Inspector } from "./inspector.js";
import { mountAssetsPanel, type AssetsPanel } from "./assetsPanel.js";
import { mountZoomControl, type ZoomController } from "./zoom.js";
import { createToolsController, mountToolButtons, type ToolButtons } from "./tools.js";
import { mountKeyboardShortcuts, type KeyboardShortcuts } from "./keyboardShortcuts.js";
import { mountNewProjectDialog, type NewProjectDialog } from "./newProjectDialog.js";
import { mountExportDialog, type ExportDialog } from "./exportDialog.js";

const DUPLICATE_OFFSET = 20;

export interface AppElements {
  /** Contenedor con scroll donde vive `canvasContainer` — se mide para
   * "Ajustar a pantalla" y escucha la rueda del mouse con Ctrl/Cmd. */
  canvasViewport: HTMLElement;
  /** Punto de montaje del Stage de Konva; también el elemento al que se le
   * aplica el `transform: scale(...)` del zoom (ver zoom.ts). */
  canvasContainer: HTMLDivElement;
  layersContainer: HTMLElement;
  assetsContainer: HTMLElement;
  tabLayersButton: HTMLButtonElement;
  tabAssetsButton: HTMLButtonElement;
  inspectorContainer: HTMLElement;
  toolsContainer: HTMLElement;
  zoomContainer: HTMLElement;
  newProjectDialogContainer: HTMLElement;
  exportDialogContainer: HTMLElement;
  newButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  openButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  duplicateButton: HTMLButtonElement;
  deleteButton: HTMLButtonElement;
  groupButton: HTMLButtonElement;
  ungroupButton: HTMLButtonElement;
  statusElement: HTMLElement;
}

export interface AppDependencies {
  elements: AppElements;
  /** Inyectable para tests; por defecto `localStorage` real. */
  storage?: Storage;
  /** Inyectable para tests (ej. `createMemoryAssetStore()` de
   * `@impulso/asset-library`, sin depender de IndexedDB); por defecto
   * `createIndexedDbAssetStore()`. */
  binaryStore?: AssetBinaryStore;
  /** Dónde escuchan los atajos de teclado (ver `keyboardShortcuts.ts`); por
   * defecto `window`. Inyectable en tests para que instancias de `App`
   * montadas en tests distintos no compartan el mismo listener global. */
  keyboardTarget?: EventTarget;
  initialProject?: Project;
  now?: () => string;
  generateId?: () => string;
}

export interface App {
  getRuntime(): CanvasRuntime;
  destroy(): void;
}

/** Mueve `id` `delta` posiciones dentro de `ids` (positivo = hacia el
 * final del array = "adelante" en el orden visual, ver `layersPanel.ts`:
 * el orden visual es el array subyacente invertido). Función pura para
 * poder testear "adelantar/atrasar una capa" sin un Engine real. */
export function moveIndexBy(ids: readonly ObjectId[], id: ObjectId, delta: number): ObjectId[] {
  const index = ids.indexOf(id);
  if (index === -1) return [...ids];
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= ids.length) return [...ids];
  const result = [...ids];
  const [removed] = result.splice(index, 1);
  result.splice(targetIndex, 0, removed!);
  return result;
}

/**
 * Orquestador central de la Sticker Creation Experience: cablea el
 * `CanvasRuntime` (bootstrap.ts) con el panel de capas, el Inspector, el
 * zoom, las herramientas Texto/Imagen, los atajos de teclado y el diálogo
 * de proyecto nuevo — sin que ninguno de ellos conozca a los demás
 * directamente. Reemplaza a `toolbar.ts` (Milestone 1): mismo patrón de
 * "Nuevo"/"Abrir" (destruir el runtime completo y montar uno nuevo, ver
 * ADR-0009), extendido con precarga de imágenes embebidas antes de volver
 * a montar. Ver ADR-0010.
 */
export function mountApp(deps: AppDependencies): App {
  const { elements, storage } = deps;
  const now = deps.now ?? (() => new Date().toISOString());
  const generateId = deps.generateId ?? (() => crypto.randomUUID());
  const binaryStore = deps.binaryStore ?? createIndexedDbAssetStore();
  const resolvedCache: ResolvedAssetCache = createResolvedAssetCache();

  let runtime: CanvasRuntime = mountCanvasRuntime(elements.canvasContainer, deps.initialProject ?? createDemoProject(), {
    resolveAssetSource: resolvedCache.resolve,
  });
  let toolsController = createToolsController({ engine: runtime.engine, binaryStore, resolvedCache, now, generateId });
  let layersPanel: LayersPanel = mountLayersPanel(elements.layersContainer, runtime.engine);
  let inspector: Inspector = mountInspector(elements.inspectorContainer, runtime.engine);
  let assetsPanel: AssetsPanel = mountAssetsPanel(elements.assetsContainer, runtime.engine, toolsController, resolvedCache);

  function setStatus(message: string): void {
    elements.statusElement.textContent = message;
  }

  function topLevelIds(): ObjectId[] {
    return (runtime.engine.getProject().document.pages[0]?.layers[0]?.objects ?? []).map((object) => object.id);
  }

  function selectedTopLevelIds(): ObjectId[] {
    const topLevel = new Set(topLevelIds());
    return runtime.engine.getSelection().filter((id) => topLevel.has(id));
  }

  function updateUndoRedoButtons(): void {
    elements.undoButton.disabled = !runtime.engine.canUndo();
    elements.redoButton.disabled = !runtime.engine.canRedo();
  }

  function updateSelectionDependentButtons(): void {
    const selection = runtime.engine.getSelection();
    const selectedTopLevel = selectedTopLevelIds();
    elements.deleteButton.disabled = selection.length === 0;
    elements.duplicateButton.disabled = selectedTopLevel.length === 0;
    elements.groupButton.disabled = selectedTopLevel.length < 2;
    const single =
      selection.length === 1 ? findObjectInDocument(runtime.engine.getProject().document, selection[0]!) : undefined;
    elements.ungroupButton.disabled = single?.type !== "group";
  }

  function subscribeToEngine(): () => void {
    updateUndoRedoButtons();
    updateSelectionDependentButtons();
    return runtime.engine.subscribe((event) => {
      if (event.type === "historyChanged") updateUndoRedoButtons();
      if (event.type === "selectionChanged" || event.type === "projectChanged") updateSelectionDependentButtons();
    });
  }

  let unsubscribeEngine = subscribeToEngine();

  /** Reemplaza el runtime completo (Nuevo/Abrir, ver ADR-0009), precargando
   * antes cada Asset de type "image" del documento (`assetResolution.ts`)
   * para que el primer render ya las resuelva — sin esto, un Project con
   * imágenes mostraría un placeholder hasta el siguiente evento del Engine. */
  async function remount(project: Project): Promise<void> {
    unsubscribeEngine();
    layersPanel.destroy();
    inspector.destroy();
    assetsPanel.destroy();
    runtime.renderer.destroy();
    resolvedCache.clear();
    await preloadDocumentAssets(project.document, binaryStore, resolvedCache);
    runtime = mountCanvasRuntime(elements.canvasContainer, project, { resolveAssetSource: resolvedCache.resolve });
    toolsController = createToolsController({ engine: runtime.engine, binaryStore, resolvedCache, now, generateId });
    layersPanel = mountLayersPanel(elements.layersContainer, runtime.engine);
    inspector = mountInspector(elements.inspectorContainer, runtime.engine);
    assetsPanel = mountAssetsPanel(elements.assetsContainer, runtime.engine, toolsController, resolvedCache);
    unsubscribeEngine = subscribeToEngine();
    zoomController.setZoom(1);
  }

  function doSave(): void {
    saveProjectLocally(runtime.engine.getProject(), storage);
    setStatus("Documento guardado localmente.");
  }

  async function doOpen(): Promise<void> {
    let loaded: Project | null;
    try {
      loaded = loadProjectLocally(storage);
    } catch (error) {
      setStatus(`No se pudo abrir el documento guardado: ${(error as Error).message}`);
      return;
    }
    if (!loaded) {
      setStatus("No hay ningún documento guardado todavía.");
      return;
    }
    const { project: migrated, migratedCount } = await migrateLegacyEmbeddedImages(loaded, binaryStore, { now: now() });
    await remount(migrated);
    if (migratedCount > 0) {
      saveProjectLocally(migrated, storage);
      setStatus(`Documento cargado (se migraron ${migratedCount} imagen(es) a la Biblioteca de Assets).`);
    } else {
      setStatus("Documento cargado.");
    }
  }

  function deleteSelected(): void {
    for (const id of runtime.engine.getSelection()) {
      runtime.engine.dispatch({ type: "removeObject", objectId: id });
    }
  }

  function duplicateSelected(): void {
    const ids = selectedTopLevelIds();
    if (ids.length === 0) return;
    const page = runtime.engine.getProject().document.pages[0];
    const layer = page?.layers[0];
    if (!page || !layer) return;

    const timestamp = now();
    const newIds: ObjectId[] = [];
    for (const id of ids) {
      const object = findObjectInDocument(runtime.engine.getProject().document, id);
      if (!object) continue;
      const clone = cloneSceneObjectWithNewIds(object, () => ObjectIdSchema.parse(`object_${generateId()}`), timestamp, {
        offset: { x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET },
      });
      runtime.engine.dispatch({ type: "addObject", pageId: page.id, layerId: layer.id, object: clone });
      newIds.push(clone.id);
    }
    if (newIds.length > 0) runtime.engine.dispatch({ type: "setSelection", objectIds: newIds });
  }

  function groupSelected(): void {
    const ids = selectedTopLevelIds();
    if (ids.length < 2) return;
    const timestamp = now();
    const groupId = ObjectIdSchema.parse(`object_${generateId()}`);
    const result = runtime.engine.dispatch({
      type: "groupObjects",
      objectIds: ids,
      group: {
        id: groupId,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
        metadata: { tags: [], visible: true, locked: false, createdAt: timestamp, updatedAt: timestamp },
        pluginData: {},
        customProperties: {},
      },
    });
    if (result.ok) runtime.engine.dispatch({ type: "setSelection", objectIds: [groupId] });
  }

  function ungroupSelected(): void {
    const selection = runtime.engine.getSelection();
    if (selection.length !== 1) return;
    const object = findObjectInDocument(runtime.engine.getProject().document, selection[0]!);
    if (!object || object.type !== "group") return;
    runtime.engine.dispatch({ type: "ungroupObject", objectId: object.id });
  }

  function selectAll(): void {
    runtime.engine.dispatch({ type: "setSelection", objectIds: topLevelIds() });
  }

  function escape(): void {
    runtime.engine.dispatch({ type: "clearSelection" });
  }

  function nudge(dx: number, dy: number): void {
    for (const id of runtime.engine.getSelection()) {
      const object = findObjectInDocument(runtime.engine.getProject().document, id);
      if (!object) continue;
      runtime.engine.dispatch({
        type: "updateObjectTransform",
        objectId: id,
        transform: { x: object.transform.x + dx, y: object.transform.y + dy },
      });
    }
  }

  function reorderSelected(delta: number): void {
    const selection = selectedTopLevelIds();
    if (selection.length !== 1) return;
    const page = runtime.engine.getProject().document.pages[0];
    const layer = page?.layers[0];
    if (!page || !layer) return;
    const ids = layer.objects.map((object) => object.id);
    runtime.engine.dispatch({
      type: "reorderObjects",
      pageId: page.id,
      layerId: layer.id,
      objectIds: moveIndexBy(ids, selection[0]!, delta),
    });
  }

  const toolButtons: ToolButtons = mountToolButtons(elements.toolsContainer, {
    insertText: () => toolsController.insertText(),
    uploadAsset: (file) => toolsController.uploadAsset(file),
    insertImage: (file) => toolsController.insertImage(file),
    insertImageFromAsset: (assetId) => toolsController.insertImageFromAsset(assetId),
  });

  function showLayersTab(): void {
    elements.layersContainer.style.display = "";
    elements.assetsContainer.style.display = "none";
    elements.tabLayersButton.classList.add("active");
    elements.tabAssetsButton.classList.remove("active");
  }
  function showAssetsTab(): void {
    elements.layersContainer.style.display = "none";
    elements.assetsContainer.style.display = "";
    elements.tabLayersButton.classList.remove("active");
    elements.tabAssetsButton.classList.add("active");
  }
  elements.tabLayersButton.addEventListener("click", showLayersTab);
  elements.tabAssetsButton.addEventListener("click", showAssetsTab);
  showLayersTab();

  const zoomController: ZoomController = mountZoomControl(elements.zoomContainer, {
    viewport: elements.canvasViewport,
    target: elements.canvasContainer,
    getContentSize: () => {
      const page = runtime.engine.getProject().document.pages[0];
      return { width: page?.size.width ?? 0, height: page?.size.height ?? 0 };
    },
  });

  const newProjectDialog: NewProjectDialog = mountNewProjectDialog(elements.newProjectDialogContainer, {
    now,
    generateId,
    onCreate: (project) => {
      void remount(project).then(() => setStatus("Documento nuevo creado."));
    },
  });

  const exportDialog: ExportDialog = mountExportDialog(elements.exportDialogContainer, {
    getProject: () => runtime.engine.getProject(),
    resolver: { resolve: (assetId) => binaryStore.get(assetId) },
  });

  elements.newButton.addEventListener("click", () => newProjectDialog.open());
  elements.exportButton.addEventListener("click", () => exportDialog.open());
  elements.undoButton.addEventListener("click", () => {
    const result = runtime.engine.undo();
    setStatus(result.ok ? "Deshecho." : "No hay nada para deshacer.");
  });
  elements.redoButton.addEventListener("click", () => {
    const result = runtime.engine.redo();
    setStatus(result.ok ? "Rehecho." : "No hay nada para rehacer.");
  });
  elements.saveButton.addEventListener("click", doSave);
  elements.openButton.addEventListener("click", () => void doOpen());
  elements.duplicateButton.addEventListener("click", duplicateSelected);
  elements.deleteButton.addEventListener("click", deleteSelected);
  elements.groupButton.addEventListener("click", groupSelected);
  elements.ungroupButton.addEventListener("click", ungroupSelected);

  const keyboardShortcuts: KeyboardShortcuts = mountKeyboardShortcuts({
    // No hay un modo de herramienta persistente que "activar" (Texto/Imagen
    // insertan directamente, ver tools.ts) — "V" existe por convención con
    // otras herramientas de diseño pero no tiene efecto propio en esta
    // épica. Ver ADR-0010.
    selectTool: () => {},
    textTool: () => toolsController.insertText(),
    imageTool: () => toolButtons.openFilePicker(),
    deleteSelected,
    duplicateSelected,
    groupSelected,
    ungroupSelected,
    undo: () => {
      const result = runtime.engine.undo();
      setStatus(result.ok ? "Deshecho." : "No hay nada para deshacer.");
    },
    redo: () => {
      const result = runtime.engine.redo();
      setStatus(result.ok ? "Rehecho." : "No hay nada para rehacer.");
    },
    save: doSave,
    open: () => void doOpen(),
    selectAll,
    escape,
    nudge,
    bringForward: () => reorderSelected(1),
    sendBackward: () => reorderSelected(-1),
  }, { target: deps.keyboardTarget });

  return {
    getRuntime: () => runtime,
    destroy: () => {
      unsubscribeEngine();
      keyboardShortcuts.destroy();
      zoomController.destroy();
      toolButtons.destroy();
      newProjectDialog.destroy();
      exportDialog.destroy();
      layersPanel.destroy();
      inspector.destroy();
      assetsPanel.destroy();
      runtime.renderer.destroy();
    },
  };
}
