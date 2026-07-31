/** Escapa texto para insertarlo con seguridad como contenido de un elemento XML/SVG. */
export function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escapa un valor para insertarlo con seguridad dentro de un atributo `"..."` de XML/SVG. */
export function escapeXmlAttr(value: string): string {
  return escapeXmlText(value).replace(/"/g, "&quot;");
}
