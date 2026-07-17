import Konva from "konva";
import type { Page, Project } from "@impulso/document-schema";
import type { Engine } from "@impulso/engine";
import type { Unsubscribe } from "@impulso/engine";
import { toPixels } from "./unit.js";
import { createSceneNode } from "./nodes/sceneNode.js";
import type { KonvaRendererOptions, NodeContext, RendererAdapter } from "./types.js";

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
 * Reconciliación: cada `render()` hace un rebuild completo — destruye todos
 * los nodos de `mainLayer` y los vuelve a crear a partir del Project actual.
 * Es la implementación más simple y correcta, y suficiente para Foundation
 * 3; el costo (O(objetos de la página activa) por render, sin importar
 * cuán pequeño fue el cambio real) está documentado como el cuello de
 * botella principal para documentos grandes en
 * `../../../docs/PERFORMANCE_BUDGET.md` (fila 4), junto con la estrategia
 * de optimización futura (reconciliación incremental por id) — no
 * implementada aquí a propósito ("no optimizar prematuramente").
 */
export function createKonvaRenderer(engine: Engine, options: KonvaRendererOptions = {}): RendererAdapter {
  let stage: Konva.Stage | null = null;
  let mainLayer: Konva.Layer | null = null;
  let unsubscribe: Unsubscribe | null = null;

  function render(): void {
    if (!stage || !mainLayer) return;

    const project = engine.getProject();
    const page = resolveActivePage(project, options.pageId);

    mainLayer.destroyChildren();

    if (!page) {
      // El pageId configurado ya no existe en el Project (ej. fue
      // eliminado). No hay una página válida que dibujar — se deja el
      // Stage vacío en vez de adivinar una. Ver README, "Riesgos".
      mainLayer.batchDraw();
      return;
    }

    stage.width(toPixels(page.size.width, page.unit));
    stage.height(toPixels(page.size.height, page.unit));

    const context: NodeContext = {
      dispatch: engine.dispatch,
      resolveAssetSource: options.resolveAssetSource,
      onRejectedTransform: render,
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
  }

  return {
    mount(container: HTMLDivElement): void {
      stage = new Konva.Stage({ container, width: 1, height: 1 });
      mainLayer = new Konva.Layer();
      stage.add(mainLayer);

      render();

      unsubscribe = engine.subscribe((event) => {
        if (event.type === "projectChanged") render();
      });
    },

    destroy(): void {
      unsubscribe?.();
      unsubscribe = null;
      stage?.destroy();
      stage = null;
      mainLayer = null;
    },

    getStage: () => stage,
  };
}
