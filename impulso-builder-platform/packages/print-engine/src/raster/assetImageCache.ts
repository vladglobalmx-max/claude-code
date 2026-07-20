import type { AssetId } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { PrintEngineError } from "../errors.js";

/**
 * Cache efímero de imágenes decodificadas, de UNA sola exportación (Epic 9
 * / Fase 9.2, sección 12 del enunciado) — vive mientras dura
 * `renderPrintJob`/`exportPrintJobToPng`/`exportPrintJobToPdf`, nunca
 * entre exportaciones distintas. La misma imagen referenciada por varios
 * objects, o repetida en varias páginas del mismo `PrintJob`, se
 * resuelve/decodifica UNA sola vez (sección 12: "la misma imagen usada
 * varias veces no se decodifica N veces"). A diferencia del loader de un
 * solo uso de `@impulso/export-engine` (`rasterizeProjectToPng.ts`), este
 * cache vive across-pages — por eso no se reutiliza ese código, aunque la
 * técnica de decodificación (object URL + `Image`) es la misma.
 */
export interface AssetImageCache {
  /** Resuelve y decodifica (o devuelve la entrada ya cacheada) la imagen
   * de un Asset. Lanza `PrintEngineError("asset-resolution-failed", ...)`
   * si el binario no resuelve o no decodifica como imagen — nunca
   * sustituye silenciosamente con un placeholder (eso es responsabilidad
   * exclusiva de Preflight, ANTES de llegar aquí). */
  get(assetId: AssetId): Promise<HTMLImageElement>;
  /** Bytes totales estimados ya cacheados (tamaño de los Blob originales,
   * no del bitmap decodificado — ver `memory.ts`, `cachedImageBytes`). */
  totalBytes(): number;
  /** Revoca cada object URL creado — idempotente (seguro de llamar más de
   * una vez, incluso tras un error a mitad de camino). */
  dispose(): void;
}

export function createAssetImageCache(resolver: ExportAssetResolver): AssetImageCache {
  const entries = new Map<AssetId, Promise<HTMLImageElement>>();
  const objectUrls: string[] = [];
  let totalBytes = 0;
  let disposed = false;

  return {
    async get(assetId: AssetId): Promise<HTMLImageElement> {
      const cached = entries.get(assetId);
      if (cached) return cached;

      const pending = (async () => {
        const blob = await resolver.resolve(assetId);
        if (!blob) {
          throw new PrintEngineError(
            "asset-resolution-failed",
            `No se encontró el binario del Asset "${assetId}" al renderizar — vuelve a correr Preflight, pudo eliminarse después de verificarlo.`,
          );
        }
        totalBytes += blob.size;
        // Se registra el object URL ANTES de esperar la decodificación —
        // si `loadImageElement` rechaza (onerror), igual queda en la lista
        // para que `dispose()` lo revoque (nunca un object URL huérfano).
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.push(objectUrl);
        try {
          return await loadImageElementFromUrl(objectUrl);
        } catch (error) {
          throw new PrintEngineError(
            "asset-resolution-failed",
            `El Asset "${assetId}" no decodificó como imagen válida.`,
            { cause: error },
          );
        }
      })();

      entries.set(assetId, pending);
      return pending;
    },
    totalBytes: () => totalBytes,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
      entries.clear();
    },
  };
}

function loadImageElementFromUrl(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("El asset no es una imagen válida."));
    image.src = objectUrl;
  });
}
