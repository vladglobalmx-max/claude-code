import { toPixels } from "@impulso/document-schema";

/**
 * `toPixels` vive en `@impulso/document-schema` desde Epic 3 (antes vivía
 * aquí) — el Export Engine necesita exactamente la misma conversión para
 * calcular las dimensiones finales de un documento, y ambos consumidores
 * deben compartir la misma constante de DPI en vez de arriesgarse a que
 * diverjan (ver ADR-0012). Se reexporta desde aquí para no romper a quien
 * ya la importaba de `@impulso/renderer-konva`.
 */
export { toPixels };
