import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AssetIdSchema } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { createAssetImageCache } from "./assetImageCache.js";

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

describe("createAssetImageCache", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("Image", FakeImage);
    createObjectURL = vi.fn((blob: Blob) => `blob:${(blob as unknown as { __id?: number }).__id ?? "x"}`);
    revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decodifica y devuelve una imagen para un asset resuelto", async () => {
    const blob = new Blob(["png-bytes"]);
    const resolver: ExportAssetResolver = { resolve: async () => blob };
    const cache = createAssetImageCache(resolver);
    const image = await cache.get(AssetIdSchema.parse("asset_1"));
    expect(image).toBeInstanceOf(FakeImage);
    cache.dispose();
  });

  it("la misma imagen usada varias veces se resuelve/decodifica UNA sola vez", async () => {
    const resolve = vi.fn(async () => new Blob(["png-bytes"]));
    const resolver: ExportAssetResolver = { resolve };
    const cache = createAssetImageCache(resolver);
    const assetId = AssetIdSchema.parse("asset_1");
    const [a, b, c] = await Promise.all([cache.get(assetId), cache.get(assetId), cache.get(assetId)]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(resolve).toHaveBeenCalledTimes(1);
    cache.dispose();
  });

  it("assets distintos se resuelven independientemente", async () => {
    const resolve = vi.fn(async () => new Blob(["png-bytes"]));
    const resolver: ExportAssetResolver = { resolve };
    const cache = createAssetImageCache(resolver);
    await cache.get(AssetIdSchema.parse("asset_1"));
    await cache.get(AssetIdSchema.parse("asset_2"));
    expect(resolve).toHaveBeenCalledTimes(2);
    cache.dispose();
  });

  it("lanza PrintEngineError('asset-resolution-failed') si el resolver no encuentra el binario", async () => {
    const resolver: ExportAssetResolver = { resolve: async () => undefined };
    const cache = createAssetImageCache(resolver);
    await expect(cache.get(AssetIdSchema.parse("asset_ghost"))).rejects.toMatchObject({ code: "asset-resolution-failed" });
    cache.dispose();
  });

  it("lanza PrintEngineError('asset-resolution-failed') si la imagen no decodifica (onerror)", async () => {
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("Image", FailingImage);
    const resolver: ExportAssetResolver = { resolve: async () => new Blob(["not-an-image"]) };
    const cache = createAssetImageCache(resolver);
    await expect(cache.get(AssetIdSchema.parse("asset_1"))).rejects.toMatchObject({ code: "asset-resolution-failed" });
    cache.dispose();
  });

  it("totalBytes() acumula el tamaño de cada Blob distinto decodificado, sin contar duplicados", async () => {
    const resolver: ExportAssetResolver = { resolve: async () => new Blob(["0123456789"]) }; // 10 bytes
    const cache = createAssetImageCache(resolver);
    await cache.get(AssetIdSchema.parse("asset_1"));
    await cache.get(AssetIdSchema.parse("asset_1")); // cacheado, no vuelve a sumar
    await cache.get(AssetIdSchema.parse("asset_2"));
    expect(cache.totalBytes()).toBe(20);
    cache.dispose();
  });

  it("dispose() revoca cada object URL creado", async () => {
    const resolver: ExportAssetResolver = { resolve: async () => new Blob(["x"]) };
    const cache = createAssetImageCache(resolver);
    await cache.get(AssetIdSchema.parse("asset_1"));
    await cache.get(AssetIdSchema.parse("asset_2"));
    cache.dispose();
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("dispose() es idempotente — llamarlo dos veces no revoca doble ni lanza", async () => {
    const resolver: ExportAssetResolver = { resolve: async () => new Blob(["x"]) };
    const cache = createAssetImageCache(resolver);
    await cache.get(AssetIdSchema.parse("asset_1"));
    cache.dispose();
    expect(() => cache.dispose()).not.toThrow();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("un object URL se registra para revocación incluso si la decodificación falla después", async () => {
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("Image", FailingImage);
    const resolver: ExportAssetResolver = { resolve: async () => new Blob(["x"]) };
    const cache = createAssetImageCache(resolver);
    await expect(cache.get(AssetIdSchema.parse("asset_1"))).rejects.toBeDefined();
    cache.dispose();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
