import type { Unit } from "@impulso/document-schema";
import { cropMarkStartDistance, type PrintBoxes } from "../boxes.js";
import { convertUnit } from "../units.js";
import type { CropMarksSpec } from "../types.js";

/** Un segmento de línea física de una marca de corte — independiente de
 * pdf-lib, Canvas y Konva (Fase 9.3, sección 3). Las coordenadas viven en
 * el mismo espacio físico que `PrintBoxes` (origen en la esquina
 * superior-izquierda del MediaBox, y crece hacia abajo — el mismo sentido
 * que `Page`/`SceneObject`, NUNCA el origen inferior-izquierda de PDF; esa
 * conversión es responsabilidad exclusiva de quien ensambla el PDF, igual
 * que ya hace `pdf/pageBoxes.ts` con `bleedBottomPt`). */
export interface CropMarkSegment {
  from: { x: number; y: number };
  to: { x: number; y: number };
  unit: Unit;
  strokeWidth: number;
  color: string;
}

/**
 * Geometría PURA de las 4 marcas de esquina (8 segmentos: 1 horizontal +
 * 1 vertical por esquina) de un `PrintJob` con `cropMarks.enabled`
 * (Fase 9.3, secciones 3-4). Nunca depende del contenido de la página —
 * solo de `boxes` (que ya sabe cuánto sangrado hay por lado y dónde cae
 * el TrimBox dentro del MediaBox) y de `spec`.
 *
 * Política de una sola pieza (documentada, sin excepciones por esquina o
 * formato): cada marca EMPIEZA a `cropMarkStartDistance(bleedDeEseLado,
 * spec.offset)` del borde del TrimBox — nunca más cerca que el bleed de
 * ese lado (jamás cruza sangrado real) — y se extiende `spec.length` más
 * hacia afuera. Por construcción de `computeBoxes`, el extremo exterior
 * de cada marca cae EXACTAMENTE en el borde del MediaBox — nunca lo
 * excede ni lo deja corto.
 */
export function computeCropMarksGeometry(boxes: PrintBoxes, spec: CropMarksSpec): CropMarkSegment[] {
  if (!spec.enabled) return [];

  const unit = boxes.trim.unit;
  const offset = convertUnit(spec.offset, spec.unit, unit);
  const length = convertUnit(spec.length, spec.unit, unit);
  const strokeWidth = convertUnit(spec.strokeWidth, spec.unit, unit);

  const startLeft = cropMarkStartDistance(boxes.bleedPerSide.left, offset);
  const startRight = cropMarkStartDistance(boxes.bleedPerSide.right, offset);
  const startTop = cropMarkStartDistance(boxes.bleedPerSide.top, offset);
  const startBottom = cropMarkStartDistance(boxes.bleedPerSide.bottom, offset);

  const trimLeft = boxes.trimOffsetWithinMedia.x;
  const trimTop = boxes.trimOffsetWithinMedia.y;
  const trimRight = trimLeft + boxes.trim.width;
  const trimBottom = trimTop + boxes.trim.height;

  function segment(from: { x: number; y: number }, to: { x: number; y: number }): CropMarkSegment {
    return { from, to, unit, strokeWidth, color: spec.color };
  }

  return [
    // Esquina superior-izquierda.
    segment({ x: trimLeft - startLeft - length, y: trimTop }, { x: trimLeft - startLeft, y: trimTop }),
    segment({ x: trimLeft, y: trimTop - startTop - length }, { x: trimLeft, y: trimTop - startTop }),
    // Esquina superior-derecha.
    segment({ x: trimRight + startRight, y: trimTop }, { x: trimRight + startRight + length, y: trimTop }),
    segment({ x: trimRight, y: trimTop - startTop - length }, { x: trimRight, y: trimTop - startTop }),
    // Esquina inferior-izquierda.
    segment({ x: trimLeft - startLeft - length, y: trimBottom }, { x: trimLeft - startLeft, y: trimBottom }),
    segment({ x: trimLeft, y: trimBottom + startBottom }, { x: trimLeft, y: trimBottom + startBottom + length }),
    // Esquina inferior-derecha.
    segment({ x: trimRight + startRight, y: trimBottom }, { x: trimRight + startRight + length, y: trimBottom }),
    segment({ x: trimRight, y: trimBottom + startBottom }, { x: trimRight, y: trimBottom + startBottom + length }),
  ];
}
