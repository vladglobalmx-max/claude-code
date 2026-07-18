import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { AssetId } from "@impulso/document-schema";
import type { ExportAssetResolver, PngExportOptions } from "../types.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildImage, buildImageAsset, buildGroup } from "../testUtils/fixtures.js";

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

const destroy = vi.fn();
let toCanvasImpl: (opts: { pixelRatio: number }) => HTMLCanvasElement;
let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

function fakeCanvas(width: number, height: number, blobResult: Blob | null = new Blob(["png"], { type: "image/png" })): HTMLCanvasElement {
  return {
    width,
    height,
    toBlob: (cb: (b: Blob | null) => void) => cb(blobResult),
  } as unknown as HTMLCanvasElement;
}

const scaleAndBackground = (scale: PngExportOptions["scale"]): PngExportOptions => ({
  format: "png",
  scale,
  background: { type: "transparent" },
});

describe("rasterizeProjectToPng", () => {
  beforeEach(async () => {
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    destroy.mockClear();
    toCanvasImpl = (opts) => fakeCanvas(100 * opts.pixelRatio, 100 * opts.pixelRatio);
    renderPageToStageMock = vi.fn(() => ({
      stage: { toCanvas: (opts: { pixelRatio: number }) => toCanvasImpl(opts) },
      widthPx: 100,
      heightPx: 100,
      destroy,
    }));
    resolveActivePageMock = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lanza no_active_page si no hay página activa", async () => {
    resolveActivePageMock.mockReturnValue(undefined);
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject();
    const resolver: ExportAssetResolver = { resolve: async () => undefined };
    await expect(rasterizeProjectToPng(project, resolver, scaleAndBackground(1))).rejects.toMatchObject({
      code: "no_active_page",
    });
  });

  it("pasa options.scale como pixelRatio a stage.toCanvas", async () => {
    resolveActivePageMock.mockReturnValue(buildPage("page_1", []));
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({ document: buildDocument([buildPage("page_1", [])]) });
    const resolver: ExportAssetResolver = { resolve: async () => undefined };
    const result = await rasterizeProjectToPng(project, resolver, scaleAndBackground(3));
    expect(result.width).toBe(300);
    expect(result.height).toBe(300);
  });

  it("pasa background sólido como backgroundColor a renderPageToStage", async () => {
    resolveActivePageMock.mockReturnValue(buildPage("page_1", []));
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({ document: buildDocument([buildPage("page_1", [])]) });
    const resolver: ExportAssetResolver = { resolve: async () => undefined };
    await rasterizeProjectToPng(project, resolver, { format: "png", scale: 1, background: { type: "solid", color: "#ffffff" } });
    expect(renderPageToStageMock).toHaveBeenCalledWith(
      project,
      expect.objectContaining({ backgroundColor: "#ffffff" }),
    );
  });

  it("fondo transparente no pasa backgroundColor", async () => {
    resolveActivePageMock.mockReturnValue(buildPage("page_1", []));
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({ document: buildDocument([buildPage("page_1", [])]) });
    const resolver: ExportAssetResolver = { resolve: async () => undefined };
    await rasterizeProjectToPng(project, resolver, scaleAndBackground(1));
    expect(renderPageToStageMock).toHaveBeenCalledWith(project, expect.objectContaining({ backgroundColor: undefined }));
  });

  it("resuelve assetId referenciados por Image y los pasa a resolveAssetSource", async () => {
    const asset = buildImageAsset("asset_1");
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    resolveActivePageMock.mockReturnValue(buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: asset.id })])]));
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: asset.id })])])], {
        assets: [asset],
      }),
    });
    const resolver: ExportAssetResolver = { resolve: async (id) => (id === asset.id ? blob : undefined) };
    const result = await rasterizeProjectToPng(project, resolver, scaleAndBackground(1));
    expect(result.warnings).toHaveLength(0);
    const [, options] = renderPageToStageMock.mock.calls[0]!;
    expect((options as { resolveAssetSource: (id: AssetId) => unknown }).resolveAssetSource(asset.id)).toBeInstanceOf(FakeImage);
  });

  it("Asset referenciado pero ausente del documento -> warning asset_reference_missing", async () => {
    const page = buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: "asset_gone" as AssetId })])]);
    resolveActivePageMock.mockReturnValue(page);
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({ document: buildDocument([page]) });
    const resolver: ExportAssetResolver = { resolve: async () => undefined };
    const result = await rasterizeProjectToPng(project, resolver, scaleAndBackground(1));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.code).toBe("asset_reference_missing");
  });

  it("Asset existe pero sin binario -> warning asset_binary_missing", async () => {
    const asset = buildImageAsset("asset_1");
    const page = buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: asset.id })])]);
    resolveActivePageMock.mockReturnValue(page);
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({ document: buildDocument([page], { assets: [asset] }) });
    const resolver: ExportAssetResolver = { resolve: async () => undefined };
    const result = await rasterizeProjectToPng(project, resolver, scaleAndBackground(1));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.code).toBe("asset_binary_missing");
  });

  it("canvas.toBlob null -> ExportError out_of_memory, y destroy() igual se invoca", async () => {
    resolveActivePageMock.mockReturnValue(buildPage("page_1", []));
    toCanvasImpl = () => fakeCanvas(100, 100, null);
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({ document: buildDocument([buildPage("page_1", [])]) });
    const resolver: ExportAssetResolver = { resolve: async () => undefined };
    await expect(rasterizeProjectToPng(project, resolver, scaleAndBackground(4))).rejects.toMatchObject({
      code: "out_of_memory",
    });
    expect(destroy).toHaveBeenCalled();
  });

  it("stage.toCanvas() lanzando -> ExportError out_of_memory, y destroy() igual se invoca", async () => {
    resolveActivePageMock.mockReturnValue(buildPage("page_1", []));
    toCanvasImpl = () => {
      throw new Error("canvas demasiado grande");
    };
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({ document: buildDocument([buildPage("page_1", [])]) });
    const resolver: ExportAssetResolver = { resolve: async () => undefined };
    await expect(rasterizeProjectToPng(project, resolver, scaleAndBackground(4))).rejects.toMatchObject({
      code: "out_of_memory",
    });
    expect(destroy).toHaveBeenCalled();
  });

  it("resuelve assetId de una Image anidada dentro de un group (recursivo)", async () => {
    const asset = buildImageAsset("asset_1");
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const page = buildPage("page_1", [
      buildLayer("layer_1", [buildGroup("group_1", [buildImage("img_1", { assetId: asset.id })])]),
    ]);
    resolveActivePageMock.mockReturnValue(page);
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({ document: buildDocument([page], { assets: [asset] }) });
    const resolver: ExportAssetResolver = { resolve: async (id) => (id === asset.id ? blob : undefined) };
    const result = await rasterizeProjectToPng(project, resolver, scaleAndBackground(1));
    expect(result.warnings).toHaveLength(0);
  });

  it("propaga el error si la imagen resuelta no decodifica (onerror)", async () => {
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("Image", FailingImage);
    const asset = buildImageAsset("asset_1");
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const page = buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: asset.id })])]);
    resolveActivePageMock.mockReturnValue(page);
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({ document: buildDocument([page], { assets: [asset] }) });
    const resolver: ExportAssetResolver = { resolve: async () => blob };
    await expect(rasterizeProjectToPng(project, resolver, scaleAndBackground(1))).rejects.toThrow(
      "El asset no es una imagen válida.",
    );
  });

  it("revoca cada object URL creado para las imágenes resueltas", async () => {
    const asset = buildImageAsset("asset_1");
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const page = buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: asset.id })])]);
    resolveActivePageMock.mockReturnValue(page);
    const { rasterizeProjectToPng } = await import("./rasterizeProjectToPng.js");
    const project = buildProject({ document: buildDocument([page], { assets: [asset] }) });
    const resolver: ExportAssetResolver = { resolve: async () => blob };
    await rasterizeProjectToPng(project, resolver, scaleAndBackground(1));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
  });
});
