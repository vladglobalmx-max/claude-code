import { ObjectIdSchema, type ObjectId, type Project } from "@impulso/document-schema";
import { findObjectInDocument, cloneSceneObjectWithNewIds } from "@impulso/engine";
import { createIndexedDbAssetStore, type AssetBinaryStore } from "@impulso/asset-library";
import { createIndexedDbTemplateStore, type TemplateStore } from "@impulso/template-library";
import {
  createIndexedDbProjectStore,
  createProjectSaveCoordinator,
  type ProjectStore,
  type ProjectSaveCoordinator,
  type SaveState,
} from "@impulso/project-library";
import { exportProject, type ExportAssetResolver } from "@impulso/export-engine";
import type { CanvasRuntime } from "./bootstrap.js";
import { mountCanvasRuntime } from "./bootstrap.js";
import { createDemoProject } from "./demoProject.js";
import { mountUnsavedChangesDialog, type UnsavedChangesDialog } from "./unsavedChangesDialog.js";
import { createResolvedAssetCache, preloadDocumentAssets, type ResolvedAssetCache } from "./assetResolution.js";
import { createLazyBuiltInTemplateSeeder } from "./builtInTemplates.js";
import { mountLayersPanel, type LayersPanel } from "./layersPanel.js";
import { mountInspector, type Inspector } from "./inspector.js";
import { createAlignmentController, mountAlignmentPanel, type AlignmentPanel } from "./alignment.js";
import { mountAssetsPanel, type AssetsPanel } from "./assetsPanel.js";
import { mountZoomControl, type ZoomController } from "./zoom.js";
import { createToolsController, mountToolButtons, type ToolButtons } from "./tools.js";
import { mountKeyboardShortcuts, type KeyboardShortcuts } from "./keyboardShortcuts.js";
import { mountNewProjectDialog, type NewProjectDialog } from "./newProjectDialog.js";
import { mountExportDialog, type ExportDialog } from "./exportDialog.js";
import { mountProductionExportDialog, type ProductionExportDialog } from "./productionExportDialog.js";
import { mountSaveAsTemplateDialog, type SaveAsTemplateDialog } from "./saveAsTemplateDialog.js";
import {
  mountGridOverlay,
  mountRulers,
  mountPointerIndicator,
  mountGridSnapControls,
  toggleGridVisible,
  type GridOverlay,
  type Rulers,
  type PointerIndicator,
  type GridSnapControls,
} from "./assistedPlacement.js";

const DUPLICATE_OFFSET = 20;
/** Qué módulo de Impulso Platform es este — usado para filtrar Templates
 * (ver ADR-0013) y proyectos de la Workspace (ver ADR-0014). Exportado
 * para que `shell.ts`/`workspace.ts` lo reutilicen sin duplicarlo. */
export const MODULE_ID = "sticker-builder";

/** Genera el thumbnail de un Project llamando a `exportProject`
 * (`@impulso/export-engine`) — Templates no depende de Export Engine (ver
 * ADR-0013); esta función es el único puente entre ambos, y vive en la
 * app, no en ninguno de los dos paquetes. Exportada para que
 * `workspace.ts` construya su propio sembrador de built-in sin duplicar
 * este puente. */
