import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssetIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Document,
} from "@impulso/document-schema";
import { createMemoryAssetStore } from "@impulso/asset-library";
import { createResolvedAssetCache, loadImageElement, preloadDocumentAssets } from "./assetResolution.js";

const NOW = "2026-07-18T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 100;
  naturalHeight = 50;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    if (value === "blob:invalid") queueMicrotask(() => this.onerror?.());
    else queueMicrotask(() => this.onload?.());
  }
}

function buildDocument(assets: Document["assets"] = []): Document {
  return {
    id: DocumentIdSchema.parse("document_1"),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    documentVersion: 1,
    pages: [
      {
        id: PageIdSchema.parse("page_1"),
        size: { width: 100, height: 100 },
        unit: "px",
        layers: [{ id: LayerIdSchema.parse("layer_1"), objects: [], metadata, pluginData: {}, customProperties: {} }],
        metadata,
        pluginData: {},
        customProperties: {},
      },
    ],
    assets,
    metadata,
    history: { entries: [] },
    pluginData: {},
    customProperties: {},
  };
}

function imageAsset(id: string) {
  return {
    id: AssetIdSchema.parse(id),
    type: "image" as const,
    name: `${id}.png`,
    mimeType: "image/png",
    width: 100,
    height: 50,
    metadata,
    pluginData: {},
    customProperties: {},
  };
}

describe("createResolvedAssetCache", () => {
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolve() de un assetId nunca guardado devuelve undefined", () => {
    const cache = createResolvedAssetCache();
    expect(cache.resolve(AssetIdSchema.parse("asset_x"))).toBeUndefined();
  });

  it("set() + resolve() devuelve la misma imagen guardada", () => {
    const cache = createResolvedAssetCache();
    const image = {} as HTMLImageElement;
    cache.set(AssetIdSchema.parse("asset_1"), image);
    expect(cache.resolve(AssetIdSchema.parse("asset_1"))).toBe(image);
  });

  it("set() sobre un id existente con un nuevo objectUrl revoca el anterior", () => {
    const cache = createResolvedAssetCache();
    const assetId = AssetIdSchema.parse("asset_1");
    cache.set(assetId, {} as HTMLImageElement, "blob:1");
    cache.set(assetId, {} as HTMLImageElement, "blob:2");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
  });

  it("clear() revoca todas las object URLs registradas y vacía el cache", () => {
    const cache = createResolvedAssetCache();
    cache.set(AssetIdSchema.parse("asset_1"), {} as HTMLImageElement, "blob:1");
    cache.set(AssetIdSchema.parse("asset_2"), {} as HTMLImageElement, "blob:2");

    cache.clear();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:2");
    expect(cache.resolve(AssetIdSchema.parse("asset_1"))).toBeUndefined();
  });

  it("set() sin objectUrl no intenta revocar nada", () => {
    const cache = createResolvedAssetCache();
    cache.set(AssetIdSchema.parse("asset_1"), {} as HTMLImageElement);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe("loadImageElement", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:ok"), revokeObjectURL: vi.fn() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resuelve con la imagen cargada y el objectUrl usado", async () => {
    const { image, objectUrl } = await loadImageElement(new Blob(["x"]));
    expect(image).toBeInstanceOf(FakeImage);
    expect(objectUrl).toBe("blob:ok");
  });

  it("rechaza y revoca la URL si la imagen no carga", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:invalid"), revokeObjectURL });

    await expect(loadImageElement(new Blob(["x"]))).rejects.toThrow(/no es una imagen válida/);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:invalid");
  });
});

describe("preloadDocumentAssets", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:ok"), revokeObjectURL: vi.fn() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resuelve en el cache cada Asset de type image con un binario guardado", async () => {
    const store = createMemoryAssetStore();
    const asset = imageAsset("asset_1");
    await store.set(asset.id, new Blob(["contenido"]));
    const cache = createResolvedAssetCache();

    await preloadDocumentAssets(buildDocument([asset]), store, cache);

    expect(cache.resolve(asset.id)).toBeDefined();
  });

  it("ignora un Asset sin binario guardado (no lanza)", async () => {
    const store = createMemoryAssetStore();
    const asset = imageAsset("asset_1");
    const cache = createResolvedAssetCache();

    await expect(preloadDocumentAssets(buildDocument([asset]), store, cache)).resolves.toBeUndefined();
    expect(cache.resolve(asset.id)).toBeUndefined();
  });

  it("no hace nada si el documento no tiene Assets", async () => {
    const cache = createResolvedAssetCache();
    await expect(
      preloadDocumentAssets(buildDocument([]), createMemoryAssetStore(), cache),
    ).resolves.toBeUndefined();
  });
});
