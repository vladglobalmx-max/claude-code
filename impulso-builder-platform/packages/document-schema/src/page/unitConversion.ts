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
