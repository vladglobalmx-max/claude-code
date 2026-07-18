import type { AssetId, Document } from "@impulso/document-schema";
import type { AssetBinaryStore } from "@impulso/asset-library";

/**
 * `resolveAssetSource` (`@impulso/renderer-konva`, Foundation 3) es
 * SINCRÓNICO — se llama mientras se construye cada node de Konva. El
 * binario real de un Asset vive en `AssetBinaryStore` (IndexedDB),
 * inherentemente asíncrono. Este cache en memoria es el puente: se
 * repuebla de forma asíncrona (`preloadDocumentAssets`, antes de montar el
 * Canvas Runtime) y el Renderer solo lee de él, nunca del store
 * directamente.
 */
export interface ResolvedAssetCache {
  resolve(assetId: AssetId): HTMLImageElement | undefined;
  set(assetId: AssetId, image: HTMLImageElement, objectUrl?: string): void;
  clear(): void;
}

export function createResolvedAssetCache(): ResolvedAssetCache {
  const images = new Map<AssetId, HTMLImageElement>();
  const objectUrls = new Map<AssetId, string>();

  function revoke(assetId: AssetId): void {
    const url = objectUrls.get(assetId);
    if (url) URL.revokeObjectURL(url);
    objectUrls.delete(assetId);
  }

  return {
    resolve: (assetId) => images.get(assetId),
    set: (assetId, image, objectUrl) => {
      revoke(assetId);
      images.set(assetId, image);
      if (objectUrl) objectUrls.set(assetId, objectUrl);
    },
    clear: () => {
      for (const assetId of objectUrls.keys()) revoke(assetId);
      images.clear();
    },
  };
}

/** Decodifica un `Blob` a un `HTMLImageElement` vía un object URL — el
 * caller es responsable de revocar la URL cuando ya no la necesite
 * (`ResolvedAssetCache` lo hace automáticamente al reemplazar/limpiar una
 * entrada). No se revoca inmediatamente al cargar: el `<img>` resultante
 * sigue usando esa URL como su `src` (ej. para mostrarlo como miniatura en
 * el panel de Assets). */
export function loadImageElement(blob: Blob): Promise<{ image: HTMLImageElement; objectUrl: string }> {
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

/**
 * Resuelve en el cache sincrónico cada Asset de type "image" del
 * documento, leyendo su Blob desde el `AssetBinaryStore` — se ejecuta
 * antes del primer render de un proyecto recién creado/abierto. Un Asset
 * sin Blob guardado (ej. se perdió/nunca se subió) simplemente no se
 * resuelve — el Renderer ya degrada correctamente a un placeholder para
 * cualquier `assetId` sin resolver (ver README de `@impulso/renderer-konva`).
 */
export async function preloadDocumentAssets(
  document: Document,
  store: AssetBinaryStore,
  cache: ResolvedAssetCache,
): Promise<void> {
  const imageAssets = document.assets.filter((asset) => asset.type === "image");
  await Promise.all(
    imageAssets.map(async (asset) => {
      const blob = await store.get(asset.id);
      if (!blob) return;
      const { image, objectUrl } = await loadImageElement(blob);
      cache.set(asset.id, image, objectUrl);
    }),
  );
}
