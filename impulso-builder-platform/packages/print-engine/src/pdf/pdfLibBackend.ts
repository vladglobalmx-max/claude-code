import { PDFDocument } from "pdf-lib";
import { PrintEngineError } from "../errors.js";
import type { AddRasterPageOptions, PdfBackend, PdfBackendCreateDocumentOptions, PdfBackendDocument } from "./pdfBackend.js";

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
    } catch (error) {
      throw new PrintEngineError("pdf-backend-failed", "No se pudo agregar una página al PDF.", { cause: error });
    }
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
