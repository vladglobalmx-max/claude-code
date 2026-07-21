import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildDocument, buildLayer, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";
import type { AssetImageCache } from "./assetImageCache.js";

let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

function fakeCanvas(): HTMLCanvasElement {
  return { width: 10, height: 10 } as unknown as HTMLCanvasElement;
}

function fakeImageCache(): AssetImageCache {
  return { get: vi.fn(async () => ({}) as unknown as HTMLImageElement), totalBytes: () => 0, dispose: vi.fn() };
}

describe("createPieceRasterCache", () => {
  beforeEach(() => {
    renderPageToStageMock = vi.fn(() => ({ stage: { toCanvas: () => fakeCanvas() }, widthPx: 10, heightPx: 10, destroy: vi.fn() }));
    resolveActivePageMock = vi.fn((project, pageId) => project.document.pages.find((p: { id: unknown }) => p.id === pageId));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("misma pageId + misma configuración: renderiza UNA sola vez, reutiliza el resto", async () => {
    const { createPieceRasterCache } = await import("./pieceRasterCache.js");
    const page = buildPage("page_1", [buildLayer("layer_1", [])]);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "digital-png");
    const cache = createPieceRasterCache();
    const imageCache = fakeImageCache();

    const first = await cache.get(page.id, { project, printJob, imageCache });
    const second = await cache.get(page.id, { project, printJob, imageCache });

    expect(first).toBe(second);
    expect(renderPageToStageMock).toHaveBeenCalledTimes(1);
    expect(cache.uniqueRenderCount).toBe(1);
  });

  it("llamadas CONCURRENTES con la misma key comparten la misma promesa en vuelo (single-flight)", async () => {
    const { createPieceRasterCache } = await import("./pieceRasterCache.js");
    const page = buildPage("page_1", [buildLayer("layer_1", [])]);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "digital-png");
    const cache = createPieceRasterCache();
    const imageCache = fakeImageCache();

    const [first, second] = await Promise.all([cache.get(page.id, { project, printJob, imageCache }), cache.get(page.id, { project, printJob, imageCache })]);

    expect(first).toBe(second);
    expect(renderPageToStageMock).toHaveBeenCalledTimes(1);
  });

  it("pageId distinta: renderiza cada una por separado", async () => {
    const { createPieceRasterCache } = await import("./pieceRasterCache.js");
    const page1 = buildPage("page_1", [buildLayer("layer_1", [])]);
    const page2 = buildPage("page_2", [buildLayer("layer_2", [])]);
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project, "digital-png");
    const cache = createPieceRasterCache();
    const imageCache = fakeImageCache();

    await cache.get(page1.id, { project, printJob, imageCache });
    await cache.get(page2.id, { project, printJob, imageCache });

    expect(renderPageToStageMock).toHaveBeenCalledTimes(2);
    expect(cache.uniqueRenderCount).toBe(2);
  });

  it("mismo pageId pero targetPpi distinto: renderiza cada configuración por separado", async () => {
    const { createPieceRasterCache } = await import("./pieceRasterCache.js");
    const page = buildPage("page_1", [buildLayer("layer_1", [])]);
    const project = buildProject({ document: buildDocument([page]) });
    const printJobA = buildPrintJobFor(project, "digital-png", { resolution: { targetPpi: 96 } });
    const printJobB = buildPrintJobFor(project, "digital-png", { resolution: { targetPpi: 300 } });
    const cache = createPieceRasterCache();
    const imageCache = fakeImageCache();

    await cache.get(page.id, { project, printJob: printJobA, imageCache });
    await cache.get(page.id, { project, printJob: printJobB, imageCache });

    expect(renderPageToStageMock).toHaveBeenCalledTimes(2);
  });

  it("mismo pageId pero shouldRenderObject de referencia distinta: renderiza cada uno por separado, aunque se comporten igual", async () => {
    const { createPieceRasterCache } = await import("./pieceRasterCache.js");
    const page = buildPage("page_1", [buildLayer("layer_1", [])]);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "digital-png");
    const cache = createPieceRasterCache();
    const imageCache = fakeImageCache();
    const filterA = () => true;
    const filterB = () => true;

    await cache.get(page.id, { project, printJob, imageCache, shouldRenderObject: filterA });
    await cache.get(page.id, { project, printJob, imageCache, shouldRenderObject: filterB });
    await cache.get(page.id, { project, printJob, imageCache, shouldRenderObject: filterA });

    expect(renderPageToStageMock).toHaveBeenCalledTimes(2);
    expect(cache.uniqueRenderCount).toBe(2);
  });

  it("dispose limpia las entradas — una llamada posterior a la misma key vuelve a renderizar", async () => {
    const { createPieceRasterCache } = await import("./pieceRasterCache.js");
    const page = buildPage("page_1", [buildLayer("layer_1", [])]);
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "digital-png");
    const cache = createPieceRasterCache();
    const imageCache = fakeImageCache();

    await cache.get(page.id, { project, printJob, imageCache });
    cache.dispose();
    cache.dispose(); // idempotente
    await cache.get(page.id, { project, printJob, imageCache });

    expect(renderPageToStageMock).toHaveBeenCalledTimes(2);
  });
});
