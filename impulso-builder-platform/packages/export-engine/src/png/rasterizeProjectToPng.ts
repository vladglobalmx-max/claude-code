import type { AssetId, Project, SceneObject } from "@impulso/document-schema";
import { renderPageToStage, resolveActivePage } from "@impulso/renderer-konva";
import { ExportError } from "../errors.js";
import type { ExportAssetResolver, ExportWarning, PngExportOptions } from "../types.js";

export interface RasterizePngResult {
  blob: Blob;
  width: number;
  height: number;
  warnings: ExportWarning[];
}

function collectImageAssetIds(objects: readonly SceneObject[], out: Set<AssetId>): void {
  for (const object of objects) {
    if (object.type === "image") out.add(object.assetId);
    else if (object.type === "group") collectImageAssetIds(object.children, out);
  }
}

/** Decodifica un Blob a `HTMLImageElement` vía object URL — SIEMPRE se
 * revoca apenas termina la rasterización (a diferencia de
 * `ResolvedAssetCache` en `apps/sticker-builder`, este mapa es de un solo
 * uso, no un cache persistente entre renders). */
function loadImageElement(blob: Blob): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("El asset no es una imagen válida."));
    };
    image.src = objectUrl;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * Rasteriza un `Project` a PNG reutilizando `@impulso/renderer-konva` vía
 * un Stage headless (`renderPageToStage`, ver ADR-0012) — NO el Stage
 * interactivo montado en el editor. `stage.toCanvas({ pixelRatio })` hace
 * que Konva vuelva a dibujar cada primitiva DIRECTAMENTE a la resolución
 * pedida (nítido en 1x-4x, sin ampliar un raster ya rasterizado). Este es
 * el único módulo de todo el Export Engine que importa Konva — el núcleo
 * SVG (`svg/`) no lo hace.
 */
export async function rasterizeProjectToPng(
  project: Project,
  resolver: ExportAssetResolver,
  options: PngExportOptions,
): Promise<RasterizePngResult> {
  const page = resolveActivePage(project, options.pageId);
  if (!page) {
    throw new ExportError("no_active_page", "El documento no tiene ninguna página para exportar.");
  }

  const warnings: ExportWarning[] = [];
  const validAssetIds = new Set(project.document.assets.map((asset) => asset.id));
  const assetIds = new Set<AssetId>();
  for (const layer of page.layers) collectImageAssetIds(layer.objects, assetIds);

  const imageMap = new Map<AssetId, HTMLImageElement>();
  const objectUrls: string[] = [];

  await Promise.all(
    Array.from(assetIds).map(async (assetId) => {
      if (!validAssetIds.has(assetId)) {
        warnings.push({
          code: "asset_reference_missing",
          assetId,
          message: `Un object referencia un Asset ("${assetId}") que ya no existe en la Biblioteca de Assets — se exportó un marcador de posición.`,
        });
        return;
      }
      const blob = await resolver.resolve(assetId);
      if (!blob) {
        warnings.push({
          code: "asset_binary_missing",
          assetId,
          message: `No se encontró el binario del Asset "${assetId}" — se exportó un marcador de posición.`,
        });
        return;
      }
      const { image, objectUrl } = await loadImageElement(blob);
      imageMap.set(assetId, image);
      objectUrls.push(objectUrl);
    }),
  );

  const backgroundColor = options.background.type === "solid" ? options.background.color : undefined;

  let blob: Blob | null;
  let width: number;
  let height: number;
  const offscreen = renderPageToStage(project, {
    pageId: options.pageId,
    resolveAssetSource: (assetId) => imageMap.get(assetId),
    backgroundColor,
  });

  try {
    // Defensivo, no cubierto por tests: `renderPageToStage` resuelve la
    // página con el mismo criterio puro que ya usamos en la línea 55 sobre
    // el mismo `project`/`options.pageId` — no hay forma real de que
    // encuentre una página distinta (ni ninguna) aquí. Se mantiene por
    // seguridad ante un futuro refactor que desacople ambas resoluciones.
    if (!offscreen) {
      throw new ExportError("no_active_page", "El documento no tiene ninguna página para exportar.");
    }
    let canvas: HTMLCanvasElement;
    try {
      canvas = offscreen.stage.toCanvas({ pixelRatio: options.scale });
    } catch (error) {
      throw new ExportError(
        "out_of_memory",
        `No se pudo generar el PNG a escala ${options.scale}x — probá con una escala menor. (${(error as Error).message})`,
      );
    }
    width = canvas.width;
    height = canvas.height;
    blob = await canvasToPngBlob(canvas);
    if (!blob) {
      throw new ExportError(
        "out_of_memory",
        `No se pudo generar el PNG a escala ${options.scale}x — probá con una escala menor.`,
      );
    }
  } finally {
    offscreen?.destroy();
    for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
  }

  return { blob, width, height, warnings };
}
