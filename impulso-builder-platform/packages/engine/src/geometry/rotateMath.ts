import type { Transform } from "@impulso/document-schema";

/** A cuántos grados se redondea la rotación cuando se pide "snap" (ej. Shift presionado). */
export const ROTATION_SNAP_INCREMENT_DEGREES = 15;

export interface RotateGestureInput {
  /** Ángulo deseado, en grados. El Renderer lo calcula (atan2 del puntero
   * respecto al centro del object) — es geometría de coordenadas, el
   * mismo tipo de traducción que ya hace `coordinates.ts` en el Renderer,
   * no una decisión de negocio. Puede venir fuera de [0, 360). */
  pointerAngleDegrees: number;
  /** Restricción: redondear al incremento de 15° más cercano. */
  snapToIncrement?: boolean;
}

function normalizeAngle(angle: number): number {
  // El doble módulo evita el caso límite de `-0` que produce `angle % 360`
  // cuando `angle` es un múltiplo negativo exacto de 360 (ej. -360 % 360 === -0).
  return ((angle % 360) + 360) % 360;
}

/**
 * Función pura: del ángulo crudo del puntero a un `Partial<Transform>`
 * listo para fusionar. La única "lógica" real aquí es la restricción de
 * snapping — normalizar el rango es solo aritmética modular.
 */
export function computeRotatedTransform(input: RotateGestureInput): Partial<Transform> {
  let rotation = normalizeAngle(input.pointerAngleDegrees);
  if (input.snapToIncrement) {
    rotation = normalizeAngle(Math.round(rotation / ROTATION_SNAP_INCREMENT_DEGREES) * ROTATION_SNAP_INCREMENT_DEGREES);
  }
  return { rotation };
}
