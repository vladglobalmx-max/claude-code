import type { Unit } from "./page.js";

/**
 * Conversión de unidades físicas de `Page.unit` a píxeles. Nace en
 * `@impulso/document-schema` (no en `@impulso/renderer-konva`, donde vivía
 * originalmente hasta Epic 3) porque el Export Engine necesita exactamente
 * la misma conversión que el Renderer para calcular las dimensiones
 * finales de un documento — ambos consumidores comparten la misma
 * constante de DPI, en vez de arriesgarse a que diverjan si alguno cambia
 * la suya por separado (ver ADR-0012). 96px/pulgada es el estándar de
 * facto de CSS/pantalla (no de impresión) — suficiente para edición y
 * exportación en pantalla; ver Riesgos en ambos READMEs sobre DPI de
 * impresión real.
 */
const PIXELS_PER_INCH = 96;
const MM_PER_INCH = 25.4;

export function toPixels(value: number, unit: Unit): number {
  switch (unit) {
    case "px":
      return value;
    case "in":
      return value * PIXELS_PER_INCH;
    case "mm":
      return value * (PIXELS_PER_INCH / MM_PER_INCH);
  }
}

/**
 * Inversa de `toPixels`: de la unidad canónica interna (px — el mismo
 * espacio numérico que usan `Transform.x/y` y los `size` de Object,
 * independientemente de `Page.unit`) a la unidad activa del documento.
 * Necesaria para que el Inspector (Epic 7 / Fase 7.1) muestre X/Y/Ancho/Alto
 * en `page.unit` sin acumular error de redondeo: cada valor se convierte
 * una sola vez al mostrarlo y una sola vez al confirmarlo, nunca en cadena.
 */
export function fromPixels(pixels: number, unit: Unit): number {
  switch (unit) {
    case "px":
      return pixels;
    case "in":
      return pixels / PIXELS_PER_INCH;
    case "mm":
      return pixels / (PIXELS_PER_INCH / MM_PER_INCH);
  }
}
