/**
 * Errores duros: la exportación NO puede continuar (a diferencia de
 * `ExportWarning`, que es degradación controlada — ver types.ts). Nunca un
 * fallo silencioso: cada código tiene un mensaje accionable para el
 * usuario (ver ADR-0012, "Casos de error").
 */
export type ExportErrorCode =
  | "no_active_page"
  | "invalid_filename"
  | "out_of_memory"
  | "download_failed";

export class ExportError extends Error {
  readonly code: ExportErrorCode;

  constructor(code: ExportErrorCode, message: string) {
    super(message);
    this.name = "ExportError";
    this.code = code;
  }
}
