import type { PathSegment } from "@impulso/document-schema";
import type { RasterLineSegment } from "./canonicalToRasterPoints.js";

/** Dibuja UNA marca de corte como línea recta real — grosor/color físicos,
 * nunca mezclada con el raster de contenido (se dibuja DESPUÉS, sobre el
 * mismo canvas ya compuesto). */
export function drawLineSegmentOnCanvas(ctx: CanvasRenderingContext2D, segment: RasterLineSegment): void {
  ctx.save();
  ctx.strokeStyle = segment.color;
  ctx.lineWidth = segment.strokeWidthPx;
  ctx.beginPath();
  ctx.moveTo(segment.from.x, segment.from.y);
  ctx.lineTo(segment.to.x, segment.to.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Dibuja un cut path (cualquier `CutGeometry`, ya uniformado a
 * `PathSegment[]` por `cutpath/cutGeometryToSegments.ts` — el mismo
 * camino que usa el backend PDF, para que ambos formatos representen la
 * MISMA geometría, ver ADR-0023) como path vectorial real — sin relleno
 * salvo que un perfil futuro lo pida explícitamente (sección 18). Un cut
 * path SIEMPRE es una figura cerrada (invariante de `CutGeometry`, ver
 * `cutGeometry.ts`) — se cierra incondicionalmente al final, sin depender
 * de que `segments` incluya un `{ type: "close" }` explícito: un
 * `ClosedPathCutGeometry` derivado de un `PathObject` cuyo `closed: true`
 * no tenía un segmento de cierre literal produciría, si no, un path
 * ABIERTO aquí mientras el backend PDF (`segmentsToSvgPathData(...,
 * true)`) sí lo cierra siempre — la misma geometría debe verse igual en
 * ambos formatos.
 */
export function drawPathSegmentsOnCanvas(ctx: CanvasRenderingContext2D, segments: readonly PathSegment[], strokeWidthPx: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidthPx;
  ctx.beginPath();
  for (const segment of segments) {
    switch (segment.type) {
      case "moveTo":
        ctx.moveTo(segment.point.x, segment.point.y);
        break;
      case "lineTo":
        ctx.lineTo(segment.point.x, segment.point.y);
        break;
      case "quadraticCurveTo":
        ctx.quadraticCurveTo(segment.control.x, segment.control.y, segment.point.x, segment.point.y);
        break;
      case "cubicCurveTo":
        ctx.bezierCurveTo(segment.control1.x, segment.control1.y, segment.control2.x, segment.control2.y, segment.point.x, segment.point.y);
        break;
      case "close":
        break; // el cierre incondicional de abajo ya lo cubre — ver el comentario de la función.
    }
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Crea un canvas vacío (sin contenido dibujado) del tamaño pedido — la
 * base compartida de `createMediaCanvasWithContent` (1 imagen) y de la
 * composición de una hoja impuesta (Fase 9.4, N imágenes en N
 * posiciones, ver `exportImpositionToPng.ts`). */
export function createBlankCanvas(widthPx: number, heightPx: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo obtener un contexto 2D del canvas de composición — entorno sin soporte de Canvas.");
  }
  return { canvas, ctx };
}

/** Crea un nuevo canvas del tamaño de MediaBox y compone el raster de
 * contenido (que cubre exactamente el BleedBox) en su offset correcto —
 * sin escalarlo (`drawImage` con el mismo ancho/alto que el canvas
 * origen). Nunca modifica `contentCanvas`. */
export function createMediaCanvasWithContent(
  contentCanvas: HTMLCanvasElement,
  mediaRasterWidth: number,
  mediaRasterHeight: number,
  bleedOffsetRasterPx: { x: number; y: number },
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const { canvas, ctx } = createBlankCanvas(mediaRasterWidth, mediaRasterHeight);
  ctx.drawImage(contentCanvas, bleedOffsetRasterPx.x, bleedOffsetRasterPx.y, contentCanvas.width, contentCanvas.height);
  return { canvas, ctx };
}
