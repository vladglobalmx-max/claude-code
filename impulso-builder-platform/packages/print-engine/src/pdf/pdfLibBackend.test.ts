import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { pdfLibBackend } from "./pdfLibBackend.js";
import type { AddRasterPageOptions } from "./pdfBackend.js";
import {
  applyPdfMatrix,
  countImageDrawOperations,
  extractComposedMatrix,
  getPageContentText,
  splitIntoTopLevelBlocks,
} from "../testUtils/pdfContentInspection.js";

// PNG 1x1 transparente real (no un placeholder inventado) — pdf-lib
// parsea de verdad el formato PNG al incrustarlo, así que un byte array
// arbitrario fallaría con un error real de decodificación.
const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function onePixelPngBytes(): Uint8Array {
  const binaryString = atob(ONE_BY_ONE_PNG_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function baseRasterPageOptions(overrides: Partial<AddRasterPageOptions> = {}): AddRasterPageOptions {
  return {
    mediaWidthPt: 200,
    mediaHeightPt: 200,
    imageBytes: onePixelPngBytes(),
    imageX: 0,
    imageY: 0,
    imageWidthPt: 200,
    imageHeightPt: 200,
    mediaBox: { x: 0, y: 0, width: 200, height: 200 },
    bleedBox: { x: 0, y: 0, width: 200, height: 200 },
    trimBox: { x: 10, y: 10, width: 180, height: 180 },
    cropBox: { x: 0, y: 0, width: 200, height: 200 },
    ...overrides,
  };
}

describe("pdfLibBackend", () => {
  it("produce un PDF real con exactamente 1 página tras addRasterPage + save", async () => {
    const doc = pdfLibBackend.createDocument();
    await doc.addRasterPage(baseRasterPageOptions());
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it("produce un PDF multipágina en el orden en que se agregaron las páginas", async () => {
    const doc = pdfLibBackend.createDocument();
    await doc.addRasterPage(
      baseRasterPageOptions({ mediaWidthPt: 100, mediaHeightPt: 100, mediaBox: { x: 0, y: 0, width: 100, height: 100 } }),
    );
    await doc.addRasterPage(
      baseRasterPageOptions({ mediaWidthPt: 300, mediaHeightPt: 300, mediaBox: { x: 0, y: 0, width: 300, height: 300 } }),
    );
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(2);
    const [page1, page2] = reloaded.getPages();
    expect(page1!.getMediaBox().width).toBeCloseTo(100, 5);
    expect(page2!.getMediaBox().width).toBeCloseTo(300, 5);
  });

  it("los 4 boxes (Media/Bleed/Trim/Crop) leídos de vuelta del PDF coinciden con los pasados", async () => {
    const doc = pdfLibBackend.createDocument();
    await doc.addRasterPage(
      baseRasterPageOptions({
        mediaBox: { x: 0, y: 0, width: 210, height: 210 },
        bleedBox: { x: 3, y: 3, width: 204, height: 204 },
        trimBox: { x: 6, y: 6, width: 198, height: 198 },
        cropBox: { x: 0, y: 0, width: 210, height: 210 },
      }),
    );
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    const page = reloaded.getPages()[0]!;
    expect(page.getMediaBox()).toMatchObject({ x: 0, y: 0, width: 210, height: 210 });
    expect(page.getBleedBox()).toMatchObject({ x: 3, y: 3, width: 204, height: 204 });
    expect(page.getTrimBox()).toMatchObject({ x: 6, y: 6, width: 198, height: 198 });
    expect(page.getCropBox()).toMatchObject({ x: 0, y: 0, width: 210, height: 210 });
  });

  it("createDocument().save() sin ninguna página produce igual un PDF válido (0 páginas)", async () => {
    const doc = pdfLibBackend.createDocument();
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(0);
  });

  it("acepta un producer/creationDate inyectados (determinismo, sección 18)", async () => {
    const fixedDate = new Date("2026-07-20T00:00:00.000Z");
    const doc = pdfLibBackend.createDocument({ producer: "Impulso Test", creationDate: fixedDate });
    const bytes = await doc.save();
    // `updateMetadata: false` — de lo contrario, `PDFDocument.load` (igual
    // que `.create()`) SOBRESCRIBE Producer/CreationDate con sus propios
    // valores por defecto al cargar (comportamiento documentado de
    // pdf-lib, no un bug de este backend) — para verificar lo que
    // realmente se guardó, hay que pedirle que no los "actualice".
    const reloaded = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(reloaded.getProducer()).toBe("Impulso Test");
    expect(reloaded.getCreationDate()?.toISOString()).toBe(fixedDate.toISOString());
  });

  it("sin producer/creationDate, usa un producer por defecto y no lanza", async () => {
    const doc = pdfLibBackend.createDocument();
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(reloaded.getProducer()).toBe("Impulso Print Engine");
  });

  it("addRasterPage con bytes de imagen inválidos (no un PNG real) lanza PrintEngineError('pdf-backend-failed')", async () => {
    const doc = pdfLibBackend.createDocument();
    await expect(
      doc.addRasterPage(baseRasterPageOptions({ imageBytes: new Uint8Array([1, 2, 3, 4]) })),
    ).rejects.toMatchObject({ code: "pdf-backend-failed" });
  });

  it("dos documentos distintos son completamente independientes entre sí", async () => {
    const docA = pdfLibBackend.createDocument();
    const docB = pdfLibBackend.createDocument();
    await docA.addRasterPage(baseRasterPageOptions());
    const bytesA = await docA.save();
    const bytesB = await docB.save();
    const reloadedA = await PDFDocument.load(bytesA);
    const reloadedB = await PDFDocument.load(bytesB);
    expect(reloadedA.getPageCount()).toBe(1);
    expect(reloadedB.getPageCount()).toBe(0);
  });

  describe("cropMarks/cutPath — overlays vectoriales (Fase 9.3)", () => {
    it("sin cropMarks ni cutPath: el content stream no tiene ningún operador de línea/trazo vectorial extra", async () => {
      const doc = pdfLibBackend.createDocument();
      await doc.addRasterPage(baseRasterPageOptions());
      const bytes = await doc.save();
      const reloaded = await PDFDocument.load(bytes);
      const text = getPageContentText(reloaded, reloaded.getPages()[0]!);
      expect(text).not.toMatch(/\bRG\b/); // ningún color de trazo (stroke) fijado
    });

    it("una marca de corte se dibuja como línea vectorial real (operador 'l'), con las coordenadas exactas", async () => {
      const doc = pdfLibBackend.createDocument();
      await doc.addRasterPage(
        baseRasterPageOptions({
          cropMarks: [{ from: { x: 10, y: 190 }, to: { x: 10, y: 170 }, strokeWidthPt: 1, colorHex: "#000000" }],
        }),
      );
      const bytes = await doc.save();
      const reloaded = await PDFDocument.load(bytes);
      const text = getPageContentText(reloaded, reloaded.getPages()[0]!);
      expect(text).toContain("10 190 m");
      expect(text).toContain("10 170 l");
    });

    it("varias marcas de corte se dibujan todas, en el orden dado", async () => {
      const doc = pdfLibBackend.createDocument();
      await doc.addRasterPage(
        baseRasterPageOptions({
          cropMarks: [
            { from: { x: 0, y: 0 }, to: { x: 5, y: 0 }, strokeWidthPt: 1, colorHex: "#000000" },
            { from: { x: 0, y: 10 }, to: { x: 5, y: 10 }, strokeWidthPt: 1, colorHex: "#000000" },
          ],
        }),
      );
      const bytes = await doc.save();
      const reloaded = await PDFDocument.load(bytes);
      const text = getPageContentText(reloaded, reloaded.getPages()[0]!);
      expect(text).toContain("0 0 m");
      expect(text).toContain("5 0 l");
      expect(text).toContain("0 10 m");
      expect(text).toContain("5 10 l");
    });

    it("un cut path (rectángulo como 4 esquinas) se dibuja como path vectorial cerrado, en la posición correcta", async () => {
      const doc = pdfLibBackend.createDocument();
      await doc.addRasterPage(
        baseRasterPageOptions({
          cutPath: {
            segments: [
              { type: "moveTo", point: { x: 20, y: 20 } },
              { type: "lineTo", point: { x: 80, y: 20 } },
              { type: "lineTo", point: { x: 80, y: 80 } },
              { type: "lineTo", point: { x: 20, y: 80 } },
              { type: "close" },
            ],
            strokeWidthPt: 0.5,
            colorHex: "#ff00ff",
          },
        }),
      );
      const bytes = await doc.save();
      const reloaded = await PDFDocument.load(bytes);
      const text = getPageContentText(reloaded, reloaded.getPages()[0]!);
      // El bloque de dibujo del cut path (el ÚLTIMO `q...Q`, ya que se
      // dibuja después del raster) tiene su PROPIA matriz `cm` acumulada
      // desde cero — nunca se debe componer junto con la del bloque de la
      // imagen (que tiene su propia escala, sin relación). El content
      // stream muestra las coordenadas CRUDAS (negadas por `negateY`,
      // antes de que esa matriz las revierta al renderizar) — se compone
      // la matriz real del bloque y se aplica al primer punto del path
      // para obtener su posición ABSOLUTA final, que debe coincidir con
      // la pedida (20,20).
      const cutPathBlock = splitIntoTopLevelBlocks(text).at(-1)!;
      const matrix = extractComposedMatrix(cutPathBlock);
      const moveToMatch = /(-?[\d.]+) (-?[\d.]+) m/.exec(cutPathBlock);
      expect(moveToMatch).not.toBeNull();
      const rawPoint = { x: Number(moveToMatch![1]), y: Number(moveToMatch![2]) };
      const finalPoint = applyPdfMatrix(matrix, rawPoint);
      expect(finalPoint.x).toBeCloseTo(20, 6);
      expect(finalPoint.y).toBeCloseTo(20, 6);
      expect(cutPathBlock).toContain("h"); // cierre de path (h == closePath en PDF)
    });

    it("el raster de contenido sigue incrustándose exactamente una vez, con o sin overlays", async () => {
      const doc = pdfLibBackend.createDocument();
      await doc.addRasterPage(
        baseRasterPageOptions({
          cropMarks: [{ from: { x: 0, y: 0 }, to: { x: 5, y: 0 }, strokeWidthPt: 1, colorHex: "#000000" }],
          cutPath: { segments: [{ type: "moveTo", point: { x: 1, y: 1 } }, { type: "close" }], strokeWidthPt: 0.5, colorHex: "#ff00ff" },
        }),
      );
      const bytes = await doc.save();
      const reloaded = await PDFDocument.load(bytes);
      const text = getPageContentText(reloaded, reloaded.getPages()[0]!);
      expect(countImageDrawOperations(text)).toBe(1);
    });

    it("un color hex inválido no lanza — dibuja en negro (respaldo) en vez de fallar toda la exportación", async () => {
      const doc = pdfLibBackend.createDocument();
      await expect(
        doc.addRasterPage(
          baseRasterPageOptions({
            cropMarks: [{ from: { x: 0, y: 0 }, to: { x: 5, y: 0 }, strokeWidthPt: 1, colorHex: "not-a-color" }],
          }),
        ),
      ).resolves.toBeUndefined();
    });
  });
});
