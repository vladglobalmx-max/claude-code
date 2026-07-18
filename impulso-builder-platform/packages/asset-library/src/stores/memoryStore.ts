import type { AssetId } from "@impulso/document-schema";
import type { AssetBinaryStore } from "../types.js";

/** Implementación en memoria de `AssetBinaryStore` — para tests, o
 * cualquier contexto sin IndexedDB disponible (ej. SSR). No persiste entre
 * recargas de página: para eso está `createIndexedDbAssetStore`. */
export function createMemoryAssetStore(): AssetBinaryStore {
  const blobs = new Map<AssetId, Blob>();
  return {
    async get(assetId) {
      return blobs.get(assetId);
    },
    async set(assetId, blob) {
      blobs.set(assetId, blob);
    },
    async delete(assetId) {
      blobs.delete(assetId);
    },
    async clear() {
      blobs.clear();
    },
  };
}
