import type { PathSegment, Point } from "@impulso/document-schema";
import { affineFromTransform, applyAffine } from "./affine.js";
import type { CutGeometry } from "./cutGeometry.js";

/** Constante estándar para aproximar un cuarto de elipse con una curva
 * cúbica de Bézier (el mismo valor que usan SVG/Illustrator/Figma para
 * dibujar círculos y elipses con beziers — error imperceptible, no una
 * aproximación improvisada). */
const BEZIER_ELLIPSE_KAPPA = 0.5522847498307936;

function rectangleToSegments(pivot: Point, width: number, height: number, rotationDegrees: number): PathSegment[] {
  const affine = affineFromTransform({ x: pivot.x, y: pivot.y, rotation: rotationDegrees, scaleX: 1, scaleY: 1 }, pivot);
  const g = (p: Point) => applyAffine(affine, p);
  return [
    { type: "moveTo", point: g({ x: 0, y: 0 }) },
    { type: "lineTo", point: g({ x: width, y: 0 }) },
    { type: "lineTo", point: g({ x: width, y: height }) },
    { type: "lineTo", point: g({ x: 0, y: height }) },
    { type: "close" },
  ];
}

function ellipseToSegments(center: Point, radiusX: number, radiusY: number, rotationDegrees: number): PathSegment[] {
  const affine = affineFromTransform({ x: center.x, y: center.y, rotation: rotationDegrees, scaleX: 1, scaleY: 1 }, center);
  const g = (p: Point) => applyAffine(affine, p);
  const ox = radiusX * BEZIER_ELLIPSE_KAPPA;
  const oy = radiusY * BEZIER_ELLIPSE_KAPPA;
  const top = { x: 0, y: -radiusY };
  const right = { x: radiusX, y: 0 };
  const bottom = { x: 0, y: radiusY };
  const left = { x: -radiusX, y: 0 };
  return [
    { type: "moveTo", point: g(top) },
    { type: "cubicCurveTo", control1: g({ x: ox, y: -radiusY }), control2: g({ x: radiusX, y: -oy }), point: g(right) },
    { type: "cubicCurveTo", control1: g({ x: radiusX, y: oy }), control2: g({ x: ox, y: radiusY }), point: g(bottom) },
    { type: "cubicCurveTo", control1: g({ x: -ox, y: radiusY }), control2: g({ x: -radiusX, y: oy }), point: g(left) },
    { type: "cubicCurveTo", control1: g({ x: -radiusX, y: -oy }), control2: g({ x: -ox, y: -radiusY }), point: g(top) },
    { type: "close" },
  ];
}

/**
 * Convierte cualquier `CutGeometry` (Rectangle/Ellipse/ClosedPath) a un
 * `PathSegment[]` uniforme — el único punto de conversión que necesita el
 * backend PDF (que dibuja todo vía `drawSvgPath`, reutilizando
 * `segmentsToSvgPathData` de `@impulso/document-schema`) para no tener
 * que exponer 3 primitivas de dibujo distintas (sección 6: "no convertir
 * `PdfBackend` en una API gráfica general"). El compositor de PNG, en
 * cambio, puede seguir dibujando Rectangle/Ellipse nativamente con
 * `CanvasRenderingContext2D` (más preciso, sin esta aproximación) — esta
 * función es exclusiva del camino PDF.
 */
export function cutGeometryToPathSegments(geometry: CutGeometry): PathSegment[] {
  if (geometry.type === "closed-path") return geometry.segments;
  if (geometry.type === "rectangle") return rectangleToSegments(geometry.pivot, geometry.width, geometry.height, geometry.rotationDegrees);
  return ellipseToSegments(geometry.center, geometry.radiusX, geometry.radiusY, geometry.rotationDegrees);
}
