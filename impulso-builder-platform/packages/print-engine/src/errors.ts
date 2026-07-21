import type { PreflightIssue } from "./preflight/types.js";

/**
 * Errores duros del pipeline de raster/exportación (Epic 9 / Fase 9.2, ver
 * ADR-0022) — nunca un fallo silencioso, ni un string libre que la UI
 * futura tenga que inspeccionar (sección 19 del enunciado). Nunca se
 * expone el stack interno al usuario: `message` ya es un texto accionable.
 */
/**
 * Fase 9.5 (hardening, error injection): 4 códigos que existían en esta
 * unión pero nunca se lanzaban desde ningún punto real del pipeline
 * (`invalid-print-job`, `font-unavailable`, `unsupported-output`,
 * `internal-cleanup-failed`) se eliminaron tras confirmarlo con una
 * búsqueda exhaustiva — código sin uso, nunca ejercitado por ningún test.
 * `font-unavailable` en particular era confuso: la falta de una fuente ya
 * se reporta como el `PreflightIssue` `font_unavailable` (advertencia, no
 * un error duro) — nunca fue, ni debía ser, un `PrintEngineError`.
 */
export type PrintEngineErrorCode =
  | "preflight-blocked"
  | "memory-budget-exceeded"
  | "asset-resolution-failed"
  | "render-failed"
  | "raster-encoding-failed"
  | "pdf-backend-failed"
  | "aborted"
  /** Fase 9.4 — `computeImpositionLayout` devolvió `ok: false` (la pieza no
   * cabe, la hoja/cantidad es inválida, etc.). DEFENSIVO: una vez que la
   * Preflight de imposición (sección 16) esté conectada, ese mismo caso ya
   * debería estar bloqueado antes de llegar al exportador. */
  | "imposition-does-not-fit";

export class PrintEngineError extends Error {
  readonly code: PrintEngineErrorCode;
  /** Presente solo para `code: "preflight-blocked"` — los issues que
   * bloquearon la exportación (severidad `error`), para que un caller
   * pueda mostrarlos sin tener que volver a correr Preflight. */
  readonly preflightIssues?: PreflightIssue[];

  constructor(code: PrintEngineErrorCode, message: string, options?: { preflightIssues?: PreflightIssue[]; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "PrintEngineError";
    this.code = code;
    this.preflightIssues = options?.preflightIssues;
  }
}

/** Lanza `PrintEngineError("aborted", ...)` si `signal` ya fue abortada —
 * el único punto de chequeo que toda etapa cancelable llama antes de
 * seguir (sección 16 del enunciado: 10 puntos de cancelación mínimos). */
export function throwIfAborted(signal: AbortSignal | undefined, stage: string): void {
  if (signal?.aborted) {
    throw new PrintEngineError("aborted", `Exportación cancelada (${stage}).`);
  }
}
