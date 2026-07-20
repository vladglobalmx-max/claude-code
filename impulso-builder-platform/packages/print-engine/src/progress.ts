/**
 * Progreso por ETAPAS (sección 17 del enunciado) — nunca un porcentaje
 * inventado ni un evento por object. `pageIndex`/`pageCount` están
 * presentes en las etapas que son por-página; ausentes en las globales
 * (`validating`/`finalizing`/`completed`).
 */
export type PrintExportStage =
  | "validating"
  | "preparing-assets"
  | "rendering-page"
  | "encoding-page"
  | "assembling-pdf"
  | "finalizing"
  | "completed";

export interface PrintExportProgressEvent {
  stage: PrintExportStage;
  pageIndex?: number;
  pageCount?: number;
  message?: string;
}

export type PrintExportProgressCallback = (event: PrintExportProgressEvent) => void;

/**
 * Invoca `onProgress` protegiendo al pipeline de un callback que lanza —
 * un error de la UI en su callback de progreso nunca debe corromper ni
 * abortar una exportación que por lo demás iba bien (sección 17: "errores
 * dentro del callback de progreso no deben corromper la exportación").
 * Se traga el error deliberadamente: no hay ningún canal seguro para
 * reportarlo sin arriesgar un loop (reportar un error de progreso... vía
 * progreso) — es responsabilidad exclusiva del caller no lanzar aquí.
 */
export function emitProgress(onProgress: PrintExportProgressCallback | undefined, event: PrintExportProgressEvent): void {
  if (!onProgress) return;
  try {
    onProgress(event);
  } catch {
    // Deliberado — ver comentario de la función.
  }
}
