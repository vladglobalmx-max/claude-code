import type Konva from "konva";
import type { AssetId, ObjectId, PageId } from "@impulso/document-schema";
import type { Engine } from "@impulso/engine";

/** Lo que cada nodo Konva necesita del mundo exterior: cómo avisarle al Engine de un cambio. */
export interface NodeContext {
  dispatch: Engine["dispatch"];
  resolveAssetSource?: (assetId: AssetId) => CanvasImageSource | undefined;
  /** Se invoca cuando un cambio que Konva ya aplicó visualmente (ej. un
   * drag) fue rechazado por el Engine — para que quien orquesta el render
   * pueda revertir la vista al estado canónico. */
  onRejectedTransform?: () => void;
  /** Lectura de la selección actual — usada por `transformInteractions` para
   * decidir si arrastrar un object debe además seleccionarlo (ver
   * ADR-0007). Opcional y aditivo: `createSceneNode` es parte de la API
   * pública (ver index.ts) y un caller externo que construya su propio
   * `NodeContext` a mano no está obligado a proveerla — sin ella, arrastrar
   * simplemente siempre reemplaza la selección por el object arrastrado. */
  getSelection?: () => readonly ObjectId[];
}

export interface KonvaRendererOptions {
  /** Qué Page renderizar. Por defecto, la primera del Document. No hay API
   * para cambiarla dinámicamente todavía (ver README, "Compatibilidad futura"). */
  pageId?: PageId;
  /** Resuelve el recurso real de una Image a partir de su Asset — sin esto,
   * las Image se dibujan como placeholder (ver nodes/image.ts). Foundation 3
   * no incluye gestión de Assets; este es el punto de extensión para cuando
   * exista. */
  resolveAssetSource?: (assetId: AssetId) => CanvasImageSource | undefined;
}

/** El contrato que cualquier adaptador de render debe cumplir (ver ADR-0001). */
export interface RendererAdapter {
  mount(container: HTMLDivElement): void;
  destroy(): void;
  /** Acceso de solo lectura al Stage real, útil para inspección/tests
   * avanzados — expuesto a propósito: este paquete ES el adaptador Konva,
   * no tiene sentido esconder Konva de quien lo importa explícitamente. */
  getStage(): Konva.Stage | null;
}
