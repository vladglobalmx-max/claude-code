import type { ObjectId, PageId } from "@impulso/document-schema";

export type PreflightSeverity = "error" | "warning" | "info";

/**
 * Códigos de Fase 9.1 (estructural) + Fase 9.3 (marcas de corte, safe
 * area, cut paths — ver ADR-0023) + Fase 9.4 (imposición — ver
 * `preflight/impositionChecks.ts`). Deliberadamente NO incluye
 * `background_not_covering_bleed` (depende del pipeline de render, no
 * decidido todavía) — se agrega en su propia fase, sobre esta misma
 * estructura de `PreflightIssue`.
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
  | "font_verification_uncertain"
  // Crop marks (Fase 9.3, sección 20).
  | "crop_marks_invalid"
  | "crop_marks_outside_media_box"
  | "crop_marks_overlap_trim"
  | "insufficient_mark_space"
  // Safe area (Fase 9.3, sección 20).
  | "safe_area_invalid"
  | "object_crosses_safe_area"
  // Cut paths (Fase 9.3, sección 20).
  | "cut_path_missing"
  | "cut_path_multiple_candidates"
  | "cut_path_unsupported_object"
  | "cut_path_open"
  | "cut_path_invalid_geometry"
  | "cut_path_offset_unsupported"
  | "cut_path_collapsed"
  | "cut_path_outside_media_box"
  | "cut_path_transform_unsupported"
  // Imposición (Fase 9.4, sección 16, ver ADR de imposición).
  | "imposition_invalid"
  | "sheet_size_invalid"
  | "sheet_area_collapsed"
  | "quantity_invalid"
  | "grid_rows_invalid"
  | "grid_columns_invalid"
  | "piece_does_not_fit"
  | "fixed_grid_does_not_fit"
  | "insufficient_gap"
  | "excessive_sheet_count"
  | "excessive_piece_count"
  | "sheet_memory_budget_exceeded"
  | "cut_paths_overlap"
  | "crop_marks_overlap"
  | "piece_outside_sheet"
  | "partial_output_required";

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
