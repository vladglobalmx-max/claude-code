import { toPixels } from "@impulso/document-schema";
import { pixelRatioForPpi } from "../units.js";
import type { PrintJob } from "../types.js";

/**
 * Geometría del raster de una página física (Epic 9 / Fase 9.2, sección 5
 * del enunciado, ver ADR-0022) — parte SIEMPRE de px canónico (el mismo
 * espacio que `SceneObject.transform`/`size`, ver ADR-0021) y aplica la
 * escala UNA sola vez, al final, vía `canonicalScale = targetPpi / 96`.
 *
 * Deliberadamente NUNCA encadena `px canónico → mm → px` — cada valor
 * físico (trim, cada lado del bleed) se convierte directamente de SU
 * PROPIA unidad a px canónico con `toPixels(valor, unidad)` (que ya sabe
 * hacerlo para cualquier unidad, sin pasar por una unidad intermedia
 * compartida) — evita acumular error de conversiones encadenadas.
 */
export interface CanonicalPageGeometry {
  /** `targetPpi / 96` — el factor que escala TODO el contenido, aplicado una sola vez. */
  canonicalScale: number;
  trimCanonicalWidth: number;
  trimCanonicalHeight: number;
  trimRasterWidth: number;
  trimRasterHeight: number;
  bleedCanonicalLeft: number;
  bleedCanonicalRight: number;
  bleedCanonicalTop: number;
  bleedCanonicalBottom: number;
  /** Tamaño total del canvas offscreen, en px canónico — TrimBox + bleed
   * por lado (equivalente al BleedBox de `boxes.ts`, pero en px canónico
   * en vez de la unidad física de `printJob.dimensions`). */
  canvasCanonicalWidth: number;
  canvasCanonicalHeight: number;
  /** `round(canvasCanonicalWidth/Height × canonicalScale)` — el tamaño
   * REAL del `HTMLCanvasElement` resultante. */
  canvasRasterWidth: number;
  canvasRasterHeight: number;
  /** Desplazamiento del contenido dentro del canvas, en px canónico — el
   * origen (0,0) del TrimBox cae en este punto (`bleedLeft`/`bleedTop`). */
  offsetCanonicalX: number;
  offsetCanonicalY: number;
}

export function computeCanonicalPageGeometry(printJob: PrintJob): CanonicalPageGeometry {
  const canonicalScale = pixelRatioForPpi(printJob.resolution.targetPpi);

  const trimCanonicalWidth = toPixels(printJob.dimensions.width, printJob.dimensions.unit);
  const trimCanonicalHeight = toPixels(printJob.dimensions.height, printJob.dimensions.unit);

  const bleedCanonicalLeft = toPixels(printJob.bleed.left, printJob.bleed.unit);
  const bleedCanonicalRight = toPixels(printJob.bleed.right, printJob.bleed.unit);
  const bleedCanonicalTop = toPixels(printJob.bleed.top, printJob.bleed.unit);
  const bleedCanonicalBottom = toPixels(printJob.bleed.bottom, printJob.bleed.unit);

  const canvasCanonicalWidth = bleedCanonicalLeft + trimCanonicalWidth + bleedCanonicalRight;
  const canvasCanonicalHeight = bleedCanonicalTop + trimCanonicalHeight + bleedCanonicalBottom;

  return {
    canonicalScale,
    trimCanonicalWidth,
    trimCanonicalHeight,
    trimRasterWidth: Math.round(trimCanonicalWidth * canonicalScale),
    trimRasterHeight: Math.round(trimCanonicalHeight * canonicalScale),
    bleedCanonicalLeft,
    bleedCanonicalRight,
    bleedCanonicalTop,
    bleedCanonicalBottom,
    canvasCanonicalWidth,
    canvasCanonicalHeight,
    canvasRasterWidth: Math.round(canvasCanonicalWidth * canonicalScale),
    canvasRasterHeight: Math.round(canvasCanonicalHeight * canonicalScale),
    offsetCanonicalX: bleedCanonicalLeft,
    offsetCanonicalY: bleedCanonicalTop,
  };
}
