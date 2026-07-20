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
 * Decisión explícita de esta fase (autorizada, sección 10): `MediaBox`
 * coincide con `BleedBox` — todavía no existe espacio reservado para
 * marcas de corte (eso es Fase 9.3). `CropBox` = `MediaBox`, la misma
 * decisión ya tomada en Fase 9.1 (ADR-0021): un archivo de impresión debe
 * mostrar su propio sangrado a quien lo abra, nunca ocultarlo recortándolo
 * por defecto.
 */
export function computePdfPageBoxes(printJob: PrintJob): PdfPageBoxes {
  const trimWidthPt = unitToPoints(printJob.dimensions.width, printJob.dimensions.unit);
  const trimHeightPt = unitToPoints(printJob.dimensions.height, printJob.dimensions.unit);

  const bleedLeftPt = unitToPoints(printJob.bleed.left, printJob.bleed.unit);
  const bleedRightPt = unitToPoints(printJob.bleed.right, printJob.bleed.unit);
  const bleedTopPt = unitToPoints(printJob.bleed.top, printJob.bleed.unit);
  const bleedBottomPt = unitToPoints(printJob.bleed.bottom, printJob.bleed.unit);

  const mediaWidthPt = bleedLeftPt + trimWidthPt + bleedRightPt;
  const mediaHeightPt = bleedTopPt + trimHeightPt + bleedBottomPt;

  const bleedBox: PdfBoxPt = { x: 0, y: 0, width: mediaWidthPt, height: mediaHeightPt };
  const trimBox: PdfBoxPt = { x: bleedLeftPt, y: bleedBottomPt, width: trimWidthPt, height: trimHeightPt };

  return {
    mediaWidthPt,
    mediaHeightPt,
    trimBox,
    bleedBox,
    mediaBox: bleedBox,
    cropBox: bleedBox,
  };
}
