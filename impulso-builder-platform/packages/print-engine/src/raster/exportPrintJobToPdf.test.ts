import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PDFDict, PDFDocument, PDFName, PDFStream } from "pdf-lib";
import { AssetIdSchema } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import type { AddRasterPageOptions, PdfBackend, PdfBackendDocument } from "../pdf/pdfBackend.js";
import { buildDocument, buildEllipse, buildGroup, buildImage, buildImageAsset, buildLayer, buildPage, buildPath, buildPrintJobFor, buildProject, buildRectangle } from "../testUtils/fixtures.js";
import { computePdfPageBoxes } from "../pdf/pageBoxes.js";
import { countImageDrawOperations, getPageContentText, splitIntoTopLevelBlocks } from "../testUtils/pdfContentInspection.js";

let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;
let toBlobResult: Blob | null;

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

// Un PNG 1x1 RGBA real, semi-transparente (alpha=128) — el backend real
// (pdf-lib) decodifica el PNG de verdad al incrustarlo y embebe un canal
// alfa como `/SMask` cuando existe (ver sección 11 del enunciado,
// "verificar la capacidad real del pipeline" de transparencia).
const ONE_BY_ONE_TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DQAAAEgQGALFXOsAAAAABJRU5ErkJggg==";

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

/** Recorre los XObject de la primera página buscando alguno con `/SMask`
 * — la forma en que `pdf-lib` embebe un canal alfa real (verificado
 * manualmente: un PNG con alpha SIEMPRE produce un `/SMask` en el
 * XObject correspondiente). */
function pageHasAlphaImage(doc: PDFDocument): boolean {
  const page = doc.getPages()[0]!;
  const resources = page.node.Resources();
  const xObjectDict = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (!xObjectDict) return false;
  for (const [, ref] of xObjectDict.entries()) {
    const stream = doc.context.lookup(ref, PDFStream);
    if (stream.dict.has(PDFName.of("SMask"))) return true;
  }
  return false;
}

function onePixelPngBlob(): Blob {
  const bytes = base64ToBytes(ONE_BY_ONE_TRANSPARENT_PNG_BASE64);
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
  // El `Blob` de jsdom no implementa `.arrayBuffer()` (gap conocido del
  // entorno de test, no de navegadores reales) — se parchea SOLO esta
  // instancia con los mismos bytes ya conocidos, sin tocar el prototipo
  // global ni el código de producción (que sí puede confiar en la API
  // estándar real, verificada en Chromium — ver la suite E2E de esta fase).
  if (typeof blob.arrayBuffer !== "function") {
    (blob as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => bytes.buffer as ArrayBuffer;
  }
  return blob;
}

// `Blob.prototype.arrayBuffer` tampoco existe en el `Blob` de jsdom para
// blobs construidos por el propio código de producción (ej. el PDF final
// de `exportPrintJobToPdf`) — `FileReader.readAsArrayBuffer` SÍ funciona en
// este entorno, así que los tests leen bytes de un Blob resultado con este
// helper en vez de `blob.arrayBuffer()` directamente.
function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 10,
    height: 10,
    toBlob: (cb: (b: Blob | null) => void) => cb(toBlobResult),
  } as unknown as HTMLCanvasElement;
}

const NEVER_CHECK: FontChecker = { check: async () => "available" };
const NO_PROBE: ImageDimensionsProbe = { measure: async () => undefined };
const noopResolver: ExportAssetResolver = { resolve: async () => undefined };
const NOW = () => "2026-07-20T00:00:00.000Z";

