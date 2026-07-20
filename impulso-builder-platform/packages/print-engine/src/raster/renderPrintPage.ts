import type { AssetId, PageId, Project } from "@impulso/document-schema";
import { renderPageToStage, resolveActivePage } from "@impulso/renderer-konva";
import { PrintEngineError, throwIfAborted } from "../errors.js";
import type { PrintJob } from "../types.js";
import { computeCanonicalPageGeometry, type CanonicalPageGeometry } from "./coordinates.js";
import { collectImageAssetIds } from "./collectImageAssetIds.js";
import type { AssetImageCache } from "./assetImageCache.js";
import { combineShouldRenderObject, type ShouldRenderObject } from "./objectFilters.js";

export interface RenderPrintPageOptions {
  project: Project;
  printJob: PrintJob;
  pageId: PageId;
  imageCache: AssetImageCache;
  shouldRenderObject?: ShouldRenderObject;
  signal?: AbortSignal;
}

export interface RenderedPrintPage {
  pageId: PageId;
  /** El raster físico completo (BleedBox, no solo TrimBox) a `targetPpi`. El
   * caller es responsable de invocar `canvas` una sola vez y descartarla
   * (no se cachea aquí — ver sección 14, "procesar páginas
   * secuencialmente"). */
  canvas: HTMLCanvasElement;
  widthPx: number;
  heightPx: number;
  geometry: CanonicalPageGeometry;
}

/**
 * Renderiza UNA página física de un `PrintJob` a un raster (Epic 9 / Fase
 * 9.2, ver ADR-0022): construye un Stage offscreen del tamaño del
 * BleedBox (no solo el trim — ver `coordinates.ts`), con el contenido
 * desplazado por el sangrado, escalado por `printJob.scale` ("el diseño
 * se escala respecto al trim" — sección 3 del contrato de `PrintJob`,
 * Fase 9.1; nunca cambia el tamaño físico de la página en sí, solo cuánto
 * del contenido cabe dentro de ella), excluye die-lines del contenido
 * (`combineShouldRenderObject`), y pide un único `pixelRatio =
 * canonicalScale` — la escala de RESOLUCIÓN se aplica una sola vez, nunca
 * encadenada (la de `printJob.scale` es una dimensión completamente
 * distinta, aplicada al contenido, no al raster final).
 */
export async function renderPrintPage(options: RenderPrintPageOptions): Promise<RenderedPrintPage> {
  const { project, printJob, pageId, imageCache, signal } = options;

  throwIfAborted(signal, "antes de renderizar la página");

  const page = resolveActivePage(project, pageId);
  if (!page) {
    throw new PrintEngineError("render-failed", `El Print Job referencia una página ("${pageId}") que ya no existe en el documento.`);
  }

  const geometry = computeCanonicalPageGeometry(printJob);

  const assetIds = new Set<AssetId>();
  for (const layer of page.layers) collectImageAssetIds(layer.objects, assetIds);
  const resolvedImages = new Map<AssetId, CanvasImageSource>();
  for (const assetId of assetIds) {
    throwIfAborted(signal, "resolviendo assets de la página");
    const image = await imageCache.get(assetId);
    resolvedImages.set(assetId, image);
  }

  throwIfAborted(signal, "después de resolver assets, antes de rasterizar");

  const backgroundColor = printJob.background.type === "solid" ? printJob.background.color : undefined;

  const offscreen = renderPageToStage(project, {
    pageId,
    resolveAssetSource: (assetId) => resolvedImages.get(assetId),
    backgroundColor,
    canvasSizePx: { width: geometry.canvasCanonicalWidth, height: geometry.canvasCanonicalHeight },
    contentOffsetPx: { x: geometry.offsetCanonicalX, y: geometry.offsetCanonicalY },
    contentScale: printJob.scale,
    shouldRenderObject: combineShouldRenderObject(options.shouldRenderObject),
  });

  if (!offscreen) {
    throw new PrintEngineError("render-failed", `El Print Job referencia una página ("${pageId}") que ya no existe en el documento.`);
  }

  try {
    const canvas = offscreen.stage.toCanvas({ pixelRatio: geometry.canonicalScale });
    return { pageId, canvas, widthPx: geometry.canvasRasterWidth, heightPx: geometry.canvasRasterHeight, geometry };
  } catch (error) {
    throw new PrintEngineError("render-failed", `No se pudo rasterizar la página "${pageId}" a ${printJob.resolution.targetPpi} PPI.`, { cause: error });
  } finally {
    offscreen.destroy();
  }
}