export function createThumbnailGenerator(resolver: ExportAssetResolver): (project: Project) => Promise<Blob> {
  return async (project) => {
    const result = await exportProject(project, resolver, { format: "png", scale: 1, background: { type: "solid", color: "#ffffff" } });
    return result.blob;
  };
}

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
  alignmentContainer: HTMLElement;
  toolsContainer: HTMLElement;
  /** Epic 7 / Fase 7.3 — Assisted Placement: controles de Grid/Snap,
   * ubicados junto al zoom (ver `assistedPlacement.ts`, "UX y
   * descubribilidad"). */
  gridSnapContainer: HTMLElement;
  zoomContainer: HTMLElement;
  rulerHorizontal: HTMLCanvasElement;
  rulerVertical: HTMLCanvasElement;
  pointerIndicator: HTMLElement;
  canvasArea: HTMLElement;
  newProjectDialogContainer: HTMLElement;
  exportDialogContainer: HTMLElement;
  /** Epic 9 / Fase 9.4 — flujo de 7 pasos de "Exportar para impresión"
   * (imposición), entrada de editor DISTINTA del "Exportar" rápido de
   * arriba (sección 23). */
  productionExportDialogContainer: HTMLElement;
  saveAsTemplateDialogContainer: HTMLElement;
  newButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  /** Reemplaza al antiguo "Abrir" (slot único legado, ver ADR-0009) — navega
   * de vuelta a la Workspace ("Mis proyectos", ver ADR-0014), desde donde se
   * elige qué proyecto abrir. */
  backToWorkspaceButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  productionExportButton: HTMLButtonElement;
  saveAsTemplateButton: HTMLButtonElement;
  duplicateButton: HTMLButtonElement;
  deleteButton: HTMLButtonElement;
  groupButton: HTMLButtonElement;
  ungroupButton: HTMLButtonElement;
  statusElement: HTMLElement;
  /** Epic 8 — Autosave, Recovery & Project Safety: indicador persistente de
   * Guardado/Cambios sin guardar/Guardando…/Error al guardar/Recuperado,
   * ubicado junto al botón Guardar (ver `saveCoordinator.ts` y sección 6
   * del enunciado de producto). Distinto de `statusElement` (mensajes
   * transitorios como "Deshecho."). */
  saveStatusElement: HTMLElement;
  /** Región oculta visualmente (`aria-live="polite"`) que solo se actualiza
   * en transiciones que vale la pena anunciar (error/recuperado/guardado
   * confirmado) — nunca en cada "Guardando…"/"Cambios sin guardar", que
   * ocurren con demasiada frecuencia (sección 19). */
  saveStatusAnnouncer: HTMLElement;
  unsavedChangesDialogContainer: HTMLElement;
}

export interface AppDependencies {
  elements: AppElements;
  /** Inyectable para tests (ej. `createMemoryAssetStore()` de
   * `@impulso/asset-library`, sin depender de IndexedDB); por defecto
   * `createIndexedDbAssetStore()`. */
  binaryStore?: AssetBinaryStore;
  /** Inyectable para tests (ej. `createMemoryTemplateStore()` de
   * `@impulso/template-library`, sin depender de IndexedDB); por defecto
   * `createIndexedDbTemplateStore()`. */
  templateStore?: TemplateStore;
  /** Inyectable para tests (ej. `createMemoryProjectStore()` de
   * `@impulso/project-library`, sin depender de IndexedDB); por defecto
   * `createIndexedDbProjectStore()`. "Guardar" persiste aquí (ver ADR-0014) —
   * ya no en el slot único legado de `localStorage`. */
  projectStore?: ProjectStore;
  /** Genera el thumbnail que "Guardar" y "Guardar como plantilla" adjuntan
   * al proyecto — inyectable para evitar la rasterización real de Konva en
   * tests (jsdom no implementa `HTMLCanvasElement.toBlob`); por defecto
   * `createThumbnailGenerator(...)` sobre `@impulso/export-engine`. */
  generateThumbnail?: (project: Project) => Promise<Blob>;
  /** Se llama al hacer clic en "Mis proyectos" o presionar Ctrl/Cmd+O — la
   * shell decide qué hacer (destruir esta instancia y volver a mostrar la
   * Workspace, ver `shell.ts`). Sin valor por defecto: en un `mountApp()`
   * de test que no lo inyecta, simplemente no navega a ningún lado. */
  onBackToWorkspace?: () => void;
  /** Dónde escuchan los atajos de teclado (ver `keyboardShortcuts.ts`); por
   * defecto `window`. Inyectable en tests para que instancias de `App`
   * montadas en tests distintos no compartan el mismo listener global. */
  keyboardTarget?: EventTarget;
  initialProject?: Project;
  now?: () => string;
  generateId?: () => string;
  /** `true` si `initialProject` todavía no existe en `projectStore` (Project
   * nuevo, o creado desde un Template — ver Epic 8, sección 3): hace que el
   * `ProjectSaveCoordinator` arranque en `"dirty"` en vez de `"clean"`, para
   * que el primer autosave lo persista sin esperar un cambio adicional del
   * usuario. Por defecto `false` (Project existente ya persistido, ver
   * `workspace.ts`). */
  isNewProject?: boolean;
}

