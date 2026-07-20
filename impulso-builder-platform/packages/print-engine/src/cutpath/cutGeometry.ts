import type { ObjectId, PathSegment, Point, RectangleObject } from "@impulso/document-schema";
import {
  affineFromTransform,
  applyAffine,
  composeAncestorChain,
  decomposeSimilarity,
  isSimilarityTransform,
  pivotOf,
  type Affine2D,
} from "./affine.js";
import type { TraversedObject } from "./objectTraversal.js";

/** Rectangle de corte, ya en espacio GLOBAL de página (px canónico) — el
 * mismo modelo pivote/rotación que `SceneObject.transform` (esquina
 * superior izquierda, rota alrededor de ese punto). */
export interface RectangleCutGeometry {
  type: "rectangle";
  pivot: Point;
  width: number;
  height: number;
  rotationDegrees: number;
}

/** Ellipse de corte, ya en espacio GLOBAL — `center` es el centro real de
 * la elipse (no la esquina superior izquierda de su caja). */
export interface EllipseCutGeometry {
  type: "ellipse";
  center: Point;
  radiusX: number;
  radiusY: number;
  rotationDegrees: number;
}

/** Path cerrado de corte, ya en espacio GLOBAL — reutiliza `PathSegment`
 * de `@impulso/document-schema` (permite reutilizar
 * `segmentsToSvgPathData` sin transformar nada de nuevo al dibujar). El
 * cierre (`closed`) es siempre implícito: todo `ClosedPathCutGeometry`
 * representa una figura cerrada. */
export interface ClosedPathCutGeometry {
  type: "closed-path";
  segments: PathSegment[];
}

export type CutGeometry = RectangleCutGeometry | EllipseCutGeometry | ClosedPathCutGeometry;

export type CutGeometryFailureReason = "unsupported-object-type" | "open-path" | "transform-unsupported";

export type CutGeometryResult =
  | { ok: true; objectId: ObjectId; geometry: CutGeometry }
  | { ok: false; objectId: ObjectId; reason: CutGeometryFailureReason };

/** Transforma cada punto/control de un array de `PathSegment` por un
 * afín — utilidad reutilizada tanto para normalizar geometría de die-line
 * (este módulo) como para convertir un `ClosedPathCutGeometry` a espacio
 * de puntos PDF antes de dibujarlo (`pdf/pdfLibBackend.ts`). */
export function transformPathSegments(segments: readonly PathSegment[], affine: Affine2D): PathSegment[] {
  return segments.map((segment) => transformSegment(segment, affine));
}

function transformSegment(segment: PathSegment, affine: Affine2D): PathSegment {
  switch (segment.type) {
    case "moveTo":
      return { type: "moveTo", point: applyAffine(affine, segment.point) };
    case "lineTo":
      return { type: "lineTo", point: applyAffine(affine, segment.point) };
    case "quadraticCurveTo":
      return { type: "quadraticCurveTo", control: applyAffine(affine, segment.control), point: applyAffine(affine, segment.point) };
    case "cubicCurveTo":
      return {
        type: "cubicCurveTo",
        control1: applyAffine(affine, segment.control1),
        control2: applyAffine(affine, segment.control2),
        point: applyAffine(affine, segment.point),
      };
    case "close":
      return { type: "close" };
  }
}

/** Un Rectangle bajo un afín con shear real (sección 13) se representa
 * EXACTO como sus 4 esquinas transformadas — nunca se aproxima a un
 * rectángulo/caja envolvente. */
function rectangleAsClosedPath(object: RectangleObject, affine: Affine2D): ClosedPathCutGeometry {
  const { width, height } = object.size;
  const localCorners: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const [p0, p1, p2, p3] = localCorners.map((corner) => applyAffine(affine, corner)) as [Point, Point, Point, Point];
  return {
    type: "closed-path",
    segments: [
      { type: "moveTo", point: p0 },
      { type: "lineTo", point: p1 },
      { type: "lineTo", point: p2 },
      { type: "lineTo", point: p3 },
      { type: "close" },
    ],
  };
}

/**
 * Normaliza un object de die-line ya localizado (`TraversedObject`) a un
 * `CutGeometry` puro en espacio global (Fase 9.3, sección 12) — compone
 * el afín completo (ancestros + el propio object) y decide, según el
 * tipo, si puede representarse exacto:
 *
 * - **Rectangle**: exacto vía `RectangleCutGeometry` si la composición es
 *   una similitud (sin shear); si no, exacto vía `ClosedPathCutGeometry`
 *   (4 esquinas transformadas) — nunca se aproxima.
 * - **Ellipse**: exacto vía `EllipseCutGeometry` SOLO si es una
 *   similitud — bajo shear real, se bloquea (`transform-unsupported`) en
 *   vez de aproximar (la imagen de una elipse bajo un afín con shear
 *   sigue siendo una elipse, pero su cálculo exacto queda fuera del
 *   alcance de V1; ver ADR de Cut Paths).
 * - **Path cerrado**: exacto vía `ClosedPathCutGeometry` siempre (cada
 *   punto/control se transforma individualmente, sin depender de que la
 *   composición sea una similitud).
 * - **Path abierto**: `open-path` — un cut path debe ser una figura
 *   cerrada.
 * - **Cualquier otro tipo** (Text/Image/Group): `unsupported-object-type`.
 */
export function normalizeCutGeometry(traversed: TraversedObject): CutGeometryResult {
  const { object, ancestorChain } = traversed;
  const ownAffine = affineFromTransform(object.transform, pivotOf(object));
  const globalAffine = composeAncestorChain([...ancestorChain, ownAffine]);

  if (object.type === "rectangle") {
    if (isSimilarityTransform(globalAffine)) {
      const { scale, rotationDegrees } = decomposeSimilarity(globalAffine);
      return {
        ok: true,
        objectId: object.id,
        geometry: {
          type: "rectangle",
          pivot: { x: globalAffine.tx, y: globalAffine.ty },
          width: object.size.width * scale,
          height: object.size.height * scale,
          rotationDegrees,
        },
      };
    }
    return { ok: true, objectId: object.id, geometry: rectangleAsClosedPath(object, globalAffine) };
  }

  if (object.type === "ellipse") {
    if (!isSimilarityTransform(globalAffine)) {
      return { ok: false, objectId: object.id, reason: "transform-unsupported" };
    }
    const { scale, rotationDegrees } = decomposeSimilarity(globalAffine);
    return {
      ok: true,
      objectId: object.id,
      geometry: {
        type: "ellipse",
        center: { x: globalAffine.tx, y: globalAffine.ty },
        radiusX: (object.size.width / 2) * scale,
        radiusY: (object.size.height / 2) * scale,
        rotationDegrees,
      },
    };
  }

  if (object.type === "path") {
    if (!object.closed) {
      return { ok: false, objectId: object.id, reason: "open-path" };
    }
    return {
      ok: true,
      objectId: object.id,
      geometry: { type: "closed-path", segments: object.segments.map((segment) => transformSegment(segment, globalAffine)) },
    };
  }

  return { ok: false, objectId: object.id, reason: "unsupported-object-type" };
}
