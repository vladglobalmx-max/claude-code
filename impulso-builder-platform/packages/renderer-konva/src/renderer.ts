import Konva from "konva";
import type { Page, Project } from "@impulso/document-schema";
import type { Engine } from "@impulso/engine";
import type { Unsubscribe } from "@impulso/engine";
import { toPixels } from "./unit.js";
import { createSceneNode } from "./nodes/sceneNode.js";
import type { KonvaRendererOptions, NodeContext, RendererAdapter } from "./types.js";

/** Color fijo del indicador de selección — Editor 2 no incluye todavía un
 * sistema de theming; ver README "Fuera de alcance". */
const SELECTION_STROKE_COLOR = "#3b82f6";

function resolveActivePage(project: Project, pageId?: Page["id"]): Page | undefined {
  if (pageId) {
    return project.document.pages.find((page) => page.id === pageId);
  }
  return project.document.pages[0];
}

/**
 * Primer adaptador concreto del contrato `RendererAdapter` (ver ADR-0001):
 * Document Schema -> Scene Graph -> Konva, y eventos de Konva -> Engine.
 *
 * Dos Konva.Layer, no uno: `mainLayer` (contenido, se reconstruye completo
 * en cada `projectChanged`) y `selectionLayer` (el indicador visual de
 * selección, se redibuja solo en `selectionChanged`, sin tocar el
 * contenido). Es el patrón que la propia documentación de Konva recomienda
 * para UI que cambia con más frecuencia que el contenido — evitar que
 * CADA click reconstruya toda la escena habría compuesto el cuello de
 * botella ya documentado del rebuild completo (ver ADR-0006, "Rendimiento").
 *
 * Reconciliación de `mainLayer`: rebuild completo — destruye todos sus
 * nodos y los vuelve a crear a partir del Project actual. Es la
 * implementación más simple y correcta, y suficiente para este alcance; el
 * costo (O(objetos de la página activa) por render de contenido) está
 * documentado en `../../../docs/PERFORMANCE_BUDGET.md` (fila 4).
 */
export function createKonvaRenderer(engine: Engine, options: KonvaRendererOptions = {}): RendererAdapter {
  let stage: Konva.Stage | null = null;
  let mainLayer: Konva.Layer | null = null;
  let selectionLayer: Konva.Layer | null = null;
  let unsubscribe: Unsubscribe | null = null;

  function renderSelectionOverlay(): void {
    // Guarda defensiva de tipos: ambos call sites (fin de renderContent, y
    // el callback de "selectionChanged" mientras la suscripción está
    // activa) ya garantizan que no son null en el ciclo de vida actual de
    // mount/destroy — no hay un camino conocido para ejercitar esta rama
    // hoy. Se mantiene por seguridad ante un futuro refactor, no por un
    // caso real observado.
    if (!mainLayer || !selectionLayer) return;
    selectionLayer.destroyChildren();

    for (const objectId of engine.getSelection()) {
      const node = mainLayer.findOne(`#${objectId}`);
      if (!node) continue; // ver ADR-0006, Riesgos: no debería pasar tras pruneSelection, pero no se asume.
      const box = node.getClientRect({ relativeTo: mainLayer });
      selectionLayer.add(
        new Konva.Rect({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          stroke: SELECTION_STROKE_COLOR,
          strokeWidth: 2,
          dash: [6, 4],
          listening: false,
        }),
      );
    }

    selectionLayer.batchDraw();
  }

  function renderContent(): void {
    if (!stage || !mainLayer || !selectionLayer) return;

    const project = engine.getProject();
    const page = resolveActivePage(project, options.pageId);

    mainLayer.destroyChildren();

    if (!page) {
      // El pageId configurado ya no existe en el Project (ej. fue
      // eliminado). No hay una página válida que dibujar — se deja el
      // Stage vacío en vez de adivinar una. Ver README, "Riesgos".
      mainLayer.batchDraw();
      selectionLayer.destroyChildren();
      selectionLayer.batchDraw();
      return;
    }

    stage.width(toPixels(page.size.width, page.unit));
    stage.height(toPixels(page.size.height, page.unit));

    const context: NodeContext = {
      dispatch: engine.dispatch,
      resolveAssetSource: options.resolveAssetSource,
      onRejectedTransform: renderContent,
    };

    for (const layer of page.layers) {
      const layerGroup = new Konva.Group({
        id: layer.id,
        visible: layer.metadata.visible,
        listening: !layer.metadata.locked,
      });
      for (const object of layer.objects) {
        layerGroup.add(createSceneNode(object, context));
      }
      mainLayer.add(layerGroup);
    }

    mainLayer.batchDraw();
    // El contenido cambió: los nodos que el overlay referenciaba por id
    // pudieron destruirse/recrearse (posiciones nuevas) — se recalcula.
    renderSelectionOverlay();
  }

  return {
    mount(container: HTMLDivElement): void {
      stage = new Konva.Stage({ container, width: 1, height: 1 });
      mainLayer = new Konva.Layer();
      selectionLayer = new Konva.Layer({ listening: false });
      stage.add(mainLayer);
      stage.add(selectionLayer);

      // Click en el Stage que no llegó a ningún object (los objects
      // detienen la propagación en baseAttrs.ts) => click "en vacío".
      stage.on("click", (evt) => {
        if (evt.target === stage) {
          engine.dispatch({ type: "clearSelection" });
        }
      });

      renderContent();

      unsubscribe = engine.subscribe((event) => {
        if (event.type === "projectChanged") renderContent();
        else if (event.type === "selectionChanged") renderSelectionOverlay();
      });
    },

    destroy(): void {
      unsubscribe?.();
      unsubscribe = null;
      stage?.destroy();
      stage = null;
      mainLayer = null;
      selectionLayer = null;
    },

    getStage: () => stage,
  };
}
