import type { Metadata } from "@impulso/document-schema";

export interface BuildElementMetadataOptions {
  now: string;
  /** Marcador semántico (`"die-line"`, `"wordmark"`, ...) — el mismo
   * vocabulario libre que ya usa `metadata.role` en todo el catálogo;
   * ver `THOREN_PILOT_TEMPLATE_STANDARD.md` §5. */
  role?: string;
  name?: string;
}

/**
 * Construye el `Metadata` que cada `SceneObject`/`Layer`/`Page`/`Document`
 * necesita — el mismo objeto literal `{tags:[], visible:true, locked:false,
 * createdAt, updatedAt}` que antes se repetía a mano en cada builder de
 * Project. `role`/`name` se omiten del objeto si no se pasan (en vez de
 * escribirlos como `undefined`), igual que el comportamiento manual previo.
 */
export function buildElementMetadata(options: BuildElementMetadataOptions): Metadata {
  const { now, role, name } = options;
  return {
    tags: [],
    visible: true,
    locked: false,
    createdAt: now,
    updatedAt: now,
    ...(role !== undefined ? { role } : {}),
    ...(name !== undefined ? { name } : {}),
  };
}
