import type { AssetId, ObjectId, Page, Project } from "@impulso/document-schema";
import { toPixels } from "@impulso/document-schema";
import { ExportError } from "../errors.js";
import type { ExportAssetResolver, ExportWarning } from "../types.js";
import { sceneObjectToSvg, type SvgWalkContext } from "./sceneObjectToSvg.js";
import { blobToDataUrl } from "./blobToDataUrl.js";

export interface BuildSvgDocumentOptions {
  pageId?: Page["id"];
}

export interface BuildSvgDocumentResult {
  svg: string;
  widthPx: number;
  heightPx: number;
  warnings: ExportWarning[];
}

/** Misma regla que `resolveActivePage` de `@impulso/renderer-konva` — se
 * duplica aquí (3 líneas) en vez de depender de ese paquete, para que el
 * núcleo SVG del Export Engine no dependa de Konva en absoluto (ver
 * ADR-0012). */
function resolveActivePage(project: Project, pageId?: Page["id"]): Page | undefined {
  if (pageId) return project.document.pages.find((page) => page.id === pageId);
  return project.document.pages[0];
}

/**
 * Núcleo del Export Engine: `Project -> string SVG`. Puro y determinista
 * salvo por la resolución asíncrona de Assets (embebidos como data URI) —
 * no depende de Konva, del DOM más allá de `Blob`/`FileReader`, ni de
 * ningún estado de edición (selección, handles, overlays: nunca se leen
 * porque nunca existen en `Document`). Ver ADR-0012.
 */
export async function buildSvgDocument(
  project: Project,
  resolver: ExportAssetResolver,
  options: BuildSvgDocumentOptions = {},
): Promise<BuildSvgDocumentResult> {
  const page = resolveActivePage(project, options.pageId);
  if (!page) {
    throw new ExportError("no_active_page", "El documento no tiene ninguna página para exportar.");
  }

  const widthPx = toPixels(page.size.width, page.unit);
  const heightPx = toPixels(page.size.height, page.unit);

  const warnings: ExportWarning[] = [];
  const validAssetIds = new Set(project.document.assets.map((asset) => asset.id));
  // Cachea la PROMESA (no solo el resultado ya resuelto): varios objects
  // pueden referenciar el mismo `assetId` y resolverse concurrentemente
  // (`Promise.all` sobre los objects de una Layer) — cachear el resultado
  // recién al final dejaría una ventana donde dos llamadas concurrentes ya
  // vieron el cache vacío y ambas llaman a `resolver.resolve` por
  // separado. Cachear la promesa desde el inicio deduplica también ese
  // caso concurrente, no solo llamadas secuenciales.
  const dataUrlCache = new Map<AssetId, Promise<string | undefined>>();

  function resolveImage(assetId: AssetId, objectId: ObjectId): Promise<string | undefined> {
    const cached = dataUrlCache.get(assetId);
    if (cached) return cached;

    const promise = (async (): Promise<string | undefined> => {
      if (!validAssetIds.has(assetId)) {
        warnings.push({
          code: "asset_reference_missing",
          objectId,
          assetId,
          message: `El object "${objectId}" referencia un Asset ("${assetId}") que ya no existe en la Biblioteca de Assets — se exportó un marcador de posición.`,
        });
        return undefined;
      }

      const blob = await resolver.resolve(assetId);
      if (!blob) {
        warnings.push({
          code: "asset_binary_missing",
          objectId,
          assetId,
          message: `No se encontró el binario del Asset "${assetId}" — se exportó un marcador de posición.`,
        });
        return undefined;
      }

      return blobToDataUrl(blob);
    })();

    dataUrlCache.set(assetId, promise);
    return promise;
  }

  const defs: string[] = [];
  const ctx: SvgWalkContext = { resolveImage, warnings, defs };

  const layerMarkup: string[] = [];
  for (const layer of page.layers) {
    if (!layer.metadata.visible) continue;
    const children = await Promise.all(layer.objects.map((object) => sceneObjectToSvg(object, ctx)));
    layerMarkup.push(`<g>${children.join("")}</g>`);
  }

  const unitSuffix = page.unit === "px" ? "" : page.unit;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${page.size.width}${unitSuffix}" height="${page.size.height}${unitSuffix}" viewBox="0 0 ${widthPx} ${heightPx}">`,
    defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "",
    layerMarkup.join(""),
    `</svg>`,
  ].join("");

  return { svg, widthPx, heightPx, warnings };
}
