/**
 * Los errores de dominio del Engine son datos, no excepciones: `dispatch()`
 * nunca lanza para un fallo esperado (comando mal formado, entidad no
 * encontrada, actualización inválida) — siempre devuelve un
 * `{ ok: false, error }`. Lanzar excepciones para control de flujo esperado
 * obligaría a todo consumidor (la futura UI) a envolver cada `dispatch` en
 * try/catch; un Result explícito es una API más limpia para algo que se
 * llama en cada interacción del usuario.
 *
 * La única excepción real es `createEngine()`: si el Project inicial no es
 * válido, SÍ lanza (falla rápido en la construcción, igual que
 * `ProjectSchema.parse` en Foundation 1).
 */
export type EngineErrorCode =
  | "invalid_command"
  | "page_not_found"
  | "layer_not_found"
  | "object_not_found"
  | "invalid_metadata"
  | "invalid_style"
  | "invalid_transform"
  | "invalid_content"
  | "invalid_text_style"
  | "invalid_group"
  | "invalid_reorder"
  | "invalid_grid"
  | "asset_not_found"
  | "duplicate_asset_id"
  | "cannot_remove_last_page"
  | "invariant_violation"
  | "nothing_to_undo"
  | "nothing_to_redo";

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
}

export function engineError(code: EngineErrorCode, message: string): EngineError {
  return { code, message };
}

export type EngineResult<T> = { ok: true; value: T } | { ok: false; error: EngineError };

export function ok<T>(value: T): EngineResult<T> {
  return { ok: true, value };
}

export function err<T>(error: EngineError): EngineResult<T> {
  return { ok: false, error };
}
