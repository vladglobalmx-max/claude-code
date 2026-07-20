import type { ObjectId, PageId } from "@impulso/document-schema";

export type PreflightSeverity = "error" | "warning" | "info";

/**
 * Códigos de Fase 9.1 (estructural) — deliberadamente NO incluye
 * `cut_path_invalid`/`cut_path_open` (Fase 9.3), `safe_area_invasion`
 * (Fase 9.3), `background_not_covering_bleed` (Fase 9.3, depende del
 * pipeline de render), `transparency_unsupported` (Fase 9.2, depende del
 * backend PDF), ni `imposition_does_not_fit` (Fase 9.4) — cada uno se
 * agrega en su propia fase, sobre esta misma estructura de `PreflightIssue`.
 */
export type PreflightCode =
  | "document_not_normalized"
  | "page_not_found"
  | "invalid_dimensions"
  | "invalid_bleed"
  | "empty_page"
  | "extreme_scale"
  | "raster_too_large"
  | "asset_reference_missing"
  | "asset_binary_missing"
  | "resolution_insufficient"
  | "resolution_borderline"
  | "font_unavailable"
  | "font_verification_uncertain";

export interface PreflightIssue {
  code: PreflightCode;
  severity: PreflightSeverity;
  message: string;
  pageId?: PageId;
  objectId?: ObjectId;
  /** Datos adicionales para localizar/graficar el problema en un preview
   * (ej. la posición del object, el PPI efectivo calculado) — nunca
   * información sensible, siempre serializable. */
  data?: Record<string, unknown>;
  recommendation?: string;
}

export interface PreflightResult {
  issues: PreflightIssue[];
  /** `true` si hay al menos un issue con `severity: "error"` — la UI usa
   * este único booleano para decidir si "Exportar" está bloqueado o si
   * solo puede ofrecer "Exportar de todos modos" (nunca disponible si esto
   * es `true`: un error real nunca es sorteable, sección 13). */
  hasBlockingErrors: boolean;
}
