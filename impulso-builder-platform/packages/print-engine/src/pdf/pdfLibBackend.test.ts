import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { pdfLibBackend } from "./pdfLibBackend.js";
import type { AddRasterPageOptions } from "./pdfBackend.js";

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
});
