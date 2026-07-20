import { computeBoxes } from "../boxes.js";
import { computeCropMarksGeometry } from "../marks/cropMarksGeometry.js";
import { parseHexColor } from "../pdf/color.js";
import type { PrintJob } from "../types.js";
import type { PreflightIssue } from "./types.js";

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/** Valida la CONFIGURACIÓN de `printJob.cropMarks` (Fase 9.3, sección 3)
 * — nunca calcula geometría con valores inválidos (eso lo hace
 * `checkCropMarksGeometry`, que solo corre si esto no encontró errores). */
export function checkCropMarksConfig(printJob: PrintJob): PreflightIssue[] {
  if (!printJob.cropMarks.enabled) return [];
  const { length, offset, strokeWidth, color } = printJob.cropMarks;
  const issues: PreflightIssue[] = [];

  if (!isFiniteNumber(length) || length <= 0) {
    issues.push({
      code: "crop_marks_invalid",
      severity: "error",
      message: `La longitud de las marcas de corte (${length}) no es válida — debe ser un número positivo y finito cuando están activadas.`,
      recommendation: "Corrige la longitud de las marcas de corte antes de continuar.",
    });
  }
  if (!isFiniteNumber(strokeWidth) || strokeWidth <= 0) {
    issues.push({
      code: "crop_marks_invalid",
      severity: "error",
      message: `El grosor de las marcas de corte (${strokeWidth}) no es válido — debe ser un número positivo y finito.`,
      recommendation: "Corrige el grosor de las marcas de corte antes de continuar.",
    });
  }
  if (!isFiniteNumber(offset) || offset < 0) {
    issues.push({
      code: "crop_marks_invalid",
      severity: "error",
      message: `La separación de las marcas de corte respecto al trim (${offset}) no es válida — debe ser un número finito, nunca negativo.`,
      recommendation: "Corrige la separación de las marcas de corte antes de continuar.",
    });
  }
  if (!parseHexColor(color)) {
    issues.push({
      code: "crop_marks_invalid",
      severity: "error",
      message: `El color de las marcas de corte ("${color}") no es un hex válido (#rgb/#rrggbb) — se necesita un color numérico real para dibujarlo como vector en el PDF.`,
      data: { color },
      recommendation: "Usa un color en formato hexadecimal, ej. #000000.",
    });
  }

  return issues;
}

/**
 * Verifica la GEOMETRÍA ya calculada de las marcas de corte contra sus
 * propios invariantes (sección 5: nunca invaden el TrimBox; sección 4:
 * siempre caben dentro del MediaBox) — una red de seguridad real, no solo
 * documentación: si `computeCropMarksGeometry`/`computeBoxes` alguna vez
 * regresionan, esto lo detecta antes de llegar a producción. Solo se
 * llama cuando `checkCropMarksConfig` no encontró ningún error.
 */
export function checkCropMarksGeometry(printJob: PrintJob): PreflightIssue[] {
  if (!printJob.cropMarks.enabled) return [];
  const issues: PreflightIssue[] = [];

  const boxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, printJob.cropMarks);

  if (boxes.media.width < boxes.bleed.width || boxes.media.height < boxes.bleed.height) {
    issues.push({
      code: "insufficient_mark_space",
      severity: "error",
      message: "El MediaBox calculado es más chico que el BleedBox — no hay espacio suficiente para las marcas de corte.",
      data: { media: boxes.media, bleed: boxes.bleed },
      recommendation: "Revisa la configuración de longitud/separación de las marcas de corte.",
    });
    return issues; // sin un MediaBox válido, verificar posiciones no tendría sentido.
  }

  const segments = computeCropMarksGeometry(boxes, printJob.cropMarks);
  const trimLeft = boxes.trimOffsetWithinMedia.x;
  const trimTop = boxes.trimOffsetWithinMedia.y;
  const trimRight = trimLeft + boxes.trim.width;
  const trimBottom = trimTop + boxes.trim.height;
  const EPS = 1e-6;

  let outsideMedia = false;
  let overlapsTrim = false;
  for (const segment of segments) {
    for (const point of [segment.from, segment.to]) {
      if (point.x < -EPS || point.x > boxes.media.width + EPS || point.y < -EPS || point.y > boxes.media.height + EPS) {
        outsideMedia = true;
      }
      if (point.x > trimLeft + EPS && point.x < trimRight - EPS && point.y > trimTop + EPS && point.y < trimBottom - EPS) {
        overlapsTrim = true;
      }
    }
  }

  if (outsideMedia) {
    issues.push({
      code: "crop_marks_outside_media_box",
      severity: "error",
      message: "Alguna marca de corte calculada cae fuera del MediaBox.",
      recommendation: "Reporta este problema — indica una inconsistencia interna en el cálculo de boxes.",
    });
  }
  if (overlapsTrim) {
    issues.push({
      code: "crop_marks_overlap_trim",
      severity: "error",
      message: "Alguna marca de corte calculada invade el TrimBox (el contenido terminado).",
      recommendation: "Reporta este problema — indica una inconsistencia interna en el cálculo de boxes.",
    });
  }

  return issues;
}
