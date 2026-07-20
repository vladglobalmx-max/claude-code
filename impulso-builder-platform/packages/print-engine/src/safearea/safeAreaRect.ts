import { toPixels } from "@impulso/document-schema";
import type { PrintJob } from "../types.js";

/** Rectángulo de Safe Area en px CANÓNICO (el mismo espacio que
 * `SceneObject.transform` — origen en la esquina superior izquierda del
 * TrimBox de la página, nunca el espacio físico de `boxes.ts`/MediaBox).
 * Convertido directamente desde `PrintJob.dimensions`/`safeArea` vía
 * `toPixels` — nunca encadenado a través de `computeBoxes` (misma regla
 * de Fase 9.2, sección 5: evitar conversiones intermedias que acumulen
 * error). */
export interface SafeAreaCanonicalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * `undefined` si `safeArea.enabled` es `false` — nunca un rectángulo de
 * tamaño cero disfrazado de "habilitado" (Fase 9.3, sección 8).
 */
export function computeSafeAreaCanonicalRect(printJob: PrintJob): SafeAreaCanonicalRect | undefined {
  if (!printJob.safeArea.enabled) return undefined;

  const trimWidthPx = toPixels(printJob.dimensions.width, printJob.dimensions.unit);
  const trimHeightPx = toPixels(printJob.dimensions.height, printJob.dimensions.unit);
  const marginPx = toPixels(printJob.safeArea.margin, printJob.safeArea.unit);

  return {
    x: marginPx,
    y: marginPx,
    width: Math.max(0, trimWidthPx - 2 * marginPx),
    height: Math.max(0, trimHeightPx - 2 * marginPx),
  };
}
