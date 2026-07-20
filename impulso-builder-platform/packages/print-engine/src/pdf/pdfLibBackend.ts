import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import type { PathSegment } from "@impulso/document-schema";
import { segmentsToSvgPathData } from "@impulso/document-schema";
import { PrintEngineError } from "../errors.js";
import { parseHexColor } from "./color.js";
import type { AddRasterPageOptions, PdfBackend, PdfBackendCreateDocumentOptions, PdfBackendDocument, PdfLineOverlay, PdfPathOverlay } from "./pdfBackend.js";

/**
 * `page.drawSvgPath` aplica SIEMPRE un flip interno de Y sobre las
 * coordenadas del path que recibe (`scale(1, -1)`, verificado
 * empíricamente contra la salida real del content stream de `pdf-lib`,
 * no solo por lectura de su código fuente) — al margen de qué convención
 * uses vos. Para que un `PathSegment[]` YA en puntos PDF (origen
 * inferior-izquierda, `y` crece hacia arriba — la misma convención que
 * `drawLine`/`mediaBox`) termine en la posición correcta, hay que
 * negarle la `y` a cada punto/control ANTES de pasarlo — el flip de
 * `pdf-lib` lo revierte, y el resultado final queda sin alterar.
 */
function negateY(segments: readonly PathSegment[]): PathSegment[] {
  return segments.map((segment): PathSegment => {
    switch (segment.type) {
      case "moveTo":
        return { type: "moveTo", point: { x: segment.point.x, y: -segment.point.y } };
      case "lineTo":
        return { type: "lineTo", point: { x: segment.point.x, y: -segment.point.y } };
      case "quadraticCurveTo":
        return {
          type: "quadraticCurveTo",
          control: { x: segment.control.x, y: -segment.control.y },
          point: { x: segment.point.x, y: -segment.point.y },
        };
      case "cubicCurveTo":
        return {
          type: "cubicCurveTo",
          control1: { x: segment.control1.x, y: -segment.control1.y },
          control2: { x: segment.control2.x, y: -segment.control2.y },
          point: { x: segment.point.x, y: -segment.point.y },
        };
      case "close":
        return { type: "close" };
    }
  });
}

/** Color de respaldo (`#000000` — negro) si `colorHex` no es un hex
 * válido — nunca debería ocurrir en producción (Preflight ya valida el
 * formato antes de llegar aquí), pero este backend no vuelve a validar
 * ni lanza por un color mal formado: dibuja en negro antes que fallar
 * toda la exportación por un detalle puramente visual. */
function colorFromHex(colorHex: string) {
  const parsed = parseHexColor(colorHex) ?? { r: 0, g: 0, b: 0 };
  return rgb(parsed.r, parsed.g, parsed.b);
}

/**
 * ÚNICO módulo de todo `@impulso/print-engine` (de hecho, de todo Impulso
 * Platform) que importa `pdf-lib` — ver ADR de selección/aislamiento del
 * backend PDF. Nada fuera de este archivo conoce sus tipos.
 *
 * `PDFDocument.create()` es asíncrono en `pdf-lib`, pero `createDocument`
 * (la interfaz pública, `pdfBackend.ts`) es deliberadamente SÍNCRONO —
 * para no forzar a cada caller a un `await` extra solo para obtener un
 * documento vacío. Se resuelve creando la promesa de inicialización
 * inmediatamente (nunca perezosa) y esperándola dentro de cada método.
 */
class PdfLibBackendDocument implements PdfBackendDocument {
  private readonly docPromise: Promise<PDFDocument>;

  constructor(options?: PdfBackendCreateDocumentOptions) {
    this.docPromise = PDFDocument.create().then((doc) => {
      doc.setProducer(options?.producer ?? "Impulso Print Engine");
      if (options?.creationDate) {
        doc.setCreationDate(options.creationDate);
        doc.setModificationDate(options.creationDate);
      }
      return doc;
    });
  }

  async addRasterPage(options: AddRasterPageOptions): Promise<void> {
    let doc: PDFDocument;
    try {
      doc = await this.docPromise;
      const page = doc.addPage([options.mediaWidthPt, options.mediaHeightPt]);
      page.setMediaBox(options.mediaBox.x, options.mediaBox.y, options.mediaBox.width, options.mediaBox.height);
      page.setBleedBox(options.bleedBox.x, options.bleedBox.y, options.bleedBox.width, options.bleedBox.height);
      page.setTrimBox(options.trimBox.x, options.trimBox.y, options.trimBox.width, options.trimBox.height);
      page.setCropBox(options.cropBox.x, options.cropBox.y, options.cropBox.width, options.cropBox.height);
      const embedded = await doc.embedPng(options.imageBytes);
      page.drawImage(embedded, {
        x: options.imageX,
        y: options.imageY,
        width: options.imageWidthPt,
        height: options.imageHeightPt,
      });

      // Marcas de corte y cut path se dibujan DESPUÉS del raster de
      // contenido, como vectores reales — nunca se incrustan en el PNG
      // (Fase 9.3, secciones 6/18). Orden documentado en ADR-0023: marcas
      // primero, cut path después.
      for (const mark of options.cropMarks ?? []) {
        this.drawLineOverlay(page, mark);
      }
      if (options.cutPath) {
        this.drawPathOverlay(page, options.cutPath);
      }
    } catch (error) {
      throw new PrintEngineError("pdf-backend-failed", "No se pudo agregar una página al PDF.", { cause: error });
    }
  }

  /** Una marca de corte — línea recta, sin flip de Y necesario (`drawLine`
   * no aplica ninguna transformación oculta, a diferencia de
   * `drawSvgPath` — verificado empíricamente). */
  private drawLineOverlay(page: PDFPage, mark: PdfLineOverlay): void {
    page.drawLine({
      start: mark.from,
      end: mark.to,
      thickness: mark.strokeWidthPt,
      color: colorFromHex(mark.colorHex),
    });
  }

  /** Un cut path — cualquier geometría (Rectangle/Ellipse/ClosedPath) ya
   * normalizada a `PathSegment[]` por
   * `cutpath/cutGeometryToSegments.ts` antes de llegar aquí. Nunca se
   * rellena (`color` de `pdf-lib` no se fija) salvo que un perfil futuro
   * lo pida explícitamente (sección 18: "sin fill salvo que el perfil lo
   * pida"). */
  private drawPathOverlay(page: PDFPage, cutPath: PdfPathOverlay): void {
    const svgPath = segmentsToSvgPathData(negateY(cutPath.segments), true);
    page.drawSvgPath(svgPath, {
      x: 0,
      y: 0,
      borderColor: colorFromHex(cutPath.colorHex),
      borderWidth: cutPath.strokeWidthPt,
    });
  }

  async save(): Promise<Uint8Array> {
    try {
      const doc = await this.docPromise;
      // `addDefaultPage: false` — por defecto, `pdf-lib` agrega en
      // silencio una página en blanco si el documento tiene 0 páginas al
      // guardar; el número de páginas de un PDF de impresión lo decide
      // ÚNICAMENTE `PrintJob.pageIds` (vía `addRasterPage`), nunca un
      // relleno implícito de la librería.
      return await doc.save({ addDefaultPage: false });
    } catch (error) {
      throw new PrintEngineError("pdf-backend-failed", "No se pudo generar el archivo PDF final.", { cause: error });
    }
  }
}

export const pdfLibBackend: PdfBackend = {
  createDocument(options?: PdfBackendCreateDocumentOptions): PdfBackendDocument {
    return new PdfLibBackendDocument(options);
  },
};
