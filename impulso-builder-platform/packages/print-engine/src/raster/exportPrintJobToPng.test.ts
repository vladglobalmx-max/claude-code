import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AssetIdSchema } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import { buildDocument, buildImage, buildImageAsset, buildLayer, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";

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
});
