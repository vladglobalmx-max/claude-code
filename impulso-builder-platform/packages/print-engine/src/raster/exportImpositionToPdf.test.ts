import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PDFDocument } from "pdf-lib";
import { AssetIdSchema } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import type { AddImposedSheetPageOptions, PdfBackend, PdfBackendDocument, PdfEmbeddedImage } from "../pdf/pdfBackend.js";
import type { GridImpositionSpec } from "../types.js";
import { buildDocument, buildImage, buildImageAsset, buildLayer, buildPage, buildPrintJobFor, buildProject, buildRectangle } from "../testUtils/fixtures.js";
import { countImageDrawOperations, getPageContentText } from "../testUtils/pdfContentInspection.js";
import * as assetImageCacheModule from "./assetImageCache.js";
import * as pieceRasterCacheModule from "./pieceRasterCache.js";

let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;
let toBlobResult: Blob | null;

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

const ONE_BY_ONE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DQAAAEgQGALFXOsAAAAABJRU5ErkJggg==";

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function onePixelPngBlob(): Blob {
  const bytes = base64ToBytes(ONE_BY_ONE_PNG_BASE64);
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
  if (typeof blob.arrayBuffer !== "function") {
    (blob as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => bytes.buffer as ArrayBuffer;
  }
  return blob;
}

function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

function fakeCanvas(): HTMLCanvasElement {
  return { width: 10, height: 10, toBlob: (cb: (b: Blob | null) => void) => cb(toBlobResult) } as unknown as HTMLCanvasElement;
}

const NEVER_CHECK: FontChecker = { check: async () => "available" };
const NO_PROBE: ImageDimensionsProbe = { measure: async () => undefined };
const noopResolver: ExportAssetResolver = { resolve: async () => undefined };
const NOW = () => "2026-07-20T00:00:00.000Z";

/** Hoja 50x50mm, pieza 20x20mm sin sangrado/marcas/gaps/márgenes —
 * capacidad determinista: columns=2, rows=2, capacidad=4 por hoja. Con
 * `quantity: 6` produce 2 hojas (4 + 2, última parcial). */
function gridImposition(overrides: Partial<GridImpositionSpec> = {}): GridImpositionSpec {
  return {
    mode: "grid",
    sheet: { width: 50, height: 50, unit: "mm" },
    orientation: "portrait",
    quantity: 6,
    placementMode: "automatic",
    gapX: 0,
    gapY: 0,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    alignment: "top-left",
    marksMode: "none",
    ...overrides,
  };
}

function fakeEmbeddedImage(): PdfEmbeddedImage {
  return { kind: "pdf-embedded-image" };
}

function fakeBackendCapturingSheets() {
  const addImposedSheetPage = vi.fn(async (_options: AddImposedSheetPageOptions) => undefined);
  const embedImage = vi.fn(async () => fakeEmbeddedImage());
  const save = vi.fn(async () => new Uint8Array([1, 2, 3]));
  const fakeDocument: PdfBackendDocument = { addRasterPage: vi.fn(), embedImage, addImposedSheetPage, save };
  const createDocument = vi.fn(() => fakeDocument);
  const backend: PdfBackend = { createDocument };
  return { backend, addImposedSheetPage, embedImage, save, createDocument };
}

describe("exportImpositionToPdf", () => {
  beforeEach(() => {
    toBlobResult = onePixelPngBlob();
    renderPageToStageMock = vi.fn(() => ({ stage: { toCanvas: () => fakeCanvas() }, widthPx: 10, heightPx: 10, destroy: vi.fn() }));
    resolveActivePageMock = vi.fn((project, pageId) => project.document.pages.find((p: { id: unknown }) => p.id === pageId));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lanza un Error de programación si imposition.mode no es 'grid'", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "digital-png"); // imposition.mode === "single"
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");

    await expect(
      exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toThrow(/imposition\.mode === 'grid'/);
  });

  it("produce un PDF real con una hoja por PdfBackend.addImposedSheetPage, y 2 hojas para 6 copias a 4 por hoja", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");

    const result = await exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    expect(result.format).toBe("pdf");
    expect(result.sheetCount).toBe(2);
    expect(result.pieceCount).toBe(6);

    const bytes = await readBlobBytes(result.blob);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it("rasteriza y embebe la pieza de origen UNA sola vez, sin importar cuántas copias/hojas existan", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition({ quantity: 6 }),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    const { backend, embedImage, addImposedSheetPage } = fakeBackendCapturingSheets();

    const result = await exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, backend });

    expect(renderPageToStageMock).toHaveBeenCalledTimes(1);
    expect(embedImage).toHaveBeenCalledTimes(1);
    expect(addImposedSheetPage).toHaveBeenCalledTimes(2); // 2 hojas
    const totalImages = addImposedSheetPage.mock.calls.reduce((sum, [options]) => sum + options.images.length, 0);
    expect(totalImages).toBe(6);
    expect(result.pieceCount).toBe(6);
  });

  it("el PDF real incrusta la imagen una vez por pieza colocada (6 operaciones Do en total)", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");

    const result = await exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const bytes = await readBlobBytes(result.blob);
    const reloaded = await PDFDocument.load(bytes);

    let totalDraws = 0;
    for (const pdfPage of reloaded.getPages()) {
      totalDraws += countImageDrawOperations(getPageContentText(reloaded, pdfPage));
    }
    expect(totalDraws).toBe(6);
  });

  it("marksMode 'none': ninguna hoja recibe marcas de corte", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition({ marksMode: "none" }),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    const { backend, addImposedSheetPage } = fakeBackendCapturingSheets();

    await exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, backend });

    for (const [options] of addImposedSheetPage.mock.calls) {
      expect(options.cropMarks).toEqual([]);
    }
  });

  it("marksMode 'per-piece': cada hoja recibe 8 marcas por cada pieza colocada en ella", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition({ marksMode: "per-piece" }),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    const { backend, addImposedSheetPage } = fakeBackendCapturingSheets();

    const result = await exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, backend });

    let totalMarks = 0;
    for (const [options] of addImposedSheetPage.mock.calls) {
      expect(options.cropMarks?.length).toBe(8 * options.images.length);
      totalMarks += options.cropMarks?.length ?? 0;
    }
    expect(totalMarks).toBe(8 * result.pieceCount);
  });

  it("marksMode 'per-sheet': cada hoja recibe exactamente 8 marcas, sin importar cuántas piezas tenga", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition({ marksMode: "per-sheet" }),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    const { backend, addImposedSheetPage } = fakeBackendCapturingSheets();

    await exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, backend });

    expect(addImposedSheetPage).toHaveBeenCalledTimes(2);
    for (const [options] of addImposedSheetPage.mock.calls) {
      expect(options.cropMarks?.length).toBe(8);
    }
  });

  it("cutPath 'die-cut' con die-line auto-detectado: cada hoja recibe un cutPath por cada pieza colocada", async () => {
    const dieLine = buildRectangle("die_1", {
      size: { width: 20, height: 20 },
      metadata: { tags: [], visible: true, locked: false, createdAt: NOW(), updatedAt: NOW(), role: "die-line" },
    });
    const page = buildPage("page_1", [buildLayer("layer_1", [dieLine])], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { imposition: gridImposition({ marksMode: "none" }) });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    const { backend, addImposedSheetPage } = fakeBackendCapturingSheets();

    const result = await exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, backend });

    let totalCutPaths = 0;
    for (const [options] of addImposedSheetPage.mock.calls) {
      expect(options.cutPaths?.length).toBe(options.images.length);
      totalCutPaths += options.cutPaths?.length ?? 0;
    }
    expect(totalCutPaths).toBe(result.pieceCount);
  });

  it("cutPath.mode != 'none' sin ningún die-line: Preflight bloquea con cut_path_missing (ningún PDF se crea)", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { imposition: gridImposition() });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");

    await expect(
      exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toMatchObject({ code: "preflight-blocked", preflightIssues: [expect.objectContaining({ code: "cut_path_missing" })] });
  });

  it("cada página de printJob.pageIds es un grupo de imposición independiente, con sus propias hojas concatenadas en orden", async () => {
    const page1 = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const page2 = buildPage("page_2", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition({ quantity: 4 }), // exactamente 1 hoja por página (capacidad 4)
    });
    printJob.pageIds = [page1.id, page2.id];
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");

    const result = await exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    expect(result.sheetCount).toBe(2); // 1 hoja por página, 2 páginas
    expect(result.pieceCount).toBe(8); // 4 copias por página
    expect(renderPageToStageMock).toHaveBeenCalledTimes(2); // una rasterización por página de origen
  });

  it("cuando la pieza no cabe en la hoja, Preflight ya bloquea con piece_does_not_fit (imposition-does-not-fit queda como red de seguridad no alcanzada)", async () => {
    const page = buildPage("page_1", [], { size: { width: 200, height: 200 }, unit: "mm" }); // más grande que la hoja
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");

    await expect(
      exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toMatchObject({ code: "preflight-blocked", preflightIssues: [expect.objectContaining({ code: "piece_does_not_fit" })] });
  });

  it("propaga preflight-blocked (asset roto) sin calcular imposición ni crear ningún PDF", async () => {
    const image = buildImage("obj_1", { assetId: AssetIdSchema.parse("asset_fantasma") });
    const page = buildPage("page_1", [buildLayer("layer_1", [image])], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");

    await expect(
      exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toMatchObject({ code: "preflight-blocked" });
    expect(renderPageToStageMock).not.toHaveBeenCalled();
  });

  it("el nombre de archivo es UN solo archivo (nunca numerado por hoja)", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");

    const result = await exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "Mi Sticker", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    expect(result.filename).not.toMatch(/sheet-\d+/);
    expect(result.filename.endsWith(".pdf")).toBe(true);
  });

  it("emite las etapas esperadas: validating, preparing-assets, rendering-page x1, assembling-pdf x2, finalizing, completed", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");

    const events: string[] = [];
    await exportImpositionToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "x",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
      onProgress: (event) => events.push(event.stage),
    });
    expect(events).toEqual(["validating", "preparing-assets", "rendering-page", "assembling-pdf", "assembling-pdf", "finalizing", "completed"]);
  });

  it("respeta la cancelación entre hojas", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    const controller = new AbortController();

    await expect(
      exportImpositionToPdf({
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

  it("respeta la cancelación justo antes de save() (finalizing), sin invocar el backend save", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    const { backend, save } = fakeBackendCapturingSheets();
    const controller = new AbortController();

    await expect(
      exportImpositionToPdf({
        project,
        printJob,
        resolver: noopResolver,
        projectName: "x",
        fontChecker: NEVER_CHECK,
        imageProbe: NO_PROBE,
        now: NOW,
        backend,
        onProgress: (event) => {
          if (event.stage === "finalizing") controller.abort();
        },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(save).not.toHaveBeenCalled();
  });

  it("acepta un backend inyectado (fake) para tests de dominio que nunca invocan pdf-lib", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    const { backend, createDocument, save } = fakeBackendCapturingSheets();

    const result = await exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, backend });
    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it("dispose() de imageCache y pieceCache corre incluso si el backend falla a mitad del ensamblado (hoja 2 de 2) — error injection Fase 9.5", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(), // quantity 6, capacidad 4/hoja -> 2 hojas
    });

    const imageDisposeSpy = vi.fn();
    const pieceDisposeSpy = vi.fn();
    const realCreateAssetImageCache = assetImageCacheModule.createAssetImageCache;
    const realCreatePieceRasterCache = pieceRasterCacheModule.createPieceRasterCache;
    vi.spyOn(assetImageCacheModule, "createAssetImageCache").mockImplementation((resolver) => {
      const real = realCreateAssetImageCache(resolver);
      const originalDispose = real.dispose.bind(real);
      return { ...real, dispose: () => { imageDisposeSpy(); originalDispose(); } };
    });
    vi.spyOn(pieceRasterCacheModule, "createPieceRasterCache").mockImplementation(() => {
      const real = realCreatePieceRasterCache();
      const originalDispose = real.dispose.bind(real);
      return { ...real, dispose: () => { pieceDisposeSpy(); originalDispose(); } };
    });

    let assembledSheets = 0;
    const addImposedSheetPage = vi.fn(async () => {
      assembledSheets += 1;
      if (assembledSheets === 2) throw new Error("backend real: fallo simulado ensamblando la hoja 2");
    });
    const embedImage = vi.fn(async () => fakeEmbeddedImage());
    const save = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const fakeDocument: PdfBackendDocument = { addRasterPage: vi.fn(), embedImage, addImposedSheetPage, save };
    const backend: PdfBackend = { createDocument: vi.fn(() => fakeDocument) };

    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    await expect(
      exportImpositionToPdf({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, backend }),
    ).rejects.toThrow(/fallo simulado/);

    // El error real del backend (no un error de cleanup) es el que llega al
    // caller — Y el cleanup corrió de todos modos (finally), nunca se saltó.
    expect(imageDisposeSpy).toHaveBeenCalledTimes(1);
    expect(pieceDisposeSpy).toHaveBeenCalledTimes(1);
  });

  it("nunca modifica el Project", async () => {
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

    const image = buildImage("img_1", { assetId: AssetIdSchema.parse("asset_1") });
    const page = buildPage("page_1", [buildLayer("layer_1", [image])], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page], { assets: [buildImageAsset("asset_1")] }) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
    });
    const before = JSON.parse(JSON.stringify(project));
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");

    try {
      await exportImpositionToPdf({
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
});
