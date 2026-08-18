const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\x00-\x1f]/g;

/** Quita caracteres inválidos para nombre de archivo en Windows/macOS/Linux y colapsa espacios. */
export function sanitizeFilenamePart(value: string): string {
  return value
    .replace(INVALID_FILENAME_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nombre sugerido para "Guardar como PDF" de una Quote: "{FOLIO} - {CLIENTE}"
 * (ej. "VPT-20261608-001 - Posco MPPC"). Se usa como document.title de la
 * página de impresión — el navegador lo propone como nombre de archivo al
 * imprimir/guardar, sin que la app genere ningún PDF por su cuenta.
 */
export function buildQuotePdfFilename(folio: string, customerName: string): string {
  const parts = [sanitizeFilenamePart(folio), sanitizeFilenamePart(customerName)].filter(Boolean);
  return parts.join(" - ") || "THÖREN";
}
