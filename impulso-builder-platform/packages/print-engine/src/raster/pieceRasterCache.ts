import type { PageId, Project } from "@impulso/document-schema";
import type { PrintJob } from "../types.js";
import { renderPrintPage, type RenderedPrintPage } from "./renderPrintPage.js";
import type { AssetImageCache } from "./assetImageCache.js";
import type { ShouldRenderObject } from "./objectFilters.js";

let shouldRenderObjectIdCounter = 0;
const shouldRenderObjectIds = new WeakMap<ShouldRenderObject, number>();

/** Un predicado de filtrado no se puede comparar por VALOR (es una
 * función) — se distingue por IDENTIDAD: la MISMA referencia reutilizada
 * entre llamadas produce la misma clave; una referencia DISTINTA (aunque
 * se comporte igual) produce una clave distinta — asumir lo contrario
 * requeriría inspeccionar el comportamiento de la función, que esta
 * cache deliberadamente no intenta hacer. */
function shouldRenderObjectIdentity(fn: ShouldRenderObject | undefined): string {
  if (!fn) return "none";
  let id = shouldRenderObjectIds.get(fn);
  if (id === undefined) {
    id = shouldRenderObjectIdCounter++;
    shouldRenderObjectIds.set(fn, id);
  }
  return `fn${id}`;
}

function backgroundKey(background: PrintJob["background"]): string {
  return background.type === "solid" ? `solid:${background.color}` : "transparent";
}

/**
 * Key determinista de una pieza rasterizada (Fase 9.4, sección 3/13) —
 * construida a mano desde campos primitivos, NUNCA `JSON.stringify` de un
 * objeto cuyo orden de claves podría variar entre llamadas. Incluye
 * exactamente los campos que afectan el resultado visual del raster:
 * página de origen, PPI, escala, sangrado, filtro de roles y fondo — dos
 * llamadas con estos mismos valores SIEMPRE producen el mismo raster
 * (bit a bit), así que reutilizarlo es seguro.
 */
export function pieceRasterCacheKey(pageId: PageId, printJob: PrintJob, shouldRenderObject: ShouldRenderObject | undefined): string {
  const { top, right, bottom, left, unit } = printJob.bleed;
  return [
    pageId,
    printJob.resolution.targetPpi,
    printJob.scale,
    `${top},${right},${bottom},${left},${unit}`,
    shouldRenderObjectIdentity(shouldRenderObject),
    backgroundKey(printJob.background),
  ].join("|");
}

export interface RenderPieceOptions {
  project: Project;
  printJob: PrintJob;
  imageCache: AssetImageCache;
  shouldRenderObject?: ShouldRenderObject;
  signal?: AbortSignal;
}

export interface PieceRasterCache {
  /** Devuelve el raster ya cacheado para esta combinación de página +
   * configuración visual relevante, o lo renderiza UNA sola vez
   * (single-flight — incluso ante llamadas concurrentes con la misma
   * key, ambas reciben la MISMA promesa en vuelo, mismo patrón que
   * `assetImageCache.ts`) y lo cachea para el resto de la exportación. */
  get(pageId: PageId, options: RenderPieceOptions): Promise<RenderedPrintPage>;
  /** Cuántas piezas ÚNICAS se rasterizaron de verdad en esta exportación
   * — el requisito central de reutilización (sección 13) es verificable
   * directamente con este número: N copias de la misma pieza deben
   * producir `uniqueRenderCount === 1`, nunca `N`. */
  readonly uniqueRenderCount: number;
  /** Libera las entradas — idempotente. Los `HTMLCanvasElement`
   * rasterizados no requieren disposición explícita (nunca se adjuntan
   * al DOM, se liberan por GC normal en cuanto quedan sin referencias,
   * mismo criterio ya establecido en Fase 9.2/9.3) — `dispose()` solo
   * necesita soltar las referencias de este Map. */
  dispose(): void;
}

export function createPieceRasterCache(): PieceRasterCache {
  const entries = new Map<string, Promise<RenderedPrintPage>>();
  let uniqueRenderCount = 0;
  let disposed = false;

  return {
    async get(pageId: PageId, options: RenderPieceOptions): Promise<RenderedPrintPage> {
      const key = pieceRasterCacheKey(pageId, options.printJob, options.shouldRenderObject);
      const cached = entries.get(key);
      if (cached) return cached;

      uniqueRenderCount += 1;
      const pending = renderPrintPage({
        project: options.project,
        printJob: options.printJob,
        pageId,
        imageCache: options.imageCache,
        shouldRenderObject: options.shouldRenderObject,
        signal: options.signal,
      });
      entries.set(key, pending);
      return pending;
    },
    get uniqueRenderCount() {
      return uniqueRenderCount;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      entries.clear();
    },
  };
}
