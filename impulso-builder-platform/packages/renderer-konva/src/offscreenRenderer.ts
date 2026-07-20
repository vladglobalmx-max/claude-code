import Konva from "konva";
import { toPixels, type AssetId, type Layer, type Page, type Project, type SceneObject } from "@impulso/document-schema";
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
   * transparente. Cubre el Stage completo (`canvasSizePx`, si se indica —
   * no solo el tamaño de la página). */
  backgroundColor?: string;
  /**
   * Filtra qué objects se agregan al Stage — Epic 9 / Fase 9.2 (ver
   * ADR-0022): permite que el Print Engine excluya, por ejemplo, un
   * die-line (`metadata.role === "die-line"`) del raster de contenido
   * final. Se evalúa recursivamente: un `group` cuyos hijos quedan TODOS
   * excluidos no se agrega en absoluto (nunca un `Konva.Group` vacío); un
   * `group` con una mezcla de hijos incluidos/excluidos conserva solo los
   * incluidos, en su mismo orden relativo. Nunca muta `project` ni
   * `metadata` — opera sobre una copia superficial del árbol de objects.
   * Ausente equivale a "incluir todo" — el comportamiento de siempre.
   */
  shouldRenderObject?: (object: SceneObject, context: { pageId: Page["id"]; layerId: Layer["id"] }) => boolean;
  /**
   * Tamaño explícito del Stage, en px CANÓNICO (pre-escala/pre-pixelRatio)
   * — por defecto, el tamaño físico de la página (TrimBox), igual que
   * hoy. Fase 9.2 lo usa para construir un Stage del tamaño del BleedBox y
   * poder capturar geometría que se extiende más allá del trim.
   */
  canvasSizePx?: { width: number; height: number };
  /**
   * Desplaza TODO el contenido (no el fondo, que siempre cubre el Stage
   * completo) dentro del Stage, en px canónico — por defecto `{x:0,y:0}`
   * (comportamiento actual, sin cambios). Fase 9.2 lo usa para que el
   * origen (0,0) del TrimBox caiga en el punto correcto dentro de un Stage
   * más grande que el propio trim (ej. `bleedLeft`/`bleedTop`).
   */
  contentOffsetPx?: { x: number; y: number };
  /**
   * Escala TODO el contenido (no el fondo) respecto a su propio origen — el
   * mismo punto que ancla `contentOffsetPx` (el origen del TrimBox) — por
   * defecto `1` (comportamiento actual, sin cambios). Fase 9.2 lo usa para
   * aplicar `PrintJob.scale`: "el diseño se escala respecto al trim", nunca
   * el tamaño físico de la página en sí (`canvasSizePx` no cambia con
   * esto) — ver ADR-0022 y `raster/renderPrintPage.ts`.
   */
  contentScale?: number;
}

export interface OffscreenRender {
  stage: Konva.Stage;
  widthPx: number;
  heightPx: number;
  /** Destruye el Stage y libera sus nodos — el caller es responsable de
   * invocarlo apenas termine de leer los píxeles (`stage.toCanvas()`). */
  destroy(): void;
}

/** Copia superficial del árbol de objects de una Layer aplicando
 * `shouldRenderObject` recursivamente sobre `group`s — ver el comentario de
 * la opción en `OffscreenRenderOptions`. Nunca toca el `object`/`project`
 * original: cada `group` incluido con hijos filtrados es un objeto NUEVO
 * (`{...group, children}`), nunca el mismo por referencia. */
function filterObjectTree(
  objects: readonly SceneObject[],
  shouldRenderObject: NonNullable<OffscreenRenderOptions["shouldRenderObject"]>,
  context: { pageId: Page["id"]; layerId: Layer["id"] },
): SceneObject[] {
  const result: SceneObject[] = [];
  for (const object of objects) {
    if (!shouldRenderObject(object, context)) continue;
    if (object.type === "group") {
      const children = filterObjectTree(object.children, shouldRenderObject, context);
      if (children.length === 0) continue; // nunca un Group vacío por filtrado
      result.push({ ...object, children });
    } else {
      result.push(object);
    }
  }
  return result;
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
 * sin ninguna dependencia de este paquete ni de Konva. También es la base
 * del Print Engine (`@impulso/print-engine`, Epic 9 / Fase 9.2 — ver
 * ADR-0022) para renderizar contenido físico con sangrado.
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

  const trimWidthPx = toPixels(page.size.width, page.unit);
  const trimHeightPx = toPixels(page.size.height, page.unit);
  const widthPx = options.canvasSizePx?.width ?? trimWidthPx;
  const heightPx = options.canvasSizePx?.height ?? trimHeightPx;
  const offsetX = options.contentOffsetPx?.x ?? 0;
  const offsetY = options.contentOffsetPx?.y ?? 0;
  const contentScale = options.contentScale ?? 1;

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

  // Solo se introduce un Group de desplazamiento/escala cuando realmente
  // hace falta (`offsetX`/`offsetY` distinto de 0, o `contentScale`
  // distinto de 1) — así el árbol de nodes resultante es IDÉNTICO al de
  // antes de Fase 9.2 para cualquier caller que no use las opciones
  // nuevas (ninguna cambia el comportamiento por omisión). Konva aplica
  // primero la traslación (x/y) y LUEGO la escala de los hijos alrededor
  // de ese punto — exactamente "escalar el diseño respecto al origen del
  // trim, ya desplazado dentro del BleedBox".
  const needsContentGroup = offsetX !== 0 || offsetY !== 0 || contentScale !== 1;
  const contentParent = needsContentGroup
    ? new Konva.Group({ x: offsetX, y: offsetY, scaleX: contentScale, scaleY: contentScale, listening: false })
    : contentLayer;
  if (needsContentGroup) contentLayer.add(contentParent as Konva.Group);

  for (const layer of page.layers) {
    const objects = options.shouldRenderObject
      ? filterObjectTree(layer.objects, options.shouldRenderObject, { pageId: page.id, layerId: layer.id })
      : layer.objects;
    const layerGroup = new Konva.Group({ id: layer.id, visible: layer.metadata.visible, listening: false });
    for (const object of objects) {
      layerGroup.add(createSceneNode(object, context));
    }
    contentParent.add(layerGroup);
  }

  contentLayer.batchDraw();

  return {
    stage,
    widthPx,
    heightPx,
    destroy: () => stage.destroy(),
  };
}
