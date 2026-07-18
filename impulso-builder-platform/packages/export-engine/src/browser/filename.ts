import { ExportError } from "../errors.js";

/** Caracteres inválidos en Windows/macOS/Linux + caracteres de control. */
const ILLEGAL_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;
const MAX_LENGTH = 150;

/**
 * Sanitiza un nombre de archivo propuesto por el usuario: reemplaza
 * caracteres ilegales por `_` y acota la longitud — nunca deja pasar un
 * nombre vacío (antes o después de sanitizar), que es el único caso
 * verdaderamente irrecuperable (ver ADR-0012, "Casos de error").
 * No incluye la extensión (`.png`/`.svg`) — eso es responsabilidad del
 * caller, que sabe a qué formato se exportó.
 */
export function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ExportError("invalid_filename", "El nombre de archivo no puede estar vacío.");
  }
  // Sustituir (no descartar) caracteres ilegales garantiza que el
  // resultado nunca quede vacío a partir de un `trimmed` no vacío — no
  // hace falta un segundo chequeo de "vacío" después de sanitizar.
  return trimmed.replace(ILLEGAL_CHARS, "_").slice(0, MAX_LENGTH);
}
