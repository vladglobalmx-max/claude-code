import type { Unit } from "@impulso/document-schema";
import { convertUnit } from "./units.js";
import type { BleedSpec, CropMarksSpec, PhysicalSize } from "./types.js";

/**
 * Boxes de una página de impresión (sección 6 del enunciado, corrección 4)
 * — cada una con un rol preciso y sin ambigüedad:
 *
 * - **TrimBox**: el tamaño final terminado — exactamente `PrintJob.dimensions`.
 * - **BleedBox**: trim + sangrado por lado — nunca incluye espacio de marcas.
 * - **MediaBox**: la superficie TOTAL del PDF — bleed + el espacio que
 *   ocupan las marcas de corte, si están activadas (nunca más chico que
 *   BleedBox).
 * - **SafeAreaBox**: vive DENTRO del trim (nunca lo excede) — puramente
 *   informativo, nunca se exporta como contenido (sección 8).
 * - **CropBox** (decisión EXPLÍCITA, no una omisión): se fija igual a
 *   MediaBox — un archivo de impresión debe mostrar sus propias marcas de
 *   corte y su bleed a quien lo abra para verificarlo (un operador de
 *   imprenta, el propio usuario), nunca ocultarlos recortándolos con un
 *   CropBox más chico por defecto.
 * - **ArtBox**: no se usa en V1 — no hay una necesidad clara identificada
 *   (sección 6, "solo si existe una necesidad clara"); documentado, no
 *   omitido por accidente.
 *
 * Todas las cantidades de entrada (bleed, safe area, crop marks) pueden
 * llegar en una unidad distinta a `trim.unit` — se normalizan aquí antes
 * de combinar tamaños (`convertUnit`, `units.ts`).
 */
export interface PrintBoxes {
  trim: PhysicalSize;
  bleed: PhysicalSize;
  media: PhysicalSize;
  safeArea: PhysicalSize;
  /** Offset del TrimBox respecto a la esquina superior-izquierda del
   * MediaBox — necesario para posicionar contenido/marcas dentro del
   * canvas final (Fase 9.2). En el mismo `unit` que `trim`. */
  trimOffsetWithinMedia: { x: number; y: number };
  /** Offset del TrimBox respecto al BleedBox (equivalente a `bleed.top`/
   * `bleed.left` ya normalizados a `trim.unit`) — para saber dónde
   * empieza el contenido dentro del canvas de sangrado. */
  trimOffsetWithinBleed: { x: number; y: number };
}

function normalize(value: number, from: Unit, to: Unit): number {
  return convertUnit(value, from, to);
}

/** Distancia (en `unit`) entre el borde del trim y el punto donde empieza
 * una marca de corte de ese lado — nunca menor al bleed de ese lado (para
 * no interferir con él, sección 9) ni menor al `offset` configurado
 * (separación mínima respecto al trim). */
export function cropMarkStartDistance(bleedOnSide: number, offset: number): number {
  return Math.max(bleedOnSide, offset);
}

export function computeBoxes(
  trim: PhysicalSize,
  bleed: BleedSpec,
  safeArea: { enabled: boolean; margin: number; unit: Unit },
  cropMarks: CropMarksSpec,
): PrintBoxes {
  const unit = trim.unit;
  const bleedTop = normalize(bleed.top, bleed.unit, unit);
  const bleedRight = normalize(bleed.right, bleed.unit, unit);
  const bleedBottom = normalize(bleed.bottom, bleed.unit, unit);
  const bleedLeft = normalize(bleed.left, bleed.unit, unit);

  const bleedSize: PhysicalSize = {
    width: trim.width + bleedLeft + bleedRight,
    height: trim.height + bleedTop + bleedBottom,
    unit,
  };

  const marginPx = safeArea.enabled ? normalize(safeArea.margin, safeArea.unit, unit) : 0;
  const safeAreaSize: PhysicalSize = {
    width: Math.max(0, trim.width - 2 * marginPx),
    height: Math.max(0, trim.height - 2 * marginPx),
    unit,
  };

  let mediaExpansionTop = bleedTop;
  let mediaExpansionRight = bleedRight;
  let mediaExpansionBottom = bleedBottom;
  let mediaExpansionLeft = bleedLeft;

  if (cropMarks.enabled) {
    const offset = normalize(cropMarks.offset, cropMarks.unit, unit);
    const length = normalize(cropMarks.length, cropMarks.unit, unit);
    mediaExpansionTop = cropMarkStartDistance(bleedTop, offset) + length;
    mediaExpansionRight = cropMarkStartDistance(bleedRight, offset) + length;
    mediaExpansionBottom = cropMarkStartDistance(bleedBottom, offset) + length;
    mediaExpansionLeft = cropMarkStartDistance(bleedLeft, offset) + length;
  }

  const mediaSize: PhysicalSize = {
    width: trim.width + mediaExpansionLeft + mediaExpansionRight,
    height: trim.height + mediaExpansionTop + mediaExpansionBottom,
    unit,
  };

  return {
    trim,
    bleed: bleedSize,
    media: mediaSize,
    safeArea: safeAreaSize,
    trimOffsetWithinMedia: { x: mediaExpansionLeft, y: mediaExpansionTop },
    trimOffsetWithinBleed: { x: bleedLeft, y: bleedTop },
  };
}
