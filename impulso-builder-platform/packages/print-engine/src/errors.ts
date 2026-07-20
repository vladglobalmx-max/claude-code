import type { PreflightIssue } from "./preflight/types.js";

/**
 * Errores duros del pipeline de raster/exportación (Epic 9 / Fase 9.2, ver
 * ADR-0022) — nunca un fallo silencioso, ni un string libre que la UI
 * futura tenga que inspeccionar (sección 19 del enunciado). Nunca se
 * expone el stack interno al usuario: `message` ya es un texto accionable.
 */
export type PrintEngineErrorCode =
  | "invalid-print-job"
  | "preflight-blocked"
  | "memory-budget-exceeded"
  | "asset-resolution-failed"
  | "font-unavailable"
  | "render-failed"
  | "raster-encoding-failed"
  | "pdf-backend-failed"
  | "aborted"
  | "unsupported-output"
  | "internal-cleanup-failed";

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
