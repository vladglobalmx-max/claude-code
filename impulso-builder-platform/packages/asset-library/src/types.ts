import type { AssetId } from "@impulso/document-schema";

/**
 * Almacena/resuelve el BINARIO real de un Asset por su id — nunca su
 * descriptor (nombre, dimensiones, metadata: eso vive en `Document.assets`,
 * ver `@impulso/document-schema`). Deliberadamente genérico sobre CUALQUIER
 * tipo de Asset — una imagen, una fuente, una textura, un mockup — son
 * todos, en última instancia, un `Blob` identificado por su `AssetId`; este
 * store nunca necesita saber de qué tipo concreto es. Agregar un tipo de
 * Asset nuevo nunca requiere tocar esta interfaz (ver ADR de esta épica).
 */
export interface AssetBinaryStore {
  get(assetId: AssetId): Promise<Blob | undefined>;
  set(assetId: AssetId, blob: Blob): Promise<void>;
  delete(assetId: AssetId): Promise<void>;
  clear(): Promise<void>;
}
