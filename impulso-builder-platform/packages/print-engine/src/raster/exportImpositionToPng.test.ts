import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AssetIdSchema } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import type { GridImpositionSpec } from "../types.js";
import { buildDocument, buildImage, buildImageAsset, buildLayer, buildPage, buildPrintJobFor, buildProject, buildRectangle } from "../testUtils/fixtures.js";
import { createFakeCanvasContext2D, type FakeCanvasContext2D } from "../testUtils/fakeCanvasContext2D.js";

let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;
let toBlobResult: Blob | null;
let contexts: FakeCanvasContext2D[];

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

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

const ZERO_BLEED = { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" as const };
const NO_CROP_MARKS = { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm" as const, color: "#000000" };
const NO_CUT_PATH = { mode: "none" as const, source: { type: "auto" as const }, offset: 0, unit: "mm" as const, stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" };

function countDrawImageCalls(): number {
  return contexts.reduce((sum, ctx) => sum + ctx.calls.filter((c) => c.method === "drawImage").length, 0);
}

function countStrokeCalls(): number {
  return contexts.reduce((sum, ctx) => sum + ctx.calls.filter((c) => c.method === "stroke").length, 0);
}

describe("exportImpositionToPng", () => {
  beforeEach(() => {
    toBlobResult = new Blob(["png"], { type: "image/png" });
    contexts = [];
    renderPageToStageMock = vi.fn(() => ({ stage: { toCanvas: () => fakeCanvas() }, widthPx: 10, heightPx: 10, destroy: vi.fn() }));
    resolveActivePageMock = vi.fn((project, pageId) => project.document.pages.find((p: { id: unknown }) => p.id === pageId));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      const ctx = createFakeCanvasContext2D();
      contexts.push(ctx);
      return ctx as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(toBlobResult));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lanza un Error de programación si imposition.mode no es 'grid'", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "digital-png");
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    await expect(
      exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toThrow(/imposition\.mode === 'grid'/);
  });

  it("produce 1 archivo PNG por hoja — 2 hojas para 6 copias a 4 por hoja (última parcial)", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { bleed: ZERO_BLEED, cropMarks: NO_CROP_MARKS, cutPath: NO_CUT_PATH, imposition: gridImposition() });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    const result = await exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    expect(result.format).toBe("png");
    expect(result.sheets).toHaveLength(2);
    expect(result.sheets[0]!.filename).toContain("sheet-01");
    expect(result.sheets[1]!.filename).toContain("sheet-02");
    for (const sheet of result.sheets) expect(sheet.blob).toBeInstanceOf(Blob);
  });

  it("rasteriza la pieza de origen UNA sola vez y la compone (drawImage) una vez por copia colocada", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { bleed: ZERO_BLEED, cropMarks: NO_CROP_MARKS, cutPath: NO_CUT_PATH, imposition: gridImposition() });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    await exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    expect(renderPageToStageMock).toHaveBeenCalledTimes(1);
    expect(countDrawImageCalls()).toBe(6);
  });

  it("marksMode 'none': ninguna hoja dibuja marcas de corte", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { cutPath: NO_CUT_PATH, imposition: gridImposition({ marksMode: "none" }) });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    await exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    expect(countStrokeCalls()).toBe(0);
  });

  it("marksMode 'per-piece': cada pieza colocada dibuja sus propias 8 marcas (1 stroke por segmento)", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { cutPath: NO_CUT_PATH, imposition: gridImposition({ marksMode: "per-piece" }) });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    const result = await exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const totalPieces = countDrawImageCalls();
    expect(countStrokeCalls()).toBe(8 * totalPieces);
    expect(result.sheets.length).toBeGreaterThan(0);
  });

  it("marksMode 'per-sheet': cada hoja dibuja exactamente 8 marcas, sin importar cuántas piezas tenga", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { bleed: ZERO_BLEED, cutPath: NO_CUT_PATH, imposition: gridImposition({ marksMode: "per-sheet" }) });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    const result = await exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    expect(result.sheets).toHaveLength(2);
    // Cada hoja compone su propio contexto — 8 trazos de marca por hoja.
    for (const ctx of contexts) {
      const strokes = ctx.calls.filter((c) => c.method === "stroke").length;
      expect(strokes).toBe(8);
    }
  });

  it("cutPath 'die-cut' con die-line auto-detectado: cada pieza colocada dibuja su propio cut path (1 stroke extra por pieza)", async () => {
    const dieLine = buildRectangle("die_1", {
      size: { width: 20, height: 20 },
      metadata: { tags: [], visible: true, locked: false, createdAt: NOW(), updatedAt: NOW(), role: "die-line" },
    });
    const page = buildPage("page_1", [buildLayer("layer_1", [dieLine])], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { imposition: gridImposition({ marksMode: "none" }) });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    await exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const totalPieces = countDrawImageCalls();
    expect(countStrokeCalls()).toBe(totalPieces); // 1 cut path por pieza, sin marcas
  });

  it("cutPath.mode != 'none' sin ningún die-line: Preflight bloquea con cut_path_missing", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { imposition: gridImposition() });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    await expect(
      exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toMatchObject({ code: "preflight-blocked", preflightIssues: [expect.objectContaining({ code: "cut_path_missing" })] });
  });

  it("cada página de printJob.pageIds es un grupo de imposición independiente — hojas y renders propios", async () => {
    const page1 = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const page2 = buildPage("page_2", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { bleed: ZERO_BLEED, cropMarks: NO_CROP_MARKS, cutPath: NO_CUT_PATH, imposition: gridImposition({ quantity: 4 }) });
    printJob.pageIds = [page1.id, page2.id];
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    const result = await exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    expect(result.sheets).toHaveLength(2); // 1 hoja por página, 2 páginas
    expect(renderPageToStageMock).toHaveBeenCalledTimes(2);
    expect(countDrawImageCalls()).toBe(8); // 4 copias por página
  });

  it("cuando la pieza no cabe en la hoja, Preflight ya bloquea con piece_does_not_fit", async () => {
    const page = buildPage("page_1", [], { size: { width: 200, height: 200 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { cropMarks: NO_CROP_MARKS, cutPath: NO_CUT_PATH, imposition: gridImposition() });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    await expect(
      exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toMatchObject({ code: "preflight-blocked", preflightIssues: [expect.objectContaining({ code: "piece_does_not_fit" })] });
  });

  it("Preflight ya bloquea con sheet_memory_budget_exceeded cuando el presupuesto alcanza para una pieza pero no para la hoja completa", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { bleed: ZERO_BLEED, cropMarks: NO_CROP_MARKS, cutPath: NO_CUT_PATH, imposition: gridImposition() });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    // ~1MB alcanza para el raster de una sola pieza (20x20mm a 300ppi, lo
    // que valida `raster_too_large` en Preflight) pero no para el raster de
    // la hoja completa (50x50mm a 300ppi) que ahora también valida
    // Preflight (`sheet_memory_budget_exceeded`, sección 16).
    await expect(
      exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW, memoryBudgetBytes: 1_000_000 }),
    ).rejects.toMatchObject({ code: "preflight-blocked", preflightIssues: [expect.objectContaining({ code: "sheet_memory_budget_exceeded" })] });
  });

  it("propaga preflight-blocked (asset roto) sin calcular imposición ni rasterizar nada", async () => {
    const image = buildImage("obj_1", { assetId: AssetIdSchema.parse("asset_fantasma") });
    const page = buildPage("page_1", [buildLayer("layer_1", [image])], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { cutPath: NO_CUT_PATH, imposition: gridImposition() });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    await expect(
      exportImpositionToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toMatchObject({ code: "preflight-blocked" });
    expect(renderPageToStageMock).not.toHaveBeenCalled();
  });

  it("emite las etapas esperadas: validating, preparing-assets, rendering-page x1, encoding-page x2, finalizing, completed", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { bleed: ZERO_BLEED, cropMarks: NO_CROP_MARKS, cutPath: NO_CUT_PATH, imposition: gridImposition() });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    const events: string[] = [];
    await exportImpositionToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "x",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
      onProgress: (event) => events.push(event.stage),
    });
    expect(events).toEqual(["validating", "preparing-assets", "rendering-page", "encoding-page", "encoding-page", "finalizing", "completed"]);
  });

  it("respeta la cancelación entre hojas", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", { bleed: ZERO_BLEED, cropMarks: NO_CROP_MARKS, cutPath: NO_CUT_PATH, imposition: gridImposition() });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");
    const controller = new AbortController();

    await expect(
      exportImpositionToPng({
        project,
        printJob,
        resolver: noopResolver,
        projectName: "x",
        fontChecker: NEVER_CHECK,
        imageProbe: NO_PROBE,
        now: NOW,
        onProgress: (event) => {
          if (event.stage === "encoding-page") controller.abort();
        },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "aborted" });
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
    const printJob = buildPrintJobFor(project, "sticker-sheet", { bleed: ZERO_BLEED, cropMarks: NO_CROP_MARKS, cutPath: NO_CUT_PATH, imposition: gridImposition() });
    const before = JSON.parse(JSON.stringify(project));
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");

    try {
      await exportImpositionToPng({
        project,
        printJob,
        resolver: { resolve: async () => new Blob(["png"], { type: "image/png" }) },
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
