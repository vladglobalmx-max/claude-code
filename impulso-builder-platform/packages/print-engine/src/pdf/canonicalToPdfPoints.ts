import type { PathSegment, Point } from "@impulso/document-schema";
import { unitToPoints } from "../units.js";
import type { CropMarkSegment } from "../marks/cropMarksGeometry.js";
import type { PdfBoxPt, PdfLineOverlay, PdfPointPt } from "./pdfBackend.js";

/**
 * Convierte UN `CropMarkSegment` (espacio físico de `boxes.ts`, origen en
 * la esquina superior izquierda del MediaBox, `y` crece hacia ABAJO) a un
 * `PdfLineOverlay` en puntos PDF (origen inferior-izquierda, `y` crece
 * hacia ARRIBA) — el mismo flip que ya usa `pdf/pageBoxes.ts` para
 * `bleedBottomPt`, aplicado ahora punto a punto en vez de solo a un
 * offset agregado.
 */
export function cropMarkSegmentToPdf(segment: CropMarkSegment, mediaHeightPt: number): PdfLineOverlay {
  const toPdfPoint = (point: Point): PdfPointPt => ({
    x: unitToPoints(point.x, segment.unit),
    y: mediaHeightPt - unitToPoints(point.y, segment.unit),
  });
  return {
    from: toPdfPoint(segment.from),
    to: toPdfPoint(segment.to),
    strokeWidthPt: unitToPoints(segment.strokeWidth, segment.unit),
    colorHex: segment.color,
  };
}

/**
 * Convierte UN punto en px CANÓNICO (el espacio de `SceneObject.transform`
 * — origen en la esquina superior izquierda del TrimBox de la página,
 * `y` crece hacia abajo, el mismo espacio que ya usa `cutGeometry.ts`) a
 * puntos PDF, usando el `TrimBox` (ya en puntos PDF, `pdf/pageBoxes.ts`)
 * como referencia de dónde cae el origen canónico dentro de la página
 * completa. `unitToPoints(valor, "px")` trata "px" como el mismo px
 * CSS-96-DPI canónico que usa esta conversión — nunca los píxeles de
 * raster a `targetPpi` (ver `units.ts`, distinción 1 vs 3).
 */
export function canonicalPointToPdfPoint(point: Point, trimBoxPt: PdfBoxPt): PdfPointPt {
  return {
    x: trimBoxPt.x + unitToPoints(point.x, "px"),
    y: trimBoxPt.y + trimBoxPt.height - unitToPoints(point.y, "px"),
  };
}

/** Convierte cada punto/control de un `PathSegment[]` de un `CutGeometry`
 * ya normalizado (px canónico) a puntos PDF. */
export function cutPathSegmentsToPdf(segments: readonly PathSegment[], trimBoxPt: PdfBoxPt): PathSegment[] {
  return segments.map((segment): PathSegment => {
    switch (segment.type) {
      case "moveTo":
        return { type: "moveTo", point: canonicalPointToPdfPoint(segment.point, trimBoxPt) };
      case "lineTo":
        return { type: "lineTo", point: canonicalPointToPdfPoint(segment.point, trimBoxPt) };
      case "quadraticCurveTo":
        return {
          type: "quadraticCurveTo",
          control: canonicalPointToPdfPoint(segment.control, trimBoxPt),
          point: canonicalPointToPdfPoint(segment.point, trimBoxPt),
        };
      case "cubicCurveTo":
        return {
          type: "cubicCurveTo",
          control1: canonicalPointToPdfPoint(segment.control1, trimBoxPt),
          control2: canonicalPointToPdfPoint(segment.control2, trimBoxPt),
          point: canonicalPointToPdfPoint(segment.point, trimBoxPt),
        };
      case "close":
        return { type: "close" };
    }
  });
}
