import type { PathSegment, Point } from "@impulso/document-schema";
import { physicalToPixels } from "../units.js";
import type { CropMarkSegment } from "../marks/cropMarksGeometry.js";

/** Una marca de corte ya en píxeles de RASTER (a `targetPpi`) — lista para
 * dibujarse directamente sobre un `CanvasRenderingContext2D`. */
export interface RasterLineSegment {
  from: Point;
  to: Point;
  strokeWidthPx: number;
  color: string;
}

/** Convierte UN `CropMarkSegment` (espacio físico de `boxes.ts`, origen
 * en la esquina superior izquierda del MediaBox) a píxeles de raster a
 * `targetPpi` — nunca canónico (96dpi), es directamente la resolución de
 * impresión final (ver `units.ts`, distinción 1 vs 3). */
export function cropMarkSegmentToRaster(segment: CropMarkSegment, targetPpi: number): RasterLineSegment {
  const toRasterPoint = (point: Point): Point => ({
    x: physicalToPixels(point.x, segment.unit, targetPpi),
    y: physicalToPixels(point.y, segment.unit, targetPpi),
  });
  return {
    from: toRasterPoint(segment.from),
    to: toRasterPoint(segment.to),
    strokeWidthPx: physicalToPixels(segment.strokeWidth, segment.unit, targetPpi),
    color: segment.color,
  };
}

/**
 * Convierte UN punto en px CANÓNICO (espacio de `SceneObject.transform`,
 * relativo al origen del TrimBox de la página) a píxeles de raster DENTRO
 * del canvas de MEDIA completo — compone dos desplazamientos: el del
 * TrimBox dentro del BleedBox ya rasterizado (`contentOffsetCanonical ×
 * canonicalScale`, la MISMA matemática que ya usa `renderPrintPage`/
 * `renderer-konva` internamente para el contenido) y el del BleedBox
 * dentro del MediaBox (`bleedOffsetRasterPx`, Fase 9.3).
 */
export function canonicalPointToRasterPoint(
  point: Point,
  canonicalScale: number,
  contentOffsetCanonical: Point,
  bleedOffsetRasterPx: Point,
): Point {
  return {
    x: bleedOffsetRasterPx.x + (contentOffsetCanonical.x + point.x) * canonicalScale,
    y: bleedOffsetRasterPx.y + (contentOffsetCanonical.y + point.y) * canonicalScale,
  };
}

/** Convierte cada punto/control de un `PathSegment[]` de un `CutGeometry`
 * ya normalizado (px canónico) a píxeles de raster dentro del canvas de
 * MEDIA completo. */
export function cutPathSegmentsToRaster(
  segments: readonly PathSegment[],
  canonicalScale: number,
  contentOffsetCanonical: Point,
  bleedOffsetRasterPx: Point,
): PathSegment[] {
  const convert = (point: Point) => canonicalPointToRasterPoint(point, canonicalScale, contentOffsetCanonical, bleedOffsetRasterPx);
  return segments.map((segment): PathSegment => {
    switch (segment.type) {
      case "moveTo":
        return { type: "moveTo", point: convert(segment.point) };
      case "lineTo":
        return { type: "lineTo", point: convert(segment.point) };
      case "quadraticCurveTo":
        return { type: "quadraticCurveTo", control: convert(segment.control), point: convert(segment.point) };
      case "cubicCurveTo":
        return { type: "cubicCurveTo", control1: convert(segment.control1), control2: convert(segment.control2), point: convert(segment.point) };
      case "close":
        return { type: "close" };
    }
  });
}
