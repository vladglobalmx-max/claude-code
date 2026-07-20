import { toPixels, type Page, type PageId, type Point } from "@impulso/document-schema";
import { computeBoxes } from "../boxes.js";
import { computeCanonicalPageGeometry } from "../raster/coordinates.js";
import { resolveDieLineSource } from "../cutpath/dieLineDetection.js";
import { normalizeCutGeometry } from "../cutpath/cutGeometry.js";
import { applyCutGeometryOffset } from "../cutpath/cutGeometryOffset.js";
import { cutGeometryToPathSegments } from "../cutpath/cutGeometryToSegments.js";
import type { CutGeometry } from "../cutpath/cutGeometry.js";
import type { PrintJob } from "../types.js";
import type { PreflightIssue } from "./types.js";

/** Puntos de un `PathSegment[]` ya normalizado — usado solo para calcular
 * un bounding box de verificación, nunca para dibujar. */
function pointsOf(geometry: CutGeometry): Point[] {
  const segments = cutGeometryToPathSegments(geometry);
  const points: Point[] = [];
  for (const segment of segments) {
    if (segment.type === "close") continue;
    points.push(segment.point);
    if (segment.type === "quadraticCurveTo") points.push(segment.control);
    if (segment.type === "cubicCurveTo") points.push(segment.control1, segment.control2);
  }
  return points;
}

/** Límites del MediaBox en px CANÓNICO, relativos al origen del TrimBox de
 * la página (el mismo espacio donde vive un `CutGeometry` ya normalizado)
 * — compone el bleed (ya canónico, `computeCanonicalPageGeometry`) más el
 * espacio de marcas (físico, convertido a canónico vía `toPixels`). */
function computeMediaCanonicalBounds(printJob: PrintJob): { minX: number; minY: number; maxX: number; maxY: number } {
  const physicalBoxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, printJob.cropMarks);
  const canonicalGeometry = computeCanonicalPageGeometry(printJob);

  const markLeftPx = toPixels(physicalBoxes.bleedOffsetWithinMedia.x, physicalBoxes.trim.unit);
  const markTopPx = toPixels(physicalBoxes.bleedOffsetWithinMedia.y, physicalBoxes.trim.unit);
  const markRightPhysical = physicalBoxes.media.width - physicalBoxes.bleed.width - physicalBoxes.bleedOffsetWithinMedia.x;
  const markBottomPhysical = physicalBoxes.media.height - physicalBoxes.bleed.height - physicalBoxes.bleedOffsetWithinMedia.y;
  const markRightPx = toPixels(markRightPhysical, physicalBoxes.trim.unit);
  const markBottomPx = toPixels(markBottomPhysical, physicalBoxes.trim.unit);

  return {
    minX: -(canonicalGeometry.bleedCanonicalLeft + markLeftPx),
    minY: -(canonicalGeometry.bleedCanonicalTop + markTopPx),
    maxX: canonicalGeometry.trimCanonicalWidth + canonicalGeometry.bleedCanonicalRight + markRightPx,
    maxY: canonicalGeometry.trimCanonicalHeight + canonicalGeometry.bleedCanonicalBottom + markBottomPx,
  };
}

/**
 * Verifica el cut path de UNA página (Fase 9.3, secciones 11/14/18/20) —
 * resuelve la fuente, normaliza la geometría, aplica el offset, y
 * verifica que quede dentro del MediaBox. `[]` si `cutPath.mode ===
 * "none"`. Nunca elige silenciosamente un candidato ni aproxima una
 * geometría no soportada — cada fallo produce un código específico.
 */
