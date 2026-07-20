import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PageIdSchema } from "@impulso/document-schema";
import type { AssetImageCache } from "./assetImageCache.js";
import { buildDocument, buildGroup, buildImage, buildImageAsset, buildLayer, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";

const destroy = vi.fn();
let toCanvasImpl: (opts: { pixelRatio: number }) => HTMLCanvasElement;
let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

function fakeCanvas(width: number, height: number): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement;
}

function fakeImageCache(): AssetImageCache {
  const image = {} as CanvasImageSource;
  return {
    get: vi.fn(async () => image as unknown as HTMLImageElement),
    totalBytes: () => 0,
    dispose: vi.fn(),
  };
}

describe("renderPrintPage", () => {
  beforeEach(() => {
    destroy.mockClear();
    toCanvasImpl = (opts) => fakeCanvas(Math.round(100 * opts.pixelRatio), Math.round(100 * opts.pixelRatio));
    renderPageToStageMock = vi.fn(() => ({
      stage: { toCanvas: (opts: { pixelRatio: number }) => toCanvasImpl(opts) },
      widthPx: 100,
      heightPx: 100,
      destroy,
    }));
    resolveActivePageMock = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lanza render-failed si la página no existe", async () => {
    resolveActivePageMock.mockReturnValue(undefined);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject();
    const printJob = buildPrintJobFor(project);
    await expect(
      renderPrintPage({ project, printJob, pageId: PageIdSchema.parse("page_ghost"), imageCache: fakeImageCache() }),
    ).rejects.toMatchObject({ code: "render-failed" });
  });

  it("pasa canvasSizePx/contentOffsetPx calculados (BleedBox) a renderPageToStage", async () => {
    const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
    resolveActivePageMock.mockReturnValue(page);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "print-pdf"); // bleed estándar 3mm
    await renderPrintPage({ project, printJob, pageId: page.id, imageCache: fakeImageCache() });

    const [, options] = renderPageToStageMock.mock.calls[0]!;
    const opts = options as { canvasSizePx: { width: number; height: number }; contentOffsetPx: { x: number; y: number } };
    // trim 50mm + 3mm*2 de bleed = 56mm de BleedBox -> en px canónico.
    expect(opts.canvasSizePx.width).toBeGreaterThan(opts.canvasSizePx.height - 1000); // sanity: valores finitos razonables
    expect(opts.contentOffsetPx.x).toBeGreaterThan(0);
    expect(opts.contentOffsetPx.y).toBeGreaterThan(0);
  });

  it("pasa printJob.scale como contentScale a renderPageToStage (nunca sin usar)", async () => {
    const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
    resolveActivePageMock.mockReturnValue(page);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "print-pdf", { scale: 2 });
    await renderPrintPage({ project, printJob, pageId: page.id, imageCache: fakeImageCache() });

    const [, options] = renderPageToStageMock.mock.calls[0]!;
    expect((options as { contentScale: number }).contentScale).toBe(2);
  });

  it("con scale=1 (default), contentScale es exactamente 1", async () => {
    const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
    resolveActivePageMock.mockReturnValue(page);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    await renderPrintPage({ project, printJob, pageId: page.id, imageCache: fakeImageCache() });

    const [, options] = renderPageToStageMock.mock.calls[0]!;
    expect((options as { contentScale: number }).contentScale).toBe(1);
  });

  it("pixelRatio pasado a stage.toCanvas es exactamente canonicalScale (targetPpi/96)", async () => {
    const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
    resolveActivePageMock.mockReturnValue(page);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "print-pdf", { resolution: { targetPpi: 300 } });
    let seenPixelRatio = 0;
    toCanvasImpl = (opts) => {
      seenPixelRatio = opts.pixelRatio;
      return fakeCanvas(10, 10);
    };
    await renderPrintPage({ project, printJob, pageId: page.id, imageCache: fakeImageCache() });
    expect(seenPixelRatio).toBeCloseTo(300 / 96, 10);
  });

  it("fondo sólido pasa backgroundColor; digital-png (transparente) no pasa ninguno", async () => {
    const page = buildPage("page_1", []);
    resolveActivePageMock.mockReturnValue(page);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject({ document: buildDocument([page]) });

    const printPdfJob = buildPrintJobFor(project, "print-pdf");
    await renderPrintPage({ project, printJob: printPdfJob, pageId: page.id, imageCache: fakeImageCache() });
    expect(renderPageToStageMock).toHaveBeenLastCalledWith(project, expect.objectContaining({ backgroundColor: "#ffffff" }));

    const digitalJob = buildPrintJobFor(project, "digital-png");
    await renderPrintPage({ project, printJob: digitalJob, pageId: page.id, imageCache: fakeImageCache() });
    expect(renderPageToStageMock).toHaveBeenLastCalledWith(project, expect.objectContaining({ backgroundColor: undefined }));
  });

  it("resuelve los assetId de Image referenciados y los expone sincrónicamente vía resolveAssetSource", async () => {
    const asset = buildImageAsset("asset_1");
    const image = buildImage("img_1", { assetId: asset.id });
    const page = buildPage("page_1", [buildLayer("layer_1", [image])]);
    resolveActivePageMock.mockReturnValue(page);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject({ document: buildDocument([page], { assets: [asset] }) });
    const printJob = buildPrintJobFor(project);
    const cache = fakeImageCache();
    await renderPrintPage({ project, printJob, pageId: page.id, imageCache: cache });
    expect(cache.get).toHaveBeenCalledWith(asset.id);
    const [, options] = renderPageToStageMock.mock.calls[0]!;
    const resolveAssetSource = (options as { resolveAssetSource: (id: unknown) => unknown }).resolveAssetSource;
    expect(resolveAssetSource(asset.id)).toBeDefined();
  });

  it("resuelve el assetId de una Image anidada dentro de un group (recursivo)", async () => {
    const asset = buildImageAsset("asset_1");
    const image = buildImage("img_1", { assetId: asset.id });
    const page = buildPage("page_1", [buildLayer("layer_1", [buildGroup("group_1", [image])])]);
    resolveActivePageMock.mockReturnValue(page);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject({ document: buildDocument([page], { assets: [asset] }) });
    const printJob = buildPrintJobFor(project);
    const cache = fakeImageCache();
    await renderPrintPage({ project, printJob, pageId: page.id, imageCache: cache });
    expect(cache.get).toHaveBeenCalledWith(asset.id);
  });

  it("el shouldRenderObject pasado excluye die-line por defecto y respeta un filtro adicional", async () => {
    const page = buildPage("page_1", []);
    resolveActivePageMock.mockReturnValue(page);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const dieLine = buildImage("die_1", { metadata: { tags: [], visible: true, locked: false, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z", role: "die-line" } });
    const other = buildImage("other_1");

    await renderPrintPage({
      project,
      printJob,
      pageId: page.id,
      imageCache: fakeImageCache(),
      shouldRenderObject: (object) => object.id !== "other_1",
    });
    const [, options] = renderPageToStageMock.mock.calls[0]!;
    const shouldRenderObject = (options as { shouldRenderObject: (o: unknown, c: unknown) => boolean }).shouldRenderObject;
    expect(shouldRenderObject(dieLine, { pageId: page.id, layerId: "layer_1" })).toBe(false);
    expect(shouldRenderObject(other, { pageId: page.id, layerId: "layer_1" })).toBe(false);
  });

  it("destruye el Stage offscreen incluso si toCanvas lanza, y envuelve el error en 'render-failed'", async () => {
    const page = buildPage("page_1", []);
    resolveActivePageMock.mockReturnValue(page);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    toCanvasImpl = () => {
      throw new Error("canvas demasiado grande");
    };
    await expect(renderPrintPage({ project, printJob, pageId: page.id, imageCache: fakeImageCache() })).rejects.toMatchObject({
      code: "render-failed",
    });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("respeta un AbortSignal ya abortado, sin llegar a renderPageToStage", async () => {
    const page = buildPage("page_1", []);
    resolveActivePageMock.mockReturnValue(page);
    const { renderPrintPage } = await import("./renderPrintPage.js");
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project);
    const controller = new AbortController();
    controller.abort();
    await expect(
      renderPrintPage({ project, printJob, pageId: page.id, imageCache: fakeImageCache(), signal: controller.signal }),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(renderPageToStageMock).not.toHaveBeenCalled();
  });
});
