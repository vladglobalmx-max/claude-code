import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AssetIdSchema } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import { buildDocument, buildImage, buildLayer, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";

const destroy = vi.fn();
let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

function fakeCanvas(): HTMLCanvasElement {
  return { width: 10, height: 10 } as unknown as HTMLCanvasElement;
}

const NEVER_CHECK: FontChecker = { check: async () => "available" };
const NO_PROBE: ImageDimensionsProbe = { measure: async () => undefined };
const noopResolver: ExportAssetResolver = { resolve: async () => undefined };

describe("renderPrintJob", () => {
  beforeEach(() => {
    destroy.mockClear();
    renderPageToStageMock = vi.fn(() => ({
      stage: { toCanvas: () => fakeCanvas() },
      widthPx: 10,
      heightPx: 10,
      destroy,
    }));
    resolveActivePageMock = vi.fn((project, pageId) => project.document.pages.find((p: { id: unknown }) => p.id === pageId));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lanza preflight-blocked y adjunta los issues de error, sin renderizar ninguna página", async () => {
    const image = buildImage("obj_1", { assetId: AssetIdSchema.parse("asset_fantasma") });
    const page = buildPage("page_1", [buildLayer("layer_1", [image])]);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { renderPrintJob } = await import("./renderPrintJob.js");

    await expect(
      renderPrintJob({ project, printJob, resolver: noopResolver, fontChecker: NEVER_CHECK, imageProbe: NO_PROBE }),
    ).rejects.toMatchObject({ code: "preflight-blocked" });
    expect(renderPageToStageMock).not.toHaveBeenCalled();
  });

  it("expone los preflightIssues (severidad error) en el PrintEngineError", async () => {
    const image = buildImage("obj_1", { assetId: AssetIdSchema.parse("asset_fantasma") });
    const page = buildPage("page_1", [buildLayer("layer_1", [image])]);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { renderPrintJob } = await import("./renderPrintJob.js");

    try {
      await renderPrintJob({ project, printJob, resolver: noopResolver, fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
      expect.unreachable("debía lanzar");
    } catch (error) {
      const printEngineError = error as { preflightIssues?: Array<{ code: string }> };
      expect(printEngineError.preflightIssues?.some((issue) => issue.code === "asset_reference_missing")).toBe(true);
    }
  });

  it("un memoryBudgetBytes insuficiente bloquea vía Preflight (raster_too_large) ANTES de renderizar ninguna página", async () => {
    const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { renderPrintJob } = await import("./renderPrintJob.js");

    try {
      await renderPrintJob({
        project,
        printJob,
        resolver: noopResolver,
        fontChecker: NEVER_CHECK,
        imageProbe: NO_PROBE,
        memoryBudgetBytes: 100,
      });
      expect.unreachable("debía lanzar");
    } catch (error) {
      const printEngineError = error as { code?: string; preflightIssues?: Array<{ code: string }> };
      expect(printEngineError.code).toBe("preflight-blocked");
      expect(printEngineError.preflightIssues?.some((issue) => issue.code === "raster_too_large")).toBe(true);
    }
    expect(renderPageToStageMock).not.toHaveBeenCalled();
  });

  it("emite progreso: validating -> preparing-assets -> rendering-page (una vez por página)", async () => {
    const page1 = buildPage("page_1", []);
    const page2 = buildPage("page_2", []);
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id];
    const { renderPrintJob } = await import("./renderPrintJob.js");

    const events: string[] = [];
    const result = await renderPrintJob({
      project,
      printJob,
      resolver: noopResolver,
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      onProgress: (event) => events.push(event.stage),
    });
    for await (const _page of result.pages) {
      // consumir el generador completo
    }
    expect(events).toEqual(["validating", "preparing-assets", "rendering-page", "rendering-page"]);
  });

  it("yields una página por cada pageId, en el mismo orden de printJob.pageIds", async () => {
    const page1 = buildPage("page_1", []);
    const page2 = buildPage("page_2", []);
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id];
    const { renderPrintJob } = await import("./renderPrintJob.js");

    const result = await renderPrintJob({ project, printJob, resolver: noopResolver, fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    const seen: unknown[] = [];
    for await (const rendered of result.pages) seen.push(rendered.pageId);
    expect(seen).toEqual([page1.id, page2.id]);
  });

  it("nunca mantiene dos Stages offscreen vivos a la vez — cada página se destruye antes de renderizar la siguiente", async () => {
    const page1 = buildPage("page_1", []);
    const page2 = buildPage("page_2", []);
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id];
    const { renderPrintJob } = await import("./renderPrintJob.js");

    const result = await renderPrintJob({ project, printJob, resolver: noopResolver, fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    let destroyCountAtFirstYield = 0;
    for await (const _rendered of result.pages) {
      if (destroyCountAtFirstYield === 0) destroyCountAtFirstYield = destroy.mock.calls.length;
    }
    // Tras la primera página consumida, su Stage ya debía estar destruido
    // (renderPrintPage lo destruye en su propio `finally`) antes de que el
    // loop pidiera la segunda.
    expect(destroyCountAtFirstYield).toBe(1);
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it("respeta un AbortSignal ya abortado antes de Preflight", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project);
    const { renderPrintJob } = await import("./renderPrintJob.js");
    const controller = new AbortController();
    controller.abort();
    await expect(
      renderPrintJob({ project, printJob, resolver: noopResolver, fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, signal: controller.signal }),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(renderPageToStageMock).not.toHaveBeenCalled();
  });

  it("cancelar a mitad de la iteración detiene el resto de páginas", async () => {
    const page1 = buildPage("page_1", []);
    const page2 = buildPage("page_2", []);
    const page3 = buildPage("page_3", []);
    const project = buildProject({ document: buildDocument([page1, page2, page3]) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id, page3.id];
    const { renderPrintJob } = await import("./renderPrintJob.js");
    const controller = new AbortController();

    const result = await renderPrintJob({ project, printJob, resolver: noopResolver, fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, signal: controller.signal });
    const seen: unknown[] = [];
    await expect(
      (async () => {
        for await (const rendered of result.pages) {
          seen.push(rendered.pageId);
          if (seen.length === 1) controller.abort();
        }
      })(),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(seen).toEqual([page1.id]);
  });

  it("espera document.fonts.ready antes de renderizar, cuando existe", async () => {
    const page = buildPage("page_1", []);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { renderPrintJob } = await import("./renderPrintJob.js");

    const original = (document as { fonts?: unknown }).fonts;
    let resolveReady!: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    let readyAwaited = false;
    // @ts-expect-error -- simula la API real de Font Loading en el documento.
    document.fonts = { ready: readyPromise.then(() => { readyAwaited = true; }) };
    try {
      const resultPromise = renderPrintJob({ project, printJob, resolver: noopResolver, fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
      resolveReady();
      await resultPromise;
      expect(readyAwaited).toBe(true);
    } finally {
      (document as { fonts?: unknown }).fonts = original;
    }
  });

  it("un document.fonts.ready que rechaza no bloquea el render (degradación honesta)", async () => {
    const page = buildPage("page_1", []);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const { renderPrintJob } = await import("./renderPrintJob.js");

    const original = (document as { fonts?: unknown }).fonts;
    // @ts-expect-error -- simula un fallo real de la API de Font Loading.
    document.fonts = { ready: Promise.reject(new Error("fonts API falló")) };
    try {
      const result = await renderPrintJob({ project, printJob, resolver: noopResolver, fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
      const seen: unknown[] = [];
      for await (const rendered of result.pages) seen.push(rendered.pageId);
      expect(seen).toEqual([page.id]);
    } finally {
      (document as { fonts?: unknown }).fonts = original;
    }
  });
});
