/**
 * Golden OUTPUTS estructurales de un PDF (Fase 9.5, secciones 3-4 del
 * enunciado: "no depender solo de snapshots binarios del PDF", "no
 * considerar estable un test que falla por IDs internos/timestamps/orden
 * de diccionarios/compresión/metadata variable"). Produce un objeto
 * JSON pequeño y determinista — apto para `expect(...).toMatchSnapshot()`
 * de vitest (texto legible en el repo, nunca el binario del PDF) — con
 * exactamente lo que SÍ debe permanecer estable entre corridas
 * (páginas/boxes/cantidad de imágenes/vectores/transparencia) y nada de
 * lo que pdf-lib no garantiza (orden interno de objetos, compresión).
 *
 * Regla explícita de esta fase: la normalización nunca esconde una
 * regresión real — nunca se tocan boxes, dimensiones, cantidad de
 * páginas/imágenes/paths, colores, ni warnings/errors. Solo se excluye
 * metadata efímera (Producer/CreationDate/ModDate) que varía por diseño
 * entre entornos y no es geometría.
 */
import { PDFDict, PDFName, PDFNumber, PDFStream, type PDFDocument, type PDFPage } from "pdf-lib";
import { countImageDrawOperations, countVectorLineSegments, getPageContentText } from "./pdfContentInspection.js";

export interface PdfPageStructuralSnapshot {
  mediaBox: { width: number; height: number };
  /** `undefined` si la página no define un TrimBox propio (hereda del
   * documento, o no aplica — nunca se rellena con un valor inventado). */
  trimBox: { width: number; height: number } | undefined;
  imageDrawCount: number;
  vectorLineSegmentCount: number;
  hasAlphaImage: boolean;
}

export interface PdfStructuralSnapshot {
  pageCount: number;
  pages: PdfPageStructuralSnapshot[];
}

function readBoxDimensions(page: PDFPage, boxName: string): { width: number; height: number } | undefined {
  const entry = page.node.get(PDFName.of(boxName));
  if (!entry) return undefined;
  const array = page.doc.context.lookup(entry);
  if (!array || !("get" in array)) return undefined;
  const arr = array as unknown as { get(i: number): unknown };
  const nums = [0, 1, 2, 3].map((i) => arr.get(i));
  if (!nums.every((n): n is PDFNumber => n instanceof PDFNumber)) return undefined;
  const [x0, y0, x1, y1] = nums.map((n) => n.asNumber());
  return { width: Math.abs(x1! - x0!), height: Math.abs(y1! - y0!) };
}

function pageHasAlphaImage(doc: PDFDocument, page: PDFPage): boolean {
  const resources = page.node.Resources();
  const xObjectDict = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (!xObjectDict) return false;
  for (const [, ref] of xObjectDict.entries()) {
    const stream = doc.context.lookup(ref, PDFStream);
    if (stream.dict.has(PDFName.of("SMask"))) return true;
  }
  return false;
}

/** Describe la estructura completa (todas las páginas) de un PDF real ya
 * generado — nunca compara bytes crudos, siempre estos campos
 * explícitos, redondeados a 2 decimales (evita que ruido de punto
 * flotante de 1e-10 rompa un snapshot por nada, sin esconder una
 * diferencia real de geometría). */
export function describePdfStructure(doc: PDFDocument): PdfStructuralSnapshot {
  const pages = doc.getPages().map((page): PdfPageStructuralSnapshot => {
    const mediaBoxRaw = page.getMediaBox();
    const contentText = getPageContentText(doc, page);
    return {
      mediaBox: { width: Math.round(mediaBoxRaw.width * 100) / 100, height: Math.round(mediaBoxRaw.height * 100) / 100 },
      trimBox: (() => {
        const box = readBoxDimensions(page, "TrimBox");
        return box ? { width: Math.round(box.width * 100) / 100, height: Math.round(box.height * 100) / 100 } : undefined;
      })(),
      imageDrawCount: countImageDrawOperations(contentText),
      vectorLineSegmentCount: countVectorLineSegments(contentText),
      hasAlphaImage: pageHasAlphaImage(doc, page),
    };
  });
  return { pageCount: pages.length, pages };
}
