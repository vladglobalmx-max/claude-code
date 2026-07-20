/**
 * Utilidad EXCLUSIVA de tests para inspeccionar el content stream real de
 * una página PDF (Fase 9.3, sección 30: "no depender únicamente de
 * snapshots de bytes"). Importa `pdf-lib` directamente — igual que
 * `pdf/pdfLibBackend.test.ts` ya hace desde Fase 9.2 — porque verificar
 * que una marca de corte/cut path se dibujó como VECTOR real (no como
 * parte del raster) requiere leer los operadores de dibujo reales del
 * PDF, no solo sus boxes/metadata. Nunca se usa desde código de
 * producción — la regla "pdf-lib solo en pdfLibBackend.ts" sigue vigente
 * para la API pública del paquete.
 */
import { PDFArray, PDFName, PDFObject, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream, type PDFDocument, type PDFPage } from "pdf-lib";

const utf8Decoder = new TextDecoder("utf-8");

function decodeStream(doc: PDFDocument, ref: PDFRef | PDFObject | undefined): string {
  const stream = doc.context.lookup(ref, PDFStream);
  if (!(stream instanceof PDFRawStream)) {
    throw new Error("Content stream inesperado: no es un PDFRawStream (¿un filtro no soportado por esta utilidad de test?).");
  }
  const bytes = decodePDFRawStream(stream).decode();
  return utf8Decoder.decode(bytes);
}

/** El texto crudo (operadores PDF) del content stream de una página —
 * concatenado si `/Contents` es un array de streams. */
export function getPageContentText(doc: PDFDocument, page: PDFPage): string {
  const contentsRef = page.node.get(PDFName.of("Contents"));
  const resolved = doc.context.lookup(contentsRef);
  if (resolved instanceof PDFArray) {
    const parts: string[] = [];
    for (let i = 0; i < resolved.size(); i++) {
      parts.push(decodeStream(doc, resolved.get(i)));
    }
    return parts.join("\n");
  }
  return decodeStream(doc, contentsRef);
}

/** Cuenta ocurrencias del operador `l`/`c`/`m` de trazo vectorial (no de
 * imagen) — una heurística simple pero honesta para confirmar "esto se
 * dibujó como vector, no como parte del raster incrustado" (sección 30). */
export function countVectorLineSegments(contentText: string): number {
  const matches = contentText.match(/(^|\n)[\d.\- ]+ l\b/gm);
  return matches ? matches.length : 0;
}

/** Cuenta cuántas veces aparece el operador `Do` (dibujar un XObject —
 * imagen embebida) en el content stream, para confirmar que el raster
 * de contenido se incrustó exactamente una vez por página. */
export function countImageDrawOperations(contentText: string): number {
  const matches = contentText.match(/\bDo\b/g);
  return matches ? matches.length : 0;
}

/** Matriz de transformación PDF (convención de vector fila: `p' = p × M`) —
 * necesaria porque los operadores de dibujo crudos de `drawSvgPath` (ej.
 * `page.drawSvgPath`) aparecen en el content stream en el espacio ANTES
 * de aplicar la matriz `cm` que ese mismo bloque ya escribió — comparar
 * un número crudo del content stream contra la posición absoluta
 * pretendida sin componer esta matriz da una verificación falsa
 * (sección 30: "no depender únicamente de snapshots de bytes"). */
export interface PdfMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const PDF_IDENTITY_MATRIX: PdfMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** `composePdfMatrix(first, then)` — el punto pasa PRIMERO por `first`,
 * DESPUÉS por `then` (mismo orden en que PDF concatena matrices sucesivas
 * de `cm`: la más nueva se aplica más cerca de las coordenadas crudas). */
export function composePdfMatrix(first: PdfMatrix, then: PdfMatrix): PdfMatrix {
  return {
    a: first.a * then.a + first.b * then.c,
    b: first.a * then.b + first.b * then.d,
    c: first.c * then.a + first.d * then.c,
    d: first.c * then.b + first.d * then.d,
    e: first.e * then.a + first.f * then.c + then.e,
    f: first.e * then.b + first.f * then.d + then.f,
  };
}

export function applyPdfMatrix(matrix: PdfMatrix, point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: point.x * matrix.a + point.y * matrix.c + matrix.e,
    y: point.x * matrix.b + point.y * matrix.d + matrix.f,
  };
}

/** Divide un content stream en sus bloques `q ... Q` de nivel superior —
 * cada primitiva de dibujo (`drawImage`/`drawLine`/`drawSvgPath` de
 * `pdf-lib`) emite su PROPIO bloque aislado, cada uno con su propia
 * matriz `cm` acumulada desde cero. Componer matrices de bloques
 * DISTINTOS (ej. la escala de `drawImage` junto con el flip de
 * `drawSvgPath`) produce una matriz sin sentido — hay que aislar el
 * bloque relevante antes de llamar a `extractComposedMatrix`. */
export function splitIntoTopLevelBlocks(contentText: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of contentText.split("\n")) {
    if (line.trim() === "q") {
      current = [line];
    } else {
      current.push(line);
      if (line.trim() === "Q") {
        blocks.push(current.join("\n"));
        current = [];
      }
    }
  }
  return blocks;
}

const CM_LINE_RE = /^([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+) cm$/;

/** Compone, EN ORDEN, todas las líneas `cm` de un bloque de texto de
 * content stream (ej. entre un `q` y su `Q` correspondiente) en una sola
 * matriz — para poder convertir un punto crudo del path a su posición
 * ABSOLUTA final. */
export function extractComposedMatrix(blockText: string): PdfMatrix {
  let ctm = PDF_IDENTITY_MATRIX;
  for (const line of blockText.split("\n")) {
    const match = CM_LINE_RE.exec(line.trim());
    if (!match) continue;
    const [, a, b, c, d, e, f] = match.map(Number) as [number, number, number, number, number, number, number];
    ctm = composePdfMatrix({ a, b, c, d, e, f }, ctm);
  }
  return ctm;
}
