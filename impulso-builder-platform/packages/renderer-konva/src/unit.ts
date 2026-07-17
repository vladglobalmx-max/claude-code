import type { Unit } from "@impulso/document-schema";

/**
 * Conversión de unidades físicas del Document Schema a píxeles de pantalla
 * para dimensionar el Konva.Stage. 96px/pulgada es el estándar de facto de
 * CSS/pantalla (no de impresión) — suficiente para edición en pantalla.
 * Una futura exportación de alta resolución necesitará su propio DPI
 * configurable (ver PERFORMANCE_BUDGET.md, fila 6); no se anticipa aquí.
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