export interface App {
  getRuntime(): CanvasRuntime;
  /**
   * Epic 8, sección 8 ("Salir del editor"): intenta dejar el Project actual
   * en un estado seguro para abandonarlo — flushea cualquier guardado
   * pendiente y, si falla, ofrece Reintentar/Permanecer/Salir sin guardar
   * mediante `unsavedChangesDialog` (nunca `window.confirm`). Devuelve
   * `true` si es seguro proceder a destruir/reemplazar esta instancia,
   * `false` si el usuario eligió permanecer en el editor.
   */
  requestClose(): Promise<boolean>;
  /**
   * Epic 8, sección 9 (`beforeunload` como última línea de defensa): `true`
   * mientras el `ProjectSaveCoordinator` no esté en `"clean"` — cualquier
   * otro estado (`"dirty"`, `"saving"`, `"error"`, `"recovered"`) significa
   * que la revisión más reciente todavía no terminó de persistirse con
   * éxito. `shell.ts`/`main.ts` la usan para decidir si de verdad hace
   * falta advertir al cerrar/recargar la pestaña — nunca si ya está
   * `"clean"` (sección 9: no advertir si no hay cambios reales).
   */
  hasUnsavedChanges(): boolean;
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
 * Orquestador del editor (la pantalla que se muestra DESPUÉS de elegir un
 * proyecto en la Workspace, ver `shell.ts`/ADR-0014): cablea el
 * `CanvasRuntime` (bootstrap.ts) con el panel de capas, el Inspector, el
 * zoom, las herramientas Texto/Imagen, los atajos de teclado y el diálogo
 * de proyecto nuevo — sin que ninguno de ellos conozca a los demás
 * directamente. "Nuevo" (dentro del editor) sigue destruyendo el runtime y
 * montando uno nuevo con `remount` (mismo patrón desde ADR-0009); "Mis
 * proyectos" no remonta nada aquí — delega en `deps.onBackToWorkspace`, que
 * la shell resuelve destruyendo esta instancia completa (`App.destroy()`)
 * y volviendo a mostrar la Workspace. Ver ADR-0010 (Sticker Creation
 * Experience) y ADR-0014 (Project Library / Workspace).
 */
export function mountApp(deps: AppDependencies): App {
  const { elements } = deps;
  const now = deps.now ?? (() => new Date().toISOString());
  const generateId = deps.generateId ?? (() => crypto.randomUUID());
  const binaryStore = deps.binaryStore ?? createIndexedDbAssetStore();
  const templateStore = deps.templateStore ?? createIndexedDbTemplateStore();
  const projectStore = deps.projectStore ?? createIndexedDbProjectStore();
  const generateThumbnail = deps.generateThumbnail ?? createThumbnailGenerator({ resolve: (assetId) => binaryStore.get(assetId) });
  const resolvedCache: ResolvedAssetCache = createResolvedAssetCache();

  // Sembrado perezoso (recién al primer "Nuevo" real, ver el listener de
  // `newButton` más abajo) — nunca al montar. Igual que `binaryStore`, el
  // store por defecto es real IndexedDB: tocarlo incondicionalmente en
  // cada `mountApp()` rompería cualquier test que no inyecte un
  // `templateStore` en memoria (jsdom no implementa `indexedDB` en
  // absoluto). Ver ADR-0013. `workspace.ts` tiene su propia instancia del
  // mismo seeder para su propio botón "Nuevo proyecto" (ver ADR-0014) —
  // inofensivo: `seedBuiltInTemplates` es idempotente por id de catálogo.
  const builtInTemplatesSeeder = createLazyBuiltInTemplateSeeder(templateStore, {
    now,
    generateThumbnail: createThumbnailGenerator({ resolve: () => Promise.resolve(undefined) }),
  });

  // Referencia adelantada: `zoomController` se construye más abajo (necesita
  // `runtime.engine` para "Ajustar a pantalla"), pero el runtime necesita un
  // getter de zoom DESDE su montaje (Epic 7 / Fase 7.3 — normaliza la
  // tolerancia de snapping). El closure solo se invoca durante un drag, muy
  // posterior al montaje, así que para entonces `zoomController` ya existe.
  let zoomController: ZoomController;

  let runtime: CanvasRuntime = mountCanvasRuntime(elements.canvasContainer, deps.initialProject ?? createDemoProject(), {
    resolveAssetSource: resolvedCache.resolve,
    getZoom: () => zoomController.getZoom(),
  });
  let toolsController = createToolsController({ engine: runtime.engine, binaryStore, resolvedCache, now, generateId });
  let layersPanel: LayersPanel = mountLayersPanel(elements.layersContainer, runtime.engine);
  let inspector: Inspector = mountInspector(elements.inspectorContainer, runtime.engine);
  let assetsPanel: AssetsPanel = mountAssetsPanel(elements.assetsContainer, runtime.engine, toolsController, resolvedCache);
  let alignmentController = createAlignmentController(runtime.engine, runtime.renderer);
  let alignmentPanel: AlignmentPanel = mountAlignmentPanel(elements.alignmentContainer, runtime.engine, alignmentController);

  // Epic 7 / Fase 7.3 — Assisted Placement: Grid visual, Rulers, indicador
  // de puntero y controles de Grid/Snap. Todos leen el zoom vía el mismo
  // getter adelantado (`zoomController` ya existe para cuando el usuario
  // interactúa; no así durante el primer render síncrono de cada uno, que
  // solo necesita el valor INICIAL — 100%, antes de que exista ningún
  // control real — de ahí el `?? 1` de respaldo).
  const getZoom = () => zoomController?.getZoom() ?? 1;
  let gridOverlay: GridOverlay = mountGridOverlay(elements.canvasContainer, runtime.engine, getZoom);
  let rulers: Rulers = mountRulers(
    elements.rulerHorizontal,
    elements.rulerVertical,
    elements.canvasViewport,
    elements.canvasContainer,
    runtime.engine,
    getZoom,
  );
  let pointerIndicator: PointerIndicator = mountPointerIndicator(
    elements.pointerIndicator,
    elements.canvasViewport,
    elements.canvasContainer,
    runtime.engine,
    getZoom,
  );
  let gridSnapControls: GridSnapControls = mountGridSnapControls(elements.gridSnapContainer, runtime.engine);

  /**
   * Epic 8 — Autosave, Recovery & Project Safety. Escribe el recovery ANTES
   * de intentar el guardado principal (para que un fallo a mitad del
   * guardado principal deje igual un recovery reciente) y lo limpia
   * DESPUÉS de un guardado principal exitoso — nunca al revés. Un fallo
   * escribiendo/limpiando el recovery o generando el thumbnail se registra
   * pero nunca hace fallar el guardado en sí — lo único indispensable es
   * `projectStore.save`, la única llamada de esta función cuyo error se
   * propaga al `ProjectSaveCoordinator` (ver sección 15: un fallo del
   * thumbnail no debe marcar todo el Project como sin guardar).
   */
  async function persistProject(project: Project): Promise<void> {
    try {
      await projectStore.saveRecovery(project, now());
    } catch (error) {
      console.error("[Epic 8] No se pudo escribir el recovery:", error);
    }
    let thumbnail: Blob | undefined;
    try {
      thumbnail = await generateThumbnail(project);
    } catch (error) {
      console.error("No se pudo generar la miniatura al guardar:", error);
    }
    await projectStore.save(project, thumbnail);
    try {
      await projectStore.clearRecovery(project.id);
    } catch (error) {
      console.error("[Epic 8] No se pudo limpiar el recovery:", error);
    }
  }

  let saveCoordinator: ProjectSaveCoordinator = createProjectSaveCoordinator({
    persist: persistProject,
    getProject: () => runtime.engine.getProject(),
    initialStatus: deps.isNewProject ? "dirty" : "clean",
    // Camino rápido e independiente de recovery (Epic 8, sección 10): NO
    // pasa por thumbnail ni limpia nada — solo `persistProject` (el
    // guardado principal) tiene permiso para limpiar el recovery.
    persistRecovery: (project) => projectStore.saveRecovery(project, now()),
  });

  const unsavedChangesDialog: UnsavedChangesDialog = mountUnsavedChangesDialog(elements.unsavedChangesDialogContainer);

  const SAVE_STATUS_LABELS: Record<SaveState["status"], string> = {
    clean: "Guardado",
    dirty: "Cambios sin guardar",
    saving: "Guardando…",
    error: "Error al guardar",
    recovered: "Recuperado",
  };

  let previousSaveStatus: SaveState["status"] | undefined;

  /**
   * Refleja el estado del `ProjectSaveCoordinator` en la UI (sección 6/19):
   * el indicador visual se actualiza en CADA transición (para que quien
   * mira la pantalla siempre vea el estado real, nunca "Guardado" antes de
   * tiempo), pero el anuncio a lectores de pantalla (`saveStatusAnnouncer`,
   * oculto visualmente) solo se actualiza al entrar a "error"/"recovered",
   * o al llegar a "clean" tras haber estado sucio — nunca por
   * "dirty"/"saving", que ocurren con demasiada frecuencia como para
   * anunciarlos sin generar ruido.
   */
  function renderSaveState(state: SaveState): void {
    elements.saveStatusElement.textContent = "";
    elements.saveStatusElement.className = `save-status save-status-${state.status}`;
    const label = document.createElement("span");
    label.className = "save-status-label";
    label.textContent = SAVE_STATUS_LABELS[state.status];
    elements.saveStatusElement.appendChild(label);

    if (state.status === "error") {
      const retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.className = "save-status-retry";
      retryButton.textContent = "Reintentar";
      retryButton.addEventListener("click", () => void saveCoordinator.flush());
      elements.saveStatusElement.appendChild(retryButton);
    }

    const shouldAnnounce =
      state.status === "error" ||
      state.status === "recovered" ||
      (state.status === "clean" && previousSaveStatus !== undefined && previousSaveStatus !== "clean");
    if (shouldAnnounce) {
      elements.saveStatusAnnouncer.textContent =
        state.status === "error" ? (state.message ?? SAVE_STATUS_LABELS.error) : SAVE_STATUS_LABELS[state.status];
    }
    previousSaveStatus = state.status;
  }

  let unsubscribeSaveCoordinator = saveCoordinator.subscribe(renderSaveState);
  renderSaveState(saveCoordinator.getState());

  /**
   * Epic 8, sección 8 ("Salir del editor"): intenta dejar el Project actual
   * en un estado seguro para abandonarlo. Si `flush()` falla, ofrece
   * Reintentar/Permanecer/Salir sin guardar mediante un diálogo propio
   * (nunca `window.confirm`) — nunca abandona en silencio. Si no había
   * cambios pendientes, `flush()` resuelve `{ ok: true }` de inmediato sin
   * mostrar ningún diálogo (no hay advertencia innecesaria).
   */
  async function safeToProceed(): Promise<boolean> {
    for (;;) {
      const outcome = await saveCoordinator.flush();
      if (outcome.ok) return true;
      const message = saveCoordinator.getState().message ?? "No se pudieron guardar los cambios.";
      const choice = await unsavedChangesDialog.open(message);
      if (choice === "retry") continue;
      if (choice === "discard") return true;
      return false;
    }
  }

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
      if (event.type === "projectChanged") saveCoordinator.notifyChange();
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
    alignmentPanel.destroy();
    gridOverlay.destroy();
    rulers.destroy();
    pointerIndicator.destroy();
    gridSnapControls.destroy();
    runtime.renderer.destroy();
    resolvedCache.clear();
    await preloadDocumentAssets(project.document, binaryStore, resolvedCache);
    runtime = mountCanvasRuntime(elements.canvasContainer, project, {
      resolveAssetSource: resolvedCache.resolve,
      getZoom,
    });
    toolsController = createToolsController({ engine: runtime.engine, binaryStore, resolvedCache, now, generateId });
    layersPanel = mountLayersPanel(elements.layersContainer, runtime.engine);
    inspector = mountInspector(elements.inspectorContainer, runtime.engine);
    assetsPanel = mountAssetsPanel(elements.assetsContainer, runtime.engine, toolsController, resolvedCache);
    alignmentController = createAlignmentController(runtime.engine, runtime.renderer);
    alignmentPanel = mountAlignmentPanel(elements.alignmentContainer, runtime.engine, alignmentController);
    gridOverlay = mountGridOverlay(elements.canvasContainer, runtime.engine, getZoom);
    rulers = mountRulers(
      elements.rulerHorizontal,
      elements.rulerVertical,
      elements.canvasViewport,
      elements.canvasContainer,
      runtime.engine,
      getZoom,
    );
    pointerIndicator = mountPointerIndicator(
      elements.pointerIndicator,
      elements.canvasViewport,
      elements.canvasContainer,
      runtime.engine,
      getZoom,
    );
    gridSnapControls = mountGridSnapControls(elements.gridSnapContainer, runtime.engine);
    // El `Project` que llega aquí SIEMPRE es distinto/nuevo (único call site:
    // el diálogo "Nuevo" del propio editor, ver `newButton` más abajo) — el
    // coordinator anterior pertenece al Project que se está reemplazando, así
    // que se destruye y se reconstruye desde cero en "dirty" (Epic 8, sección
    // 3: un Project nuevo cuenta como sucio desde su primer instante).
    unsubscribeSaveCoordinator();
    saveCoordinator.destroy();
    saveCoordinator = createProjectSaveCoordinator({
      persist: persistProject,
      getProject: () => runtime.engine.getProject(),
      initialStatus: "dirty",
      persistRecovery: (project) => projectStore.saveRecovery(project, now()),
    });
    unsubscribeSaveCoordinator = saveCoordinator.subscribe(renderSaveState);
    renderSaveState(saveCoordinator.getState());
    unsubscribeEngine = subscribeToEngine();
    zoomController.setZoom(1);
  }

