import { cropMarkStartDistance } from "../boxes.js";
import { unitToPoints } from "../units.js";
import type { PrintJob } from "../types.js";
import type { PdfBoxPt } from "./pdfBackend.js";

export interface PdfPageBoxes {
  mediaWidthPt: number;
  mediaHeightPt: number;
  trimBox: PdfBoxPt;
  bleedBox: PdfBoxPt;
  mediaBox: PdfBoxPt;
  cropBox: PdfBoxPt;
  /** Offset del BleedBox respecto al MediaBox, en puntos (Fase 9.3) — el
   * espacio ocupado por las marcas de corte a cada lado, si están
   * activadas. `{0,0}` cuando `MediaBox === BleedBox` (sin marcas). El
   * raster de contenido (que cubre exactamente el BleedBox) se posiciona
   * en este offset dentro del MediaBox — nunca se escala para "hacer
   * espacio" (sección 5 del enunciado de Fase 9.3). */
  bleedOffsetWithinMedia: { x: number; y: number };
}

/**
 * Boxes de PDF de un `PrintJob`, en puntos (Epic 9 / Fase 9.2, sección 10
 * del enunciado, ver ADR-0022) — el mismo para CUALQUIER página del job
 * (depende solo de `dimensions`/`bleed`, nunca del contenido de una página
 * en particular, igual que `computeCanonicalPageGeometry`).
 *
 * El origen del PDF es la esquina INFERIOR-izquierda (`y` crece hacia
 * arriba) — el `TrimBox` se desplaza `bleedBottomPt` desde abajo y
 * `bleedLeftPt` desde la izquierda, nunca `bleedTopPt`: con un bleed
 * asimétrico (`top !== bottom`), confundir ambos desplazaría el trim al
 * lado equivocado de la página.
 *
 * `CropBox` = `MediaBox` (decisión ya tomada en Fase 9.1, ADR-0021): un
 * archivo de impresión debe mostrar su propio sangrado — y ahora también
 * sus marcas de corte — a quien lo abra, nunca ocultarlos recortándolos
 * por defecto.
 *
 * Fase 9.3: cuando `printJob.cropMarks.enabled`, `MediaBox` se expande más
 * allá del `BleedBox` con el mismo espacio por lado que ya calcula
 * `boxes.ts`'s `computeBoxes`/`cropMarkStartDistance` (nunca una fórmula
 * distinta o duplicada) — el `BleedBox` en sí NUNCA cambia de tamaño ni de
 * posición al activar marcas, solo se desplaza dentro de un `MediaBox`
 * más grande.
 */
export function computePdfPageBoxes(printJob: PrintJob): PdfPageBoxes {
  const trimWidthPt = unitToPoints(printJob.dimensions.width, printJob.dimensions.unit);
  const trimHeightPt = unitToPoints(printJob.dimensions.height, printJob.dimensions.unit);

  const bleedLeftPt = unitToPoints(printJob.bleed.left, printJob.bleed.unit);
  const bleedRightPt = unitToPoints(printJob.bleed.right, printJob.bleed.unit);
  const bleedTopPt = unitToPoints(printJob.bleed.top, printJob.bleed.unit);
  const bleedBottomPt = unitToPoints(printJob.bleed.bottom, printJob.bleed.unit);

  const bleedWidthPt = bleedLeftPt + trimWidthPt + bleedRightPt;
  const bleedHeightPt = bleedTopPt + trimHeightPt + bleedBottomPt;

  let markSpaceLeftPt = 0;
  let markSpaceRightPt = 0;
  let markSpaceTopPt = 0;
  let markSpaceBottomPt = 0;

  if (printJob.cropMarks.enabled) {
    const markOffsetPt = unitToPoints(printJob.cropMarks.offset, printJob.cropMarks.unit);
    const markLengthPt = unitToPoints(printJob.cropMarks.length, printJob.cropMarks.unit);
    markSpaceLeftPt = cropMarkStartDistance(bleedLeftPt, markOffsetPt) + markLengthPt;
    markSpaceRightPt = cropMarkStartDistance(bleedRightPt, markOffsetPt) + markLengthPt;
    markSpaceTopPt = cropMarkStartDistance(bleedTopPt, markOffsetPt) + markLengthPt;
    markSpaceBottomPt = cropMarkStartDistance(bleedBottomPt, markOffsetPt) + markLengthPt;
  }

  const mediaWidthPt = bleedWidthPt + markSpaceLeftPt + markSpaceRightPt;
  const mediaHeightPt = bleedHeightPt + markSpaceTopPt + markSpaceBottomPt;

  const bleedBox: PdfBoxPt = { x: markSpaceLeftPt, y: markSpaceBottomPt, width: bleedWidthPt, height: bleedHeightPt };
  const trimBox: PdfBoxPt = { x: markSpaceLeftPt + bleedLeftPt, y: markSpaceBottomPt + bleedBottomPt, width: trimWidthPt, height: trimHeightPt };
  const mediaBox: PdfBoxPt = { x: 0, y: 0, width: mediaWidthPt, height: mediaHeightPt };

  return {
    mediaWidthPt,
    mediaHeightPt,
    trimBox,
    bleedBox,
    mediaBox,
    cropBox: mediaBox,
    bleedOffsetWithinMedia: { x: markSpaceLeftPt, y: markSpaceBottomPt },
  };
}
