import Konva from "konva";
import { toPixels, type AssetId, type Page, type Project } from "@impulso/document-schema";
import { createSceneNode } from "./nodes/sceneNode.js";
import { resolveActivePage } from "./renderer.js";
import type { NodeContext } from "./types.js";

export interface OffscreenRenderOptions {
  /** Qué Page renderizar. Por defecto, la primera del Document — mismo
   * criterio que `createKonvaRenderer` (ver `resolveActivePage`). */
  pageId?: Page["id"];
  resolveAssetSource?: (assetId: AssetId) => CanvasImageSource | undefined;
  /** Color sólido a dibujar detrás del contenido (ej. exportar PNG con
   * fondo sólido en vez de transparente). Sin esto, el Stage resultante es
   * transparente. */
  backgroundColor?: string;
}

export interface OffscreenRender {
  stage: Konva.Stage;
  widthPx: number;
  heightPx: number;
  /** Destruye el Stage y libera sus nodos — el caller es responsable de
   * invocarlo apenas termine de leer los píxeles (`stage.toCanvas()`). */
  destroy(): void;
}

/**
 * Construye un `Konva.Stage` desacoplado del editor: sin `selectionLayer`,
 * sin ninguna interactividad (drag/selección/edición de texto in-canvas),
 * nunca montado en el DOM visible (su `container` es un `<div>` que jamás
 * se agrega a `document.body`). Pensado para el Export Engine — la
 * rasterización PNG reutiliza `createSceneNode` 1:1, así que un PNG
 * exportado dibuja exactamente el mismo código que ya pinta el canvas del
 * editor, sin reimplementar layout de texto/curvas/sombras por separado
 * (ver ADR-0012, "Por qué reutilizar Konva para PNG"). NO es el mecanismo
 * de exportación SVG — ese vive enteramente en `@impulso/export-engine`,
 * sin ninguna dependencia de este paquete ni de Konva.
 *
 * `dispatch` nunca se invoca en este modo (`interactive: false` en cada
 * node evita que se adjunten los handlers que lo llamarían — ver
 * `baseAttrs.ts`) — se deja como una función que lanza, a propósito, para
 * detectar en desarrollo cualquier uso indebido futuro de este Stage como
 * si fuera interactivo.
 */
export function renderPageToStage(project: Project, options: OffscreenRenderOptions = {}): OffscreenRender | null {
  const page = resolveActivePage(project, options.pageId);
  if (!page) return null;

  const widthPx = toPixels(page.size.width, page.unit);
  const heightPx = toPixels(page.size.height, page.unit);

  const container = document.createElement("div");
  const stage = new Konva.Stage({ container, width: widthPx, height: heightPx });
  const contentLayer = new Konva.Layer();
  stage.add(contentLayer);

  if (options.backgroundColor) {
    contentLayer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: widthPx,
        height: heightPx,
        fill: options.backgroundColor,
        listening: false,
      }),
    );
  }

  const context: NodeContext = {
    dispatch: () => {
      throw new Error("Un Stage offscreen (Export Engine) no despacha comandos — es de solo lectura.");
    },
    resolveAssetSource: options.resolveAssetSource,
    interactive: false,
  };

  for (const layer of page.layers) {
    const layerGroup = new Konva.Group({ id: layer.id, visible: layer.metadata.visible, listening: false });
    for (const object of layer.objects) {
      layerGroup.add(createSceneNode(object, context));
    }
    contentLayer.add(layerGroup);
  }

  contentLayer.batchDraw();

  return {
    stage,
    widthPx,
    heightPx,
    destroy: () => stage.destroy(),
  };
}