describe("exportPrintJobToPdf", () => {
  beforeEach(() => {
    toBlobResult = onePixelPngBlob();
    renderPageToStageMock = vi.fn(() => ({
      stage: { toCanvas: () => fakeCanvas() },
      widthPx: 10,
      heightPx: 10,
      destroy: vi.fn(),
    }));
    resolveActivePageMock = vi.fn((project, pageId) => project.document.pages.find((p: { id: unknown }) => p.id === pageId));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("produce un único archivo PDF real con exactamente 1 página para un PrintJob de 1 página", async () => {
    const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "print-pdf");
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

    const result = await exportPrintJobToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "Mi Sticker",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    expect(result.format).toBe("pdf");
    expect(result.pageCount).toBe(1);
    expect(result.filename).not.toContain("page-");

    const bytes = await readBlobBytes(result.blob);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it("produce un único archivo PDF multipágina con el número correcto de páginas, en orden", async () => {
    const page1 = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
    const page2 = buildPage("page_2", [], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project, "print-pdf");
    printJob.pageIds = [page1.id, page2.id];
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

    const result = await exportPrintJobToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "Mi Sticker",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    expect(result.pageCount).toBe(2);
    const bytes = await readBlobBytes(result.blob);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it("cada página del PDF real tiene los 4 boxes físicos correctos (Media/Bleed/Trim/Crop)", async () => {
    const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "print-pdf"); // bleed estándar 3mm
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const { computePdfPageBoxes } = await import("../pdf/pageBoxes.js");
    const expectedBoxes = computePdfPageBoxes(printJob);

    const result = await exportPrintJobToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "x",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    const bytes = await readBlobBytes(result.blob);
    const reloaded = await PDFDocument.load(bytes);
    const pdfPage = reloaded.getPages()[0]!;
    expect(pdfPage.getMediaBox().width).toBeCloseTo(expectedBoxes.mediaWidthPt, 3);
    expect(pdfPage.getBleedBox().width).toBeCloseTo(expectedBoxes.bleedBox.width, 3);
    expect(pdfPage.getTrimBox().x).toBeCloseTo(expectedBoxes.trimBox.x, 3);
    expect(pdfPage.getTrimBox().width).toBeCloseTo(expectedBoxes.trimBox.width, 3);
    expect(pdfPage.getCropBox().width).toBeCloseTo(expectedBoxes.cropBox.width, 3);
  });

  it("el nombre de archivo nunca incluye numeración de página (es UN solo archivo, sección 7 vs 8-10)", async () => {
    const page1 = buildPage("page_1", []);
    const page2 = buildPage("page_2", []);
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id];
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

    const result = await exportPrintJobToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "Mi Sticker",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    expect(result.filename).not.toMatch(/page-\d+/);
    expect(result.filename.endsWith(".pdf")).toBe(true);
  });

  it("canvas.toBlob(null) lanza PrintEngineError('raster-encoding-failed') antes de incrustar la página", async () => {
    toBlobResult = null;
    const page = buildPage("page_1", []);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

    await expect(
      exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toMatchObject({ code: "raster-encoding-failed" });
  });

  it("emite assembling-pdf por página y finalizing/completed al final", async () => {
    const page1 = buildPage("page_1", []);
    const page2 = buildPage("page_2", []);
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id];
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

    const events: string[] = [];
    await exportPrintJobToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "x",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
      onProgress: (event) => events.push(event.stage),
    });
    expect(events).toEqual([
      "validating",
      "preparing-assets",
      "rendering-page",
      "assembling-pdf",
      "rendering-page",
      "assembling-pdf",
      "finalizing",
      "completed",
    ]);
  });

  it("propaga preflight-blocked sin crear ningún PDF", async () => {
    const image = buildImage("obj_1", { assetId: AssetIdSchema.parse("asset_fantasma") });
    const page = buildPage("page_1", [buildLayer("layer_1", [image])]);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

    await expect(
      exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toMatchObject({ code: "preflight-blocked" });
  });

  it("acepta un backend inyectado (fake) para tests de dominio que nunca invocan pdf-lib", async () => {
    const page = buildPage("page_1", []);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

    const addRasterPage = vi.fn(async (_options: AddRasterPageOptions) => undefined);
    const save = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const fakeDocument: PdfBackendDocument = { addRasterPage, save, embedImage: vi.fn(), addImposedSheetPage: vi.fn() };
    const createDocument = vi.fn(() => fakeDocument);
    const fakeBackend: PdfBackend = { createDocument };

    const result = await exportPrintJobToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "x",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
      backend: fakeBackend,
    });
    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(addRasterPage).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it("respeta la cancelación entre páginas", async () => {
    const page1 = buildPage("page_1", []);
    const page2 = buildPage("page_2", []);
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id];
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const controller = new AbortController();

    await expect(
      exportPrintJobToPdf({
        project,
        printJob,
        resolver: noopResolver,
        projectName: "x",
        fontChecker: NEVER_CHECK,
        imageProbe: NO_PROBE,
        now: NOW,
        onProgress: (event) => {
          if (event.stage === "assembling-pdf") controller.abort();
        },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "aborted" });
  });

  it("respeta la cancelación justo antes de save() (etapa finalizing), sin invocar el backend save", async () => {
    const page = buildPage("page_1", []);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const controller = new AbortController();

    const save = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const fakeDocument: PdfBackendDocument = { addRasterPage: vi.fn(async () => undefined), save, embedImage: vi.fn(), addImposedSheetPage: vi.fn() };
    const fakeBackend: PdfBackend = { createDocument: vi.fn(() => fakeDocument) };

    await expect(
      exportPrintJobToPdf({
        project,
        printJob,
        resolver: noopResolver,
        projectName: "x",
        fontChecker: NEVER_CHECK,
        imageProbe: NO_PROBE,
        now: NOW,
        backend: fakeBackend,
        onProgress: (event) => {
          if (event.stage === "finalizing") controller.abort();
        },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(save).not.toHaveBeenCalled();
  });

  it("preserva la transparencia real del raster (PNG con alpha -> /SMask en el PDF) — sección 11", async () => {
    const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "digital-png"); // fondo transparente
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

    const result = await exportPrintJobToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "x",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    const bytes = await readBlobBytes(result.blob);
    const reloaded = await PDFDocument.load(bytes);
    expect(pageHasAlphaImage(reloaded)).toBe(true);
  });

  it("nunca modifica el Project (ni el die-line filtrado, ni ningún object)", async () => {
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = "";
      get src() {
        return this._src;
      }
      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });

    const dieLine = buildImage("die_1", { metadata: { tags: [], visible: true, locked: false, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z", role: "die-line" } });
    const image = buildImage("img_1", { assetId: AssetIdSchema.parse("asset_1") });
    const page = buildPage("page_1", [buildLayer("layer_1", [image, dieLine])]);
    const project = buildProject({ document: buildDocument([page], { assets: [buildImageAsset("asset_1")] }) });
    const printJob = buildPrintJobFor(project);
    const before = JSON.parse(JSON.stringify(project));
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

    try {
      await exportPrintJobToPdf({
        project,
        printJob,
        resolver: { resolve: async () => onePixelPngBlob() },
        projectName: "x",
        fontChecker: NEVER_CHECK,
        imageProbe: NO_PROBE,
        now: NOW,
      });
      expect(JSON.parse(JSON.stringify(project))).toEqual(before);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe("crop marks + cut path (Fase 9.3)", () => {
    const DIE_LINE_METADATA = { tags: [], visible: true, locked: false, createdAt: NOW(), updatedAt: NOW() as string, role: "die-line" };

    it("sin marcas (perfil digital-png): addRasterPage recibe cropMarks vacío y cutPath undefined", async () => {
      const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "digital-png");
      const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

      const addRasterPage = vi.fn(async (_options: AddRasterPageOptions) => undefined);
      const fakeBackend: PdfBackend = { createDocument: () => ({ addRasterPage, save: async () => new Uint8Array([1]), embedImage: vi.fn(), addImposedSheetPage: vi.fn() }) };

      await exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, backend: fakeBackend });

      expect(addRasterPage).toHaveBeenCalledTimes(1);
      const options = addRasterPage.mock.calls[0]![0];
      expect(options.cropMarks).toEqual([]);
      expect(options.cutPath).toBeUndefined();
    });

    it("con marcas (perfil print-pdf, default): addRasterPage recibe exactamente 8 segmentos de marca", async () => {
      const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "print-pdf");
      const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

      const addRasterPage = vi.fn(async (_options: AddRasterPageOptions) => undefined);
      const fakeBackend: PdfBackend = { createDocument: () => ({ addRasterPage, save: async () => new Uint8Array([1]), embedImage: vi.fn(), addImposedSheetPage: vi.fn() }) };

      await exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, backend: fakeBackend });

      const options = addRasterPage.mock.calls[0]![0];
      expect(options.cropMarks).toHaveLength(8);
    });

    it("el raster de contenido se posiciona en el offset del BleedBox (no en 0,0) cuando hay espacio de marcas", async () => {
      const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "print-pdf");
      const boxes = computePdfPageBoxes(printJob);
      const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

      const addRasterPage = vi.fn(async (_options: AddRasterPageOptions) => undefined);
      const fakeBackend: PdfBackend = { createDocument: () => ({ addRasterPage, save: async () => new Uint8Array([1]), embedImage: vi.fn(), addImposedSheetPage: vi.fn() }) };

      await exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, backend: fakeBackend });

      const options = addRasterPage.mock.calls[0]![0];
      expect(options.imageX).toBeCloseTo(boxes.bleedBox.x, 6);
      expect(options.imageY).toBeCloseTo(boxes.bleedBox.y, 6);
      expect(options.imageWidthPt).toBeCloseTo(boxes.bleedBox.width, 6);
      expect(options.imageHeightPt).toBeCloseTo(boxes.bleedBox.height, 6);
      expect(options.imageX).toBeGreaterThan(0); // hay espacio de marcas en el perfil print-pdf
    });

    it("cutPath.mode 'die-cut' con un único die-line rectangle detectado automáticamente: dibuja un path vectorial cerrado real", async () => {
      const dieLine = buildRectangle("die_1", {
        transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
        size: { width: 40, height: 40 },
        metadata: DIE_LINE_METADATA,
      });
      const page = buildPage("page_1", [buildLayer("layer_1", [dieLine])], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

      const result = await exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
      const bytes = await readBlobBytes(result.blob);
      const reloaded = await PDFDocument.load(bytes);
      const text = getPageContentText(reloaded, reloaded.getPages()[0]!);
      const blocks = splitIntoTopLevelBlocks(text);
      const cutPathBlock = blocks.at(-1)!;
      expect(cutPathBlock).toContain("h"); // cierre de path vectorial
      expect(countImageDrawOperations(text)).toBe(1); // el raster de contenido sigue siendo una sola imagen
    });

    it("cutPath.mode != 'none' pero SIN ningún die-line en la página: Preflight bloquea con cut_path_missing", async () => {
      const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

      await expect(
        exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
      ).rejects.toMatchObject({ code: "preflight-blocked", preflightIssues: [expect.objectContaining({ code: "cut_path_missing" })] });
    });

    it("cutPath.mode != 'none' con MÚLTIPLES die-lines candidatos: Preflight bloquea con cut_path_multiple_candidates", async () => {
      const dieLine1 = buildRectangle("die_1", { metadata: DIE_LINE_METADATA });
      const dieLine2 = buildRectangle("die_2", { metadata: DIE_LINE_METADATA });
      const page = buildPage("page_1", [buildLayer("layer_1", [dieLine1, dieLine2])], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

      await expect(
        exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
      ).rejects.toMatchObject({ code: "preflight-blocked", preflightIssues: [expect.objectContaining({ code: "cut_path_multiple_candidates" })] });
    });

    it("die-line anidado dentro de un group también se detecta y se dibuja correctamente", async () => {
      const dieLine = buildRectangle("die_1", { size: { width: 20, height: 20 }, metadata: DIE_LINE_METADATA });
      const group = buildGroup("group_1", [dieLine], { transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 } });
      const page = buildPage("page_1", [buildLayer("layer_1", [group])], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

      const result = await exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
      expect(result.format).toBe("pdf");
    });

    it("die-line Ellipse: dibuja un path vectorial cerrado (aproximado con curvas bezier)", async () => {
      const dieLine = buildEllipse("die_1", {
        transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
        size: { width: 40, height: 40 },
        metadata: DIE_LINE_METADATA,
      });
      const page = buildPage("page_1", [buildLayer("layer_1", [dieLine])], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

      const result = await exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
      const bytes = await readBlobBytes(result.blob);
      const reloaded = await PDFDocument.load(bytes);
      const text = getPageContentText(reloaded, reloaded.getPages()[0]!);
      const blocks = splitIntoTopLevelBlocks(text);
      const cutPathBlock = blocks.at(-1)!;
      expect(cutPathBlock).toMatch(/ c\n/); // curvas bezier de la elipse aproximada
      expect(cutPathBlock).toContain("h"); // cierre de path vectorial
    });

    it("die-line Path cerrado: dibuja el path vectorial tal cual, sin aproximarlo", async () => {
      const dieLine = buildPath("die_1", {
        transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
        segments: [
          { type: "moveTo", point: { x: 0, y: 0 } },
          { type: "lineTo", point: { x: 40, y: 0 } },
          { type: "lineTo", point: { x: 40, y: 40 } },
          { type: "lineTo", point: { x: 0, y: 40 } },
        ],
        closed: true,
        metadata: DIE_LINE_METADATA,
      });
      const page = buildPage("page_1", [buildLayer("layer_1", [dieLine])], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

      const result = await exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
      const bytes = await readBlobBytes(result.blob);
      const reloaded = await PDFDocument.load(bytes);
      const text = getPageContentText(reloaded, reloaded.getPages()[0]!);
      const blocks = splitIntoTopLevelBlocks(text);
      const cutPathBlock = blocks.at(-1)!;
      expect(cutPathBlock).toContain("h"); // cierre de path vectorial
      expect(countImageDrawOperations(text)).toBe(1); // el path cerrado no toca el raster de contenido
    });

    it("multipágina: cada página resuelve y dibuja SU PROPIO die-line, nunca el de la página 1", async () => {
      const dieLine1 = buildRectangle("die_1", { transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 40, height: 40 }, metadata: DIE_LINE_METADATA });
      const dieLine2 = buildEllipse("die_2", { transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 40, height: 40 }, metadata: DIE_LINE_METADATA });
      const page1 = buildPage("page_1", [buildLayer("layer_1", [dieLine1])], { size: { width: 50, height: 50 }, unit: "mm" });
      const page2 = buildPage("page_2", [buildLayer("layer_1", [dieLine2])], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page1, page2]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      // `buildPrintJobFor` solo apunta a la primera página por defecto — el
      // job debe incluir ambas para ejercer el multipágina.
      printJob.pageIds = [page1.id, page2.id];
      const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");

      const result = await exportPrintJobToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
      expect(result.pageCount).toBe(2);
      const bytes = await readBlobBytes(result.blob);
      const reloaded = await PDFDocument.load(bytes);

      const textPage1 = getPageContentText(reloaded, reloaded.getPages()[0]!);
      const cutPathBlockPage1 = splitIntoTopLevelBlocks(textPage1).at(-1)!;
      expect(cutPathBlockPage1).toContain("h");
      expect(cutPathBlockPage1).not.toMatch(/ c\n/); // página 1: rectangle, solo líneas rectas

      const textPage2 = getPageContentText(reloaded, reloaded.getPages()[1]!);
      const cutPathBlockPage2 = splitIntoTopLevelBlocks(textPage2).at(-1)!;
      expect(cutPathBlockPage2).toMatch(/ c\n/); // página 2: ellipse, curvas bezier
    });
  });
});
