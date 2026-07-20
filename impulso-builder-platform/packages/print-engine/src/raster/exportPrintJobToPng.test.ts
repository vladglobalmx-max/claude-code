import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AssetIdSchema } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import { buildDocument, buildEllipse, buildImage, buildImageAsset, buildLayer, buildPage, buildPath, buildPrintJobFor, buildProject, buildRectangle } from "../testUtils/fixtures.js";
import { createFakeCanvasContext2D } from "../testUtils/fakeCanvasContext2D.js";
import { computeBoxes } from "../boxes.js";
import { physicalToPixels } from "../units.js";

let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;
let toBlobResult: Blob | null;

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

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

describe("exportPrintJobToPng", () => {
  beforeEach(() => {
    toBlobResult = new Blob(["png"], { type: "image/png" });
    renderPageToStageMock = vi.fn(() => ({
      stage: { toCanvas: () => fakeCanvas() },
      widthPx: 10,
      heightPx: 10,
      destroy: vi.fn(),
    }));
    resolveActivePageMock = vi.fn((project, pageId) => project.document.pages.find((p: { id: unknown }) => p.id === pageId));
    // jsdom no implementa un contexto 2D real (ver ADR-0004 de
    // `@impulso/renderer-konva`) — necesario porque el perfil por defecto
    // de estos tests ("print-pdf") tiene `cropMarks.enabled`, así que
    // `exportPrintJobToPng` compone un canvas de MediaBox real.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(createFakeCanvasContext2D() as unknown as CanvasRenderingContext2D);
    // Ídem para `toBlob` — jsdom tampoco lo implementa en un canvas real
    // (el canvas de MediaBox creado por `createMediaCanvasWithContent` es
    // un `HTMLCanvasElement` real de jsdom, a diferencia del `fakeCanvas`
    // arriba, que sí trae su propio `toBlob`).
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(toBlobResult));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("una sola página produce un único resultado, sin 'page-XX' en el nombre", async () => {
    const page = buildPage("page_1", []);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

    const result = await exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "Mi Sticker",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]!.filename).not.toContain("page-");
    expect(result.pages[0]!.filename).toBe("Mi Sticker_print-pdf_2026-07-20.png");
  });

  it("multipágina numera cada archivo de forma estable (page-01, page-02, ...)", async () => {
    const page1 = buildPage("page_1", []);
    const page2 = buildPage("page_2", []);
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id];
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

    const result = await exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "Mi Sticker",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]!.filename).toContain("page-01");
    expect(result.pages[1]!.filename).toContain("page-02");
  });

  it("emite encoding-page por cada página, y finalizing/completed al final", async () => {
    const page1 = buildPage("page_1", []);
    const page2 = buildPage("page_2", []);
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id];
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

    const events: string[] = [];
    await exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "Mi Sticker",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
      onProgress: (event) => events.push(event.stage),
    });
    expect(events).toEqual([
      "validating",
      "preparing-assets",
      "rendering-page",
      "encoding-page",
      "rendering-page",
      "encoding-page",
      "finalizing",
      "completed",
    ]);
  });

  it("canvas.toBlob(null) lanza PrintEngineError('raster-encoding-failed')", async () => {
    toBlobResult = null;
    const page = buildPage("page_1", []);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

    await expect(
      exportPrintJobToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toMatchObject({ code: "raster-encoding-failed" });
  });

  it("expone los warnings de Preflight en el resultado", async () => {
    const image = buildImage("obj_1", { assetId: AssetIdSchema.parse("asset_fantasma") });
    const page = buildPage("page_1", [buildLayer("layer_1", [image])]);
    const project = buildProject({ document: buildDocument([page]) });
    // Uso deliberado de una escala extrema (warning, no error) para poder
    // llegar a exportar y observar el warning en el resultado — un error
    // real de Preflight (como el asset faltante de arriba) haría que
    // renderPrintJob lance ANTES de llegar aquí.
    const printJob = buildPrintJobFor(project, "print-pdf", { scale: 500 });
    printJob.pageIds = []; // sin páginas que renderizar — solo interesa el resultado de Preflight
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

    const result = await exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "x",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    expect(result.warnings.some((issue) => issue.code === "extreme_scale")).toBe(true);
  });

  it("propaga preflight-blocked sin producir ninguna página", async () => {
    const image = buildImage("obj_1", { assetId: AssetIdSchema.parse("asset_fantasma") });
    const page = buildPage("page_1", [buildLayer("layer_1", [image])]);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

    await expect(
      exportPrintJobToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
    ).rejects.toMatchObject({ code: "preflight-blocked" });
  });

  it("respeta la cancelación a mitad de la exportación", async () => {
    const page1 = buildPage("page_1", []);
    const page2 = buildPage("page_2", []);
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id];
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");
    const controller = new AbortController();

    await expect(
      exportPrintJobToPng({
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
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

    try {
      await exportPrintJobToPng({
        project,
        printJob,
        resolver: { resolve: async () => new Blob(["x"]) },
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

  describe("overlays de marcas + cut path (Fase 9.3)", () => {
    const DIE_LINE_METADATA = { tags: [], visible: true, locked: false, createdAt: NOW(), updatedAt: NOW(), role: "die-line" };

    it("sin marcas ni cutPath (perfil digital-png): el canvas resultante es el de CONTENIDO, sin componer nada extra", async () => {
      const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "digital-png");
      const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

      const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
      const result = await exportPrintJobToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });

      const boxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, printJob.cropMarks);
      const expectedWidth = Math.round(physicalToPixels(boxes.bleed.width, boxes.trim.unit, printJob.resolution.targetPpi));
      expect(result.pages[0]!.widthPx).toBe(expectedWidth); // el ancho del canvas de CONTENIDO (BleedBox), sin ampliar
      expect(getContextSpy).not.toHaveBeenCalled(); // nunca se creó un canvas de MediaBox
    });

    it("con marcas (perfil print-pdf, default): el canvas resultante es más grande que el de contenido (MediaBox > BleedBox)", async () => {
      const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "print-pdf");
      const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

      const result = await exportPrintJobToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });

      const boxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, printJob.cropMarks);
      const expectedWidth = Math.round(physicalToPixels(boxes.media.width, boxes.trim.unit, printJob.resolution.targetPpi));
      expect(result.pages[0]!.widthPx).toBe(expectedWidth);
      expect(result.pages[0]!.widthPx).toBeGreaterThan(10); // más grande que el fakeCanvas de contenido (10px)
    });

    it("con marcas activadas, se dibujan 8 líneas sobre el canvas compuesto", async () => {
      const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "print-pdf");
      const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

      const fakeCtx = createFakeCanvasContext2D();
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);

      await exportPrintJobToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });

      const moveToCalls = fakeCtx.calls.filter((c) => c.method === "moveTo");
      expect(moveToCalls).toHaveLength(8); // 1 moveTo por marca de corte
    });

    it("cutPath.mode 'die-cut' con un die-line detectado: dibuja un path vectorial sobre el canvas compuesto", async () => {
      const dieLine = buildRectangle("die_1", { size: { width: 20, height: 20 }, metadata: DIE_LINE_METADATA });
      const page = buildPage("page_1", [buildLayer("layer_1", [dieLine])], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

      const fakeCtx = createFakeCanvasContext2D();
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);

      await exportPrintJobToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });

      const closePathCalls = fakeCtx.calls.filter((c) => c.method === "closePath");
      expect(closePathCalls.length).toBeGreaterThanOrEqual(1); // el cut path (rectángulo) cierra su path
    });

    it("cutPath.mode != 'none' sin ningún die-line: Preflight bloquea con cut_path_missing", async () => {
      const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

      await expect(
        exportPrintJobToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW }),
      ).rejects.toMatchObject({ code: "preflight-blocked", preflightIssues: [expect.objectContaining({ code: "cut_path_missing" })] });
    });

    it("cutPath.mode 'die-cut' con un die-line Ellipse: dibuja curvas bezier (aproximación) sobre el canvas compuesto", async () => {
      const dieLine = buildEllipse("die_1", { size: { width: 20, height: 20 }, metadata: DIE_LINE_METADATA });
      const page = buildPage("page_1", [buildLayer("layer_1", [dieLine])], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

      const fakeCtx = createFakeCanvasContext2D();
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);

      await exportPrintJobToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });

      const bezierCalls = fakeCtx.calls.filter((c) => c.method === "bezierCurveTo");
      expect(bezierCalls).toHaveLength(4); // 4 curvas cúbicas por elipse (cutGeometryToPathSegments)
    });

    it("cutPath.mode 'die-cut' con un die-line Path cerrado: dibuja el path tal cual, sin bezier", async () => {
      const dieLine = buildPath("die_1", {
        segments: [
          { type: "moveTo", point: { x: 0, y: 0 } },
          { type: "lineTo", point: { x: 20, y: 0 } },
          { type: "lineTo", point: { x: 20, y: 20 } },
          { type: "lineTo", point: { x: 0, y: 20 } },
        ],
        closed: true,
        metadata: DIE_LINE_METADATA,
      });
      const page = buildPage("page_1", [buildLayer("layer_1", [dieLine])], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

      const fakeCtx = createFakeCanvasContext2D();
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);

      await exportPrintJobToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });

      expect(fakeCtx.calls.some((c) => c.method === "bezierCurveTo")).toBe(false);
      expect(fakeCtx.calls.some((c) => c.method === "closePath")).toBe(true);
    });

    it("multipágina: cada página compone SU PROPIO die-line, nunca el de la página 1", async () => {
      const dieLine1 = buildRectangle("die_1", { size: { width: 20, height: 20 }, metadata: DIE_LINE_METADATA });
      const dieLine2 = buildEllipse("die_2", { size: { width: 20, height: 20 }, metadata: DIE_LINE_METADATA });
      const page1 = buildPage("page_1", [buildLayer("layer_1", [dieLine1])], { size: { width: 50, height: 50 }, unit: "mm" });
      const page2 = buildPage("page_2", [buildLayer("layer_1", [dieLine2])], { size: { width: 50, height: 50 }, unit: "mm" });
      const project = buildProject({ document: buildDocument([page1, page2]) });
      const printJob = buildPrintJobFor(project, "sticker-sheet");
      printJob.pageIds = [page1.id, page2.id];
      const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

      const contexts: ReturnType<typeof createFakeCanvasContext2D>[] = [];
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
        const ctx = createFakeCanvasContext2D();
        contexts.push(ctx);
        return ctx as unknown as CanvasRenderingContext2D;
      });

      const result = await exportPrintJobToPng({ project, printJob, resolver: noopResolver, projectName: "x", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });

      expect(result.pages).toHaveLength(2);
      expect(contexts).toHaveLength(2); // un canvas de MediaBox compuesto por página
      expect(contexts[0]!.calls.some((c) => c.method === "bezierCurveTo")).toBe(false); // página 1: rectangle
      expect(contexts[1]!.calls.some((c) => c.method === "bezierCurveTo")).toBe(true); // página 2: ellipse
    });
  });
});