  /** Guardado manual (Epic 8, sección 7): delega enteramente en el
   * `ProjectSaveCoordinator` — cancela/absorbe cualquier debounce
   * pendiente, espera cualquier guardado ya en curso, y persiste la
   * revisión más reciente. Mantiene el mensaje transitorio existente en
   * `statusElement` (el indicador persistente de `saveStatusElement` ya
   * refleja el resultado en detalle). */
  async function doSave(): Promise<void> {
    const outcome = await saveCoordinator.flush();
    setStatus(outcome.ok ? "Documento guardado." : (saveCoordinator.getState().message ?? "No se pudo guardar el proyecto."));
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

  /**
   * Epic 7 / Fase 7.4 (Professional Multi Selection): Escape cancela un
   * gesto de manipulación grupal en curso (mover/redimensionar/rotar 2+
   * objects) ANTES de limpiar la selección — solo si no había ninguno
   * activo, procede a `clearSelection` como hasta ahora.
   */
  function escape(): void {
    if (runtime.renderer.cancelActiveManipulation()) return;
    runtime.engine.dispatch({ type: "clearSelection" });
  }

  /**
   * Un solo `dispatchBatch` para toda la selección (Epic 7 / Fase 7.4):
   * antes de esta fase, cada object nudgeado generaba su propia entrada de
   * historial — un solo Ctrl/Cmd+Z deshacía solo el ÚLTIMO object movido,
   * no el nudge completo. Reutiliza el mismo primitivo que ya usa
   * Alignment/el resto de operaciones grupales, sin ningún comando nuevo.
   */
  function nudge(dx: number, dy: number): void {
    const commands = runtime.engine
      .getSelection()
      .map((id) => findObjectInDocument(runtime.engine.getProject().document, id))
      .filter((object): object is NonNullable<typeof object> => object !== undefined)
      .map((object) => ({
        type: "updateObjectTransform" as const,
        objectId: object.id,
        transform: { x: object.transform.x + dx, y: object.transform.y + dy },
      }));
    runtime.engine.dispatchBatch(commands, { label: "Mover con teclado" });
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

  zoomController = mountZoomControl(elements.zoomContainer, {
    viewport: elements.canvasViewport,
    target: elements.canvasContainer,
    getContentSize: () => {
      const page = runtime.engine.getProject().document.pages[0];
      return { width: page?.size.width ?? 0, height: page?.size.height ?? 0 };
    },
    onChange: (zoom) => {
      gridOverlay.onZoomChange(zoom);
      rulers.refresh();
    },
  });

  // Rulers reflejan el scroll nativo del viewport (no hay panning propio,
  // ver ADR-0010) y el tamaño real del viewport (resize de ventana) — ver
  // Fase 7.3, sección 8. Ambos listeners se remueven en `destroy()` (Fase
  // 7.3.5 — Beta Stabilization: sin esto, cada instancia de `App` dejaba un
  // listener de `window` huérfano, imposible de liberar por GC mientras
  // `window` siga vivo).
  const onViewportScroll = () => rulers.refresh();
  const onWindowResize = () => rulers.refresh();
  elements.canvasViewport.addEventListener("scroll", onViewportScroll);
  window.addEventListener("resize", onWindowResize);

  const newProjectDialog: NewProjectDialog = mountNewProjectDialog(elements.newProjectDialogContainer, {
    templateStore,
    moduleId: MODULE_ID,
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

  const productionExportDialog: ProductionExportDialog = mountProductionExportDialog(elements.productionExportDialogContainer, {
    resolver: { resolve: (assetId) => binaryStore.get(assetId) },
    now,
  });

  const saveAsTemplateDialog: SaveAsTemplateDialog = mountSaveAsTemplateDialog(elements.saveAsTemplateDialogContainer, {
    getProject: () => runtime.engine.getProject(),
    templateStore,
    moduleId: MODULE_ID,
    generateThumbnail,
    now,
    generateId,
    onSaved: () => setStatus("Plantilla guardada."),
  });

  elements.newButton.addEventListener("click", () => {
    // Epic 8, sección 8: "Nuevo" reemplaza el Project actual (ver
    // `remount()`) — antes de siquiera ofrecer elegir una plantilla, hay
    // que dejar el Project actual en un estado seguro para abandonarlo.
    // `ensureSeeded()` nunca lanza (ver `createLazyBuiltInTemplateSeeder`)
    // — el diálogo siempre abre, aunque sembrar los built-in haya fallado.
    void (async () => {
      if (!(await safeToProceed())) return;
      await builtInTemplatesSeeder.ensureSeeded();
      newProjectDialog.open();
    })();
  });
  elements.exportButton.addEventListener("click", () => exportDialog.open());
  elements.productionExportButton.addEventListener("click", () => productionExportDialog.open(runtime.engine.getProject(), runtime.engine.getProject().metadata.name ?? "Sticker"));
  elements.saveAsTemplateButton.addEventListener("click", () => saveAsTemplateDialog.open());
  elements.undoButton.addEventListener("click", () => {
    const result = runtime.engine.undo();
    setStatus(result.ok ? "Deshecho." : "No hay nada para deshacer.");
  });
  elements.redoButton.addEventListener("click", () => {
    const result = runtime.engine.redo();
    setStatus(result.ok ? "Rehecho." : "No hay nada para rehacer.");
  });
  elements.saveButton.addEventListener("click", () => void doSave());
  elements.backToWorkspaceButton.addEventListener("click", () => deps.onBackToWorkspace?.());
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
    save: () => void doSave(),
    goToWorkspace: () => deps.onBackToWorkspace?.(),
    selectAll,
    escape,
    nudge,
    bringForward: () => reorderSelected(1),
    sendBackward: () => reorderSelected(-1),
    toggleGrid: () => toggleGridVisible(runtime.engine),
    toggleRulers: () => elements.canvasArea.classList.toggle("rulers-hidden"),
  }, { target: deps.keyboardTarget });

  return {
    getRuntime: () => runtime,
    requestClose: () => safeToProceed(),
    hasUnsavedChanges: () => saveCoordinator.getState().status !== "clean",
    destroy: () => {
      unsubscribeEngine();
      unsubscribeSaveCoordinator();
      saveCoordinator.destroy();
      unsavedChangesDialog.destroy();
      keyboardShortcuts.destroy();
      zoomController.destroy();
      toolButtons.destroy();
      newProjectDialog.destroy();
      exportDialog.destroy();
      productionExportDialog.destroy();
      saveAsTemplateDialog.destroy();
      layersPanel.destroy();
      inspector.destroy();
      assetsPanel.destroy();
      alignmentPanel.destroy();
      gridOverlay.destroy();
      rulers.destroy();
      pointerIndicator.destroy();
      gridSnapControls.destroy();
      elements.canvasViewport.removeEventListener("scroll", onViewportScroll);
      window.removeEventListener("resize", onWindowResize);
      runtime.renderer.destroy();
    },
  };
}
