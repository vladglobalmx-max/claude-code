/**
 * THÖREN 0078 — sanitización de nombres de archivo PDF. Cada segmento
 * dinámico (folio, nombre de vendedor, etc.) pasa por aquí antes de entrar
 * en un `Content-Disposition` — nunca se interpola texto crudo del
 * usuario/base de datos directo en el header de descarga.
 */
export function sanitizeFilenameSegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // acentos
    .replace(/[^A-Za-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Une segmentos ya-o-no sanitizados con "-" y agrega la extensión .pdf. */
export function buildPdfFilename(parts: string[]): string {
  const safeParts = parts.map(sanitizeFilenameSegment).filter(Boolean);
  return `${safeParts.length > 0 ? safeParts.join("-") : "documento"}.pdf`;
}