export function checkCutPathForPage(page: Page, pageId: PageId, printJob: PrintJob): PreflightIssue[] {
  if (printJob.cutPath.mode === "none") return [];

  const resolution = resolveDieLineSource(page, printJob.cutPath.source);

  if (resolution.status === "not-found") {
    return [
      {
        code: "cut_path_missing",
        severity: "error",
        pageId,
        message: `Se pidió un cut path (${printJob.cutPath.mode}) pero no se encontró ningún object con metadata.role="die-line" en esta página.`,
        recommendation: "Marca un Rectangle/Ellipse/Path cerrado como die-line, o cambia cutPath.mode a \"none\".",
      },
    ];
  }

  if (resolution.status === "multiple") {
    return [
      {
        code: "cut_path_multiple_candidates",
        severity: "error",
        pageId,
        message: `Se encontraron ${resolution.candidates.length} objects marcados como die-line en esta página — no se puede elegir automáticamente cuál usar.`,
        data: { objectIds: resolution.candidates.map((candidate) => candidate.object.id) },
        recommendation: "Deja un único object marcado como die-line en esta página, o selecciona uno explícitamente (cutPath.source por objectId).",
      },
    ];
  }

  const { candidate } = resolution;
  const geometryResult = normalizeCutGeometry(candidate);

  if (!geometryResult.ok) {
    const codeByReason = {
      "unsupported-object-type": "cut_path_unsupported_object",
      "open-path": "cut_path_open",
      "transform-unsupported": "cut_path_transform_unsupported",
    } as const;
    const messageByReason = {
      "unsupported-object-type": "El object marcado como die-line no es un Rectangle, Ellipse, ni Path — no se puede usar como cut path.",
      "open-path": "El Path marcado como die-line no está cerrado (closed: false) — un cut path debe ser una figura cerrada.",
      "transform-unsupported":
        "La combinación de transforms (rotación + escala no-uniforme en niveles distintos) del die-line no puede representarse con precisión — no se aproxima.",
    } as const;

    return [
      {
        code: codeByReason[geometryResult.reason],
        severity: "error",
        pageId,
        objectId: geometryResult.objectId,
        message: messageByReason[geometryResult.reason],
        recommendation: "Ajusta el die-line o su selección antes de exportar para producción.",
      },
    ];
  }

  const isDegenerate =
    (geometryResult.geometry.type === "rectangle" && (geometryResult.geometry.width <= 0 || geometryResult.geometry.height <= 0)) ||
    (geometryResult.geometry.type === "ellipse" && (geometryResult.geometry.radiusX <= 0 || geometryResult.geometry.radiusY <= 0));
  if (isDegenerate) {
    return [
      {
        code: "cut_path_invalid_geometry",
        severity: "error",
        pageId,
        objectId: geometryResult.objectId,
        message: "El die-line tiene tamaño nulo (ancho, alto o radio en cero) — no es una geometría de corte válida.",
        recommendation: "Corrige el tamaño del object marcado como die-line.",
      },
    ];
  }

  const offsetCanonicalPx = toPixels(printJob.cutPath.offset, printJob.cutPath.unit);
  const offsetResult = applyCutGeometryOffset(geometryResult.geometry, offsetCanonicalPx);

  if (offsetResult.status === "collapsed") {
    return [
      {
        code: "cut_path_collapsed",
        severity: "error",
        pageId,
        objectId: geometryResult.objectId,
        message: `El offset del cut path (${printJob.cutPath.offset}${printJob.cutPath.unit}) colapsa su geometría a un tamaño nulo o negativo.`,
        recommendation: "Reduce la magnitud del offset (o cámbialo a positivo) antes de exportar.",
      },
    ];
  }

  const issues: PreflightIssue[] = [];

  if (offsetResult.status === "unsupported") {
    issues.push({
      code: "cut_path_offset_unsupported",
      severity: printJob.offsetUnsupportedPolicy === "block" ? "error" : "warning",
      pageId,
      objectId: geometryResult.objectId,
      message: "El offset del cut path no es compatible con un Path cerrado arbitrario — se exportará con su geometría original, sin offset.",
      recommendation: "Usa un die-line Rectangle/Ellipse si necesitas un offset exacto, o exporta con offset 0.",
    });
    if (printJob.offsetUnsupportedPolicy === "block") return issues;
  }

  const bounds = computeMediaCanonicalBounds(printJob);
  const points = pointsOf(offsetResult.geometry);
  const outsideMedia = points.some((point) => point.x < bounds.minX || point.x > bounds.maxX || point.y < bounds.minY || point.y > bounds.maxY);
  if (outsideMedia) {
    issues.push({
      code: "cut_path_outside_media_box",
      severity: "warning",
      pageId,
      objectId: geometryResult.objectId,
      message: "El cut path (ya con su offset aplicado) queda parcialmente fuera de la superficie exportable (MediaBox).",
      recommendation: "Revisa la posición/tamaño del die-line, o reduce el offset del cut path.",
    });
  }

  return issues;
}
